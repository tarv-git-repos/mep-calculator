import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { M as Printer, N as Plus, St as Copy, _t as Download, k as RefreshCw, m as Trash2 } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { a as ContextMenuSeparator, i as ContextMenuItem, r as ContextMenuContent, t as AppShell } from "./AppShell-urg-0zDa.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { t as ImportExcelBtn } from "./ImportExcelBtn-rAnQAoVD.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
import { t as DataGrid } from "./DataGrid-BXNURe3V.mjs";
import { a as useShortcuts, i as useSelection, n as useClipboard, r as useHistory } from "./useShortcuts-D4qmUsvw.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ups-sizing-calculation-Cl6KZe6X.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
require_excel();
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
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
	id: "spaces",
	label: "Sizing Schedule"
}, {
	id: "report",
	label: "Report"
}];
function UpsSizingCalculationPage() {
	const confirm = useConfirm();
	const [tab, setTab] = (0, import_react.useState)("spaces");
	const [diversityFactor, setDiversityFactor] = (0, import_react.useState)(.9);
	const [powerFactor, setPowerFactor] = (0, import_react.useState)(.8);
	const [spareCapacity, setSpareCapacity] = (0, import_react.useState)(20);
	const initialRows = (0, import_react.useMemo)(() => [
		{
			id: "1",
			description: "Workstation Desks - Ground Floor",
			qtySingle: 10,
			qtyTwin: 20,
			equipmentLoad: 150,
			spare: 10,
			remarks: "Computers & dual monitors"
		},
		{
			id: "2",
			description: "Security CCTV Rack - Server Room",
			qtySingle: 4,
			qtyTwin: 4,
			equipmentLoad: 250,
			spare: 15,
			remarks: "NVR and PoE switches"
		},
		{
			id: "3",
			description: "Access Control Panels - Lobby",
			qtySingle: 2,
			qtyTwin: 1,
			equipmentLoad: 100,
			spare: 0,
			remarks: "Door controllers"
		},
		{
			id: "4",
			description: "Telecom DB Sockets - Level 1",
			qtySingle: 5,
			qtyTwin: 2,
			equipmentLoad: 120,
			spare: 10,
			remarks: "PABX rack power"
		}
	], []);
	const { currentState, pushState: setLoadRows, undo, redo } = useHistory(initialRows);
	const loadRows = currentState || initialRows || [];
	const { selectedIds: selected, toggleSelection, selectAll, clearSelection } = useSelection(loadRows);
	const { copy, cut, paste } = useClipboard(loadRows, selected, setLoadRows);
	const calculatedData = (0, import_react.useMemo)(() => {
		let totalConnectedW = 0;
		loadRows.forEach((r) => {
			const single = r.qtySingle || 0;
			const twin = r.qtyTwin || 0;
			const load = r.equipmentLoad || 0;
			const rowSpare = r.spare || 0;
			const rowConnected = (single + 2 * twin) * load * (1 + rowSpare / 100);
			totalConnectedW += rowConnected;
		});
		const totalConnectedKw = totalConnectedW / 1e3;
		const totalLoadAfterDiversityKw = totalConnectedKw * diversityFactor;
		const upsRatingKva = totalLoadAfterDiversityKw / (powerFactor <= 0 ? .8 : powerFactor);
		return {
			totalConnectedKw,
			totalLoadAfterDiversityKw,
			upsRatingKva,
			finalRecommendedKva: upsRatingKva * (1 + spareCapacity / 100)
		};
	}, [
		loadRows,
		diversityFactor,
		powerFactor,
		spareCapacity
	]);
	const handleAddRow = () => {
		const nextId = "row-" + Date.now() + Math.random().toString(36).substr(2, 5);
		setLoadRows([...loadRows, {
			id: nextId,
			description: "New Equipment Load",
			qtySingle: 1,
			qtyTwin: 0,
			equipmentLoad: 100,
			spare: 10,
			remarks: ""
		}]);
	};
	const handleDuplicateRow = (row) => {
		const nextId = "row-" + Date.now() + Math.random().toString(36).substr(2, 5);
		setLoadRows([...loadRows, {
			...row,
			id: nextId,
			description: `${row.description} (Copy)`
		}]);
	};
	const handleDeleteRow = (id) => {
		setLoadRows(loadRows.filter((r) => r.id !== id));
		clearSelection();
	};
	const handleUpdateRow = (id, field, val) => {
		const isBulkEdit = selected.has(id);
		setLoadRows(loadRows.map((r) => r.id === id || isBulkEdit && selected.has(r.id) ? {
			...r,
			[field]: val
		} : r));
	};
	const handleReset = async () => {
		if (await confirm("Are you sure you want to reset all calculations to defaults?")) {
			setLoadRows([{
				id: "1",
				description: "Workstation Desks - Ground Floor",
				qtySingle: 10,
				qtyTwin: 20,
				equipmentLoad: 150,
				spare: 10,
				remarks: "Computers & dual monitors"
			}, {
				id: "2",
				description: "Security CCTV Rack - Server Room",
				qtySingle: 4,
				qtyTwin: 4,
				equipmentLoad: 250,
				spare: 15,
				remarks: "NVR and PoE switches"
			}]);
			setDiversityFactor(.9);
			setPowerFactor(.8);
			setSpareCapacity(20);
			clearSelection();
		}
	};
	const handleToggle = (id, isShift, isCtrl) => {
		toggleSelection(id, !!isCtrl, !!isShift);
	};
	const handleToggleAll = () => {
		if (selected.size === loadRows.length) clearSelection();
		else selectAll();
	};
	const handleImportExcelRows = (mappedRows) => {
		const newRows = mappedRows.map((mr, idx) => ({
			id: `ups_${Date.now()}_${idx}`,
			description: mr.description || `Imported Load ${idx + 1}`,
			qtySingle: Number(mr.qtySingle) || 0,
			qtyTwin: Number(mr.qtyTwin) || 0,
			equipmentLoad: Number(mr.equipmentLoad) || 0,
			spare: Number(mr.spare) || 0,
			remarks: mr.remarks || ""
		}));
		setLoadRows([...loadRows, ...newRows]);
	};
	const handleExportPDF = () => {
		const doc = new import_jspdf_node_min.default("p", "mm", "a4");
		doc.setFillColor(15, 23, 42);
		doc.rect(0, 0, 210, 25, "F");
		doc.setTextColor(255, 255, 255);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(13);
		doc.text("UPS SIZING CALCULATION REPORT", 14, 11);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8.5);
		doc.text(`Generated: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`, 14, 18);
		doc.setTextColor(15, 23, 42);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(9.5);
		doc.text("SIZING COEFFICIENTS", 14, 34);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8.5);
		doc.text(`Diversity Factor: ${diversityFactor}`, 14, 40);
		doc.text(`Power Factor: ${powerFactor}`, 14, 45);
		doc.text(`Spare Capacity: ${spareCapacity}%`, 14, 50);
		doc.setFont("helvetica", "bold");
		doc.text("LOAD SCHEDULE DETAILS", 14, 60);
		autoTable(doc, {
			startY: 64,
			head: [[
				"Sr.",
				"Description of Load",
				"Unit",
				"Single Qty",
				"Twin Qty",
				"Equip. Load (W)",
				"Spare (%)",
				"Remarks"
			]],
			body: loadRows.map((r, idx) => [
				idx + 1,
				r.description,
				"W",
				r.qtySingle,
				r.qtyTwin,
				r.equipmentLoad,
				`${r.spare}%`,
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
		doc.text("CALCULATION SUMMARY RESULTS", 14, nextY);
		nextY += 4;
		const summaryData = [
			["Total Connected Load", `${calculatedData.totalConnectedKw.toFixed(2)} kW`],
			["Total Load after Diversity", `${calculatedData.totalLoadAfterDiversityKw.toFixed(2)} kW`],
			["Sized UPS Rating", `${calculatedData.upsRatingKva.toFixed(2)} kVA`],
			["Sized UPS Rating (+Spare)", `${calculatedData.finalRecommendedKva.toFixed(2)} kVA`]
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
		downloadFile(new Uint8Array(pdfBuffer), "UPS_Sizing_Report.pdf", "PDF Document", ["pdf"]);
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
					children: loadRows.findIndex((row) => row.id === r.id) + 1
				});
			}
		},
		{
			key: "description",
			header: "Description of Load",
			width: 320,
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				value: r.description,
				onCommit: (val) => handleUpdateRow(r.id, "description", val),
				className: "font-medium text-[13px]"
			})
		},
		{
			key: "unit",
			header: "Unit",
			width: 60,
			align: "center",
			render: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground font-mono",
				children: "W"
			})
		},
		{
			key: "qtySingle",
			header: "Qty Single",
			width: 90,
			align: "center",
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: r.qtySingle,
				onCommit: (val) => handleUpdateRow(r.id, "qtySingle", Number(val) || 0),
				className: "font-mono text-center text-[12.5px]"
			})
		},
		{
			key: "qtyTwin",
			header: "Qty Twin",
			width: 90,
			align: "center",
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: r.qtyTwin,
				onCommit: (val) => handleUpdateRow(r.id, "qtyTwin", Number(val) || 0),
				className: "font-mono text-center text-[12.5px]"
			})
		},
		{
			key: "equipmentLoad",
			header: "Equip. Load (W)",
			width: 130,
			align: "right",
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: r.equipmentLoad,
				onCommit: (val) => handleUpdateRow(r.id, "equipmentLoad", Number(val) || 0),
				className: "font-mono text-right text-primary font-bold text-[12.5px]"
			})
		},
		{
			key: "spare",
			header: "Spare (%)",
			width: 90,
			align: "center",
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: r.spare,
				onCommit: (val) => handleUpdateRow(r.id, "spare", Number(val) || 0),
				className: "font-mono text-center text-slate-500 text-[12.5px]"
			})
		},
		{
			key: "connectedLoad",
			header: "Connected Load (W)",
			width: 150,
			align: "right",
			render: (r) => {
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono font-bold text-foreground text-[12.5px]",
					children: ((r.qtySingle + 2 * r.qtyTwin) * r.equipmentLoad * (1 + r.spare / 100)).toFixed(0)
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
	], [loadRows, selected]);
	const renderRowContextMenu = (row) => {
		const selectedIds = selected.has(row.id) ? Array.from(selected) : [row.id];
		const targetsCount = selectedIds.length;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuContent, {
			className: "w-48 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50",
			children: targetsCount > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
				onClick: async () => {
					if (await confirm(`Are you sure you want to delete ${targetsCount} selected rows?`)) {
						setLoadRows(loadRows.filter((r) => !selectedIds.includes(r.id)));
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
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" }), " Duplicate Load"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, { className: "my-1 border-t border-border" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: async () => {
						if (await confirm("Are you sure you want to delete this row?")) handleDeleteRow(row.id);
					},
					className: "flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-red-500 font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), " Delete Load"]
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
			setLoadRows(loadRows.filter((r) => !selected.has(r.id)));
			clearSelection();
		},
		onDuplicate: () => {
			if (selected.size === 0) return;
			const duplicated = [];
			loadRows.forEach((r) => {
				if (selected.has(r.id)) duplicated.push({
					...r,
					id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
					description: `${r.description} (Copy)`
				});
			});
			setLoadRows([...loadRows, ...duplicated]);
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
		title: "UPS Sizing",
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
								children: "ELECTRICAL > UPS SIZING"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center gap-3 mt-0.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-baseline gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
										className: "text-[28px] font-bold tracking-tight text-foreground",
										children: "UPS Sizing"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[15px] font-semibold text-muted-foreground",
										children: [loadRows.length, " items"]
									})]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground mt-0.5",
								children: "Simplified preliminary electrical capacity sizing based on socket load schedule."
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden mb-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between px-4 py-2 bg-card border-b border-border/60 shrink-0 select-none no-print",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-full gap-0.5 border border-border/80",
							children: TABS.map((t) => {
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setTab(t.id),
									className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${t.id === tab ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"}`,
									children: t.label
								}, t.id);
							})
						}), tab === "spaces" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
									onClick: handleReset,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3.5 mr-1" }), " Reset"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportExcelBtn, {
									columnMapping: {
										"Description": "description",
										"Qty (Single)": "qtySingle",
										"Qty (Twin/Dual)": "qtyTwin",
										"Equipment Load (W)": "equipmentLoad",
										"Spare %": "spare",
										"Remarks": "remarks"
									},
									onImport: handleImportExcelRows
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
									onClick: handleExportPDF,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5 mr-1 text-rose-600 dark:text-rose-400" }), " Export PDF"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
									primary: true,
									onClick: handleExportPDF,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-3.5" }), " Print Report"]
								})
							]
						})]
					}), tab === "spaces" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 flex flex-col min-h-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-border/80 select-none shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-6 text-xs font-semibold",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted-foreground uppercase tracking-wider text-[10.5px]",
											children: "Diversity Factor:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "0.05",
											value: diversityFactor,
											onChange: (e) => setDiversityFactor(Number(e.target.value)),
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
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportExcelBtn, {
									columnMapping: {
										"Description": "description",
										"Qty (Single)": "qtySingle",
										"Qty (Twin/Dual)": "qtyTwin",
										"Equipment Load (W)": "equipmentLoad",
										"Spare %": "spare",
										"Remarks": "remarks"
									},
									onImport: handleImportExcelRows
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: handleAddRow,
									className: "bg-primary text-primary-foreground font-bold px-3.5 py-1.5 rounded-lg text-[11.5px] flex items-center gap-1.5 transition hover:bg-primary/95 cursor-pointer shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add Row"]
								})]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1 min-h-[350px]",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataGrid, {
								rows: loadRows,
								columns,
								selected,
								onToggle: handleToggle,
								onToggleAll: handleToggleAll,
								renderContextMenu: renderRowContextMenu
							})
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950 p-8 flex flex-col items-center gap-6 print:bg-white print:p-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "w-full max-w-[210mm] grid grid-cols-2 md:grid-cols-4 gap-4 select-none no-print",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block",
										children: "Connected Load"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "text-lg font-bold font-mono text-foreground block",
											children: [calculatedData.totalConnectedKw.toFixed(2), " kW"]
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block",
										children: "Load after Diversity"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "text-lg font-bold font-mono text-foreground block",
											children: [calculatedData.totalLoadAfterDiversityKw.toFixed(2), " kW"]
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block",
										children: "UPS Rating"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "text-lg font-bold font-mono text-foreground block",
											children: [calculatedData.upsRatingKva.toFixed(2), " kVA"]
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 flex flex-col justify-between shadow-md relative overflow-hidden",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[9.5px] font-bold text-slate-400 uppercase tracking-wider",
										children: "With Spare Capacity"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "text-lg font-black font-mono tracking-tight text-white block",
											children: [calculatedData.finalRecommendedKva.toFixed(2), " kVA"]
										})
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "w-[210mm] min-h-[297mm] bg-white dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800/60 rounded-xl p-10 shadow-lg text-slate-800 dark:text-slate-200 print:border-none print:shadow-none print:rounded-none print:p-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "border-b-2 border-slate-900 dark:border-slate-700 pb-5 mb-6",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-start",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
											className: "text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase",
											children: "UPS Sizing Calculation Report"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-[11px] text-muted-foreground mt-1",
											children: "Preliminary electrical capacity sizing sheet"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-right",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "inline-flex items-center px-3 py-1 rounded bg-slate-900 text-white dark:bg-slate-800 text-xs font-bold font-mono",
												children: [calculatedData.finalRecommendedKva.toFixed(2), " kVA Recommended"]
											})
										})]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-3 gap-6 text-[12px] mb-8 pb-6 border-b border-border/80",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1.5",
											children: "Sizing coefficients"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Diversity Factor:" }),
											" ",
											diversityFactor
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
										className: "col-span-2 text-right",
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
										children: "1. Connected Load Schedule"
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
														children: "Description of Load"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-2 py-2 text-center w-16",
														children: "Unit"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-2 py-2 text-center",
														children: "Qty Single"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-2 py-2 text-center",
														children: "Qty Twin"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-2 py-2 text-center",
														children: "Equip. Load"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-2 py-2 text-center",
														children: "Spare"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-3 py-2 text-right",
														children: "Connected Load (W)"
													})
												]
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
											className: "divide-y divide-slate-200 dark:divide-slate-800",
											children: loadRows.map((r, idx) => {
												const rowConnected = (r.qtySingle + 2 * r.qtyTwin) * r.equipmentLoad * (1 + r.spare / 100);
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
														className: "px-2 py-1.5 text-center text-slate-400 font-mono",
														children: "W"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "px-2 py-1.5 text-center font-mono",
														children: r.qtySingle
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "px-2 py-1.5 text-center font-mono",
														children: r.qtyTwin
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "px-2 py-1.5 text-center font-mono",
														children: r.equipmentLoad
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
														className: "px-2 py-1.5 text-center font-mono",
														children: [r.spare, "%"]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "px-3 py-1.5 text-right font-mono font-semibold",
														children: rowConnected.toFixed(0)
													})
												] }, r.id);
											})
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "grid grid-cols-1 md:grid-cols-2 gap-6 text-[12px] mb-8",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
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
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total Load after Diversity:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-mono",
													children: [calculatedData.totalLoadAfterDiversityKw.toFixed(2), " kW"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "UPS Sized Rating (Base):" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-mono",
													children: [calculatedData.upsRatingKva.toFixed(2), " kVA"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5 mt-1 font-semibold text-primary",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Final UPS Size (+Spare):" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-mono text-sm",
													children: [calculatedData.finalRecommendedKva.toFixed(2), " kVA"]
												})]
											})
										]
									})] })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 flex justify-between items-end text-[11px] text-muted-foreground select-none",
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
						})]
					})]
				})]
			})
		})
	});
}
//#endregion
export { UpsSizingCalculationPage as component };
