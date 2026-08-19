import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { M as Printer, N as Plus, Ut as TriangleAlert, k as RefreshCw, lt as FileText, m as Trash2, rt as Gauge, xt as Copy } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { a as ContextMenuSeparator, i as ContextMenuItem, r as ContextMenuContent, t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
import { t as addPdfSignatureBlock } from "./pdfHelpers-Cqwarpxq.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { t as ImportExcelBtn } from "./ImportExcelBtn-rAnQAoVD.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
import { t as DataGrid } from "./DataGrid-Ct9FtLBj.mjs";
import { a as useShortcuts, i as useSelection, n as useClipboard, r as useHistory } from "./useShortcuts-D4qmUsvw.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/central-battery-sizing-Dc79vHVJ.js
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
var STANDARD_CBS_SIZES = [
	5,
	10,
	15,
	20,
	30,
	40,
	50,
	60,
	80,
	100,
	120,
	160,
	200,
	250,
	315,
	400
];
function CentralBatterySizingPage() {
	const { userData, profile } = useAuth();
	const currentUserName = userData?.name || profile?.name || "System Admin";
	const confirm = useConfirm();
	const [tab, setTab] = (0, import_react.useState)("schedule");
	const [loadingFactor, setLoadingFactor] = (0, import_react.useState)(.9);
	const [powerFactor, setPowerFactor] = (0, import_react.useState)(.8);
	const [spareCapacity, setSpareCapacity] = (0, import_react.useState)(20);
	const initialRows = (0, import_react.useMemo)(() => [
		{
			id: "1",
			description: "Ground Floor Corridor Lighting",
			emLightQty: 15,
			emLightW: 18,
			exitLightQty: 4,
			exitLightW: 8,
			remarks: "Safety critical path"
		},
		{
			id: "2",
			description: "L1 Staircase A and B Pressurized",
			emLightQty: 10,
			emLightW: 24,
			exitLightQty: 2,
			exitLightW: 8,
			remarks: "Escape stairs"
		},
		{
			id: "3",
			description: "Basement Parking Emergency Zones",
			emLightQty: 30,
			emLightW: 36,
			exitLightQty: 8,
			exitLightW: 8,
			remarks: "Low ceiling lighting"
		}
	], []);
	const { currentState, pushState: setRows, undo, redo } = useHistory(initialRows);
	const rows = currentState || initialRows || [];
	const { selectedIds: selected, toggleSelection, selectAll, clearSelection } = useSelection(rows);
	const { copy, cut, paste } = useClipboard(rows, selected, setRows);
	const calculatedData = (0, import_react.useMemo)(() => {
		let totalConnectedW = 0;
		rows.forEach((r) => {
			const emQty = r.emLightQty || 0;
			const emW = r.emLightW || 0;
			const exitQty = r.exitLightQty || 0;
			const exitW = r.exitLightW || 0;
			const rowConnected = emQty * emW + exitQty * exitW;
			totalConnectedW += rowConnected;
		});
		const totalConnectedKw = totalConnectedW / 1e3;
		const totalLoadAfterLFFactorKw = totalConnectedKw / (loadingFactor <= 0 ? .9 : loadingFactor);
		const batteryRatingKva = totalLoadAfterLFFactorKw / (powerFactor <= 0 ? .8 : powerFactor);
		const finalRecommendedKva = batteryRatingKva * (1 + spareCapacity / 100);
		const recStandardSize = STANDARD_CBS_SIZES.find((size) => size >= finalRecommendedKva) || 400;
		return {
			totalConnectedW,
			totalConnectedKw,
			totalLoadAfterLFFactorKw,
			batteryRatingKva,
			finalRecommendedKva,
			recStandardSize
		};
	}, [
		rows,
		loadingFactor,
		powerFactor,
		spareCapacity
	]);
	const validations = (0, import_react.useMemo)(() => {
		const logs = [];
		const zeroQty = rows.some((r) => r.emLightQty < 0 || r.exitLightQty < 0);
		const missingQty = rows.some((r) => r.emLightQty === 0 && r.exitLightQty === 0);
		const missingW = rows.some((r) => r.emLightQty > 0 && r.emLightW <= 0) || rows.some((r) => r.exitLightQty > 0 && r.exitLightW <= 0);
		if (missingQty) logs.push({
			type: "warning",
			msg: "One or more loads have zero emergency and exit lighting quantities."
		});
		if (zeroQty) logs.push({
			type: "danger",
			msg: "Lighting quantity cannot be negative."
		});
		if (missingW) logs.push({
			type: "warning",
			msg: "Wattage is missing for one or more active lighting fixtures."
		});
		if (loadingFactor <= 0) logs.push({
			type: "danger",
			msg: "Loading factor cannot be zero or negative."
		});
		else if (loadingFactor > 1) logs.push({
			type: "warning",
			msg: "Loading factor is greater than 1.0. Typically, loading should be 1.0 or less."
		});
		if (powerFactor <= 0) logs.push({
			type: "danger",
			msg: "Power factor cannot be zero."
		});
		else if (powerFactor > 1 || powerFactor < 0) logs.push({
			type: "danger",
			msg: "Power factor must be between 0.0 and 1.0."
		});
		if (spareCapacity < 0) logs.push({
			type: "warning",
			msg: "Spare capacity is negative. Consider adding safety margins."
		});
		return logs;
	}, [
		rows,
		loadingFactor,
		powerFactor,
		spareCapacity
	]);
	const handleAddRow = () => {
		const nextId = "row-" + Date.now() + Math.random().toString(36).substr(2, 5);
		setRows([...rows, {
			id: nextId,
			description: "New Escape Light Area",
			emLightQty: 5,
			emLightW: 18,
			exitLightQty: 1,
			exitLightW: 8,
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
				description: "Ground Floor Corridor Lighting",
				emLightQty: 15,
				emLightW: 18,
				exitLightQty: 4,
				exitLightW: 8,
				remarks: "Safety critical path"
			}, {
				id: "2",
				description: "L1 Staircase A and B Pressurized",
				emLightQty: 10,
				emLightW: 24,
				exitLightQty: 2,
				exitLightW: 8,
				remarks: "Escape stairs"
			}]);
			setLoadingFactor(.9);
			setPowerFactor(.8);
			setSpareCapacity(20);
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
	const handleExportPDF = () => {
		const doc = new import_jspdf_node_min.default("p", "mm", "a4");
		doc.setFillColor(15, 23, 42);
		doc.rect(0, 0, 210, 25, "F");
		doc.setTextColor(255, 255, 255);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(13);
		doc.text("CENTRAL BATTERY SYSTEM SIZING REPORT", 14, 11);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8.5);
		doc.text(`Generated: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`, 14, 18);
		doc.setTextColor(15, 23, 42);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(9.5);
		doc.text("DESIGN CRITERIA", 14, 34);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8.5);
		doc.text(`Loading Factor: ${loadingFactor} | Power Factor: ${powerFactor} | Spare Capacity: ${spareCapacity}%`, 14, 40);
		doc.setFont("helvetica", "bold");
		doc.text("EMERGENCY & EXIT LIGHTING LOAD SCHEDULE", 14, 52);
		autoTable(doc, {
			startY: 56,
			head: [[
				"Sr.",
				"Description",
				"Unit",
				"EM Qty",
				"EM W",
				"Exit Qty",
				"Exit W",
				"Total (W)",
				"Remarks"
			]],
			body: rows.map((r, idx) => [
				idx + 1,
				r.description,
				"W",
				r.emLightQty,
				r.emLightW,
				r.exitLightQty,
				r.exitLightW,
				r.emLightQty * r.emLightW + r.exitLightQty * r.exitLightW,
				r.remarks
			]),
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
		doc.text("CALCULATION RESULTS", 14, nextY);
		nextY += 4;
		const summaryData = [
			["Total Connected Load", `${calculatedData.totalConnectedKw.toFixed(2)} kW`],
			["Total Load after Loading Factor", `${calculatedData.totalLoadAfterLFFactorKw.toFixed(2)} kW`],
			["Central Battery Rating", `${calculatedData.batteryRatingKva.toFixed(2)} kVA`],
			["Final Sized Rating (+Spare)", `${calculatedData.finalRecommendedKva.toFixed(2)} kVA`],
			["Recommended Standard Size", `${calculatedData.recStandardSize} kVA`]
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
		addPdfSignatureBlock(doc, doc.lastAutoTable?.finalY || 40, currentUserName, project?.id || "default", "central-battery-sizing");
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), "CBS_Sizing_Report.pdf", "PDF Document", ["pdf"]);
	};
	const handleImportExcelRows = (mappedRows) => {
		const newRows = mappedRows.map((mr, idx) => ({
			id: `imported-${idx}-${Date.now()}`,
			description: mr.description || `Imported Load ${idx + 1}`,
			emLightQty: Number(mr.emLightQty) || 0,
			emLightW: Number(mr.emLightW) || 0,
			exitLightQty: Number(mr.exitLightQty) || 0,
			exitLightW: Number(mr.exitLightW) || 0,
			remarks: mr.remarks || ""
		}));
		if (newRows.length > 0) setRows([...rows, ...newRows]);
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
			width: 280,
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				value: r.description,
				onCommit: (val) => handleUpdateRow(r.id, "description", val),
				className: "font-medium text-[13px]"
			})
		},
		{
			key: "emLightQty",
			header: "Emergency Light Quantity",
			width: 140,
			align: "center",
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: r.emLightQty,
				onCommit: (val) => handleUpdateRow(r.id, "emLightQty", Number(val) || 0),
				className: "font-mono text-center text-[12.5px]"
			})
		},
		{
			key: "emLightW",
			header: "Emergency Light Wattage (W)",
			width: 150,
			align: "center",
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: r.emLightW,
				onCommit: (val) => handleUpdateRow(r.id, "emLightW", Number(val) || 0),
				className: "font-mono text-center text-[12.5px]"
			})
		},
		{
			key: "exitLightQty",
			header: "Exit Light Quantity",
			width: 120,
			align: "center",
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: r.exitLightQty,
				onCommit: (val) => handleUpdateRow(r.id, "exitLightQty", Number(val) || 0),
				className: "font-mono text-center text-[12.5px]"
			})
		},
		{
			key: "exitLightW",
			header: "Exit Light Wattage (W)",
			width: 140,
			align: "center",
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: r.exitLightW,
				onCommit: (val) => handleUpdateRow(r.id, "exitLightW", Number(val) || 0),
				className: "font-mono text-center text-[12.5px]"
			})
		},
		{
			key: "totalW",
			header: "Total Connected Load (W)",
			width: 170,
			align: "right",
			render: (r) => {
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono font-bold text-foreground text-[12.5px]",
					children: (r.emLightQty * r.emLightW + r.exitLightQty * r.exitLightW).toFixed(0)
				});
			}
		},
		{
			key: "remarks",
			header: "Remarks",
			width: 200,
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				value: r.remarks,
				onCommit: (val) => handleUpdateRow(r.id, "remarks", val),
				className: "text-muted-foreground text-[12px]"
			})
		}
	], [rows, selected]);
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
		title: "Central Battery Sizing",
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
								children: "ELECTRICAL > CENTRAL BATTERY SIZING"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center gap-3 mt-0.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-baseline gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
										className: "text-[28px] font-bold tracking-tight text-foreground",
										children: "Central Battery Sizing"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[15px] font-semibold text-muted-foreground",
										children: [rows.length, " areas"]
									})]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground mt-0.5",
								children: "Preliminary Central Battery System capacity sizing based on escape and exit lighting schedule."
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
													children: "Loading Factor:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "0.05",
													value: loadingFactor,
													onChange: (e) => setLoadingFactor(Number(e.target.value)),
													className: "w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground uppercase tracking-wider text-[10.5px]",
													children: "Power Factor:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "0.05",
													value: powerFactor,
													onChange: (e) => setPowerFactor(Number(e.target.value)),
													className: "w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground uppercase tracking-wider text-[10.5px]",
													children: "Spare Capacity:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														value: spareCapacity,
														onChange: (e) => setSpareCapacity(Number(e.target.value)),
														className: "w-16 bg-background border border-border rounded-l px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none border-r-0"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "bg-slate-100 dark:bg-slate-800 border border-border border-l-0 rounded-r px-2.5 py-1 font-bold text-slate-500 font-mono text-xs",
														children: "%"
													})]
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
													"Load Name": "description",
													"Emergency Light Quantity": "emLightQty",
													"EM Qty": "emLightQty",
													"Emergency Light Wattage (W)": "emLightW",
													"EM W": "emLightW",
													"Exit Light Quantity": "exitLightQty",
													"Exit Qty": "exitLightQty",
													"Exit Light Wattage (W)": "exitLightW",
													"Exit W": "exitLightW",
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
													children: "Connected Load"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "mt-2.5",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-[15px] font-bold font-mono text-foreground block",
														children: [calculatedData.totalConnectedKw.toFixed(2), " kW"]
													})
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block",
													children: "After Loading Factor"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "mt-2.5",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-[15px] font-bold font-mono text-foreground block",
														children: [calculatedData.totalLoadAfterLFFactorKw.toFixed(2), " kW"]
													})
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block",
													children: "CBS Rating"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "mt-2.5",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-[15px] font-bold font-mono text-foreground block",
														children: [calculatedData.batteryRatingKva.toFixed(2), " kVA"]
													})
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block",
													children: "Sized Rating"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "mt-2.5",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-[15px] font-bold font-mono text-foreground block",
														children: [calculatedData.finalRecommendedKva.toFixed(2), " kVA"]
													})
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 flex flex-col justify-between shadow-md relative overflow-hidden",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9.5px] font-bold text-slate-400 uppercase tracking-wider",
													children: "Standard CBS Size"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "mt-2",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-[16px] font-black font-mono tracking-tight text-white block",
														children: [calculatedData.recStandardSize, " kVA"]
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
														children: "Central Battery Sizing Report"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-[11px] text-muted-foreground mt-1",
														children: "Preliminary electrical capacity sizing sheet"
													})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-right",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "inline-flex items-center px-3 py-1 rounded bg-slate-900 text-white dark:bg-slate-800 text-xs font-bold font-mono",
															children: [calculatedData.recStandardSize, " kVA Recommended"]
														})
													})]
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-2 gap-6 text-[12px] mb-8 pb-6 border-b border-border/80",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
														className: "font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1.5",
														children: "Sizing coefficients"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Loading Factor:" }),
														" ",
														loadingFactor
													] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Power Factor:" }),
														" ",
														powerFactor
													] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Spare Capacity:" }),
														" ",
														spareCapacity,
														"%"
													] })
												] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-right",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Generated Date:" }),
														" ",
														(/* @__PURE__ */ new Date()).toLocaleDateString()
													] })
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mb-8",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "font-bold text-[13px] text-slate-900 dark:text-white mb-3",
													children: "1. Connected Emergency & Exit Lighting Schedule"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
													className: "w-full text-[11px] text-left border border-slate-200 dark:border-slate-800",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
														className: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[9px] tracking-wider",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
															className: "border-b border-slate-200 dark:border-slate-800",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-3 py-2 text-center w-12 font-mono",
																	children: "Sr."
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-3 py-2",
																	children: "Description"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2 text-center",
																	children: "EM Qty"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2 text-center",
																	children: "EM Wattage"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2 text-center",
																	children: "Exit Qty"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-2 py-2 text-center",
																	children: "Exit Wattage"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																	className: "px-3 py-2 text-right",
																	children: "Total Connected Load (W)"
																})
															]
														})
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
														className: "divide-y divide-slate-200 dark:divide-slate-800",
														children: rows.map((r, idx) => {
															const tot = r.emLightQty * r.emLightW + r.exitLightQty * r.exitLightW;
															return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-3 py-1.5 text-center font-mono",
																	children: idx + 1
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-3 py-1.5 font-medium",
																	children: r.description
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1.5 text-center font-mono",
																	children: r.emLightQty
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																	className: "px-2 py-1.5 text-center font-mono",
																	children: [r.emLightW, " W"]
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1.5 text-center font-mono",
																	children: r.exitLightQty
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																	className: "px-2 py-1.5 text-center font-mono",
																	children: [r.exitLightW, " W"]
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-3 py-1.5 text-right font-mono font-semibold",
																	children: tot.toFixed(0)
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
													children: "2. Calculation Summary"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total Connected load:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono",
																children: [calculatedData.totalConnectedKw.toFixed(2), " kW"]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total Load after Loading Factor:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono",
																children: [calculatedData.totalLoadAfterLFFactorKw.toFixed(2), " kW"]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Central Battery Rating:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono",
																children: [calculatedData.batteryRatingKva.toFixed(2), " kVA"]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5 mt-1 font-semibold text-primary",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Final CBS Rating (+Spare):" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono text-sm",
																children: [calculatedData.finalRecommendedKva.toFixed(2), " kVA"]
															})]
														})
													]
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "font-bold text-[13px] text-slate-900 dark:text-white mb-3",
													children: "3. Sizing Constants"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Loading Factor:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
																className: "font-mono",
																children: loadingFactor
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Power Factor:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
																className: "font-mono",
																children: powerFactor
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Spare Capacity Margin:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-mono",
																children: [spareCapacity, "%"]
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
															children: "Connected Load Calculation:"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-primary",
															children: "Connected Load = (EM Qty * EM Watts) + (Exit Qty * Exit Watts)"
														})] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "font-semibold font-sans text-foreground",
															children: "Load after Loading Factor:"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-primary",
															children: "Load_after_LF = Connected Load / Loading Factor"
														})] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "mt-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																className: "font-semibold font-sans text-foreground",
																children: "Central Battery Rating (kVA):"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-primary",
																children: "Battery Rating = Load_after_LF / Power Factor"
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "mt-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																className: "font-semibold font-sans text-foreground",
																children: "Final CBS Sized Rating:"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-primary",
																children: "Final Rating = Battery Rating * (1 + Spare Capacity / 100)"
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
export { CentralBatterySizingPage as component };
