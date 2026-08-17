import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { M as Printer, gt as Download, l as Upload, nn as CircleQuestionMark } from "../_libs/lucide-react.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/chw-pump-head-BPKK75VN.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
require_excel();
import_FileSaver_min.default.saveAs;
function ChwPumpHeadPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	const [projectInfo, setProjectInfo] = (0, import_react.useState)({
		projectName: "Commercial Tower CHW Pumping Study",
		projectNumber: "MEP-CHW-02",
		client: "Summit Estates Ltd",
		consultant: "Consistent Engineering Consultants",
		date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
		revision: "Rev 0",
		calcNumber: "CALC-HVAC-PMP02",
		notes: "Chilled water secondary circulation loop pump head and fittings loss calculation report."
	});
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("si");
	const [sizingParams, setSizingParams] = (0, import_react.useState)({
		flowUsgpm: "",
		flowLps: "",
		vertLength: "",
		horizLength: "",
		frictionFactor: "",
		staticHead: "",
		residualPressure: "",
		suctionPressure: "",
		safetyFactorHead: 5,
		selectedHead: "",
		effMotor: 85,
		effPump: 70
	});
	const [activeTab, setActiveTab] = (0, import_react.useState)("calculator");
	const [showFormulaPanel, setShowFormulaPanel] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		try {
			const saved = localStorage.getItem("chw_pump_sizer_v2_params");
			if (saved) {
				const parsed = JSON.parse(saved);
				if (parsed.sizingParams) setSizingParams(parsed.sizingParams);
				if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
				if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
			}
		} catch (e) {
			console.error(e);
			if (project?.id) setLoadedProjectId(project.id);
			else setLoadedProjectId("loaded");
		}
	}, []);
	const saveParams = (params, unit, proj) => {
		setSizingParams(params);
		setUnitSystem(unit);
		if (window.__mep_keep_values) return;
		setProjectInfo(proj);
	};
	(0, import_react.useEffect)(() => {
		try {
			localStorage.setItem("chw_pump_sizer_v2_params", JSON.stringify({
				sizingParams,
				unitSystem,
				projectInfo
			}));
			dirtyStore.set(true);
		} catch (e) {
			console.error(e);
		}
	}, [
		sizingParams,
		unitSystem,
		projectInfo
	]);
	const handleUnitSystemChange = (unit) => {
		if (unit === unitSystem) return;
		const nextParams = { ...sizingParams };
		if (unit === "ip") {
			nextParams.vertLength = Number((sizingParams.vertLength * 3.28084).toFixed(1));
			nextParams.horizLength = Number((sizingParams.horizLength * 3.28084).toFixed(1));
			nextParams.frictionFactor = Number((sizingParams.frictionFactor * 4.4207).toFixed(3));
			nextParams.staticHead = Number((sizingParams.staticHead * 14.50377).toFixed(2));
			nextParams.residualPressure = Number((sizingParams.residualPressure * 14.50377).toFixed(2));
			nextParams.suctionPressure = Number((sizingParams.suctionPressure * 14.50377).toFixed(2));
			if (sizingParams.selectedHead > 0) nextParams.selectedHead = Number((sizingParams.selectedHead * 14.50377).toFixed(2));
		} else {
			nextParams.vertLength = Number((sizingParams.vertLength / 3.28084).toFixed(1));
			nextParams.horizLength = Number((sizingParams.horizLength / 3.28084).toFixed(1));
			nextParams.frictionFactor = Number((sizingParams.frictionFactor / 4.4207).toFixed(3));
			nextParams.staticHead = Number((sizingParams.staticHead / 14.50377).toFixed(2));
			nextParams.residualPressure = Number((sizingParams.residualPressure / 14.50377).toFixed(2));
			nextParams.suctionPressure = Number((sizingParams.suctionPressure / 14.50377).toFixed(2));
			if (sizingParams.selectedHead > 0) nextParams.selectedHead = Number((sizingParams.selectedHead / 14.50377).toFixed(2));
		}
		saveParams(nextParams, unit, projectInfo);
	};
	const calculatedData = (0, import_react.useMemo)(() => {
		const ip = unitSystem === "ip";
		const flowGpm = sizingParams.flowUsgpm !== "" ? Number(sizingParams.flowUsgpm) : ip ? 500 : 500;
		const vertL = sizingParams.vertLength !== "" ? Number(sizingParams.vertLength) : ip ? 100 : 30;
		const horizL = sizingParams.horizLength !== "" ? Number(sizingParams.horizLength) : ip ? 400 : 120;
		const ff = sizingParams.frictionFactor !== "" ? Number(sizingParams.frictionFactor) : ip ? 1.77 : .4;
		const statH = sizingParams.staticHead !== "" ? Number(sizingParams.staticHead) : ip ? 43.5 : 3;
		const resP = sizingParams.residualPressure !== "" ? Number(sizingParams.residualPressure) : ip ? 29 : 2;
		const sucP = sizingParams.suctionPressure !== "" ? Number(sizingParams.suctionPressure) : 0;
		const L_vert_m = ip ? vertL / 3.28084 : vertL;
		const L_horiz_m = ip ? horizL / 3.28084 : horizL;
		const Q_flow = flowGpm * 3.78 / 60;
		const L_elbows_m = (L_vert_m + L_horiz_m) * .3;
		const L_valves_m = (L_vert_m + L_horiz_m) * .3;
		const L_sum_m = L_vert_m + L_horiz_m + L_elbows_m + L_valves_m;
		const L_equiv_m = Math.ceil(L_sum_m * 1.05 / 10) * 10;
		const H_loss_bar = L_equiv_m * ((ip ? ff / 4.4207 : ff) / 100);
		const H_static_bar = ip ? statH / 14.50377 : statH;
		const H_outlet_bar = ip ? resP / 14.50377 : resP;
		const H_suction_bar = ip ? sucP / 14.50377 : sucP;
		const H_pump_calc_bar = Math.max(0, H_loss_bar + H_static_bar + H_outlet_bar - H_suction_bar) * (1 + sizingParams.safetyFactorHead / 100);
		const rawSelected = Number(sizingParams.selectedHead) || 0;
		const H_selected_bar = rawSelected > 0 ? ip ? rawSelected / 14.50377 : rawSelected : H_pump_calc_bar;
		const F_flow = Q_flow;
		const L_lift_kpa = H_selected_bar * 100;
		const eff_pump = sizingParams.effPump / 100;
		const eff_motor = sizingParams.effMotor / 100;
		const P_shaft_kw = F_flow * L_lift_kpa / (1e3 * eff_pump);
		const P_motor_kw = P_shaft_kw / eff_motor;
		const HP = P_motor_kw * 1.34102;
		const displayLengthUnit = ip ? "ft" : "m";
		const displayHeadUnit = ip ? "psi" : "bar";
		const displayFlowUnit = ip ? "GPM" : "L/s";
		const toDisplayLength = (m) => ip ? m * 3.28084 : m;
		const toDisplayHead = (bar) => ip ? bar * 14.50377 : bar;
		const toDisplayFlow = (lps) => ip ? lps * 15.8503 : lps;
		return {
			flowRate: Q_flow,
			flowRateDisplay: ip ? sizingParams.flowUsgpm : toDisplayFlow(Q_flow),
			sumLengthsDisplay: toDisplayLength(L_sum_m),
			equivLengthDisplay: toDisplayLength(L_equiv_m),
			elbowsLengthDisplay: toDisplayLength(L_elbows_m),
			valvesLengthDisplay: toDisplayLength(L_valves_m),
			vertLengthDisplay: toDisplayLength(L_vert_m),
			horizLengthDisplay: toDisplayLength(L_horiz_m),
			frictionLossDisplay: toDisplayHead(H_loss_bar),
			staticHeadDisplay: toDisplayHead(H_static_bar),
			residualPressureDisplay: toDisplayHead(H_outlet_bar),
			outletHeadDisplay: toDisplayHead(H_outlet_bar),
			suctionPressureDisplay: toDisplayHead(H_suction_bar),
			suctionHeadDisplay: toDisplayHead(H_suction_bar),
			pumpHeadCalcDisplay: toDisplayHead(H_pump_calc_bar),
			pumpHeadSelectedDisplay: toDisplayHead(H_selected_bar),
			selectedHeadDisplay: toDisplayHead(H_selected_bar),
			massFlow: F_flow,
			liftKpa: L_lift_kpa,
			shaftPowerKw: P_shaft_kw,
			motorPowerKw: P_motor_kw,
			motorPowerHp: HP,
			lengthUnit: displayLengthUnit,
			headUnit: displayHeadUnit,
			flowUnit: displayFlowUnit
		};
	}, [sizingParams, unitSystem]);
	const handleExportJSON = () => {
		const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
			projectInfo,
			sizingParams,
			unitSystem
		}));
		const downloadAnchor = document.createElement("a");
		downloadAnchor.setAttribute("href", dataStr);
		downloadAnchor.setAttribute("download", `${projectInfo.projectName.replace(/\s+/g, "_")}_chw_pump_head.json`);
		document.body.appendChild(downloadAnchor);
		downloadAnchor.click();
		downloadAnchor.remove();
	};
	const handleImportJSON = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const parsed = JSON.parse(event.target?.result);
				if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
				if (parsed.sizingParams) setSizingParams(parsed.sizingParams);
				if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
			} catch (err) {
				alert("Failed to parse JSON file.");
			}
		};
		reader.readAsText(file);
	};
	const handlePrintPDF = () => {
		const doc = new import_jspdf_node_min.default("p", "pt", "a4");
		doc.setFont("helvetica", "bold");
		doc.setFontSize(18);
		doc.text("PUMP HEAD CALCULATION REPORT", 40, 50);
		doc.setFontSize(10);
		doc.setFont("helvetica", "normal");
		doc.setTextColor(100);
		doc.text(`Generated on: ${projectInfo.date} | Calculation Code: ${projectInfo.calcNumber}`, 40, 68);
		doc.setDrawColor(200);
		doc.line(40, 75, 550, 75);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(11);
		doc.setTextColor(0);
		doc.text("1. Project Details", 40, 95);
		autoTable(doc, {
			startY: 105,
			head: [],
			body: [
				[
					"Project Name",
					projectInfo.projectName,
					"Project Number",
					projectInfo.projectNumber
				],
				[
					"Consultant",
					projectInfo.consultant,
					"Client",
					projectInfo.client
				],
				[
					"Revision",
					projectInfo.revision,
					"Calculation Ref",
					projectInfo.calcNumber
				]
			],
			theme: "plain",
			styles: {
				fontSize: 9,
				cellPadding: 3
			},
			columnStyles: {
				0: {
					fontStyle: "bold",
					cellWidth: 90
				},
				1: { cellWidth: 170 },
				2: {
					fontStyle: "bold",
					cellWidth: 90
				},
				3: { cellWidth: 170 }
			}
		});
		doc.setFont("helvetica", "bold");
		doc.text("2. Design Sizing Parameters", 40, doc.lastAutoTable.finalY + 20);
		const paramData = [
			[
				"Design Flow Rate",
				`${calculatedData.flowRateDisplay.toFixed(2)} ${calculatedData.flowUnit}`,
				"Vertical Pipe Length",
				`${calculatedData.vertLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`
			],
			[
				"Horizontal Pipe Length",
				`${calculatedData.horizLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`,
				"Design Friction Factor",
				`${sizingParams.frictionFactor} ${unitSystem === "ip" ? "psi/100ft" : "bar/100m"}`
			],
			[
				"Static Elevation Head",
				`${calculatedData.staticHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`,
				"Residual Pressure at Outlet",
				`${calculatedData.outletHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`
			],
			[
				"Suction Pressure (Available)",
				`${calculatedData.suctionHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`,
				"Safety Margin applied",
				`${sizingParams.safetyFactorHead}%`
			]
		];
		autoTable(doc, {
			startY: doc.lastAutoTable.finalY + 30,
			head: [],
			body: paramData,
			theme: "striped",
			styles: {
				fontSize: 8.5,
				cellPadding: 3.5
			},
			columnStyles: {
				0: {
					fontStyle: "bold",
					cellWidth: 130
				},
				1: { cellWidth: 120 },
				2: {
					fontStyle: "bold",
					cellWidth: 130
				},
				3: { cellWidth: 120 }
			}
		});
		doc.setFont("helvetica", "bold");
		doc.text("3. Friction and Equivalent Length Breakdown", 40, doc.lastAutoTable.finalY + 20);
		const breakdownData = [
			["Vertical + Horizontal length sum", `${calculatedData.vertLengthDisplay.toFixed(1)} + ${calculatedData.horizLengthDisplay.toFixed(1)} = ${(calculatedData.vertLengthDisplay + calculatedData.horizLengthDisplay).toFixed(1)} ${calculatedData.lengthUnit}`],
			["Fittings equivalent allowance", `Elbows: ${calculatedData.elbowsLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit} | Valves: ${calculatedData.valvesLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`],
			["Total design equivalent length", `${calculatedData.equivLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`],
			["Major + Minor Friction losses", `${calculatedData.frictionLossDisplay.toFixed(3)} ${calculatedData.headUnit}`]
		];
		autoTable(doc, {
			startY: doc.lastAutoTable.finalY + 30,
			head: [],
			body: breakdownData,
			theme: "plain",
			styles: {
				fontSize: 8.5,
				cellPadding: 3.5
			},
			columnStyles: {
				0: {
					fontStyle: "bold",
					cellWidth: 180
				},
				1: { cellWidth: 320 }
			}
		});
		doc.setFont("helvetica", "bold");
		doc.text("4. Head & Motor Selection Sizing Results", 40, doc.lastAutoTable.finalY + 20);
		const resultsData = [
			["Piping Friction Loss head", `${calculatedData.frictionLossDisplay.toFixed(3)} ${calculatedData.headUnit}`],
			["Static Elevation Head lift", `${calculatedData.staticHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
			["Residual pressure required", `${calculatedData.outletHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
			["Suction pressure deducted", `-${calculatedData.suctionHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
			["Total dynamic Head (TDH)", `${calculatedData.pumpHeadCalcDisplay.toFixed(3)} ${calculatedData.headUnit}`],
			["Estimated motor power required", `${calculatedData.motorPowerKw.toFixed(2)} kW (${calculatedData.motorPowerHp.toFixed(2)} HP)`]
		];
		autoTable(doc, {
			startY: doc.lastAutoTable.finalY + 30,
			head: [],
			body: resultsData,
			theme: "striped",
			styles: {
				fontSize: 8.5,
				cellPadding: 3.5
			},
			columnStyles: {
				0: {
					fontStyle: "bold",
					cellWidth: 180
				},
				1: { cellWidth: 320 }
			}
		});
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), `${projectInfo.projectName.replace(/\s+/g, "_")}_report.pdf`, "PDF Document", ["pdf"]);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "CHW Pump Head",
		hideSubHeader: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-full min-h-0 bg-transparent font-sans",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-between items-start shrink-0 select-none no-print px-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1 w-full",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
								children: "HVAC > CHW PUMP HEAD"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center gap-3 mt-0.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex items-baseline gap-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
										className: "text-[28px] font-bold tracking-tight text-foreground font-sans",
										children: "Pump Head"
									})
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground mt-0.5",
								children: "Determine volumetric water requirements, dynamic piping losses, safety margin, and total dynamic head to size the pump motor."
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-6 mb-6 bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/60",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setActiveTab("calculator"),
								className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${activeTab === "calculator" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Sizing Calculator"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setActiveTab("report"),
								className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${activeTab === "report" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Printable Report"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => handleUnitSystemChange("ip"),
								className: `px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${unitSystem === "ip" ? "bg-background text-primary shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Imperial (IP)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => handleUnitSystemChange("si"),
								className: `px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${unitSystem === "si" ? "bg-background text-primary shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Metric (SI)"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex-1 min-h-0 animate-fade-in flex flex-col",
						children: activeTab === "calculator" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 min-h-0 flex flex-col relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative flex items-center justify-between gap-4 px-6 h-12 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
											children: "File Actions:"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
											onClick: handleExportJSON,
											className: "h-8.5 text-xs",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" }), " Export JSON"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "flex items-center gap-1.5 h-8.5 px-3 border border-border/80 hover:bg-surface-2 rounded-lg text-xs cursor-pointer font-semibold text-foreground select-none transition-all",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }),
												" Import JSON",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "file",
													onChange: handleImportJSON,
													accept: ".json",
													className: "hidden"
												})
											]
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										onClick: () => setShowFormulaPanel(!showFormulaPanel),
										className: "h-8.5 text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "size-3.5 text-primary" }), " Formula Reference"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										onClick: handlePrintPDF,
										primary: true,
										className: "h-8.5 text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-3.5" }), " Generate PDF Report"]
									})]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-950/20 flex flex-col gap-6",
								children: [showFormulaPanel && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm animate-slide-in flex flex-col gap-5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
										className: "font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-2.5 flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-1.5 h-3.5 bg-primary rounded-sm" }), "Features: CHW Pump Head Calculator"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
										className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-muted-foreground list-disc list-inside",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "All Keyboard shortcuts" }), ": Core navigation & hotkeys."] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Dynamic Equivalent Length" }), ": Dynamic 30% additions for elbows and valves."] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Static & Residual Head" }), ": Dynamic elevation lift, outlet pressure, and suction head subtraction."] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Selected Operating Head" }), ": Custom target head (defaults to calculated head if left blank)."] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Pump Motor Sizing" }), ": Safety factor, pump/motor efficiency metrics for kW/HP sizing."] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "SI / IP Dual Unit System" }), ": Dynamic Metric and Imperial unit conversion."] })
										]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "border-t border-border/40 pt-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
											className: "font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "size-4 text-primary" }), " Pump Head Formulas Reference"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-semibold block mb-1",
															children: "Design Flowrate (L/s):"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
															className: "text-primary block font-bold mb-1 font-mono text-[11px]",
															children: "Q = (Flow_GPM × 3.78) ÷ 60"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] text-muted-foreground",
															children: "Volumetric discharge flow converted to metric base."
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-semibold block mb-1",
															children: "Piping Equivalent length (m):"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
															className: "text-primary block font-bold mb-1 font-mono text-[11px]",
															children: "Leq = (L_vert + L_horiz) × 1.6"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] text-muted-foreground",
															children: "Fittings and valves dynamically added at 30% each."
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-semibold block mb-1",
															children: "Piping friction losses (bar):"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
															className: "text-primary block font-bold mb-1 font-mono text-[11px]",
															children: "H_loss = L_equiv × (ff / 100)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] text-muted-foreground",
															children: "Applies friction factor loss rate per 100m of pipe."
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-semibold block mb-1",
															children: "Total dynamic Head (TDH):"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
															className: "text-primary block font-bold mb-1 font-mono text-[11px]",
															children: "TDH = (H_loss + H_st + H_out − H_suc) × (1 + SF/100)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] text-muted-foreground",
															children: "Head required including static lift, outlet, and safety margin."
														})
													]
												})
											]
										})]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "lg:col-span-5 flex flex-col gap-6",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm flex flex-col gap-4",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
													className: "font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 border-b border-border/40 pb-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-1.5 h-3.5 bg-[#0A7BC7] rounded-sm" }), "Flow Demand Parameters"]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid grid-cols-2 gap-4 items-center font-sans",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
														className: "block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5",
														children: [
															"Flow Rate (",
															unitSystem === "ip" ? "GPM" : "L/s",
															")"
														]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														value: sizingParams.flowUsgpm,
														onChange: (e) => {
															const val = e.target.value === "" ? "" : Number(e.target.value);
															saveParams({
																...sizingParams,
																flowUsgpm: val,
																flowLps: val !== "" ? Number((Number(val) * 3.78 / 60).toFixed(2)) : ""
															}, unitSystem, projectInfo);
														},
														placeholder: unitSystem === "ip" ? "500" : "31.5",
														className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
													})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[10px] uppercase font-bold text-muted-foreground tracking-wider",
														children: "Design Flow Rate"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-sm font-bold mt-1.5 text-slate-800 dark:text-slate-100",
														children: [calculatedData.flowRate.toFixed(2), " L/s"]
													})] })]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm flex flex-col gap-4",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex justify-between items-center border-b border-border/40 pb-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
															className: "font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-1.5 h-3.5 bg-[#0A7BC7] rounded-sm" }), "Major & Minor Head Loss (Piping Run)"]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "text-xs text-muted-foreground flex items-center gap-1.5 select-none",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Friction Factor:" }),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																	className: "bg-[#0A7BC7]/10 dark:bg-[#0A7BC7]/20 text-[#06456F] px-2 py-0.5 rounded flex items-center gap-0.5 font-bold",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																		type: "number",
																		step: "0.05",
																		value: sizingParams.frictionFactor,
																		onChange: (e) => saveParams({
																			...sizingParams,
																			frictionFactor: e.target.value === "" ? "" : Number(e.target.value)
																		}, unitSystem, projectInfo),
																		placeholder: unitSystem === "ip" ? "1.77" : "0.4",
																		className: "w-9 bg-transparent text-[#06456F] text-center outline-none border-none p-0 focus:ring-0 font-bold font-mono placeholder:text-muted-foreground/45"
																	})
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[10px] font-semibold",
																	children: unitSystem === "ip" ? "psi/100ft" : "bar/100m length"
																})
															]
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "grid grid-cols-2 gap-4",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
															className: "block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5",
															children: [
																"Vertical Pipe Length (",
																calculatedData.lengthUnit,
																")"
															]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "number",
															value: sizingParams.vertLength,
															onChange: (e) => saveParams({
																...sizingParams,
																vertLength: e.target.value === "" ? "" : Number(e.target.value)
															}, unitSystem, projectInfo),
															placeholder: unitSystem === "ip" ? "100" : "30",
															className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
														})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
															className: "block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5",
															children: [
																"Horizontal Pipe Length (",
																calculatedData.lengthUnit,
																")"
															]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "number",
															value: sizingParams.horizLength,
															onChange: (e) => saveParams({
																...sizingParams,
																horizLength: e.target.value === "" ? "" : Number(e.target.value)
															}, unitSystem, projectInfo),
															placeholder: unitSystem === "ip" ? "400" : "120",
															className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
														})] })]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-border/40 text-left select-none",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "text-[10px] uppercase font-bold text-muted-foreground tracking-wider",
																children: "Elbows Equiv."
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "text-sm font-bold mt-1 text-slate-800 dark:text-slate-100",
																children: [
																	calculatedData.elbowsLengthDisplay.toFixed(2),
																	" ",
																	calculatedData.lengthUnit
																]
															})] }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "text-[10px] uppercase font-bold text-muted-foreground tracking-wider",
																children: "Valves Equiv."
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "text-sm font-bold mt-1 text-slate-800 dark:text-slate-100",
																children: [
																	calculatedData.valvesLengthDisplay.toFixed(2),
																	" ",
																	calculatedData.lengthUnit
																]
															})] }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "text-[10px] uppercase font-bold text-muted-foreground tracking-wider",
																children: "Equiv Length"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "text-sm font-bold mt-1 text-[#0A7BC7] dark:text-sky-400",
																children: [
																	calculatedData.equivLengthDisplay.toFixed(1),
																	" ",
																	calculatedData.lengthUnit
																]
															})] })
														]
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm flex flex-col gap-4",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
														className: "font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 border-b border-border/40 pb-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-1.5 h-3.5 bg-[#0A7BC7] rounded-sm" }), "Pump Head Requirement"]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "grid grid-cols-2 gap-4",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[10px] uppercase font-bold text-muted-foreground tracking-wider",
															children: "Pressure Drop in the Piping"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "text-sm font-bold mt-1 text-slate-800 dark:text-slate-100",
															children: [
																calculatedData.frictionLossDisplay.toFixed(3),
																" ",
																calculatedData.headUnit
															]
														})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
															className: "block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5",
															children: [
																"Static Head (",
																calculatedData.headUnit,
																")"
															]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "number",
															value: sizingParams.staticHead,
															step: "0.1",
															onChange: (e) => saveParams({
																...sizingParams,
																staticHead: e.target.value === "" ? "" : Number(e.target.value)
															}, unitSystem, projectInfo),
															placeholder: unitSystem === "ip" ? "43.5" : "3.0",
															className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
														})] })]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "grid grid-cols-2 gap-4",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
															className: "block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5",
															children: [
																"Residual Pressure at Outlet (",
																calculatedData.headUnit,
																")"
															]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "number",
															value: sizingParams.residualPressure,
															step: "0.1",
															onChange: (e) => saveParams({
																...sizingParams,
																residualPressure: e.target.value === "" ? "" : Number(e.target.value)
															}, unitSystem, projectInfo),
															placeholder: unitSystem === "ip" ? "29.0" : "2.0",
															className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
														})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
															className: "block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5",
															children: [
																"Suction Pressure (Available) (",
																calculatedData.headUnit,
																")"
															]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "number",
															value: sizingParams.suctionPressure,
															step: "0.1",
															onChange: (e) => saveParams({
																...sizingParams,
																suctionPressure: e.target.value === "" ? "" : Number(e.target.value)
															}, unitSystem, projectInfo),
															placeholder: "0.0",
															className: "w-full bg-blue-50/40/50 dark:bg-orange-950/20 text-[#06456F] border border-blue-100 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
														})] })]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "grid grid-cols-2 gap-4",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
															className: "block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5",
															children: "Considering safety margin (%)"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "number",
															value: sizingParams.safetyFactorHead,
															onChange: (e) => saveParams({
																...sizingParams,
																safetyFactorHead: e.target.value === "" ? "" : Number(e.target.value)
															}, unitSystem, projectInfo),
															placeholder: "5",
															className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
														})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
															className: "block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5",
															children: [
																"Selected Operating Head (",
																calculatedData.headUnit,
																")"
															]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "number",
															value: sizingParams.selectedHead,
															placeholder: "Same as calculated head if left blank",
															onChange: (e) => saveParams({
																...sizingParams,
																selectedHead: e.target.value === "" ? "" : Number(e.target.value)
															}, unitSystem, projectInfo),
															className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
														})] })]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "mt-2 pt-3 border-t border-border/40 select-none",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[10px] uppercase font-bold text-muted-foreground tracking-wider",
															children: "Total Calculated Pump Head"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "text-base font-extrabold mt-1 text-[#0A7BC7]",
															children: [
																calculatedData.pumpHeadCalcDisplay.toFixed(3),
																" ",
																calculatedData.headUnit
															]
														})]
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm flex flex-col gap-4",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
													className: "font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 border-b border-border/40 pb-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-1.5 h-3.5 bg-[#0A7BC7] rounded-sm" }), "Motor & Pump Efficiencies"]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid grid-cols-2 gap-3.5 text-xs font-sans",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "block text-[11px] font-semibold text-muted-foreground mb-1",
														children: "Pump Efficiency (%)"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														value: sizingParams.effPump,
														onChange: (e) => saveParams({
															...sizingParams,
															effPump: Number(e.target.value)
														}, unitSystem, projectInfo),
														className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 text-xs outline-none font-bold focus:border-primary"
													})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "block text-[11px] font-semibold text-muted-foreground mb-1",
														children: "Motor Efficiency (%)"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														value: sizingParams.effMotor,
														onChange: (e) => saveParams({
															...sizingParams,
															effMotor: Number(e.target.value)
														}, unitSystem, projectInfo),
														className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 text-xs outline-none font-bold focus:border-primary"
													})] })]
												})]
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "lg:col-span-7 flex flex-col gap-6",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl p-6 shadow-md text-white select-none",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10.5px] font-bold uppercase tracking-widest text-orange-100 block mb-2",
													children: "Pump Head Duty"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid grid-cols-2 gap-4",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[11px] font-semibold text-orange-200 block mb-0.5",
														children: "Flow Rate"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-baseline gap-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-3xl font-extrabold font-sans leading-none",
															children: calculatedData.flowRateDisplay.toFixed(2)
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-sm font-semibold",
															children: calculatedData.flowUnit
														})]
													})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[11px] font-semibold text-orange-200 block mb-0.5",
														children: "Required Head"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-baseline gap-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-3xl font-extrabold font-sans leading-none",
															children: calculatedData.pumpHeadCalcDisplay.toFixed(2)
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-sm font-semibold",
															children: calculatedData.headUnit
														})]
													})] })]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
													className: "text-[11.5px] font-black text-slate-800 dark:text-slate-100 tracking-wider uppercase mb-3 flex items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-primary font-bold",
														children: "1."
													}), "Friction and Equivalent Length Breakdown"]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "divide-y divide-border/40 text-xs",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-2.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Sum of Component Lengths"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "text-slate-950 dark:text-slate-50 font-mono",
																children: [
																	calculatedData.sumLengthsDisplay.toFixed(1),
																	" ",
																	calculatedData.lengthUnit
																]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-2.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Total Equivalent Length (with Safety)"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "text-slate-950 dark:text-slate-50 font-mono",
																children: [
																	calculatedData.equivLengthDisplay.toFixed(1),
																	" ",
																	calculatedData.lengthUnit
																]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-2.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Major + Minor Friction Losses"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "text-slate-950 dark:text-slate-50 font-mono",
																children: [
																	calculatedData.frictionLossDisplay.toFixed(3),
																	" ",
																	calculatedData.headUnit
																]
															})]
														})
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
													className: "text-[11.5px] font-black text-slate-800 dark:text-slate-100 tracking-wider uppercase mb-3 flex items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-primary font-bold",
														children: "2."
													}), "Sizing Head Requirements"]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "divide-y divide-border/40 text-xs",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-2.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Piping Friction Losses"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "text-slate-950 dark:text-slate-50 font-mono",
																children: [
																	calculatedData.frictionLossDisplay.toFixed(3),
																	" ",
																	calculatedData.headUnit
																]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-2.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Static Elevation Lift"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "text-slate-950 dark:text-slate-50 font-mono",
																children: [
																	calculatedData.staticHeadDisplay.toFixed(2),
																	" ",
																	calculatedData.headUnit
																]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-2.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Residual Head at Outlet"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "text-slate-950 dark:text-slate-50 font-mono",
																children: [
																	calculatedData.outletHeadDisplay.toFixed(2),
																	" ",
																	calculatedData.headUnit
																]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-2.5 text-[#06456F] dark:text-sky-400",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-sans",
																children: "Suction Pressure (Deducted)"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono",
																children: [
																	"-",
																	calculatedData.suctionHeadDisplay.toFixed(2),
																	" ",
																	calculatedData.headUnit
																]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-2.5 text-[#06456F] dark:text-sky-400 font-bold border-t border-border/80",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-sans",
																children: "Total Calculated Pump Head"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono text-[13px]",
																children: [
																	calculatedData.pumpHeadCalcDisplay.toFixed(3),
																	" ",
																	calculatedData.headUnit
																]
															})]
														})
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
													className: "text-[11.5px] font-black text-slate-800 dark:text-slate-100 tracking-wider uppercase mb-3 flex items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-primary font-bold",
														children: "3."
													}), "Calculations for Motor Selection"]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "divide-y divide-border/40 text-xs",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-2.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Selected Head for the Pump"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "text-slate-950 dark:text-slate-50 font-mono",
																children: [
																	calculatedData.selectedHeadDisplay.toFixed(3),
																	" ",
																	calculatedData.headUnit
																]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-2.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Pump Flow Rate"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "text-slate-950 dark:text-slate-50 font-mono",
																children: [calculatedData.massFlow.toFixed(3), " kg/s"]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-2.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Pressure Lift Requirement"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "text-slate-950 dark:text-slate-50 font-mono",
																children: [calculatedData.liftKpa.toFixed(1), " kPa"]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-2.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Shaft Power Requirement"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "text-slate-950 dark:text-slate-50 font-mono",
																children: [calculatedData.shaftPowerKw.toFixed(2), " kW"]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-3 px-3.5 bg-[#0A7BC7]/5 border border-[#0A7BC7]/10 rounded-xl mt-2 font-bold text-[#06456F] dark:text-sky-400",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-sans",
																children: "Estimated Motor Power"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono text-[13.5px]",
																children: [
																	calculatedData.motorPowerKw.toFixed(2),
																	" kW / ",
																	calculatedData.motorPowerHp.toFixed(2),
																	" HP"
																]
															})]
														})
													]
												})]
											})
										]
									})]
								})]
							})]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 flex flex-col min-h-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "relative flex items-center justify-end gap-3 px-6 h-12 bg-background border-b border-border/60 shrink-0 no-print select-none",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
									onClick: handlePrintPDF,
									primary: true,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-3.5" }), " Print / Export PDF"]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex-1 overflow-y-auto p-8 bg-slate-50/30 dark:bg-slate-950/20 font-sans print:p-0",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "border border-slate-300 dark:border-slate-800 rounded-xl p-8 max-w-4xl mx-auto shadow-sm bg-card print:border-none print:shadow-none print:p-0",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border-b-2 border-slate-800 pb-5 mb-6 flex justify-between items-start",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
												className: "text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-sans",
												children: "PUMP HEAD SIZING REPORT"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[12px] text-muted-foreground font-mono mt-1",
												children: "Chilled Water Secondary Circulation Pump Head and Fittings Loss Report"
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-right",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[13px] font-bold text-primary font-mono block",
													children: "MEP CALCULATION SUITE"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[11px] text-muted-foreground block mt-0.5",
													children: ["Date: ", projectInfo.date]
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mb-6",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 pb-1 mb-3",
												children: "1. Project Details"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-2 gap-4 text-xs",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Project Name:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold",
														children: projectInfo.projectName
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Project Number:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold",
														children: projectInfo.projectNumber
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Consultant / Engineer:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold",
														children: projectInfo.consultant
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Client Name:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold",
														children: projectInfo.client
													})] })
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mb-6",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 pb-1 mb-3",
												children: "2. Design Parameters"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-3 gap-y-3.5 gap-x-4 text-xs font-mono",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground font-sans block",
														children: "Design Flow Rate:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
														calculatedData.flowRateDisplay.toFixed(2),
														" ",
														calculatedData.flowUnit
													] })] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground font-sans block",
														children: "Vertical Pipe Length:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
														calculatedData.vertLengthDisplay.toFixed(1),
														" ",
														calculatedData.lengthUnit
													] })] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground font-sans block",
														children: "Horizontal Pipe Length:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
														calculatedData.horizLengthDisplay.toFixed(1),
														" ",
														calculatedData.lengthUnit
													] })] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground font-sans block",
														children: "Friction Factor Loss Rate:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
														sizingParams.frictionFactor,
														" ",
														unitSystem === "ip" ? "psi/100ft" : "bar/100m"
													] })] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground font-sans block",
														children: "Design Equivalent Length:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
														calculatedData.equivLengthDisplay.toFixed(1),
														" ",
														calculatedData.lengthUnit
													] })] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground font-sans block",
														children: "Safety Margin applied:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [sizingParams.safetyFactorHead, "%"] })] })
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mb-6",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 pb-1 mb-3",
													children: "3. Head Loss Sizing Summary"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
													className: "w-full text-left text-[11px] border border-collapse border-slate-200 font-sans mb-4",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
														className: "bg-slate-100 font-bold text-slate-800 border-b border-slate-200",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2 border-r border-slate-200",
															children: "Loss Component"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2 text-right",
															children: "Pressure / Head Loss"
														})]
													}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
														className: "divide-y divide-slate-200 font-mono",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-2 border-r border-slate-200 font-sans",
																children: "Piping Friction Losses"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																className: "p-2 text-right",
																children: [
																	calculatedData.frictionLossDisplay.toFixed(3),
																	" ",
																	calculatedData.headUnit
																]
															})] }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-2 border-r border-slate-200 font-sans",
																children: "Static elevation Lift"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																className: "p-2 text-right",
																children: [
																	calculatedData.staticHeadDisplay.toFixed(2),
																	" ",
																	calculatedData.headUnit
																]
															})] }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-2 border-r border-slate-200 font-sans",
																children: "Residual Outlet Pressure required"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																className: "p-2 text-right",
																children: [
																	calculatedData.outletHeadDisplay.toFixed(2),
																	" ",
																	calculatedData.headUnit
																]
															})] }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
																className: "text-[#06456F] font-bold",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "p-2 border-r border-slate-200 font-sans",
																	children: "Suction pressure (Deducted)"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																	className: "p-2 text-right",
																	children: [
																		"-",
																		calculatedData.suctionHeadDisplay.toFixed(2),
																		" ",
																		calculatedData.headUnit
																	]
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
																className: "bg-blue-50/40 font-extrabold text-orange-950",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "p-2 border-r border-slate-200 font-sans",
																	children: "TOTAL RECOMMENDED PUMP HEAD"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																	className: "p-2 text-right",
																	children: [
																		calculatedData.pumpHeadCalcDisplay.toFixed(3),
																		" ",
																		calculatedData.headUnit
																	]
																})]
															})
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-800/10 text-xs",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "grid grid-cols-2 md:grid-cols-4 gap-4 font-mono",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Selected Sized Head:"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "block text-[13px] mt-0.5 text-primary",
																children: [
																	calculatedData.selectedHeadDisplay.toFixed(3),
																	" ",
																	calculatedData.headUnit
																]
															})] }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Fluid Mass Flow Rate:"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "block text-[13px] mt-0.5",
																children: [calculatedData.massFlow.toFixed(3), " kg/s"]
															})] }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Required Shaft Power:"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "block text-[13px] mt-0.5",
																children: [calculatedData.shaftPowerKw.toFixed(2), " kW"]
															})] }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground font-sans",
																children: "Estimated Motor Power:"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "block text-[13px] mt-0.5 text-emerald-600 dark:text-emerald-400",
																children: [
																	calculatedData.motorPowerKw.toFixed(2),
																	" kW (",
																	calculatedData.motorPowerHp.toFixed(2),
																	" HP)"
																]
															})] })
														]
													})
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-[11px] text-muted-foreground",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "font-semibold uppercase tracking-wider text-slate-800 mb-6",
													children: "Prepared By:"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "border-b border-slate-300 w-48 mb-1" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Consulting HVAC Engineer" })
											] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-right",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "font-semibold uppercase tracking-wider text-slate-800 mb-6",
														children: "Reviewed & Approved By:"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "border-b border-slate-300 w-48 ml-auto mb-1" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Lead MEP Principal Engineer" })
												]
											})]
										})
									]
								})
							})]
						})
					})]
				})]
			})
		})
	});
}
//#endregion
export { ChwPumpHeadPage as component };
