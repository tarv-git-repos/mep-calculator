//#region node_modules/.nitro/vite/services/ssr/assets/conversions-kXRQ6bCu.js
/**
* Centralized Unit Conversion Utility Functions
* Used to convert values between Metric (SI) and Imperial (IP) unit systems.
*/
function cToF(c) {
	return c * 1.8 + 32;
}
function fToC(f) {
	return (f - 32) * 5 / 9;
}
function lpsToCfm(lps) {
	return lps * 2.11888;
}
function cfmToLps(cfm) {
	return cfm * .471947443;
}
function m3sToCfm(m3s) {
	return m3s / 471947e-9;
}
function cfmToM3s(cfm) {
	return cfm * 471947e-9;
}
function mToFt(m) {
	return m * 3.28084;
}
function ftToM(ft) {
	return ft / 3.28084;
}
function lpsToGpm(lps) {
	return lps * 15.8503;
}
function kwToTr(kw) {
	return kw / 3.51685;
}
function trToKw(tr) {
	return tr * 3.51685;
}
function btuToKw(btu) {
	return btu * .293;
}
function kwToBtu(kw) {
	return kw / .293;
}
//#endregion
export { fToC as a, kwToTr as c, m3sToCfm as d, mToFt as f, cfmToM3s as i, lpsToCfm as l, cToF as n, ftToM as o, trToKw as p, cfmToLps as r, kwToBtu as s, btuToKw as t, lpsToGpm as u };
