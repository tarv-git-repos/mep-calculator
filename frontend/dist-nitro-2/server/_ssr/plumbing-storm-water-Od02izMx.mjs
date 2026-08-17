import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-Ct3ePlL1.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, Nt as Calculator, Y as Info, m as Trash2 } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-urg-0zDa.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-storm-water-Od02izMx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
require_excel();
import_FileSaver_min.default.saveAs;
var SURFACE_COEFS = {
	"asphalt": .95,
	"brick": .85,
	"concrete": .95,
	"sandy_soil": .2,
	"clay_soil": .85,
	"agricultural": .3
};
var SURFACE_LABELS = {
	"asphalt": "Asphalt (0.95)",
	"brick": "Brick (0.85)",
	"concrete": "Concrete (0.95)",
	"sandy_soil": "Sandy Soil (0.20)",
	"clay_soil": "Clay Soil (0.85)",
	"agricultural": "Agricultural (0.30)"
};
function StormWaterPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("si");
	const [rows, setRows] = (0, import_react.useState)([{
		id: "1",
		name: "Main Roof Area",
		area: 1200,
		surface: "concrete",
		coef: .95,
		intensity: 50
	}, {
		id: "2",
		name: "Pool Deck",
		area: 450,
		surface: "brick",
		coef: .85,
		intensity: 50
	}]);
	const [newName, setNewName] = (0, import_react.useState)("New Catchment");
	const [newArea, setNewArea] = (0, import_react.useState)("500");
	const [newSurface, setNewSurface] = (0, import_react.useState)("concrete");
	const [newIntensity, setNewIntensity] = (0, import_react.useState)("50");
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!project?.id) return;
		try {
			const stored = localStorage.getItem(`mep_storm_water_calc_${project.id}`);
			if (stored) {
				const data = JSON.parse(stored);
				if (data.rows) setRows(data.rows);
				if (data.unitSystem) setUnitSystem(data.unitSystem);
			} else {
				setRows([{
					id: "1",
					name: "Main Roof Area",
					area: 1200,
					surface: "concrete",
					coef: .95,
					intensity: 50
				}, {
					id: "2",
					name: "Pool Deck",
					area: 450,
					surface: "brick",
					coef: .85,
					intensity: 50
				}]);
				setUnitSystem("si");
			}
		} catch (e) {
			console.error(e);
		}
		setLoadedProjectId(project.id);
	}, [project?.id]);
	const saveState = (updatedRows = rows, updatedUnit = unitSystem) => {
		try {
			localStorage.setItem(`mep_storm_water_calc_${project.id}`, JSON.stringify({
				rows: updatedRows,
				unitSystem: updatedUnit
			}));
		} catch (e) {
			console.error(e);
		}
	};
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				unitSystem,
				rows,
				newName,
				newArea,
				newSurface,
				newIntensity
			};
			localStorage.setItem(`mep_storm_water_calc_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		unitSystem,
		rows,
		newName,
		newArea,
		newSurface,
		newIntensity
	]);
	const handleSave = () => {
		saveState();
		dirtyStore.set(false);
		if (forceSaveToCloud) forceSaveToCloud();
		toast.success("Storm water calculation saved successfully!");
	};
	const handleAddRow = () => {
		const areaVal = parseFloat(newArea) || 0;
		const intensityVal = parseFloat(newIntensity) || 0;
		const coef = SURFACE_COEFS[newSurface] || .9;
		if (areaVal <= 0) {
			toast.error("Please enter a valid area.");
			return;
		}
		if (intensityVal <= 0) {
			toast.error("Please enter a valid rainfall intensity.");
			return;
		}
		const newRow = {
			id: Math.random().toString(36).substring(2, 9),
			name: newName,
			area: areaVal,
			surface: newSurface,
			coef,
			intensity: intensityVal
		};
		const updated = [...rows, newRow];
		setRows(updated);
		saveState(updated);
		dirtyStore.set(true);
		toast.success("Catchment area added.");
	};
	const handleDeleteRow = (id) => {
		const updated = rows.filter((r) => r.id !== id);
		setRows(updated);
		saveState(updated);
		dirtyStore.set(true);
	};
	const handleClearAll = () => {
		setRows([]);
		saveState([]);
		dirtyStore.set(true);
	};
	const calculatedResults = (0, import_react.useMemo)(() => {
		const isIp = unitSystem === "ip";
		let totalArea = 0;
		let weightedSumC = 0;
		let totalFlow = 0;
		const items = rows.map((r) => {
			const areaSI = r.area / (isIp ? 10.7639 : 1);
			const intensitySI = r.intensity * (isIp ? 25.4 : 1);
			const flowSI = r.coef * intensitySI * areaSI / 3600;
			totalArea += r.area;
			weightedSumC += r.coef * r.area;
			totalFlow += flowSI;
			const flowVal = flowSI * (isIp ? 15.85 : 1);
			return {
				...r,
				flow: flowVal
			};
		});
		const avgC = totalArea > 0 ? weightedSumC / totalArea : 0;
		const finalFlow = totalFlow * (isIp ? 15.85 : 1);
		return {
			items,
			totalArea,
			avgC,
			totalFlow: finalFlow
		};
	}, [rows, unitSystem]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Storm Water Runoff Calculation",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-6 max-w-7xl mx-auto space-y-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex justify-between items-center bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2 z-10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "text-3xl font-extrabold flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calculator, { className: "w-8 h-8 text-[#0A7BC7]" }), "Storm Water Runoff Calculation"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-slate-300 text-sm",
						children: "Rational Method Sizing: Q = C × i × A / 3600"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3 z-10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setUnitSystem(unitSystem === "si" ? "ip" : "si"),
						className: "px-4 py-2 border border-slate-700 bg-slate-800/80 rounded-xl hover:bg-slate-700 transition text-xs font-bold uppercase cursor-pointer",
						children: [
							"Toggle Unit System (",
							unitSystem.toUpperCase(),
							")"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: handleSave,
						className: "flex items-center gap-2 px-4 py-2 bg-[#06456F] hover:bg-[#0A7BC7] text-white rounded-xl transition text-xs font-bold uppercase cursor-pointer border-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "w-4 h-4" }), "Save Calculation"]
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 lg:grid-cols-3 gap-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-lg font-bold text-slate-800 dark:text-zinc-200",
							children: "Runoff Schedule"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex gap-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleClearAll,
								className: "px-3 py-1.5 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 rounded-lg hover:bg-red-100 transition text-[12px] font-bold border-0 cursor-pointer",
								children: "Clear All"
							})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-x-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-left border-collapse text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-slate-200 dark:border-zinc-800 text-slate-400 font-bold",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2.5",
										children: "Name"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
										className: "py-2.5",
										children: [
											"Area (",
											unitSystem === "si" ? "m²" : "ft²",
											")"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2.5",
										children: "Surface"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2.5",
										children: "C"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
										className: "py-2.5",
										children: [
											"Intensity (",
											unitSystem === "si" ? "mm/hr" : "in/hr",
											")"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
										className: "py-2.5 text-right",
										children: [
											"Flow (",
											unitSystem === "si" ? "L/s" : "GPM",
											")"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2.5 text-center",
										children: "Action"
									})
								]
							}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
								className: "divide-y divide-slate-100 dark:divide-zinc-800 font-medium",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "bg-slate-50/50 dark:bg-zinc-800/20",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "py-2 px-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												value: newName,
												onChange: (e) => setNewName(e.target.value),
												className: "w-full h-8 px-2 border border-slate-200 dark:border-zinc-800 rounded bg-background"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "py-2 px-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												value: newArea,
												onChange: (e) => setNewArea(e.target.value),
												className: "w-20 h-8 px-2 border border-slate-200 dark:border-zinc-800 rounded bg-background text-right"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "py-2 px-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
												value: newSurface,
												onChange: (e) => setNewSurface(e.target.value),
												className: "w-32 h-8 px-1 border border-slate-200 dark:border-zinc-800 rounded bg-background",
												children: Object.keys(SURFACE_LABELS).map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: k,
													children: SURFACE_LABELS[k]
												}, k))
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "py-2 px-1 text-center font-bold text-slate-600 dark:text-zinc-400",
											children: SURFACE_COEFS[newSurface]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "py-2 px-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												value: newIntensity,
												onChange: (e) => setNewIntensity(e.target.value),
												className: "w-16 h-8 px-2 border border-slate-200 dark:border-zinc-800 rounded bg-background text-right"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "py-2 px-1 text-right font-bold text-slate-400",
											children: "-"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "py-2 px-1 text-center",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: handleAddRow,
												className: "p-1 px-2.5 bg-[#06456F] hover:bg-[#0A7BC7] text-white rounded text-[11px] font-bold border-0 cursor-pointer",
												children: "Add"
											})
										})
									]
								}), calculatedResults.items.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-3 font-semibold text-slate-800 dark:text-zinc-200",
										children: row.name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-3",
										children: row.area.toFixed(1)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-3 text-slate-500 dark:text-zinc-400 capitalize",
										children: row.surface.replace("_", " ")
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-3 font-bold text-slate-700 dark:text-zinc-300",
										children: row.coef.toFixed(2)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-3",
										children: row.intensity.toFixed(1)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-3 text-right font-extrabold text-[#06456F] dark:text-sky-400",
										children: row.flow.toFixed(2)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-3 text-center",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => handleDeleteRow(row.id),
											className: "text-red-500 hover:text-red-700 bg-transparent border-0 cursor-pointer",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-4 h-4" })
										})
									})
								] }, row.id))]
							})]
						})
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-lg font-bold text-slate-800 dark:text-zinc-200 border-b border-slate-100 dark:border-zinc-800 pb-3",
							children: "Calculated Totals"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-3.5 text-sm font-medium",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-slate-50 dark:border-zinc-800",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-500 dark:text-zinc-400",
										children: "Total Catchments"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-extrabold text-slate-800 dark:text-zinc-200",
										children: rows.length
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-slate-50 dark:border-zinc-800",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-500 dark:text-zinc-400",
										children: "Total Runoff Area"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-extrabold text-slate-800 dark:text-zinc-200",
										children: [
											calculatedResults.totalArea.toFixed(1),
											" ",
											unitSystem === "si" ? "m²" : "ft²"
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-slate-50 dark:border-zinc-800",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-500 dark:text-zinc-400",
										children: "Weighted Coef (C_avg)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-extrabold text-slate-800 dark:text-zinc-200",
										children: calculatedResults.avgC.toFixed(2)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-4 bg-blue-50/40 dark:bg-orange-950/20 border border-blue-100 dark:border-blue-900/40 rounded-2xl",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[11.5px] font-bold text-[#06456F] dark:text-sky-300 uppercase tracking-wider mb-1",
										children: "Total Runoff Flow"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-2xl font-extrabold text-[#06456F] dark:text-sky-400",
										children: [
											calculatedResults.totalFlow.toFixed(2),
											" ",
											unitSystem === "si" ? "L/s" : "GPM"
										]
									})]
								})
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 flex items-start gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "w-5 h-5 text-[#0A7BC7] shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5 text-xs text-slate-600 dark:text-zinc-400",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-bold text-slate-700 dark:text-zinc-300",
								children: "Engineering Standards:"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "leading-relaxed",
								children: "Based on the **Rational Method** for drainage design. Runoff coefficients range from 0.20 (sandy soil) up to 0.95 (asphalt / concrete surfaces)."
							})]
						})]
					})]
				})]
			})]
		})
	});
}
//#endregion
export { StormWaterPage as component };
