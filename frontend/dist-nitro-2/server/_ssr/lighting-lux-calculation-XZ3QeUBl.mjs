import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { N as Plus, _t as Database, p as Trash, xt as Copy } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { _ as dirtyStore, a as ContextMenuSeparator, i as ContextMenuItem, r as ContextMenuContent, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as ImportExcelBtn } from "./ImportExcelBtn-rAnQAoVD.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
import { t as DataGrid } from "./DataGrid-kg4gScDe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/lighting-lux-calculation-XZ3QeUBl.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
require_excel();
import_FileSaver_min.default.saveAs;
function computeRowOutputs(row) {
	const L = row.length || 0;
	const W = row.width || 0;
	const H = row.height || 0;
	const area = L * W;
	let roomIndex = 0;
	if (H > 0 && L + W > 0) roomIndex = L * W / (H * (L + W));
	const LL = row.reqLux || 0;
	const lumen = row.lumen || 0;
	const mf = row.mf || 0;
	const uf = row.uf || 0;
	let reqQty = 0;
	if (lumen > 0 && mf > 0 && uf > 0) reqQty = Math.ceil(LL * area / (lumen * mf * uf));
	return {
		...row,
		area: parseFloat(area.toFixed(2)),
		roomIndex: parseFloat(roomIndex.toFixed(2)),
		reqQty
	};
}
var DEFAULT_ROWS = [];
function pushToHistory(current, history, setHistory, setRedoStack) {
	setHistory([...history, current].slice(-50));
	if (setRedoStack) setRedoStack([]);
}
function LightingLuxCalculationPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const confirm = useConfirm();
	const [rows, setRows] = (0, import_react.useState)(DEFAULT_ROWS);
	const [selected, setSelected] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [activeRowId, setActiveRowId] = (0, import_react.useState)();
	const [history, setHistory] = (0, import_react.useState)([]);
	const [redoStack, setRedoStack] = (0, import_react.useState)([]);
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!project?.id) return;
		try {
			const saved = localStorage.getItem(`mep_lux_calc_${project.id}`);
			if (saved) setRows(JSON.parse(saved));
			setTimeout(() => dirtyStore.set(false), 50);
		} catch (e) {
			console.error(e);
		}
		setLoadedProjectId(project.id);
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			localStorage.setItem(`mep_lux_calc_${project.id}`, JSON.stringify(rows));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		rows
	]);
	const updateRow = (id, updates) => {
		pushToHistory(rows, history, setHistory, setRedoStack);
		const targetIds = selected.has(id) && selected.size > 1 ? selected : /* @__PURE__ */ new Set([id]);
		setRows((prev) => prev.map((r) => {
			if (!targetIds.has(r.id)) return r;
			return computeRowOutputs({
				...r,
				...updates
			});
		}));
	};
	const [lastSelectedId, setLastSelectedId] = (0, import_react.useState)(null);
	const handleToggle = (id, isShift, isCtrl) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (isShift && lastSelectedId) {
				const lastIdx = rows.findIndex((r) => r.id === lastSelectedId);
				const currentIdx = rows.findIndex((r) => r.id === id);
				if (lastIdx !== -1 && currentIdx !== -1) {
					if (!isCtrl) next.clear();
					const start = Math.min(lastIdx, currentIdx);
					const end = Math.max(lastIdx, currentIdx);
					for (let i = start; i <= end; i++) next.add(rows[i].id);
				}
			} else if (next.has(id)) if (!isCtrl && !isShift && next.size > 1) {
				next.clear();
				next.add(id);
			} else next.delete(id);
			else {
				if (!isCtrl && !isShift) next.clear();
				next.add(id);
			}
			return next;
		});
		setLastSelectedId(id);
		setActiveRowId(id);
	};
	const handleToggleAll = () => {
		if (selected.size === rows.length) setSelected(/* @__PURE__ */ new Set());
		else setSelected(new Set(rows.map((r) => r.id)));
	};
	const addRow = () => {
		const newId = `lux_${Math.random().toString(36).slice(2, 9)}`;
		const newRow = {
			id: newId,
			location: "",
			lightType: "",
			ipRating: "",
			length: 0,
			width: 0,
			height: 0,
			roomIndex: 0,
			area: 0,
			reqLux: 0,
			lumen: 0,
			mf: 0,
			uf: 0,
			reqQty: 0,
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
				id: `lux_${Math.random().toString(36).slice(2, 9)}`,
				location: "Manager Office",
				lightType: "LED Panel 600x600",
				ipRating: "IP20",
				length: 5,
				width: 4,
				height: 2.8,
				roomIndex: 0,
				area: 0,
				reqLux: 500,
				lumen: 3200,
				mf: .8,
				uf: .6,
				reqQty: 0,
				remarks: "Task lighting required"
			},
			{
				id: `lux_${Math.random().toString(36).slice(2, 9)}`,
				location: "Open Workspace",
				lightType: "Linear LED Surface",
				ipRating: "IP20",
				length: 15,
				width: 10,
				height: 3.2,
				roomIndex: 0,
				area: 0,
				reqLux: 400,
				lumen: 4500,
				mf: .75,
				uf: .65,
				reqQty: 0,
				remarks: ""
			},
			{
				id: `lux_${Math.random().toString(36).slice(2, 9)}`,
				location: "Meeting Room A",
				lightType: "LED Downlight 20W",
				ipRating: "IP44",
				length: 6,
				width: 4.5,
				height: 2.7,
				roomIndex: 0,
				area: 0,
				reqLux: 500,
				lumen: 2e3,
				mf: .8,
				uf: .55,
				reqQty: 0,
				remarks: "Dimmable"
			},
			{
				id: `lux_${Math.random().toString(36).slice(2, 9)}`,
				location: "Corridor",
				lightType: "LED Downlight 12W",
				ipRating: "IP20",
				length: 20,
				width: 2,
				height: 2.5,
				roomIndex: 0,
				area: 0,
				reqLux: 150,
				lumen: 1200,
				mf: .7,
				uf: .5,
				reqQty: 0,
				remarks: ""
			},
			{
				id: `lux_${Math.random().toString(36).slice(2, 9)}`,
				location: "Pantry",
				lightType: "LED Panel 300x1200",
				ipRating: "IP44",
				length: 4,
				width: 3,
				height: 2.6,
				roomIndex: 0,
				area: 0,
				reqLux: 300,
				lumen: 2800,
				mf: .75,
				uf: .6,
				reqQty: 0,
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
			if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
				e.preventDefault();
				if (history.length > 0) {
					const prev = history[history.length - 1];
					setHistory((h) => h.slice(0, h.length - 1));
					setRedoStack((r) => [...r, rows]);
					setRows(prev);
				}
			}
			if (isCmdOrCtrl && (e.key.toLowerCase() === "y" || e.shiftKey && e.key.toLowerCase() === "z")) {
				e.preventDefault();
				if (redoStack.length > 0) {
					const nextState = redoStack[redoStack.length - 1];
					setRedoStack((r) => r.slice(0, r.length - 1));
					setHistory((h) => [...h, rows]);
					setRows(nextState);
				}
			}
			if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
				e.preventDefault();
				pushToHistory(rows, history, setHistory, setRedoStack);
				setRows((prev) => prev.filter((r) => !selected.has(r.id)));
				setSelected(/* @__PURE__ */ new Set());
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "c" && selected.size > 0) {
				e.preventDefault();
				const toCopy = rows.filter((r) => selected.has(r.id));
				localStorage.setItem("mep_clipboard_lux", JSON.stringify(toCopy));
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "x" && selected.size > 0) {
				e.preventDefault();
				const toCopy = rows.filter((r) => selected.has(r.id));
				localStorage.setItem("mep_clipboard_lux", JSON.stringify(toCopy));
				pushToHistory(rows, history, setHistory, setRedoStack);
				setRows((prev) => prev.filter((r) => !selected.has(r.id)));
				setSelected(/* @__PURE__ */ new Set());
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
				e.preventDefault();
				try {
					const clip = localStorage.getItem("mep_clipboard_lux");
					if (clip) {
						const pasted = JSON.parse(clip).map((item, i) => ({
							...item,
							id: `lux_paste_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 9)}`,
							location: `${item.location} (Copy)`
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
		history
	]);
	const handleImportExcelRows = (mappedRows) => {
		const newRows = mappedRows.map((mr, idx) => ({
			id: `lux_import_${Date.now()}_${idx}`,
			location: mr.location || "",
			lightType: mr.lightType || "",
			ipRating: mr.ipRating || "",
			length: Number(mr.length) || 0,
			width: Number(mr.width) || 0,
			height: Number(mr.height) || 0,
			roomIndex: 0,
			area: 0,
			reqLux: Number(mr.reqLux) || 0,
			lumen: Number(mr.lumen) || 0,
			mf: Number(mr.mf) || .8,
			uf: Number(mr.uf) || .6,
			requiredFittings: 0,
			providedFittings: 0,
			achievedLux: 0,
			isPass: false
		}));
		pushToHistory(rows, history, setHistory, setRedoStack);
		setRows((prev) => [...prev, ...newRows]);
	};
	const columns = (0, import_react.useMemo)(() => [
		{
			key: "id",
			header: "Sr. No.",
			width: 70,
			align: "center",
			render: (row) => {
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted-foreground",
					children: rows.findIndex((r) => r.id === row.id) + 1
				});
			}
		},
		{
			key: "location",
			header: "Location",
			width: 150,
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: row.location,
					onChange: (e) => updateRow(row.id, { location: e.target.value }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5",
					autoComplete: "off",
					"data-row-idx": rowIdx,
					"data-col-idx": 1
				});
			}
		},
		{
			key: "lightType",
			header: "Type of Light",
			width: 150,
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: row.lightType,
					onChange: (e) => updateRow(row.id, { lightType: e.target.value }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5",
					autoComplete: "off",
					"data-row-idx": rowIdx,
					"data-col-idx": 2
				});
			}
		},
		{
			key: "ipRating",
			header: "IP Rating",
			width: 100,
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: row.ipRating,
					onChange: (e) => updateRow(row.id, { ipRating: e.target.value }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5",
					autoComplete: "off",
					"data-row-idx": rowIdx,
					"data-col-idx": 3
				});
			}
		},
		{
			key: "length",
			header: "Length (L) m",
			width: 100,
			align: "right",
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					value: row.length === 0 ? "" : row.length,
					onChange: (e) => updateRow(row.id, { length: parseFloat(e.target.value) || 0 }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5",
					"data-row-idx": rowIdx,
					"data-col-idx": 4
				});
			}
		},
		{
			key: "width",
			header: "Width (W) m",
			width: 100,
			align: "right",
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					value: row.width === 0 ? "" : row.width,
					onChange: (e) => updateRow(row.id, { width: parseFloat(e.target.value) || 0 }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5",
					"data-row-idx": rowIdx,
					"data-col-idx": 5
				});
			}
		},
		{
			key: "height",
			header: "Height (H) m",
			width: 100,
			align: "right",
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					value: row.height === 0 ? "" : row.height,
					onChange: (e) => updateRow(row.id, { height: parseFloat(e.target.value) || 0 }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5",
					"data-row-idx": rowIdx,
					"data-col-idx": 6
				});
			}
		},
		{
			key: "roomIndex",
			header: "Room Index (RI)",
			width: 110,
			align: "right",
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-blue-600 dark:text-blue-400 font-medium px-2",
				children: row.roomIndex
			})
		},
		{
			key: "area",
			header: "Area (m²)",
			width: 100,
			align: "right",
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-medium px-2",
				children: row.area
			})
		},
		{
			key: "reqLux",
			header: "Req. Lux (LL)",
			width: 110,
			align: "right",
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					value: row.reqLux === 0 ? "" : row.reqLux,
					onChange: (e) => updateRow(row.id, { reqLux: parseFloat(e.target.value) || 0 }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 text-right font-medium text-amber-600 dark:text-amber-500 focus:bg-primary/5",
					"data-row-idx": rowIdx,
					"data-col-idx": 9
				});
			}
		},
		{
			key: "lumen",
			header: "Lumen",
			width: 100,
			align: "right",
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					value: row.lumen === 0 ? "" : row.lumen,
					onChange: (e) => updateRow(row.id, { lumen: parseFloat(e.target.value) || 0 }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5",
					"data-row-idx": rowIdx,
					"data-col-idx": 10
				});
			}
		},
		{
			key: "mf",
			header: "M.F",
			width: 80,
			align: "right",
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					step: "0.1",
					value: row.mf === 0 ? "" : row.mf,
					onChange: (e) => updateRow(row.id, { mf: parseFloat(e.target.value) || 0 }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5",
					"data-row-idx": rowIdx,
					"data-col-idx": 11
				});
			}
		},
		{
			key: "uf",
			header: "U.F",
			width: 80,
			align: "right",
			render: (row) => {
				const rowIdx = rows.findIndex((r) => r.id === row.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					step: "0.1",
					value: row.uf === 0 ? "" : row.uf,
					onChange: (e) => updateRow(row.id, { uf: parseFloat(e.target.value) || 0 }),
					className: "w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5",
					"data-row-idx": rowIdx,
					"data-col-idx": 12
				});
			}
		},
		{
			key: "reqQty",
			header: "Req. QTY",
			width: 90,
			align: "center",
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-full w-full flex items-center justify-center bg-green-500/10 text-green-700 dark:text-green-400 font-bold border-x border-green-500/20",
				children: row.reqQty
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
					"data-col-idx": 14
				});
			}
		}
	], [rows]);
	const renderContextMenu = (row) => {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuContent, {
			className: "w-48",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: () => {
						const newRow = {
							...row,
							id: `lux_${Math.random().toString(36).slice(2, 9)}`
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
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Lighting LUX Calculation",
		subtitle: "Design and calculate lighting levels for different spaces",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex gap-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportExcelBtn, {
				columnMapping: {
					"Location": "location",
					"Type of Light Fitting": "lightType",
					"IP Rating": "ipRating",
					"Length (L)": "length",
					"Width (W)": "width",
					"Height (H)": "height",
					"Required Lux Level": "reqLux",
					"Light Lumen": "lumen",
					"MF": "mf",
					"UF": "uf"
				},
				onImport: handleImportExcelRows,
				className: "flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded px-3 py-1.5 text-[12.5px] font-medium transition-colors"
			})
		}),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex flex-col h-full w-full",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between px-4 h-12 border-b border-border bg-background/80 backdrop-blur-md shrink-0 select-none",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[12px] font-medium text-muted-foreground flex items-center gap-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "px-2 py-1 rounded bg-surface-2 border border-border",
							children: [rows.length, " Total Spaces"]
						})
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex-1 flex flex-col min-h-0 bg-white/40 dark:bg-black/20 backdrop-blur-sm m-3 rounded-xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.04)] overflow-hidden relative",
					children: rows.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataGrid, {
						rows,
						columns,
						selected,
						onToggle: handleToggle,
						onToggleAll: handleToggleAll,
						renderContextMenu
					}) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 flex flex-col items-center justify-center text-center p-8",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4 border border-border shadow-sm",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-5 text-muted-foreground" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-sm font-semibold text-foreground mb-1",
								children: "No calculation rows"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground max-w-sm mb-4",
								children: "Add a row to start calculating lighting requirements based on your project parameters."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: addRow,
								className: "flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-[13px] font-medium shadow-sm transition-all",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Add First Row"]
							})
						]
					})
				})]
			})]
		})
	});
}
//#endregion
export { LightingLuxCalculationPage as component };
