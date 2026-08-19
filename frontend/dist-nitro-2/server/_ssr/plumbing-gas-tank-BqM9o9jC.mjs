import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, Mt as Calculator, Y as Info, gt as Download, st as Flame } from "../_libs/lucide-react.mjs";
import { r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-gas-tank-BqM9o9jC.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
var import_excel = /* @__PURE__ */ __toESM(require_excel());
var saveAs = import_FileSaver_min.default.saveAs || import_FileSaver_min.default;
function GasTankPage() {
	const { userData, profile } = useAuth();
	userData?.name || profile?.name;
	const { project, forceSaveToCloud } = useWorkspace();
	const [gasType, setGasType] = (0, import_react.useState)("ng");
	const [resDemandConst, setResDemandConst] = (0, import_react.useState)(.19);
	const [resKitchens, setResKitchens] = (0, import_react.useState)(0);
	const [retDemandConst, setRetDemandConst] = (0, import_react.useState)(52);
	const [retKitchens, setRetKitchens] = (0, import_react.useState)(0);
	const [storageCapacity, setStorageCapacity] = (0, import_react.useState)(3e4);
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (project?.id) {
			try {
				const saved = localStorage.getItem(`gasTank_${project.id}`);
				if (saved) {
					const p = JSON.parse(saved);
					setGasType(p.gasType || "ng");
					setResDemandConst(p.resDemandConst ?? .19);
					setResKitchens(p.resKitchens ?? 0);
					setRetDemandConst(p.retDemandConst ?? 52);
					setRetKitchens(p.retKitchens ?? 0);
					setStorageCapacity(p.storageCapacity ?? 3e4);
				}
			} catch (e) {
				console.error("Failed to parse saved Gas Tank data:", e);
			}
			setLoadedProjectId(project.id);
		}
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const data = {
				gasType,
				resDemandConst,
				resKitchens,
				retDemandConst,
				retKitchens,
				storageCapacity
			};
			localStorage.setItem(`gasTank_${project.id}`, JSON.stringify(data));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		gasType,
		resDemandConst,
		resKitchens,
		retDemandConst,
		retKitchens,
		storageCapacity
	]);
	const hc = (setter) => (e) => {
		setter(parseFloat(e.target.value) || 0);
		dirtyStore.set(true);
	};
	const handleGasType = (type) => {
		setGasType(type);
		dirtyStore.set(true);
	};
	const saveCalc = () => {
		if (!project?.id) {
			alert("No project selected.");
			return;
		}
		const data = {
			gasType,
			resDemandConst,
			resKitchens,
			retDemandConst,
			retKitchens,
			storageCapacity
		};
		localStorage.setItem(`gasTank_${project.id}`, JSON.stringify(data));
		dirtyStore.set(false);
		if (forceSaveToCloud) forceSaveToCloud();
		alert("Gas Tank calculation saved successfully.");
	};
	const resConsumption = resKitchens * resDemandConst;
	const retConsumption = retKitchens * retDemandConst;
	const totalDemandNg = (resConsumption + retConsumption) * 1e3;
	const totalDemandLpg = totalDemandNg / 2.67;
	const activeDemand = gasType === "ng" ? totalDemandNg : totalDemandLpg;
	const tankCapacity = activeDemand / .7;
	const usableGas = tankCapacity * .7 * .8;
	const exportToExcel = async () => {
		const wb = new import_excel.default.Workbook();
		const ws = wb.addWorksheet("Gas Storage Sizing");
		ws.mergeCells("A1:E1");
		ws.getCell("A1").value = "GAS STORAGE TANK CAPACITY SIZING REPORT";
		ws.getCell("A1").font = {
			name: "Segoe UI",
			size: 14,
			bold: true,
			color: { argb: "FFFFFFFF" }
		};
		ws.getCell("A1").fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFF39632" }
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
			"FORMULA / REFERENCE",
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
			fgColor: { argb: "FF334155" }
		};
		headerRow.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		[
			[
				"Gas Type Selected",
				gasType === "ng" ? "Natural Gas" : "LPG Gas",
				"-",
				"User Choice",
				"Primary fuel system selection"
			],
			[
				"Residential Kitchens",
				resKitchens,
				"Nos.",
				"User Input",
				"Total number of residential units"
			],
			[
				"Consumption per Res. Kitchen",
				resDemandConst,
				"m3/day",
				"Engineering Constant",
				"Average daily consumption per unit"
			],
			[
				"Total Residential Consumption",
				resConsumption,
				"m3/day",
				"Kitchens  Constant",
				"Daily volumetric demand (Residential)"
			],
			[
				"Retail Kitchens (F&B)",
				retKitchens,
				"Nos.",
				"User Input",
				"Total number of retail food & beverage kitchens"
			],
			[
				"Consumption per Retail Kitchen",
				retDemandConst,
				"m3/day",
				"Engineering Constant",
				"Average daily demand per commercial kitchen"
			],
			[
				"Total Retail Consumption",
				retConsumption,
				"m3/day",
				"Kitchens  Constant",
				"Daily volumetric demand (Retail)"
			],
			[
				"Total Gas Demand (Natural Gas)",
				totalDemandNg.toFixed(1),
				"L/day",
				"(Res + Ret)  1000",
				"Combined natural gas volumetric requirement"
			],
			[
				"Total Gas Demand (LPG Gas)",
				totalDemandLpg.toFixed(1),
				"L/day",
				"NG Demand / 2.67",
				"LPG equivalent volumetric daily demand"
			],
			[
				"Active Total Gas Demand",
				activeDemand.toFixed(1),
				"L/day",
				"Based on Gas Selection",
				"Volumetric daily demand of the chosen fuel type"
			],
			[
				"Gas Tank Capacity (70% Usable)",
				tankCapacity.toFixed(1),
				"L/week",
				"Active Demand / 0.7",
				"Recommended weekly storage tank size"
			],
			[
				"Installed Storage Capacity",
				storageCapacity,
				"Litres",
				"User Input",
				"Actual physical volume of the selected tank"
			],
			[
				"Usable Gas from Tank",
				usableGas.toFixed(1),
				"Litres",
				"Tank Capacity  0.7  0.8",
				"70% usable volume, 20% refill reserve retained"
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
		ws.getColumn(5).width = 45;
		const buf = await wb.xlsx.writeBuffer();
		saveAs(new Blob([buf]), "Gas_Storage_Tank_Capacity_Calculation_Report.xlsx");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Gas Storage Capacity",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-4xl mx-auto space-y-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "text-2xl font-bold text-slate-800 flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "w-6 h-6 text-[#0A7BC7]" }), "Gas Storage Tank Sizing"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: exportToExcel,
							className: "flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "w-4 h-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: saveCalc,
							className: "flex items-center gap-2 px-4 py-2 bg-[#06456F] text-white rounded-lg hover:bg-orange-700 transition-colors font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "w-4 h-4" }), "Save Calculation"]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "bg-blue-50/40 border border-blue-100 rounded-lg p-4 text-[#06456F] text-sm",
					children: "Calculate required gas storage tank capacity and sizing based on residential and retail kitchen average daily demand, with support for Natural Gas and LPG options."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 lg:grid-cols-2 gap-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-[#0A7BC7] p-4 border-b border-orange-600 flex items-center gap-2 text-white",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "w-5 h-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "font-semibold",
										children: "Select Gas Type"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "p-5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => handleGasType("ng"),
											className: `flex-1 py-2 px-4 rounded-lg border-2 font-semibold transition-all ${gasType === "ng" ? "border-[#0A7BC7] bg-blue-50/40 text-orange-700" : "border-slate-200 bg-white text-slate-500 hover:border-blue-100"}`,
											children: "Natural Gas"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => handleGasType("lpg"),
											className: `flex-1 py-2 px-4 rounded-lg border-2 font-semibold transition-all ${gasType === "lpg" ? "border-[#0A7BC7] bg-blue-50/40 text-orange-700" : "border-slate-200 bg-white text-slate-500 hover:border-blue-100"}`,
											children: "LPG"
										})]
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "bg-[#0A7BC7] p-4 border-b border-orange-600 flex items-center gap-2 text-white justify-between",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calculator, { className: "w-5 h-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
											className: "font-semibold",
											children: "Consumption (Kitchens)"
										})]
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-5 space-y-5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center pb-2 border-b border-slate-100",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs font-bold text-slate-400 uppercase tracking-wider",
												children: "Residential Kitchens"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2 text-sm text-slate-600",
												children: [
													"Res. Constant:",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														step: "0.01",
														className: "w-16 px-1 py-0.5 border border-slate-300 rounded text-center outline-none focus:border-orange-400",
														value: resDemandConst,
														onChange: hc(setResDemandConst)
													}),
													"m³/day"
												]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-sm font-medium text-slate-700",
												children: "Number of Kitchens (Residential)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: "0",
												className: "px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A7BC7] focus:border-[#0A7BC7] outline-none",
												value: resKitchens,
												onChange: hc(setResKitchens)
											})]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-3 pt-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center pb-2 border-b border-slate-100",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs font-bold text-slate-400 uppercase tracking-wider",
												children: "Retail Food & Beverage"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2 text-sm text-slate-600",
												children: [
													"Retail Constant:",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														className: "w-16 px-1 py-0.5 border border-slate-300 rounded text-center outline-none focus:border-orange-400",
														value: retDemandConst,
														onChange: hc(setRetDemandConst)
													}),
													"m³/day"
												]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-sm font-medium text-slate-700",
												children: "Number of Kitchens (F&B Retail)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: "0",
												className: "px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A7BC7] focus:border-[#0A7BC7] outline-none",
												value: retKitchens,
												onChange: hc(setRetKitchens)
											})]
										})]
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-[#0A7BC7] p-4 border-b border-orange-600 flex items-center gap-2 text-white",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calculator, { className: "w-5 h-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "font-semibold",
										children: "Storage Settings"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "p-5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "text-sm font-medium text-slate-700",
											children: "Storage Capacity (Installed Tank) (Litres)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											min: "0",
											className: "px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A7BC7] focus:border-[#0A7BC7] outline-none",
											value: storageCapacity,
											onChange: hc(setStorageCapacity)
										})]
									})
								})]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "bg-[#06456F] p-4 border-b border-orange-700 flex items-center justify-center text-white",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-bold text-lg",
								children: "Project Results Panel"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-slate-50 p-4 rounded-lg border border-slate-100 text-center",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2",
												children: "Res. Gas Consumption"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-xl font-black text-[#0A7BC7]",
												children: resConsumption.toFixed(2)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[11px] text-slate-500 font-medium mt-1",
												children: "m³/day"
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-slate-50 p-4 rounded-lg border border-slate-100 text-center",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2",
												children: "Retail Gas Consumption"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-xl font-black text-[#0A7BC7]",
												children: retConsumption.toFixed(2)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[11px] text-slate-500 font-medium mt-1",
												children: "m³/day"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 bg-blue-50/40 p-5 rounded-lg border border-blue-100 text-center shadow-inner",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[10px] font-bold text-orange-700 uppercase tracking-wider mb-2",
											children: [
												"Total Gas Demand (",
												gasType === "ng" ? "Natural Gas" : "LPG Gas",
												")"
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-3xl font-black text-[#06456F]",
											children: activeDemand.toFixed(1)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs text-orange-700 font-medium mt-2",
											children: "L/day"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-4 mt-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "bg-slate-50 p-4 rounded-lg border border-slate-100 text-center",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2",
													children: "Gas Tank Capacity"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-xl font-black text-slate-800",
													children: tankCapacity.toFixed(1)
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[11px] text-slate-500 font-medium mt-1",
													children: "L/week"
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "bg-slate-50 p-4 rounded-lg border border-slate-100 text-center",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2",
													children: "Storage Capacity"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-xl font-black text-slate-800",
													children: storageCapacity.toLocaleString()
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[11px] text-slate-500 font-medium mt-1",
													children: "Litres"
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "col-span-2 bg-sky-50 p-4 rounded-lg border border-sky-100 text-center",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[10px] font-bold text-sky-700 uppercase tracking-wider mb-2",
													children: "Usable Gas From Tank"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-2xl font-black text-sky-600",
													children: usableGas.toFixed(1)
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[11px] text-sky-600 font-medium mt-1",
													children: "Litres"
												})
											]
										})
									]
								})
							]
						})]
					})]
				})
			]
		})
	});
}
//#endregion
export { GasTankPage as component };
