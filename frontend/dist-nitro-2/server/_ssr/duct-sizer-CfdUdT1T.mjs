import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Ut as TriangleAlert, nn as CircleQuestionMark } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/duct-sizer-CfdUdT1T.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function colebrook(Re, relR) {
	if (Re <= 0) return .1;
	if (Re < 2300) return 64 / Re;
	let f = .25 / Math.pow(Math.log(relR / 3.7 + 5.74 / Math.pow(Re, .9)) / Math.LN10, 2);
	for (let i = 0; i < 80; i++) {
		const r = -2 * Math.log(relR / 3.7 + 2.51 / (Re * Math.sqrt(f))) / Math.LN10;
		const fn = 1 / (r * r);
		if (Math.abs(fn - f) < 1e-10) {
			f = fn;
			break;
		}
		f = fn;
	}
	return f;
}
function DuctSizerPage() {
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("ip");
	const [airflow, setAirflow] = (0, import_react.useState)("");
	const [targetFr, setTargetFr] = (0, import_react.useState)("");
	const [ductShape, setDuctShape] = (0, import_react.useState)("round");
	const [aspectRatio, setAspectRatio] = (0, import_react.useState)(1.5);
	const [hasCalculated, setHasCalculated] = (0, import_react.useState)(false);
	const [showFormulaPanel, setShowFormulaPanel] = (0, import_react.useState)(false);
	const ip = unitSystem === "ip";
	const handleUnitSystemChange = (unit) => {
		if (unit === unitSystem) return;
		setUnitSystem(unit);
		if (window.__mep_keep_values) return;
		if (unit === "ip") {
			setAirflow(airflow !== "" ? Number((Number(airflow) * 2.1189).toFixed(0)) : "");
			setTargetFr(targetFr !== "" ? Number((Number(targetFr) / 8.16828).toFixed(3)) : "");
		} else {
			setAirflow(airflow !== "" ? Number((Number(airflow) / 2.1189).toFixed(0)) : "");
			setTargetFr(targetFr !== "" ? Number((Number(targetFr) * 8.16828).toFixed(2)) : "");
		}
	};
	const calculatedData = (0, import_react.useMemo)(() => {
		const airflowVal = airflow !== "" ? Number(airflow) : ip ? 2500 : 1180;
		const targetFrVal = targetFr !== "" ? Number(targetFr) : ip ? .08 : .65;
		const Q = ip ? airflowVal * 471947e-9 : airflowVal * .001;
		const frPaM = ip ? targetFrVal * 8.16828 : targetFrVal;
		const rho = 1.204, mu = 181e-7, eps = 9e-5;
		let lo = .05, hi = 2;
		for (let i = 0; i < 100; i++) {
			const D = (lo + hi) / 2;
			const v = Q / (Math.PI * D * D / 4);
			if (colebrook(rho * v * D / mu, eps / D) * rho * v * v / (2 * D) > frPaM) lo = D;
			else hi = D;
			if (hi - lo < 1e-4) break;
		}
		const calcD = (lo + hi) / 2;
		if (ductShape === "round") {
			const stdMmVal = [
				100,
				125,
				150,
				175,
				200,
				225,
				250,
				275,
				300,
				325,
				350,
				375,
				400,
				450,
				500,
				550,
				600,
				650,
				700,
				750,
				800,
				900,
				1e3,
				1100,
				1200
			].find((d) => d / 1e3 >= calcD) || 1200;
			const D = stdMmVal / 1e3;
			const v = Q / (Math.PI * D * D / 4);
			const Re = rho * v * D / mu;
			const f = colebrook(Re, eps / D);
			const dPM = f * rho * v * v / (2 * D);
			const vFpm = v / .00508;
			return {
				calcD,
				sizeDisplay: ip ? `${(stdMmVal / 25.4).toFixed(0)}"` : `${stdMmVal} mm`,
				rectDisplay: null,
				deqDisplay: null,
				velocity: v,
				velocityFpm: vFpm,
				frictionRate: dPM,
				reynolds: Re,
				f,
				regime: Re < 2300 ? "Laminar" : Re < 4e3 ? "Transitional" : "Turbulent"
			};
		} else {
			const AR = aspectRatio;
			const b = calcD * Math.pow(AR + 1, .25) / (1.3 * Math.pow(AR, .625));
			const a = AR * b;
			const aRound = ip ? Math.ceil(a / .0254) * .0254 : Math.ceil(a * 1e3 / 25) * .025;
			const bRound = ip ? Math.ceil(b / .0254) * .0254 : Math.ceil(b * 1e3 / 25) * .025;
			const DeqStd = 1.3 * Math.pow(aRound * bRound, .625) / Math.pow(aRound + bRound, .25);
			const v = Q / (aRound * bRound);
			const Re = rho * v * DeqStd / mu;
			const f = colebrook(Re, eps / DeqStd);
			const dPM = f * rho * v * v / (2 * DeqStd);
			const vFpm = v / .00508;
			const toMM = (val) => ip ? `${(val / .0254).toFixed(0)}"` : `${Math.round(val * 1e3)} mm`;
			const aStr = toMM(aRound);
			const bStr = toMM(bRound);
			return {
				calcD,
				sizeDisplay: `${aStr} × ${bStr}`,
				rectDisplay: `${aStr} (W) × ${bStr} (H) - Aspect ratio ${AR.toFixed(1)}:1`,
				deqDisplay: ip ? `${(DeqStd / .0254).toFixed(1)} in` : `${Math.round(DeqStd * 1e3)} mm`,
				velocity: v,
				velocityFpm: vFpm,
				frictionRate: dPM,
				reynolds: Re,
				f,
				regime: Re < 2300 ? "Laminar" : Re < 4e3 ? "Transitional" : "Turbulent"
			};
		}
	}, [
		airflow,
		targetFr,
		ductShape,
		aspectRatio,
		ip
	]);
	const warnings = (0, import_react.useMemo)(() => {
		const warns = [];
		if (calculatedData.velocityFpm > 2e3) warns.push(`${Math.round(calculatedData.velocityFpm)} FPM - High velocity for main duct. Review pressure class (SMACNA).`);
		else if (calculatedData.velocityFpm < 300) warns.push(`${Math.round(calculatedData.velocityFpm)} FPM - Low velocity. Settling risk in VAV systems.`);
		if (ductShape === "rect" && aspectRatio > 4) warns.push(`Aspect ratio ${aspectRatio.toFixed(1)}:1 - SMACNA recommends ≤ 4:1 to minimize material cost.`);
		return warns;
	}, [
		calculatedData,
		ductShape,
		aspectRatio
	]);
	const handleCalculate = () => {
		setHasCalculated(true);
	};
	const renderChart = () => {
		const vel = ip ? calculatedData.velocityFpm : calculatedData.velocity;
		const vMax = ip ? 2500 : 12.7;
		const u = ip ? "FPM" : "m/s";
		const bars = [{
			label: `Velocity`,
			value: vel,
			color: vel > vMax ? "#0A7BC7" : "#d17914",
			display: vel.toFixed(0) + " " + u
		}, {
			label: `Recommended Max`,
			value: vMax,
			color: "#64748B",
			display: vMax + " " + u
		}];
		const W = 500;
		const H = 120;
		const PL = 120;
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
				children: "Duct Velocity vs Recommended Limits"
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
		title: "Duct Sizer",
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
							children: "HVAC > DUCT SIZER"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
							children: "Duct Sizer + Friction Loss"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] text-muted-foreground mt-0.5",
							children: "Size round or rectangular ducts for a target friction rate using the Equal Friction Method (SMACNA)."
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
										children: "Sizing Parameters"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-3.5 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Airflow (Q) (",
													ip ? "CFM" : "L/s",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: airflow,
												onChange: (e) => {
													setAirflow(e.target.value === "" ? "" : Number(e.target.value));
													setHasCalculated(false);
												},
												placeholder: ip ? "2500" : "1180",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Target Friction Rate (",
													ip ? "in w.g./100ft" : "Pa/m",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: targetFr,
												onChange: (e) => {
													setTargetFr(e.target.value === "" ? "" : Number(e.target.value));
													setHasCalculated(false);
												},
												placeholder: ip ? "0.08" : "0.65",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Duct Shape"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 border border-border/60 select-none",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => {
														setDuctShape("round");
														setHasCalculated(false);
													},
													className: `flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ductShape === "round" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
													children: "Round"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => {
														setDuctShape("rect");
														setHasCalculated(false);
													},
													className: `flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ductShape === "rect" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
													children: "Rectangular"
												})]
											})]
										}),
										ductShape === "rect" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Aspect Ratio (W:H)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: aspectRatio,
												onChange: (e) => {
													setAspectRatio(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "1.0",
														children: "1:1 - Square"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "1.5",
														children: "1.5:1 - Low profile"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "2.0",
														children: "2:1 - Standard"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "3.0",
														children: "3:1 - Wide"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "4.0",
														children: "4:1 - Very wide"
													})
												]
											})]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: handleCalculate,
								className: "w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs",
								children: "⚡ Calculate Duct Size"
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
									children: "Ready to Size"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11.5px] text-muted-foreground max-w-xs leading-normal",
									children: "Enter the duct airflow and your target friction rate to calculate recommended sizing."
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
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "font-bold text-foreground mb-1",
										children: "Duct Sizing Equations"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-muted-foreground",
										children: "Solved iteratively using Darcy-Weisbach and Colebrook equations. Aspect ratio equivalents determined using Huebscher's formula."
									})]
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
											children: "Results"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: ductShape === "round" ? "Standard Diameter" : "Recommended Dimensions"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-[#0A7BC7] text-[15px] font-mono",
													children: calculatedData.sizeDisplay
												})]
											}),
											ductShape === "rect" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Full Dimension"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: calculatedData.rectDisplay
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Equivalent Diameter"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: calculatedData.deqDisplay
												})]
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Air Velocity"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: ip ? `${calculatedData.velocityFpm.toFixed(0)} FPM` : `${calculatedData.velocity.toFixed(2)} m/s`
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Actual Friction Loss"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: ip ? `${(calculatedData.frictionRate / 8.16828).toFixed(4)} in/100ft` : `${calculatedData.frictionRate.toFixed(3)} Pa/m`
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Reynolds Number"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: Math.round(calculatedData.reynolds).toLocaleString()
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Friction Factor (f)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: calculatedData.f.toFixed(5)
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Flow Regime"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: calculatedData.regime
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
export { DuctSizerPage as component };
