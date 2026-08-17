import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { N as Plus, _t as Database, it as FolderPlus, l as Upload, n as X, p as Trash, xt as Copy } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { a as ContextMenuSeparator, i as ContextMenuItem, r as ContextMenuContent, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as ImportExcelBtn } from "./ImportExcelBtn-rAnQAoVD.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
import { t as DataGrid } from "./DataGrid-kg4gScDe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/busbar-voltage-drop-ClLaxH_c.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
require_excel();
import_FileSaver_min.default.saveAs;
var DEFAULT_RATINGS = [
	{
		rating: "800 (Rt)",
		r: .075,
		x: .02
	},
	{
		rating: "1000 (Rt)",
		r: .0523,
		x: .019
	},
	{
		rating: "1250 (Rt)",
		r: .04,
		x: .015
	},
	{
		rating: "1600 (Rt)",
		r: .03,
		x: .013
	},
	{
		rating: "2000 (Rt)",
		r: .022,
		x: .011
	},
	{
		rating: "2500 (Rt)",
		r: .0177,
		x: .01
	},
	{
		rating: "3200 (Rt)",
		r: .013,
		x: .009
	},
	{
		rating: "4000 (Rt)",
		r: .01,
		x: .008
	}
];
var computeAllRows = (rows, globalR, globalX) => {
	let currentGroupVd = 0;
	return rows.map((row) => {
		if (row.isGroup) {
			currentGroupVd = row.cumulativeVd || 0;
			return {
				...row,
				maxDemand: 0,
				lineCurrent: 0,
				vd: 0,
				vdPercent: 0
			};
		}
		const V = row.voltage || 1;
		const PF = row.pf || 1;
		const maxDemand = row.tcl * row.df;
		const lineCurrent = maxDemand * 1e3 / (1.732 * V * PF);
		const sinPhi = Math.sin(Math.acos(Math.min(1, Math.max(-1, PF))));
		const vd = 1.732 * lineCurrent * row.length * (globalR * PF + globalX * sinPhi) / 1e3;
		const vdPercent = vd / V * 100;
		const cumulativeVd = currentGroupVd + vdPercent;
		return {
			...row,
			maxDemand: Number(maxDemand.toFixed(2)),
			lineCurrent: Number(lineCurrent.toFixed(2)),
			vd: Number(vd.toFixed(2)),
			vdPercent: Number(vdPercent.toFixed(2)),
			cumulativeVd: Number(cumulativeVd.toFixed(2))
		};
	});
};
var pushToHistory = (currentRows, history, setHistory, setRedoStack) => {
	setHistory([...history, [...currentRows]]);
	if (setRedoStack) setRedoStack([]);
};
function BusbarVoltageDropPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const confirm = useConfirm();
	const [rows, setRows] = (0, import_react.useState)([]);
	const [selected, setSelected] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [activeRowId, setActiveRowId] = (0, import_react.useState)();
	const [history, setHistory] = (0, import_react.useState)([]);
	const [redoStack, setRedoStack] = (0, import_react.useState)([]);
	const [globalRating, setGlobalRating] = (0, import_react.useState)("1000 (Rt)");
	const [globalR, setGlobalR] = (0, import_react.useState)(.0523);
	const [globalX, setGlobalX] = (0, import_react.useState)(.019);
	const [customRatings, setCustomRatings] = (0, import_react.useState)([]);
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		try {
			const stored = localStorage.getItem("customBusbarRatings");
			if (stored) setCustomRatings(JSON.parse(stored));
		} catch (e) {
			console.error(e);
		}
		if (project?.id) setLoadedProjectId(project.id);
		else setLoadedProjectId("loaded");
	}, []);
	const allRatings = (0, import_react.useMemo)(() => [...DEFAULT_RATINGS, ...customRatings], [customRatings]);
	(0, import_react.useEffect)(() => {
		setRows((prev) => computeAllRows(prev, globalR, globalX));
	}, [globalR, globalX]);
	const updateRow = (id, updates) => {
		pushToHistory(rows, history, setHistory, setRedoStack);
		let newRows = [...rows];
		if (selected.has(id) && selected.size > 1) newRows = newRows.map((row) => {
			if (selected.has(row.id)) return {
				...row,
				...updates
			};
			return row;
		});
		else newRows = newRows.map((row) => row.id === id ? {
			...row,
			...updates
		} : row);
		setRows(computeAllRows(newRows, globalR, globalX));
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
	const addRow = (isGroup = false) => {
		const newId = `bb_${Math.random().toString(36).slice(2, 9)}`;
		const newRow = {
			id: newId,
			isGroup,
			ref: isGroup ? "BUSBAR REF. NAME:" : "",
			from: "",
			tapOff: "",
			length: 0,
			smdbLoad: 0,
			tcl: 0,
			voltage: 400,
			pf: .8,
			df: 1,
			maxDemand: 0,
			lineCurrent: 0,
			vd: 0,
			vdPercent: 0,
			cumulativeVd: 0
		};
		pushToHistory(rows, history, setHistory, setRedoStack);
		setRows((prev) => computeAllRows([...prev, newRow], globalR, globalX));
		setSelected(/* @__PURE__ */ new Set([newId]));
		setActiveRowId(newId);
	};
	const loadDummyData = () => {
		const dummy = [
			{
				id: `bb_${Math.random().toString(36).slice(2, 9)}`,
				isGroup: true,
				ref: "BUSBAR REF. NAME: BB-A",
				from: "",
				tapOff: "",
				length: 0,
				smdbLoad: 0,
				tcl: 0,
				voltage: 0,
				pf: 0,
				df: 0,
				maxDemand: 0,
				lineCurrent: 0,
				vd: 0,
				vdPercent: 0,
				cumulativeVd: .5
			},
			{
				id: `bb_${Math.random().toString(36).slice(2, 9)}`,
				isGroup: false,
				ref: "",
				from: "MDB",
				tapOff: "SMDB-1",
				length: 15,
				smdbLoad: 250,
				tcl: 300,
				voltage: 400,
				pf: .8,
				df: .85,
				maxDemand: 0,
				lineCurrent: 0,
				vd: 0,
				vdPercent: 0,
				cumulativeVd: 0
			},
			{
				id: `bb_${Math.random().toString(36).slice(2, 9)}`,
				isGroup: false,
				ref: "",
				from: "MDB",
				tapOff: "SMDB-2",
				length: 25,
				smdbLoad: 150,
				tcl: 180,
				voltage: 400,
				pf: .8,
				df: .9,
				maxDemand: 0,
				lineCurrent: 0,
				vd: 0,
				vdPercent: 0,
				cumulativeVd: 0
			}
		];
		pushToHistory(rows, history, setHistory, setRedoStack);
		setRows((prev) => computeAllRows([...prev, ...dummy], globalR, globalX));
	};
	const deleteSelected = async () => {
		if (selected.size === 0) return;
		if (await confirm(`Are you sure you want to delete ${selected.size} selected row(s)?`)) {
			pushToHistory(rows, history, setHistory, setRedoStack);
			setRows((prev) => computeAllRows(prev.filter((r) => !selected.has(r.id)), globalR, globalX));
			setSelected(/* @__PURE__ */ new Set());
			setActiveRowId(void 0);
		}
	};
	const duplicateSelected = () => {
		if (selected.size === 0) return;
		pushToHistory(rows, history, setHistory, setRedoStack);
		const duplicated = [];
		rows.forEach((r) => {
			if (selected.has(r.id)) duplicated.push({
				...r,
				id: `bb_dup_${Math.random().toString(36).slice(2, 9)}`,
				ref: `${r.ref} (Copy)`
			});
		});
		setRows((prev) => computeAllRows([...prev, ...duplicated], globalR, globalX));
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
					const previous = history[history.length - 1];
					setRedoStack((prev) => [...prev, rows]);
					setRows(previous);
					setHistory((prev) => prev.slice(0, -1));
				}
			}
			if (isCmdOrCtrl && (e.key.toLowerCase() === "y" || e.shiftKey && e.key.toLowerCase() === "z")) {
				e.preventDefault();
				if (redoStack.length > 0) {
					const next = redoStack[redoStack.length - 1];
					setHistory((prev) => [...prev, rows]);
					setRows(next);
					setRedoStack((prev) => prev.slice(0, -1));
				}
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "c" && selected.size > 0) {
				e.preventDefault();
				const selectedRows = rows.filter((r) => selected.has(r.id));
				navigator.clipboard.writeText(JSON.stringify(selectedRows));
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
				e.preventDefault();
				navigator.clipboard.readText().then((text) => {
					try {
						const parsed = JSON.parse(text);
						if (Array.isArray(parsed) && parsed.length > 0 && "smdbLoad" in parsed[0]) {
							pushToHistory(rows, history, setHistory, setRedoStack);
							const newRows = parsed.map((r) => ({
								...r,
								id: `bb_paste_${Math.random().toString(36).slice(2, 9)}`
							}));
							setRows((prev) => computeAllRows([...prev, ...newRows], globalR, globalX));
						}
					} catch (err) {
						console.error("Failed to paste", err);
					}
				});
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		rows,
		selected,
		history,
		redoStack,
		activeRowId
	]);
	const handleImportRatings = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const lines = (event.target?.result).split("\n").map((l) => l.trim()).filter((l) => l);
				const newRatings = [];
				let startIdx = 0;
				if (lines.length > 0) {
					const firstCols = lines[0].split(",");
					if (firstCols.length >= 3 && isNaN(parseFloat(firstCols[1]))) startIdx = 1;
				}
				for (let i = startIdx; i < lines.length; i++) {
					const cols = lines[i].split(",");
					if (cols.length >= 3) {
						const rating = cols[0].trim();
						const r = parseFloat(cols[1].trim());
						const x = parseFloat(cols[2].trim());
						if (rating && !isNaN(r) && !isNaN(x)) {
							if (!DEFAULT_RATINGS.find((d) => d.rating === rating)) newRatings.push({
								rating,
								r,
								x
							});
						}
					}
				}
				if (newRatings.length > 0) {
					const updated = [...customRatings];
					newRatings.forEach((nr) => {
						const existingIdx = updated.findIndex((u) => u.rating === nr.rating);
						if (existingIdx >= 0) updated[existingIdx] = nr;
						else updated.push(nr);
					});
					setCustomRatings(updated);
					localStorage.setItem("customBusbarRatings", JSON.stringify(updated));
					alert(`Successfully imported ${newRatings.length} ratings!`);
				} else alert("No valid ratings found. Ensure CSV format is: Rating,R,X");
			} catch (err) {
				alert("Failed to parse CSV file.");
			}
		};
		reader.readAsText(file);
		e.target.value = "";
	};
	const clearCustomRatings = async () => {
		if (await confirm("Are you sure you want to clear all imported custom ratings?")) {
			setCustomRatings([]);
			localStorage.removeItem("customBusbarRatings");
		}
	};
	const handleImportExcelRows = (mappedRows) => {
		const newRows = mappedRows.map((mr, idx) => ({
			id: `vd_import_${Date.now()}_${idx}`,
			isGroup: false,
			busbarRef: mr.busbarRef || `Imported Busbar ${idx + 1}`,
			from: mr.from || "",
			to: mr.to || "",
			length: Number(mr.length) || 10,
			loadKw: Number(mr.loadKw) || 0,
			powerFactor: Number(mr.powerFactor) || .8,
			phase: Number(mr.phase) || 3,
			voltageDropLimit: Number(mr.voltageDropLimit) || 5,
			rating: mr.rating || "800",
			ambientTemp: Number(mr.ambientTemp) || 50,
			diversityFactor: Number(mr.diversityFactor) || 1
		}));
		setRows((prev) => computeAllRows([...prev, ...newRows]));
	};
	const columns = (0, import_react.useMemo)(() => [
		{
			key: "ref",
			header: "Busbar Ref / Name",
			width: 150,
			render: (row) => {
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					"data-row-idx": rows.findIndex((r) => r.id === row.id),
					"data-col-idx": 0,
					className: `w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 ${row.isGroup ? "font-bold" : ""}`,
					value: row.ref,
					onChange: (e) => updateRow(row.id, { ref: e.target.value }),
					onFocus: () => {
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				});
			}
		},
		{
			key: "from",
			header: "From",
			width: 90,
			render: (row) => {
				if (row.isGroup) return null;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					"data-row-idx": rows.findIndex((r) => r.id === row.id),
					"data-col-idx": 1,
					className: "w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1",
					value: row.from,
					onChange: (e) => updateRow(row.id, { from: e.target.value }),
					onFocus: () => {
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				});
			}
		},
		{
			key: "tapOff",
			header: "Tap Off Point",
			width: 100,
			render: (row) => {
				if (row.isGroup) return null;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					"data-row-idx": rows.findIndex((r) => r.id === row.id),
					"data-col-idx": 2,
					className: "w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1",
					value: row.tapOff,
					onChange: (e) => updateRow(row.id, { tapOff: e.target.value }),
					onFocus: () => {
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				});
			}
		},
		{
			key: "length",
			header: "Length (m)",
			width: 80,
			render: (row) => {
				if (row.isGroup) return null;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					"data-row-idx": rows.findIndex((r) => r.id === row.id),
					"data-col-idx": 3,
					className: "w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center",
					value: row.length || "",
					onChange: (e) => updateRow(row.id, { length: parseFloat(e.target.value) || 0 }),
					onFocus: () => {
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				});
			}
		},
		{
			key: "smdbLoad",
			header: "SMDB Load (kW)",
			width: 100,
			render: (row) => {
				if (row.isGroup) return null;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					"data-row-idx": rows.findIndex((r) => r.id === row.id),
					"data-col-idx": 4,
					className: "w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center",
					value: row.smdbLoad || "",
					onChange: (e) => updateRow(row.id, { smdbLoad: parseFloat(e.target.value) || 0 }),
					onFocus: () => {
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				});
			}
		},
		{
			key: "tcl",
			header: "TCL (kW)",
			width: 80,
			render: (row) => {
				if (row.isGroup) return null;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					"data-row-idx": rows.findIndex((r) => r.id === row.id),
					"data-col-idx": 5,
					className: "w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center font-medium",
					value: row.tcl || "",
					onChange: (e) => updateRow(row.id, { tcl: parseFloat(e.target.value) || 0 }),
					onFocus: () => {
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				});
			}
		},
		{
			key: "voltage",
			header: "Voltage",
			width: 80,
			render: (row) => {
				if (row.isGroup) return null;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					"data-row-idx": rows.findIndex((r) => r.id === row.id),
					"data-col-idx": 6,
					className: "w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center",
					value: row.voltage || "",
					onChange: (e) => updateRow(row.id, { voltage: parseFloat(e.target.value) || 0 }),
					onFocus: () => {
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				});
			}
		},
		{
			key: "pf",
			header: "PF",
			width: 60,
			render: (row) => {
				if (row.isGroup) return null;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					step: "0.01",
					"data-row-idx": rows.findIndex((r) => r.id === row.id),
					"data-col-idx": 7,
					className: "w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center",
					value: row.pf || "",
					onChange: (e) => updateRow(row.id, { pf: parseFloat(e.target.value) || 0 }),
					onFocus: () => {
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				});
			}
		},
		{
			key: "df",
			header: "DF",
			width: 60,
			render: (row) => {
				if (row.isGroup) return null;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					step: "0.01",
					"data-row-idx": rows.findIndex((r) => r.id === row.id),
					"data-col-idx": 8,
					className: "w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center",
					value: row.df || "",
					onChange: (e) => updateRow(row.id, { df: parseFloat(e.target.value) || 0 }),
					onFocus: () => {
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				});
			}
		},
		{
			key: "maxDemand",
			header: "Max Demand",
			width: 100,
			render: (row) => !row.isGroup ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "w-full text-center font-medium text-slate-700 dark:text-slate-300",
				children: row.maxDemand
			}) : null
		},
		{
			key: "lineCurrent",
			header: "Line A",
			width: 80,
			render: (row) => !row.isGroup ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "w-full text-center text-slate-500",
				children: row.lineCurrent
			}) : null
		},
		{
			key: "vd",
			header: "VD (V)",
			width: 80,
			render: (row) => !row.isGroup ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "w-full text-center font-medium",
				children: row.vd
			}) : null
		},
		{
			key: "vdPercent",
			header: "VD (%)",
			width: 80,
			render: (row) => !row.isGroup ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "w-full text-center font-bold text-[#06456F] dark:text-sky-400",
				children: row.vdPercent
			}) : null
		},
		{
			key: "cumulativeVd",
			header: "Cumul. %V",
			width: 90,
			render: (row) => {
				const idx = rows.findIndex((r) => r.id === row.id);
				if (row.isGroup) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded px-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] text-slate-500",
						children: "Parent:"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "number",
						step: "0.01",
						"data-row-idx": idx,
						"data-col-idx": 12,
						className: "w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded text-center text-sm font-bold",
						value: row.cumulativeVd,
						onChange: (e) => updateRow(row.id, { cumulativeVd: parseFloat(e.target.value) || 0 }),
						onFocus: () => {
							setSelected(/* @__PURE__ */ new Set([row.id]));
							setActiveRowId(row.id);
						},
						title: "Input the parent Voltage Drop % to cascade to these children"
					})]
				});
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "w-full text-center font-bold text-blue-600 dark:text-blue-400",
					children: row.cumulativeVd
				});
			}
		}
	], [rows]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Busbar Voltage Drop Calculations",
		subtitle: "Calculate busbar voltage drop with resistive and reactive components.",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex gap-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportExcelBtn, {
				columnMapping: {
					"Busbar Ref": "busbarRef",
					"From": "from",
					"To": "to",
					"Length (m)": "length",
					"Length": "length",
					"Load (kW)": "loadKw",
					"Load": "loadKw",
					"PF": "powerFactor",
					"Power Factor": "powerFactor",
					"Phase": "phase",
					"VD Limit (%)": "voltageDropLimit",
					"VD Limit": "voltageDropLimit",
					"Rating": "rating",
					"Ambient Temp (C)": "ambientTemp",
					"Diversity Factor": "diversityFactor",
					"DF": "diversityFactor"
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
								onClick: () => addRow(true),
								className: "flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-[12.5px] font-medium shadow-sm transition-all",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderPlus, { className: "size-3.5" }), " Add Group"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => addRow(false),
								className: "flex items-center gap-1.5 px-3 py-1.5 border border-primary/20 text-primary hover:bg-primary/10 rounded text-[12.5px] font-medium shadow-sm transition-all",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add Tap Off"]
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
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-px h-4 bg-border mx-1" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3 bg-slate-100/50 dark:bg-slate-900/50 px-3 py-1 rounded-md border border-border",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-semibold text-muted-foreground",
											children: "Rating:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: globalRating,
											onChange: (e) => {
												const val = e.target.value;
												setGlobalRating(val);
												if (val !== "Custom") {
													const found = allRatings.find((r) => r.rating === val);
													if (found) {
														setGlobalR(found.r);
														setGlobalX(found.x);
													}
												}
											},
											className: "bg-transparent border border-border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary min-w-[100px]",
											children: [allRatings.map((rt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: rt.rating,
												children: rt.rating
											}, rt.rating)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "Custom",
												children: "Custom"
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-semibold text-muted-foreground",
											children: "R:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "0.0001",
											value: globalR,
											onChange: (e) => setGlobalR(parseFloat(e.target.value) || 0),
											className: "w-16 bg-transparent border border-border rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-semibold text-muted-foreground",
											children: "X:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "0.0001",
											value: globalX,
											onChange: (e) => setGlobalX(parseFloat(e.target.value) || 0),
											className: "w-16 bg-transparent border border-border rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-px h-4 bg-border mx-1" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "flex items-center gap-1 cursor-pointer text-xs font-medium text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }),
												" Import",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "file",
													accept: ".csv,.txt",
													className: "hidden",
													onChange: handleImportRatings
												})
											]
										}), customRatings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: clearCustomRatings,
											className: "flex items-center gap-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 px-2 py-1 rounded transition-colors ml-1",
											title: "Clear Custom Ratings",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
										})]
									})
								]
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex-1 overflow-hidden flex flex-col relative p-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
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
										onClick: () => addRow(false),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4 mr-2" }), " Add Tap Off"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
										onClick: () => addRow(true),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderPlus, { className: "size-4 mr-2" }), " Add Group"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
										onClick: duplicateSelected,
										disabled: selected.size === 0,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4 mr-2" }), " Duplicate Selected"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, {}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
										onClick: deleteSelected,
										disabled: selected.size === 0,
										className: "text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash, { className: "size-4 mr-2" }), " Delete Selected"]
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
									children: "No busbar rows"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground max-w-sm mb-4",
									children: "Add a group or load sample data to begin calculating your busbar voltage drops."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => addRow(true),
									className: "flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-[13px] font-medium shadow-sm transition-all",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Add First Group"]
								})
							]
						})
					})
				})]
			})]
		})
	});
}
//#endregion
export { BusbarVoltageDropPage as component };
