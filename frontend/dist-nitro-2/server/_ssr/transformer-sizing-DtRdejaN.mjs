import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { D as RotateCcw, M as Printer, N as Plus, Wt as Sparkles, gt as Download, l as Upload, lt as FileText, m as Trash2, rt as Gauge } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
import { t as addPdfSignatureBlock } from "./pdfHelpers-Cqwarpxq.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/transformer-sizing-DtRdejaN.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
require_excel();
import_FileSaver_min.default.saveAs;
var STANDARD_TX_RATINGS = [
	25,
	50,
	75,
	100,
	160,
	200,
	250,
	315,
	400,
	500,
	630,
	750,
	800,
	1e3,
	1250,
	1600,
	2e3,
	2500,
	3150,
	4e3
];
function InlineInput({ value, onCommit, className = "", type = "text", step, min, placeholder, onFocus }) {
	const [localVal, setLocalVal] = (0, import_react.useState)(String(value));
	(0, import_react.useMemo)(() => {
		const strVal = String(value);
		if (localVal !== strVal) {
			const parsedLocal = parseFloat(localVal);
			const parsedValue = parseFloat(strVal);
			if (localVal.endsWith(".") && parsedLocal === parsedValue) return;
			if (localVal === "" && parsedValue === 0) return;
			if (localVal === "-" && parsedValue === 0) return;
			setLocalVal(strVal);
		}
	}, [value]);
	const handleChange = (e) => {
		setLocalVal(e.target.value);
		onCommit(e.target.value);
	};
	const handleKeyDown = (e) => {
		if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		step,
		min,
		value: localVal,
		onChange: handleChange,
		onFocus,
		onKeyDown: handleKeyDown,
		placeholder,
		onClick: (e) => e.stopPropagation(),
		onDoubleClick: (e) => e.stopPropagation(),
		className: `bg-transparent w-full border border-transparent hover:border-slate-200 focus:border-blue-500 px-1 py-1 outline-none transition-colors cursor-text ${className}`
	});
}
function TransformerSizingPage() {
	const { userData, profile } = useAuth();
	const currentUserName = userData?.name || profile?.name || "System Admin";
	const confirm = useConfirm();
	const [activeTab, setActiveTab] = (0, import_react.useState)("calculator");
	const [showSummary, setShowSummary] = (0, import_react.useState)(false);
	const [designParams, setDesignParams] = (0, import_react.useState)({
		spareCapacity: 20,
		deratingFactor1: 1,
		deratingFactor2: 1,
		powerFactor: .8
	});
	const [loadRows, setLoadRows] = (0, import_react.useState)([{
		id: "1",
		selected: false,
		description: "General Lighting",
		lightingHeatingKw: 45,
		inductiveMotorKw: 0,
		diversityFactor: .9,
		demandFactor: .8,
		remarks: "Main lobby & corridors"
	}, {
		id: "2",
		selected: false,
		description: "Chiller Unit CH-01",
		lightingHeatingKw: 0,
		inductiveMotorKw: 150,
		diversityFactor: 1,
		demandFactor: .85,
		remarks: "Primary AC plant"
	}]);
	const calculatedData = (0, import_react.useMemo)(() => {
		let totalConnectedKw = 0;
		let totalMaxDemandKw = 0;
		const rowDetails = loadRows.map((row) => {
			const lh = Number(row.lightingHeatingKw) || 0;
			const im = Number(row.inductiveMotorKw) || 0;
			const div = Number(row.diversityFactor) || 1;
			const dem = Number(row.demandFactor) || 1;
			const connectedLoad = lh + im;
			const maxDemand = connectedLoad * dem * div;
			totalConnectedKw += connectedLoad;
			totalMaxDemandKw += maxDemand;
			return {
				...row,
				connectedLoad,
				maxDemand
			};
		});
		const spareMult = 1 + (Number(designParams.spareCapacity) || 0) / 100;
		const derating1 = Number(designParams.deratingFactor1) || 1;
		const derating2 = Number(designParams.deratingFactor2) || 1;
		const pf = Number(designParams.powerFactor) || .8;
		const totalDemandWithSpareKw = totalMaxDemandKw * spareMult;
		const requiredKvaVal = totalDemandWithSpareKw / (pf * derating1 * derating2);
		const requiredKva = isNaN(requiredKvaVal) || !isFinite(requiredKvaVal) ? 0 : requiredKvaVal;
		const recommendedKva = STANDARD_TX_RATINGS.find((r) => r >= requiredKva) || STANDARD_TX_RATINGS[STANDARD_TX_RATINGS.length - 1];
		const utilization = recommendedKva > 0 ? requiredKva / recommendedKva * 100 : 0;
		return {
			rowDetails,
			totalConnectedKw,
			totalMaxDemandKw,
			totalDemandWithSpareKw,
			requiredKva,
			recommendedKva,
			utilization: isNaN(utilization) ? 0 : utilization,
			totalSpareKw: totalMaxDemandKw * (designParams.spareCapacity / 100)
		};
	}, [loadRows, designParams]);
	const handleAddRow = () => {
		const newRow = {
			id: Date.now().toString(),
			selected: false,
			description: `Load ${loadRows.length + 1}`,
			lightingHeatingKw: "",
			inductiveMotorKw: "",
			diversityFactor: 1,
			demandFactor: 1,
			remarks: ""
		};
		setLoadRows([...loadRows, newRow]);
	};
	const handleUpdateRow = (id, field, val) => {
		setLoadRows((prev) => {
			const isSelected = prev.find((r) => r.id === id)?.selected;
			return prev.map((r) => {
				if (isSelected && r.selected) return {
					...r,
					[field]: val
				};
				else if (r.id === id) return {
					...r,
					[field]: val
				};
				return r;
			});
		});
	};
	import_react.useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape") {
				setLoadRows((prev) => prev.map((r) => ({
					...r,
					selected: false
				})));
				if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
				return;
			}
			if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT" || document.activeElement?.tagName === "TEXTAREA") return;
			if ((e.ctrlKey || e.metaKey) && e.key === "a") {
				e.preventDefault();
				setLoadRows((prev) => prev.map((r) => ({
					...r,
					selected: true
				})));
			}
			if (e.key === "Delete" || e.key === "Backspace") setLoadRows((prev) => prev.filter((r) => !r.selected));
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);
	const handleRowFocus = (id) => {
		setLoadRows((prev) => {
			if (!prev.find((r) => r.id === id)?.selected) return prev.map((r) => r.id === id ? {
				...r,
				selected: true
			} : {
				...r,
				selected: false
			});
			return prev;
		});
	};
	const handleDeleteSelected = async () => {
		if (await confirm({
			title: "Delete Selected",
			body: "Are you sure you want to delete the selected rows?"
		})) setLoadRows(loadRows.filter((r) => !r.selected));
	};
	const handleSelectAll = (e) => {
		const checked = e.target.checked;
		setLoadRows(loadRows.map((r) => ({
			...r,
			selected: checked
		})));
	};
	const handleReset = async () => {
		if (await confirm({
			title: "Reset Data",
			body: "This will clear all rows. Continue?"
		})) {
			setLoadRows([]);
			setDesignParams({
				spareCapacity: 20,
				deratingFactor1: 1,
				deratingFactor2: 1,
				powerFactor: .8
			});
			setShowSummary(false);
		}
	};
	const handleExportJSON = () => {
		const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
			designParams,
			loadRows
		}));
		const downloadAnchor = document.createElement("a");
		downloadAnchor.setAttribute("href", dataStr);
		downloadAnchor.setAttribute("download", `transformer_sizing_data.json`);
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
				if (parsed.designParams) setDesignParams(parsed.designParams);
				if (parsed.loadRows) setLoadRows(parsed.loadRows);
			} catch (err) {
				alert("Failed to parse JSON file.");
			}
		};
		reader.readAsText(file);
		e.target.value = "";
	};
	const handlePrintPDF = () => {
		const doc = new import_jspdf_node_min.default("l", "pt", "a4");
		doc.setFont("helvetica", "bold");
		doc.setFontSize(20);
		doc.text("POWER TRANSFORMER SIZING REPORT", 40, 50);
		doc.setFontSize(10);
		doc.setFont("helvetica", "normal");
		doc.setTextColor(100);
		doc.text(`Generated on: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`, 40, 68);
		doc.setDrawColor(200);
		doc.line(40, 75, 780, 75);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(12);
		doc.setTextColor(0);
		doc.text("1. Sizing Parameters", 40, 95);
		autoTable(doc, {
			startY: 105,
			head: [],
			body: [[
				"Spare Capacity",
				`${designParams.spareCapacity} %`,
				"Power Factor",
				`${designParams.powerFactor}`
			], [
				"Derating Factor 1",
				`${designParams.deratingFactor1}`,
				"Derating Factor 2",
				`${designParams.deratingFactor2}`
			]],
			theme: "plain",
			styles: {
				fontSize: 9.5,
				cellPadding: 4
			},
			columnStyles: {
				0: {
					fontStyle: "bold",
					cellWidth: 120
				},
				1: { cellWidth: 170 },
				2: {
					fontStyle: "bold",
					cellWidth: 120
				},
				3: { cellWidth: 170 }
			}
		});
		doc.setFont("helvetica", "bold");
		doc.text("2. Connected Load Schedule", 40, doc.lastAutoTable.finalY + 25);
		const loadHead = [[
			"Description",
			"Light/Heat kW",
			"Induct/Motor kW",
			"Total kW",
			"Diversity",
			"Demand F.",
			"Max Demand kW"
		]];
		const loadBody = calculatedData.rowDetails.map((r) => [
			r.description,
			r.lightingHeatingKw,
			r.inductiveMotorKw,
			r.connectedLoad.toFixed(2),
			r.diversityFactor,
			r.demandFactor,
			r.maxDemand.toFixed(2)
		]);
		autoTable(doc, {
			startY: doc.lastAutoTable.finalY + 35,
			head: loadHead,
			body: loadBody,
			theme: "grid",
			styles: {
				fontSize: 8.5,
				cellPadding: 4
			},
			headStyles: { fillColor: [
				51,
				63,
				72
			] }
		});
		doc.setFont("helvetica", "bold");
		doc.text("3. Calculations Summary", 40, doc.lastAutoTable.finalY + 25);
		const summaryData = [
			["Total Connected Load", `${calculatedData.totalConnectedKw.toFixed(1)} kW`],
			["Total Maximum Demand", `${calculatedData.totalMaxDemandKw.toFixed(1)} kW`],
			["Spare Load Capacity Added", `${calculatedData.totalSpareKw.toFixed(1)} kW (${designParams.spareCapacity}%)`],
			["Required Transformer capacity", `${calculatedData.requiredKva.toFixed(1)} kVA`],
			["Recommended Transformer Size", `${calculatedData.recommendedKva} kVA`],
			["Transformer Load utilization", `${calculatedData.utilization.toFixed(1)}%`]
		];
		autoTable(doc, {
			startY: doc.lastAutoTable.finalY + 35,
			head: [],
			body: summaryData,
			theme: "striped",
			styles: {
				fontSize: 9.5,
				cellPadding: 4
			},
			columnStyles: {
				0: {
					fontStyle: "bold",
					cellWidth: 220
				},
				1: { cellWidth: 280 }
			}
		});
		addPdfSignatureBlock(doc, doc.lastAutoTable?.finalY || 40, currentUserName, project?.id || "default", "transformer-sizing");
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), `transformer_sizing_report.pdf`, "PDF Document", ["pdf"]);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 h-full flex flex-col bg-slate-50 dark:bg-slate-950 font-sans overflow-y-auto",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col mb-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1",
						children: "Electrical > Transformer Sizing"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2",
						children: ["Transformer Sizing ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-sm font-normal text-slate-400",
							children: [
								"(",
								loadRows.length,
								" loads)"
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground mt-1",
						children: "Preliminary transformer capacity (kVA) sizing based on connected loads, diversity, and ambient deratings."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-slate-800 pb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setActiveTab("calculator"),
					className: `px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeTab === "calculator" ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`,
					children: "Sizing Schedule"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setActiveTab("report"),
					className: `px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeTab === "report" ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`,
					children: "Report"
				})]
			}),
			activeTab === "calculator" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap gap-4 items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-4 lg:gap-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-bold text-slate-500 dark:text-slate-400",
										children: "SPARE CAPACITY:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: designParams.spareCapacity,
											onChange: (e) => setDesignParams({
												...designParams,
												spareCapacity: Number(e.target.value)
											}),
											className: "w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-transparent rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "absolute right-[-14px] top-1.5 text-[10px] text-slate-500",
											children: "%"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 ml-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-bold text-slate-500 dark:text-slate-400",
										children: "DERATING FACTOR 1:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.01",
										value: designParams.deratingFactor1,
										onChange: (e) => setDesignParams({
											...designParams,
											deratingFactor1: Number(e.target.value)
										}),
										className: "w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-transparent rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-bold text-slate-500 dark:text-slate-400",
										children: "DERATING FACTOR 2:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.01",
										value: designParams.deratingFactor2,
										onChange: (e) => setDesignParams({
											...designParams,
											deratingFactor2: Number(e.target.value)
										}),
										className: "w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-transparent rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-bold text-slate-500 dark:text-slate-400",
										children: "POWER FACTOR:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.01",
										value: designParams.powerFactor,
										onChange: (e) => setDesignParams({
											...designParams,
											powerFactor: Number(e.target.value)
										}),
										className: "w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-transparent rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: handleReset,
									className: "flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 transition-colors",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-3.5" }), " Reset"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 cursor-pointer transition-colors",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }),
										" Import",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "file",
											onChange: handleImportJSON,
											accept: ".json",
											className: "hidden"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: handleExportJSON,
									className: "flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 transition-colors",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" }), " Export"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: handleAddRow,
									className: "bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ml-2 shadow-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add Row"]
								}),
								loadRows.some((r) => r.selected) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: handleDeleteSelected,
									className: "bg-rose-600 hover:bg-rose-700 text-white rounded-md px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), " Delete"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setShowSummary(true),
									className: "bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ml-1 shadow-sm",
									children: "Calculate"
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-left text-xs whitespace-nowrap min-w-[900px]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-500 font-bold",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-10 text-center",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											onChange: handleSelectAll,
											checked: loadRows.length > 0 && loadRows.every((r) => r.selected),
											className: "cursor-pointer"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-16 text-center",
										children: "Sr. No."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3",
										children: "Description"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-32",
										children: "Lighting / Heating Load (kW)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-32",
										children: "Inductive / Motor Load (kW)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-32 bg-slate-100/50 dark:bg-slate-800/50",
										children: "Total Connected Load (kW)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-28",
										children: "Diversity Factor"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-28",
										children: "Demand Factor"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-32 bg-slate-100/50 dark:bg-slate-800/50",
										children: "Maximum Demand (kW)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-40",
										children: "Remarks"
									})
								]
							}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
								className: "divide-y divide-slate-100 dark:divide-slate-800/50",
								children: calculatedData.rowDetails.map((row, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									onClick: () => handleUpdateRow(row.id, "selected", !row.selected),
									className: `cursor-pointer ${row.selected ? "bg-blue-50/50 dark:bg-blue-900/10" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/20"}`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-3 text-center border-r border-transparent",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: !!row.selected,
												onChange: (e) => handleUpdateRow(row.id, "selected", e.target.checked),
												onClick: (e) => e.stopPropagation(),
												className: "cursor-pointer"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-3 font-mono text-slate-400 text-center",
											children: idx + 1
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
												value: row.description,
												onCommit: (val) => handleUpdateRow(row.id, "description", val),
												onFocus: () => handleRowFocus(row.id),
												placeholder: "e.g. Area 1",
												className: "font-medium text-slate-900 dark:text-slate-100"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
												type: "number",
												value: row.lightingHeatingKw,
												onCommit: (val) => handleUpdateRow(row.id, "lightingHeatingKw", val === "" ? "" : Number(val)),
												onFocus: () => handleRowFocus(row.id),
												placeholder: "eg: 20",
												className: "text-slate-900 dark:text-slate-100"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
												type: "number",
												value: row.inductiveMotorKw,
												onCommit: (val) => handleUpdateRow(row.id, "inductiveMotorKw", val === "" ? "" : Number(val)),
												onFocus: () => handleRowFocus(row.id),
												placeholder: "eg: 10",
												className: "text-slate-900 dark:text-slate-100"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-3 font-bold text-slate-700 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-800/30",
											children: row.connectedLoad.toFixed(2)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
												type: "number",
												step: "0.01",
												value: row.diversityFactor,
												onCommit: (val) => handleUpdateRow(row.id, "diversityFactor", val === "" ? "" : Number(val)),
												onFocus: () => handleRowFocus(row.id),
												placeholder: "eg: 1",
												className: "text-slate-900 dark:text-slate-100"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
												type: "number",
												step: "0.01",
												value: row.demandFactor,
												onCommit: (val) => handleUpdateRow(row.id, "demandFactor", val === "" ? "" : Number(val)),
												onFocus: () => handleRowFocus(row.id),
												placeholder: "eg: 0.85",
												className: "text-slate-900 dark:text-slate-100"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-3 font-bold text-blue-700 dark:text-blue-400 bg-slate-100/50 dark:bg-slate-800/30",
											children: row.maxDemand.toFixed(2)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
												value: row.remarks,
												onCommit: (val) => handleUpdateRow(row.id, "remarks", val),
												onFocus: () => handleRowFocus(row.id),
												placeholder: "Notes...",
												className: "text-slate-500"
											})
										})
									]
								}, row.id))
							})]
						}), loadRows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-8 text-center text-slate-400 text-xs",
							children: "No loads added. Click \"Add Row\" to begin sizing."
						})]
					}),
					showSummary && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-bottom-4 fade-in duration-300",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 rounded-xl p-4 shadow-sm relative overflow-hidden",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "absolute right-3 top-3 text-blue-500/20",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-8" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1",
										children: "Recommended Rating"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
										className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
										children: [
											calculatedData.recommendedKva,
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-sm text-slate-500 font-sans",
												children: "kVA"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[11px] text-slate-500 mt-2 block",
										children: [
											"Min. sizing required: ",
											calculatedData.requiredKva.toFixed(1),
											" kVA"
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "absolute right-3 top-3 text-slate-500/10",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gauge, { className: "size-8" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1",
										children: "Total Max Demand"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
										className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
										children: [
											calculatedData.totalMaxDemandKw.toFixed(1),
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-sm text-slate-500 font-sans",
												children: "kW"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[11px] text-slate-500 mt-2 block",
										children: [
											"Connected Load: ",
											calculatedData.totalConnectedKw.toFixed(1),
											" kW"
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "absolute right-3 top-3 text-slate-500/10",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-8" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1",
										children: "Demand With Spare"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
										className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
										children: [
											calculatedData.totalDemandWithSpareKw.toFixed(1),
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-sm text-slate-500 font-sans",
												children: "kW"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[11px] text-slate-500 mt-2 block",
										children: [
											"Spare added: ",
											calculatedData.totalSpareKw.toFixed(1),
											" kW"
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1",
										children: "Utilization"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
										className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
										children: [
											calculatedData.utilization.toFixed(1),
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-sm text-slate-500 font-sans",
												children: "%"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: `h-full rounded-full ${calculatedData.utilization > 90 ? "bg-rose-500" : calculatedData.utilization < 35 ? "bg-amber-500" : "bg-emerald-500"}`,
											style: { width: `${Math.min(calculatedData.utilization, 100)}%` }
										})
									})
								]
							})
						]
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-6 w-full max-w-4xl mx-auto py-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center justify-end gap-3 no-print border-b border-border/80 pb-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
						onClick: handlePrintPDF,
						primary: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-3.5" }), " Print PDF"]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border-b-2 border-slate-800 dark:border-slate-700 pb-5 mb-6 flex justify-between items-start",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wider",
								children: "TRANSFORMER SIZING REPORT"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[12px] text-slate-500 font-mono mt-1",
								children: "Sizing Calculation Summary"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-right",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[11px] text-slate-500 block mt-0.5",
									children: ["Date: ", (/* @__PURE__ */ new Date()).toLocaleDateString()]
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1 mb-3",
								children: "1. Design Parameters"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 gap-4 text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-500 block",
										children: "Spare Capacity:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-semibold",
										children: [designParams.spareCapacity, "%"]
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-500 block",
										children: "Power Factor:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold",
										children: designParams.powerFactor
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-500 block",
										children: "Derating Factor 1:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold",
										children: designParams.deratingFactor1
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-500 block",
										children: "Derating Factor 2:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold",
										children: designParams.deratingFactor2
									})] })
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1 mb-3",
								children: "2. Load Schedule"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "overflow-x-auto",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
									className: "w-full text-left text-[11px] border border-collapse border-slate-200 dark:border-slate-700",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
										className: "bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-700",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700",
												children: "Description"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right",
												children: "L/H kW"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right",
												children: "Ind/M kW"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right",
												children: "Total kW"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right",
												children: "Div F."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right",
												children: "Dem F."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 text-right",
												children: "Max kW"
											})
										]
									}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
										className: "divide-y divide-slate-200 dark:divide-slate-700 font-mono",
										children: calculatedData.rowDetails.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 font-sans",
												children: r.description
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right",
												children: r.lightingHeatingKw
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right",
												children: r.inductiveMotorKw
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right",
												children: r.connectedLoad.toFixed(2)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right",
												children: r.diversityFactor
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right",
												children: r.demandFactor
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2 text-right font-bold",
												children: r.maxDemand.toFixed(2)
											})
										] }, r.id))
									})]
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1 mb-3",
								children: "3. Calculation Summary"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50 text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-4 pb-2 border-b border-slate-200 dark:border-slate-700",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-500",
										children: "Total Connected Load:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
										className: "block font-mono mt-0.5",
										children: [calculatedData.totalConnectedKw.toFixed(1), " kW"]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-500",
										children: "Total Maximum Demand:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
										className: "block font-mono mt-0.5",
										children: [calculatedData.totalMaxDemandKw.toFixed(1), " kW"]
									})] })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-3 gap-4 pt-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-slate-500",
											children: "Required capacity:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "block font-mono mt-0.5 text-blue-600",
											children: [calculatedData.requiredKva.toFixed(1), " kVA"]
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-slate-500",
											children: "Recommended rating:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "block font-mono mt-0.5 text-blue-600",
											children: [calculatedData.recommendedKva, " kVA"]
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-slate-500",
											children: "Utilization:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "block font-mono mt-0.5",
											children: [calculatedData.utilization.toFixed(1), "%"]
										})] })
									]
								})]
							})]
						})
					]
				})]
			})
		]
	}) });
}
//#endregion
export { TransformerSizingPage as component };
