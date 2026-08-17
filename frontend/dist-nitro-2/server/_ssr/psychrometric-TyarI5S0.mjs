import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Ut as TriangleAlert, nn as CircleQuestionMark } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/psychrometric-TyarI5S0.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function satP(tK) {
	if (tK >= 273.15) return Math.exp(-5800.2206 / tK + 1.3914993 + -.04864 * tK + 41764768e-12 * Math.pow(tK, 2) + -1.4452093e-8 * Math.pow(tK, 3) + 6.5459673 * Math.log(tK));
	return Math.exp(-5674.5359 / tK + 6.3925247 + -.009677843 * tK + 6.2215701e-7 * Math.pow(tK, 2) + 2.0747825e-9 * Math.pow(tK, 3) + -9484024e-19 * Math.pow(tK, 4) + 4.1635019 * Math.log(tK));
}
function wFromRH(tC, rh, p) {
	const pws = satP(tC + 273.15);
	return .621945 * (rh / 100) * pws / (p - rh / 100 * pws);
}
function wFromWB(td, tw, p) {
	const ws = .621945 * satP(tw + 273.15) / (p - satP(tw + 273.15));
	return ((2501 - 2.381 * tw) * ws - 1.006 * (td - tw)) / (2501 + 1.805 * td - 4.186 * tw);
}
function wFromDP(dp, p) {
	const pws = satP(dp + 273.15);
	return .621945 * pws / (p - pws);
}
function dewPt(w, p) {
	const pw = w * p / (.621945 + w);
	let lo = -60, hi = 80;
	for (let i = 0; i < 100; i++) {
		const m = (lo + hi) / 2;
		if (satP(m + 273.15) < pw) lo = m;
		else hi = m;
		if (hi - lo < .001) break;
	}
	return (lo + hi) / 2;
}
function wetBulb(td, w, p) {
	let lo = -60, hi = td;
	for (let i = 0; i < 100; i++) {
		const m = (lo + hi) / 2;
		if (wFromWB(td, m, p) < w) lo = m;
		else hi = m;
		if (hi - lo < .001) break;
	}
	return (lo + hi) / 2;
}
function fToC(f) {
	return (f - 32) * 5 / 9;
}
function cToF(c) {
	return c * 9 / 5 + 32;
}
function PsychrometricPage() {
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("ip");
	const [dbtInput, setDbtInput] = (0, import_react.useState)("");
	const [secondParam, setSecondParam] = (0, import_react.useState)("rh");
	const [paramValue, setParamValue] = (0, import_react.useState)("");
	const [atmPressure, setAtmPressure] = (0, import_react.useState)("");
	const [hasCalculated, setHasCalculated] = (0, import_react.useState)(false);
	const [showFormulaPanel, setShowFormulaPanel] = (0, import_react.useState)(false);
	const ip = unitSystem === "ip";
	const handleUnitSystemChange = (unit) => {
		if (unit === unitSystem) return;
		setUnitSystem(unit);
		if (window.__mep_keep_values) return;
		if (unit === "ip") {
			setDbtInput(dbtInput !== "" ? Number((Number(dbtInput) * 1.8 + 32).toFixed(1)) : "");
			if (secondParam === "wb" || secondParam === "dp") setParamValue(paramValue !== "" ? Number((Number(paramValue) * 1.8 + 32).toFixed(1)) : "");
			else if (secondParam === "w") setParamValue(paramValue !== "" ? Number((Number(paramValue) * 7).toFixed(2)) : "");
		} else {
			setDbtInput(dbtInput !== "" ? Number(((Number(dbtInput) - 32) / 1.8).toFixed(1)) : "");
			if (secondParam === "wb" || secondParam === "dp") setParamValue(paramValue !== "" ? Number(((Number(paramValue) - 32) / 1.8).toFixed(1)) : "");
			else if (secondParam === "w") setParamValue(paramValue !== "" ? Number((Number(paramValue) / 7).toFixed(5)) : "");
		}
	};
	const calculatedData = (0, import_react.useMemo)(() => {
		const pAtm = (atmPressure !== "" ? Number(atmPressure) : 101.325) * 1e3;
		const dbtVal = dbtInput !== "" ? Number(dbtInput) : ip ? 95 : 35;
		const tC = ip ? fToC(dbtVal) : dbtVal;
		let w = 0;
		const pv = paramValue !== "" ? Number(paramValue) : secondParam === "rh" ? 60 : secondParam === "wb" || secondParam === "dp" ? ip ? 78 : 25.5 : ip ? 100 : 15;
		if (secondParam === "rh") w = wFromRH(tC, pv, pAtm);
		else if (secondParam === "wb") w = wFromWB(tC, ip ? fToC(pv) : pv, pAtm);
		else if (secondParam === "dp") w = wFromDP(ip ? fToC(pv) : pv, pAtm);
		else w = ip ? pv / 7e3 : pv / 1e3;
		if (w < 0) w = 0;
		const pws = satP(tC + 273.15);
		const pw = w * pAtm / (.621945 + w);
		const rh = Math.min(100, pw / pws * 100);
		const dp = dewPt(w, pAtm);
		const wb = wetBulb(tC, w, pAtm);
		const h = 1.006 * tC + w * (2501 + 1.805 * tC);
		const v = .287042 * (tC + 273.15) * (1 + 1.607858 * w) / (pAtm / 1e3);
		return {
			dbt: tC,
			wbt: wb,
			dp,
			rh,
			w,
			h,
			v,
			pw
		};
	}, [
		dbtInput,
		secondParam,
		paramValue,
		atmPressure,
		ip
	]);
	const warnings = (0, import_react.useMemo)(() => {
		const warns = [];
		if (calculatedData.rh > 90) warns.push(`RH ${calculatedData.rh.toFixed(1)}% - Near saturation. Condensation risk on cold surfaces.`);
		if (calculatedData.rh < 20) warns.push(`RH ${calculatedData.rh.toFixed(1)}% - Very dry air. Check comfort and static electricity concerns.`);
		if (calculatedData.dbt > 40) warns.push(`DBT ${calculatedData.dbt.toFixed(1)}°C - High temperature. Verify application.`);
		return warns;
	}, [calculatedData]);
	const handleCalculate = () => {
		setHasCalculated(true);
	};
	const renderChart = () => {
		const valDbt = ip ? cToF(calculatedData.dbt) : calculatedData.dbt + 273.15;
		const valDp = ip ? cToF(calculatedData.dp) : calculatedData.dp + 273.15;
		const valH = calculatedData.h;
		const uTemp = ip ? "°F" : "K";
		const uH = ip ? "BTU/lb" : "kJ/kg";
		const bars = [
			{
				label: `Dry Bulb (${uTemp})`,
				value: valDbt,
				color: "#0A7BC7",
				display: valDbt.toFixed(1) + " " + uTemp
			},
			{
				label: `Dew Point (${uTemp})`,
				value: valDp,
				color: "#06456F",
				display: valDp.toFixed(1) + " " + uTemp
			},
			{
				label: `Enthalpy (${uH})`,
				value: valH,
				color: "#7C3AED",
				display: valH.toFixed(1) + " " + uH
			}
		];
		const W = 500;
		const H = 160;
		const PL = 60;
		const PR = 20;
		const PT = 20;
		const PB = 40;
		const CW = W - PL - PR;
		const CH = H - PT - PB;
		const maxVal = Math.max(...bars.map((b) => b.value)) * 1.2 || 1;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/40 p-4 border border-border rounded-2xl select-none",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
				className: "text-xs font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/50",
				children: "Moist Air Properties Breakdown"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
				viewBox: `0 0 ${W} ${H}`,
				className: "w-full h-auto block overflow-visible mt-2",
				children: [bars.map((b, i) => {
					const bw = CH / bars.length;
					const barH = bw * .6;
					const y = PT + i * bw + (bw - barH) / 2;
					const barW = b.value / maxVal * CW;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
							x: PL - 8,
							y: y + barH / 2 + 3.5,
							textAnchor: "end",
							fontSize: "9",
							fontWeight: "700",
							fill: "var(--text)",
							className: "font-sans",
							children: b.label
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
							x: PL,
							y,
							width: Math.max(2, barW),
							height: barH,
							fill: b.color,
							rx: "2"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
							x: PL + barW + 6,
							y: y + barH / 2 + 3.5,
							textAnchor: "start",
							fontSize: "9",
							fontWeight: "800",
							fill: b.color,
							className: "font-mono",
							children: b.display
						})
					] }, i);
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
					x1: PL,
					y1: PT,
					x2: PL,
					y2: H - PB,
					stroke: "var(--border)",
					strokeWidth: "1"
				})]
			})]
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Psychrometric Calculator",
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
							children: "HVAC > PSYCHROMETRIC"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
							children: "Psychrometric Calculator"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] text-muted-foreground mt-0.5",
							children: "Calculate complete psychrometric state of moist air from two known properties based on Hyland-Wexler equations."
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
								className: "bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5 flex flex-col gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 pb-2 border-b border-border/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-xs font-bold uppercase tracking-wider text-muted-foreground",
										children: "Input Conditions"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-3.5 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Dry Bulb Temperature (",
													ip ? "°F" : "°C",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: dbtInput,
												onChange: (e) => {
													setDbtInput(e.target.value === "" ? "" : Number(e.target.value));
													setHasCalculated(false);
												},
												placeholder: ip ? "95" : "35.0",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Known Second Parameter"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "grid grid-cols-2 gap-2 select-none",
												children: [
													"rh",
													"wb",
													"dp",
													"w"
												].map((param) => {
													return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
														type: "button",
														onClick: () => {
															setSecondParam(param);
															setHasCalculated(false);
														},
														className: `py-1.5 px-3 rounded-lg border text-center font-semibold transition-all ${secondParam === param ? "bg-primary/10 border-primary text-primary font-bold shadow-xs" : "bg-slate-100/30 border-border/70 hover:bg-slate-100/60 text-muted-foreground"}`,
														children: {
															rh: "Rel. Humidity",
															wb: "Wet Bulb",
															dp: "Dew Point",
															w: "Hum. Ratio"
														}[param]
													}, param);
												})
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: secondParam === "rh" ? "Relative Humidity (%)" : secondParam === "wb" ? `Wet Bulb Temperature (${ip ? "°F" : "°C"})` : secondParam === "dp" ? `Dew Point Temperature (${ip ? "°F" : "°C"})` : `Humidity Ratio (${ip ? "gr/lb" : "g/kg"})`
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: paramValue,
												onChange: (e) => {
													setParamValue(e.target.value === "" ? "" : Number(e.target.value));
													setHasCalculated(false);
												},
												placeholder: secondParam === "rh" ? "60" : secondParam === "wb" || secondParam === "dp" ? ip ? "78" : "25.5" : ip ? "100" : "15",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Atmospheric Pressure (kPa)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: atmPressure,
												onChange: (e) => {
													setAtmPressure(e.target.value === "" ? "" : Number(e.target.value));
													setHasCalculated(false);
												},
												placeholder: "101.325",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: handleCalculate,
								className: "w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs",
								children: "⚡ Calculate Psychrometric State"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "lg:col-span-7 flex flex-col gap-5",
						children: !hasCalculated ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none",
									children: "📏"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
									className: "text-xs font-bold text-foreground mb-1 uppercase tracking-wider",
									children: "Ready to Solve"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11.5px] text-muted-foreground max-w-xs leading-normal",
									children: "Enter the known Dry Bulb Temperature and select a second moist air property to solve the full psychrometric state."
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-5 animate-fade-in",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										onClick: () => setShowFormulaPanel(!showFormulaPanel),
										className: "h-8.5 text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "size-3.5" }), " Formula Reference"]
									})
								}),
								showFormulaPanel && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-white dark:bg-slate-900 border border-border rounded-2xl p-5 shadow-xs text-xs flex flex-col gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "font-bold text-foreground mb-1",
											children: "Psychrometric Saturation Equations Reference"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-muted-foreground",
											children: "Calculations utilize standard Hyland-Wexler equations to determine saturation pressure and humidity ratios."
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
											className: "bg-slate-100 dark:bg-slate-800 p-2 rounded block font-mono text-[10.5px] text-primary",
											children: "W = 0.621945 × Pw / (P_atm - Pw)"
										})
									]
								}),
								warnings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "bg-sky-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl p-3.5 flex flex-col gap-2 text-[11.5px]",
									children: warnings.map((w, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-2.5 items-start",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5 text-amber-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: w })]
									}, idx))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 pb-2 border-b border-border/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground",
											children: "Solved Air State"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Dry Bulb Temp"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: ip ? `${cToF(calculatedData.dbt).toFixed(1)} °F` : `${calculatedData.dbt.toFixed(1)} °C`
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Wet Bulb Temp"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: ip ? `${cToF(calculatedData.wbt).toFixed(1)} °F` : `${calculatedData.wbt.toFixed(1)} °C`
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Dew Point Temp"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: ip ? `${cToF(calculatedData.dp).toFixed(1)} °F` : `${calculatedData.dp.toFixed(1)} °C`
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Relative Humidity"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [calculatedData.rh.toFixed(1), " %"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Humidity Ratio (W)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: ip ? `${(calculatedData.w * 7e3).toFixed(2)} gr/lb` : `${(calculatedData.w * 1e3).toFixed(2)} g/kg`
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Specific Enthalpy (h)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-[#0A7BC7] font-mono",
													children: ip ? `${(calculatedData.h / 2.326).toFixed(2)} BTU/lb` : `${calculatedData.h.toFixed(2)} kJ/kg`
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Specific Volume (v)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: ip ? `${(calculatedData.v * .062428).toFixed(4)} ft³/lb` : `${calculatedData.v.toFixed(4)} m³/kg`
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Vapor Pressure"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: ip ? `${(calculatedData.pw / 6894.76).toFixed(4)} psi` : `${(calculatedData.pw / 1e3).toFixed(3)} kPa`
												})]
											})
										]
									})]
								}),
								renderChart()
							]
						})
					})]
				})]
			})
		})
	});
}
//#endregion
export { PsychrometricPage as component };
