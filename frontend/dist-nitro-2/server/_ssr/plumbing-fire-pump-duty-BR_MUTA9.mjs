import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-fire-pump-duty-BR_MUTA9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
require_excel();
import_FileSaver_min.default.saveAs;
function FirePumpDutyPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const scrollContainerRef = import_react.useRef(null);
	const [fpFlow, setFpFlow] = (0, import_react.useState)("500");
	const [fpPress, setFpPress] = (0, import_react.useState)("100");
	const [fpDisch, setFpDisch] = (0, import_react.useState)("5");
	const [fpSuct, setFpSuct] = (0, import_react.useState)("0");
	const [fpEff, setFpEff] = (0, import_react.useState)("70");
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (project?.id) {
			try {
				const stored = localStorage.getItem(`mep_fire_pump_duty_calc_${project.id}`);
				if (stored) {
					const data = JSON.parse(stored);
					if (data.fpFlow !== void 0) setFpFlow(data.fpFlow);
					if (data.fpPress !== void 0) setFpPress(data.fpPress);
					if (data.fpDisch !== void 0) setFpDisch(data.fpDisch);
					if (data.fpSuct !== void 0) setFpSuct(data.fpSuct);
					if (data.fpEff !== void 0) setFpEff(data.fpEff);
				} else {
					setFpFlow("500");
					setFpPress("100");
					setFpDisch("5");
					setFpSuct("0");
					setFpEff("70");
				}
				setTimeout(() => dirtyStore.set(false), 50);
			} catch (e) {
				console.error("Failed to load fire pump duty calculation", e);
			}
			setLoadedProjectId(project.id);
		}
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				fpFlow,
				fpPress,
				fpDisch,
				fpSuct,
				fpEff
			};
			localStorage.setItem(`mep_fire_pump_duty_calc_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		fpFlow,
		fpPress,
		fpDisch,
		fpSuct,
		fpEff
	]);
	const handleSaveCurrent = () => {
		try {
			if (project?.id) {
				const dataToSave = {
					fpFlow,
					fpPress,
					fpDisch,
					fpSuct,
					fpEff
				};
				localStorage.setItem(`mep_fire_pump_duty_calc_${project.id}`, JSON.stringify(dataToSave));
				dirtyStore.set(false);
				if (forceSaveToCloud) forceSaveToCloud();
				toast.success("Fire Pump Duty Calculation saved to project successfully!");
			}
		} catch (e) {
			toast.error("Failed to save calculation.");
		}
	};
	const handleChange = (setter) => (e) => {
		setter(e.target.value);
		dirtyStore.set(true);
	};
	const results = (0, import_react.useMemo)(() => {
		const Q = parseFloat(fpFlow) || 0;
		const P = parseFloat(fpPress) || 0;
		const suct = parseFloat(fpSuct) || 0;
		const disch = parseFloat(fpDisch) || 0;
		const eff = (parseFloat(fpEff) || 70) / 100;
		const suctPsi = suct * .4335;
		const rated = P + disch - suctPsi + 3;
		const churn = rated * 1.4;
		const peakPsi = rated * .65;
		const peakQ = Q * 1.5;
		const qM3s = Q * 630902e-10;
		const hM = rated * .70307;
		const kw = eff > 0 ? qM3s * hM * 1e3 * 9.80665 / eff / 1e3 : 0;
		return {
			Q,
			rated,
			churn,
			peakQ,
			peakPsi,
			kw,
			hp: kw * 1.34102,
			showHighChurnWarning: churn > 250
		};
	}, [
		fpFlow,
		fpPress,
		fpDisch,
		fpSuct,
		fpEff
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Fire Pump Duty",
		subtitle: "Determine rated head, churn pressure, and motor sizing",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			onClick: handleSaveCurrent,
			className: "flex items-center gap-1.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all border-0 cursor-pointer shadow-xs",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-3.5" }), " Save Calculation"]
		}),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: scrollContainerRef,
			className: "flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "lg:col-span-5 space-y-5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide",
								children: "📥 Pump Parameters"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 mb-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
										children: "FLOW & PRESSURE"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
										children: "Design Flow (GPM)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: fpFlow,
										onChange: handleChange(setFpFlow),
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
										children: "System Demand Pressure (psi)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: fpPress,
										onChange: handleChange(setFpPress),
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
										children: "Discharge Piping Loss (psi)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: fpDisch,
										onChange: handleChange(setFpDisch),
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
										children: "Available Suction Head (ft)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: fpSuct,
										onChange: handleChange(setFpSuct),
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
									children: "Pump Efficiency (%)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									value: fpEff,
									onChange: handleChange(setFpEff),
									className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
								})] })
							]
						})]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lg:col-span-7 space-y-5",
					children: [
						results.showHighChurnWarning && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 flex gap-3 items-start",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-red-500 mt-0.5",
								children: "⚠️"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "text-[12.5px] font-bold text-red-900 dark:text-red-100 mb-1",
								children: "High Churn Pressure"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-[11.5px] font-medium text-red-800 dark:text-red-200/70",
								children: [
									"Churn ",
									results.churn.toFixed(0),
									" psi is high. Verify system PRV and pressure ratings."
								]
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex gap-3 items-start",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-amber-500 mt-0.5",
								children: "ℹ️"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "text-[12.5px] font-bold text-amber-900 dark:text-amber-100 mb-1",
								children: "NFPA 20 Requirement"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11.5px] font-medium text-amber-800 dark:text-amber-200/70",
								children: "Pump must deliver ≥150% rated flow at ≥65% rated head. Verify with manufacturer's pump curve."
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 mb-6",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1.5 h-5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-[15px] font-bold text-foreground tracking-wide",
										children: "Calculated Results"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-6",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 rounded-2xl bg-blue-50/40 dark:bg-orange-950/20 border border-blue-100 dark:border-orange-900/50",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] font-bold text-[#06456F] dark:text-sky-400 uppercase tracking-wider mb-1",
											children: "Rated Duty Point"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-2xl font-black text-[#06456F] dark:text-sky-400",
											children: [
												results.Q.toFixed(0),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-sm font-bold",
													children: "GPM"
												}),
												" @ ",
												results.rated.toFixed(1),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-sm font-bold",
													children: "psi"
												})
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1",
											children: "Motor Power Requirement"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-xl font-extrabold text-foreground",
											children: [
												results.hp.toFixed(1),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-sm font-semibold text-muted-foreground",
													children: "HP"
												}),
												" / ",
												results.kw.toFixed(1),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-sm font-semibold text-muted-foreground",
													children: "kW"
												})
											]
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "bg-slate-50 dark:bg-zinc-900 px-4 py-2 border-b border-slate-100 dark:border-zinc-800",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-[11.5px] font-bold text-muted-foreground uppercase tracking-wider",
											children: "Pump Curve Points"
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 space-y-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[13px] font-semibold text-foreground",
													children: "Churn Pressure (0 GPM)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[14px] font-extrabold text-slate-700 dark:text-zinc-300",
													children: [
														results.churn.toFixed(1),
														" psi ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] font-medium text-muted-foreground ml-1",
															children: "(140% rated)"
														})
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-full h-px bg-border" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[13px] font-semibold text-foreground",
													children: "Peak Point (150% Flow)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[14px] font-extrabold text-slate-700 dark:text-zinc-300",
													children: [
														results.peakQ.toFixed(0),
														" GPM @ ",
														results.peakPsi.toFixed(1),
														" psi"
													]
												})]
											})
										]
									})]
								})
							]
						})
					]
				})]
			})
		})
	});
}
//#endregion
export { FirePumpDutyPage as component };
