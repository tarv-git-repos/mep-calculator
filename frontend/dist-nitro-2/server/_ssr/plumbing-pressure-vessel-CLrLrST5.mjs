import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-pressure-vessel-CLrLrST5.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
require_excel();
import_FileSaver_min.default.saveAs;
function PressureVesselPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const [importedFlow, setImportedFlow] = (0, import_react.useState)("0.00");
	const [importedHead, setImportedHead] = (0, import_react.useState)("0.00");
	const [qLmin, setQLmin] = (0, import_react.useState)("78.00");
	const [bandFactor, setBandFactor] = (0, import_react.useState)("0.20");
	const [ppVal, setPpVal] = (0, import_react.useState)("8.52");
	const [paVal, setPaVal] = (0, import_react.useState)("5.68");
	const [zmax, setZmax] = (0, import_react.useState)("60");
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (project?.id) {
			try {
				const stored = localStorage.getItem(`mep_pressure_vessel_calc_${project.id}`);
				if (stored) {
					const data = JSON.parse(stored);
					if (data.importedFlow !== void 0) setImportedFlow(data.importedFlow);
					if (data.importedHead !== void 0) setImportedHead(data.importedHead);
					if (data.qLmin !== void 0) setQLmin(data.qLmin);
					if (data.bandFactor !== void 0) setBandFactor(data.bandFactor);
					if (data.ppVal !== void 0) setPpVal(data.ppVal);
					if (data.paVal !== void 0) setPaVal(data.paVal);
					if (data.zmax !== void 0) setZmax(data.zmax);
				} else {
					setImportedFlow("0.00");
					setImportedHead("0.00");
					setQLmin("78.00");
					setBandFactor("0.20");
					setPpVal("8.52");
					setPaVal("5.68");
					setZmax("60");
				}
				setTimeout(() => dirtyStore.set(false), 50);
			} catch (e) {
				console.error("Failed to load pressure vessel calculation", e);
			}
			setLoadedProjectId(project.id);
		}
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				importedFlow,
				importedHead,
				qLmin,
				bandFactor,
				ppVal,
				paVal,
				zmax
			};
			localStorage.setItem(`mep_pressure_vessel_calc_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		importedFlow,
		importedHead,
		qLmin,
		bandFactor,
		ppVal,
		paVal,
		zmax
	]);
	const handleSaveCurrent = () => {
		try {
			if (project?.id) {
				const dataToSave = {
					importedFlow,
					importedHead,
					qLmin,
					bandFactor,
					ppVal,
					paVal,
					zmax
				};
				localStorage.setItem(`mep_pressure_vessel_calc_${project.id}`, JSON.stringify(dataToSave));
				dirtyStore.set(false);
				if (forceSaveToCloud) forceSaveToCloud();
				toast.success("Pressure Vessel Sizing saved to project successfully!");
			}
		} catch (e) {
			toast.error("Failed to save calculation.");
		}
	};
	(0, import_react.useEffect)(() => {
		const head = parseFloat(importedHead) || 0;
		const factor = parseFloat(bandFactor) || 0;
		if (head > 0) {
			const computedPp = head * factor + head;
			const computedPa = head - head * factor;
			setPpVal(computedPp.toFixed(2));
			setPaVal(computedPa.toFixed(2));
		}
	}, [importedHead, bandFactor]);
	(0, import_react.useEffect)(() => {
		const flow = parseFloat(importedFlow) || 0;
		if (flow > 0) setQLmin((flow * 60).toFixed(2));
	}, [importedFlow]);
	const results = (0, import_react.useMemo)(() => {
		const q = parseFloat(qLmin) || 0;
		const pp = parseFloat(ppVal) || 0;
		const pa = parseFloat(paVal) || 0;
		const pc = pa - .2;
		const z = parseFloat(zmax) || 1;
		const constant = 16.5;
		let volume = 0;
		if (z > 0 && pp - pa > 0 && pc > 0) volume = constant * (q * pp * pa / (z * (pp - pa) * pc));
		return {
			pc,
			volume
		};
	}, [
		qLmin,
		ppVal,
		paVal,
		zmax
	]);
	const handleImport = (importType) => {
		try {
			const stored = localStorage.getItem(`mep_pump_sizing_calc_${project.id}`);
			if (!stored) {
				toast.error(`No saved Pump Sizing Calculation found for this project. Please save it first.`);
				return;
			}
			const data = JSON.parse(stored);
			if (importType === "booster" && data.pumpType === "transfer") {
				toast.error(`The saved calculation is for a Transfer Pump. Please select "Import from Transfer Pump".`);
				return;
			}
			if (importType === "transfer" && data.pumpType !== "transfer") {
				toast.error(`The saved calculation is for a Booster/Transfer-Booster Pump. Please select "Import from Booster Pump".`);
				return;
			}
			const vert = parseFloat(data.pipeVert) || 0;
			const horiz = parseFloat(data.pipeHoriz) || 0;
			const ff = parseFloat(data.fricFactor) || .4;
			const elbows = (vert + horiz) * .3;
			const valves = (vert + horiz) * .3;
			const L_sum = vert + horiz + elbows + valves;
			const frictionLoss = Math.ceil(L_sum * 1.05 / 10) * 10 * (ff / 100);
			let filterLoss = 0;
			if (data.pumpType === "transfer") {
				if (data.filtCarbon) filterLoss += .8;
				if (data.filtMM) filterLoss += .8;
				if (data.filtCuAg) filterLoss += .2;
				if (data.filtSoftener) filterLoss += .8;
			}
			const staticH = parseFloat(data.staticHead) || 0;
			const outletH = parseFloat(data.presidHead) || 0;
			const suctionH = parseFloat(data.suctionHead) || 0;
			const safetyMargin = (parseFloat(data.sfHead) || 0) / 100;
			const calcHead = (Math.max(0, frictionLoss + staticH + outletH - suctionH) + filterLoss) * (1 + safetyMargin);
			let flowLps = parseFloat(data.manualFlow) || 0;
			const wPumps = parseInt(data.workingPumps) || 1;
			if (data.pumpType !== "transfer") flowLps = flowLps * wPumps;
			setImportedFlow(flowLps.toFixed(2));
			setImportedHead(calcHead.toFixed(2));
			dirtyStore.set(true);
			toast.success(`Successfully imported from ${importType === "booster" ? "Booster Pump" : "Transfer Pump"}`);
		} catch (e) {
			console.error(e);
			toast.error("Failed to import values.");
		}
	};
	const handleFieldChange = (setter, val) => {
		setter(val);
		dirtyStore.set(true);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Pressure Vessel Sizing",
		subtitle: "Expansion & Buffer Tank volume calculator",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			onClick: handleSaveCurrent,
			className: "flex items-center gap-1.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all border-0 cursor-pointer shadow-xs animate-in fade-in duration-200",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-3.5" }), " Save Calculation"]
		}),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
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
									children: "📥 Input Parameters"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-slate-50/30 dark:bg-zinc-900/30 space-y-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
											children: "Import Sizing Data"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-3 pt-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => handleImport("booster"),
											className: "py-2.5 bg-background hover:bg-slate-100 dark:hover:bg-zinc-800 text-foreground border border-border dark:border-[#262626] rounded-xl text-[12px] font-bold transition-all cursor-pointer shadow-xs",
											children: "Import Booster Pump"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => handleImport("transfer"),
											className: "py-2.5 bg-background hover:bg-slate-100 dark:hover:bg-zinc-800 text-foreground border border-border dark:border-[#262626] rounded-xl text-[12px] font-bold transition-all cursor-pointer shadow-xs",
											children: "Import Transfer Pump"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4 pt-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Imported Flow Rate (L/s)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											readOnly: true,
											value: importedFlow,
											className: "w-full h-11 px-3 bg-slate-100 dark:bg-zinc-950/80 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-not-allowed"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Imported Head (bar)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											readOnly: true,
											value: importedHead,
											className: "w-full h-11 px-3 bg-slate-100 dark:bg-zinc-950/80 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-not-allowed"
										})] })]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-4 pt-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Discharge Volume of Pump (Q)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "L/min"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: qLmin,
										onChange: (e) => handleFieldChange(setQLmin, e.target.value),
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground mb-1",
											children: "On / Off Band Factor"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "0.01",
											value: bandFactor,
											onChange: (e) => handleFieldChange(setBandFactor, e.target.value),
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground mb-1",
											children: "Pump Starts / Hour (Zmax)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: zmax,
											onChange: (e) => handleFieldChange(setZmax, e.target.value),
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-3 gap-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between mb-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-[11px] font-semibold text-muted-foreground",
													children: "Pump Stop (Pp)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1 py-0.5 rounded uppercase",
													children: "bar"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "0.01",
												value: ppVal,
												onChange: (e) => handleFieldChange(setPpVal, e.target.value),
												className: "w-full h-11 px-2.5 bg-background border border-border dark:border-[#262626] rounded-xl text-[13.5px] font-semibold outline-none focus:border-[#0A7BC7]"
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between mb-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-[11px] font-semibold text-muted-foreground",
													children: "Pump Start (Pa)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1 py-0.5 rounded uppercase",
													children: "bar"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "0.01",
												value: paVal,
												onChange: (e) => handleFieldChange(setPaVal, e.target.value),
												className: "w-full h-11 px-2.5 bg-background border border-border dark:border-[#262626] rounded-xl text-[13.5px] font-semibold outline-none focus:border-[#0A7BC7]"
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between mb-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-[11px] font-semibold text-muted-foreground",
													children: "Preload (Pc)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1 py-0.5 rounded uppercase",
													children: "bar"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												readOnly: true,
												value: results.pc.toFixed(2),
												className: "w-full h-11 px-2.5 bg-slate-50 dark:bg-zinc-950/80 border border-border dark:border-[#262626] rounded-xl text-[13.5px] font-semibold text-muted-foreground outline-none cursor-default"
											})] })
										]
									})
								]
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lg:col-span-7 space-y-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border-b border-slate-100 dark:border-zinc-800/80 px-4 py-3.5 bg-slate-50/50 dark:bg-zinc-900/30 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
								children: "PRESSURE VESSEL VOLUME SUMMARY"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-6 flex flex-col items-center justify-center text-center space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[13px] font-bold text-muted-foreground uppercase tracking-wide",
									children: "Required Pressure Vessel Capacity"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-baseline gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[52px] font-black tracking-tight text-[#0A7BC7]",
										children: results.volume.toFixed(1)
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-lg font-bold text-slate-500",
										children: "Liters"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[13px] text-muted-foreground max-w-md mt-2",
									children: "The recommended vessel volume is calculated using a constant factor of 16.5 based on motor starts, system pressures, and pump discharge volumes."
								})
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border-b border-slate-100 dark:border-zinc-800/80 px-4 py-3.5 bg-slate-50/50 dark:bg-zinc-900/30 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
								children: "FORMULAS AND ENGINEERING CRITERIA"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-5 space-y-4 text-[13px] leading-relaxed text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-bold text-foreground mb-1",
								children: "Preload Pressure calculation (Pc):"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
								className: "block bg-slate-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-border/80 text-[12px] font-semibold text-slate-700 dark:text-zinc-300",
								children: "Pc = Pa - 0.2 bar"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-bold text-foreground mb-1",
									children: "Vessel Sizing Formula:"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "block bg-slate-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-border/80 text-[12px] font-semibold text-slate-700 dark:text-zinc-300",
									children: "Volume = 16.5 × (Q × Pp × Pa) ÷ (Zmax × (Pp - Pa) × Pc)"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[11.5px] mt-2 space-y-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
											"• ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "text-foreground",
												children: "Q:"
											}),
											" Pump discharge volume (L/min)"
										] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
											"• ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "text-foreground",
												children: "Pp:"
											}),
											" Absolute cut-out stop pressure (bar)"
										] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
											"• ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "text-foreground",
												children: "Pa:"
											}),
											" Absolute cut-in start pressure (bar)"
										] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
											"• ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "text-foreground",
												children: "Pc:"
											}),
											" Absolute gas preload pressure (bar)"
										] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
											"• ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "text-foreground",
												children: "Zmax:"
											}),
											" Maximum allowable pump starts per hour"
										] })
									]
								})
							] })]
						})]
					})]
				})]
			})
		})
	});
}
//#endregion
export { PressureVesselPage as component };
