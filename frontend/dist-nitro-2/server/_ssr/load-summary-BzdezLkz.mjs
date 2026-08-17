import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { N as Plus, _t as Database, p as Trash, xt as Copy } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { a as ContextMenuSeparator, i as ContextMenuItem, r as ContextMenuContent, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as ImportExcelBtn } from "./ImportExcelBtn-rAnQAoVD.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
import { t as DataGrid } from "./DataGrid-kg4gScDe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/load-summary-BzdezLkz.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
require_excel();
import_FileSaver_min.default.saveAs;
var computeRowOutputs = (row) => {
	const qty = row.qty || 0;
	const lighting = row.lighting || 0;
	const power = row.power || 0;
	const hvac = row.hvac || 0;
	const other = row.other || 0;
	let totalLoad = 0;
	if (qty > 0) totalLoad = qty * (lighting + power + hvac + other);
	else totalLoad = lighting + power + hvac + other;
	return {
		...row,
		totalLoad: Number(totalLoad.toFixed(2))
	};
};
var pushToHistory = (currentRows, history, setHistory, setRedoStack) => {
	setHistory([...history, [...currentRows]]);
	if (setRedoStack) setRedoStack([]);
};
function LoadSummaryPage() {
	const { project } = useWorkspace();
	const confirm = useConfirm();
	const [rows, setRows] = (0, import_react.useState)([]);
	const [selected, setSelected] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [activeRowId, setActiveRowId] = (0, import_react.useState)();
	const [history, setHistory] = (0, import_react.useState)([]);
	const [redoStack, setRedoStack] = (0, import_react.useState)([]);
	const [transformers, setTransformers] = (0, import_react.useState)("");
	const totalPower = rows.reduce((acc, row) => acc + row.totalLoad, 0);
	const totalPowerWithSafety = totalPower * 1.1;
	const updateRow = (id, updates) => {
		pushToHistory(rows, history, setHistory, setRedoStack);
		if (selected.has(id) && selected.size > 1) setRows((prev) => prev.map((row) => {
			if (selected.has(row.id)) return computeRowOutputs({
				...row,
				...updates
			});
			return row;
		}));
		else setRows((prev) => prev.map((row) => row.id === id ? computeRowOutputs({
			...row,
			...updates
		}) : row));
	};
	const handleToggle = (id, isShift, isCtrl) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (isShift && activeRowId) {
				const currentIndex = rows.findIndex((r) => r.id === id);
				const activeIndex = rows.findIndex((r) => r.id === activeRowId);
				if (currentIndex !== -1 && activeIndex !== -1) {
					const start = Math.min(currentIndex, activeIndex);
					const end = Math.max(currentIndex, activeIndex);
					for (let i = start; i <= end; i++) next.add(rows[i].id);
					return next;
				}
			}
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
		setActiveRowId(id);
	};
	const handleToggleAll = () => {
		if (selected.size === rows.length && rows.length > 0) setSelected(/* @__PURE__ */ new Set());
		else setSelected(new Set(rows.map((r) => r.id)));
	};
	const addRow = () => {
		const newId = `ls_${Math.random().toString(36).slice(2, 9)}`;
		const newRow = {
			id: newId,
			description: "",
			qty: 1,
			area: 0,
			lighting: 0,
			power: 0,
			hvac: 0,
			other: 0,
			totalLoad: 0,
			remarks: ""
		};
		pushToHistory(rows, history, setHistory, setRedoStack);
		setRows((prev) => [...prev, computeRowOutputs(newRow)]);
		setSelected(/* @__PURE__ */ new Set([newId]));
		setActiveRowId(newId);
	};
	const loadDummyData = () => {
		const dummy = [
			{
				id: `ls_${Math.random().toString(36).slice(2, 9)}`,
				description: "First Floor Office",
				qty: 1,
				area: 150,
				lighting: 1.5,
				power: 3,
				hvac: 15,
				other: 0,
				totalLoad: 0,
				remarks: ""
			},
			{
				id: `ls_${Math.random().toString(36).slice(2, 9)}`,
				description: "Second Floor Meeting Rooms",
				qty: 2,
				area: 40,
				lighting: .5,
				power: 1,
				hvac: 4,
				other: 0,
				totalLoad: 0,
				remarks: "Dimmable"
			},
			{
				id: `ls_${Math.random().toString(36).slice(2, 9)}`,
				description: "Server Room",
				qty: 1,
				area: 20,
				lighting: .2,
				power: 20,
				hvac: 25,
				other: 0,
				totalLoad: 0,
				remarks: "Critical load"
			},
			{
				id: `ls_${Math.random().toString(36).slice(2, 9)}`,
				description: "Pantry",
				qty: 1,
				area: 15,
				lighting: .15,
				power: 5,
				hvac: 1.5,
				other: 0,
				totalLoad: 0,
				remarks: ""
			}
		];
		pushToHistory(rows, history, setHistory, setRedoStack);
		setRows((prev) => [...prev, ...dummy.map(computeRowOutputs)]);
	};
	const deleteSelected = async () => {
		if (selected.size === 0) return;
		if (await confirm(`Are you sure you want to delete ${selected.size} selected row(s)?`)) {
			pushToHistory(rows, history, setHistory, setRedoStack);
			setRows((prev) => prev.filter((r) => !selected.has(r.id)));
			setSelected(/* @__PURE__ */ new Set());
			setActiveRowId(void 0);
		}
	};
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			const activeEl = document.activeElement;
			const isCmdOrCtrl = navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? e.metaKey : e.ctrlKey;
			if (e.key === "Enter" && activeEl.tagName === "INPUT") {
				activeEl.blur();
				return;
			}
			if (e.key === "Escape") {
				activeEl?.blur();
				if (selected.size > 0) {
					e.preventDefault();
					setSelected(/* @__PURE__ */ new Set());
					setActiveRowId(void 0);
				}
				return;
			}
			if ([
				"ArrowUp",
				"ArrowDown",
				"ArrowLeft",
				"ArrowRight"
			].includes(e.key) && activeEl.tagName === "INPUT") {
				const rowIdxStr = activeEl.getAttribute("data-row-idx");
				const colIdxStr = activeEl.getAttribute("data-col-idx");
				if (rowIdxStr !== null && colIdxStr !== null) {
					let rIdx = parseInt(rowIdxStr);
					let cIdx = parseInt(colIdxStr);
					if (e.key === "ArrowUp") rIdx--;
					else if (e.key === "ArrowDown") rIdx++;
					else if (e.key === "ArrowLeft") cIdx--;
					else if (e.key === "ArrowRight") cIdx++;
					const nextInput = document.querySelector(`input[data-row-idx="${rIdx}"][data-col-idx="${cIdx}"]`);
					if (nextInput) {
						e.preventDefault();
						nextInput.focus();
						setTimeout(() => nextInput.select(), 0);
					}
					return;
				}
			}
			if (activeEl && (activeEl.tagName === "INPUT" && activeEl.type !== "checkbox" && activeEl.type !== "radio" || activeEl.tagName === "SELECT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) return;
			if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
				e.preventDefault();
				setSelected(new Set(rows.map((r) => r.id)));
			}
			if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
				e.preventDefault();
				deleteSelected();
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
				e.preventDefault();
				if (history.length > 0) {
					const prev = history[history.length - 1];
					setRedoStack((rs) => [[...rows], ...rs]);
					setHistory((h) => h.slice(0, -1));
					setRows(prev);
					setSelected(/* @__PURE__ */ new Set());
				}
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "y" || isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z") {
				e.preventDefault();
				if (redoStack.length > 0) {
					const next = redoStack[0];
					setHistory((h) => [...h, [...rows]]);
					setRedoStack((rs) => rs.slice(1));
					setRows(next);
					setSelected(/* @__PURE__ */ new Set());
				}
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "c" && selected.size > 0) {
				e.preventDefault();
				const toCopy = rows.filter((r) => selected.has(r.id));
				localStorage.setItem("mep_clipboard_load", JSON.stringify(toCopy));
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "x" && selected.size > 0) {
				e.preventDefault();
				const toCopy = rows.filter((r) => selected.has(r.id));
				localStorage.setItem("mep_clipboard_load", JSON.stringify(toCopy));
				pushToHistory(rows, history, setHistory, setRedoStack);
				setRows((prev) => prev.filter((r) => !selected.has(r.id)));
				setSelected(/* @__PURE__ */ new Set());
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
				e.preventDefault();
				try {
					const clip = localStorage.getItem("mep_clipboard_load");
					if (clip) {
						const pasted = JSON.parse(clip).map((item, i) => ({
							...item,
							id: `ls_paste_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 9)}`,
							description: `${item.description} (Copy)`
						}));
						pushToHistory(rows, history, setHistory, setRedoStack);
						setRows((prev) => [...prev, ...pasted]);
					}
				} catch (err) {}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		rows,
		selected,
		history,
		redoStack,
		confirm
	]);
	const handleImportExcelRows = (mappedRows) => {
		const newRows = mappedRows.map((mr, idx) => ({
			id: `ls_import_${Date.now()}_${idx}`,
			description: mr.description || `Imported Load ${idx + 1}`,
			qty: Number(mr.qty) || 1,
			phase: mr.phase || "3",
			loadW: Number(mr.loadW) || 0,
			powerFactor: Number(mr.powerFactor) || .8,
			efficiency: Number(mr.efficiency) || .85,
			diversityFactor: Number(mr.diversityFactor) || 1,
			remarks: mr.remarks || ""
		}));
		pushToHistory(rows, history, setHistory, setRedoStack);
		setRows((prev) => [...prev, ...newRows]);
	};
	const columns = (0, import_react.useMemo)(() => [
		{
			key: "id",
			header: "S.No",
			width: 60,
			align: "center",
			render: (row) => {
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted-foreground",
					children: rows.findIndex((r) => r.id === row.id) + 1
				});
			}
		},
		{
			key: "description",
			header: "Description",
			width: 250,
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: row.description,
					onChange: (e) => updateRow(row.id, { description: e.target.value }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5",
					autoComplete: "off",
					"data-row-idx": rowIdx,
					"data-col-idx": 1
				});
			}
		},
		{
			key: "qty",
			header: "Qty",
			width: 80,
			align: "right",
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					value: row.qty === 0 ? "" : row.qty,
					onChange: (e) => updateRow(row.id, { qty: parseFloat(e.target.value) || 0 }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5",
					"data-row-idx": rowIdx,
					"data-col-idx": 2
				});
			}
		},
		{
			key: "area",
			header: "Area (sq.m)",
			width: 100,
			align: "right",
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					value: row.area === 0 ? "" : row.area,
					onChange: (e) => updateRow(row.id, { area: parseFloat(e.target.value) || 0 }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5",
					"data-row-idx": rowIdx,
					"data-col-idx": 3
				});
			}
		},
		{
			key: "lighting",
			header: "Lighting (kW)",
			width: 110,
			align: "right",
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					step: "0.1",
					value: row.lighting === 0 ? "" : row.lighting,
					onChange: (e) => updateRow(row.id, { lighting: parseFloat(e.target.value) || 0 }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5",
					"data-row-idx": rowIdx,
					"data-col-idx": 4
				});
			}
		},
		{
			key: "power",
			header: "Power (kW)",
			width: 100,
			align: "right",
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					step: "0.1",
					value: row.power === 0 ? "" : row.power,
					onChange: (e) => updateRow(row.id, { power: parseFloat(e.target.value) || 0 }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5",
					"data-row-idx": rowIdx,
					"data-col-idx": 5
				});
			}
		},
		{
			key: "hvac",
			header: "HVAC (kW)",
			width: 100,
			align: "right",
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					step: "0.1",
					value: row.hvac === 0 ? "" : row.hvac,
					onChange: (e) => updateRow(row.id, { hvac: parseFloat(e.target.value) || 0 }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5",
					"data-row-idx": rowIdx,
					"data-col-idx": 6
				});
			}
		},
		{
			key: "other",
			header: "Other (kW)",
			width: 110,
			align: "right",
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					step: "0.1",
					value: row.other === 0 ? "" : row.other,
					onChange: (e) => updateRow(row.id, { other: parseFloat(e.target.value) || 0 }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5",
					"data-row-idx": rowIdx,
					"data-col-idx": 7
				});
			}
		},
		{
			key: "totalLoad",
			header: "Total Load (kW)",
			width: 130,
			align: "right",
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-full w-full flex items-center justify-end px-3 bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold border-x border-blue-500/20",
				children: row.totalLoad.toFixed(2)
			})
		},
		{
			key: "remarks",
			header: "Remarks",
			width: 200,
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: row.remarks,
					onChange: (e) => updateRow(row.id, { remarks: e.target.value }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5",
					autoComplete: "off",
					"data-row-idx": rowIdx,
					"data-col-idx": 9
				});
			}
		}
	], [rows]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Load Summary",
		subtitle: "Calculate electrical load summary and equipment totals",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex gap-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportExcelBtn, {
				columnMapping: {
					"Description": "description",
					"Quantity": "qty",
					"Qty": "qty",
					"Phase": "phase",
					"Load (W)": "loadW",
					"Wattage": "loadW",
					"Power Factor": "powerFactor",
					"PF": "powerFactor",
					"Efficiency": "efficiency",
					"Eff": "efficiency",
					"Diversity Factor": "diversityFactor",
					"DF": "diversityFactor",
					"Remarks": "remarks"
				},
				onImport: handleImportExcelRows,
				className: "flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded px-3 py-1.5 text-[12.5px] font-medium transition-colors"
			})
		}),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex flex-col h-full w-full",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center justify-between px-4 h-12 border-b border-border bg-background/80 backdrop-blur-md shrink-0 select-none",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: addRow,
								className: "flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-[12.5px] font-medium shadow-sm transition-all",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add Row"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-px h-4 bg-border mx-1" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								disabled: selected.size === 0,
								onClick: deleteSelected,
								className: "flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded text-[12.5px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash, { className: "size-3.5" }), " Delete Selected"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-px h-4 bg-border mx-1" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: loadDummyData,
								className: "flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded text-[12.5px] font-medium transition-colors",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Database, { className: "size-3.5" }), " Load Sample Data"]
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 overflow-hidden flex flex-col relative p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex-1 flex flex-col bg-white/80 dark:bg-black/40 backdrop-blur-sm rounded-xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.04)] overflow-hidden",
						children: rows.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataGrid, {
							rows,
							columns,
							selected,
							onToggle: handleToggle,
							onToggleAll: handleToggleAll,
							renderContextMenu: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuContent, {
								className: "w-48",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
										onClick: () => {
											const newRow = {
												...row,
												id: `ls_${Math.random().toString(36).slice(2, 9)}`
											};
											pushToHistory(rows, history, setHistory);
											setRows((prev) => {
												const idx = prev.findIndex((r) => r.id === row.id);
												const next = [...prev];
												next.splice(idx + 1, 0, newRow);
												return next;
											});
										},
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4 mr-2" }), " Duplicate Row"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, {}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
										onClick: () => {
											pushToHistory(rows, history, setHistory);
											setRows((prev) => prev.filter((r) => r.id !== row.id));
											setSelected((prev) => {
												const next = new Set(prev);
												next.delete(row.id);
												return next;
											});
										},
										className: "text-red-600 dark:text-red-400 focus:text-red-600",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash, { className: "size-4 mr-2" }), " Delete Row"]
									})
								]
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 flex flex-col items-center justify-center text-center p-8",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4 border border-border shadow-sm",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-5 text-muted-foreground" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-sm font-semibold text-foreground mb-1",
									children: "No load summary rows"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground max-w-sm mb-4",
									children: "Add a row or load sample data to begin calculating your total electrical load."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: addRow,
									className: "flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-[13px] font-medium shadow-sm transition-all",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Add First Row"]
								})
							]
						})
					}), rows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex gap-12 shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-border pb-2",
									children: "Load Totals"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[13px] font-medium",
										children: "Total Electrical Power:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-bold font-mono text-[15px]",
										children: [totalPower.toFixed(2), " kW"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3 rounded-lg border border-blue-200 dark:border-blue-800/50",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[13px] font-semibold",
										children: "Total Power (10% Safety):"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-bold font-mono text-[16px]",
										children: [totalPowerWithSafety.toFixed(2), " kW"]
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 space-y-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-border pb-2",
								children: "Transformer Selection"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-[12px] font-medium text-slate-500",
										children: "Selected Number of Transformers"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										value: transformers,
										onChange: (e) => setTransformers(e.target.value),
										placeholder: "e.g., 2 x 1500 kVA",
										className: "w-full bg-white dark:bg-slate-900 border border-border rounded p-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[11px] text-muted-foreground mt-1",
										children: "This will be included at the bottom of your exported Excel sheet."
									})
								]
							})]
						})]
					})]
				})]
			})]
		})
	});
}
//#endregion
export { LoadSummaryPage as component };
