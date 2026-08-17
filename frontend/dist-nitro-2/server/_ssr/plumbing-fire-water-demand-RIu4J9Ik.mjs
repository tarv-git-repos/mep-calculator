import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-fire-water-demand-RIu4J9Ik.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
require_excel();
import_FileSaver_min.default.saveAs;
function FireWaterDemandPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const scrollContainerRef = import_react.useRef(null);
	const [spFlow, setSpFlow] = (0, import_react.useState)("500");
	const [spPress, setSpPress] = (0, import_react.useState)("60");
	const [hyCount, setHyCount] = (0, import_react.useState)("2");
	const [hyFlow, setHyFlow] = (0, import_react.useState)("250");
	const [hrCount, setHrCount] = (0, import_react.useState)("0");
	const [hrFlow, setHrFlow] = (0, import_react.useState)("50");
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (project?.id) {
			try {
				const stored = localStorage.getItem(`mep_fire_water_demand_calc_${project.id}`);
				if (stored) {
					const data = JSON.parse(stored);
					if (data.spFlow !== void 0) setSpFlow(data.spFlow);
					if (data.spPress !== void 0) setSpPress(data.spPress);
					if (data.hyCount !== void 0) setHyCount(data.hyCount);
					if (data.hyFlow !== void 0) setHyFlow(data.hyFlow);
					if (data.hrCount !== void 0) setHrCount(data.hrCount);
					if (data.hrFlow !== void 0) setHrFlow(data.hrFlow);
				} else {
					setSpFlow("500");
					setSpPress("60");
					setHyCount("2");
					setHyFlow("250");
					setHrCount("0");
					setHrFlow("50");
				}
				setTimeout(() => dirtyStore.set(false), 50);
			} catch (e) {
				console.error("Failed to load fire water demand calculation", e);
			}
			setLoadedProjectId(project.id);
		}
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				spFlow,
				spPress,
				hyCount,
				hyFlow,
				hrCount,
				hrFlow
			};
			localStorage.setItem(`mep_fire_water_demand_calc_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		spFlow,
		spPress,
		hyCount,
		hyFlow,
		hrCount,
		hrFlow
	]);
	const handleSaveCurrent = () => {
		try {
			if (project?.id) {
				const dataToSave = {
					spFlow,
					spPress,
					hyCount,
					hyFlow,
					hrCount,
					hrFlow
				};
				localStorage.setItem(`mep_fire_water_demand_calc_${project.id}`, JSON.stringify(dataToSave));
				dirtyStore.set(false);
				if (forceSaveToCloud) forceSaveToCloud();
				toast.success("Fire Water Demand Calculation saved to project successfully!");
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
		const spF = parseFloat(spFlow) || 0;
		const hyC = parseInt(hyCount) || 0;
		const hyF = parseFloat(hyFlow) || 0;
		const hrC = parseInt(hrCount) || 0;
		const hrF = parseFloat(hrFlow) || 0;
		const hyTotal = hyC * hyF;
		const hrTotal = hrC * hrF;
		const totalFlow = spF + hyTotal + hrTotal;
		return {
			spF,
			hyTotal,
			hrTotal,
			totalFlow,
			tank60: totalFlow * 60,
			tank90: totalFlow * 90,
			showLargeDemandWarning: totalFlow > 2e3
		};
	}, [
		spFlow,
		hyCount,
		hyFlow,
		hrCount,
		hrFlow
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Fire Water Demand",
		subtitle: "Determine total flow for sprinklers and hydrants",
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
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide",
									children: "📥 Demand Parameters"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 mb-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
										children: "SPRINKLER SYSTEM"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
										children: "System Flow (GPM)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: spFlow,
										onChange: handleChange(setSpFlow),
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
										children: "Pressure (psi)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: spPress,
										onChange: handleChange(setSpPress),
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] })]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 mb-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
											children: "ADDITIONAL DEMANDS"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4 mb-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Hydrant Count"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: hyCount,
											onChange: handleChange(setHyCount),
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Flow per Hydrant (GPM)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: hyFlow,
											onChange: handleChange(setHyFlow),
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Hose Reel Count"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: hrCount,
											onChange: handleChange(setHrCount),
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Flow per Hose (GPM)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: hrFlow,
											onChange: handleChange(setHrFlow),
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] })]
									})
								]
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lg:col-span-7 space-y-5",
					children: [results.showLargeDemandWarning && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex gap-3 items-start",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-amber-500 mt-0.5",
							children: "⚠️"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
							className: "text-[12.5px] font-bold text-amber-900 dark:text-amber-100 mb-1",
							children: "Large Demand"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[11.5px] font-medium text-amber-800 dark:text-amber-200/70",
							children: [
								"Total demand (",
								results.totalFlow.toFixed(0),
								" GPM) is very large. Verify simultaneous demand assumptions and consider split pump arrangement."
							]
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1",
											children: "Sprinkler Demand"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-xl font-extrabold text-foreground",
											children: [
												results.spF.toFixed(0),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-sm font-semibold text-muted-foreground",
													children: [
														"GPM @ ",
														parseFloat(spPress) || 0,
														" psi"
													]
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1",
												children: "Hydrants Demand"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-xl font-extrabold text-foreground",
												children: [
													results.hyTotal.toFixed(0),
													" ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-sm font-semibold text-muted-foreground",
														children: "GPM"
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[10px] text-muted-foreground mt-0.5",
												children: [
													"(",
													parseInt(hyCount) || 0,
													" × ",
													parseFloat(hyFlow) || 0,
													" GPM)"
												]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1",
												children: "Hose Reels Demand"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-xl font-extrabold text-foreground",
												children: [
													results.hrTotal.toFixed(0),
													" ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-sm font-semibold text-muted-foreground",
														children: "GPM"
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[10px] text-muted-foreground mt-0.5",
												children: [
													"(",
													parseInt(hrCount) || 0,
													" × ",
													parseFloat(hrFlow) || 0,
													" GPM)"
												]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 rounded-2xl bg-blue-50/40 dark:bg-orange-950/20 border border-blue-100 dark:border-orange-900/50",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] font-bold text-[#06456F] dark:text-sky-400 uppercase tracking-wider mb-1",
											children: "Total System Demand"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-2xl font-black text-[#06456F] dark:text-sky-400",
											children: [
												results.totalFlow.toFixed(0),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-sm font-bold",
													children: "GPM"
												})
											]
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "bg-slate-50 dark:bg-zinc-900 px-4 py-2 border-b border-slate-100 dark:border-zinc-800",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[11.5px] font-bold text-muted-foreground uppercase tracking-wider",
										children: "Required Storage Capacity"
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-4 space-y-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[13px] font-semibold text-foreground",
												children: "For 60 Minutes Duration"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-[14px] font-extrabold text-slate-700 dark:text-zinc-300",
												children: [results.tank60.toFixed(0), " gal"]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-full h-px bg-border" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[13px] font-semibold text-foreground",
												children: "For 90 Minutes Duration"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-[14px] font-extrabold text-slate-700 dark:text-zinc-300",
												children: [results.tank90.toFixed(0), " gal"]
											})]
										})
									]
								})]
							})
						]
					})]
				})]
			})
		})
	});
}
//#endregion
export { FireWaterDemandPage as component };
