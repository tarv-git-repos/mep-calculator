import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Y as Info } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/diffuser-selector-sZ-5ffAy.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DIFFUSER_DATA = {
	square: [
		{
			size: "150x150",
			maxFlow_20: 95,
			maxFlow_25: 116,
			throw: 8,
			nc: 20
		},
		{
			size: "225x225",
			maxFlow_20: 212,
			maxFlow_25: 275,
			throw: 12,
			nc: 25
		},
		{
			size: "300x300",
			maxFlow_20: 392,
			maxFlow_25: 487,
			throw: 16,
			nc: 30
		},
		{
			size: "375x375",
			maxFlow_20: 614,
			maxFlow_25: 667,
			throw: 20,
			nc: 35
		},
		{
			size: "450x450",
			maxFlow_20: 826,
			maxFlow_25: 826,
			throw: 24,
			nc: 40
		},
		{
			size: "525x525",
			maxFlow_20: 1038,
			maxFlow_25: 1038,
			throw: 28,
			nc: 45
		},
		{
			size: "600x600",
			maxFlow_20: 1239,
			maxFlow_25: 1239,
			throw: 32,
			nc: 50
		}
	],
	round: [
		{
			size: "Ø250",
			maxFlow_20: 38,
			maxFlow_25: 47,
			throw: 8,
			nc: 20
		},
		{
			size: "Ø307",
			maxFlow_20: 66,
			maxFlow_25: 83,
			throw: 10,
			nc: 22
		},
		{
			size: "Ø363",
			maxFlow_20: 104,
			maxFlow_25: 130,
			throw: 12,
			nc: 24
		},
		{
			size: "Ø419",
			maxFlow_20: 149,
			maxFlow_25: 186,
			throw: 14,
			nc: 26
		},
		{
			size: "Ø478",
			maxFlow_20: 203,
			maxFlow_25: 252,
			throw: 16,
			nc: 28
		},
		{
			size: "Ø534",
			maxFlow_20: 264,
			maxFlow_25: 330,
			throw: 18,
			nc: 30
		},
		{
			size: "Ø598",
			maxFlow_20: 335,
			maxFlow_25: 418,
			throw: 20,
			nc: 32
		},
		{
			size: "Ø653",
			maxFlow_20: 401,
			maxFlow_25: 519,
			throw: 22,
			nc: 34
		},
		{
			size: "Ø704",
			maxFlow_20: 479,
			maxFlow_25: 625,
			throw: 24,
			nc: 36
		},
		{
			size: "Ø756",
			maxFlow_20: 590,
			maxFlow_25: 741,
			throw: 26,
			nc: 38
		}
	],
	slot16: [
		{
			size: "1 Slot",
			maxFlow: 45,
			throw: 6,
			nc: 20
		},
		{
			size: "2 Slot",
			maxFlow: 65,
			throw: 8,
			nc: 22
		},
		{
			size: "3 Slot",
			maxFlow: 100,
			throw: 10,
			nc: 24
		},
		{
			size: "4 Slot",
			maxFlow: 125,
			throw: 12,
			nc: 26
		}
	],
	slot20: [
		{
			size: "1 Slot",
			maxFlow: 50,
			throw: 6,
			nc: 20
		},
		{
			size: "2 Slot",
			maxFlow: 75,
			throw: 8,
			nc: 22
		},
		{
			size: "3 Slot",
			maxFlow: 110,
			throw: 10,
			nc: 24
		},
		{
			size: "4 Slot",
			maxFlow: 130,
			throw: 12,
			nc: 26
		}
	],
	slot25: [
		{
			size: "1 Slot",
			maxFlow: 55,
			throw: 6,
			nc: 20
		},
		{
			size: "2 Slot",
			maxFlow: 85,
			throw: 8,
			nc: 22
		},
		{
			size: "3 Slot",
			maxFlow: 125,
			throw: 10,
			nc: 24
		},
		{
			size: "4 Slot",
			maxFlow: 150,
			throw: 12,
			nc: 26
		}
	]
};
function DiffuserSelectorPage() {
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("ip");
	const [roomAirflow, setRoomAirflow] = (0, import_react.useState)("");
	const [diffuserCount, setDiffuserCount] = (0, import_react.useState)("");
	const [designVelocity, setDesignVelocity] = (0, import_react.useState)(2);
	const [diffuserType, setDiffuserType] = (0, import_react.useState)("square");
	const [hasCalculated, setHasCalculated] = (0, import_react.useState)(false);
	const ip = unitSystem === "ip";
	const handleUnitSystemChange = (unit) => {
		if (unit === unitSystem) return;
		setUnitSystem(unit);
		if (window.__mep_keep_values) return;
		if (unit === "ip") setRoomAirflow(roomAirflow !== "" ? Number((Number(roomAirflow) * 2.1189).toFixed(0)) : "");
		else setRoomAirflow(roomAirflow !== "" ? Number((Number(roomAirflow) / 2.1189).toFixed(0)) : "");
	};
	const calculatedData = (0, import_react.useMemo)(() => {
		const flowPerDiff = (roomAirflow !== "" ? Number(roomAirflow) : ip ? 400 : 188) / (diffuserCount !== "" ? Number(diffuserCount) : 2);
		const flowKey = designVelocity === 2.5 ? "maxFlow_25" : "maxFlow_20";
		const options = DIFFUSER_DATA[diffuserType];
		let selected = null;
		for (let i = 0; i < options.length; i++) {
			let maxFlow = 0;
			if (diffuserType === "square" || diffuserType === "round") maxFlow = options[i][flowKey] || 0;
			else maxFlow = options[i].maxFlow || 0;
			if (flowPerDiff <= maxFlow) {
				selected = options[i];
				break;
			}
		}
		if (!selected) {
			if (diffuserType === "slot16" || diffuserType === "slot20" || diffuserType === "slot25") return {
				flowPerDiff,
				neckSize: "-",
				velocityFpm: designVelocity * 196.85,
				throwVal: "-",
				nc: "-",
				adpi: "Flow exceeds slot capacity"
			};
			selected = options[options.length - 1];
		}
		const velocityFpm = designVelocity * 196.85;
		let adpi = "Good Selection";
		if (velocityFpm > 600) adpi = "High velocity - draft risk";
		else if (velocityFpm < 300) adpi = "Low velocity - poor air spread";
		const throwDisplay = ip ? `${selected.throw.toFixed(1)} ft` : `${(selected.throw * .3048).toFixed(1)} m`;
		return {
			flowPerDiff,
			neckSize: selected.size,
			velocityFpm,
			throwVal: throwDisplay,
			nc: `NC-${selected.nc}`,
			adpi
		};
	}, [
		roomAirflow,
		diffuserCount,
		designVelocity,
		diffuserType,
		ip
	]);
	const handleCalculate = () => {
		setHasCalculated(true);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Diffuser Selector",
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
							children: "HVAC > DIFFUSER SELECTOR"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
							children: "Diffuser Quick Selector"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] text-muted-foreground mt-0.5",
							children: "Select diffuser types and estimate neck sizes, throws, and noise ratings for room airflow distributions."
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
										children: "Inputs"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-3.5 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground",
												children: [
													"Room Airflow (",
													ip ? "CFM" : "L/s",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: roomAirflow,
												onChange: (e) => {
													setRoomAirflow(e.target.value === "" ? "" : Number(e.target.value));
													setHasCalculated(false);
												},
												placeholder: ip ? "400" : "188",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Number of Diffusers"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: "1",
												step: "1",
												value: diffuserCount,
												onChange: (e) => {
													setDiffuserCount(e.target.value === "" ? "" : Number(e.target.value));
													setHasCalculated(false);
												},
												placeholder: "2",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Design Velocity"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: designVelocity,
												onChange: (e) => {
													setDesignVelocity(Number(e.target.value));
													setHasCalculated(false);
												},
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "2.0",
													children: "2.0 m/s (350 FPM)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "2.5",
													children: "2.5 m/s (500 FPM)"
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Diffuser Type"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: diffuserType,
												onChange: (e) => {
													setDiffuserType(e.target.value);
													setHasCalculated(false);
												},
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "square",
														children: "Square"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "round",
														children: "Round"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "slot16",
														children: "Linear Slot 16mm"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "slot20",
														children: "Linear Slot 20mm"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "slot25",
														children: "Linear Slot 25mm"
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
								children: "⚡ Select Diffuser"
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
									children: "Ready to Size"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11.5px] text-muted-foreground max-w-xs leading-normal",
									children: "Enter the airflow details and diffuser configuration to see selection sizing."
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-5 animate-fade-in",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-sky-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl p-3.5 flex gap-2.5 text-[11.5px] select-none",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-4 shrink-0 mt-0.5 text-amber-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Selection is based on typical lookup data. Always verify specific layouts with manufacturer selection software." })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 pb-2 border-b border-border/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground",
											children: "Solved Parameters"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Flow per Diffuser"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: ip ? `${calculatedData.flowPerDiff.toFixed(0)} CFM` : `${calculatedData.flowPerDiff.toFixed(0)} L/s`
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Neck Size Sized"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-[#0A7BC7] text-[13px] font-mono",
													children: calculatedData.neckSize
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Face Velocity"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [
														calculatedData.velocityFpm.toFixed(0),
														" FPM (",
														designVelocity.toFixed(2),
														" m/s)"
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Estimated Throw (T50)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: calculatedData.throwVal
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Noise Rating"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: calculatedData.nc
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "ADPI Selection Suitability"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-[#0A7BC7] font-mono",
													children: calculatedData.adpi
												})]
											})
										]
									})]
								})
							]
						})
					})]
				})]
			})
		})
	});
}
//#endregion
export { DiffuserSelectorPage as component };
