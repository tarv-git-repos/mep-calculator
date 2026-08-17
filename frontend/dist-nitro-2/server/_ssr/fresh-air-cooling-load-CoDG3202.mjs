import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Ut as TriangleAlert } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { n as utils, r as writeSync } from "../_libs/xlsx.mjs";
import { a as fToC, d as m3sToCfm, i as cfmToM3s, n as cToF } from "./conversions-kXRQ6bCu.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/fresh-air-cooling-load-CoDG3202.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function satP(tK) {
	if (tK >= 273.15) return Math.exp(-5800.2206 / tK + 1.3914993 - .04864 * tK + 41764768e-12 * tK ** 2 - 1.4452093e-8 * tK ** 3 + 6.5459673 * Math.log(tK));
	return Math.exp(-5674.5359 / tK + 6.3925247 - .009677843 * tK + 6.2215701e-7 * tK ** 2 + 2.0747825e-9 * tK ** 3 - 9484024e-25 * tK ** 4 + 4.1635019 * Math.log(tK));
}
function wFromWB(db, wb, p) {
	const ws = .621945 * satP(wb + 273.15) / (p - satP(wb + 273.15));
	return ((2501 - 2.381 * wb) * ws - 1.006 * (db - wb)) / (2501 + 1.805 * db - 4.186 * wb);
}
function FreshAirCoolingLoadPage() {
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("ip");
	const [dbIn, setDbIn] = (0, import_react.useState)("");
	const [wbIn, setWbIn] = (0, import_react.useState)("");
	const [dbOut, setDbOut] = (0, import_react.useState)("");
	const [wbOut, setWbOut] = (0, import_react.useState)("");
	const [flowRate, setFlowRate] = (0, import_react.useState)("");
	const [hasCalculated, setHasCalculated] = (0, import_react.useState)(false);
	const ip = unitSystem === "ip";
	const handleUnitSystemChange = (unit) => {
		if (unit === unitSystem) return;
		setUnitSystem(unit);
		if (window.__mep_keep_values) return;
		const convT = (t) => unit === "ip" ? cToF(t) : fToC(t);
		const convF = (f) => unit === "ip" ? m3sToCfm(f) : cfmToM3s(f);
		setDbIn(dbIn !== "" ? Number(convT(Number(dbIn)).toFixed(1)) : "");
		setWbIn(wbIn !== "" ? Number(convT(Number(wbIn)).toFixed(1)) : "");
		setDbOut(dbOut !== "" ? Number(convT(Number(dbOut)).toFixed(1)) : "");
		setWbOut(wbOut !== "" ? Number(convT(Number(wbOut)).toFixed(1)) : "");
		setFlowRate(flowRate !== "" ? Number(convF(Number(flowRate)).toFixed(unit === "ip" ? 0 : 3)) : "");
	};
	const calc = (0, import_react.useMemo)(() => {
		const dbInVal = dbIn !== "" ? Number(dbIn) : ip ? 95 : 35;
		const wbInVal = wbIn !== "" ? Number(wbIn) : ip ? 78 : 25.5;
		const dbOutVal = dbOut !== "" ? Number(dbOut) : ip ? 55 : 12.8;
		const wbOutVal = wbOut !== "" ? Number(wbOut) : ip ? 54 : 12.2;
		const flowVal = flowRate !== "" ? Number(flowRate) : ip ? 1e3 : .472;
		const dbInC = ip ? fToC(dbInVal) : dbInVal;
		const wbInC = ip ? fToC(wbInVal) : wbInVal;
		const dbOutC = ip ? fToC(dbOutVal) : dbOutVal;
		const wbOutC = ip ? fToC(wbOutVal) : wbOutVal;
		const flowM3s = ip ? cfmToM3s(flowVal) : flowVal;
		const pAtm = 101325;
		const wInKg = wFromWB(dbInC, wbInC, pAtm);
		const wOutKg = wFromWB(dbOutC, wbOutC, pAtm);
		const mDot = flowM3s * 1.2;
		const cp = 1.006;
		const hfg = 2501;
		const sensKw = mDot * cp * (dbInC - dbOutC);
		const latKw = mDot * (wInKg - wOutKg) * hfg;
		const totKw = sensKw + latKw;
		const capTons = totKw / 3.51685;
		return {
			sensLoad: ip ? sensKw * 3412.14 : sensKw,
			latLoad: ip ? latKw * 3412.14 : latKw,
			totLoad: ip ? totKw * 3412.14 : totKw,
			capacityTons: capTons,
			wIn: ip ? wInKg * 7e3 : wInKg,
			wOut: ip ? wOutKg * 7e3 : wOutKg
		};
	}, [
		dbIn,
		wbIn,
		dbOut,
		wbOut,
		flowRate,
		ip
	]);
	const warnings = (0, import_react.useMemo)(() => {
		const w = [];
		const dbInVal = dbIn !== "" ? Number(dbIn) : ip ? 95 : 35;
		const wbInVal = wbIn !== "" ? Number(wbIn) : ip ? 78 : 25.5;
		const dbOutVal = dbOut !== "" ? Number(dbOut) : ip ? 55 : 12.8;
		const wbOutVal = wbOut !== "" ? Number(wbOut) : ip ? 54 : 12.2;
		if (wbInVal > dbInVal) w.push("Entering Wet Bulb cannot be higher than Entering Dry Bulb temperature.");
		if (wbOutVal > dbOutVal) w.push("Leaving Wet Bulb cannot be higher than Leaving Dry Bulb temperature.");
		if (dbOutVal > dbInVal) w.push("Leaving Dry Bulb temperature is greater than Entering Dry Bulb temperature.");
		if (wbOutVal > wbInVal) w.push("Leaving Wet Bulb temperature is greater than Entering Wet Bulb temperature.");
		return w;
	}, [
		dbIn,
		wbIn,
		dbOut,
		wbOut,
		ip
	]);
	const handleExportExcel = () => {
		const wb2 = utils.book_new();
		const uT = ip ? "°F" : "°C", uL = ip ? "BTU/h" : "kW", uW = ip ? "gr/lb" : "kg/kg";
		const data = [
			["Fresh Air Cooling Load Sizing"],
			[],
			["Entering Air DB", `${dbIn} ${uT}`],
			["Entering Air WB", `${wbIn} ${uT}`],
			["Leaving Air DB", `${dbOut} ${uT}`],
			["Leaving Air WB", `${wbOut} ${uT}`],
			["Fresh Air Flowrate", `${flowRate} ${ip ? "CFM" : "m3/s"}`],
			[],
			["Results Summary"],
			["Sensible Load", `${calc.sensLoad.toFixed(2)} ${uL}`],
			["Latent Load", `${calc.latLoad.toFixed(2)} ${uL}`],
			["Total Fresh Air Load", `${calc.totLoad.toFixed(2)} ${uL}`],
			["Coil Capacity Sized", `${calc.capacityTons.toFixed(2)} TR`],
			["Entering Humidity Ratio (W)", `${calc.wIn.toFixed(5)} ${uW}`],
			["Leaving Humidity Ratio (W)", `${calc.wOut.toFixed(5)} ${uW}`]
		];
		const ws2 = utils.aoa_to_sheet(data);
		utils.book_append_sheet(wb2, ws2, "Fresh Air Sizing");
		const xlsxBuffer = writeSync(wb2, {
			bookType: "xlsx",
			type: "array"
		});
		downloadFile(new Uint8Array(xlsxBuffer), "Fresh_Air_Cooling_Load.xlsx", "Excel Document", ["xlsx"]);
	};
	const uT = ip ? "°F" : "°C";
	const uW = ip ? "gr/lb" : "kg/kg";
	const uL = ip ? "BTU/h" : "kW";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Fresh Air Cooling Load",
		hideSubHeader: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-full min-h-0 bg-transparent font-sans",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-1 select-none",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
							children: "HVAC > FRESH AIR COOLING LOAD"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
							children: "Fresh Air Cooling Load"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] text-muted-foreground mt-0.5",
							children: "Calculate sensible, latent, and total loads introduced by untreated outdoor makeup fresh air systems."
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "lg:col-span-5 flex flex-col gap-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-border/60 self-start select-none",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => handleUnitSystemChange("ip"),
									className: `px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
									children: "Imperial (IP)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => handleUnitSystemChange("si"),
									className: `px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
									children: "Metric (SI)"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 pb-2 border-b border-border/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-xs font-bold uppercase tracking-wider text-muted-foreground",
										children: "Entering Coil Air Properties"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-3.5 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground flex justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Dry Bulb Temperature" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold",
													children: uT
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: dbIn,
												onChange: (e) => {
													setDbIn(e.target.value === "" ? "" : Number(e.target.value));
													setHasCalculated(false);
												},
												placeholder: ip ? "95" : "35.0",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground flex justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Wet Bulb Temperature" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold",
													children: uT
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: wbIn,
												onChange: (e) => {
													setWbIn(e.target.value === "" ? "" : Number(e.target.value));
													setHasCalculated(false);
												},
												placeholder: ip ? "78" : "25.5",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[11.5px] text-muted-foreground font-semibold py-1",
											children: [
												"Calculated Entering Hum. Ratio:",
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "text-[#0A7BC7] font-mono",
													children: [
														calc.wIn.toFixed(ip ? 3 : 5),
														" ",
														uW
													]
												})
											]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 pb-2 border-b border-border/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-xs font-bold uppercase tracking-wider text-muted-foreground",
										children: "Leaving Coil Air Properties"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-3.5 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground flex justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Dry Bulb Temperature" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold",
													children: uT
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: dbOut,
												onChange: (e) => {
													setDbOut(e.target.value === "" ? "" : Number(e.target.value));
													setHasCalculated(false);
												},
												placeholder: ip ? "55" : "12.8",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground flex justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Wet Bulb Temperature" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold",
													children: uT
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: wbOut,
												onChange: (e) => {
													setWbOut(e.target.value === "" ? "" : Number(e.target.value));
													setHasCalculated(false);
												},
												placeholder: ip ? "54" : "12.2",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[11.5px] text-muted-foreground font-semibold py-1",
											children: [
												"Calculated Leaving Hum. Ratio:",
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "text-[#0A7BC7] font-mono",
													children: [
														calc.wOut.toFixed(ip ? 3 : 5),
														" ",
														uW
													]
												})
											]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 pb-2 border-b border-border/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-xs font-bold uppercase tracking-wider text-muted-foreground",
										children: "Airflow Rate"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1.5 text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "font-semibold text-foreground flex justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total Fresh Air Flow Rate" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold",
											children: ip ? "CFM" : "m3/s"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "any",
										value: flowRate,
										onChange: (e) => {
											setFlowRate(e.target.value === "" ? "" : Number(e.target.value));
											setHasCalculated(false);
										},
										placeholder: ip ? "1000" : "0.472",
										className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setHasCalculated(true),
								className: "w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs",
								children: "⚡ Calculate Cooling Load"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "lg:col-span-7 flex flex-col gap-5",
						children: !hasCalculated ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-xl mb-4 border border-border/40 select-none",
									children: "💨"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
									className: "text-xs font-bold text-foreground mb-1 uppercase tracking-wider",
									children: "Ready to Solve"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11.5px] text-muted-foreground max-w-xs leading-normal",
									children: "Enter the entering and leaving air conditions along with system airflow rate to compute cooling coil load divisions."
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-5 animate-fade-in",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TBtn, {
										onClick: handleExportExcel,
										className: "h-8.5 text-xs"
									})
								}),
								warnings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 rounded-xl p-3.5 flex flex-col gap-2 text-[11.5px] select-none",
									children: warnings.map((w, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-2.5 items-start",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5 text-red-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: w })]
									}, i))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 pb-2 border-b border-border/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground",
											children: "Results"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-x-6 gap-y-3 text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-primary",
													children: "Required Coil Sized Capacity"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-primary text-[15px] font-mono",
													children: [calc.capacityTons.toFixed(2), " TR"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Sensible Heat Load"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [
														calc.sensLoad.toFixed(0),
														" ",
														uL
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Latent Heat Load"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [
														calc.latLoad.toFixed(0),
														" ",
														uL
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Entering Moisture (W_in)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [
														calc.wIn.toFixed(ip ? 2 : 5),
														" ",
														uW
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Leaving Moisture (W_out)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [
														calc.wOut.toFixed(ip ? 2 : 5),
														" ",
														uW
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-bold text-muted-foreground",
													children: "Total Fresh Air Heat Load"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-[#0A7BC7] text-[14px] font-mono",
													children: [
														calc.totLoad.toFixed(0),
														" ",
														uL
													]
												})]
											})
										]
									})]
								}),
								(() => {
									const bars = [{
										label: "Sensible Load",
										value: calc.sensLoad,
										color: "#0A7BC7",
										display: calc.sensLoad.toLocaleString(void 0, { maximumFractionDigits: 2 }) + " " + uL
									}, {
										label: "Latent Load",
										value: calc.latLoad,
										color: "#7C3AED",
										display: calc.latLoad.toLocaleString(void 0, { maximumFractionDigits: 2 }) + " " + uL
									}];
									const maxVal = Math.max(...bars.map((b) => b.value)) * 1.2 || 1;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/40 p-4 border border-border rounded-2xl select-none",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "text-xs font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/50",
											children: "Cooling Load Breakdown"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
											viewBox: "0 0 500 120",
											className: "w-full h-auto block overflow-visible mt-2",
											children: [bars.map((b, i) => {
												const bw = 80 / bars.length;
												const bh = bw * .6;
												const y = 20 + i * bw + (bw - bh) / 2;
												const bWidth = b.value / maxVal * 370;
												return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
														x: 102,
														y: y + bh / 2 + 3.5,
														textAnchor: "end",
														fontSize: "9",
														fontWeight: "700",
														fill: "var(--text)",
														className: "font-sans",
														children: b.label
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
														x: 110,
														y,
														width: Math.max(2, bWidth),
														height: bh,
														fill: b.color,
														rx: "2"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
														x: 110 + bWidth + 6,
														y: y + bh / 2 + 3.5,
														textAnchor: "start",
														fontSize: "9",
														fontWeight: "800",
														fill: b.color,
														className: "font-mono",
														children: b.display
													})
												] }, i);
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
												x1: 110,
												y1: 20,
												x2: 110,
												y2: 100,
												stroke: "var(--border)",
												strokeWidth: "1"
											})]
										})]
									});
								})()
							]
						})
					})]
				})]
			})
		})
	});
}
//#endregion
export { FreshAirCoolingLoadPage as component };
