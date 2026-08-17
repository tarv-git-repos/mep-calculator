import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Wt as TriangleAlert, an as CircleCheck } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-urg-0zDa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sanity-check-tool-DF5LqtUq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SanityCheckToolPage() {
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("ip");
	const [ductVel, setDuctVel] = (0, import_react.useState)(1500);
	const [ductFr, setDuctFr] = (0, import_react.useState)(.08);
	const [esp, setEsp] = (0, import_react.useState)(.5);
	const [pipeVel, setPipeVel] = (0, import_react.useState)(4);
	const [pumpHead, setPumpHead] = (0, import_react.useState)(50);
	const [cfmTr, setCfmTr] = (0, import_react.useState)(400);
	const [supTemp, setSupTemp] = (0, import_react.useState)(55);
	const [chwDt, setChwDt] = (0, import_react.useState)(10);
	const [chillerEff, setChillerEff] = (0, import_react.useState)(.65);
	const [hasCalculated, setHasCalculated] = (0, import_react.useState)(false);
	const ip = unitSystem === "ip";
	const handleUnitSystemChange = (unit) => {
		if (unit === unitSystem) return;
		setUnitSystem(unit);
		if (window.__mep_keep_values) return;
		if (unit === "ip") {
			setDuctVel(Number((ductVel * 196.85).toFixed(0)));
			setDuctFr(Number((ductFr / 8.16828).toFixed(3)));
			setEsp(Number((esp / 248.84).toFixed(2)));
			setPipeVel(Number((pipeVel * 3.28084).toFixed(1)));
			setPumpHead(Number((pumpHead * .33455).toFixed(1)));
			setCfmTr(Number((cfmTr * 8.48).toFixed(0)));
			setSupTemp(Number((supTemp * 1.8 + 32).toFixed(1)));
			setChwDt(Number((chwDt * 1.8).toFixed(1)));
			setChillerEff(Number((3.51685 / chillerEff).toFixed(2)));
		} else {
			setDuctVel(Number((ductVel / 196.85).toFixed(2)));
			setDuctFr(Number((ductFr * 8.16828).toFixed(2)));
			setEsp(Number((esp * 248.84).toFixed(0)));
			setPipeVel(Number((pipeVel / 3.28084).toFixed(2)));
			setPumpHead(Number((pumpHead / .33455).toFixed(0)));
			setCfmTr(Number((cfmTr / 8.48).toFixed(1)));
			setSupTemp(Number(((supTemp - 32) / 1.8).toFixed(1)));
			setChwDt(Number((chwDt / 1.8).toFixed(1)));
			setChillerEff(Number((3.51685 / chillerEff).toFixed(2)));
		}
	};
	const checks = (0, import_react.useMemo)(() => {
		const list = [];
		const test = (label, val, unit, lo, hi, desc) => {
			const pass = val >= lo && val <= hi;
			list.push({
				label,
				value: `${val.toFixed(val < 10 ? 3 : 1)} ${unit}`,
				status: pass ? "pass" : "warn",
				range: `${lo} – ${hi} ${unit}`,
				desc
			});
		};
		if (ip) {
			test("Duct Velocity", ductVel, "FPM", 1e3, 2500, "Main duct velocity range to balance noise and friction.");
			test("Airflow per TR", cfmTr, "CFM/TR", 350, 450, "Comfort cooling sensible heat ratio airflow index.");
			test("Duct Friction Rate", ductFr, "in w.g./100ft", .05, .15, "Standard friction design rate for equal friction method.");
			test("Duct External Static", esp, "in w.g.", .2, 2, "Typical external static pressure for fans.");
			test("Water Pipe Velocity", pipeVel, "fps", 2, 8, "Pipe fluid velocity limits to prevent erosion and sedimentation.");
			test("Pump Total Head", pumpHead, "ft w.g.", 20, 100, "Typical chilled water circuit head requirement.");
			test("Supply Air Temp", supTemp, "°F", 50, 60, "Cooling coil supply dew point range for space relative humidity control.");
			test("CHW Temp Delta T", chwDt, "°F", 8, 14, "Chilled water temperature rise across coil.");
			test("Chiller Efficiency", chillerEff, "kW/TR", .5, .8, "Centrifugal / water-cooled chiller full-load index.");
		} else {
			test("Duct Velocity", ductVel, "m/s", 5, 12.7, "Main duct velocity range to balance noise and friction.");
			test("Airflow per TR", cfmTr, "L/s/kW", 47, 60, "Comfort cooling sensible heat ratio airflow index.");
			test("Duct Friction Rate", ductFr, "Pa/m", .4, 1.2, "Standard friction design rate for equal friction method.");
			test("Duct External Static", esp, "Pa", 50, 500, "Typical external static pressure for fans.");
			test("Water Pipe Velocity", pipeVel, "m/s", .6, 2.4, "Pipe fluid velocity limits to prevent erosion and sedimentation.");
			test("Pump Total Head", pumpHead, "kPa", 60, 300, "Typical chilled water circuit head requirement.");
			test("Supply Air Temp", supTemp, "°C", 10, 15, "Cooling coil supply dew point range for space relative humidity control.");
			test("CHW Temp Delta T", chwDt, "°C", 4.4, 7.7, "Chilled water temperature rise across coil.");
			test("Chiller COP", chillerEff, "COP", 4.4, 7, "Centrifugal / water-cooled chiller full-load coefficient of performance.");
		}
		return list;
	}, [
		ductVel,
		ductFr,
		esp,
		pipeVel,
		pumpHead,
		cfmTr,
		supTemp,
		chwDt,
		chillerEff,
		ip
	]);
	const handleCalculate = () => {
		setHasCalculated(true);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Sanity Check Tool",
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
							children: "HV\\u00b0C > SANITY CHECK"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
							children: "Engineering Sanity Check Tool"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] text-muted-foreground mt-0.5",
							children: "Verify your design numbers against standard ASHRAE, SM\\u00b0CNA, and Carrier parameters."
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
										children: "Design Values"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-3.5 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Duct Velocity (",
													ip ? "FPM" : "m/s",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: ductVel,
												onChange: (e) => {
													setDuctVel(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Duct Friction (",
													ip ? "in w.g./100ft" : "Pa/m",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: ductFr,
												onChange: (e) => {
													setDuctFr(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"External Static Pressure (",
													ip ? "in w.g." : "Pa",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: esp,
												onChange: (e) => {
													setEsp(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Pipe Velocity (",
													ip ? "fps" : "m/s",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: pipeVel,
												onChange: (e) => {
													setPipeVel(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Pump Total Head (",
													ip ? "ft w.g." : "kPa",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: pumpHead,
												onChange: (e) => {
													setPumpHead(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Airflow per Ton (",
													ip ? "CFM/TR" : "L/s/kW",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: cfmTr,
												onChange: (e) => {
													setCfmTr(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Supply Air Temp (",
													ip ? "°F" : "°C",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: supTemp,
												onChange: (e) => {
													setSupTemp(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"CHW Delta T (",
													ip ? "°F" : "°C",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: chwDt,
												onChange: (e) => {
													setChwDt(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Chiller Efficiency (",
													ip ? "kW/TR" : "COP",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: chillerEff,
												onChange: (e) => {
													setChillerEff(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
											})]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: handleCalculate,
								className: "w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs",
								children: "⚡ Run Sanity Check"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "lg:col-span-7 flex flex-col gap-5",
						children: !hasCalculated ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none",
									children: "📐"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
									className: "text-xs font-bold text-foreground mb-1 uppercase tracking-wider",
									children: "Ready to Check"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11.5px] text-muted-foreground max-w-xs leading-normal",
									children: "Enter your calculated project parameters and run sanity checks to verify they comply with engineering guidelines."
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-5 animate-fade-in",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 pb-2 border-b border-border/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
										children: "Engineering Audit Summary"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-col gap-3 font-sans text-xs",
									children: checks.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1 py-2.5 border-b border-border/40 last:border-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-semibold text-foreground",
												children: c.label
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2 font-mono",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground font-bold",
													children: c.value
												}), c.status === "pass" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4 text-emerald-500" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 text-amber-500 animate-pulse" })]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between text-[10.5px] text-muted-foreground mt-0.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: c.desc }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-bold",
												children: ["Std: ", c.range]
											})]
										})]
									}, i))
								})]
							})]
						})
					})]
				})]
			})
		})
	});
}
//#endregion
export { SanityCheckToolPage as component };
