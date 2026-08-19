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
	"/assets/AppShell-BDiiU5fS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2534a-rKBSNSmcdBfehzzdSvszRKBjPgk\"",
		"mtime": "2026-08-19T05:19:37.656Z",
		"size": 152394,
		"path": "../public/assets/AppShell-BDiiU5fS.js"
	},
	"/assets/arrow-left-jFGn2LTL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-Mjziij8+SB2/w7evq1szXKge04A\"",
		"mtime": "2026-08-19T05:19:37.867Z",
		"size": 153,
		"path": "../public/assets/arrow-left-jFGn2LTL.js"
	},
	"/assets/arrow-right-sgioIv0D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-8zTkHt89nPh2ysnn7UxC0xiQ2GI\"",
		"mtime": "2026-08-19T05:19:37.870Z",
		"size": 153,
		"path": "../public/assets/arrow-right-sgioIv0D.js"
	},
	"/assets/AuthContext-FyjnFCUV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"263b-6c8owItvCkZCKsIR3qRMk8muHEg\"",
		"mtime": "2026-08-19T05:19:37.707Z",
		"size": 9787,
		"path": "../public/assets/AuthContext-FyjnFCUV.js"
	},
	"/assets/api-CXyV4iib.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d897-twsOPn0LZTFg545yEd4qjp8d3lI\"",
		"mtime": "2026-08-19T05:19:37.837Z",
		"size": 55447,
		"path": "../public/assets/api-CXyV4iib.js"
	},
	"/assets/admin-BO_0M9VQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a298-alnWpjtT2I3/CR63KDIzkSVBl+k\"",
		"mtime": "2026-08-19T05:19:37.789Z",
		"size": 107160,
		"path": "../public/assets/admin-BO_0M9VQ.js"
	},
	"/assets/busbar-voltage-drop-BYbW3OYQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4a38-hr+G7QWnABlR+HQXsYBjv6L2eJU\"",
		"mtime": "2026-08-19T05:19:37.930Z",
		"size": 19e3,
		"path": "../public/assets/busbar-voltage-drop-BYbW3OYQ.js"
	},
	"/assets/busbar-calculation-DXTz1A4c.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"690c-eSPw1LdYXwjPMB3KjBiw/apdcFM\"",
		"mtime": "2026-08-19T05:19:37.903Z",
		"size": 26892,
		"path": "../public/assets/busbar-calculation-DXTz1A4c.js"
	},
	"/assets/basement-smoke-calc-CpzwOOfD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"60e1-3/sySuW37AfZamW5oCta/duj3/Y\"",
		"mtime": "2026-08-19T05:19:37.876Z",
		"size": 24801,
		"path": "../public/assets/basement-smoke-calc-CpzwOOfD.js"
	},
	"/assets/cable-voltage-drop-DVxrIx1a.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"48f7-S3gjPzbJZxrQv83/wgMm1ytsHL4\"",
		"mtime": "2026-08-19T05:19:37.988Z",
		"size": 18679,
		"path": "../public/assets/cable-voltage-drop-DVxrIx1a.js"
	},
	"/assets/cable-tray-sizing-GvQattM-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8856-TDNSISF9m90YMo9dcBTqf4ndXj8\"",
		"mtime": "2026-08-19T05:19:37.958Z",
		"size": 34902,
		"path": "../public/assets/cable-tray-sizing-GvQattM-.js"
	},
	"/assets/calculator-DvLaY4PX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"206-GQqgYXfkp/NN+HCX80ZWe4dEH+I\"",
		"mtime": "2026-08-19T05:19:38.014Z",
		"size": 518,
		"path": "../public/assets/calculator-DvLaY4PX.js"
	},
	"/assets/central-battery-sizing-B_OwCIsE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6891-poD8YxD+ahZe12MkJRWh11W65bo\"",
		"mtime": "2026-08-19T05:19:38.073Z",
		"size": 26769,
		"path": "../public/assets/central-battery-sizing-B_OwCIsE.js"
	},
	"/assets/calculators-C_a74Okk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6e33-QKZP+nRrHIp2/h8o+wGZ1G/RtF0\"",
		"mtime": "2026-08-19T05:19:38.020Z",
		"size": 28211,
		"path": "../public/assets/calculators-C_a74Okk.js"
	},
	"/assets/capacitor-bank-sizing-oDX-tVm1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4437-S06MYl0dla/1ixSZzQyi+VTrVmo\"",
		"mtime": "2026-08-19T05:19:38.047Z",
		"size": 17463,
		"path": "../public/assets/capacitor-bank-sizing-oDX-tVm1.js"
	},
	"/assets/chw-pump-head-Db0qv6jS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a4f9-OXjXAtSCWR6nVJ6rDWThbEPjkl0\"",
		"mtime": "2026-08-19T05:19:38.132Z",
		"size": 42233,
		"path": "../public/assets/chw-pump-head-Db0qv6jS.js"
	},
	"/assets/chw-pipe-sizer-CinWWBBy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"983a-eGGOrG06rtk67Dmiyv3R19xVovw\"",
		"mtime": "2026-08-19T05:19:38.103Z",
		"size": 38970,
		"path": "../public/assets/chw-pipe-sizer-CinWWBBy.js"
	},
	"/assets/circle-check-DgNNP-sL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6-/2imCqYQCjIWjGH6nzylSsPU4nI\"",
		"mtime": "2026-08-19T05:19:38.159Z",
		"size": 166,
		"path": "../public/assets/circle-check-DgNNP-sL.js"
	},
	"/assets/circle-question-mark-DN2fAxES.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ec-AQqjnRKjEppEB6HzLwZhkNVh20Q\"",
		"mtime": "2026-08-19T05:19:38.162Z",
		"size": 236,
		"path": "../public/assets/circle-question-mark-DN2fAxES.js"
	},
	"/assets/circuit-breaker-sizing-Dx2o23GW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"57f7-SbTFRO5z6WLAp1IlBsagSrn6s2g\"",
		"mtime": "2026-08-19T05:19:38.167Z",
		"size": 22519,
		"path": "../public/assets/circuit-breaker-sizing-Dx2o23GW.js"
	},
	"/assets/condensate-drain-B3Ghi8RS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b52-9xKg5LN9kCESG43ruLmymX9XD6I\"",
		"mtime": "2026-08-19T05:19:38.194Z",
		"size": 15186,
		"path": "../public/assets/condensate-drain-B3Ghi8RS.js"
	},
	"/assets/conversions-GCj7hGJL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f1-GlaMnaUOw3h8fNFkilq1BMpNRZE\"",
		"mtime": "2026-08-19T05:19:38.267Z",
		"size": 497,
		"path": "../public/assets/conversions-GCj7hGJL.js"
	},
	"/assets/condensate-drain-calc-B1gf3oHa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2fcf-s2UuXmEw+ajZgWGK6asPkGC/Dew\"",
		"mtime": "2026-08-19T05:19:38.216Z",
		"size": 12239,
		"path": "../public/assets/condensate-drain-calc-B1gf3oHa.js"
	},
	"/assets/conductor-sizing-94lDJ82o.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5edf-HR4YTOIO19mT8KpuzRF+1h1c/h4\"",
		"mtime": "2026-08-19T05:19:38.243Z",
		"size": 24287,
		"path": "../public/assets/conductor-sizing-94lDJ82o.js"
	},
	"/assets/core-BFqLT5rb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"745-zkAz33hXLRPZ1d0z6KamQrjAkXg\"",
		"mtime": "2026-08-19T05:19:38.270Z",
		"size": 1861,
		"path": "../public/assets/core-BFqLT5rb.js"
	},
	"/assets/dist-87QSDKkM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"95fd-hQhiQ0cipo75l7m9W3wvPHt4v1w\"",
		"mtime": "2026-08-19T05:19:38.321Z",
		"size": 38397,
		"path": "../public/assets/dist-87QSDKkM.js"
	},
	"/assets/dist-js-mWlZkCFq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"172-g7fnQaRG809JyOj7Le5X51OFO5o\"",
		"mtime": "2026-08-19T05:19:38.354Z",
		"size": 370,
		"path": "../public/assets/dist-js-mWlZkCFq.js"
	},
	"/assets/diffuser-selector-Cmp-aM_r.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c49-GgmtrEcyRFe+/Nc9Vht7FSpos+Q\"",
		"mtime": "2026-08-19T05:19:38.295Z",
		"size": 11337,
		"path": "../public/assets/diffuser-selector-Cmp-aM_r.js"
	},
	"/assets/download-CyllO8Xo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dc-HOS7QnmPVXQ16vpsQdAM7XJ8C8s\"",
		"mtime": "2026-08-19T05:19:38.357Z",
		"size": 220,
		"path": "../public/assets/download-CyllO8Xo.js"
	},
	"/assets/database-DzqHLng5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e7-erqFXGQCJHUnw5S9zK/DktmSBVQ\"",
		"mtime": "2026-08-19T05:19:38.291Z",
		"size": 231,
		"path": "../public/assets/database-DzqHLng5.js"
	},
	"/assets/droplet-BHWgpaNJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c8-p7uhmbZSVJ754NMCve5gVRSCqKk\"",
		"mtime": "2026-08-19T05:19:38.374Z",
		"size": 200,
		"path": "../public/assets/droplet-BHWgpaNJ.js"
	},
	"/assets/duct-sizer-14uAP-on.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"37c5-6RUx+9ycCEi587qJrTJF+MMrjPo\"",
		"mtime": "2026-08-19T05:19:38.395Z",
		"size": 14277,
		"path": "../public/assets/duct-sizer-14uAP-on.js"
	},
	"/assets/equipment-XDa6YjRZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3bb9-Gguuiv5b2aUH37aDpekprzPyd+8\"",
		"mtime": "2026-08-19T05:19:38.443Z",
		"size": 15289,
		"path": "../public/assets/equipment-XDa6YjRZ.js"
	},
	"/assets/excelHelpers-CmmUt4tU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b9-E/jVCA6dYfQ97PPNJH4INWd5pIw\"",
		"mtime": "2026-08-19T05:19:38.467Z",
		"size": 953,
		"path": "../public/assets/excelHelpers-CmmUt4tU.js"
	},
	"/assets/electrical-network-bDqdO0uB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1366-C0klwOoaX1zrGHZcPdt5Xs2Duz8\"",
		"mtime": "2026-08-19T05:19:38.419Z",
		"size": 4966,
		"path": "../public/assets/electrical-network-bDqdO0uB.js"
	},
	"/assets/eye-Co-nw305.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f4-gnZDnf5W+DAeosvw/cOdwlM6brw\"",
		"mtime": "2026-08-19T05:19:38.769Z",
		"size": 244,
		"path": "../public/assets/eye-Co-nw305.js"
	},
	"/assets/eye-off-SfyVyF-s.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a2-54O/2NxK0M6Onc4KK65MgzChov4\"",
		"mtime": "2026-08-19T05:19:38.773Z",
		"size": 418,
		"path": "../public/assets/eye-off-SfyVyF-s.js"
	},
	"/assets/folder-plus-bQKg9G32.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"126-rCZ0Pfxr02Ik8JhXGGBgpimXG7c\"",
		"mtime": "2026-08-19T05:19:38.776Z",
		"size": 294,
		"path": "../public/assets/folder-plus-bQKg9G32.js"
	},
	"/assets/FileSaver.min-BvZiQU7D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a81-Jy6giDvb9ZYC00C8iidLJXE2o1M\"",
		"mtime": "2026-08-19T05:19:37.732Z",
		"size": 2689,
		"path": "../public/assets/FileSaver.min-BvZiQU7D.js"
	},
	"/assets/generator-sizing-BGlBY-Qj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ed1a-oQikY4czf1QFOraSWKC6/nMVld0\"",
		"mtime": "2026-08-19T05:19:38.807Z",
		"size": 60698,
		"path": "../public/assets/generator-sizing-BGlBY-Qj.js"
	},
	"/assets/fresh-air-cooling-load-D7FrCM57.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3cf2-k5gSpxEaVeKg9YpZ6zTZucDNYdU\"",
		"mtime": "2026-08-19T05:19:38.780Z",
		"size": 15602,
		"path": "../public/assets/fresh-air-cooling-load-D7FrCM57.js"
	},
	"/assets/heating-load-CHU0rqgB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"362a-PGybdTgekCGTUPo2PWgvEaUnT58\"",
		"mtime": "2026-08-19T05:19:38.842Z",
		"size": 13866,
		"path": "../public/assets/heating-load-CHU0rqgB.js"
	},
	"/assets/html2canvas-CLVA0Ark.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"30b99-sy1E4G2SIiMI6zbWBtfrFwNUxbY\"",
		"mtime": "2026-08-19T05:19:38.881Z",
		"size": 199577,
		"path": "../public/assets/html2canvas-CLVA0Ark.js"
	},
	"/assets/ImportExcelBtn-Cw-XPgV7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"509-Z8CsxVY5XswndsmUSyDfKUvtIbg\"",
		"mtime": "2026-08-19T05:19:37.761Z",
		"size": 1289,
		"path": "../public/assets/ImportExcelBtn-Cw-XPgV7.js"
	},
	"/assets/lighting-lux-calculation-CJujFToX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3bca-xz7vyQANRr0fwmge/G+YLtT8kX8\"",
		"mtime": "2026-08-19T05:19:39.165Z",
		"size": 15306,
		"path": "../public/assets/lighting-lux-calculation-CJujFToX.js"
	},
	"/assets/index.es-ZMW733Np.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24f81-lspEY2myjvJWJpmCDY//kl31rsw\"",
		"mtime": "2026-08-19T05:19:39.100Z",
		"size": 151425,
		"path": "../public/assets/index.es-ZMW733Np.js"
	},
	"/assets/exceljs.min-CGHY4pgT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e307c-2xdY+nkeG0nTLAkvWgxBkYweVMs\"",
		"mtime": "2026-08-19T05:19:38.565Z",
		"size": 929916,
		"path": "../public/assets/exceljs.min-CGHY4pgT.js"
	},
	"/assets/index-BYCuJuW-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10bc25-pxqwQ4PNV6ha2GRnt9ujL3kBNgY\"",
		"mtime": "2026-08-19T05:19:36.823Z",
		"size": 1096741,
		"path": "../public/assets/index-BYCuJuW-.js"
	},
	"/assets/load-summary-CuZaRLR9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"38b1-MhR6LUfrKyKgGukEW1t9talkQlU\"",
		"mtime": "2026-08-19T05:19:39.192Z",
		"size": 14513,
		"path": "../public/assets/load-summary-CuZaRLR9.js"
	},
	"/assets/lock-4tIh0Kro.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c2-QjX1/zElCB/M1osoTbd39l/WDtI\"",
		"mtime": "2026-08-19T05:19:39.243Z",
		"size": 194,
		"path": "../public/assets/lock-4tIh0Kro.js"
	},
	"/assets/lobby-pressurisation-ChaXKxTC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"72f4-g7sE7dAnXzVVwO9Hy/TlOWPt6n0\"",
		"mtime": "2026-08-19T05:19:39.218Z",
		"size": 29428,
		"path": "../public/assets/lobby-pressurisation-ChaXKxTC.js"
	},
	"/assets/login-DyKaH_E6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5ba4-BbkTm/mJiB8CLUOQ5pKtkrjRd5g\"",
		"mtime": "2026-08-19T05:19:39.260Z",
		"size": 23460,
		"path": "../public/assets/login-DyKaH_E6.js"
	},
	"/assets/lpd-calculation-DTCThz-F.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6636-Lha9eaCZl1rQH72Nf13/YKAkH4g\"",
		"mtime": "2026-08-19T05:19:39.288Z",
		"size": 26166,
		"path": "../public/assets/lpd-calculation-DTCThz-F.js"
	},
	"/assets/play-BM08r4ym.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b2-L+QvNoF47QWlK0CzWTv2jaAbK4o\"",
		"mtime": "2026-08-19T05:19:39.348Z",
		"size": 178,
		"path": "../public/assets/play-BM08r4ym.js"
	},
	"/assets/navigation-B4PzNTkR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7c82-SLSaGi6KFlCAY8fUmGqA2k5vtqQ\"",
		"mtime": "2026-08-19T05:19:39.315Z",
		"size": 31874,
		"path": "../public/assets/navigation-B4PzNTkR.js"
	},
	"/assets/plumbing-drainage-6632cgEH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1615-W5MUkjoAiQLY9UPS6AI0oIuR8Fw\"",
		"mtime": "2026-08-19T05:19:39.352Z",
		"size": 5653,
		"path": "../public/assets/plumbing-drainage-6632cgEH.js"
	},
	"/assets/plumbing-fire-tank-capacity-B1zMCBSR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"34b7-UjPiSW74o1B2KerUE38O6oIBU/o\"",
		"mtime": "2026-08-19T05:19:39.397Z",
		"size": 13495,
		"path": "../public/assets/plumbing-fire-tank-capacity-B1zMCBSR.js"
	},
	"/assets/plumbing-fire-pump-duty-4c8K9_SH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2612-3HobbFFgolUM4nDJHHwoSwUfnLA\"",
		"mtime": "2026-08-19T05:19:39.372Z",
		"size": 9746,
		"path": "../public/assets/plumbing-fire-pump-duty-4c8K9_SH.js"
	},
	"/assets/plumbing-fire-tank-duration-Bwbhqpdb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2407-NJRdjiKXXO0YzvnneCWqKFy2AV4\"",
		"mtime": "2026-08-19T05:19:39.418Z",
		"size": 9223,
		"path": "../public/assets/plumbing-fire-tank-duration-Bwbhqpdb.js"
	},
	"/assets/plumbing-fire-water-demand-Oz-QcvT9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ad8-IE0LnZGgoZxBhc7vBnEUuhyTdyo\"",
		"mtime": "2026-08-19T05:19:39.442Z",
		"size": 10968,
		"path": "../public/assets/plumbing-fire-water-demand-Oz-QcvT9.js"
	},
	"/assets/plumbing-fixture-unit-BLKzj4Fb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"46f8-izkYUGcdnC5lUCK/opg79ZXYWEY\"",
		"mtime": "2026-08-19T05:19:39.465Z",
		"size": 18168,
		"path": "../public/assets/plumbing-fixture-unit-BLKzj4Fb.js"
	},
	"/assets/plumbing-hazen-williams-F-1eVKzJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"784c-Jq7GMfbVwoJlxqTNrBFix7PJy+8\"",
		"mtime": "2026-08-19T05:19:39.544Z",
		"size": 30796,
		"path": "../public/assets/plumbing-hazen-williams-F-1eVKzJ.js"
	},
	"/assets/plumbing-fm200-D2smc9sd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66cf-IAUrdKhGlI/XPWkSktVpoJTriPM\"",
		"mtime": "2026-08-19T05:19:39.492Z",
		"size": 26319,
		"path": "../public/assets/plumbing-fm200-D2smc9sd.js"
	},
	"/assets/plumbing-gas-tank-BurJbARa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"31bc-Uo5tPeesXyzlQh99BPjbMbeAL1M\"",
		"mtime": "2026-08-19T05:19:39.517Z",
		"size": 12732,
		"path": "../public/assets/plumbing-gas-tank-BurJbARa.js"
	},
	"/assets/plumbing-loading-unit-BL22F0Fc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"375f-JyaW+dsNvaMF+Lchnc7nT4tML6I\"",
		"mtime": "2026-08-19T05:19:39.571Z",
		"size": 14175,
		"path": "../public/assets/plumbing-loading-unit-BL22F0Fc.js"
	},
	"/assets/plumbing-pressure-vessel-CmKCglcw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3606-ERJG8RUmp8HOCJFriD0hu9GpEew\"",
		"mtime": "2026-08-19T05:19:39.596Z",
		"size": 13830,
		"path": "../public/assets/plumbing-pressure-vessel-CmKCglcw.js"
	},
	"/assets/plumbing-pump-sizing-CODgS-yJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"984c-DW6HeHjpNvwPj/oAZcI4Qj0ibhU\"",
		"mtime": "2026-08-19T05:19:39.622Z",
		"size": 38988,
		"path": "../public/assets/plumbing-pump-sizing-CODgS-yJ.js"
	},
	"/assets/plumbing-sewage-pump-DjLm0USv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23b6-3xFO9ngbkUho0fa4YTRi3B/0DsE\"",
		"mtime": "2026-08-19T05:19:39.649Z",
		"size": 9142,
		"path": "../public/assets/plumbing-sewage-pump-DjLm0USv.js"
	},
	"/assets/plumbing-sprinkler-density-CkyvYMD1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7de4-cLuQYonx/VJdJYqDoAJnlGBxmP8\"",
		"mtime": "2026-08-19T05:19:39.674Z",
		"size": 32228,
		"path": "../public/assets/plumbing-sprinkler-density-CkyvYMD1.js"
	},
	"/assets/plumbing-storm-water-Cz1ykPVx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2947-65h88j4PRF202UhK8QcHP5YaTRo\"",
		"mtime": "2026-08-19T05:19:39.738Z",
		"size": 10567,
		"path": "../public/assets/plumbing-storm-water-Cz1ykPVx.js"
	},
	"/assets/plumbing-sprinkler-kfactor-CAPz_WEK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"102a7-/7SsZRaZg3VXtXYga/vYQ5uOEzg\"",
		"mtime": "2026-08-19T05:19:39.705Z",
		"size": 66215,
		"path": "../public/assets/plumbing-sprinkler-kfactor-CAPz_WEK.js"
	},
	"/assets/plumbing-tank-sizing-EmV0pizm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f4f-OItpxNv4GiioBVQJUctbMMzMpEc\"",
		"mtime": "2026-08-19T05:19:39.810Z",
		"size": 8015,
		"path": "../public/assets/plumbing-tank-sizing-EmV0pizm.js"
	},
	"/assets/plumbing-sump-pump-DCIaoRS2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2e5f-E0PbsIgIlivbqV1h5voM9MoYLsM\"",
		"mtime": "2026-08-19T05:19:39.763Z",
		"size": 11871,
		"path": "../public/assets/plumbing-sump-pump-DCIaoRS2.js"
	},
	"/assets/preliminary-cooling-load-DBbDLVOb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"cf26-/RBlDX1tA1Zgc2/G4ypDrFx96F4\"",
		"mtime": "2026-08-19T05:19:39.863Z",
		"size": 53030,
		"path": "../public/assets/preliminary-cooling-load-DBbDLVOb.js"
	},
	"/assets/plumbing-supply-pipe-sizer-D0KJDCIp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3ef5-1rdQnUYPV3ORHus1wBMxKZwTn4o\"",
		"mtime": "2026-08-19T05:19:39.786Z",
		"size": 16117,
		"path": "../public/assets/plumbing-supply-pipe-sizer-D0KJDCIp.js"
	},
	"/assets/plumbing-water-demand-D6YZz0J_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6885-3mUgSbWetce/16lPi34THgTA5ik\"",
		"mtime": "2026-08-19T05:19:39.834Z",
		"size": 26757,
		"path": "../public/assets/plumbing-water-demand-D6YZz0J_.js"
	},
	"/assets/preload-helper-BcNkJ6ai.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2247-D847jCAP5ERD+46cfjV3zrCHpa8\"",
		"mtime": "2026-08-19T05:19:39.895Z",
		"size": 8775,
		"path": "../public/assets/preload-helper-BcNkJ6ai.js"
	},
	"/assets/privacy-ClL99XsV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11ae-dHW9xEJLaTgChXj9hggCgTPR3/Q\"",
		"mtime": "2026-08-19T05:19:39.931Z",
		"size": 4526,
		"path": "../public/assets/privacy-ClL99XsV.js"
	},
	"/assets/purify.es-Bu4Grnl0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"65fb-UUUgPD99pIfMSCpTHJ8CGM9NB7I\"",
		"mtime": "2026-08-19T05:19:40.176Z",
		"size": 26107,
		"path": "../public/assets/purify.es-Bu4Grnl0.js"
	},
	"/assets/project-load-schedule-B2gBV8rW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"37b08-d7UJZL41szyB5hKXizgR+GlNjqg\"",
		"mtime": "2026-08-19T05:19:39.972Z",
		"size": 228104,
		"path": "../public/assets/project-load-schedule-B2gBV8rW.js"
	},
	"/assets/psychrometric-DzgLBqPh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3782-3+Mzf71zeIRQM0hnb21gTn75l4g\"",
		"mtime": "2026-08-19T05:19:40.147Z",
		"size": 14210,
		"path": "../public/assets/psychrometric-DzgLBqPh.js"
	},
	"/assets/projects-DQsRGVG0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a02a-qUxL/K3GxzY1paxdHMrrUBYMxSE\"",
		"mtime": "2026-08-19T05:19:40.045Z",
		"size": 41002,
		"path": "../public/assets/projects-DQsRGVG0.js"
	},
	"/assets/proxy-CHsxYjb7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e987-29n4yhJtOnjG4bdE9/4lmPhIqPQ\"",
		"mtime": "2026-08-19T05:19:40.089Z",
		"size": 125319,
		"path": "../public/assets/proxy-CHsxYjb7.js"
	},
	"/assets/project-load-schedule-DLioOiRN.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3c35-lFaZK5XKLiA1ueePpWy3ZyWmewg\"",
		"mtime": "2026-08-19T05:19:40.925Z",
		"size": 15413,
		"path": "../public/assets/project-load-schedule-DLioOiRN.css"
	},
	"/assets/reports-D3JEFB27.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7a8-xp8zdG1TNmoiseWtAGXsmchnXY0\"",
		"mtime": "2026-08-19T05:19:40.235Z",
		"size": 1960,
		"path": "../public/assets/reports-D3JEFB27.js"
	},
	"/assets/refrigerant-pipe-sizing-DwsN6ffZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2335-BNSt7hU/m9831oB1iWfFnHWB+ZI\"",
		"mtime": "2026-08-19T05:19:40.212Z",
		"size": 9013,
		"path": "../public/assets/refrigerant-pipe-sizing-DwsN6ffZ.js"
	},
	"/assets/reset-password-YmuN4KOO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ab7-9NaWLejW6N1aeUjm7uoq3UEMm2k\"",
		"mtime": "2026-08-19T05:19:40.254Z",
		"size": 2743,
		"path": "../public/assets/reset-password-YmuN4KOO.js"
	},
	"/assets/routes-D7gH6zFl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"281ab-a7dUdP/LEwOmYtTAdYnG1akwVsA\"",
		"mtime": "2026-08-19T05:19:40.293Z",
		"size": 164267,
		"path": "../public/assets/routes-D7gH6zFl.js"
	},
	"/assets/rolldown-runtime-DAXXjFlN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f5-2encFCuTik/YJedDUFEd4geNCVs\"",
		"mtime": "2026-08-19T05:19:40.276Z",
		"size": 1269,
		"path": "../public/assets/rolldown-runtime-DAXXjFlN.js"
	},
	"/assets/sanity-check-tool-BvNLJ0fq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dea-eps6n/H1M65V3LcvVyGamTGVgjU\"",
		"mtime": "2026-08-19T05:19:40.342Z",
		"size": 11754,
		"path": "../public/assets/sanity-check-tool-BvNLJ0fq.js"
	},
	"/assets/3d-view-D0NGrzup.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a5534-sRdRjzBbmVrWvuaQzbfedCBSovQ\"",
		"mtime": "2026-08-19T05:19:37.504Z",
		"size": 5920052,
		"path": "../public/assets/3d-view-D0NGrzup.js"
	},
	"/assets/short-circuit-calculations-IfQxaFUW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"74e0-/aaP5ojjVhP0AhCVYNWbPsUrabo\"",
		"mtime": "2026-08-19T05:19:40.368Z",
		"size": 29920,
		"path": "../public/assets/short-circuit-calculations-IfQxaFUW.js"
	},
	"/assets/staircase-pressurization-qHuNrG40.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4476-75PPYDSpJXr+rZKeSBaA4NNTR+Q\"",
		"mtime": "2026-08-19T05:19:40.426Z",
		"size": 17526,
		"path": "../public/assets/staircase-pressurization-qHuNrG40.js"
	},
	"/assets/supabase-i9O9rBUK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3284f-KKY4kTo0lUwJOvpekcNxSXA4cF8\"",
		"mtime": "2026-08-19T05:19:40.468Z",
		"size": 206927,
		"path": "../public/assets/supabase-i9O9rBUK.js"
	},
	"/assets/smoke-extract-fan-B0mEkRjh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6793-MjBPDRiANtxqvEEiwKB/oM1cFlo\"",
		"mtime": "2026-08-19T05:19:40.396Z",
		"size": 26515,
		"path": "../public/assets/smoke-extract-fan-B0mEkRjh.js"
	},
	"/assets/styles-DlXOWG-G.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"41732-jnV1R5v19zWurRbkWS7sXVLRIbI\"",
		"mtime": "2026-08-19T05:19:40.960Z",
		"size": 268082,
		"path": "../public/assets/styles-DlXOWG-G.css"
	},
	"/assets/teams-Bt-REJZX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ace-SoNJJaP4n6DP2sEVVW8docGzP+k\"",
		"mtime": "2026-08-19T05:19:40.523Z",
		"size": 6862,
		"path": "../public/assets/teams-Bt-REJZX.js"
	},
	"/assets/transformer-sizing-CB6MaCOc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"635c-1+KkiJrs+Daw2ZQARywQU7JMjeo\"",
		"mtime": "2026-08-19T05:19:40.548Z",
		"size": 25436,
		"path": "../public/assets/transformer-sizing-CB6MaCOc.js"
	},
	"/assets/tslib.es6-Tae09705.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"42d-qJHuGuq51+EbLaebsBAkbj1JLbk\"",
		"mtime": "2026-08-19T05:19:40.576Z",
		"size": 1069,
		"path": "../public/assets/tslib.es6-Tae09705.js"
	},
	"/assets/trash-CB4AGGJ4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f0-MY8NFW/Yv6oDnFUmoTn8Ut3ygxs\"",
		"mtime": "2026-08-19T05:19:40.572Z",
		"size": 240,
		"path": "../public/assets/trash-CB4AGGJ4.js"
	},
	"/assets/typeof-B5XbjTb1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10f-yPXEOGyFHb1Ws7OoWyWNEEBz4mQ\"",
		"mtime": "2026-08-19T05:19:40.583Z",
		"size": 271,
		"path": "../public/assets/typeof-B5XbjTb1.js"
	},
	"/assets/ventilation-CGKyvoac.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"47-nnvnVaPLqJBzax4nQ+Cnm6xdp+I\"",
		"mtime": "2026-08-19T05:19:40.702Z",
		"size": 71,
		"path": "../public/assets/ventilation-CGKyvoac.js"
	},
	"/assets/useShortcuts-D13ue_Cw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b0d-qjCU+ZXgDketrdkR6q2yUI7Kdbw\"",
		"mtime": "2026-08-19T05:19:40.678Z",
		"size": 2829,
		"path": "../public/assets/useShortcuts-D13ue_Cw.js"
	},
	"/assets/ups-sizing-calculation-DN-49xCS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"55fa-icmlTf55NjFnpmPkoFYVcOG9E4Q\"",
		"mtime": "2026-08-19T05:19:40.605Z",
		"size": 22010,
		"path": "../public/assets/ups-sizing-calculation-DN-49xCS.js"
	},
	"/assets/use-confirm-DQ-l1cD9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"119dc-7pNfxgzC7fIBB8JaF+ZzPpXu+qs\"",
		"mtime": "2026-08-19T05:19:40.636Z",
		"size": 72156,
		"path": "../public/assets/use-confirm-DQ-l1cD9.js"
	},
	"/assets/workspace-store-BewiKNkE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c587-M0yaItKJQ9OXA1LOsf6uU/OTpXY\"",
		"mtime": "2026-08-19T05:19:40.726Z",
		"size": 50567,
		"path": "../public/assets/workspace-store-BewiKNkE.js"
	},
	"/assets/xlsx-BypCUzQ8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66dcf-v5fE1ZHiIyXM+ndXVEhWkdB+Sgw\"",
		"mtime": "2026-08-19T05:19:40.796Z",
		"size": 421327,
		"path": "../public/assets/xlsx-BypCUzQ8.js"
	},
	"/assets/zones-DZ9pPpWW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3f4c-QcXIY67gWOMq1rsI+K976m4XGXc\"",
		"mtime": "2026-08-19T05:19:40.899Z",
		"size": 16204,
		"path": "../public/assets/zones-DZ9pPpWW.js"
	},
	"/assets/worker-GQlxtHkx.mjs": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"35116f-m5Y7pJ85tGx3dIPUddxTWwrru+g\"",
		"mtime": "2026-08-19T05:19:41.277Z",
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
