import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { M as Printer, N as Plus, Ut as TriangleAlert, k as RefreshCw, lt as FileText, m as Trash2, rt as Gauge, xt as Copy } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { a as ContextMenuSeparator, i as ContextMenuItem, r as ContextMenuContent, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { t as ImportExcelBtn } from "./ImportExcelBtn-rAnQAoVD.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
import { t as DataGrid } from "./DataGrid-kg4gScDe.mjs";
import { a as useShortcuts, i as useSelection, n as useClipboard, r as useHistory } from "./useShortcuts-D4qmUsvw.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/short-circuit-calculations-CvzeCPY7.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
require_excel();
import_FileSaver_min.default.saveAs;
function InlineInput({ value, onCommit, className = "", type = "text", step, min }) {
	const handleKeyDown = (e) => {
		if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		step,
		min,
		value,
		onChange: (e) => onCommit(e.target.value),
		onKeyDown: handleKeyDown,
		onClick: (e) => e.stopPropagation(),
		onDoubleClick: (e) => e.stopPropagation(),
		className: `bg-transparent w-full border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-foreground transition-colors cursor-text ${className}`
	});
}
var TABS = [{
	id: "schedule",
	label: "Sizing Schedule"
}, {
	id: "report",
	label: "Report"
}];
var IEC_CABLE_SIZES = [
	1.5,
	2.5,
	4,
	6,
	10,
	16,
	25,
	35,
	50,
	70,
	95,
	120,
	150,
	185,
	240,
	300,
	400,
	500,
	630
];
var STANDARD_REACTANCE_LOOKUP = (size) => {
	if (size <= 16) return .1;
	if (size <= 95) return .09;
	if (size <= 300) return .08;
	return .075;
};
function ShortCircuitCalculationsPage() {
	const confirm = useConfirm();
	const [tab, setTab] = (0, import_react.useState)("schedule");
	const [sourceFaultLevel, setSourceFaultLevel] = (0, import_react.useState)(25);
	const [nominalVoltage, setNominalVoltage] = (0, import_react.useState)(400);
	const [sourceXrRatio, setSourceXrRatio] = (0, import_react.useState)(10);
	const initialRows = (0, import_react.useMemo)(() => [
		{
			id: "1",
			description: "Main Feeder Cable",
			length: 45,
			runs: 2,
			size: 240,
			voltage: 400,
			material: "Copper",
			remarks: "Incomer from Transformer"
		},
		{
			id: "2",
			description: "Submain Feeder to DB-1",
			length: 65,
			runs: 1,
			size: 95,
			voltage: 400,
			material: "Copper",
			remarks: "L1 DB supply"
		},
		{
			id: "3",
			description: "DB-1 final submain link",
			length: 30,
			runs: 1,
			size: 16,
			voltage: 400,
			material: "Copper",
			remarks: "Critical load supply"
		}
	], []);
	const { currentState, pushState: setRows, undo, redo } = useHistory(initialRows);
	const rows = currentState || initialRows || [];
	const { selectedIds: selected, toggleSelection, selectAll, clearSelection } = useSelection(rows);
	const { copy, cut, paste } = useClipboard(rows, selected, setRows);
	const calculatedData = (0, import_react.useMemo)(() => {
		const vLL = nominalVoltage || 400;
		const iScSource = sourceFaultLevel || 25;
		const xr = sourceXrRatio || 10;
		const zSource = vLL / (Math.sqrt(3) * iScSource * 1e3);
		const angle = Math.atan(xr);
		const rSource = zSource * Math.cos(angle);
		const xSource = zSource * Math.sin(angle);
		let totalCableLength = 0;
		let totalR = 0;
		let totalX = 0;
		let currentSumR = rSource;
		let currentSumX = xSource;
		const rowDetails = rows.map((r) => {
			const L = r.length || 0;
			const N = r.runs || 1;
			const A = r.size || 1.5;
			const V = r.voltage || 400;
			const segmentR = (r.material === "Copper" ? .01724 : .0282) * (1 + (r.material === "Copper" ? .00393 : .00403) * 50) * L / (A * N);
			const segmentX = STANDARD_REACTANCE_LOOKUP(A) * L / (1e3 * N);
			const segmentZ = Math.sqrt(Math.pow(segmentR, 2) + Math.pow(segmentX, 2));
			totalCableLength += L;
			totalR += segmentR;
			totalX += segmentX;
			currentSumR += segmentR;
			currentSumX += segmentX;
			const runningZ = Math.sqrt(Math.pow(currentSumR, 2) + Math.pow(currentSumX, 2));
			const isc = runningZ > 0 ? V / (Math.sqrt(3) * runningZ * 1e3) : 0;
			return {
				id: r.id,
				segmentR,
				segmentX,
				segmentZ,
				runningSumR: currentSumR,
				runningSumX: currentSumX,
				runningSumZ: runningZ,
				isc
			};
		});
		const totalZ = Math.sqrt(Math.pow(totalR, 2) + Math.pow(totalX, 2));
		const finalIsc = rowDetails.length > 0 ? rowDetails[rowDetails.length - 1].isc : iScSource;
		return {
			rSource,
			xSource,
			zSource,
			totalCableLength,
			totalR,
			totalX,
			totalZ,
			finalIsc,
			rowDetails
		};
	}, [
		rows,
		sourceFaultLevel,
		nominalVoltage,
		sourceXrRatio
	]);
	const validations = (0, import_react.useMemo)(() => {
		const logs = [];
		const zeroLength = rows.some((r) => r.length <= 0);
		const zeroRuns = rows.some((r) => r.runs <= 0);
		const zeroSize = rows.some((r) => r.size <= 0);
		const zeroVoltage = rows.some((r) => r.voltage <= 0);
		if (zeroLength) logs.push({
			type: "warning",
			msg: "One or more cables have length of zero or blank."
		});
		if (zeroRuns) logs.push({
			type: "danger",
			msg: "Number of parallel runs must be 1 or greater."
		});
		if (zeroSize) logs.push({
			type: "danger",
			msg: "Cable size must be a valid cross-sectional area (mm²)."
		});
		if (zeroVoltage) logs.push({
			type: "danger",
			msg: "Voltage rating must be greater than zero."
		});
		if (sourceFaultLevel <= 0) logs.push({
			type: "danger",
			msg: "Source short circuit fault level must be greater than zero."
		});
		if (nominalVoltage <= 0) logs.push({
			type: "danger",
			msg: "Nominal voltage must be greater than zero."
		});
		if (sourceXrRatio <= 0) logs.push({
			type: "warning",
			msg: "Source X/R ratio is zero or negative. Sizing calculations might be slightly skewed."
		});
		if (calculatedData.finalIsc > 100) logs.push({
			type: "warning",
			msg: "Calculated fault current exceeds 100 kA. Ensure switchgear rating compliance."
		});
		else if (calculatedData.finalIsc < .1) logs.push({
			type: "warning",
			msg: "Calculated fault current is unusually low (less than 100 A)."
		});
		return logs;
	}, [
		rows,
		sourceFaultLevel,
		nominalVoltage,
		sourceXrRatio,
		calculatedData
	]);
	const handleAddRow = () => {
		const nextId = "row-" + Date.now() + Math.random().toString(36).substr(2, 5);
		setRows([...rows, {
			id: nextId,
			description: "New Cable Section",
			length: 30,
			runs: 1,
			size: 95,
			voltage: 400,
			material: "Copper",
			remarks: ""
		}]);
	};
	const handleDuplicateRow = (row) => {
		const nextId = "row-" + Date.now() + Math.random().toString(36).substr(2, 5);
		setRows([...rows, {
			...row,
			id: nextId,
			description: `${row.description} (Copy)`
		}]);
	};
	const handleDeleteRow = (id) => {
		setRows(rows.filter((r) => r.id !== id));
		clearSelection();
	};
	const handleUpdateRow = (id, field, val) => {
		const isBulkEdit = selected.has(id);
		setRows(rows.map((r) => r.id === id || isBulkEdit && selected.has(r.id) ? {
			...r,
			[field]: val
		} : r));
	};
	const handleReset = async () => {
		if (await confirm("Are you sure you want to reset all calculations to defaults?")) {
			setRows([{
				id: "1",
				description: "Main Feeder Cable",
				length: 45,
				runs: 2,
				size: 240,
				voltage: 400,
				material: "Copper",
				remarks: "Incomer from Transformer"
			}, {
				id: "2",
				description: "Submain Feeder to DB-1",
				length: 65,
				runs: 1,
				size: 95,
				voltage: 400,
				material: "Copper",
				remarks: "L1 DB supply"
			}]);
			setSourceFaultLevel(25);
			setNominalVoltage(400);
			setSourceXrRatio(10);
			clearSelection();
		}
	};
	const handleToggle = (id, isShift, isCtrl) => {
		toggleSelection(id, !!isCtrl, !!isShift);
	};
	const handleToggleAll = () => {
		if (selected.size === rows.length) clearSelection();
		else selectAll();
	};
	const handleImportExcelRows = (mappedRows) => {
		const newRows = mappedRows.map((mr, idx) => {
			const mat = String(mr.material || "").toLowerCase().includes("al") ? "Aluminium" : "Copper";
			return {
				id: `imported-${idx}-${Date.now()}`,
				description: mr.description || `Imported Segment ${idx + 1}`,
				length: Number(mr.length) || 30,
				runs: Number(mr.runs) || 1,
				size: Number(mr.size) || 95,
				voltage: Number(mr.voltage) || 400,
				material: mat,
				remarks: mr.remarks || ""
			};
		});
		if (newRows.length > 0) setRows([...rows, ...newRows]);
	};
	const handleExportPDF = () => {
		const doc = new import_jspdf_node_min.default("p", "mm", "a4");
		doc.setFillColor(15, 23, 42);
		doc.rect(0, 0, 210, 25, "F");
		doc.setTextColor(255, 255, 255);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(13);
		doc.text("SHORT CIRCUIT CURRENT SIZING REPORT", 14, 11);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8.5);
		doc.text(`Generated: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`, 14, 18);
		doc.setTextColor(15, 23, 42);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(9.5);
		doc.text("DESIGN CRITERIA", 14, 34);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8.5);
		doc.text(`Source Fault Level: ${sourceFaultLevel} kA | Nominal Voltage: ${nominalVoltage} V | Source X/R: ${sourceXrRatio}`, 14, 40);
		doc.setFont("helvetica", "bold");
		doc.text("CABLE RUN PARAMETERS & CALCULATED FAULT LEVEL", 14, 52);
		autoTable(doc, {
			startY: 56,
			head: [[
				"Sr.",
				"Description",
				"Length",
				"Runs",
				"Size",
				"Material",
				"R (mΩ)",
				"Z (mΩ)",
				"Running ΣZ",
				"Isc (kA)"
			]],
			body: rows.map((r, idx) => {
				const d = calculatedData.rowDetails[idx] || {
					segmentR: 0,
					segmentZ: 0,
					runningSumZ: 0,
					isc: 0
				};
				return [
					idx + 1,
					r.description,
					`${r.length} m`,
					r.runs,
					`${r.size} mm²`,
					r.material,
					(d.segmentR * 1e3).toFixed(2),
					(d.segmentZ * 1e3).toFixed(2),
					(d.runningSumZ * 1e3).toFixed(2),
					d.isc.toFixed(3)
				];
			}),
			theme: "striped",
			headStyles: {
				fillColor: [
					51,
					65,
					85
				],
				fontSize: 8
			},
			styles: { fontSize: 8 }
		});
		let nextY = doc.lastAutoTable.finalY + 10;
		doc.setFont("helvetica", "bold");
		doc.text("CALCULATION RESULTS SUMMARY", 14, nextY);
		nextY += 4;
		const summaryData = [
			["Total Cable Length", `${calculatedData.totalCableLength.toFixed(1)} m`],
			["Total Resistance", `${calculatedData.totalR.toFixed(5)} Ω`],
			["Total Reactance", `${calculatedData.totalX.toFixed(5)} Ω`],
			["Total Impedance", `${calculatedData.totalZ.toFixed(5)} Ω`],
			["Final Sized Short Circuit Current", `${calculatedData.finalIsc.toFixed(3)} kVA`]
		];
		autoTable(doc, {
			startY: nextY,
			body: summaryData,
			theme: "plain",
			styles: { fontSize: 8.5 },
			columnStyles: {
				0: {
					fontStyle: "bold",
					cellWidth: 80
				},
				1: { cellWidth: 50 }
			}
		});
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), "Short_Circuit_Report.pdf", "PDF Document", ["pdf"]);
	};
	const columns = (0, import_react.useMemo)(() => [
		{
			key: "index",
			header: "Sr. No.",
			width: 60,
			align: "center",
			render: (r) => {
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted-foreground font-mono",
					children: rows.findIndex((row) => row.id === r.id) + 1
				});
			}
		},
		{
			key: "description",
			header: "Description",
			width: 200,
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				value: r.description,
				onCommit: (val) => handleUpdateRow(r.id, "description", val),
				className: "font-medium text-[13px]"
			})
		},
		{
			key: "length",
			header: "Cable Length (m)",
			width: 120,
			align: "center",
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: r.length,
				onCommit: (val) => handleUpdateRow(r.id, "length", Number(val) || 0),
				className: "font-mono text-center text-[12.5px]"
			})
		},
		{
			key: "runs",
			header: "Number of Parallel Runs",
			width: 160,
			align: "center",
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: r.runs,
				onCommit: (val) => handleUpdateRow(r.id, "runs", Number(val) || 1),
				className: "font-mono text-center text-[12.5px]"
			})
		},
		{
			key: "size",
			header: "Cable Size (mm²)",
			width: 140,
			align: "center",
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
				value: r.size,
				onChange: (e) => handleUpdateRow(r.id, "size", Number(e.target.value)),
				className: "bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none py-0.5 px-1 rounded text-foreground text-center font-mono text-[12.5px] cursor-pointer",
				children: IEC_CABLE_SIZES.map((sz) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: sz,
					className: "bg-popover text-foreground",
					children: sz
				}, sz))
			})
		},
		{
			key: "voltage",
			header: "Voltage (V)",
			width: 100,
			align: "center",
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: r.voltage,
				onCommit: (val) => handleUpdateRow(r.id, "voltage", Number(val) || 400),
				className: "font-mono text-center text-[12.5px]"
			})
		},
		{
			key: "material",
			header: "Cable Material",
			width: 120,
			align: "center",
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				value: r.material,
				onChange: (e) => handleUpdateRow(r.id, "material", e.target.value),
				className: "bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none py-0.5 px-1 rounded text-foreground text-center font-semibold text-[12.5px] cursor-pointer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "Copper",
					className: "bg-popover text-foreground",
					children: "Copper"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "Aluminium",
					className: "bg-popover text-foreground",
					children: "Aluminium"
				})]
			})
		},
		{
			key: "resistance",
			header: "Resistance (Ω)",
			width: 130,
			align: "right",
			render: (r) => {
				const idx = rows.findIndex((row) => row.id === r.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-muted-foreground text-[12.5px]",
					children: (calculatedData.rowDetails[idx] || { segmentR: 0 }).segmentR.toFixed(5)
				});
			}
		},
		{
			key: "impedance",
			header: "Impedance (Ω)",
			width: 130,
			align: "right",
			render: (r) => {
				const idx = rows.findIndex((row) => row.id === r.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-muted-foreground text-[12.5px]",
					children: (calculatedData.rowDetails[idx] || { segmentZ: 0 }).segmentZ.toFixed(5)
				});
			}
		},
		{
			key: "runningSumR",
			header: "Running ΣR",
			width: 120,
			align: "right",
			render: (r) => {
				const idx = rows.findIndex((row) => row.id === r.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-muted-foreground text-[12.5px]",
					children: (calculatedData.rowDetails[idx] || { runningSumR: 0 }).runningSumR.toFixed(5)
				});
			}
		},
		{
			key: "runningSumX",
			header: "Running ΣX",
			width: 120,
			align: "right",
			render: (r) => {
				const idx = rows.findIndex((row) => row.id === r.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-muted-foreground text-[12.5px]",
					children: (calculatedData.rowDetails[idx] || { runningSumX: 0 }).runningSumX.toFixed(5)
				});
			}
		},
		{
			key: "isc",
			header: "Short Circuit Current (kA)",
			width: 180,
			align: "right",
			render: (r) => {
				const idx = rows.findIndex((row) => row.id === r.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono font-bold text-foreground text-[12.5px]",
					children: (calculatedData.rowDetails[idx] || { isc: 0 }).isc.toFixed(3)
				});
			}
		},
		{
			key: "remarks",
			header: "Remarks",
			width: 180,
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				value: r.remarks,
				onCommit: (val) => handleUpdateRow(r.id, "remarks", val),
				className: "text-muted-foreground text-[12px]"
			})
		}
	], [
		rows,
		calculatedData,
		selected
	]);
	const renderRowContextMenu = (row) => {
		const selectedIds = selected.has(row.id) ? Array.from(selected) : [row.id];
		const targetsCount = selectedIds.length;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuContent, {
			className: "w-48 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50",
			children: targetsCount > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
				onClick: async () => {
					if (await confirm(`Are you sure you want to delete ${targetsCount} selected rows?`)) {
						setRows(rows.filter((r) => !selectedIds.includes(r.id)));
						clearSelection();
					}
				},
				className: "flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-red-500 font-semibold",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }),
					" Delete Selected (",
					targetsCount,
					")"
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: () => handleDuplicateRow(row),
					className: "flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" }), " Duplicate Row"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, { className: "my-1 border-t border-border" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: async () => {
						if (await confirm("Are you sure you want to delete this row?")) handleDeleteRow(row.id);
					},
					className: "flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-red-500 font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), " Delete Row"]
				})
			] })
		});
	};
	useShortcuts({
		onUndo: undo,
		onRedo: redo,
		onCopy: copy,
		onCut: cut,
		onPaste: paste,
		onSelectAll: selectAll,
		onClearSelection: clearSelection,
		onDelete: () => {
			if (selected.size === 0) return;
			setRows(rows.filter((r) => !selected.has(r.id)));
			clearSelection();
		},
		onDuplicate: () => {
			if (selected.size === 0) return;
			const duplicated = [];
			rows.forEach((r) => {
				if (selected.has(r.id)) duplicated.push({
					...r,
					id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
					description: `${r.description} (Copy)`
				});
			});
			setRows([...rows, ...duplicated]);
		},
		onNewRow: handleAddRow,
		onPrint: handleExportPDF,
		onExportPdf: handleExportPDF
	});
	(0, import_react.useEffect)(() => {
		const handleEscapeKeyDown = (e) => {
			if (e.key === "Escape") {
				const activeEl = document.activeElement;
				if (!(activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT" || activeEl.tagName === "TEXTAREA" || activeEl.getAttribute("contenteditable") === "true"))) clearSelection();
			}
		};
		window.addEventListener("keydown", handleEscapeKeyDown);
		return () => {
			window.removeEventListener("keydown", handleEscapeKeyDown);
		};
	}, [clearSelection]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Short Circuit Sizing",
		hideSubHeader: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-full min-h-0 bg-transparent",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-between items-start shrink-0 select-none no-print modal-blur-bg",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1 w-full",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
								children: "ELECTRICAL > SHORT CIRCUIT CURRENT CALCULATOR"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center gap-3 mt-0.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-baseline gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
										className: "text-[28px] font-bold tracking-tight text-foreground",
										children: "Short Circuit Calculator"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[15px] font-semibold text-muted-foreground",
										children: [rows.length, " segments"]
									})]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground mt-0.5",
								children: "IEC 60909 prospective short-circuit current calculator at the end of a cascading cable run."
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex-1 flex flex-col gap-6 min-h-[450px] mb-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80",
								children: TABS.map((t) => {
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => setTab(t.id),
										className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${t.id === tab ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
										children: t.label
									}, t.id);
								})
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 relative min-h-0 overflow-hidden",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `absolute inset-0 flex flex-col min-h-0 transition-all duration-350 ease-in-out ${tab === "schedule" ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 -translate-x-4 pointer-events-none"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-border/80 select-none shrink-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap items-center gap-6 text-xs font-semibold",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground uppercase tracking-wider text-[10.5px]",
													children: "Source Fault Level:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														value: sourceFaultLevel,
														onChange: (e) => setSourceFaultLevel(Number(e.target.value)),
														className: "w-16 bg-background border border-border rounded-l px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none border-r-0"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "bg-slate-100 dark:bg-slate-800 border border-border border-l-0 rounded-r px-2 py-1 font-bold text-slate-500 font-mono text-xs",
														children: "kA"
													})]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground uppercase tracking-wider text-[10.5px]",
													children: "Nominal Voltage:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														value: nominalVoltage,
														onChange: (e) => setNominalVoltage(Number(e.target.value)),
														className: "w-16 bg-background border border-border rounded-l px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none border-r-0"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "bg-slate-100 dark:bg-slate-800 border border-border border-l-0 rounded-r px-2 py-1 font-bold text-slate-500 font-mono text-xs",
														children: "V"
													})]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground uppercase tracking-wider text-[10.5px]",
													children: "Source X/R Ratio:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													value: sourceXrRatio,
													onChange: (e) => setSourceXrRatio(Number(e.target.value)),
													className: "w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none"
												})]
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
												onClick: handleReset,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3.5" }), " Reset"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportExcelBtn, {
												columnMapping: {
													"Description": "description",
													"Cable Length (m)": "length",
													"Length": "length",
													"Number of Parallel Runs": "runs",
													"Runs": "runs",
													"Cable Size (mm²)": "size",
													"Size": "size",
													"Voltage (V)": "voltage",
													"Voltage": "voltage",
													"Cable Material": "material",
													"Material": "material",
													"Remarks": "remarks"
												},
												onImport: handleImportExcelRows
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
												primary: true,
												onClick: handleAddRow,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add Row"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
												primary: true,
												onClick: () => setTab("report"),
												className: "bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all duration-200 transform hover:scale-102 active:scale-98",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gauge, { className: "size-3.5" }), " Calculate"]
											})
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex-1 min-h-[350px]",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataGrid, {
										rows,
										columns,
										selected,
										onToggle: handleToggle,
										onToggleAll: handleToggleAll,
										renderContextMenu: renderRowContextMenu
									})
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `absolute inset-0 overflow-y-auto bg-slate-100 dark:bg-slate-950 p-8 flex flex-col items-center gap-6 print:bg-white print:p-0 transition-all duration-350 ease-in-out ${tab === "report" ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-4 pointer-events-none"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "w-full max-w-[210mm] flex items-center justify-between px-3 h-10 shrink-0 select-none no-print bg-white dark:bg-slate-900 border border-border rounded-xl shadow-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[12px] text-muted-foreground font-sans",
											children: ["Generated: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-foreground font-mono",
												children: (/* @__PURE__ */ new Date()).toLocaleDateString()
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
												onClick: handleExportPDF,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-3.5" }), " Print"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
												primary: true,
												onClick: handleExportPDF,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5" }), " Export PDF"]
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "w-full max-w-[210mm] grid grid-cols-2 md:grid-cols-5 gap-4 select-none no-print",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block",
													children: "Total Length"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "mt-2.5",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-[15px] font-bold font-mono text-foreground block",
														children: [calculatedData.totalCableLength.toFixed(1), " m"]
													})
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block",
													children: "Total Resistance"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "mt-2.5",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-[15px] font-bold font-mono text-foreground block",
														children: [calculatedData.totalR.toFixed(5), " Ω"]
													})
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block",
													children: "Total Reactance"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "mt-2.5",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-[15px] font-bold font-mono text-foreground block",
														children: [calculatedData.totalX.toFixed(5), " Ω"]
													})
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block",
													children: "Total Impedance"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "mt-2.5",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-[15px] font-bold font-mono text-foreground block",
														children: [calculatedData.totalZ.toFixed(5), " Ω"]
													})
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 flex flex-col justify-between shadow-md relative overflow-hidden",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9.5px] font-bold text-slate-400 uppercase tracking-wider",
													children: "Final Isc (kA)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "mt-2",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-[16px] font-black font-mono tracking-tight text-white block",
														children: [calculatedData.finalIsc.toFixed(3), " kA"]
													})
												})]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "w-[210mm] min-h-[297mm] bg-white dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800/60 rounded-xl p-10 shadow-lg text-slate-800 dark:text-slate-200 print:border-none print:shadow-none print:rounded-none print:p-0",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "border-b-2 border-slate-900 dark:border-slate-700 pb-5 mb-6",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-start",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
														className: "text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase font-sans",
														children: "Short Circuit Calculation Report"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-[11px] text-muted-foreground mt-1",
														children: "Preliminary electrical short circuit current analysis sheet"
													})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-right",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "inline-flex items-center px-3 py-1 rounded bg-slate-900 text-white dark:bg-slate-800 text-xs font-bold font-mono",
															children: [calculatedData.finalIsc.toFixed(3), " kA Final Fault"]
														})
													})]
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-2 gap-6 text-[12px] mb-8 pb-6 border-b border-border/80",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
														className: "font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1.5",
														children: "Source Parameters"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Utility Fault Level:" }),
														" ",
														sourceFaultLevel,
														" kA"
													] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Nominal Voltage:" }),
														" ",
														nominalVoltage,
														" V"
													] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Source X/R Ratio:" }),
														" ",
														sourceXrRatio
													] })
												] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-right",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Generated Date:" }),
														" ",
														(/* @__PURE__ */ new Date()).toLocaleDateString()
													] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
														className: "mt-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Standards Reference:" }), " IEC 60909"]
													})]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mb-8 font-sans",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "font-bold text-[13px] text-slate-900 dark:text-white mb-3",
													children: "1. Connected Cable Runs & Impedance Schedule"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
													className: "w-full text-[10.5px] text-left border border-slate-200 dark:border-slate-800",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
														className: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[9px] tracking-wider",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
															className: "border-b border-slate-200 dark:border-slate-800",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2 text-center w-10 font-mono",
																	children: "Sr."
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2",
																	children: "Description"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2 text-center",
																	children: "Length"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2 text-center",
																	children: "Runs"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2 text-center",
																	children: "Size"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2 text-center",
																	children: "Material"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2 text-right",
																	children: "R (Ω)"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2 text-right",
																	children: "Z (Ω)"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2 text-right",
																	children: "Running ΣZ"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2 text-right",
																	children: "Isc (kA)"
																})
															]
														})
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
														className: "divide-y divide-slate-200 dark:divide-slate-800",
														children: rows.map((r, idx) => {
															const details = calculatedData.rowDetails[idx] || {
																segmentR: 0,
																segmentZ: 0,
																runningSumZ: 0,
																isc: 0
															};
															return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1.5 text-center font-mono",
																	children: idx + 1
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1.5 font-medium",
																	children: r.description
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																	className: "px-2 py-1.5 text-center font-mono",
																	children: [r.length, " m"]
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1.5 text-center font-mono",
																	children: r.runs
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																	className: "px-2 py-1.5 text-center font-mono",
																	children: [r.size, " mm²"]
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1.5 text-center",
																	children: r.material
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1.5 text-right font-mono",
																	children: details.segmentR.toFixed(5)
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1.5 text-right font-mono",
																	children: details.segmentZ.toFixed(5)
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1.5 text-right font-mono",
																	children: details.runningSumZ.toFixed(5)
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1.5 text-right font-mono font-bold text-slate-900 dark:text-white",
																	children: details.isc.toFixed(3)
																})
															] }, r.id);
														})
													})]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-1 md:grid-cols-2 gap-6 text-[12px] mb-8 border-b border-border/80 pb-6",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "font-bold text-[13px] text-slate-900 dark:text-white mb-3",
													children: "2. Sizing Summary Results"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total Cable Length:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono",
																children: [calculatedData.totalCableLength.toFixed(1), " m"]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total Cascade Resistance:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono",
																children: [calculatedData.totalR.toFixed(5), " Ω"]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total Cascade Reactance:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono",
																children: [calculatedData.totalX.toFixed(5), " Ω"]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5 mt-1 font-semibold text-primary",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Final Short Circuit Current:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono text-sm",
																children: [calculatedData.finalIsc.toFixed(3), " kA"]
															})]
														})
													]
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "font-bold text-[13px] text-slate-900 dark:text-white mb-3",
													children: "3. Source Baseline Impedance"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Source R:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono",
																children: [calculatedData.rSource.toFixed(6), " Ω"]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Source X:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono",
																children: [calculatedData.xSource.toFixed(6), " Ω"]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Source Impedance (Zs):" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono",
																children: [calculatedData.zSource.toFixed(6), " Ω"]
															})]
														})
													]
												})] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mb-8 border-b border-border/80 pb-6",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "font-bold text-[13px] text-slate-900 dark:text-white mb-3",
													children: "4. Applicable Sizing Formulae"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid grid-cols-2 gap-4 text-xs font-mono",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "font-semibold font-sans text-foreground",
															children: "Conductor Resistance:"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-primary",
															children: "R = (rho_T * L) / (Size * Runs)"
														})] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "font-semibold font-sans text-foreground",
															children: "Running Impedance Cascade:"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-primary",
															children: "Running ΣZ = sqrt((ΣR_cables + R_s)^2 + (ΣX_cables + X_s)^2)"
														})] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "mt-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																className: "font-semibold font-sans text-foreground",
																children: "Conductor Reactance:"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-primary",
																children: "X = (X_std * L) / (1000 * Runs)"
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "mt-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																className: "font-semibold font-sans text-foreground",
																children: "Short Circuit Current (kA):"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-primary",
																children: "Isc = V / (sqrt(3) * Running ΣZ * 1000)"
															})]
														})
													]
												})]
											}),
											validations.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mb-8 border-b border-border/80 pb-6",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "font-bold text-[13px] text-slate-900 dark:text-white mb-3 text-red-500",
													children: "5. Sizing Validations & Warnings"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "flex flex-col gap-2",
													children: validations.map((v, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: v.msg })]
													}, idx))
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mt-16 pt-8 flex justify-between items-end text-[11px] text-muted-foreground select-none",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Designed By: ___________________________" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "mt-2",
													children: "Checked By: ___________________________"
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-right",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Calculation Engine Ver: 4.0.0 (Simple)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "mt-1",
														children: "© MEP Calculator, All Rights Reserved"
													})]
												})]
											})
										]
									})
								]
							})]
						})]
					})
				})]
			})
		})
	});
}
//#endregion
export { ShortCircuitCalculationsPage as component };
