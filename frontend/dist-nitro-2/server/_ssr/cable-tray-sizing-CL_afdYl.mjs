import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-Ct3ePlL1.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { A as RefreshCcw, N as Plus, T as Search, _t as Download, l as Upload, m as Trash2, n as X, p as Trash } from "../_libs/lucide-react.mjs";
import { i as useConfirm, r as cn } from "./use-confirm-BT3fngjN.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-urg-0zDa.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { t as ImportExcelBtn } from "./ImportExcelBtn-rAnQAoVD.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/cable-tray-sizing-CL_afdYl.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
var TRAY_RANGES = [
	{
		limit: 0,
		size: "100"
	},
	{
		limit: 101,
		size: "150"
	},
	{
		limit: 151,
		size: "225"
	},
	{
		limit: 226,
		size: "300"
	},
	{
		limit: 301,
		size: "450"
	},
	{
		limit: 451,
		size: "600"
	},
	{
		limit: 601,
		size: "750"
	},
	{
		limit: 751,
		size: "900"
	},
	{
		limit: 901,
		size: "1 X 600, 1 X 450"
	},
	{
		limit: 1051,
		size: "2 X 600"
	},
	{
		limit: 1201,
		size: "1 X 900, 1 X 600"
	},
	{
		limit: 1501,
		size: "2 X 900"
	},
	{
		limit: 1801,
		size: "2 X 900, 1 X 300"
	},
	{
		limit: 2101,
		size: "2 X 900, 1 X 600"
	},
	{
		limit: 2401,
		size: "2 X 900, 1 X 750"
	},
	{
		limit: 2701,
		size: "3 X 900, 1 X 300"
	},
	{
		limit: 3001,
		size: "4 X 900"
	},
	{
		limit: 3601,
		size: "5 X 900"
	},
	{
		limit: 4500,
		size: "5 X 900"
	}
];
function getCableTraySize(w) {
	if (w <= 0 || isNaN(w)) return "N/A";
	let matched = TRAY_RANGES[0];
	for (let i = 0; i < TRAY_RANGES.length; i++) if (TRAY_RANGES[i].limit <= w) matched = TRAY_RANGES[i];
	return matched.size;
}
var DEFAULT_CABLE_DATABASE = {
	"1C": {
		"2.5": 3.7,
		"4": 4.7,
		"6": 5.6,
		"10": 6.3,
		"16": 7.4,
		"25": 9.1,
		"35": 10.3,
		"50": 12.3,
		"70": 14.2,
		"95": 16.2,
		"120": 17.9,
		"150": 20.2,
		"185": 22.2,
		"240": 28,
		"300": 30,
		"630": 48.8
	},
	"2C": {
		"2.5": 12.3,
		"4": 13.4,
		"6": 14.5,
		"10": 16.7,
		"16": 19.5,
		"25": 20.8,
		"35": 23.4,
		"50": 25.5,
		"70": 29,
		"95": 31.9,
		"120": 34.4,
		"150": 37.9,
		"185": 42.4,
		"240": 46.4,
		"300": 50.3
	},
	"3C": {
		"2.5": 13,
		"4": 16,
		"6": 16,
		"10": 18,
		"16": 21,
		"25": 21,
		"35": 26,
		"50": 30,
		"70": 34,
		"95": 36,
		"120": 38,
		"150": 45,
		"185": 49,
		"240": 54,
		"300": 59
	},
	"4C": {
		"2.5": 13.5,
		"4": 15,
		"6": 17.3,
		"10": 19.8,
		"16": 22.3,
		"25": 27.6,
		"35": 30.6,
		"50": 32.7,
		"70": 38,
		"95": 41.3,
		"120": 46.4,
		"150": 50.5,
		"185": 55.3,
		"240": 61.1,
		"300": 66.7
	}
};
function formatTraySize(size, isSI) {
	if (size === "N/A") return "N/A";
	if (isSI) return size + " mm";
	const sizeMap = {
		"100": "4\"",
		"150": "6\"",
		"225": "9\"",
		"300": "12\"",
		"450": "18\"",
		"600": "24\"",
		"750": "30\"",
		"900": "36\""
	};
	return size.split(", ").map((s) => {
		const parts = s.split(" X ");
		if (parts.length === 2) {
			const qty = parts[0];
			const val = parts[1];
			return `${qty} X ${sizeMap[val] || val}`;
		}
		return sizeMap[s] || s;
	}).join(", ");
}
function CableTraySizingPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const confirm = useConfirm();
	const fileInputRef = import_react.useRef(null);
	const [cableDatabase, setCableDatabase] = (0, import_react.useState)(() => {
		try {
			const saved = localStorage.getItem("customCableCatalog");
			if (saved) return JSON.parse(saved);
		} catch {}
		return DEFAULT_CABLE_DATABASE;
	});
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("si");
	const [selectedRows, setSelectedRows] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [lastSelectedRowId, setLastSelectedRowId] = (0, import_react.useState)(null);
	const [bulkEditOpen, setBulkEditOpen] = (0, import_react.useState)(false);
	const [bulkForm, setBulkForm] = (0, import_react.useState)({
		type: "",
		cores: "",
		size: "",
		qty: "",
		spacingFactor: ""
	});
	const [undoStack, setUndoStack] = (0, import_react.useState)([]);
	const [redoStack, setRedoStack] = (0, import_react.useState)([]);
	const pushToUndo = (state) => {
		setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(state))]);
		setRedoStack([]);
	};
	const handleUndo = () => {
		if (undoStack.length === 0) return;
		const prev = undoStack[undoStack.length - 1];
		setUndoStack((old) => old.slice(0, -1));
		setRedoStack((old) => [...old, JSON.parse(JSON.stringify(trays))]);
		setTrays(prev);
	};
	const handleRedo = () => {
		if (redoStack.length === 0) return;
		const next = redoStack[redoStack.length - 1];
		setRedoStack((old) => old.slice(0, -1));
		setUndoStack((old) => [...old, JSON.parse(JSON.stringify(trays))]);
		setTrays(next);
	};
	const toggleRowSelect = (rowId, isShift, isCtrl) => {
		setSelectedRows((prev) => {
			const next = new Set(prev);
			const allRows = [];
			trays.forEach((t) => t.cables.forEach((c) => allRows.push(c)));
			const clickedIdx = allRows.findIndex((c) => c.id === rowId);
			if (clickedIdx === -1) return prev;
			if (isShift && lastSelectedRowId) {
				const lastIdx = allRows.findIndex((c) => c.id === lastSelectedRowId);
				if (lastIdx !== -1) {
					const start = Math.min(lastIdx, clickedIdx);
					const end = Math.max(lastIdx, clickedIdx);
					if (!isCtrl) next.clear();
					for (let i = start; i <= end; i++) next.add(allRows[i].id);
				}
			} else if (isCtrl) if (next.has(rowId)) next.delete(rowId);
			else next.add(rowId);
			else {
				next.clear();
				next.add(rowId);
			}
			return next;
		});
		setLastSelectedRowId(rowId);
	};
	const copyRows = (ids) => {
		const toCopy = [];
		trays.forEach((t) => t.cables.forEach((c) => {
			if (ids.includes(c.id)) toCopy.push(c);
		}));
		if (toCopy.length > 0) {
			localStorage.setItem("mep_clipboard_cables", JSON.stringify(toCopy));
			const text = toCopy.map((c) => `${c.type}\t${c.from}\t${c.to}\t${c.cores}\t${c.size}\t${c.qty}\t${c.customOd || ""}\t${c.spacingFactor || ""}`).join("\n");
			navigator.clipboard?.writeText(text).catch(() => {});
		}
	};
	const cutRows = (ids) => {
		pushToUndo(trays);
		copyRows(ids);
		setTrays((prev) => prev.map((t) => ({
			...t,
			cables: t.cables.filter((c) => !ids.includes(c.id))
		})));
	};
	const pasteRows = () => {
		pushToUndo(trays);
		try {
			const clipboardData = localStorage.getItem("mep_clipboard_cables");
			if (clipboardData) {
				const parsed = JSON.parse(clipboardData);
				if (Array.isArray(parsed)) {
					const newRows = parsed.map((c) => ({
						...c,
						id: `c_${Date.now()}_${Math.floor(Math.random() * 1e3)}`
					}));
					setTrays((prev) => {
						const next = [...prev];
						if (next.length > 0) next[0].cables = [...next[0].cables, ...newRows];
						return next;
					});
					setSelectedRows(new Set(newRows.map((c) => c.id)));
					return newRows;
				}
			}
		} catch (err) {
			console.error(err);
		}
		return [];
	};
	const duplicateRows = (ids) => {
		pushToUndo(trays);
		setTrays((prev) => prev.map((t) => {
			const cablesToClone = t.cables.filter((c) => ids.includes(c.id));
			if (cablesToClone.length === 0) return t;
			const cloned = cablesToClone.map((c) => ({
				...c,
				id: `c_${Date.now()}_${Math.floor(Math.random() * 1e3)}`
			}));
			return {
				...t,
				cables: [...t.cables, ...cloned]
			};
		}));
	};
	const [expandedTrayId, setExpandedTrayId] = (0, import_react.useState)(null);
	const [trays, setTrays] = (0, import_react.useState)([{
		id: `tray_${Date.now()}_1`,
		name: "Cable Tray 1 (Floor 1)",
		spareCapacity: 20,
		cables: [{
			id: `c_${Date.now()}_11`,
			type: "XLPE/SWA/PVC",
			from: "",
			to: "",
			cores: "4C",
			size: "150",
			qty: 2
		}, {
			id: `c_${Date.now()}_12`,
			type: "XLPE/SWA/PVC",
			from: "",
			to: "",
			cores: "4C",
			size: "240",
			qty: 1
		}]
	}, {
		id: `tray_${Date.now()}_2`,
		name: "Cable Tray 2 (Floor 2)",
		spareCapacity: 20,
		cables: [{
			id: `c_${Date.now()}_21`,
			type: "XLPE/SWA/PVC",
			from: "",
			to: "",
			cores: "4C",
			size: "16",
			qty: 3
		}]
	}]);
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	import_react.useEffect(() => {
		if (!project?.id) return;
		try {
			const saved = localStorage.getItem(`mep_cable_tray_${project.id}`);
			if (saved) setTrays(JSON.parse(saved));
			setTimeout(() => dirtyStore.set(false), 50);
		} catch (e) {
			console.error(e);
		}
		setLoadedProjectId(project.id);
	}, [project?.id]);
	import_react.useEffect(() => {
		if (project?.id && loadedProjectId === project.id) {
			localStorage.setItem(`mep_cable_tray_${project.id}`, JSON.stringify(trays));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		trays
	]);
	import_react.useEffect(() => {
		const handlePaste = (e) => {
			if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT") return;
			const clipboardData = e.clipboardData?.getData("Text");
			if (!clipboardData) return;
			e.preventDefault();
			pushToUndo(trays);
			try {
				if (clipboardData.trim().startsWith("[") && clipboardData.trim().endsWith("]")) {
					const parsed = JSON.parse(clipboardData);
					if (Array.isArray(parsed) && parsed.length > 0 && "cores" in parsed[0]) {
						const newRows = parsed.map((c) => ({
							...c,
							id: `c_${Date.now()}_${Math.floor(Math.random() * 1e3)}`
						}));
						setTrays((prev) => {
							const next = [...prev];
							if (next.length > 0) next[0].cables = [...next[0].cables, ...newRows];
							return next;
						});
						setSelectedRows(new Set(newRows.map((c) => c.id)));
						return;
					}
				}
			} catch (err) {}
			const newRows = clipboardData.trim().split("\n").map((r) => r.split("	")).map((cols) => {
				return {
					id: `c_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
					type: cols[0]?.trim() || "XLPE/SWA/PVC",
					from: cols[1]?.trim() || "",
					to: cols[2]?.trim() || "",
					cores: cols[3]?.trim() || "4C",
					size: cols[4]?.trim() || "16",
					qty: Number(cols[5]) || 1,
					customOd: cols[6] !== void 0 && cols[6] !== "" ? Number(cols[6]) : void 0,
					spacingFactor: cols[7] !== void 0 && cols[7] !== "" ? Number(cols[7]) : void 0
				};
			});
			setTrays((prev) => {
				const next = [...prev];
				if (next.length > 0) next[0].cables = [...next[0].cables, ...newRows];
				return next;
			});
			setSelectedRows(new Set(newRows.map((c) => c.id)));
		};
		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [trays]);
	import_react.useEffect(() => {
		const handleGlobalKeyDown = (e) => {
			if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT") return;
			const isCmdOrCtrl = navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? e.metaKey : e.ctrlKey;
			if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
				e.preventDefault();
				const allIds = /* @__PURE__ */ new Set();
				trays.forEach((t) => t.cables.forEach((c) => allIds.add(c.id)));
				setSelectedRows(allIds);
			}
			if (e.key === "Escape") setSelectedRows(/* @__PURE__ */ new Set());
			if (e.key === "Delete" || e.key === "Backspace") {
				if (selectedRows.size > 0) {
					e.preventDefault();
					pushToUndo(trays);
					setTrays((prev) => prev.map((t) => ({
						...t,
						cables: t.cables.filter((c) => !selectedRows.has(c.id))
					})));
					setSelectedRows(/* @__PURE__ */ new Set());
				}
			}
			if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
				e.preventDefault();
				handleUndo();
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "y" || isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z") {
				e.preventDefault();
				handleRedo();
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "c" && selectedRows.size > 0) {
				e.preventDefault();
				copyRows(Array.from(selectedRows));
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "x" && selectedRows.size > 0) {
				e.preventDefault();
				cutRows(Array.from(selectedRows));
				setSelectedRows(/* @__PURE__ */ new Set());
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
				e.preventDefault();
				pasteRows();
			}
		};
		window.addEventListener("keydown", handleGlobalKeyDown);
		return () => window.removeEventListener("keydown", handleGlobalKeyDown);
	}, [trays, selectedRows]);
	const handleKeyDown = (e, rowIndex, colIndex) => {
		const isSelect = e.currentTarget.tagName === "SELECT";
		if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") {
			if (isSelect && (e.key === "ArrowUp" || e.key === "ArrowDown")) return;
			e.preventDefault();
			const allRows = document.querySelectorAll("tr[data-cable-row=\"true\"]");
			let targetRowIndex = rowIndex;
			if (e.key === "ArrowUp") targetRowIndex = Math.max(0, rowIndex - 1);
			if (e.key === "ArrowDown" || e.key === "Enter") targetRowIndex = Math.min(allRows.length - 1, rowIndex + 1);
			if (targetRowIndex !== rowIndex && allRows[targetRowIndex]) {
				const targetInput = allRows[targetRowIndex].querySelectorAll("input:not([type=\"hidden\"]):not([type=\"checkbox\"]), select")[colIndex];
				if (targetInput) {
					targetInput.focus();
					if (targetInput instanceof HTMLInputElement) setTimeout(() => {
						try {
							targetInput.select();
						} catch (e) {}
					}, 0);
				}
			}
		}
		if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
			const currentInput = e.currentTarget;
			if (currentInput instanceof HTMLInputElement) {
				if (currentInput.type === "text") {
					const isAtStart = currentInput.selectionStart === 0;
					const isAtEnd = currentInput.selectionEnd === (currentInput.value?.length || 0);
					if (!isAtStart && !isAtEnd) return;
					if (e.key === "ArrowLeft" && !isAtStart) return;
					if (e.key === "ArrowRight" && !isAtEnd) return;
				}
			}
			e.preventDefault();
			const currentRow = currentInput.closest("tr");
			if (currentRow) {
				const inputs = Array.from(currentRow.querySelectorAll("input:not([type=\"hidden\"]):not([type=\"checkbox\"]), select"));
				let targetColIndex = colIndex;
				if (e.key === "ArrowLeft") targetColIndex = Math.max(0, colIndex - 1);
				if (e.key === "ArrowRight") targetColIndex = Math.min(inputs.length - 1, colIndex + 1);
				if (targetColIndex !== colIndex && inputs[targetColIndex]) {
					inputs[targetColIndex].focus();
					if (inputs[targetColIndex] instanceof HTMLInputElement) setTimeout(() => {
						try {
							inputs[targetColIndex].select();
						} catch (e) {}
					}, 0);
				}
			}
		}
	};
	const addTray = () => {
		pushToUndo(trays);
		setTrays([...trays, {
			id: `tray_${Date.now()}_${Math.random()}`,
			name: `Cable Tray ${trays.length + 1}`,
			spareCapacity: 20,
			cables: []
		}]);
	};
	const removeTray = async (id) => {
		if (await confirm("Are you sure you want to delete this tray and all its cables?")) {
			pushToUndo(trays);
			setTrays(trays.filter((t) => t.id !== id));
		}
	};
	const clearTray = async (id) => {
		if (await confirm("Are you sure you want to remove all cables from this tray?")) {
			pushToUndo(trays);
			setTrays(trays.map((t) => t.id === id ? {
				...t,
				cables: []
			} : t));
		}
	};
	const updateTrayField = (id, field, val) => {
		pushToUndo(trays);
		setTrays((prev) => prev.map((t) => t.id === id ? {
			...t,
			[field]: val
		} : t));
	};
	const updateTraySpareCapacity = (id, spareCapacity) => {
		pushToUndo(trays);
		setTrays((prev) => prev.map((t) => t.id === id ? {
			...t,
			spareCapacity
		} : t));
	};
	const updateTraySpacingFactor = (id, spacingFactor) => {
		pushToUndo(trays);
		setTrays((prev) => prev.map((t) => t.id === id ? {
			...t,
			spacingFactor
		} : t));
	};
	const handleImportExcelCables = (trayId, mappedRows) => {
		pushToUndo(trays);
		setTrays((prev) => prev.map((t) => {
			if (t.id === trayId) {
				const newCables = mappedRows.map((mr, idx) => ({
					id: `c_${Date.now()}_${Math.random()}_${idx}`,
					from: mr.from || "",
					to: mr.to || "",
					type: mr.type || "XLPE/SWA/PVC",
					cores: mr.cores || "4C",
					size: mr.size || "",
					qty: Number(mr.qty) || 1
				}));
				return {
					...t,
					cables: [...t.cables, ...newCables]
				};
			}
			return t;
		}));
	};
	const addCable = (trayId) => {
		pushToUndo(trays);
		setTrays((prev) => prev.map((t) => {
			if (t.id === trayId) return {
				...t,
				cables: [...t.cables, {
					id: `c_${Date.now()}_${Math.random()}`,
					type: "XLPE/SWA/PVC",
					from: "",
					to: "",
					cores: "4C",
					size: "",
					qty: 1
				}]
			};
			return t;
		}));
	};
	const updateCable = (trayId, cableId, field, val) => {
		pushToUndo(trays);
		const isBulkEdit = selectedRows.has(cableId);
		setTrays((prev) => prev.map((t) => {
			if (!isBulkEdit && t.id !== trayId) return t;
			return {
				...t,
				cables: t.cables.map((c) => {
					if (isBulkEdit && selectedRows.has(c.id)) return {
						...c,
						[field]: val
					};
					if (!isBulkEdit && c.id === cableId) return {
						...c,
						[field]: val
					};
					return c;
				})
			};
		}));
	};
	const removeCable = (trayId, cableId) => {
		pushToUndo(trays);
		setTrays((prev) => prev.map((t) => {
			if (t.id === trayId) return {
				...t,
				cables: t.cables.filter((c) => c.id !== cableId)
			};
			return t;
		}));
	};
	const handleImportCatalog = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			const arrayBuffer = await file.arrayBuffer();
			const workbook = new (await (import("../_libs/exceljs+[...].mjs").then((n) => /* @__PURE__ */ __toESM(n.n())))).default.Workbook();
			if (file.name.toLowerCase().endsWith(".csv")) {
				const lines = (await file.text()).split("\\n");
				const newDb = {};
				if (lines.length > 0) {
					const headers = lines[0].toLowerCase().split(",");
					const coreIdx = headers.findIndex((h) => h.includes("core"));
					const sizeIdx = headers.findIndex((h) => h.includes("size") || h.includes("area"));
					const odIdx = headers.findIndex((h) => h.includes("od") || h.includes("diameter"));
					if (coreIdx !== -1 && sizeIdx !== -1 && odIdx !== -1) for (let i = 1; i < lines.length; i++) {
						const cols = lines[i].split(",");
						if (cols.length > Math.max(coreIdx, sizeIdx, odIdx)) {
							let core = cols[coreIdx].trim();
							const size = cols[sizeIdx].trim();
							const od = Number(cols[odIdx].trim());
							if (core && size && !isNaN(od)) {
								if (!core.toUpperCase().endsWith("C")) core += "C";
								core = core.toUpperCase();
								if (!newDb[core]) newDb[core] = {};
								newDb[core][size] = od;
							}
						}
					}
				}
				if (Object.keys(newDb).length > 0) {
					setCableDatabase(newDb);
					localStorage.setItem("customCableCatalog", JSON.stringify(newDb));
					alert("CSV Catalog imported successfully!");
				} else alert("Invalid CSV format. Need columns containing 'Core', 'Size', and 'OD'.");
			} else {
				await workbook.xlsx.load(arrayBuffer);
				const sheet = workbook.worksheets[0];
				const newDb = {};
				let coreIdx = -1, sizeIdx = -1, odIdx = -1;
				sheet.getRow(1).eachCell((cell, colNumber) => {
					const val = String(cell.value || "").toLowerCase();
					if (val.includes("core")) coreIdx = colNumber;
					else if (val.includes("size") || val.includes("area")) sizeIdx = colNumber;
					else if (val.includes("od") || val.includes("diameter")) odIdx = colNumber;
				});
				if (coreIdx === -1 || sizeIdx === -1 || odIdx === -1) {
					alert("Invalid format! Excel must have columns containing 'Core', 'Size', and 'OD' (or 'Diameter').");
					return;
				}
				sheet.eachRow((row, rowNumber) => {
					if (rowNumber === 1) return;
					let core = String(row.getCell(coreIdx).value || "").trim();
					const size = String(row.getCell(sizeIdx).value || "").trim();
					const od = Number(row.getCell(odIdx).value);
					if (core && size && !isNaN(od)) {
						if (!core.toUpperCase().endsWith("C")) core += "C";
						core = core.toUpperCase();
						if (!newDb[core]) newDb[core] = {};
						newDb[core][size] = od;
					}
				});
				if (Object.keys(newDb).length > 0) {
					setCableDatabase(newDb);
					localStorage.setItem("customCableCatalog", JSON.stringify(newDb));
					alert("Excel Catalog imported successfully!");
				} else alert("No valid data found in the Excel file.");
			}
		} catch (err) {
			console.error(err);
			alert("Error parsing file.");
		}
		if (fileInputRef.current) fileInputRef.current.value = "";
	};
	const resetCatalog = async () => {
		if (await confirm("Are you sure you want to reset the cable catalog to defaults?")) {
			setCableDatabase(DEFAULT_CABLE_DATABASE);
			localStorage.removeItem("customCableCatalog");
		}
	};
	const exportPdf = () => {
		const doc = new import_jspdf_node_min.default("landscape");
		doc.text("Cable Tray Sizing", 14, 15);
		let currentY = 20;
		trays.forEach((tray, i) => {
			let subTotal1 = 0;
			let hasValidCables = false;
			const tableData = tray.cables.map((c, idx) => {
				const baseOd = c.cores && c.size ? cableDatabase[c.cores]?.[c.size] || NaN : NaN;
				const od = c.customOd !== void 0 && c.customOd !== "" ? Number(c.customOd) : baseOd;
				const qtyNum = typeof c.qty === "number" ? c.qty : 0;
				const sumOd = !isNaN(od) && qtyNum > 0 ? od * qtyNum : NaN;
				if (!isNaN(sumOd) && qtyNum > 0) {
					subTotal1 += sumOd;
					hasValidCables = true;
				}
				return [
					idx + 1,
					c.type,
					c.cores,
					c.size,
					c.qty.toString(),
					isNaN(od) ? "-" : od.toFixed(1),
					isNaN(sumOd) ? "-" : sumOd.toFixed(1)
				];
			});
			const spacingFactor = Number(tray.spacingFactor ?? 1);
			const spacingWidth = subTotal1 * spacingFactor;
			const subTotal2 = subTotal1 + spacingWidth;
			const totalWidth = subTotal2 + subTotal2 * (Number(tray.spareCapacity ?? 20) / 100);
			const traySize = hasValidCables ? getCableTraySize(totalWidth) : "N/A";
			if (i > 0 && currentY > 160) {
				doc.addPage();
				currentY = 15;
			}
			doc.setFontSize(12);
			doc.text(tray.name, 14, currentY + 5);
			autoTable(doc, {
				head: [[
					"No.",
					"Cable Type",
					"Cores",
					"Size (mm²)",
					"Qty",
					"O.D.(mm)",
					"Sum O.D.(mm)"
				]],
				body: tableData,
				startY: currentY + 10,
				styles: { fontSize: 9 },
				margin: { bottom: 20 }
			});
			currentY = doc.lastAutoTable.finalY;
			doc.setFontSize(10);
			doc.text(`Required Width: ${hasValidCables ? Math.round(totalWidth) + " mm" : "-"}`, 14, currentY + 7);
			doc.text(`Cable Tray Size: ${traySize}`, 100, currentY + 7);
			currentY += 15;
		});
		if (trays.length === 0) doc.text("No trays to export.", 14, 30);
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), "Cable_Tray_Sizing.pdf", "PDF Document", ["pdf"]);
	};
	const actions = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative w-64 mr-2 hidden md:block",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				type: "text",
				placeholder: "Search cables or trays...",
				className: "flex h-8 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
				value: searchQuery,
				onChange: (e) => setSearchQuery(e.target.value)
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "file",
			ref: fileInputRef,
			onChange: handleImportCatalog,
			className: "hidden",
			accept: ".xlsx, .xls, .csv"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
			onClick: () => fileInputRef.current?.click(),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }), " Import Catalog"]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
			onClick: resetCatalog,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCcw, { className: "size-3.5" }), " Reset"]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
			onClick: exportPdf,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" }), " PDF"]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
			primary: true,
			onClick: addTray,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add Tray"]
		})
	] });
	let globalRowIndex = 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Cable Tray Sizing",
		subtitle: "Calculate cable tray containment sizes",
		actions,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative z-10 flex flex-col h-full w-full",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sticky top-0 z-30 flex items-center justify-between px-4 h-9 border-b border-border bg-background/95 backdrop-blur-md shrink-0 select-none shadow-2xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[12px] font-semibold text-muted-foreground uppercase tracking-wide",
							children: "Sizer Workspace"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex rounded border border-border p-0.5 bg-surface-2 shrink-0 my-1 mr-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setUnitSystem("si"),
								className: `px-2.5 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer ${unitSystem === "si" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
								children: "SI"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setUnitSystem("ip"),
								className: `px-2.5 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer ${unitSystem === "ip" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
								children: "IP"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 overflow-y-auto flex flex-col p-4 gap-6 bg-surface-1/50",
						children: [trays.map((tray, trayIndex) => {
							const sq = searchQuery.toLowerCase();
							const filteredCables = tray.cables.filter((c) => (c.type || "").toLowerCase().includes(sq) || (c.cores || "").toLowerCase().includes(sq) || (c.size || "").toLowerCase().includes(sq) || (tray.name || "").toLowerCase().includes(sq));
							if (sq && filteredCables.length === 0 && !tray.name.toLowerCase().includes(sq)) return null;
							let subTotal1 = 0;
							let hasValidCables = false;
							const calcCables = filteredCables.map((c) => {
								const baseOd = c.cores && c.size ? cableDatabase[c.cores]?.[c.size] || NaN : NaN;
								const od = c.customOd !== void 0 && c.customOd !== "" ? Number(c.customOd) : baseOd;
								const qtyNum = typeof c.qty === "number" ? c.qty : 0;
								const sumOd = !isNaN(od) && qtyNum > 0 ? od * qtyNum : NaN;
								if (!isNaN(sumOd) && qtyNum > 0) {
									subTotal1 += sumOd;
									hasValidCables = true;
								}
								return {
									...c,
									od,
									sumOd
								};
							});
							const spacingFactor = Number(tray.spacingFactor ?? 1);
							const spacingWidth = subTotal1 * spacingFactor;
							const subTotal2 = subTotal1 + spacingWidth;
							const spareWidth = subTotal2 * (Number(tray.spareCapacity ?? 20) / 100);
							const totalWidth = subTotal2 + spareWidth;
							const traySize = hasValidCables ? getCableTraySize(totalWidth) : "N/A";
							const isExpanded = expandedTrayId === null ? trayIndex === 0 : expandedTrayId === tray.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden shrink-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-surface-2/50 border-b border-border px-3 py-1.5 flex items-center justify-between gap-3 flex-wrap cursor-pointer select-none hover:bg-surface-2/80 transition-colors",
									onClick: () => setExpandedTrayId(isExpanded ? "NONE" : tray.id),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3 flex-1 min-w-[200px]",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-primary rounded-sm" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												className: "font-bold text-sm bg-transparent border-none outline-none focus:border-b-2 focus:border-primary px-1 py-0 text-foreground w-48",
												value: tray.name,
												onChange: (e) => updateTrayField(tray.id, "name", e.target.value),
												onClick: (e) => e.stopPropagation(),
												placeholder: "Location (Tray Name)..."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												className: "text-sm bg-transparent border border-border rounded px-2 py-0.5 text-foreground w-48 ml-2 focus:border-primary outline-none",
												value: tray.from || "",
												onChange: (e) => updateTrayField(tray.id, "from", e.target.value),
												onClick: (e) => e.stopPropagation(),
												placeholder: "From..."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-muted-foreground text-sm flex-shrink-0",
												children: "→"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												className: "text-sm bg-transparent border border-border rounded px-2 py-0.5 text-foreground w-48 focus:border-primary outline-none",
												value: tray.to || "",
												onChange: (e) => updateTrayField(tray.id, "to", e.target.value),
												onClick: (e) => e.stopPropagation(),
												placeholder: "To..."
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											onClick: (e) => e.stopPropagation(),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
												onClick: () => clearTray(tray.id),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), " Clear Cables"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => removeTray(tray.id),
												className: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none h-8 px-3 py-1 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash, { className: "size-3.5" }), " Delete Tray"]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "px-2 text-muted-foreground flex items-center justify-center pointer-events-none",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
												xmlns: "http://www.w3.org/2000/svg",
												width: "24",
												height: "24",
												viewBox: "0 0 24 24",
												fill: "none",
												stroke: "currentColor",
												strokeWidth: "2",
												strokeLinecap: "round",
												strokeLinejoin: "round",
												className: cn("h-4 w-4 transition-transform duration-200", isExpanded ? "rotate-180" : ""),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "6 9 12 15 18 9" })
											})
										})]
									})]
								}), isExpanded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-full overflow-x-auto",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
											className: "w-full text-[13px] border-collapse whitespace-nowrap",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
												className: "bg-header-bg border-b border-border text-muted-foreground font-semibold",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "text-left",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "px-3 py-1.5 border-r border-border text-center w-8" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-1.5 border-r border-border text-center w-10",
															children: "No."
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-1.5 border-r border-border w-1/4",
															children: "Cable Type"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-1.5 border-r border-border w-32",
															children: "No. of Cores"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-1.5 border-r border-border w-32",
															children: "Cable Size (mm²)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-1.5 border-r border-border w-20 text-center",
															children: "Qty"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
															className: "px-3 py-1.5 border-r border-border w-24 text-center bg-surface-2 text-foreground",
															children: [
																"O.D. (",
																unitSystem === "si" ? "mm" : "in",
																")"
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
															className: "px-3 py-1.5 border-r border-border w-24 text-center bg-surface-2 text-foreground",
															children: [
																"Sum O.D. (",
																unitSystem === "si" ? "mm" : "in",
																")"
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-1.5 text-center w-10",
															children: "✕"
														})
													]
												})
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
												className: "divide-y divide-border",
												children: [calcCables.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													colSpan: 9,
													className: "text-center py-8 text-muted-foreground italic",
													children: "No cables in this tray. Click \"+ Add Cable\" to start."
												}) }) : calcCables.map((c, idx) => {
													const currentGlobalRowIndex = globalRowIndex++;
													const sizesForCore = c.cores ? Object.keys(cableDatabase[c.cores] || {}).sort((a, b) => parseFloat(a) - parseFloat(b)) : [];
													return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
														"data-cable-row": "true",
														className: cn("hover:bg-surface-2/50 transition-colors cursor-pointer", selectedRows.has(c.id) ? "bg-primary/10" : ""),
														onClick: (e) => {
															if (e.target.tagName === "TD") toggleRowSelect(c.id, e.shiftKey, e.ctrlKey || e.metaKey);
														},
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "w-8 border-r border-border text-center p-0",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																	className: "flex justify-center items-center h-full w-full",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																		type: "checkbox",
																		className: "cursor-pointer",
																		checked: selectedRows.has(c.id),
																		onChange: () => {},
																		onClick: (e) => {
																			e.stopPropagation();
																			toggleRowSelect(c.id, e.shiftKey, e.ctrlKey || e.metaKey);
																		}
																	})
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "text-center text-muted-foreground border-r border-border",
																children: idx + 1
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																	className: "w-full bg-transparent outline-none h-full focus:bg-background px-2 cursor-pointer",
																	value: c.type,
																	onChange: (e) => updateCable(tray.id, c.id, "type", e.target.value),
																	onKeyDown: (e) => handleKeyDown(e, currentGlobalRowIndex, 0),
																	children: [
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "XLPE/SWA/PVC",
																			children: "XLPE/SWA/PVC"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "PVC/PVC",
																			children: "PVC/PVC"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "XLPE/PVC",
																			children: "XLPE/PVC"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "Fire Resistant",
																			children: "Fire Resistant"
																		})
																	]
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																	className: "w-full bg-transparent outline-none h-full focus:bg-background px-2 cursor-pointer",
																	value: c.cores,
																	onChange: (e) => {
																		updateCable(tray.id, c.id, "cores", e.target.value);
																		updateCable(tray.id, c.id, "size", "");
																		updateCable(tray.id, c.id, "customOd", "");
																	},
																	onKeyDown: (e) => handleKeyDown(e, currentGlobalRowIndex, 3),
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "",
																		children: "-- Select --"
																	}), Object.keys(cableDatabase).map((core) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: core,
																		children: core
																	}, core))]
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																	className: "w-full h-8 px-3 bg-transparent outline-none focus:bg-background text-foreground cursor-pointer",
																	value: c.size,
																	onChange: (e) => {
																		updateCable(tray.id, c.id, "size", e.target.value);
																		updateCable(tray.id, c.id, "customOd", "");
																	},
																	onKeyDown: (e) => handleKeyDown(e, currentGlobalRowIndex, 4),
																	disabled: !c.cores,
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "",
																		children: c.cores ? "-- Select --" : "-- Core First --"
																	}), sizesForCore.map((sz) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: sz,
																		children: sz
																	}, sz))]
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
																	className: "w-full h-8 px-3 text-center bg-transparent outline-none focus:bg-background text-foreground cursor-pointer",
																	value: c.qty,
																	onChange: (e) => updateCable(tray.id, c.id, "qty", parseInt(e.target.value) || 1),
																	onKeyDown: (e) => handleKeyDown(e, currentGlobalRowIndex, 5),
																	children: Array.from({ length: 16 }, (_, i) => i + 1).map((num) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: num,
																		children: num
																	}, num))
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border bg-surface-2 text-foreground",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																	type: "number",
																	step: "any",
																	className: "w-full h-8 px-2 text-center bg-transparent outline-none focus:bg-background font-mono font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
																	value: c.customOd !== void 0 && c.customOd !== "" ? unitSystem === "si" ? c.customOd : (Number(c.customOd) / 25.4).toFixed(2) : isNaN(c.od) ? "" : unitSystem === "si" ? c.od.toFixed(1) : (c.od / 25.4).toFixed(2),
																	onChange: (e) => {
																		const val = e.target.value;
																		if (val === "") updateCable(tray.id, c.id, "customOd", "");
																		else updateCable(tray.id, c.id, "customOd", unitSystem === "si" ? val : (parseFloat(val) * 25.4).toString());
																	},
																	onKeyDown: (e) => handleKeyDown(e, currentGlobalRowIndex, 6)
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "px-3 py-1 text-center font-mono font-medium border-r border-border bg-surface-2 text-foreground",
																children: isNaN(c.sumOd) ? "-" : unitSystem === "si" ? c.sumOd.toFixed(1) : (c.sumOd / 25.4).toFixed(2)
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "text-center p-0",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																	onClick: () => removeCable(tray.id, c.id),
																	className: "text-destructive/70 hover:text-destructive hover:bg-destructive/10 w-full h-8 flex items-center justify-center transition-colors",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
																})
															})
														]
													}, c.id);
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													colSpan: 10,
													className: "p-0",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex border-t border-border border-dashed w-full",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
																onClick: () => addCable(tray.id),
																className: "flex-1 py-1.5 flex items-center justify-center gap-2 text-sm text-primary font-medium hover:bg-primary/5 transition-colors",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add Cable"]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-px bg-border border-dashed" }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportExcelBtn, {
																columnMapping: {
																	"From": "from",
																	"To": "to",
																	"Cable Type": "type",
																	"Type": "type",
																	"Cores": "cores",
																	"Core": "cores",
																	"Size": "size",
																	"Qty": "qty",
																	"Quantity": "qty"
																},
																onImport: (rows) => handleImportExcelCables(tray.id, rows),
																className: "flex-1 py-1.5 flex items-center justify-center gap-2 text-sm text-primary font-medium hover:bg-primary/5 transition-colors !border-0 bg-transparent rounded-none"
															})
														]
													})
												}) })]
											})]
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "bg-surface-2/30 border-t border-border p-4 flex justify-end",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5 w-72 text-sm",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between text-muted-foreground",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sub Total 1" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-mono",
														children: hasValidCables ? unitSystem === "si" ? Math.round(subTotal1) : (subTotal1 / 25.4).toFixed(1) : "-"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between text-muted-foreground border-b border-border border-dashed pb-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "flex items-center gap-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "text",
															className: "w-12 bg-transparent border-b border-muted-foreground/30 text-foreground font-medium outline-none focus:border-primary text-center p-0 cursor-text",
															value: tray.spacingFactor !== void 0 ? tray.spacingFactor : "1",
															onChange: (e) => updateTraySpacingFactor(tray.id, e.target.value),
															onBlur: (e) => updateTraySpacingFactor(tray.id, e.target.value === "" ? 1 : Number(e.target.value))
														}), "D spacing"]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-mono",
														children: hasValidCables ? unitSystem === "si" ? Math.round(spacingWidth) : (spacingWidth / 25.4).toFixed(1) : "-"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between text-foreground pt-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-medium",
														children: "Sub Total 2"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-mono font-medium",
														children: hasValidCables ? unitSystem === "si" ? Math.round(subTotal2) : (subTotal2 / 25.4).toFixed(1) : "-"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between text-muted-foreground border-b border-border border-dashed pb-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "flex items-center gap-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
															className: "bg-transparent border-b border-muted-foreground/30 text-foreground font-medium outline-none focus:border-primary text-center p-0 cursor-pointer",
															value: tray.spareCapacity !== void 0 ? tray.spareCapacity : 20,
															onChange: (e) => updateTraySpareCapacity(tray.id, Number(e.target.value)),
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "0",
																	children: "0"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "5",
																	children: "5"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "10",
																	children: "10"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "15",
																	children: "15"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "20",
																	children: "20"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "25",
																	children: "25"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "30",
																	children: "30"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "40",
																	children: "40"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "50",
																	children: "50"
																})
															]
														}), "% Minimum spare Space"]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-mono",
														children: hasValidCables ? unitSystem === "si" ? Math.round(spareWidth) : (spareWidth / 25.4).toFixed(1) : "-"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between text-foreground pt-1.5 font-bold",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-mono",
														children: hasValidCables ? unitSystem === "si" ? Math.round(totalWidth) : (totalWidth / 25.4).toFixed(1) : "-"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-center text-primary pt-3 mt-1 border-t border-border font-black text-base",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Cable Tray Size" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-mono bg-primary/10 px-2 py-0.5 rounded",
														children: formatTraySize(traySize, unitSystem === "si")
													})]
												})
											]
										})
									})]
								})]
							}, tray.id);
						}), trays.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl p-10",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-10 mb-4 opacity-20" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-lg font-medium",
									children: "No cable trays found."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm",
									children: "Click \"Add Tray\" in the top bar to get started."
								})
							]
						})]
					})]
				})]
			}),
			selectedRows.size > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "font-semibold",
					children: [selectedRows.size, " Selected"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => copyRows(Array.from(selectedRows)),
							className: "text-xs hover:bg-slate-800 px-3 py-1.5 rounded transition-colors",
							children: "Copy"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => cutRows(Array.from(selectedRows)),
							className: "text-xs hover:bg-slate-800 px-3 py-1.5 rounded transition-colors",
							children: "Cut"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => duplicateRows(Array.from(selectedRows)),
							className: "text-xs hover:bg-slate-800 px-3 py-1.5 rounded transition-colors",
							children: "Duplicate"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setBulkEditOpen(true),
							className: "text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded transition-colors",
							children: "Bulk Edit"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								pushToUndo(trays);
								setTrays((prev) => prev.map((t) => ({
									...t,
									cables: t.cables.filter((c) => !selectedRows.has(c.id))
								})));
								setSelectedRows(/* @__PURE__ */ new Set());
							},
							className: "text-xs hover:bg-red-900/50 text-red-400 px-3 py-1.5 rounded transition-colors ml-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4 inline mr-1" }), " Delete"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-px h-4 bg-slate-700 mx-2" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setSelectedRows(/* @__PURE__ */ new Set()),
							className: "text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded transition-colors flex items-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5 mr-1" }), " Esc"]
						})
					]
				})]
			}),
			bulkEditOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-surface border border-border shadow-xl rounded-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between p-4 border-b border-border bg-surface-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "font-semibold",
							children: [
								"Bulk Edit (",
								selectedRows.size,
								" Items)"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setBulkEditOpen(false),
							className: "p-1 hover:bg-surface-2 rounded-md transition-colors",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: (e) => {
							e.preventDefault();
							pushToUndo(trays);
							setTrays((prev) => prev.map((t) => ({
								...t,
								cables: t.cables.map((c) => {
									if (selectedRows.has(c.id)) return {
										...c,
										type: bulkForm.type || c.type,
										cores: bulkForm.cores || c.cores,
										size: bulkForm.size || c.size,
										qty: bulkForm.qty ? Number(bulkForm.qty) : c.qty,
										spacingFactor: bulkForm.spacingFactor ? Number(bulkForm.spacingFactor) : c.spacingFactor
									};
									return c;
								})
							})));
							setBulkEditOpen(false);
							setSelectedRows(/* @__PURE__ */ new Set());
							setBulkForm({
								type: "",
								cores: "",
								size: "",
								qty: "",
								spacingFactor: ""
							});
						},
						className: "p-4 space-y-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "col-span-2 space-y-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-xs text-muted-foreground",
										children: "Cable Type"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										className: "w-full text-sm border border-border rounded p-1.5 bg-background text-foreground",
										value: bulkForm.type,
										onChange: (e) => setBulkForm((p) => ({
											...p,
											type: e.target.value
										})),
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "",
												children: "-- No Change --"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "XLPE/SWA/PVC",
												children: "XLPE/SWA/PVC"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "PVC/PVC",
												children: "PVC/PVC"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "XLPE/PVC",
												children: "XLPE/PVC"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-xs text-muted-foreground",
										children: "Cores"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										className: "w-full text-sm border border-border rounded p-1.5 bg-background text-foreground",
										value: bulkForm.cores,
										onChange: (e) => setBulkForm((p) => ({
											...p,
											cores: e.target.value
										})),
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "",
												children: "-- No Change --"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "1C",
												children: "1C"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "2C",
												children: "2C"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "3C",
												children: "3C"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "4C",
												children: "4C"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "col-span-2 space-y-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-xs text-muted-foreground",
										children: "Size (mm²)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										className: "w-full text-sm border border-border rounded p-1.5 bg-background text-foreground",
										value: bulkForm.size,
										onChange: (e) => setBulkForm((p) => ({
											...p,
											size: e.target.value
										})),
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "",
												children: "-- No Change --"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "1.5",
												children: "1.5"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "2.5",
												children: "2.5"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "4",
												children: "4"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "6",
												children: "6"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "10",
												children: "10"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "16",
												children: "16"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "25",
												children: "25"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "35",
												children: "35"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "50",
												children: "50"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "70",
												children: "70"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "95",
												children: "95"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "120",
												children: "120"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "150",
												children: "150"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "185",
												children: "185"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "240",
												children: "240"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "300",
												children: "300"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "400",
												children: "400"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "500",
												children: "500"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "630",
												children: "630"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-xs text-muted-foreground",
										children: "Quantity"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										className: "w-full text-sm border border-border rounded p-1.5 bg-background text-foreground",
										placeholder: "-- No Change --",
										value: bulkForm.qty,
										onChange: (e) => setBulkForm((p) => ({
											...p,
											qty: e.target.value
										}))
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-xs text-muted-foreground",
										children: "Spacing Factor"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										className: "w-full text-sm border border-border rounded p-1.5 bg-background text-foreground",
										placeholder: "-- No Change --",
										step: "0.1",
										value: bulkForm.spacingFactor,
										onChange: (e) => setBulkForm((p) => ({
											...p,
											spacingFactor: e.target.value
										}))
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex justify-end gap-2 pt-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setBulkEditOpen(false),
								className: "px-4 py-2 text-sm rounded bg-surface-2 hover:bg-surface-3",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "submit",
								className: "px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 font-medium",
								children: [
									"Apply to ",
									selectedRows.size,
									" Items"
								]
							})]
						})]
					})]
				})
			})
		]
	});
}
//#endregion
export { CableTraySizingPage as component };
