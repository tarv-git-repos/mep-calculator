import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-fire-tank-capacity-D0c7H6df.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
require_excel();
import_FileSaver_min.default.saveAs;
function FireTankCapacityPage() {
	const { userData, profile } = useAuth();
	userData?.name || profile?.name;
	const { project, forceSaveToCloud } = useWorkspace();
	const scrollContainerRef = import_react.useRef(null);
	const [systemType, setSystemType] = (0, import_react.useState)("combined");
	const [sprinklerFlow, setSprinklerFlow] = (0, import_react.useState)("500");
	const [sprinklerDur, setSprinklerDur] = (0, import_react.useState)("60");
	const [standpipeFlow, setStandpipeFlow] = (0, import_react.useState)("500");
	const [standpipeDur, setStandpipeDur] = (0, import_react.useState)("60");
	const [hoseFlow, setHoseFlow] = (0, import_react.useState)("250");
	const [hoseDur, setHoseDur] = (0, import_react.useState)("60");
	const [makeupFlow, setMakeupFlow] = (0, import_react.useState)("0");
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (project?.id) {
			try {
				const stored = localStorage.getItem(`mep_fire_tank_capacity_calc_${project.id}`);
				if (stored) {
					const data = JSON.parse(stored);
					if (data.systemType !== void 0) setSystemType(data.systemType);
					if (data.sprinklerFlow !== void 0) setSprinklerFlow(data.sprinklerFlow);
					if (data.sprinklerDur !== void 0) setSprinklerDur(data.sprinklerDur);
					if (data.standpipeFlow !== void 0) setStandpipeFlow(data.standpipeFlow);
					if (data.standpipeDur !== void 0) setStandpipeDur(data.standpipeDur);
					if (data.hoseFlow !== void 0) setHoseFlow(data.hoseFlow);
					if (data.hoseDur !== void 0) setHoseDur(data.hoseDur);
					if (data.makeupFlow !== void 0) setMakeupFlow(data.makeupFlow);
				} else {
					setSystemType("combined");
					setSprinklerFlow("500");
					setSprinklerDur("60");
					setStandpipeFlow("500");
					setStandpipeDur("60");
					setHoseFlow("250");
					setHoseDur("60");
					setMakeupFlow("0");
				}
				setTimeout(() => dirtyStore.set(false), 50);
			} catch (e) {
				console.error("Failed to load fire tank capacity calculation", e);
			}
			setLoadedProjectId(project.id);
		}
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				systemType,
				sprinklerFlow,
				sprinklerDur,
				standpipeFlow,
				standpipeDur,
				hoseFlow,
				hoseDur,
				makeupFlow
			};
			localStorage.setItem(`mep_fire_tank_capacity_calc_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		systemType,
		sprinklerFlow,
		sprinklerDur,
		standpipeFlow,
		standpipeDur,
		hoseFlow,
		hoseDur,
		makeupFlow
	]);
	const handleSaveCurrent = () => {
		try {
			if (project?.id) {
				const dataToSave = {
					systemType,
					sprinklerFlow,
					sprinklerDur,
					standpipeFlow,
					standpipeDur,
					hoseFlow,
					hoseDur,
					makeupFlow
				};
				localStorage.setItem(`mep_fire_tank_capacity_calc_${project.id}`, JSON.stringify(dataToSave));
				dirtyStore.set(false);
				if (forceSaveToCloud) forceSaveToCloud();
				toast.success("Fire Tank Capacity Calculation saved to project successfully!");
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
		const spQ = systemType === "standpipe" ? 0 : parseFloat(sprinklerFlow) || 0;
		const spD = systemType === "standpipe" ? 0 : parseFloat(sprinklerDur) || 0;
		const stQ = systemType === "sprinkler" ? 0 : parseFloat(standpipeFlow) || 0;
		const stD = systemType === "sprinkler" ? 0 : parseFloat(standpipeDur) || 0;
		const hsQ = parseFloat(hoseFlow) || 0;
		const hsD = parseFloat(hoseDur) || 0;
		const mu = parseFloat(makeupFlow) || 0;
		const maxDur = Math.max(spD, stD, hsD);
		const spV = spQ * spD;
		const stV = stQ * stD;
		const hsV = hsQ * hsD;
		const makeupCredit = mu * maxDur;
		const totalGal = Math.max(0, spV + stV + hsV - makeupCredit);
		return {
			spV,
			stV,
			hsV,
			maxDur,
			makeupCredit,
			totalGal,
			totalL: totalGal * 3.78541
		};
	}, [
		systemType,
		sprinklerFlow,
		sprinklerDur,
		standpipeFlow,
		standpipeDur,
		hoseFlow,
		hoseDur,
		makeupFlow
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Fire Tank Capacity",
		subtitle: "Calculate water storage required for fire protection",
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
									children: "📥 Tank Parameters"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-slate-50/30 dark:bg-zinc-900/30 space-y-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
										children: "SYSTEM TYPE"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 pt-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												setSystemType("combined");
												dirtyStore.set(true);
											},
											className: `px-4 py-2 rounded-xl text-[12.5px] font-bold cursor-pointer transition-all border ${systemType === "combined" ? "bg-sky-500/10 text-[#06456F] border-[#0A7BC7] dark:bg-amber-950/40 dark:text-sky-400" : "bg-background text-muted-foreground border-border hover:bg-slate-100 dark:hover:bg-zinc-800"}`,
											children: "Combined"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												setSystemType("sprinkler");
												dirtyStore.set(true);
											},
											className: `px-4 py-2 rounded-xl text-[12.5px] font-bold cursor-pointer transition-all border ${systemType === "sprinkler" ? "bg-sky-500/10 text-[#06456F] border-[#0A7BC7] dark:bg-amber-950/40 dark:text-sky-400" : "bg-background text-muted-foreground border-border hover:bg-slate-100 dark:hover:bg-zinc-800"}`,
											children: "Sprinkler Only"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												setSystemType("standpipe");
												dirtyStore.set(true);
											},
											className: `px-4 py-2 rounded-xl text-[12.5px] font-bold cursor-pointer transition-all border ${systemType === "standpipe" ? "bg-sky-500/10 text-[#06456F] border-[#0A7BC7] dark:bg-amber-950/40 dark:text-sky-400" : "bg-background text-muted-foreground border-border hover:bg-slate-100 dark:hover:bg-zinc-800"}`,
											children: "Standpipe Only"
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4",
								children: [
									systemType !== "standpipe" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 mb-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
											children: "SPRINKLER DEMAND"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4 mb-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Flow (GPM)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: sprinklerFlow,
											onChange: handleChange(setSprinklerFlow),
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Duration (min)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: sprinklerDur,
											onChange: handleChange(setSprinklerDur),
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] })]
									})] }),
									systemType !== "sprinkler" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 mb-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
											children: "STANDPIPE DEMAND"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4 mb-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Flow (GPM)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: standpipeFlow,
											onChange: handleChange(setStandpipeFlow),
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Duration (min)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: standpipeDur,
											onChange: handleChange(setStandpipeDur),
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] })]
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 mb-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
											children: "HOSE STREAM / HYDRANT"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Flow (GPM)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: hoseFlow,
											onChange: handleChange(setHoseFlow),
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Duration (min)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: hoseDur,
											onChange: handleChange(setHoseDur),
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 mb-2 mt-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
											children: "MAKEUP WATER CREDIT"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
										children: "Makeup Flow (GPM)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: makeupFlow,
										onChange: handleChange(setMakeupFlow),
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] })
								]
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lg:col-span-7 space-y-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex gap-3 items-start",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-amber-500 mt-0.5",
							children: "ℹ️"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
							className: "text-[12.5px] font-bold text-amber-900 dark:text-amber-100 mb-1",
							children: "NFPA 22 Note"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11.5px] font-medium text-amber-800 dark:text-amber-200/70",
							children: "Tank capacity per NFPA 22. Verify local AHJ requirements - some do not allow makeup supply credit."
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
								className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6",
								children: [
									systemType !== "standpipe" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1",
											children: "Sprinkler Vol."
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-xl font-extrabold text-foreground",
											children: [
												results.spV.toFixed(0),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-sm font-semibold text-muted-foreground",
													children: "gal"
												})
											]
										})]
									}),
									systemType !== "sprinkler" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1",
											children: "Standpipe Vol."
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-xl font-extrabold text-foreground",
											children: [
												results.stV.toFixed(0),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-sm font-semibold text-muted-foreground",
													children: "gal"
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1",
											children: "Hose Stream Vol."
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-xl font-extrabold text-foreground",
											children: [
												results.hsV.toFixed(0),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-sm font-semibold text-muted-foreground",
													children: "gal"
												})
											]
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-4 rounded-2xl bg-blue-50/40 dark:bg-orange-950/20 border border-blue-100 dark:border-orange-900/50 mb-6 flex flex-col items-center text-center",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[11.5px] font-bold text-[#06456F] dark:text-sky-400 uppercase tracking-wider mb-1",
										children: "Required Minimum Tank Capacity"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-3xl font-black text-[#06456F] dark:text-sky-400 mt-1",
										children: [
											results.totalGal.toFixed(0),
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-lg font-bold",
												children: "gal"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-sm font-bold text-[#0A7BC7]/80 dark:text-sky-400/80 mt-1",
										children: [results.totalL.toFixed(0), " L"]
									})
								]
							}),
							parseFloat(makeupFlow) > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "bg-slate-50 dark:bg-zinc-900 px-4 py-2 border-b border-slate-100 dark:border-zinc-800",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[11.5px] font-bold text-muted-foreground uppercase tracking-wider",
										children: "Makeup Water Credit"
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "p-4",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[13px] font-semibold text-foreground",
											children: "Deducted from Total"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[14px] font-extrabold text-green-600 dark:text-green-400",
											children: [
												"-",
												results.makeupCredit.toFixed(0),
												" gal"
											]
										})]
									})
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
export { FireTankCapacityPage as component };
