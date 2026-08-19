import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Gt as PenLine, Ht as Activity, M as Printer, N as Plus, S as Settings, T as Search, Ut as TriangleAlert, Wt as Sparkles, Y as Info, ht as Droplet, in as CircleCheck, j as Redo, k as RefreshCw, l as Upload, lt as FileText, m as Trash2, n as X, nn as CircleQuestionMark, u as Undo, xt as Copy } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { _ as dirtyStore, a as ContextMenuSeparator, i as ContextMenuItem, r as ContextMenuContent, t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
import { t as addPdfSignatureBlock } from "./pdfHelpers-Cqwarpxq.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { n as utils, t as readSync } from "../_libs/xlsx.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { t as DataGrid } from "./DataGrid-Ct9FtLBj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-sprinkler-kfactor-CHyjTD5r.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
var STANDARD_K_FACTORS = [
	2.8,
	4.2,
	5.6,
	8,
	11.2,
	14,
	16.8,
	19.6,
	22.4,
	25.2,
	28
];
function getKFactorDetail(k, isSI) {
	if (k === "") return {
		orifice: "—",
		thread: "—",
		desc: "Custom K-factor",
		sizeRatio: .55
	};
	const kVal = Number(k);
	const ipK = isSI ? kVal / 14.28 : kVal;
	if (ipK <= 3) return {
		orifice: isSI ? "9.5 mm" : "3/8\"",
		thread: isSI ? "15 mm (1/2\" NPT)" : "1/2\" NPT",
		desc: "Residential / Small Orifice",
		sizeRatio: .35
	};
	if (ipK <= 4.8) return {
		orifice: isSI ? "11.0 mm" : "7/16\"",
		thread: isSI ? "15 mm (1/2\" NPT)" : "1/2\" NPT",
		desc: "Residential / Light Hazard",
		sizeRatio: .45
	};
	if (ipK <= 6) return {
		orifice: isSI ? "12.7 mm" : "1/2\"",
		thread: isSI ? "15 mm (1/2\" NPT)" : "1/2\" NPT",
		desc: "Standard Spray Sprinkler",
		sizeRatio: .55
	};
	if (ipK <= 9) return {
		orifice: isSI ? "13.5 mm" : "17/32\"",
		thread: isSI ? "20 mm (3/4\" NPT)" : "3/4\" NPT",
		desc: "Large Orifice / Extra Hazard",
		sizeRatio: .65
	};
	if (ipK <= 12) return {
		orifice: isSI ? "15.9 mm" : "5/8\"",
		thread: isSI ? "20 mm (3/4\" NPT)" : "3/4\" NPT",
		desc: "ESFR / Storage Sprinkler",
		sizeRatio: .75
	};
	if (ipK <= 15) return {
		orifice: isSI ? "19.0 mm" : "3/4\"",
		thread: isSI ? "20 mm (3/4\" NPT)" : "3/4\" NPT",
		desc: "ESFR / High Flow Storage",
		sizeRatio: .85
	};
	return {
		orifice: isSI ? "20.0 - 25.4 mm" : "25/32\" to 1.0\"",
		thread: isSI ? "20 - 25 mm (3/4\" or 1\" NPT)" : "3/4\" or 1\" NPT",
		desc: "Ultra Large Orifice / ESFR Deluge",
		sizeRatio: .95
	};
}
var BULB_RATINGS = [
	{
		color: "orange",
		tempF: "135°F",
		tempC: "57°C",
		classification: "Ordinary",
		hex: "#f97316",
		bgHex: "bg-[#0A7BC7]/10",
		textHex: "text-[#0A7BC7]"
	},
	{
		color: "red",
		tempF: "155°F",
		tempC: "68°C",
		classification: "Ordinary",
		hex: "#ef4444",
		bgHex: "bg-red-500/10",
		textHex: "text-red-500"
	},
	{
		color: "yellow",
		tempF: "175°F",
		tempC: "79°C",
		classification: "Intermediate",
		hex: "#eab308",
		bgHex: "bg-yellow-500/10",
		textHex: "text-yellow-500"
	},
	{
		color: "green",
		tempF: "200°F",
		tempC: "93°C",
		classification: "Intermediate",
		hex: "#22c55e",
		bgHex: "bg-green-500/10",
		textHex: "text-green-500"
	},
	{
		color: "blue",
		tempF: "286°F",
		tempC: "141°C",
		classification: "High",
		hex: "#3b82f6",
		bgHex: "bg-blue-500/10",
		textHex: "text-blue-500"
	},
	{
		color: "mauve",
		tempF: "360°F",
		tempC: "182°C",
		classification: "Extra High",
		hex: "#a855f7",
		bgHex: "bg-purple-500/10",
		textHex: "text-purple-500"
	},
	{
		color: "black",
		tempF: "500°F",
		tempC: "260°C",
		classification: "Ultra High",
		hex: "#18181b",
		bgHex: "bg-zinc-500/10",
		textHex: "text-zinc-700 dark:text-zinc-300"
	}
];
var HAZARD_LIMITS = {
	"Light Hazard": 225,
	"Ordinary Hazard Gp 1": 130,
	"Ordinary Hazard Gp 2": 130,
	"Extra Hazard Gp 1": 100,
	"Extra Hazard Gp 2": 100
};
var DEFAULT_ROWS = [
	{
		id: "sprink_1",
		label: "Office Room 101 - Pendent",
		kFactor: 5.6,
		solveFor: "Q",
		pressure: 15,
		flow: 21.69,
		coverage: 130,
		hazard: "Ordinary Hazard Gp 1",
		notes: "Standard office coverage"
	},
	{
		id: "sprink_2",
		label: "Reception Area - Pendent",
		kFactor: 5.6,
		solveFor: "Q",
		pressure: 12,
		flow: 19.4,
		coverage: 130,
		hazard: "Ordinary Hazard Gp 1",
		notes: ""
	},
	{
		id: "sprink_3",
		label: "Server Room - Upright",
		kFactor: 8,
		solveFor: "Q",
		pressure: 20,
		flow: 35.78,
		coverage: 90,
		hazard: "Extra Hazard Gp 1",
		notes: "High density area"
	},
	{
		id: "sprink_4",
		label: "Storage Closet - Sidewall",
		kFactor: 4.2,
		solveFor: "Q",
		pressure: 10,
		flow: 13.28,
		coverage: 100,
		hazard: "Light Hazard",
		notes: "Small storage"
	}
];
function computeRowOutputs(row) {
	const K = row.kFactor || 5.6;
	if (row.solveFor === "Q") {
		const P = Math.max(0, row.pressure);
		const Q = K * Math.sqrt(P);
		return {
			...row,
			flow: parseFloat(Q.toFixed(2))
		};
	} else {
		const Q = Math.max(0, row.flow);
		const P = Math.pow(Q / K, 2);
		return {
			...row,
			pressure: parseFloat(P.toFixed(2))
		};
	}
}
function SprinklerKFactorPage() {
	const { userData, profile } = useAuth();
	const currentUserName = userData?.name || profile?.name || "System Admin";
	const { project, forceSaveToCloud } = useWorkspace();
	const confirm = useConfirm();
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	const [tab, setTab] = (0, import_react.useState)("solver");
	const [intelOpen, setIntelOpen] = (0, import_react.useState)(false);
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("ip");
	const handleUnitToggle = (newSystem) => {
		if (newSystem === unitSystem) return;
		setUnitSystem(newSystem);
		setRows((prevRows) => prevRows.map((row) => {
			let k = row.kFactor;
			let p = row.pressure;
			let q = row.flow;
			let cov = row.coverage;
			if (newSystem === "si") {
				k = parseFloat((k * 14.28).toFixed(1));
				p = parseFloat((p / 14.5038).toFixed(2));
				q = parseFloat((q * 3.78541).toFixed(2));
				cov = parseFloat((cov / 10.7639).toFixed(1));
			} else {
				k = parseFloat((k / 14.28).toFixed(1));
				p = parseFloat((p * 14.5038).toFixed(2));
				q = parseFloat((q / 3.78541).toFixed(2));
				cov = parseFloat((cov * 10.7639).toFixed(1));
			}
			return {
				...row,
				kFactor: k,
				pressure: p,
				flow: q,
				coverage: cov
			};
		}));
		if (newSystem === "si") {
			setSolverK((prev) => prev === "" ? "" : parseFloat((prev * 14.28).toFixed(1)));
			setSolverKnownVal((prev) => {
				const numericPrev = prev === "" ? 0 : prev;
				if (solverSolveFor === "Q") return parseFloat((numericPrev / 14.5038).toFixed(2));
				else return parseFloat((numericPrev * 3.78541).toFixed(2));
			});
		} else {
			setSolverK((prev) => prev === "" ? "" : parseFloat((prev / 14.28).toFixed(1)));
			setSolverKnownVal((prev) => {
				const numericPrev = prev === "" ? 0 : prev;
				if (solverSolveFor === "Q") return parseFloat((numericPrev * 14.5038).toFixed(2));
				else return parseFloat((numericPrev / 3.78541).toFixed(2));
			});
		}
	};
	const [solverK, setSolverK] = (0, import_react.useState)(5.6);
	const [solverSolveFor, setSolverSolveFor] = (0, import_react.useState)("Q");
	const [solverKnownVal, setSolverKnownVal] = (0, import_react.useState)(30);
	const [isCustomK, setIsCustomK] = (0, import_react.useState)(false);
	const [selectedBulbColor, setSelectedBulbColor] = (0, import_react.useState)("red");
	const [rows, setRows] = (0, import_react.useState)(() => {
		try {
			const stored = localStorage.getItem(`mep_sprinklers_${project.id}`);
			return stored ? JSON.parse(stored) : DEFAULT_ROWS;
		} catch {
			return DEFAULT_ROWS;
		}
	});
	(0, import_react.useEffect)(() => {
		if (project?.id) {
			const stored = localStorage.getItem(`mep_sprinklers_${project.id}`);
			if (stored) try {
				setRows(JSON.parse(stored));
			} catch {
				setRows(DEFAULT_ROWS);
			}
			else setRows(DEFAULT_ROWS);
			setUndoStack([]);
			setRedoStack([]);
			setLoadedProjectId(project.id);
		}
	}, [project?.id]);
	const [selected, setSelected] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [lastSelectedId, setLastSelectedId] = (0, import_react.useState)(null);
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const [hazardFilter, setHazardFilter] = (0, import_react.useState)("All");
	const [kFilter, setKFilter] = (0, import_react.useState)("All");
	const [undoStack, setUndoStack] = (0, import_react.useState)([]);
	const [redoStack, setRedoStack] = (0, import_react.useState)([]);
	const pushToUndo = (newRows) => {
		setUndoStack((prev) => [...prev.slice(-49), JSON.stringify(rows)]);
		setRedoStack([]);
	};
	const handleUndo = () => {
		if (undoStack.length === 0) return;
		const previous = undoStack[undoStack.length - 1];
		setUndoStack((prev) => prev.slice(0, -1));
		setRedoStack((prev) => [...prev, JSON.stringify(rows)]);
		setRows(JSON.parse(previous));
		localStorage.setItem(`mep_sprinklers_${project.id}`, previous);
	};
	const handleRedo = () => {
		if (redoStack.length === 0) return;
		const next = redoStack[redoStack.length - 1];
		setRedoStack((prev) => prev.slice(0, -1));
		setUndoStack((prev) => [...prev, JSON.stringify(rows)]);
		setRows(JSON.parse(next));
		localStorage.setItem(`mep_sprinklers_${project.id}`, next);
	};
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			localStorage.setItem(`mep_sprinklers_${project.id}`, JSON.stringify(rows));
			dirtyStore.set(true);
		}
	}, [
		rows,
		project?.id,
		loadedProjectId
	]);
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			const activeEl = document.activeElement;
			if (activeEl && (activeEl.tagName === "INPUT" && activeEl.type !== "checkbox" && activeEl.type !== "radio" || activeEl.tagName === "SELECT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable || activeEl.getAttribute("contenteditable") === "true")) return;
			const isCmdOrCtrl = navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? e.metaKey : e.ctrlKey;
			if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
				e.preventDefault();
				if (tab === "schedule") setSelected(new Set(rows.map((r) => r.id)));
			}
			if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
				e.preventDefault();
				handleUndo();
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "y" || isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z") {
				e.preventDefault();
				handleRedo();
			}
			if ((e.key === "Delete" || e.key === "Backspace") && tab === "schedule" && selected.size > 0) {
				e.preventDefault();
				confirmDeleteSelected();
			}
			if (e.key === "Escape") {
				e.preventDefault();
				setSelected(/* @__PURE__ */ new Set());
				setLastSelectedId(null);
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "c" && tab === "schedule" && selected.size > 0) {
				e.preventDefault();
				const toCopy = rows.filter((r) => selected.has(r.id));
				localStorage.setItem("mep_clipboard_sprinklers", JSON.stringify(toCopy));
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "x" && tab === "schedule" && selected.size > 0) {
				e.preventDefault();
				const toCopy = rows.filter((r) => selected.has(r.id));
				localStorage.setItem("mep_clipboard_sprinklers", JSON.stringify(toCopy));
				pushToUndo(rows);
				setRows((prev) => prev.filter((r) => !selected.has(r.id)));
				setSelected(/* @__PURE__ */ new Set());
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "v" && tab === "schedule") {
				e.preventDefault();
				try {
					const clipboardData = localStorage.getItem("mep_clipboard_sprinklers");
					if (clipboardData) {
						const pasted = JSON.parse(clipboardData).map((item, idx) => ({
							...item,
							id: `sprink_paste_${Date.now()}_${idx}_${Math.floor(Math.random() * 1e3)}`,
							label: `${item.label} (Copy)`
						}));
						pushToUndo(rows);
						setRows((prev) => [...prev, ...pasted]);
					}
				} catch (err) {
					console.error("Paste failed:", err);
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		rows,
		selected,
		tab,
		undoStack,
		redoStack
	]);
	const solverResult = (0, import_react.useMemo)(() => {
		const isSI = unitSystem === "si";
		const knownValNum = solverKnownVal === "" ? 0 : solverKnownVal;
		const kFactorNum = solverK === "" ? 0 : solverK;
		if (solverSolveFor === "Q") {
			const flow = kFactorNum * Math.sqrt(Math.max(0, knownValNum));
			return {
				val: parseFloat(flow.toFixed(2)),
				unit: isSI ? "L/min" : "GPM",
				label: "Discharge Flow (Q)",
				formula: `Q = K \u00d7 \u221aP = ${kFactorNum} \u00d7 \u221a${knownValNum} = ${flow.toFixed(2)} ${isSI ? "L/min" : "GPM"}`,
				pressure: knownValNum
			};
		} else {
			const press = Math.pow(Math.max(0, knownValNum) / (kFactorNum || 1), 2);
			return {
				val: parseFloat(press.toFixed(2)),
				unit: isSI ? "bar" : "psi",
				label: "Required Pressure (P)",
				formula: `P = (Q / K)\u00b2 = (${knownValNum} / ${kFactorNum || 1})\u00b2 = ${press.toFixed(2)} ${isSI ? "bar" : "psi"}`,
				pressure: press
			};
		}
	}, [
		solverK,
		solverSolveFor,
		solverKnownVal,
		unitSystem
	]);
	const chartSvg = (0, import_react.useMemo)(() => {
		const xMax = unitSystem === "si" ? 7 : 100;
		const pts = [];
		const kFactorNum = solverK === "" ? 0 : solverK;
		for (let p = 0; p <= xMax; p += xMax / 50) pts.push([p, kFactorNum * Math.sqrt(p)]);
		const markP = solverResult.pressure;
		const markQ = solverSolveFor === "Q" ? solverResult.val : solverKnownVal === "" ? 0 : solverKnownVal;
		const W = 500;
		const H = 240;
		const PL = 50;
		const PR = 20;
		const PT = 30;
		const PB = 40;
		const CW = W - PL - PR;
		const CH = H - PT - PB;
		const xMin = 0;
		const yMin = 0;
		const yMax = Math.max(...pts.map((p) => p[1])) * 1.15 || 10;
		const sx = (v) => PL + (v - xMin) / (xMax - xMin) * CW;
		const sy = (v) => 200 - (v - yMin) / (yMax - yMin) * CH;
		const pathD = pts.map((p, i) => i === 0 ? `M${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}` : `L${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ");
		return {
			W,
			H,
			PL,
			PR,
			PT,
			PB,
			CW,
			CH,
			sx,
			sy,
			pathD,
			fillD: `${pathD} L${sx(xMax).toFixed(1)},${200 .toFixed(1)} L${PL},${200 .toFixed(1)} Z`,
			markX: sx(markP),
			markY: sy(markQ),
			markP,
			markQ,
			yMax,
			xMax
		};
	}, [
		solverK,
		solverResult,
		solverSolveFor,
		solverKnownVal,
		unitSystem
	]);
	const kDetails = (0, import_react.useMemo)(() => getKFactorDetail(solverK, unitSystem === "si"), [solverK, unitSystem]);
	const aggregateMetrics = (0, import_react.useMemo)(() => {
		let totalFlow = 0;
		let maxPressure = 0;
		let maxDens = .15;
		rows.forEach((r) => {
			totalFlow += r.flow || 0;
			if (r.pressure > maxPressure) maxPressure = r.pressure;
			if (r.hazard.includes("Extra")) maxDens = .3;
			else if (r.hazard.includes("Ordinary Gp 2")) maxDens = .2;
		});
		let hoseAllowance = unitSystem === "si" ? 946 : 250;
		if (maxPressure <= 0) hoseAllowance = 0;
		else if (maxDens <= .1) hoseAllowance = unitSystem === "si" ? 378 : 100;
		else if (maxDens <= .2) hoseAllowance = unitSystem === "si" ? 946 : 250;
		else hoseAllowance = unitSystem === "si" ? 1893 : 500;
		const systemDemand = totalFlow + hoseAllowance;
		return {
			totalFlow,
			maxPressure,
			hoseAllowance,
			systemDemand
		};
	}, [rows, unitSystem]);
	const reportBreakdowns = (0, import_react.useMemo)(() => {
		const kCounts = {};
		const hazardCounts = {};
		const totalRows = rows.length;
		rows.forEach((r) => {
			const kKey = `K-${r.kFactor.toFixed(1)}`;
			kCounts[kKey] = (kCounts[kKey] || 0) + 1;
			hazardCounts[r.hazard] = (hazardCounts[r.hazard] || 0) + 1;
		});
		return {
			kCounts,
			hazardCounts,
			totalRows
		};
	}, [rows]);
	const updateRow = (id, field, val) => {
		pushToUndo(rows);
		setRows((prev) => prev.map((row) => {
			if (row.id !== id) return row;
			let updated = {
				...row,
				[field]: val
			};
			updated = computeRowOutputs(updated);
			return updated;
		}));
	};
	const addSprinkler = () => {
		pushToUndo(rows);
		const newSprink = {
			id: `sprink_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
			label: `Sprinkler ${rows.length + 1}`,
			kFactor: 5.6,
			solveFor: "Q",
			pressure: 15,
			flow: 21.69,
			coverage: 130,
			hazard: "Ordinary Hazard Gp 1",
			notes: ""
		};
		setRows((prev) => [...prev, newSprink]);
	};
	const duplicateSelected = () => {
		if (selected.size === 0) return;
		pushToUndo(rows);
		const duplicated = [];
		rows.forEach((r) => {
			if (selected.has(r.id)) duplicated.push({
				...r,
				id: `sprink_dup_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
				label: `${r.label} (Clone)`
			});
		});
		setRows((prev) => [...prev, ...duplicated]);
	};
	const confirmDeleteSelected = async () => {
		if (await confirm(`Are you sure you want to delete ${selected.size} selected sprinkler(s)?`)) {
			pushToUndo(rows);
			setRows((prev) => prev.filter((r) => !selected.has(r.id)));
			setSelected(/* @__PURE__ */ new Set());
		}
	};
	const renderSprinklerContextMenu = (row) => {
		selected.size;
		const targetIds = selected.has(row.id) ? Array.from(selected) : [row.id];
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuContent, {
			className: "w-48",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: () => {
						setSelected(/* @__PURE__ */ new Set([row.id]));
					},
					className: "flex items-center gap-2 cursor-pointer text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Edit Sprinkler" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: () => {
						pushToUndo(rows);
						const dupList = [];
						rows.forEach((item) => {
							if (targetIds.includes(item.id)) dupList.push({
								...item,
								id: `sprink_ctx_dup_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
								label: `${item.label} (Duplicate)`
							});
						});
						setRows((prev) => [...prev, ...dupList]);
					},
					className: "flex items-center gap-2 cursor-pointer text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Duplicate" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: async () => {
						if (await confirm(`Delete the ${targetIds.length} selected sprinkler(s)?`)) {
							pushToUndo(rows);
							setRows((prev) => prev.filter((r) => !targetIds.includes(r.id)));
							setSelected(/* @__PURE__ */ new Set());
						}
					},
					className: "flex items-center gap-2 text-destructive cursor-pointer focus:bg-destructive/10 focus:text-destructive font-medium",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Delete" })]
				})
			]
		});
	};
	const fileInputRef = (0, import_react.useRef)(null);
	const handleImportClick = () => {
		fileInputRef.current?.click();
	};
	const handleImportFile = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (evt) => {
			try {
				const data = evt.target?.result;
				if (!data) return;
				const workbook = readSync(data, { type: "binary" });
				const sheetName = workbook.SheetNames[0];
				const sheet = workbook.Sheets[sheetName];
				const imported = utils.sheet_to_json(sheet).map((row, idx) => {
					const k = parseFloat(row["K-Factor"] || row["kFactor"] || row["K"] || 5.6) || 5.6;
					const haz = row["Hazard"] || row["hazard"] || "Ordinary Hazard Gp 1";
					const cov = parseFloat(row["Coverage"] || row["coverage"] || row["Area"] || 130) || 130;
					const press = parseFloat(row["Pressure"] || row["pressure"] || row["P"] || 15) || 15;
					const fl = parseFloat(row["Flow"] || row["flow"] || row["Q"] || 21.69) || 21.69;
					const solve = row["Solve For"] || row["solveFor"] || "Q";
					let newRow = {
						id: `sprink_imp_${Date.now()}_${idx}_${Math.floor(Math.random() * 1e3)}`,
						label: row["Label"] || row["label"] || row["Location"] || `Imported Sprinkler ${idx + 1}`,
						kFactor: k,
						solveFor: solve === "Pressure" || solve === "P" ? "P" : "Q",
						pressure: press,
						flow: fl,
						coverage: cov,
						hazard: haz,
						notes: row["Notes"] || row["notes"] || ""
					};
					newRow = computeRowOutputs(newRow);
					return newRow;
				});
				pushToUndo(rows);
				setRows((prev) => [...prev, ...imported]);
			} catch (err) {
				alert("Failed to parse file. Make sure it has valid Excel/CSV headings.");
			}
		};
		reader.readAsBinaryString(file);
		e.target.value = "";
	};
	const exportPdf = () => {
		const doc = new import_jspdf_node_min.default();
		doc.setFont("helvetica", "bold");
		doc.setFontSize(16);
		doc.setTextColor(220, 76, 52);
		doc.text("Sprinkler K-Factor & Water Demand Report", 14, 20);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(10);
		doc.setTextColor(80, 80, 80);
		doc.text(`Project Name: ${project.name}`, 14, 28);
		doc.text(`Project Number: ${project.code}`, 14, 34);
		doc.text(`Client Reference: ${project.client}`, 14, 40);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(12);
		doc.setTextColor(20, 20, 20);
		doc.text("Design Water Demand Summary:", 14, 50);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(10);
		doc.text(`Total Sprinkler Flow Rate: ${aggregateMetrics.totalFlow.toFixed(2)} GPM`, 14, 57);
		doc.text(`Max Sprinkler Operating Pressure: ${aggregateMetrics.maxPressure.toFixed(2)} psi`, 14, 63);
		doc.text(`Hose Stream Allowance (NFPA 13): ${aggregateMetrics.hoseAllowance} GPM`, 14, 69);
		doc.text(`Total System Water Demand: ${aggregateMetrics.systemDemand.toFixed(2)} GPM`, 14, 75);
		autoTable(doc, {
			startY: 83,
			head: [[
				"S.No",
				"Location / Label",
				"K-Factor",
				"Sizing Mode",
				"Pressure (psi)",
				"Flow (GPM)",
				"Coverage (ft²)",
				"Hazard Class",
				"Status"
			]],
			body: rows.map((r, idx) => [
				idx + 1,
				r.label,
				`K-${r.kFactor.toFixed(1)}`,
				r.solveFor === "Q" ? "Flow (Q)" : "Pressure (P)",
				r.pressure.toFixed(1),
				r.flow.toFixed(2),
				r.coverage.toString(),
				r.hazard,
				r.pressure < 7 ? "Low Press Violation" : "Complied"
			]),
			theme: "striped",
			styles: { fontSize: 8.5 },
			headStyles: {
				fillColor: [
					220,
					76,
					52
				],
				halign: "left"
			}
		});
		addPdfSignatureBlock(doc, doc.lastAutoTable?.finalY || 40, currentUserName, project?.id || "default", "plumbing-sprinkler-kfactor");
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), `Sprinkler_KFactor_Report_${project.code}.pdf`, "PDF Document", ["pdf"]);
	};
	const warningsList = (0, import_react.useMemo)(() => {
		const list = [];
		rows.forEach((r, idx) => {
			if (r.pressure < 7) list.push({
				id: `w_press_${r.id}`,
				type: "critical",
				title: `Low Pressure on ${r.label}`,
				desc: `Calculated pressure is ${r.pressure.toFixed(2)} psi, which is below the NFPA 13 minimum 7.0 psi.`,
				fixable: true,
				action: () => {
					pushToUndo(rows);
					setRows((prev) => prev.map((item) => item.id === r.id ? computeRowOutputs({
						...item,
						pressure: 7,
						solveFor: "Q"
					}) : item));
				}
			});
			let limit = 130;
			if (r.hazard.startsWith("Light")) limit = 225;
			else if (r.hazard.startsWith("Extra")) limit = 100;
			if (r.coverage > limit) list.push({
				id: `w_cov_${r.id}`,
				type: "warning",
				title: `Over-coverage on ${r.label}`,
				desc: `Coverage area is ${r.coverage} ft², exceeding the standard limit of ${limit} ft² for ${r.hazard}.`,
				fixable: false
			});
			if (r.pressure > 35 && r.kFactor < 11.2) {
				const nextK = STANDARD_K_FACTORS[STANDARD_K_FACTORS.indexOf(r.kFactor) + 1] || r.kFactor;
				const newP = Math.pow(r.flow / nextK, 2);
				list.push({
					id: `w_opt_${r.id}`,
					type: "warning",
					title: `Optimize K-Factor on ${r.label}`,
					desc: `Required pressure is high (${r.pressure.toFixed(1)} psi). Changing K-${r.kFactor} to K-${nextK} reduces required pressure to ${newP.toFixed(1)} psi.`,
					fixable: true,
					action: () => {
						pushToUndo(rows);
						setRows((prev) => prev.map((item) => item.id === r.id ? computeRowOutputs({
							...item,
							kFactor: nextK,
							solveFor: "P"
						}) : item));
					}
				});
			}
		});
		return list;
	}, [rows]);
	const handleFixAllPressures = () => {
		pushToUndo(rows);
		setRows((prev) => prev.map((r) => {
			if (r.pressure < 7) return computeRowOutputs({
				...r,
				pressure: 7,
				solveFor: "Q"
			});
			return r;
		}));
	};
	const handleOptimizeAllKFactors = () => {
		pushToUndo(rows);
		setRows((prev) => prev.map((r) => {
			if (r.pressure > 35 && r.kFactor < 11.2) {
				const nextK = STANDARD_K_FACTORS[STANDARD_K_FACTORS.indexOf(r.kFactor) + 1] || r.kFactor;
				return computeRowOutputs({
					...r,
					kFactor: nextK,
					solveFor: "P"
				});
			}
			return r;
		}));
	};
	const filteredRows = (0, import_react.useMemo)(() => {
		return rows.filter((r) => {
			const matchSearch = r.label.toLowerCase().includes(searchQuery.toLowerCase()) || (r.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
			const matchHazard = hazardFilter === "All" || r.hazard === hazardFilter;
			const matchK = kFilter === "All" || r.kFactor === parseFloat(kFilter);
			return matchSearch && matchHazard && matchK;
		});
	}, [
		rows,
		searchQuery,
		hazardFilter,
		kFilter
	]);
	function InlineInput({ value, onCommit, className = "", type = "text", step, min, disabled = false }) {
		const [localVal, setLocalVal] = (0, import_react.useState)(String(value));
		(0, import_react.useEffect)(() => {
			setLocalVal(String(value));
		}, [value]);
		const handleKeyDown = (e) => {
			if (e.key === "Enter") e.currentTarget.blur();
			else if (e.key === "Escape") {
				setLocalVal(String(value));
				e.currentTarget.blur();
			}
		};
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type,
			step,
			min,
			disabled,
			value: localVal,
			onChange: (e) => setLocalVal(e.target.value),
			onBlur: () => {
				if (localVal !== String(value)) onCommit(localVal);
			},
			onKeyDown: handleKeyDown,
			onClick: (e) => e.stopPropagation(),
			onDoubleClick: (e) => e.stopPropagation(),
			className: `bg-transparent w-full border border-transparent hover:border-border hover:bg-surface-2 focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl px-1.5 py-1 text-foreground transition-all cursor-text disabled:opacity-40 outline-none ${className}`
		});
	}
	const columns = (0, import_react.useMemo)(() => [
		{
			key: "label",
			header: "Sprinkler Label / Location",
			width: 200,
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				value: row.label,
				onCommit: (val) => updateRow(row.id, "label", val),
				className: "text-[13px]"
			})
		},
		{
			key: "kFactor",
			header: "K-Factor",
			width: 110,
			render: (row) => {
				const isSI = unitSystem === "si";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					value: row.kFactor,
					onChange: (e) => updateRow(row.id, "kFactor", parseFloat(e.target.value)),
					onClick: (e) => e.stopPropagation(),
					onDoubleClick: (e) => e.stopPropagation(),
					className: "bg-transparent w-full border border-transparent hover:border-border hover:bg-surface-2 focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl px-1.5 py-1 text-[13px] text-foreground font-medium transition-all outline-none cursor-pointer",
					children: [isSI ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "40.0",
							children: "K-40 (Res)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "60.0",
							children: "K-60"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "80.0",
							children: "K-80 (Std)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "115.0",
							children: "K-115"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "160.0",
							children: "K-160 (ESFR)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "200.0",
							children: "K-200"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "242.0",
							children: "K-242"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "282.0",
							children: "K-282"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "320.0",
							children: "K-320"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "360.0",
							children: "K-360"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "400.0",
							children: "K-400"
						})
					] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "2.8",
							children: "K-2.8 (Res)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "4.2",
							children: "K-4.2"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "5.6",
							children: "K-5.6 (Std)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "8.0",
							children: "K-8.0"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "11.2",
							children: "K-11.2 (ESFR)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "14.0",
							children: "K-14.0"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "16.8",
							children: "K-16.8"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "19.6",
							children: "K-19.6"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "22.4",
							children: "K-22.4"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "25.2",
							children: "K-25.2"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "28.0",
							children: "K-28.0"
						})
					] }), !(isSI ? [
						40,
						60,
						80,
						115,
						160,
						200,
						242,
						282,
						320,
						360,
						400
					] : [
						2.8,
						4.2,
						5.6,
						8,
						11.2,
						14,
						16.8,
						19.6,
						22.4,
						25.2,
						28
					]).includes(row.kFactor) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
						value: row.kFactor,
						children: ["Custom: K-", row.kFactor.toFixed(1)]
					})]
				});
			}
		},
		{
			key: "solveFor",
			header: "Sizing Target",
			width: 100,
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				value: row.solveFor,
				onChange: (e) => updateRow(row.id, "solveFor", e.target.value),
				onClick: (e) => e.stopPropagation(),
				onDoubleClick: (e) => e.stopPropagation(),
				className: "bg-transparent w-full border border-transparent hover:border-border hover:bg-surface-2 focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl px-1.5 py-1 text-[13px] text-foreground font-medium transition-all outline-none cursor-pointer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "Q",
					children: "Flow (Q)"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "P",
					children: "Pressure (P)"
				})]
			})
		},
		{
			key: "pressure",
			header: `Pressure (${unitSystem === "si" ? "bar" : "psi"})`,
			width: 100,
			render: (row) => {
				return row.solveFor === "P" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-muted-foreground/70 font-semibold px-2",
					children: row.pressure.toFixed(2)
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
					type: "number",
					step: unitSystem === "si" ? "0.05" : "0.5",
					min: 0,
					value: row.pressure,
					onCommit: (val) => updateRow(row.id, "pressure", parseFloat(val) || 0),
					className: "font-mono text-[13px]"
				});
			}
		},
		{
			key: "flow",
			header: `Flow Rate (${unitSystem === "si" ? "L/min" : "GPM"})`,
			width: 110,
			render: (row) => {
				return row.solveFor === "Q" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-muted-foreground/70 font-semibold px-2",
					children: row.flow.toFixed(1)
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
					type: "number",
					step: "1",
					min: 0,
					value: row.flow,
					onCommit: (val) => updateRow(row.id, "flow", parseFloat(val) || 0),
					className: "font-mono text-[13px]"
				});
			}
		},
		{
			key: "coverage",
			header: `Coverage (${unitSystem === "si" ? "m²" : "ft²"})`,
			width: 100,
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				min: 0,
				value: row.coverage,
				onCommit: (val) => updateRow(row.id, "coverage", parseFloat(val) || 0),
				className: "font-mono text-[13px]"
			})
		},
		{
			key: "hazard",
			header: "Hazard Classification",
			width: 180,
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				value: row.hazard,
				onChange: (e) => updateRow(row.id, "hazard", e.target.value),
				className: "bg-transparent w-full border border-transparent hover:border-border hover:bg-surface-2 focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl px-1.5 py-1 text-[13px] text-foreground font-medium transition-all outline-none cursor-pointer",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "Light Hazard",
						children: "Light Hazard"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "Ordinary Hazard Gp 1",
						children: "Ordinary Gp 1"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "Ordinary Hazard Gp 2",
						children: "Ordinary Gp 2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "Extra Hazard Gp 1",
						children: "Extra Gp 1"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "Extra Hazard Gp 2",
						children: "Extra Gp 2"
					})
				]
			})
		},
		{
			key: "status",
			header: "Status",
			width: 110,
			render: (row) => {
				const isLowPressure = row.pressure < (unitSystem === "si" ? .48 : 7);
				const baseLimit = HAZARD_LIMITS[row.hazard] || 130;
				const limit = unitSystem === "si" ? parseFloat((baseLimit / 10.7639).toFixed(1)) : baseLimit;
				const isOverCoverage = row.coverage > limit;
				if (isLowPressure) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-destructive/10 text-destructive border border-destructive/20 uppercase tracking-wide",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-1.5 h-1.5 rounded-full bg-destructive shrink-0 mr-1.5" }), "Low Press"]
				});
				if (isOverCoverage) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-warning/15 text-warning border border-warning/20 uppercase tracking-wide",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-1.5 h-1.5 rounded-full bg-warning shrink-0 mr-1.5" }), "Over Area"]
				});
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-success/10 text-success border border-success/20 uppercase tracking-wide",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-1.5 h-1.5 rounded-full bg-success shrink-0 mr-1.5" }), "Complied"]
				});
			}
		}
	], [rows, unitSystem]);
	const toggleSelect = (id, isShift, isCtrl) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (isShift && lastSelectedId) {
				const lastIdx = filteredRows.findIndex((r) => r.id === lastSelectedId);
				const currentIdx = filteredRows.findIndex((r) => r.id === id);
				if (lastIdx !== -1 && currentIdx !== -1) {
					if (!isCtrl) next.clear();
					const start = Math.min(lastIdx, currentIdx);
					const end = Math.max(lastIdx, currentIdx);
					for (let i = start; i <= end; i++) next.add(filteredRows[i].id);
				}
			} else if (next.has(id)) next.delete(id);
			else {
				if (!isCtrl && !isShift) next.clear();
				next.add(id);
			}
			return next;
		});
		setLastSelectedId(id);
	};
	const toggleSelectAll = () => {
		setSelected((prev) => {
			if (prev.size === rows.length) return /* @__PURE__ */ new Set();
			else return new Set(rows.map((r) => r.id));
		});
	};
	const actions = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-1.5",
		children: [undoStack.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			onClick: handleUndo,
			title: "Undo (Ctrl+Z)",
			className: "size-7 grid place-items-center rounded-xl border border-border bg-background hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo, { className: "size-3.5" })
		}), redoStack.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			onClick: handleRedo,
			title: "Redo (Ctrl+Y)",
			className: "size-7 grid place-items-center rounded-xl border border-border bg-background hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Redo, { className: "size-3.5" })
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Sprinkler K-Factor",
		hideSubHeader: true,
		onIntelClick: () => setIntelOpen((v) => !v),
		intelOpen,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex h-full min-h-0 bg-transparent",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between items-start shrink-0 select-none no-print modal-blur-bg px-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1 w-full",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
							children: "FIRE FIGHTING > SPRINKLER K-FACTOR"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 mt-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "text-[28px] font-bold tracking-tight text-foreground",
									children: "Sprinkler K-Factor"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[15px] font-semibold text-muted-foreground",
									children: "NFPA 13 discharge calculations"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setIntelOpen((v) => !v),
								className: `flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${intelOpen ? "bg-primary text-primary-foreground border-primary" : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }), "Intelligence"]
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex rounded-full border border-border p-0.5 bg-surface-2 shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => handleUnitToggle("si"),
								className: `px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${unitSystem === "si" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "SI"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => handleUnitToggle("ip"),
								className: `px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${unitSystem === "ip" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "IP"
							})]
						}), actions]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-card border border-border rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden mx-6 mb-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setTab("solver"),
									className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${tab === "solver" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
									children: "Quick Solver"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setTab("schedule"),
									className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${tab === "schedule" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
									children: "Sprinkler Schedule"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setTab("report"),
									className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${tab === "report" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
									children: "Report Summary"
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 min-h-0 overflow-hidden flex flex-col",
						children: [
							tab === "solver" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex-1 min-h-0 overflow-y-auto",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col md:flex-row h-full divide-y md:divide-y-0 divide-border",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex-1 min-w-0 p-6 flex flex-col gap-6",
										style: { zoom: 1.1 },
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-3.5 p-4 bg-background border border-border rounded-3xl shadow-xs transition-all hover:border-primary/30",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-4.5 text-primary mt-0.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "text-[13.5px] font-bold text-foreground",
													children: "Sprinkler Sizing Equation"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "text-[12.5px] text-muted-foreground mt-1 leading-relaxed",
													children: "Calculate discharge flow rate based on nozzle pressure and standard K-factor coefficient ($Q = K\\sqrt{P}$), or determine required operating pressure to deliver target fire load."
												})] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-2 gap-4",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3 transition-all hover:border-primary/30",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
														children: "Sizing Variable"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => {
																setSolverSolveFor("Q");
																setSolverKnownVal(30);
															},
															className: `flex-1 py-2 px-4 rounded-xl text-[13px] font-bold border text-center transition-all cursor-pointer shadow-xs ${solverSolveFor === "Q" ? "bg-primary text-primary-foreground border-primary shadow-primary/10 font-bold" : "border-border hover:bg-surface-2 text-muted-foreground"}`,
															children: "Solve Flow (Q)"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => {
																setSolverSolveFor("P");
																setSolverKnownVal(20);
															},
															className: `flex-1 py-2 px-4 rounded-xl text-[13px] font-bold border text-center transition-all cursor-pointer shadow-xs ${solverSolveFor === "P" ? "bg-primary text-primary-foreground border-primary shadow-primary/10 font-bold" : "border-border hover:bg-surface-2 text-muted-foreground"}`,
															children: "Solve Pressure (P)"
														})]
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3 transition-all hover:border-primary/30",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
														children: "K-Factor Coefficient"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
															value: isCustomK ? "custom" : solverK,
															onChange: (e) => {
																if (e.target.value === "custom") setIsCustomK(true);
																else {
																	setIsCustomK(false);
																	setSolverK(parseFloat(e.target.value));
																}
															},
															className: "flex-1 h-10 px-3 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl bg-background text-[13px] outline-none font-bold cursor-pointer transition-all shadow-sm",
															children: [unitSystem === "si" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "40.0",
																	children: "K-40.0 - Residential"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "60.0",
																	children: "K-60.0 - Small Orifice"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "80.0",
																	children: "K-80.0 - Standard Spray"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "115.0",
																	children: "K-115.0 - Large Orifice"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "160.0",
																	children: "K-160.0 - ESFR / Storage"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "200.0",
																	children: "K-200.0 - Early Suppression"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "242.0",
																	children: "K-242.0 - Ultra Large"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "282.0",
																	children: "K-282.0 - Heavy Storage"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "320.0",
																	children: "K-320.0 - High Flow"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "360.0",
																	children: "K-360.0 - Deluge System"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "400.0",
																	children: "K-400.0 - High Density Deluge"
																})
															] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "2.8",
																	children: "K-2.8 - Residential"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "4.2",
																	children: "K-4.2 - Small Orifice"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "5.6",
																	children: "K-5.6 - Standard Spray"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "8.0",
																	children: "K-8.0 - Large Orifice"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "11.2",
																	children: "K-11.2 - ESFR / Storage"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "14.0",
																	children: "K-14.0 - Early Suppression"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "16.8",
																	children: "K-16.8 - Ultra Large"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "19.6",
																	children: "K-19.6 - Heavy Storage"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "22.4",
																	children: "K-22.4 - High Flow"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "25.2",
																	children: "K-25.2 - Deluge System"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "28.0",
																	children: "K-28.0 - High Density Deluge"
																})
															] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																value: "custom",
																children: "Custom K-Factor..."
															})]
														}), isCustomK && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "number",
															step: "0.1",
															min: "0.1",
															value: solverK,
															onChange: (e) => setSolverK(e.target.value === "" ? "" : parseFloat(e.target.value) || 5.6),
															className: "w-24 h-10 px-3 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl bg-background text-[13px] font-mono font-bold outline-none shadow-sm",
															placeholder: "e.g. 5.8"
														})]
													})]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "border border-border rounded-3xl p-5 bg-background shadow-sm flex flex-col gap-3.5 transition-all hover:border-primary/30",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col gap-1.5",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
															className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
															children: solverSolveFor === "Q" ? "Known Operating Pressure" : "Known Discharge Flow"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "relative flex items-center mt-1 select-none",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																value: solverKnownVal,
																step: solverSolveFor === "Q" ? unitSystem === "si" ? "0.05" : "0.5" : "1",
																min: 0,
																onChange: (e) => setSolverKnownVal(e.target.value === "" ? "" : parseFloat(e.target.value) || 0),
																className: "w-full h-11 pl-4 pr-20 bg-surface-2 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl text-lg font-bold font-mono outline-none text-foreground transition-all focus:bg-background",
																placeholder: "Enter value..."
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "absolute right-3 px-2.5 py-1 bg-background border border-border rounded-xl text-[11px] font-bold font-mono text-muted-foreground uppercase shadow-xs",
																children: solverSolveFor === "Q" ? unitSystem === "si" ? "bar" : "psi" : unitSystem === "si" ? "L/min" : "GPM"
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "text-[11px] text-muted-foreground leading-normal mt-1.5",
															children: solverSolveFor === "Q" ? `Specify sprinkler operating pressure. NFPA 13 requires a minimum of ${unitSystem === "si" ? "0.48 bar" : "7.0 psi"}.` : "Specify sprinkler discharge flow rate."
														})
													]
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-2 gap-4",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border rounded-3xl p-5 bg-gradient-to-br from-background to-surface-2 shadow-sm flex flex-col justify-between min-h-[140px] transition-all hover:border-primary/30",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
														children: "Calculated Variable"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-baseline mt-2 gap-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[36px] font-extrabold tracking-tight font-mono text-primary leading-none",
															children: solverResult.val
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[14px] font-bold text-muted-foreground uppercase",
															children: solverResult.unit
														})]
													})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "border-t border-border pt-3 mt-4 text-[12px] font-mono text-muted-foreground",
														children: solverResult.label
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border rounded-3xl p-5 bg-gradient-to-br from-background to-surface-2 shadow-sm flex flex-col justify-between min-h-[140px] transition-all hover:border-primary/30",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
														children: "Sizing Formula"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[16px] font-bold text-foreground font-mono mt-3 leading-relaxed",
														children: solverResult.formula
													})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "border-t border-border pt-3 mt-4 text-[12px] text-muted-foreground flex justify-between",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Standard K: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-semibold",
															children: solverK
														})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Unit System: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-semibold",
															children: unitSystem === "si" ? "SI" : "IP"
														})] })]
													})]
												})]
											}),
											solverResult.pressure < (unitSystem === "si" ? .48 : 7) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-destructive/25 bg-destructive/5 text-destructive rounded-3xl p-4 flex gap-3 items-start shadow-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4.5 shrink-0 mt-0.5 text-destructive animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "text-[13px] font-bold text-destructive",
													children: "NFPA 13 Code Violation"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-[12px] text-destructive/80 mt-1 leading-relaxed",
													children: [
														"Pressure (",
														solverResult.pressure.toFixed(2),
														" ",
														unitSystem === "si" ? "bar" : "psi",
														") is below the minimum required ",
														unitSystem === "si" ? "0.48 bar" : "7.0 psi",
														" limit. The sprinkler spray pattern will not disperse adequately to suppress fires. Increase K-factor or pressure."
													]
												})] })]
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "w-[380px] shrink-0 p-6 bg-surface-2/45 flex flex-col gap-4 border-l border-border h-full overflow-y-auto",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
												children: "Performance Curve"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-3 transition-all hover:border-primary/30",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-[13.5px] font-bold text-foreground leading-snug",
													children: [
														"Flow vs Pressure Curve (K=",
														solverK,
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "w-full relative select-none mt-2",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
														viewBox: `0 0 ${chartSvg.W} ${chartSvg.H}`,
														className: "w-full h-auto block font-sans",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
																x: chartSvg.PL + chartSvg.CW / 2,
																y: "15",
																textAnchor: "middle",
																fontSize: "9.5",
																fontWeight: "700",
																fill: "var(--muted)",
																children: "Q = K \\u00d7 \\u221aP"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
																x: chartSvg.PL + chartSvg.CW / 2,
																y: chartSvg.H - 5,
																textAnchor: "middle",
																fontSize: "9",
																fill: "var(--muted)",
																children: `Pressure P (${unitSystem === "si" ? "bar" : "psi"})`
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
																transform: "rotate(-90)",
																x: -(chartSvg.PT + chartSvg.CH / 2),
																y: "13",
																textAnchor: "middle",
																fontSize: "9",
																fill: "var(--muted)",
																children: `Flow Q (${unitSystem === "si" ? "L/min" : "GPM"})`
															}),
															(unitSystem === "si" ? [
																0,
																1.5,
																3,
																4.5,
																6,
																7
															] : [
																0,
																25,
																50,
																75,
																100
															]).map((val) => {
																const x = chartSvg.sx(val);
																return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
																	x1: x,
																	y1: chartSvg.PT + chartSvg.CH,
																	x2: x,
																	y2: chartSvg.PT + chartSvg.CH + 4,
																	stroke: "var(--border)",
																	strokeWidth: "1"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
																	x,
																	y: chartSvg.PT + chartSvg.CH + 14,
																	textAnchor: "middle",
																	fontSize: "8.5",
																	fill: "var(--muted)",
																	fontFamily: "var(--mono)",
																	children: val
																})] }, val);
															}),
															[
																0,
																.25,
																.5,
																.75,
																1
															].map((ratio) => {
																const val = ratio * chartSvg.yMax;
																const y = chartSvg.sy(val);
																return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
																	x1: chartSvg.PL,
																	y1: y,
																	x2: chartSvg.W - chartSvg.PR,
																	y2: y,
																	stroke: "var(--border)",
																	strokeWidth: "0.5",
																	strokeDasharray: "3,3"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
																	x: chartSvg.PL - 5,
																	y: y + 3,
																	textAnchor: "end",
																	fontSize: "8.5",
																	fill: "var(--muted)",
																	fontFamily: "var(--mono)",
																	children: val.toFixed(0)
																})] }, ratio);
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
																x1: chartSvg.PL,
																y1: chartSvg.PT,
																x2: chartSvg.PL,
																y2: chartSvg.PT + chartSvg.CH,
																stroke: "var(--border-strong)",
																strokeWidth: "1"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
																x1: chartSvg.PL,
																y1: chartSvg.PT + chartSvg.CH,
																x2: chartSvg.W - chartSvg.PR,
																y2: chartSvg.PT + chartSvg.CH,
																stroke: "var(--border-strong)",
																strokeWidth: "1"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
																d: chartSvg.fillD,
																fill: "var(--red)",
																opacity: "0.06"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
																d: chartSvg.pathD,
																fill: "none",
																stroke: "var(--red)",
																strokeWidth: "2",
																strokeLinejoin: "round",
																strokeLinecap: "round"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
																x1: chartSvg.markX,
																y1: chartSvg.markY,
																x2: chartSvg.markX,
																y2: chartSvg.PT + chartSvg.CH,
																stroke: "var(--red)",
																strokeWidth: "1",
																strokeDasharray: "3,3",
																opacity: "0.6"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
																x1: chartSvg.PL,
																y1: chartSvg.markY,
																x2: chartSvg.markX,
																y2: chartSvg.markY,
																stroke: "var(--red)",
																strokeWidth: "1",
																strokeDasharray: "3,3",
																opacity: "0.6"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
																cx: chartSvg.markX,
																cy: chartSvg.markY,
																r: "5",
																fill: "var(--red)",
																stroke: "var(--card)",
																strokeWidth: "1.5"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("text", {
																x: chartSvg.markX > chartSvg.W * .7 ? chartSvg.markX - 8 : chartSvg.markX + 8,
																y: chartSvg.markY - 6,
																textAnchor: chartSvg.markX > chartSvg.W * .7 ? "end" : "start",
																fontSize: "9.5",
																fill: "var(--red)",
																fontWeight: "700",
																fontFamily: "var(--mono)",
																children: [
																	chartSvg.markQ.toFixed(1),
																	" ",
																	unitSystem === "si" ? "L/m" : "GPM"
																]
															})
														]
													})
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-4 transition-all hover:border-primary/30",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "text-[13.5px] font-bold text-foreground leading-snug",
													children: "Orifice & Thread Spec"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex gap-4 items-center",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "w-24 h-28 shrink-0 bg-surface/50 border border-border rounded-xl flex items-center justify-center p-2 relative overflow-hidden select-none",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
															viewBox: "0 0 100 120",
															className: "w-full h-full drop-shadow-sm",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
																	d: "M 25 15 L 75 15 L 75 20 L 25 20 Z",
																	fill: "#b45309",
																	stroke: "#78350f",
																	strokeWidth: "1"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
																	d: "M 30 15 L 30 10 M 38 15 L 38 10 M 46 15 L 46 10 M 54 15 L 54 10 M 62 15 L 62 10 M 70 15 L 70 10",
																	stroke: "#78350f",
																	strokeWidth: "1.5"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
																	d: "M 32 95 C 15 75, 15 45, 45 20",
																	fill: "none",
																	stroke: "#71717a",
																	strokeWidth: "3",
																	strokeLinecap: "round"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
																	d: "M 68 95 C 85 75, 85 45, 55 20",
																	fill: "none",
																	stroke: "#71717a",
																	strokeWidth: "3",
																	strokeLinecap: "round"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
																	d: "M 32 95 L 68 95 L 68 115 L 32 115 Z",
																	fill: "#b45309",
																	stroke: "#78350f",
																	strokeWidth: "1"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
																	x1: "35",
																	y1: "102",
																	x2: "65",
																	y2: "102",
																	stroke: "#78350f",
																	strokeWidth: "1"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
																	x1: "35",
																	y1: "107",
																	x2: "65",
																	y2: "107",
																	stroke: "#78350f",
																	strokeWidth: "1"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
																	x1: "35",
																	y1: "112",
																	x2: "65",
																	y2: "112",
																	stroke: "#78350f",
																	strokeWidth: "1"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
																	x: 50 - 15 * kDetails.sizeRatio,
																	y: "92",
																	width: 30 * kDetails.sizeRatio,
																	height: "10",
																	fill: "#3b82f6",
																	opacity: "0.85",
																	rx: "1"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
																	x1: 50 - 15 * kDetails.sizeRatio,
																	y1: "92",
																	x2: 50 - 15 * kDetails.sizeRatio,
																	y2: "102",
																	stroke: "#1d4ed8",
																	strokeWidth: "1"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
																	x1: 50 + 15 * kDetails.sizeRatio,
																	y1: "92",
																	x2: 50 + 15 * kDetails.sizeRatio,
																	y2: "102",
																	stroke: "#1d4ed8",
																	strokeWidth: "1"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
																	d: "M 45 92 Q 50 82 55 92",
																	fill: "none",
																	stroke: "#60a5fa",
																	strokeWidth: "1.5",
																	opacity: "0.7"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
																	x: "42",
																	y: "86",
																	width: "16",
																	height: "6",
																	rx: "1",
																	fill: "#71717a",
																	stroke: "#3f3f46",
																	strokeWidth: "1"
																}),
																(() => {
																	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
																			x: "46",
																			y: "38",
																			width: "8",
																			height: "48",
																			rx: "4",
																			fill: (BULB_RATINGS.find((b) => b.color === selectedBulbColor) || BULB_RATINGS[1]).hex,
																			stroke: "#3f3f46",
																			strokeWidth: "1"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
																			x: "47.5",
																			y: "41",
																			width: "2",
																			height: "24",
																			rx: "1",
																			fill: "#ffffff",
																			opacity: "0.65"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
																			cx: "50",
																			cy: "74",
																			r: "2",
																			fill: "#ffffff",
																			opacity: "0.8"
																		})
																	] });
																})(),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
																	d: "M 47 20 L 53 20 L 50 26 Z",
																	fill: "#71717a",
																	stroke: "#3f3f46",
																	strokeWidth: "1"
																})
															]
														})
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex-1 flex flex-col gap-1.5 min-w-0",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex justify-between items-baseline border-b border-border pb-1",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[11px] text-muted-foreground uppercase font-bold",
																	children: "K-Factor"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																	className: "text-[14px] font-extrabold font-mono text-primary",
																	children: ["K-", solverK || "0.0"]
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex justify-between items-baseline border-b border-border pb-1",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[11px] text-muted-foreground uppercase font-bold",
																	children: "Nominal Orifice"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[12.5px] font-bold text-foreground font-mono truncate",
																	children: kDetails.orifice
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex justify-between items-baseline border-b border-border pb-1",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[11px] text-muted-foreground uppercase font-bold",
																	children: "Thread Connection"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[12.5px] font-bold text-foreground font-mono truncate",
																	children: kDetails.thread
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "text-[11px] text-muted-foreground leading-snug italic mt-1 truncate",
																children: kDetails.desc
															})
														]
													})]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-3.5 transition-all hover:border-primary/30",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-[13.5px] font-bold text-foreground leading-snug",
														children: "Bulb Temperature Ratings"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-[11px] text-muted-foreground mt-0.5",
														children: "Click a bulb to preview rating in the sprinkler head"
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "grid grid-cols-7 gap-1.5",
														children: BULB_RATINGS.map((rating) => {
															const isSelected = selectedBulbColor === rating.color;
															return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: () => setSelectedBulbColor(rating.color),
																title: `${rating.color.toUpperCase()} - ${rating.tempF} (${rating.classification})`,
																className: `h-9 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border cursor-pointer ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs" : "border-border hover:bg-surface-2 bg-background"}`,
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																	className: "w-2.5 h-5 rounded-full border border-black/10 relative overflow-hidden",
																	style: { backgroundColor: rating.hex },
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute top-0.5 left-0.5 w-0.5 h-2.5 bg-white/40 rounded-full" })
																})
															}, rating.color);
														})
													}),
													(() => {
														const rating = BULB_RATINGS.find((b) => b.color === selectedBulbColor) || BULB_RATINGS[1];
														return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "p-3 rounded-2xl border border-border/60 bg-surface-2/40 flex flex-col gap-1.5 transition-all",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex justify-between items-baseline",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																	className: "text-[12px] font-bold capitalize flex items-center gap-1.5",
																	children: [
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																			className: "w-2 h-2 rounded-full inline-block",
																			style: { backgroundColor: rating.hex }
																		}),
																		rating.color,
																		" Glass Bulb"
																	]
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[10.5px] font-bold text-muted-foreground uppercase",
																	children: rating.classification
																})]
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "grid grid-cols-2 gap-2 mt-1 border-t border-border/40 pt-2 text-[12px] font-medium text-foreground",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[10px] text-muted-foreground block uppercase font-bold tracking-wider",
																	children: "Temp Rating"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																	className: "font-mono font-bold text-primary",
																	children: [
																		rating.tempF,
																		" ",
																		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																			className: "text-[10px] font-semibold text-muted-foreground",
																			children: [
																				"(",
																				rating.tempC,
																				")"
																			]
																		})
																	]
																})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[10px] text-muted-foreground block uppercase font-bold tracking-wider",
																	children: "Max Ceiling Temp"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "font-mono font-bold",
																	children: rating.color === "orange" || rating.color === "red" ? "100°F (38°C)" : rating.color === "yellow" || rating.color === "green" ? "150°F (66°C)" : rating.color === "blue" ? "225°F (107°C)" : rating.color === "mauve" ? "300°F (149°C)" : "475°F (246°C)"
																})] })]
															})]
														});
													})()
												]
											})
										]
									})]
								})
							}),
							tab === "schedule" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 min-h-0 overflow-hidden flex flex-col",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-4 gap-4 p-4 border-b border-border bg-surface-2/10 shrink-0",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-3 bg-background shadow-xs flex flex-col justify-between hover:border-primary/20 transition-all",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
													children: "Sprinklers Sized"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[20px] font-extrabold font-mono text-foreground mt-1",
													children: [rows.length, " heads"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-3 bg-background shadow-xs flex flex-col justify-between hover:border-primary/20 transition-all",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
													children: "Max Node Pressure"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[20px] font-extrabold font-mono text-primary mt-1",
													children: [
														aggregateMetrics.maxPressure.toFixed(1),
														" ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11px] font-normal text-muted-foreground",
															children: unitSystem === "si" ? "bar" : "psi"
														})
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-3 bg-background shadow-xs flex flex-col justify-between hover:border-primary/20 transition-all",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
													children: "Sprinkler Discharge"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[20px] font-extrabold font-mono text-primary mt-1",
													children: [
														aggregateMetrics.totalFlow.toFixed(1),
														" ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11px] font-normal text-muted-foreground",
															children: unitSystem === "si" ? "L/min" : "GPM"
														})
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-3 bg-background shadow-xs flex flex-col justify-between hover:border-primary/20 transition-all",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
													children: "Total Water Demand"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[20px] font-extrabold font-mono text-red-500 mt-1",
													children: [
														aggregateMetrics.systemDemand.toFixed(1),
														" ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11px] font-normal text-muted-foreground",
															children: unitSystem === "si" ? "L/min" : "GPM"
														})
													]
												})]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between border-b border-border px-4 py-2.5 bg-background select-none shrink-0 gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 flex-wrap",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "relative",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															placeholder: "Search sprinklers...",
															value: searchQuery,
															onChange: (e) => setSearchQuery(e.target.value),
															className: "h-8 w-56 pl-8 pr-7 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl text-[12.5px] bg-background outline-none transition-all"
														}),
														searchQuery && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => setSearchQuery(""),
															className: "absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
													value: hazardFilter,
													onChange: (e) => setHazardFilter(e.target.value),
													className: "h-8 px-3 border border-border focus:border-primary rounded-xl text-[12.5px] bg-background text-foreground outline-none cursor-pointer font-medium transition-all shadow-xs",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "All",
															children: "All Hazards"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "Light Hazard",
															children: "Light Hazard"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "Ordinary Hazard Gp 1",
															children: "Ordinary Gp 1"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "Ordinary Hazard Gp 2",
															children: "Ordinary Gp 2"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "Extra Hazard Gp 1",
															children: "Extra Gp 1"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "Extra Hazard Gp 2",
															children: "Extra Gp 2"
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
													value: kFilter,
													onChange: (e) => setKFilter(e.target.value),
													className: "h-8 px-3 border border-border focus:border-primary rounded-xl text-[12.5px] bg-background text-foreground outline-none cursor-pointer font-medium transition-all shadow-xs",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "All",
														children: "All K-Factors"
													}), STANDARD_K_FACTORS.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
														value: k,
														children: ["K-", k.toFixed(1)]
													}, k))]
												})
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													onClick: handleImportClick,
													className: "inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-xl text-[12.5px] font-semibold border border-border bg-background hover:bg-surface-2 text-foreground cursor-pointer transition-all shadow-xs",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5 text-muted-foreground" }), " Import Excel"]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "file",
													ref: fileInputRef,
													onChange: handleImportFile,
													style: { display: "none" },
													accept: ".xlsx,.xls,.csv"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
													primary: true,
													onClick: addSprinkler,
													className: "h-8 px-3.5 text-[12.5px] rounded-xl",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Add Sprinkler"]
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex-1 min-h-0 bg-background overflow-hidden relative flex flex-col",
										children: [filteredRows.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataGrid, {
											rows: filteredRows,
											columns,
											selected,
											onToggle: toggleSelect,
											onToggleAll: toggleSelectAll,
											renderContextMenu: renderSprinklerContextMenu
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col items-center justify-center py-20 text-muted-foreground gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "size-8 text-muted-foreground/50" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[13px]",
												children: "No sprinklers found in schedule. Click 'Add Sprinkler' to begin."
											})]
										}), selected.size > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "absolute bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border border-border rounded-full py-2 px-4 shadow-xl z-50 flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[12px] font-bold border-r border-border pr-3 text-foreground",
													children: [selected.size, " selected"]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													onClick: duplicateSelected,
													className: "inline-flex items-center gap-1.5 px-3 py-1 hover:bg-muted rounded-full text-[12px] font-semibold transition-all cursor-pointer text-foreground",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5 text-muted-foreground" }), " Duplicate"]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													onClick: confirmDeleteSelected,
													className: "inline-flex items-center gap-1.5 px-3 py-1 hover:bg-destructive/10 rounded-full text-[12px] font-bold text-destructive transition-all cursor-pointer",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), " Delete"]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													onClick: () => setSelected(/* @__PURE__ */ new Set()),
													className: "inline-flex items-center gap-1.5 px-3 py-1 hover:bg-muted rounded-full text-[12px] font-semibold text-muted-foreground transition-all cursor-pointer",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" }), " Clear"]
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between px-4 h-9 border-t border-border bg-header-bg text-[11.5px] text-muted-foreground shrink-0 select-none font-medium",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
											"Showing ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-foreground font-bold tabular",
												children: filteredRows.length
											}),
											" of ",
											rows.length,
											" sprinklers"
										] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-muted-foreground italic text-[11px]",
											children: "Right-click row for context menu operations"
										})]
									})
								]
							}),
							tab === "report" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6 w-full",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center pb-4 border-b border-border",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-[16px] font-bold text-foreground",
											children: "Sizing Report Summary"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-[12.5px] text-muted-foreground mt-0.5",
											children: "Review system compliance and download reports."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 no-print print:hidden",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: exportPdf,
												className: "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl text-[12.5px] font-semibold border border-border bg-background hover:bg-surface-2 text-foreground cursor-pointer",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5 text-destructive" }), " Export PDF"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => window.print(),
												className: "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl text-[12.5px] font-semibold border border-border bg-background hover:bg-surface-2 text-foreground cursor-pointer",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-3.5 text-muted-foreground" }), " Print Report"]
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-4 gap-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-5" })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground block",
														children: "Sprinklers Sized"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-[20px] font-extrabold font-mono text-foreground mt-0.5",
														children: [rows.length, " heads"]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10.5px] text-muted-foreground mt-0.5 block",
														children: "Active nodes in project"
													})
												] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "size-5" })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground block",
														children: "Max Node Pressure"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-[20px] font-extrabold font-mono text-primary mt-0.5",
														children: [
															aggregateMetrics.maxPressure.toFixed(1),
															" ",
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[11px] font-normal text-muted-foreground",
																children: unitSystem === "si" ? "bar" : "psi"
															})
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10.5px] text-muted-foreground mt-0.5 block",
														children: "Highest node pressure"
													})
												] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-10 rounded-xl bg-sky-500/10 text-amber-500 flex items-center justify-center shrink-0",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Droplet, { className: "size-5" })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground block",
														children: "Sprinkler Discharge"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-[20px] font-extrabold font-mono text-primary mt-0.5",
														children: [
															aggregateMetrics.totalFlow.toFixed(1),
															" ",
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[11px] font-normal text-muted-foreground",
																children: unitSystem === "si" ? "L/min" : "GPM"
															})
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10.5px] text-muted-foreground mt-0.5 block",
														children: "Sum of sprinkler flows"
													})
												] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-5" })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground block",
														children: "Total Water Demand"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-[20px] font-extrabold font-mono text-red-500 mt-0.5",
														children: [
															aggregateMetrics.systemDemand.toFixed(1),
															" ",
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[11px] font-normal text-muted-foreground",
																children: unitSystem === "si" ? "L/min" : "GPM"
															})
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10.5px] text-muted-foreground mt-0.5 block",
														children: "With hose stream allowance"
													})
												] })]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col lg:flex-row gap-6 items-start",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1 min-w-0 w-full border border-border rounded-3xl bg-background shadow-sm overflow-hidden",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "px-4 py-3 border-b border-border bg-surface-2/15 flex items-center justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[13px] font-bold text-foreground",
													children: "Sprinkler Sizing Grid Preview"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[11px] text-muted-foreground font-mono",
													children: [rows.length, " Sized Nodes"]
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "overflow-x-auto w-full",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
													className: "w-full border-collapse text-[12.5px] text-left",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
														className: "border-b border-border bg-surface/50 font-bold text-muted-foreground text-[11px] uppercase tracking-wider",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "p-3 w-16 text-center",
																children: "S.No"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "p-3",
																children: "Label / Location"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "p-3",
																children: "K-Factor"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "p-3",
																children: "Sizing Mode"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
																className: "p-3 text-right",
																children: [
																	"Pressure (",
																	unitSystem === "si" ? "bar" : "psi",
																	")"
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
																className: "p-3 text-right",
																children: [
																	"Flow (",
																	unitSystem === "si" ? "L/min" : "GPM",
																	")"
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
																className: "p-3 text-right",
																children: [
																	"Coverage (",
																	unitSystem === "si" ? "m²" : "ft²",
																	")"
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "p-3",
																children: "Hazard"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "p-3 w-28 text-center",
																children: "Status"
															})
														]
													}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
														className: "divide-y divide-border font-medium text-foreground",
														children: rows.map((r, idx) => {
															const isLowPressure = r.pressure < (unitSystem === "si" ? .48 : 7);
															const baseLimit = HAZARD_LIMITS[r.hazard] || 130;
															const limit = unitSystem === "si" ? parseFloat((baseLimit / 10.7639).toFixed(1)) : baseLimit;
															const isOverCoverage = r.coverage > limit;
															return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
																className: "hover:bg-surface/30 transition-colors",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																		className: "p-3 text-muted-foreground text-center font-mono",
																		children: idx + 1
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																		className: "p-3 text-foreground font-semibold",
																		children: r.label
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																		className: "p-3 font-mono",
																		children: ["K-", r.kFactor.toFixed(1)]
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																		className: "p-3",
																		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																			className: "px-1.5 py-0.5 rounded-xl text-[11px] font-bold bg-muted text-muted-foreground",
																			children: r.solveFor === "Q" ? "Flow (Q)" : "Pressure (P)"
																		})
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																		className: "p-3 text-right font-mono font-bold text-foreground",
																		children: r.pressure.toFixed(2)
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																		className: "p-3 text-right font-mono font-bold text-foreground",
																		children: r.flow.toFixed(2)
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																		className: "p-3 text-right font-mono text-muted-foreground",
																		children: r.coverage
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																		className: "p-3 text-muted-foreground text-[12px]",
																		children: r.hazard
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																		className: "p-3 text-center",
																		children: isLowPressure ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																			className: "inline-flex items-center px-2 py-0.5 rounded-xl text-[10.5px] font-bold bg-destructive/10 text-destructive border border-destructive/20 uppercase tracking-wide",
																			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-1.5 h-1.5 rounded-full bg-destructive shrink-0 mr-1.5" }), "Low Press"]
																		}) : isOverCoverage ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																			className: "inline-flex items-center px-2 py-0.5 rounded-xl text-[10.5px] font-bold bg-warning/15 text-warning border border-warning/20 uppercase tracking-wide",
																			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-1.5 h-1.5 rounded-full bg-warning shrink-0 mr-1.5" }), "Over Area"]
																		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																			className: "inline-flex items-center px-2 py-0.5 rounded-xl text-[10.5px] font-bold bg-success/10 text-success border border-success/20 uppercase tracking-wide",
																			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-1.5 h-1.5 rounded-full bg-success shrink-0 mr-1.5" }), "Complied"]
																		})
																	})
																]
															}, r.id);
														})
													})]
												})
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "w-full lg:w-[350px] shrink-0 flex flex-col gap-4",
											children: [
												(() => {
													return rows.some((r) => r.pressure < (unitSystem === "si" ? .48 : 7)) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "border border-destructive/20 bg-destructive/5 rounded-3xl p-4 flex gap-3 shadow-xs",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-5 text-destructive shrink-0 mt-0.5 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
															className: "text-[13px] font-bold text-destructive",
															children: "NFPA 13 Warnings"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
															className: "text-[12px] text-muted-foreground mt-1 leading-normal",
															children: [
																"Hydraulic violations detected in layout grid. Sized pressures must exceed the code limit of ",
																unitSystem === "si" ? "0.48 bar" : "7.0 psi",
																"."
															]
														})] })]
													}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "border border-success/20 bg-success/5 rounded-3xl p-4 flex gap-3 shadow-xs",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-5 text-success shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
															className: "text-[13px] font-bold text-success",
															children: "NFPA 13 Sizing Audit"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "text-[12px] text-muted-foreground mt-1 leading-normal",
															children: "System demand fully complies. All node calculations are within NFPA 13 pressure and coverage limits."
														})] })]
													});
												})(),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-4",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-[13px] font-bold text-foreground leading-snug",
														children: "Design Classification"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "flex flex-col gap-3.5",
														children: Object.entries(reportBreakdowns.hazardCounts).map(([hazardName, count]) => {
															const percentage = reportBreakdowns.totalRows > 0 ? count / reportBreakdowns.totalRows * 100 : 0;
															return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex flex-col gap-1.5 text-[12px]",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "flex justify-between font-medium",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																		className: "text-muted-foreground truncate pr-2",
																		children: hazardName
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																		className: "text-foreground font-mono font-bold",
																		children: [
																			count,
																			" (",
																			percentage.toFixed(0),
																			"%)"
																		]
																	})]
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																	className: "h-1.5 w-full bg-surface-2 rounded-full overflow-hidden",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																		className: "h-full bg-primary rounded-full",
																		style: { width: `${percentage}%` }
																	})
																})]
															}, hazardName);
														})
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-4",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-[13px] font-bold text-foreground leading-snug",
														children: "Orifice / K-Factor Ratios"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "flex flex-col gap-3.5",
														children: Object.entries(reportBreakdowns.kCounts).map(([kValue, count]) => {
															const percentage = reportBreakdowns.totalRows > 0 ? count / reportBreakdowns.totalRows * 100 : 0;
															return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex flex-col gap-1.5 text-[12px]",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "flex justify-between font-medium",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																		className: "text-muted-foreground truncate",
																		children: [kValue, " Coefficient"]
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																		className: "text-foreground font-mono font-bold",
																		children: [
																			count,
																			" (",
																			percentage.toFixed(0),
																			"%)"
																		]
																	})]
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																	className: "h-1.5 w-full bg-surface-2 rounded-full overflow-hidden",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																		className: "h-full bg-primary/80 rounded-full",
																		style: { width: `${percentage}%` }
																	})
																})]
															}, kValue);
														})
													})]
												})
											]
										})]
									})
								]
							})
						]
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `shrink-0 bg-background overflow-hidden transition-[width] duration-300 ease-out select-none no-print print:hidden ${intelOpen ? "w-[360px] border-l border-border" : "w-0"}`,
				children: intelOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-[360px] h-full flex flex-col min-h-0 bg-background font-sans",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between p-4 border-b border-border bg-header-bg shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-[13.5px] font-bold uppercase tracking-wider text-foreground",
								children: "Live Intelligence"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setIntelOpen(false),
							className: "text-muted-foreground hover:text-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 overflow-y-auto p-4 flex flex-col gap-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-border rounded-3xl p-3.5 bg-background shadow-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "text-[12.5px] font-bold text-foreground",
										children: "Equations Guidance"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[11.5px] text-muted-foreground mt-1 leading-relaxed",
										children: "NFPA 13 formulas calculate standard discharge:"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
										className: "text-[11px] text-muted-foreground mt-2 list-disc pl-4 flex flex-col gap-1 font-mono",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Flow: Q = K \\u00d7 \\u221aP" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Pressure: P = (Q / K)\\u00b2" })]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-border rounded-3xl p-3.5 bg-background shadow-xs flex flex-col gap-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "text-[12.5px] font-bold text-foreground",
										children: "AI Quick Optimizers"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[11.5px] text-muted-foreground leading-normal",
										children: "Batch-fix spacing guidelines or K-factor sizes to optimize hydraulic efficiency."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-2 mt-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: handleFixAllPressures,
											className: "w-full py-1.5 px-3 rounded-xl text-[11.5px] font-bold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-center transition-all cursor-pointer",
											children: "Fix All Low Pressures (Set to 7 psi)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: handleOptimizeAllKFactors,
											className: "w-full py-1.5 px-3 rounded-xl text-[11.5px] font-bold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-center transition-all cursor-pointer",
											children: "Optimize Large Pressures (>35 psi)"
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
									children: "Active Warnings & Fixes"
								}), warningsList.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-col gap-2.5",
									children: warningsList.map((warn, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-3 rounded-2xl border text-[12px] flex gap-3 shadow-xs ${warn.type === "critical" ? "border-destructive/20 bg-destructive/5 text-foreground" : "border-warning/20 bg-warning/5 text-foreground"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: `size-4 shrink-0 mt-0.5 ${warn.type === "critical" ? "text-destructive" : "text-warning"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1 min-w-0",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "font-bold",
													children: warn.title
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[11.5px] text-muted-foreground mt-0.5 leading-normal",
													children: warn.desc
												}),
												warn.fixable && warn.action && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													onClick: warn.action,
													className: "mt-2 text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3" }), " Auto-Fix Issue"]
												})
											]
										})]
									}, index))
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "border border-border/80 rounded-3xl p-4 flex flex-col items-center justify-center text-center text-muted-foreground gap-2 py-8 bg-surface-2/10",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-8 text-success" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[12px] font-semibold text-foreground",
											children: "Sizing Complies!"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11px] text-muted-foreground",
											children: "All pressures and areas are within NFPA limits."
										})
									]
								})]
							})
						]
					})]
				})
			})]
		})
	});
}
//#endregion
export { SprinklerKFactorPage as component };
