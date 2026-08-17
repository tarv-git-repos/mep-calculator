import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Y as Info } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-urg-0zDa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/refrigerant-pipe-sizing-B4OylNi7.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var REF_PIPE_DATA = {
	suction: {
		R410A: {
			ranges: [
				[
					0,
					3,
					"12.7"
				],
				[
					3,
					6,
					"15.88"
				],
				[
					6,
					12,
					"19.05"
				],
				[
					12,
					20,
					"22.22"
				],
				[
					20,
					35,
					"28.58"
				],
				[
					35,
					60,
					"34.93"
				],
				[
					60,
					100,
					"41.28"
				]
			],
			vel: "12-20 m/s"
		},
		R22: {
			ranges: [
				[
					0,
					3,
					"12.7"
				],
				[
					3,
					7,
					"15.88"
				],
				[
					7,
					15,
					"19.05"
				],
				[
					15,
					25,
					"22.22"
				],
				[
					25,
					45,
					"28.58"
				]
			],
			vel: "10-18 m/s"
		},
		R32: {
			ranges: [
				[
					0,
					3,
					"12.7"
				],
				[
					3,
					6,
					"15.88"
				],
				[
					6,
					12,
					"19.05"
				],
				[
					12,
					20,
					"22.22"
				],
				[
					20,
					35,
					"28.58"
				],
				[
					35,
					60,
					"34.93"
				],
				[
					60,
					100,
					"41.28"
				]
			],
			vel: "12-20 m/s"
		},
		R134a: {
			ranges: [
				[
					0,
					2,
					"12.7"
				],
				[
					2,
					5,
					"15.88"
				],
				[
					5,
					10,
					"19.05"
				],
				[
					10,
					18,
					"22.22"
				],
				[
					18,
					30,
					"28.58"
				]
			],
			vel: "8-15 m/s"
		},
		R407C: {
			ranges: [
				[
					0,
					3,
					"12.7"
				],
				[
					3,
					6,
					"15.88"
				],
				[
					6,
					12,
					"19.05"
				],
				[
					12,
					20,
					"22.22"
				],
				[
					20,
					35,
					"28.58"
				]
			],
			vel: "10-18 m/s"
		}
	},
	liquid: {
		R410A: {
			ranges: [
				[
					0,
					5,
					"9.52"
				],
				[
					5,
					12,
					"12.7"
				],
				[
					12,
					25,
					"15.88"
				],
				[
					25,
					50,
					"19.05"
				]
			],
			vel: "0.5-1.5 m/s"
		},
		R22: {
			ranges: [
				[
					0,
					6,
					"9.52"
				],
				[
					6,
					14,
					"12.7"
				],
				[
					14,
					30,
					"15.88"
				]
			],
			vel: "0.5-1.2 m/s"
		},
		R32: {
			ranges: [
				[
					0,
					5,
					"9.52"
				],
				[
					5,
					12,
					"12.7"
				],
				[
					12,
					25,
					"15.88"
				],
				[
					25,
					50,
					"19.05"
				]
			],
			vel: "0.5-1.5 m/s"
		},
		R134a: {
			ranges: [
				[
					0,
					4,
					"9.52"
				],
				[
					4,
					10,
					"12.7"
				],
				[
					10,
					22,
					"15.88"
				]
			],
			vel: "0.5-1.2 m/s"
		},
		R407C: {
			ranges: [
				[
					0,
					5,
					"9.52"
				],
				[
					5,
					12,
					"12.7"
				],
				[
					12,
					25,
					"15.88"
				]
			],
			vel: "0.5-1.5 m/s"
		}
	},
	discharge: {
		R410A: {
			ranges: [
				[
					0,
					3,
					"9.52"
				],
				[
					3,
					6,
					"12.7"
				],
				[
					6,
					12,
					"15.88"
				],
				[
					12,
					22,
					"19.05"
				]
			],
			vel: "12-20 m/s"
		},
		R22: {
			ranges: [
				[
					0,
					4,
					"9.52"
				],
				[
					4,
					8,
					"12.7"
				],
				[
					8,
					16,
					"15.88"
				],
				[
					16,
					28,
					"19.05"
				]
			],
			vel: "10-18 m/s"
		},
		R32: {
			ranges: [
				[
					0,
					3,
					"9.52"
				],
				[
					3,
					6,
					"12.7"
				],
				[
					6,
					12,
					"15.88"
				],
				[
					12,
					22,
					"19.05"
				]
			],
			vel: "12-20 m/s"
		},
		R134a: {
			ranges: [
				[
					0,
					3,
					"9.52"
				],
				[
					3,
					6,
					"12.7"
				],
				[
					6,
					12,
					"15.88"
				]
			],
			vel: "8-15 m/s"
		},
		R407C: {
			ranges: [
				[
					0,
					3,
					"9.52"
				],
				[
					3,
					6,
					"12.7"
				],
				[
					6,
					12,
					"15.88"
				]
			],
			vel: "10-18 m/s"
		}
	}
};
function RefrigerantPipeSizingPage() {
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("ip");
	const [coolingCapacity, setCoolingCapacity] = (0, import_react.useState)("");
	const [refrigerant, setRefrigerant] = (0, import_react.useState)("R410A");
	const [lineType, setLineType] = (0, import_react.useState)("suction");
	const [hasCalculated, setHasCalculated] = (0, import_react.useState)(false);
	const ip = unitSystem === "ip";
	const handleUnitSystemChange = (unit) => {
		if (unit === unitSystem) return;
		setUnitSystem(unit);
		if (window.__mep_keep_values) return;
		if (unit === "ip") setCoolingCapacity(coolingCapacity !== "" ? Number((Number(coolingCapacity) / 3.51685).toFixed(1)) : "");
		else setCoolingCapacity(coolingCapacity !== "" ? Number((Number(coolingCapacity) * 3.51685).toFixed(1)) : "");
	};
	const calculatedData = (0, import_react.useMemo)(() => {
		const capVal = coolingCapacity !== "" ? Number(coolingCapacity) : ip ? 10 : 35;
		const trIP = ip ? capVal : capVal / 3.51685;
		const lineData = REF_PIPE_DATA[lineType][refrigerant] || REF_PIPE_DATA[lineType]["R410A"];
		let od = "Out of range / No data";
		for (const r of lineData.ranges) if (trIP >= r[0] && trIP < r[1]) {
			od = `${r[2]} mm OD`;
			break;
		}
		return {
			trIP,
			od,
			vel: lineData.vel
		};
	}, [
		coolingCapacity,
		refrigerant,
		lineType,
		ip
	]);
	const handleCalculate = () => {
		setHasCalculated(true);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Refrigerant Pipe Sizing",
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
							children: "HVAC > REFRIGERANT PIPING"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
							children: "Refrigerant Pipe Sizer"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] text-muted-foreground mt-0.5",
							children: "Determine copper refrigerant line outer diameters (OD) for suction, liquid, and discharge lines."
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
													"Cooling Capacity (",
													ip ? "TR" : "kW",
													")"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: coolingCapacity,
												onChange: (e) => {
													setCoolingCapacity(e.target.value === "" ? "" : Number(e.target.value));
													setHasCalculated(false);
												},
												placeholder: ip ? "10" : "35.0",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Refrigerant Type"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: refrigerant,
												onChange: (e) => {
													setRefrigerant(e.target.value);
													setHasCalculated(false);
												},
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "R410A",
														children: "R-410A"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "R22",
														children: "R-22"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "R32",
														children: "R-32"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "R134a",
														children: "R-134a"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "R407C",
														children: "R-407C"
													})
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Line Type"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 border border-border/60 select-none",
												children: [
													"suction",
													"liquid",
													"discharge"
												].map((t) => {
													return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
														type: "button",
														onClick: () => {
															setLineType(t);
															setHasCalculated(false);
														},
														className: `flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer capitalize ${lineType === t ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
														children: t
													}, t);
												})
											})]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: handleCalculate,
								className: "w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs",
								children: "⚡ Size Refrigerant Pipe"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "lg:col-span-7 flex flex-col gap-5",
						children: !hasCalculated ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none",
									children: "❄️"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
									className: "text-xs font-bold text-foreground mb-1 uppercase tracking-wider",
									children: "Ready to Size"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11.5px] text-muted-foreground max-w-xs leading-normal",
									children: "Enter the cooling system capacity and line specifications to determine the recommended copper pipe size."
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
											children: "Results"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center py-1.5 border-b border-border/40 col-span-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-semibold text-muted-foreground",
												children: "Recommended OD Size"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "font-bold text-[#0A7BC7] text-[15px] font-mono",
												children: calculatedData.od
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center py-1.5 col-span-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-semibold text-muted-foreground",
												children: "Typical Design Velocity Range"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "font-bold text-foreground font-mono",
												children: calculatedData.vel
											})]
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-sky-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl p-3.5 flex gap-2.5 text-[11.5px] select-none",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-4 shrink-0 mt-0.5 text-amber-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sizing complies with typical ASHRAE refrigerant line velocity and oil-return criteria limits." })]
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
export { RefrigerantPipeSizingPage as component };
