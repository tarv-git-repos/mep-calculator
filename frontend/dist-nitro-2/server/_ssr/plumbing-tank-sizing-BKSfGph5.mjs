import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, Mt as Calculator, Y as Info, gt as Download, ht as Droplet } from "../_libs/lucide-react.mjs";
import { r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-tank-sizing-BKSfGph5.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
var import_excel = /* @__PURE__ */ __toESM(require_excel());
var saveAs = import_FileSaver_min.default.saveAs || import_FileSaver_min.default;
function TankSizingPage() {
	const { userData, profile } = useAuth();
	userData?.name || profile?.name;
	const { project, forceSaveToCloud } = useWorkspace();
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	const [daily, setDaily] = (0, import_react.useState)(5e3);
	const [days, setDays] = (0, import_react.useState)(1);
	const [peak, setPeak] = (0, import_react.useState)(40);
	const [pump, setPump] = (0, import_react.useState)(30);
	(0, import_react.useEffect)(() => {
		if (!project?.id) return;
		if (project) {
			const saved = localStorage.getItem(`tankSizing_${project.id}`);
			if (saved) try {
				const p = JSON.parse(saved);
				setDaily(p.daily ?? 5e3);
				setDays(p.days ?? 1);
				setPeak(p.peak ?? 40);
				setPump(p.pump ?? 30);
			} catch (e) {
				console.error("Failed to parse saved Tank Sizing data:", e);
			}
			if (project?.id) setLoadedProjectId(project.id);
			else setLoadedProjectId("loaded");
		}
	}, [project]);
	const hc = (setter) => (e) => {
		setter(parseFloat(e.target.value) || 0);
		dirtyStore.set(true);
	};
	const saveCalc = () => {
		if (!project) {
			alert("No project selected.");
			return;
		}
		const data = {
			daily,
			days,
			peak,
			pump
		};
		localStorage.setItem(`tankSizing_${project.id}`, JSON.stringify(data));
		dirtyStore.set(false);
		if (forceSaveToCloud) forceSaveToCloud();
		alert("Tank Sizing calculation saved successfully.");
	};
	const storage = daily * days;
	const breakTank = peak * 30;
	const recommended = Math.max(storage, breakTank);
	const fillTime = pump > 0 ? recommended / pump : 0;
	const exportToExcel = async () => {
		const wb = new import_excel.default.Workbook();
		const ws = wb.addWorksheet("Tank Sizing");
		ws.mergeCells("A1:E1");
		ws.getCell("A1").value = "TANK SIZING CALCULATION REPORT";
		ws.getCell("A1").font = {
			name: "Segoe UI",
			size: 14,
			bold: true,
			color: { argb: "FFFFFFFF" }
		};
		ws.getCell("A1").fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FF10B981" }
		};
		ws.getCell("A1").alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		ws.addRow([]);
		ws.addRow([
			"PARAMETER",
			"VALUE",
			"UNIT",
			"FORMULA",
			"DESCRIPTION"
		]);
		const headerRow = ws.getRow(3);
		headerRow.font = {
			name: "Segoe UI",
			size: 10,
			bold: true,
			color: { argb: "FFFFFFFF" }
		};
		headerRow.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FF374151" }
		};
		headerRow.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		[
			[
				"Daily Water Demand",
				daily,
				"gal",
				"User Input",
				"Total estimated daily demand"
			],
			[
				"Storage Duration",
				days,
				"days",
				"User Input",
				"Number of days for storage"
			],
			[
				"Peak Flow Rate",
				peak,
				"GPM",
				"User Input",
				"Peak instantaneous flow rate"
			],
			[
				"Pump Fill Rate",
				pump,
				"GPM",
				"User Input",
				"Rate at which the tank is filled"
			],
			[
				"Storage Volume",
				storage,
				"gal",
				"Daily  Days",
				"Volume needed for steady consumption"
			],
			[
				"Break Tank (30-min peak)",
				breakTank,
				"gal",
				"Peak  30",
				"Volume needed for 30 minutes of peak flow"
			],
			[
				"Recommended Capacity",
				recommended,
				"gal",
				"Max(Storage, Break)",
				"Recommended tank capacity"
			],
			[
				"Pump Fill Time",
				fillTime.toFixed(1),
				"min",
				"Capacity / Pump Rate",
				"Time to fill the tank from empty"
			]
		].forEach((row) => {
			const added = ws.addRow(row);
			added.font = {
				name: "Segoe UI",
				size: 10
			};
		});
		ws.getColumn(1).width = 30;
		ws.getColumn(2).width = 15;
		ws.getColumn(3).width = 10;
		ws.getColumn(4).width = 25;
		ws.getColumn(5).width = 45;
		const buf = await wb.xlsx.writeBuffer();
		saveAs(new Blob([buf]), "Tank_Sizing.xlsx");
	};
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				daily,
				days,
				peak,
				pump
			};
			localStorage.setItem(`tankSizing_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		daily,
		days,
		peak,
		pump
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Domestic Water Tank Sizing",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-4xl mx-auto space-y-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "text-2xl font-bold text-slate-800 flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Droplet, { className: "w-6 h-6 text-emerald-500" }), "Tank Sizing"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: exportToExcel,
							className: "flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "w-4 h-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: saveCalc,
							className: "flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "w-4 h-4" }), "Save Calculation"]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-800 text-sm",
					children: "Calculate required water storage tank capacity based on daily demand, peak flow, and storage duration. Uses Storage Demand Method."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 md:grid-cols-2 gap-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-emerald-500 p-4 border-b border-emerald-600 flex items-center gap-2 text-white",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "w-5 h-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-semibold",
								children: "Inputs"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-5 space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-sm font-medium text-slate-700",
										children: "Daily Water Demand (gal)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none",
										value: daily,
										onChange: hc(setDaily)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-sm font-medium text-slate-700",
										children: "Storage Duration (days)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										step: "0.5",
										className: "px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none",
										value: days,
										onChange: hc(setDays)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-sm font-medium text-slate-700",
										children: "Peak Flow Rate (GPM)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none",
										value: peak,
										onChange: hc(setPeak)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-sm font-medium text-slate-700",
										children: "Pump Fill Rate (GPM)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none",
										value: pump,
										onChange: hc(setPump)
									})]
								})
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-emerald-600 p-4 border-b border-emerald-700 flex items-center gap-2 text-white",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calculator, { className: "w-5 h-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-semibold",
								children: "Tank Sizing Result"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-5 space-y-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-slate-50 p-4 rounded-lg border border-emerald-200 text-center shadow-inner",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1",
										children: "Recommended Capacity"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-3xl font-black text-emerald-700",
										children: recommended.toLocaleString()
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-sm text-emerald-600 font-medium mt-1",
										children: "Gallons"
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-2 border-b border-slate-100",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sm text-slate-600",
											children: "Storage Volume"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-bold text-slate-800",
											children: [storage.toLocaleString(), " gal"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-2 border-b border-slate-100",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sm text-slate-600",
											children: "Break Tank (30-min peak)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-bold text-slate-800",
											children: [breakTank.toLocaleString(), " gal"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-2 border-b border-slate-100",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sm text-slate-600",
											children: "Pump Fill Time"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-bold text-slate-800",
											children: [fillTime.toFixed(1), " min"]
										})]
									})
								]
							})]
						})]
					})]
				})
			]
		})
	});
}
//#endregion
export { TankSizingPage as component };
