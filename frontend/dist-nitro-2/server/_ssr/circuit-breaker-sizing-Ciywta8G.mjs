import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { D as RotateCcw, Gt as Sparkles, M as Printer, N as Plus, _t as Download, l as Upload, lt as FileText, m as Trash2, rt as Gauge } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { t as AppShell } from "./AppShell-urg-0zDa.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/circuit-breaker-sizing-Ciywta8G.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
require_excel();
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
var STANDARD_BREAKER_RATINGS_A = [
	6,
	10,
	16,
	20,
	25,
	32,
	40,
	50,
	63,
	80,
	100,
	125,
	160,
	200,
	250,
	320,
	400,
	500,
	630,
	800,
	1e3,
	1250,
	1600,
	2e3,
	2500,
	3200,
	4e3,
	5e3,
	6300
];
import_FileSaver_min.default.saveAs;
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
function CircuitBreakerSizingPage() {
	const confirm = useConfirm();
	const [activeTab, setActiveTab] = (0, import_react.useState)("calculator");
	const [showSummary, setShowSummary] = (0, import_react.useState)(false);
	const [rows, setRows] = (0, import_react.useState)([{
		id: "1",
		selected: true,
		description: "New Feeder Load",
		connectedLoad: 10,
		voltage: 400,
		phase: "Select...",
		powerFactor: .8,
		demandFactor: 1,
		remarks: ""
	}]);
	const calculatedData = (0, import_react.useMemo)(() => {
		let totalConnectedKw = 0;
		let totalDesignLoadKw = 0;
		let maxDesignCurrentA = 0;
		const rowDetails = rows.map((row) => {
			const load = Number(row.connectedLoad) || 0;
			const volt = Number(row.voltage) || 0;
			const pf = Number(row.powerFactor) || .8;
			const designLoad = load * (Number(row.demandFactor) || 1);
			let designCurrent = 0;
			if (volt > 0 && pf > 0) {
				if (row.phase === "Single Phase") designCurrent = designLoad * 1e3 / (volt * pf);
				else if (row.phase === "Three Phase") designCurrent = designLoad * 1e3 / (1.7320508 * volt * pf);
			}
			const recBreaker = STANDARD_BREAKER_RATINGS_A.find((r) => r >= designCurrent) || STANDARD_BREAKER_RATINGS_A[STANDARD_BREAKER_RATINGS_A.length - 1];
			totalConnectedKw += load;
			totalDesignLoadKw += designLoad;
			if (designCurrent > maxDesignCurrentA) maxDesignCurrentA = designCurrent;
			return {
				...row,
				designLoad,
				designCurrent,
				recBreaker
			};
		});
		const recSummaryBreaker = STANDARD_BREAKER_RATINGS_A.find((r) => r >= maxDesignCurrentA) || STANDARD_BREAKER_RATINGS_A[STANDARD_BREAKER_RATINGS_A.length - 1];
		const breakerUtilization = recSummaryBreaker > 0 ? maxDesignCurrentA / recSummaryBreaker * 100 : 0;
		return {
			rowDetails,
			totalConnectedKw,
			totalDesignLoadKw,
			maxDesignCurrentA,
			recSummaryBreaker,
			breakerUtilization: isNaN(breakerUtilization) ? 0 : breakerUtilization
		};
	}, [rows]);
	const handleAddRow = () => {
		const newRow = {
			id: Date.now().toString(),
			selected: false,
			description: `New Feeder Load`,
			connectedLoad: 10,
			voltage: 400,
			phase: "Select...",
			powerFactor: .8,
			demandFactor: 1,
			remarks: ""
		};
		setRows([...rows, newRow]);
	};
	const handleUpdateRow = (id, field, val) => {
		setRows((prev) => {
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
				setRows((prev) => prev.map((r) => ({
					...r,
					selected: false
				})));
				if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
				return;
			}
			if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT" || document.activeElement?.tagName === "TEXTAREA") return;
			if ((e.ctrlKey || e.metaKey) && e.key === "a") {
				e.preventDefault();
				setRows((prev) => prev.map((r) => ({
					...r,
					selected: true
				})));
			}
			if (e.key === "Delete" || e.key === "Backspace") setRows((prev) => prev.filter((r) => !r.selected));
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);
	const handleRowFocus = (id) => {
		setRows((prev) => {
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
		})) setRows(rows.filter((r) => !r.selected));
	};
	const handleSelectAll = (e) => {
		const checked = e.target.checked;
		setRows(rows.map((r) => ({
			...r,
			selected: checked
		})));
	};
	const handleReset = async () => {
		if (await confirm({
			title: "Reset Data",
			body: "This will clear all rows. Continue?"
		})) {
			setRows([]);
			setShowSummary(false);
		}
	};
	const handleExportJSON = () => {
		const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ rows }));
		const downloadAnchor = document.createElement("a");
		downloadAnchor.setAttribute("href", dataStr);
		downloadAnchor.setAttribute("download", `circuit_breaker_sizing_data.json`);
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
				if (parsed.rows) setRows(parsed.rows);
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
		doc.text("CIRCUIT BREAKER SIZING REPORT", 40, 50);
		doc.setFontSize(10);
		doc.setFont("helvetica", "normal");
		doc.setTextColor(100);
		doc.text(`Generated on: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`, 40, 68);
		doc.setDrawColor(200);
		doc.line(40, 75, 780, 75);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(12);
		doc.setTextColor(0);
		doc.text("1. Circuit Breaker Sizing Schedule", 40, 95);
		autoTable(doc, {
			startY: 105,
			head: [[
				"Description",
				"Load kW",
				"Volts",
				"Phase",
				"PF",
				"DF",
				"Current (A)",
				"Breaker Rating (A)",
				"Remarks"
			]],
			body: calculatedData.rowDetails.map((r) => [
				r.description,
				r.connectedLoad,
				r.voltage,
				r.phase,
				r.powerFactor,
				r.demandFactor,
				r.designCurrent.toFixed(2),
				`${r.recBreaker} A`,
				r.remarks
			]),
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
		doc.text("2. Summary", 40, doc.lastAutoTable.finalY + 25);
		const summaryData = [
			["Total Connected Load", `${calculatedData.totalConnectedKw.toFixed(1)} kW`],
			["Total Design Load", `${calculatedData.totalDesignLoadKw.toFixed(1)} kW`],
			["Peak Design Current", `${calculatedData.maxDesignCurrentA.toFixed(2)} A`]
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
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), `circuit_breaker_sizing_report.pdf`, "PDF Document", ["pdf"]);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 h-full flex flex-col bg-slate-50 dark:bg-slate-950 font-sans overflow-y-auto",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col mb-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2",
					children: ["Circuit Breaker Sizing ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-sm font-normal text-slate-400",
						children: [
							"(",
							rows.length,
							" circuits)"
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground mt-1",
					children: "Preliminary circuit breaker capacity rating sizing based on connected loads, voltage, and phase parameters."
				})]
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
						className: "flex flex-wrap items-center justify-end gap-2 mb-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: handleReset,
								className: "flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 transition-colors bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-3.5" }), " Reset"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-1 cursor-pointer transition-colors bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm",
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
								className: "flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-1 transition-colors bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" }), " Export"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: handleAddRow,
								className: "bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ml-2 shadow-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add Row"]
							}),
							rows.some((r) => r.selected) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: handleDeleteSelected,
								className: "bg-rose-600 hover:bg-rose-700 text-white rounded-full px-4 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), " Delete"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setShowSummary(true),
								className: "bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ml-1 shadow-sm",
								children: "Calculate"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-left text-xs whitespace-nowrap min-w-[1000px]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-10 text-center",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											onChange: handleSelectAll,
											checked: rows.length > 0 && rows.every((r) => r.selected),
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
										children: "Connected Load (kW)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-24",
										children: "Voltage (V)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-32",
										children: "Phase"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-28",
										children: "Power Factor"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-28",
										children: "Demand Factor"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-32",
										children: "Design Current (A)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-40",
										children: "Recommended Breaker Rating (A)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "p-3 w-32",
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
												placeholder: "e.g. New Feeder Load",
												className: "font-medium text-slate-900 dark:text-slate-100"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-slate-400 text-xs font-mono",
													children: "eg:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
													type: "number",
													value: row.connectedLoad,
													onCommit: (val) => handleUpdateRow(row.id, "connectedLoad", val === "" ? "" : Number(val)),
													onFocus: () => handleRowFocus(row.id),
													className: "text-slate-900 dark:text-slate-100"
												})]
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-slate-400 text-xs font-mono",
													children: "eg:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
													type: "number",
													value: row.voltage,
													onCommit: (val) => handleUpdateRow(row.id, "voltage", val === "" ? "" : Number(val)),
													onFocus: () => handleRowFocus(row.id),
													className: "text-slate-900 dark:text-slate-100"
												})]
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: row.phase,
												onChange: (e) => handleUpdateRow(row.id, "phase", e.target.value),
												onFocus: () => handleRowFocus(row.id),
												onClick: (e) => e.stopPropagation(),
												className: "w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded px-1 py-1 outline-none text-slate-900 dark:text-slate-100 focus:border-blue-500",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "Select...",
														children: "Select..."
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "Single Phase",
														children: "Single Phase"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "Three Phase",
														children: "Three Phase"
													})
												]
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-slate-400 text-xs font-mono",
													children: "eg:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
													type: "number",
													step: "0.01",
													value: row.powerFactor,
													onCommit: (val) => handleUpdateRow(row.id, "powerFactor", val === "" ? "" : Number(val)),
													onFocus: () => handleRowFocus(row.id),
													className: "text-slate-900 dark:text-slate-100"
												})]
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-slate-400 text-xs font-mono",
													children: "eg:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
													type: "number",
													step: "0.01",
													value: row.demandFactor,
													onCommit: (val) => handleUpdateRow(row.id, "demandFactor", val === "" ? "" : Number(val)),
													onFocus: () => handleRowFocus(row.id),
													className: "text-slate-900 dark:text-slate-100"
												})]
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-3 font-bold text-slate-700 dark:text-slate-300",
											children: row.designCurrent.toFixed(2)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
											className: "p-3 font-bold text-slate-900 dark:text-white",
											children: [row.recBreaker, " A"]
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
						}), rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-8 text-center text-slate-400 text-xs",
							children: "No loads added. Click \"Add Row\" to begin sizing."
						})]
					}),
					showSummary && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-bottom-4 fade-in duration-300",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "absolute right-3 top-3 text-slate-500/10",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-8" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1",
										children: "Total Connected Load"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
										className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
										children: [
											calculatedData.totalConnectedKw.toFixed(1),
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-sm text-slate-500 font-sans",
												children: "kW"
											})
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
										children: "Total Design Load"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
										className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
										children: [
											calculatedData.totalDesignLoadKw.toFixed(1),
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-sm text-slate-500 font-sans",
												children: "kW"
											})
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 rounded-xl p-4 shadow-sm relative overflow-hidden",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "absolute right-3 top-3 text-blue-500/20",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-8" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1",
										children: "Peak Design Current"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
										className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
										children: [
											calculatedData.maxDesignCurrentA.toFixed(2),
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-sm text-slate-500 font-sans",
												children: "A"
											})
										]
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
								children: "CIRCUIT BREAKER SIZING REPORT"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[12px] text-slate-500 font-mono mt-1",
								children: "Preliminary electrical branch circuit sizing analysis"
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
								children: "1. Connected Electrical Load & Current Sizing Schedule"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "overflow-x-auto",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
									className: "w-full text-left text-[11px] border border-collapse border-slate-200 dark:border-slate-700",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
										className: "bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[9px]",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-center",
												children: "Sr."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700",
												children: "Description"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right",
												children: "Connected (kW)"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-center",
												children: "Volts"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-center",
												children: "Phase"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-center",
												children: "PF"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-center",
												children: "DF"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right",
												children: "Current (A)"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 text-right",
												children: "Breaker Rating"
											})
										]
									}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
										className: "divide-y divide-slate-200 dark:divide-slate-700 font-mono",
										children: calculatedData.rowDetails.map((r, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-center",
												children: idx + 1
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 font-sans",
												children: r.description
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right",
												children: [r.connectedLoad !== "" ? Number(r.connectedLoad).toFixed(1) : "-", " kW"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-center",
												children: [r.voltage !== "" ? r.voltage : "-", " V"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-center",
												children: r.phase === "Three Phase" ? "3P" : r.phase === "Single Phase" ? "1P" : "-"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-center",
												children: r.powerFactor !== "" ? r.powerFactor : "-"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-center",
												children: r.demandFactor !== "" ? r.demandFactor : "-"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "p-2 border-r border-slate-200 dark:border-slate-700 text-right font-bold",
												children: [r.designCurrent.toFixed(2), " A"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "p-2 text-right font-bold",
												children: [r.recBreaker, " A"]
											})
										] }, r.id))
									})]
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 pb-6 border-b border-border/80",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-bold text-[13px] text-slate-900 dark:text-white mb-3",
								children: "2. Sizing Summary Calculations"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50 text-xs flex flex-col gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-slate-500",
											children: "Total Connected load:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "font-mono",
											children: [calculatedData.totalConnectedKw.toFixed(1), " kW"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-slate-500",
											children: "Total Design load:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "font-mono",
											children: [calculatedData.totalDesignLoadKw.toFixed(1), " kW"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 mt-1 font-semibold text-primary",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Peak Design Current:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "font-mono text-sm",
											children: [calculatedData.maxDesignCurrentA.toFixed(2), " A"]
										})]
									})
								]
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-bold text-[13px] text-slate-900 dark:text-white mb-3",
								children: "3. Applicable Sizing Formulae"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-1 gap-3 text-[11px] font-mono bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700 rounded-lg",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-semibold font-sans text-slate-700 dark:text-slate-300",
										children: "Design load (kW):"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-blue-600 dark:text-blue-400",
										children: "Design Load = Connected Load * Demand Factor"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-semibold font-sans text-slate-700 dark:text-slate-300",
										children: "Single Phase Current (A):"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-blue-600 dark:text-blue-400",
										children: "Current = (Design Load * 1000) / (Voltage * PF)"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-semibold font-sans text-slate-700 dark:text-slate-300",
										children: "Three Phase Current (A):"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-blue-600 dark:text-blue-400",
										children: "Current = (Design Load * 1000) / (sqrt(3) * Voltage * PF)"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-semibold font-sans text-slate-700 dark:text-slate-300",
										children: "Standard Selection:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-blue-600 dark:text-blue-400",
										children: "Breaker Rating = Next higher standard rating >= Current"
									})] })
								]
							})] })]
						})
					]
				})]
			})
		]
	}) });
}
//#endregion
export { CircuitBreakerSizingPage as component };
