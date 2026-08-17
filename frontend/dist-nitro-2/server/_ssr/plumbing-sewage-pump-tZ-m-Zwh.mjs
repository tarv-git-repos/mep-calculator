import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-Ct3ePlL1.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, Nt as Calculator, Y as Info, _t as Download } from "../_libs/lucide-react.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-urg-0zDa.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-sewage-pump-tZ-m-Zwh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
var import_excel = /* @__PURE__ */ __toESM(require_excel());
var saveAs = import_FileSaver_min.default.saveAs || import_FileSaver_min.default;
function SewagePumpPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	const [inflow, setInflow] = (0, import_react.useState)(30);
	const [cycle, setCycle] = (0, import_react.useState)(5);
	const [starts, setStarts] = (0, import_react.useState)(6);
	const [lift, setLift] = (0, import_react.useState)(15);
	const [hf, setHf] = (0, import_react.useState)(5);
	const [sf, setSf] = (0, import_react.useState)(20);
	(0, import_react.useEffect)(() => {
		if (!project?.id) return;
		if (project) {
			const saved = localStorage.getItem(`sewagePump_${project.id}`);
			if (saved) try {
				const p = JSON.parse(saved);
				setInflow(p.inflow ?? 30);
				setCycle(p.cycle ?? 5);
				setStarts(p.starts ?? 6);
				setLift(p.lift ?? 15);
				setHf(p.hf ?? 5);
				setSf(p.sf ?? 20);
			} catch (e) {
				console.error("Failed to parse saved Sewage Pump data:", e);
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
			inflow,
			cycle,
			starts,
			lift,
			hf,
			sf
		};
		localStorage.setItem(`sewagePump_${project.id}`, JSON.stringify(data));
		dirtyStore.set(false);
		if (forceSaveToCloud) forceSaveToCloud();
		alert("Sewage Pump calculation saved successfully.");
	};
	const pumpGpm = inflow * 2;
	const tdh = (lift + hf) * (1 + sf / 100);
	const activeVolume = pumpGpm * cycle / 4;
	const powerKW = pumpGpm * tdh * .7457 / (3960 * .55);
	const exportToExcel = async () => {
		const wb = new import_excel.default.Workbook();
		const ws = wb.addWorksheet("Sewage Pump Sizing");
		ws.mergeCells("A1:E1");
		ws.getCell("A1").value = "SEWAGE PUMP SIZING CALCULATION REPORT";
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
				"Peak Sewage Inflow",
				inflow,
				"GPM",
				"User Input",
				"Average inflow rate"
			],
			[
				"Cycle Time",
				cycle,
				"min",
				"User Input",
				"Desired pump cycle time"
			],
			[
				"Pump Duty Capacity",
				pumpGpm.toFixed(1),
				"GPM",
				"Q_inflow  2",
				"Required pump flow rate to draw down well"
			],
			[
				"Static Lift",
				lift,
				"ft",
				"User Input",
				"Invert to discharge elevation difference"
			],
			[
				"Friction Head",
				hf,
				"ft",
				"User Input",
				"Friction losses in piping"
			],
			[
				"Safety Factor",
				sf,
				"%",
				"User Input",
				"Additional margin for head"
			],
			[
				"Total Dynamic Head (TDH)",
				tdh.toFixed(1),
				"ft",
				"(Lift + Hf)  (1 + SF/100)",
				"Total calculated head for pump"
			],
			[
				"Wet Well Active Volume",
				activeVolume.toFixed(1),
				"Gal",
				"(Q_pump  Cycle) / 4",
				"Required active storage volume"
			],
			[
				"Motor Power",
				powerKW.toFixed(2),
				"kW",
				"Q  H  0.7457 / (3960  )",
				"Estimated electrical power (55% eff)"
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
		ws.getColumn(4).width = 30;
		ws.getColumn(5).width = 40;
		const buf = await wb.xlsx.writeBuffer();
		saveAs(new Blob([buf]), "Sewage_Pump_Sizing.xlsx");
	};
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				inflow,
				cycle,
				starts,
				lift,
				hf,
				sf
			};
			localStorage.setItem(`sewagePump_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		inflow,
		cycle,
		starts,
		lift,
		hf,
		sf
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Sewage Pump Sizing",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-4xl mx-auto space-y-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "text-2xl font-bold text-slate-800 flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calculator, { className: "w-6 h-6 text-emerald-500" }), "Sewage Pump Sizing"]
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
					children: "Size sewage ejector or submersible sump pump for basement or low-level drainage. Calculates required pump capacity, sump volume, and cycle time."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 md:grid-cols-2 gap-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-emerald-500 p-4 border-b border-emerald-600 flex items-center gap-2 text-white",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "w-5 h-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-semibold",
								children: "Flow & Sump Inputs"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-5 space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-sm font-medium text-slate-700",
										children: "Peak sewage inflow rate (GPM)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none",
										value: inflow,
										onChange: hc(setInflow)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-sm font-medium text-slate-700",
										children: "Desired pump cycle time (minutes)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										step: "0.5",
										className: "px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none",
										value: cycle,
										onChange: hc(setCycle)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-sm font-medium text-slate-700",
										children: "Minimum starts per hour (max)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "1",
										max: "20",
										className: "px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none",
										value: starts,
										onChange: hc(setStarts)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-sm font-medium text-slate-700",
										children: "Static lift (invert to discharge) (ft)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none",
										value: lift,
										onChange: hc(setLift)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-sm font-medium text-slate-700",
										children: "Friction head in discharge pipe (ft)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none",
										value: hf,
										onChange: hc(setHf)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-sm font-medium text-slate-700",
										children: "Safety factor (%)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none",
										value: sf,
										onChange: hc(setSf)
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
								children: "Pump Duty & Results"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-5 space-y-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-slate-50 p-4 rounded-lg border border-slate-100 text-center",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs font-bold text-slate-400 uppercase tracking-wider mb-1",
											children: "Capacity"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-2xl font-black text-emerald-600",
											children: pumpGpm.toFixed(1)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs text-slate-500 font-medium",
											children: "GPM"
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-slate-50 p-4 rounded-lg border border-slate-100 text-center",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs font-bold text-slate-400 uppercase tracking-wider mb-1",
											children: "Total Head"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-2xl font-black text-emerald-600",
											children: tdh.toFixed(1)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs text-slate-500 font-medium",
											children: "ft w.g."
										})
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-slate-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-sm text-slate-600",
										children: "Wet Well Active Vol."
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-bold text-slate-800",
										children: [activeVolume.toFixed(1), " Gal"]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-slate-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-sm text-slate-600",
										children: "Motor Power"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-bold text-slate-800",
										children: [powerKW.toFixed(2), " kW"]
									})]
								})]
							})]
						})]
					})]
				})
			]
		})
	});
}
//#endregion
export { SewagePumpPage as component };
