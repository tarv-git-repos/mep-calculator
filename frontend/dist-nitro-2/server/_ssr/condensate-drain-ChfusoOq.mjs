import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Dt as ChevronUp, kt as ChevronDown, rn as CircleQuestionMark } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-urg-0zDa.mjs";
import { c as kwToTr, f as mToFt, o as ftToM, p as trToKw, s as kwToBtu, t as btuToKw } from "./conversions-kXRQ6bCu.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/condensate-drain-ChfusoOq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CondensateDrainPage() {
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("ip");
	const [condMode, setCondMode] = (0, import_react.useState)("tr");
	const [trLoad, setTrLoad] = (0, import_react.useState)(10);
	const [latentLoad, setLatentLoad] = (0, import_react.useState)(12e3);
	const [unitsQty, setUnitsQty] = (0, import_react.useState)(1);
	const [drainLength, setDrainLength] = (0, import_react.useState)(10);
	const [hasCalculated, setHasCalculated] = (0, import_react.useState)(false);
	const [showDetailedCalcs, setShowDetailedCalcs] = (0, import_react.useState)(false);
	const ip = unitSystem === "ip";
	const handleUnitSystemChange = (unit) => {
		if (unit === unitSystem) return;
		setUnitSystem(unit);
		if (window.__mep_keep_values) return;
		if (unit === "ip") {
			setTrLoad(Number(kwToTr(trLoad).toFixed(1)));
			setLatentLoad(Number(kwToBtu(latentLoad).toFixed(0)));
			setDrainLength(Number(mToFt(drainLength).toFixed(1)));
		} else {
			setTrLoad(Number(trToKw(trLoad).toFixed(1)));
			setLatentLoad(Number(btuToKw(latentLoad).toFixed(1)));
			setDrainLength(Number(ftToM(drainLength).toFixed(1)));
		}
	};
	const calculatedData = (0, import_react.useMemo)(() => {
		let trVal = condMode === "tr" ? ip ? trLoad : kwToTr(trLoad) : 0;
		let latBTU = 0;
		if (condMode === "tr") latBTU = trVal * 12e3 * .3;
		else latBTU = ip ? latentLoad : kwToBtu(latentLoad);
		const galPerHrSingle = latBTU / (1075 * 8.34);
		const galPerHr = galPerHrSingle * unitsQty;
		const lPerMin = galPerHr * .063;
		let pipeSize = "";
		let minSlope = "";
		let totalDrop = "";
		if (galPerHr < 5) {
			pipeSize = "3/4\" (19mm)";
			minSlope = ip ? "1/4\" per ft (2.0%)" : "2.0% (1:50)";
			const d = .25 * drainLength;
			totalDrop = ip ? `${d.toFixed(2)} in` : `${(drainLength * .02 * 1e3).toFixed(0)} mm`;
		} else if (galPerHr < 20) {
			pipeSize = "1\" (25mm)";
			minSlope = ip ? "1/4\" per ft (2.0%)" : "2.0% (1:50)";
			const d = .25 * drainLength;
			totalDrop = ip ? `${d.toFixed(2)} in` : `${(drainLength * .02 * 1e3).toFixed(0)} mm`;
		} else {
			pipeSize = "1-1/4\" (32mm)";
			minSlope = ip ? "1/8\" per ft (1.0%)" : "1.0% (1:100)";
			const d = .125 * drainLength;
			totalDrop = ip ? `${d.toFixed(2)} in` : `${(drainLength * .01 * 1e3).toFixed(0)} mm`;
		}
		return {
			trVal,
			latBTU,
			galPerHrSingle,
			galPerHr,
			lPerMin,
			flowRateDisplay: ip ? `${galPerHr.toFixed(2)} gal/hr` : `${lPerMin.toFixed(3)} L/min`,
			pipeSize,
			minSlope,
			totalDrop
		};
	}, [
		condMode,
		trLoad,
		latentLoad,
		unitsQty,
		drainLength,
		ip
	]);
	const handleCalculate = () => {
		setHasCalculated(true);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Condensate Drain Sizing",
		hideSubHeader: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-full min-h-0 bg-transparent font-sans",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1 select-none",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
								children: "HVAC > CONDENSATE DRAIN"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
								children: "Condensate Drain Pipe Sizer"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground mt-0.5",
								children: "Calculate condensate load and recommended drain pipe sizes with minimum slopes."
							})
						]
					}),
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
						className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "lg:col-span-5 flex flex-col gap-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 pb-2 border-b border-border/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
										children: "Inputs"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-3.5 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Sizing Method"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 border border-border/60 select-none",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => {
														setCondMode("tr");
														setHasCalculated(false);
													},
													className: `flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${condMode === "tr" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
													children: "From Cooling capacity"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => {
														setCondMode("lat");
														setHasCalculated(false);
													},
													className: `flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${condMode === "lat" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
													children: "From Latent load"
												})]
											})]
										}),
										condMode === "tr" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Cooling Capacity (",
													ip ? "TR" : "kW",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: trLoad,
												onChange: (e) => {
													setTrLoad(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]"
											})]
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Latent Load (",
													ip ? "BTU/hr" : "kW",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: latentLoad,
												onChange: (e) => {
													setLatentLoad(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Number of AC/FCU Units"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: "1",
												step: "1",
												value: unitsQty,
												onChange: (e) => {
													setUnitsQty(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Drain Length (",
													ip ? "ft" : "m",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: drainLength,
												onChange: (e) => {
													setDrainLength(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]"
											})]
										})
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: handleCalculate,
								className: "w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs",
								children: "⚡ Size Condensate Drain"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "lg:col-span-7 flex flex-col gap-5",
							children: !hasCalculated ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none",
										children: "💧"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "text-xs font-bold text-foreground mb-1 uppercase tracking-wider",
										children: "Ready to Size"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[11.5px] text-muted-foreground max-w-xs leading-normal",
										children: "Enter the cooling parameters and drain run configuration to see pipe recommendations."
									})
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-5 animate-fade-in",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 pb-2 border-b border-border/60",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
												children: "Sizing Results"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-center py-1.5 border-b border-border/40",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-muted-foreground",
														children: "Condensate Flow Rate"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
														className: "font-bold text-foreground font-mono",
														children: calculatedData.flowRateDisplay
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-center py-1.5 border-b border-border/40",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-muted-foreground",
														children: "Recommended Pipe Size"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
														className: "font-bold text-[#0A7BC7] text-[14px] font-mono",
														children: calculatedData.pipeSize
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-center py-1.5 border-b border-border/40",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-muted-foreground",
														children: "Minimum Slope"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
														className: "font-bold text-foreground font-mono",
														children: calculatedData.minSlope
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-center py-1.5 border-b border-border/40",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-muted-foreground",
														children: "Total Drop Over Run"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
														className: "font-bold text-foreground font-mono",
														children: calculatedData.totalDrop
													})]
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-card border border-border rounded-2xl shadow-xs overflow-hidden",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => setShowDetailedCalcs(!showDetailedCalcs),
											className: "w-full flex items-center justify-between p-5 font-bold text-xs uppercase tracking-wider text-muted-foreground font-sans hover:bg-slate-50 dark:hover:bg-slate-900/40 select-none cursor-pointer",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "size-4 text-primary" }), " Detailed Sizing Steps"]
											}), showDetailedCalcs ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4" })]
										}), showDetailedCalcs && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "p-5 pt-0 border-t border-border/40 text-xs font-sans flex flex-col gap-4 max-h-[400px] overflow-y-auto",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex gap-3 items-start border-b border-border/40 pb-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
														children: "1"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "font-bold text-foreground",
															children: "Step 1: Latent Sizing Cooling Load"
														}), condMode === "tr" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "font-mono text-primary my-1",
															children: "Q_latent = TR_load \\u00d7 12,000 \\u00d7 0.30 (Latent ratio)"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "font-mono text-[10.5px] text-muted-foreground",
															children: [
																"Q_latent = ",
																calculatedData.trVal.toFixed(2),
																" TR \\u00d7 12,000 \\u00d7 0.3 = ",
																Math.round(calculatedData.latBTU).toLocaleString(),
																" BTU/hr"
															]
														})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "font-mono text-primary my-1",
															children: "Q_latent = Entered Latent Load (converted to BTU/hr if SI)"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "font-mono text-[10.5px] text-muted-foreground",
															children: [
																"Q_latent = ",
																Math.round(calculatedData.latBTU).toLocaleString(),
																" BTU/hr"
															]
														})] })]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex gap-3 items-start border-b border-border/40 pb-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
														children: "2"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex-1",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "font-bold text-foreground",
																children: "Step 2: Condensate Flow per FCU/AC unit"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "font-mono text-primary my-1",
																children: "q_single = Q_latent / (Latent Heat of Vaporization \\u00d7 Water Density)"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "font-mono text-[10.5px] text-muted-foreground",
																children: "q_single = Q_latent / (1,075 BTU/lb \\u00d7 8.34 lb/gal)"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "font-mono text-[10.5px] text-muted-foreground",
																children: [
																	"q_single = ",
																	Math.round(calculatedData.latBTU).toLocaleString(),
																	" / 8,965.5 = ",
																	calculatedData.galPerHrSingle.toFixed(2),
																	" gal/hr"
																]
															})
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex gap-3 items-start border-b border-border/40 pb-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
														children: "3"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex-1",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "font-bold text-foreground",
																children: "Step 3: Total Condensate Flow Rate"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "font-mono text-primary my-1",
																children: "q_total = q_single \\u00d7 Qty_Units"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "font-mono text-[10.5px] text-muted-foreground",
																children: [
																	"q_total = ",
																	calculatedData.galPerHrSingle.toFixed(2),
																	" GPH \\u00d7 ",
																	unitsQty,
																	" = ",
																	calculatedData.galPerHr.toFixed(2),
																	" gal/hr"
																]
															}),
															!ip && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "font-mono text-[10.5px] text-muted-foreground mt-1",
																children: [
																	"Convert to L/min: ",
																	calculatedData.galPerHr.toFixed(2),
																	" \\u00d7 0.063 = ",
																	calculatedData.lPerMin.toFixed(3),
																	" L/min"
																]
															})
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex gap-3 items-start border-b border-border/40 pb-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
														children: "4"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex-1",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "font-bold text-foreground",
																children: "Step 4: Recommended Pipe Size Selection"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "font-mono text-primary my-1",
																children: "Lookup criteria based on Flow rate (GPH):"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
																className: "list-disc pl-4 font-mono text-[10px] text-muted-foreground space-y-0.5",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Flow < 5 GPH: Sized at 3/4\" (19mm)" }),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Flow 5 to 20 GPH: Sized at 1\" (25mm)" }),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Flow > 20 GPH: Sized at 1-1/4\" (32mm)" })
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "font-bold text-[11px] text-foreground mt-1",
																children: ["Sized recommended size: ", calculatedData.pipeSize]
															})
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex gap-3 items-start",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
														children: "5"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex-1",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "font-bold text-foreground",
																children: "Step 5: Minimum Slope & Total Drop Drop"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "font-mono text-primary my-1",
																children: "Drop = Run_Length \\u00d7 Min_Slope"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "font-mono text-[10.5px] text-muted-foreground",
																children: ip ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
																	"Drop = ",
																	drainLength,
																	" ft \\u00d7 Min_Slope = ",
																	calculatedData.totalDrop
																] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
																	"Drop = ",
																	drainLength,
																	" m \\u00d7 Min_Slope = ",
																	calculatedData.totalDrop
																] })
															})
														]
													})]
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl p-4 text-xs text-muted-foreground leading-relaxed",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-semibold text-foreground mb-1",
											children: "Standard Sizing Basis:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
											className: "list-disc pl-4 space-y-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Calculated assuming 30% of total capacity is latent cooling load (standard ASHRAE default sizing assumption)." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Fittings and layout losses are sized according to typical IBC Chapter 3 regulations." })]
										})]
									})
								]
							})
						})]
					})
				]
			})
		})
	});
}
//#endregion
export { CondensateDrainPage as component };
