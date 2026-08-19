import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Ut as TriangleAlert } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-Blf5aT0O.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/heating-load-CvWKnMO5.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function HeatingLoadPage() {
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("ip");
	const [area, setArea] = (0, import_react.useState)("");
	const [height, setHeight] = (0, import_react.useState)("");
	const [uWall, setUWall] = (0, import_react.useState)("");
	const [uGlaz, setUGlaz] = (0, import_react.useState)("");
	const [glazArea, setGlazArea] = (0, import_react.useState)("");
	const [oat, setOat] = (0, import_react.useState)("");
	const [iat, setIat] = (0, import_react.useState)("");
	const [ach, setAch] = (0, import_react.useState)("");
	const [hasCalculated, setHasCalculated] = (0, import_react.useState)(false);
	const ip = unitSystem === "ip";
	const handleUnitSystemChange = (unit) => {
		if (unit === unitSystem) return;
		setUnitSystem(unit);
		if (window.__mep_keep_values) return;
		const convArea = (a) => unit === "ip" ? a * 10.764 : a / 10.764;
		const convHt = (h) => unit === "ip" ? h * 3.28084 : h / 3.28084;
		const convT = (t) => unit === "ip" ? t * 1.8 + 32 : (t - 32) / 1.8;
		const convU = (u) => unit === "ip" ? u / 5.678 : u * 5.678;
		setArea(area !== "" ? Number(convArea(Number(area)).toFixed(0)) : "");
		setHeight(height !== "" ? Number(convHt(Number(height)).toFixed(1)) : "");
		setUWall(uWall !== "" ? Number(convU(Number(uWall)).toFixed(3)) : "");
		setUGlaz(uGlaz !== "" ? Number(convU(Number(uGlaz)).toFixed(3)) : "");
		setGlazArea(glazArea !== "" ? Number(convArea(Number(glazArea)).toFixed(0)) : "");
		setOat(oat !== "" ? Number(convT(Number(oat)).toFixed(1)) : "");
		setIat(iat !== "" ? Number(convT(Number(iat)).toFixed(1)) : "");
	};
	const calculatedData = (0, import_react.useMemo)(() => {
		const areaVal = area !== "" ? Number(area) : ip ? 2e3 : 185;
		const htVal = height !== "" ? Number(height) : ip ? 10 : 3;
		const uWallVal = uWall !== "" ? Number(uWall) : ip ? .05 : .28;
		const uGlazVal = uGlaz !== "" ? Number(uGlaz) : ip ? .45 : 2.55;
		const glazAreaVal = glazArea !== "" ? Number(glazArea) : ip ? 150 : 14;
		const oatVal = oat !== "" ? Number(oat) : ip ? 32 : 0;
		const iatVal = iat !== "" ? Number(iat) : ip ? 70 : 21;
		const achVal = ach !== "" ? Number(ach) : .5;
		const areaFt2 = ip ? areaVal : areaVal * 10.764;
		const htFt = ip ? htVal : htVal * 3.281;
		const glazFt2 = ip ? glazAreaVal : glazAreaVal * 10.764;
		const oatF = ip ? oatVal : oatVal * 1.8 + 32;
		const dT = (ip ? iatVal : iatVal * 1.8 + 32) - oatF;
		const qCond = uWallVal * (Math.sqrt(areaFt2) * 4 * htFt - glazFt2 + areaFt2) * dT;
		const qGlaz = uGlazVal * glazFt2 * dT;
		const volFt3 = areaFt2 * htFt;
		const qInfil = .018 * achVal * volFt3 * dT;
		const qTotal = qCond + qGlaz + qInfil;
		return {
			dT,
			qCond,
			qGlaz,
			qInfil,
			qTotal,
			kwTotal: qTotal * .293071 / 1e3
		};
	}, [
		area,
		height,
		uWall,
		uGlaz,
		glazArea,
		oat,
		iat,
		ach,
		ip
	]);
	const warnings = (0, import_react.useMemo)(() => {
		const warns = [];
		if (calculatedData.dT < 0) warns.push("Outdoor temp is higher than indoor setpoint - use Cooling Load calculator instead.");
		if (calculatedData.dT > 80) warns.push(`Temperature difference ${calculatedData.dT.toFixed(0)}°F is very large. Verify outdoor design temperature.`);
		return warns;
	}, [calculatedData]);
	const handleCalculate = () => {
		setHasCalculated(true);
	};
	const renderChart = () => {
		const u = ip ? "k BTU/h" : "kW";
		const mult = ip ? .001 : 293071e-9;
		const bars = [
			{
				label: "Walls/Roof",
				value: calculatedData.qCond * mult,
				color: "#F59E0B",
				display: (calculatedData.qCond * mult).toFixed(1) + " " + u
			},
			{
				label: "Glazing",
				value: calculatedData.qGlaz * mult,
				color: "#0066CC",
				display: (calculatedData.qGlaz * mult).toFixed(1) + " " + u
			},
			{
				label: "Infiltration",
				value: calculatedData.qInfil * mult,
				color: "#7C3AED",
				display: (calculatedData.qInfil * mult).toFixed(1) + " " + u
			}
		];
		const W = 500;
		const H = 140;
		const PL = 110;
		const PR = 20;
		const PT = 20;
		const PB = 20;
		const CW = W - PL - PR;
		const CH = H - PT - PB;
		const maxVal = Math.max(...bars.map((b) => b.value)) * 1.2 || 1;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/40 p-4 border border-border rounded-2xl select-none mt-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
				className: "text-xs font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/50",
				children: "Heating Load Losses Breakdown"
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
		title: "Heating Load",
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
							children: "HVAC > HEATING LOAD"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
							children: "Winter Heating Load"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] text-muted-foreground mt-0.5",
							children: "Calculate building envelope winter heat losses and estimate heating element/boiler capacities."
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
										className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
										children: "Envelope parameters"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-3.5 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-2 gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "font-semibold text-foreground",
													children: [
														"Floor Area (",
														ip ? "ft²" : "m²",
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: area,
													onChange: (e) => {
														setArea(e.target.value === "" ? "" : Number(e.target.value));
														setHasCalculated(false);
													},
													placeholder: ip ? "2000" : "185",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "font-semibold text-foreground",
													children: [
														"Ceiling Height (",
														ip ? "ft" : "m",
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: height,
													onChange: (e) => {
														setHeight(e.target.value === "" ? "" : Number(e.target.value));
														setHasCalculated(false);
													},
													placeholder: ip ? "10" : "3.0",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-2 gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "font-semibold text-foreground",
													children: [
														"Wall U-Value (",
														ip ? "BTU/h·ft²·°F" : "W/m²K",
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: uWall,
													onChange: (e) => {
														setUWall(e.target.value === "" ? "" : Number(e.target.value));
														setHasCalculated(false);
													},
													placeholder: ip ? "0.05" : "0.28",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "font-semibold text-foreground",
													children: [
														"Glazing U-Value (",
														ip ? "BTU/h·ft²·°F" : "W/m²K",
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: uGlaz,
													onChange: (e) => {
														setUGlaz(e.target.value === "" ? "" : Number(e.target.value));
														setHasCalculated(false);
													},
													placeholder: ip ? "0.45" : "2.55",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-2 gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "font-semibold text-foreground",
													children: [
														"Glazing Area (",
														ip ? "ft²" : "m²",
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: glazArea,
													onChange: (e) => {
														setGlazArea(e.target.value === "" ? "" : Number(e.target.value));
														setHasCalculated(false);
													},
													placeholder: ip ? "150" : "14",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Infiltration Rate (ACH)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: ach,
													onChange: (e) => {
														setAch(e.target.value === "" ? "" : Number(e.target.value));
														setHasCalculated(false);
													},
													placeholder: "0.5",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-2 gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "font-semibold text-foreground",
													children: [
														"Outdoor Temp (",
														ip ? "°F" : "°C",
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: oat,
													onChange: (e) => {
														setOat(e.target.value === "" ? "" : Number(e.target.value));
														setHasCalculated(false);
													},
													placeholder: ip ? "32" : "0",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "font-semibold text-foreground",
													children: [
														"Indoor Temp (",
														ip ? "°F" : "°C",
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: iat,
													onChange: (e) => {
														setIat(e.target.value === "" ? "" : Number(e.target.value));
														setHasCalculated(false);
													},
													placeholder: ip ? "70" : "21",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											})]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: handleCalculate,
								className: "w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs",
								children: "⚡ Calculate Heating Load"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "lg:col-span-7 flex flex-col gap-5",
						children: !hasCalculated ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none",
									children: "🔥"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
									className: "text-xs font-bold text-foreground mb-1 uppercase tracking-wider",
									children: "Ready to Solve"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11.5px] text-muted-foreground max-w-xs leading-normal",
									children: "Enter the space geometries, boundary U-values, and winter temperatures to compute heat losses."
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-5 animate-fade-in",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none" }),
								warnings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 rounded-xl p-3.5 flex flex-col gap-2 text-[11.5px] select-none",
									children: warnings.map((w, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-2.5 items-start",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5 text-red-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: w })]
									}, idx))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 pb-2 border-b border-border/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
											children: "Results"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground text-primary",
													children: "Required Boiler / Heater capacity"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-primary text-[15px] font-mono",
													children: [
														calculatedData.kwTotal.toFixed(1),
														" kW (",
														Math.round(calculatedData.qTotal).toLocaleString(),
														" BTU/hr)"
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Walls/Roof Loss"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: ip ? `${calculatedData.qCond.toFixed(0)} BTU/hr` : `${(calculatedData.qCond * .293 / 1e3).toFixed(2)} kW`
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Glazing Loss"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: ip ? `${calculatedData.qGlaz.toFixed(0)} BTU/hr` : `${(calculatedData.qGlaz * .293 / 1e3).toFixed(2)} kW`
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Infiltration Air Loss"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: ip ? `${calculatedData.qInfil.toFixed(0)} BTU/hr` : `${(calculatedData.qInfil * .293 / 1e3).toFixed(2)} kW`
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Load Density Index"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: ip ? `${(calculatedData.qTotal / (Number(area) || 2e3)).toFixed(1)} BTU/hr/ft²` : `${(calculatedData.kwTotal / (Number(area) || 185) * 1e3).toFixed(1)} W/m²`
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
export { HeatingLoadPage as component };
