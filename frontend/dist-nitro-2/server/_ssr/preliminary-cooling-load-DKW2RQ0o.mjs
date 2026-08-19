import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Gt as PenLine, M as Printer, N as Plus, Rt as ArrowUpDown, Ut as TriangleAlert, Wt as Sparkles, Y as Info, Zt as Funnel, in as CircleCheck, l as Upload, m as Trash2, n as X, rt as Gauge, xt as Copy } from "../_libs/lucide-react.mjs";
import { a as usePrompt, i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { a as ContextMenuSeparator, i as ContextMenuItem, o as ContextMenuShortcut, r as ContextMenuContent, t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
import { t as addPdfSignatureBlock } from "./pdfHelpers-Cqwarpxq.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { n as utils, t as readSync } from "../_libs/xlsx.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
import { t as DataGrid } from "./DataGrid-Ct9FtLBj.mjs";
import { n as PopoverContent, r as PopoverTrigger, t as Popover } from "./popover-CxE9vQwv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/preliminary-cooling-load-DKW2RQ0o.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
require_excel();
import_FileSaver_min.default.saveAs;
var INFER_MAP = [
	["apartment", "Apartment - Dwelling Unit"],
	["dwelling", "Apartment - Dwelling Unit"],
	["bedroom", "Apartment - Dwelling Unit"],
	["living", "Apartment - Dwelling Unit"],
	["dining", "Apartment - Dwelling Unit"],
	["residential", "Apartment - Dwelling Unit"],
	["corridor", "Corridor - Residential"],
	["lobby", "Lobby - Residential"],
	["reception", "Lobby - Residential"],
	["office", "Office - Cabin"],
	["cabin", "Office - Cabin"],
	["meeting", "Office - Meeting Room"],
	["conference", "Office - Meeting Room"],
	["classroom", "Classroom - Middle School"],
	["school", "Classroom - Middle School"],
	["university", "Classroom - Middle School"],
	["lab", "Lab - School"],
	["gym", "GYM"],
	["fitness", "GYM"],
	["spa", "SPA"],
	["clinic", "Clinic"],
	["medical", "Clinic"],
	["doctor", "Clinic - Doctor Room"],
	["treatment", "Clinic - Treatment Room"],
	["hotel", "Lobby - Hotel"],
	["kitchen", "Kitchen - Public"],
	["pantry", "Kitchen - Private"],
	["washroom", "Washroom"],
	["toilet", "Toilet - Public"],
	["wc", "Toilet - Public"],
	["restroom", "Toilet - Public"],
	["server", "Server Room"],
	["cctv", "CCTV Room"],
	["idf", "Typ. IDF Room"],
	["electrical", "Typ. Electrical Room"],
	["elec", "Typ. Electrical Room"],
	["storage", "Storage - Dry"],
	["store", "Storage - Dry"],
	["caf", "Café"],
	["restaurant", "Food & Beverage"],
	["supermarket", "Supermarket"],
	["retail", "Retail Shop - Mixed Building"],
	["shop", "Retail Shop - Mixed Building"],
	["mall", "Retail Shop - Mall"],
	["prayer", "Male Prayer Room"],
	["mosque", "Male Prayer Room"]
];
var SPACE_DENSITIES = {
	"Apartment - Dwelling Unit": 120,
	"Corridor - Residential": 60,
	"Lobby - Residential": 180,
	"Supermarket": 230,
	"Retail Shop - Mixed Building": 400,
	"Retail Shop - Mall": 200,
	"Food & Beverage": 2e3,
	"Kitchen - Public": 600,
	"Kitchen - Private": 120,
	"Café": 140,
	"Office - Cabin": 120,
	"Office - Meeting Room": 120,
	"Office - Common Room": 120,
	"Coworking Space": 120,
	"Classroom - EYFS": 140,
	"Classroom - Middle School": 140,
	"Classroom - Art": 140,
	"Classroom - High School": 150,
	"ICT Room": 180,
	"Lab - School": 180,
	"Lab - Science": 180,
	"Lobby - School": 100,
	"GYM": 180,
	"SPA": 150,
	"Kids Play Area": 250,
	"Clinic": 250,
	"Clinic - Treatment Room": 140,
	"Clinic - Doctor Room": 140,
	"Storage - Medical": 140,
	"Lobby - Hotel": 100,
	"Airlock": 120,
	"Washroom": 60,
	"Toilet - EYFS Attached": 100,
	"Toilet - Public": 100,
	"Male Prayer Room": 60,
	"Laundry / House Keeping": 150,
	"Garbage Room": 120,
	"Stairs": 100,
	"Lobby - Lift": 100,
	"Corridor - BOH/Service": 120,
	"MTR Room": 300,
	"LV Room": 90,
	"Server Room": 300,
	"CCTV Room": 300,
	"Typ. Electrical Room": 100,
	"Typ. IDF Room": 1500,
	"FCC Room": 120,
	"ETS Room": 120,
	"ETS Control Room": 120,
	"Chilled Water Pump Room": 120,
	"Fire Pump Room": 150,
	"ETS Pump Room": 100,
	"Boiler Room": 200,
	"Storage - Dry": 100,
	"Storage - IT": 1e3,
	"Storage - Occupied": 120
};
var extractFloor = (name) => {
	const match = name.match(/^([0-9]|B|G|LG|UG|SF|RF|M|P)[FLfli]?/i);
	return match ? match[0].toUpperCase().replace(/L$/i, "F") : "General";
};
var inferTypeFromName = (name) => {
	const q = name.toLowerCase().trim();
	for (const item of INFER_MAP) if (q.includes(item[0])) return item[1];
	return "";
};
function InlineInput({ value, onCommit, className = "", type = "text", step, min, placeholder }) {
	const [localVal, setLocalVal] = (0, import_react.useState)(value === "" ? "" : String(value));
	(0, import_react.useEffect)(() => {
		setLocalVal(value === "" ? "" : String(value));
	}, [value]);
	const handleKeyDown = (e) => {
		if (e.key === "Enter") e.currentTarget.blur();
		else if (e.key === "Escape") {
			setLocalVal(value === "" ? "" : String(value));
			e.currentTarget.blur();
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		step,
		min,
		value: localVal,
		placeholder,
		onChange: (e) => setLocalVal(e.target.value),
		onBlur: () => {
			if (localVal !== (value === "" ? "" : String(value))) onCommit(localVal);
		},
		onKeyDown: handleKeyDown,
		onClick: (e) => e.stopPropagation(),
		onDoubleClick: (e) => e.stopPropagation(),
		className: `bg-transparent w-full border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-foreground transition-colors cursor-text placeholder:text-muted-foreground/45 placeholder:font-normal ${className}`
	});
}
function PreliminaryCoolingLoadPage() {
	const { userData, profile } = useAuth();
	const currentUserName = userData?.name || profile?.name || "System Admin";
	const confirm = useConfirm();
	const prompt = usePrompt();
	const { project, forceSaveToCloud } = useWorkspace();
	const [projectInfo, setProjectInfo] = (0, import_react.useState)({
		projectName: "Preliminary Cooling Load Estimation",
		projectNumber: "MEP-PCL-2026",
		client: "Prestige Group developers",
		consultant: "Consistent Engineering Consultants",
		date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
		revision: "Rev 0",
		calcNumber: "CALC-HVAC-PCL01",
		notes: "Preliminary room-by-room cooling load analysis based on standard target heat dissipation densities."
	});
	const [rows, setRows] = (0, import_react.useState)([]);
	const [activeTab, setActiveTab] = (0, import_react.useState)("calculator");
	const [showFormulaPanel, setShowFormulaPanel] = (0, import_react.useState)(false);
	const [selected, setSelected] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [lastClickedIndex, setLastClickedIndex] = (0, import_react.useState)(null);
	const [query, setQuery] = (0, import_react.useState)("");
	const [selectedFloor, setSelectedFloor] = (0, import_react.useState)(null);
	const [selectedType, setSelectedType] = (0, import_react.useState)(null);
	const [clipboard, setClipboard] = (0, import_react.useState)([]);
	const [floorOrder, setFloorOrder] = (0, import_react.useState)(() => {
		try {
			const stored = localStorage.getItem("pcl-floor-order");
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	});
	const [draggingIndex, setDraggingIndex] = (0, import_react.useState)(null);
	const [bulkEditOpen, setBulkEditOpen] = (0, import_react.useState)(false);
	const [bulkEditValues, setBulkEditValues] = (0, import_react.useState)({
		floor: "",
		type: "",
		area: ""
	});
	const [bulkEditFields, setBulkEditFields] = (0, import_react.useState)({
		floor: false,
		type: false,
		area: false
	});
	const [importOpen, setImportOpen] = (0, import_react.useState)(false);
	const [pendingRecords, setPendingRecords] = (0, import_react.useState)([]);
	const [selectedPending, setSelectedPending] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [lastClickedPendingIndex, setLastClickedPendingIndex] = (0, import_react.useState)(null);
	const [importBulkValues, setImportBulkValues] = (0, import_react.useState)({
		floor: "",
		type: ""
	});
	const fileInputRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		try {
			const saved = localStorage.getItem("pcl_rows");
			if (saved) setRows(JSON.parse(saved));
			else setRows([
				{
					id: "1",
					name: "G-01 Main Office Lobby",
					area: 85,
					type: "Lobby - Residential",
					density: 180,
					dissipation: 15300,
					kw: 15.3,
					tr: 15.3 / 3.517,
					floor: "GF"
				},
				{
					id: "2",
					name: "1F-02 Executive Office Cabin",
					area: 24,
					type: "Office - Cabin",
					density: 120,
					dissipation: 2880,
					kw: 2.88,
					tr: 2.88 / 3.517,
					floor: "1F"
				},
				{
					id: "3",
					name: "1F-03 Main Meeting Room",
					area: 45,
					type: "Office - Meeting Room",
					density: 120,
					dissipation: 5400,
					kw: 5.4,
					tr: 5.4 / 3.517,
					floor: "1F"
				},
				{
					id: "4",
					name: "B-01 Electrical Room",
					area: 35,
					type: "Typ. Electrical Room",
					density: 100,
					dissipation: 3500,
					kw: 3.5,
					tr: 3.5 / 3.517,
					floor: "BF"
				},
				{
					id: "5",
					name: "B-02 Server Room",
					area: 25,
					type: "Server Room",
					density: 300,
					dissipation: 7500,
					kw: 7.5,
					tr: 7.5 / 3.517,
					floor: "BF"
				}
			]);
			const savedInfo = localStorage.getItem("pcl_project_info");
			if (savedInfo) setProjectInfo(JSON.parse(savedInfo));
		} catch (e) {
			console.error("Failed to load preliminary cooling load data", e);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		localStorage.setItem("pcl_rows", JSON.stringify(rows));
		localStorage.setItem("pcl_rowCount", rows.length.toString());
		localStorage.setItem("pcl_project_info", JSON.stringify(projectInfo));
	}, [rows, projectInfo]);
	const saveRows = (newRows) => {
		setRows(newRows);
		try {
			if (typeof window.PlumbingZoneLinker?.syncFromPCL === "function") window.PlumbingZoneLinker.syncFromPCL();
		} catch (e) {
			console.error(e);
		}
	};
	const calculatedData = (0, import_react.useMemo)(() => {
		let totalArea = 0;
		let totalW = 0;
		rows.forEach((r) => {
			const a = r.area !== "" ? Number(r.area) : 0;
			totalArea += a;
			totalW += r.dissipation;
		});
		const totalKw = totalW / 1e3;
		const totalTr = totalKw / 3.517;
		const avgDensity = totalArea > 0 ? totalW / totalArea : 0;
		return {
			totalArea,
			totalKw,
			totalTr,
			avgDensity
		};
	}, [rows]);
	const validationLogs = (0, import_react.useMemo)(() => {
		const logs = [];
		if (calculatedData.avgDensity > 300) logs.push({
			type: "warning",
			msg: `High average heat load density detected (${calculatedData.avgDensity.toFixed(1)} W/m²). Ensure high air-change rates to prevent local hotspots.`
		});
		else logs.push({
			type: "success",
			msg: `Average load density is in standard range (${calculatedData.avgDensity.toFixed(1)} W/m²).`
		});
		const highDensityRow = rows.find((r) => r.density > 1e3);
		if (highDensityRow) logs.push({
			type: "danger",
			msg: `Space '${highDensityRow.name}' has extremely high load density (${highDensityRow.density} W/m²). Verify ventilation and spot cooling layouts.`
		});
		return logs;
	}, [calculatedData, rows]);
	const allUniqueFloors = (0, import_react.useMemo)(() => {
		const vals = /* @__PURE__ */ new Set();
		rows.forEach((r) => {
			if (r.floor) vals.add(r.floor);
		});
		return Array.from(vals).sort();
	}, [rows]);
	const allUniqueTypes = (0, import_react.useMemo)(() => {
		const vals = /* @__PURE__ */ new Set();
		rows.forEach((r) => {
			if (r.type) vals.add(r.type);
		});
		return Array.from(vals).sort();
	}, [rows]);
	const activeFiltersCount = (0, import_react.useMemo)(() => {
		let count = 0;
		if (selectedFloor) count++;
		if (selectedType) count++;
		return count;
	}, [selectedFloor, selectedType]);
	const handleResetFilters = () => {
		setSelectedFloor(null);
		setSelectedType(null);
	};
	const sortedFloorsForGrid = (0, import_react.useMemo)(() => {
		const ordered = floorOrder.filter((f) => allUniqueFloors.includes(f));
		const remaining = allUniqueFloors.filter((f) => !ordered.includes(f));
		return [...ordered, ...remaining];
	}, [allUniqueFloors, floorOrder]);
	const handleDragStart = (e, index) => {
		setDraggingIndex(index);
		e.dataTransfer.effectAllowed = "move";
	};
	const handleDragOver = (e, index) => {
		e.preventDefault();
		if (draggingIndex === null || draggingIndex === index) return;
		const nextList = [...sortedFloorsForGrid];
		const draggedItem = nextList[draggingIndex];
		nextList.splice(draggingIndex, 1);
		nextList.splice(index, 0, draggedItem);
		setDraggingIndex(index);
		setFloorOrder(nextList);
		localStorage.setItem("pcl-floor-order", JSON.stringify(nextList));
	};
	const handleDragEnd = () => {
		setDraggingIndex(null);
	};
	const handleResetFloorOrder = () => {
		setFloorOrder([]);
		localStorage.removeItem("pcl-floor-order");
	};
	const filteredRows = (0, import_react.useMemo)(() => {
		const q = query.toLowerCase().trim();
		return rows.filter((s) => {
			if (selectedFloor && s.floor !== selectedFloor) return false;
			if (selectedType && s.type !== selectedType) return false;
			if (q && !`${s.name} ${s.floor} ${s.type}`.toLowerCase().includes(q)) return false;
			return true;
		});
	}, [
		rows,
		query,
		selectedFloor,
		selectedType
	]);
	const orderedRows = (0, import_react.useMemo)(() => {
		const groups = {};
		filteredRows.forEach((s) => {
			const floor = s.floor || "General";
			if (!groups[floor]) groups[floor] = [];
			groups[floor].push(s);
		});
		const sortedFloors = Object.keys(groups).sort((a, b) => {
			const idxA = sortedFloorsForGrid.indexOf(a);
			const idxB = sortedFloorsForGrid.indexOf(b);
			if (idxA !== -1 && idxB !== -1) return idxA - idxB;
			if (idxA !== -1) return -1;
			if (idxB !== -1) return 1;
			return a.localeCompare(b, void 0, {
				numeric: true,
				sensitivity: "base"
			});
		});
		const flat = [];
		sortedFloors.forEach((floor) => {
			flat.push(...groups[floor]);
		});
		return flat;
	}, [filteredRows, sortedFloorsForGrid]);
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape") {
				if (selected.size > 0 || selectedPending.size > 0) {
					e.preventDefault();
					setSelected(/* @__PURE__ */ new Set());
					setSelectedPending(/* @__PURE__ */ new Set());
					setLastClickedIndex(null);
				}
				return;
			}
			const activeEl = document.activeElement;
			if (activeEl && (activeEl.tagName === "INPUT" && activeEl.type !== "checkbox" && activeEl.type !== "radio" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable || activeEl.tagName === "SELECT")) return;
			const isCmdOrCtrl = navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? e.metaKey : e.ctrlKey;
			if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
				e.preventDefault();
				if (importOpen && pendingRecords.length > 0) setSelectedPending(new Set(pendingRecords.map((r) => r.id)));
				else if (!importOpen && filteredRows.length > 0) setSelected(new Set(filteredRows.map((r) => r.id)));
				return;
			}
			if (e.key === "Delete" || e.key === "Backspace") {
				if (importOpen && selectedPending.size > 0) {
					e.preventDefault();
					confirm(`Are you sure you want to remove the ${selectedPending.size} selected pending spaces?`).then((ok) => {
						if (ok) {
							setPendingRecords((prev) => prev.filter((r) => !selectedPending.has(r.id)));
							setSelectedPending(/* @__PURE__ */ new Set());
						}
					});
				} else if (!importOpen && selected.size > 0) {
					e.preventDefault();
					confirm(`Are you sure you want to delete the ${selected.size} selected spaces?`).then((ok) => {
						if (ok) {
							const selectedIds = Array.from(selected);
							saveRows(rows.filter((s) => !selectedIds.includes(s.id)));
							setSelected(/* @__PURE__ */ new Set());
						}
					});
				}
				return;
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
				if (!importOpen && selected.size > 0) {
					e.preventDefault();
					setClipboard(rows.filter((r) => selected.has(r.id)));
				}
				return;
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
				if (!importOpen && selected.size > 0) {
					e.preventDefault();
					setClipboard(rows.filter((r) => selected.has(r.id)));
					saveRows(rows.filter((r) => !selected.has(r.id)));
					setSelected(/* @__PURE__ */ new Set());
				}
				return;
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
				if (!importOpen && clipboard.length > 0) {
					e.preventDefault();
					const pasted = clipboard.map((r, idx) => ({
						...r,
						id: `pcl-${Date.now()}-${idx}-${Math.random()}`,
						name: `${r.name} (Copy)`
					}));
					saveRows([...rows, ...pasted]);
					setSelected(new Set(pasted.map((s) => s.id)));
				}
				return;
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		importOpen,
		pendingRecords,
		filteredRows,
		selected,
		selectedPending,
		rows,
		clipboard
	]);
	const toggle = (id, isShift, isCtrl) => {
		setSelected((prev) => {
			const clickedIndex = orderedRows.findIndex((r) => r.id === id);
			if (clickedIndex === -1) return prev;
			const next = new Set(prev);
			if (isShift && lastClickedIndex !== null) {
				const start = Math.min(lastClickedIndex, clickedIndex);
				const end = Math.max(lastClickedIndex, clickedIndex);
				if (!isCtrl) next.clear();
				const shouldSelect = prev.has(orderedRows[lastClickedIndex]?.id || "") || true;
				for (let i = start; i <= end; i++) {
					const rId = orderedRows[i]?.id;
					if (rId) if (shouldSelect) next.add(rId);
					else next.delete(rId);
				}
			} else if (isCtrl) {
				if (next.has(id)) next.delete(id);
				else next.add(id);
				setLastClickedIndex(clickedIndex);
			} else if (prev.has(id)) {
				next.delete(id);
				setLastClickedIndex(null);
			} else {
				next.clear();
				next.add(id);
				setLastClickedIndex(clickedIndex);
			}
			return next;
		});
	};
	const toggleAll = () => {
		setSelected((prev) => prev.size === filteredRows.length ? /* @__PURE__ */ new Set() : new Set(filteredRows.map((r) => r.id)));
	};
	const handleToggleGroup = (ids, select) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (select) ids.forEach((id) => next.add(id));
			else ids.forEach((id) => next.delete(id));
			return next;
		});
	};
	const handleAddNewSpace = () => {
		const defaultName = `GF-Space ${rows.length + 1}`;
		const defaultType = "";
		const density = 0;
		const floor = extractFloor(defaultName);
		const newRow = {
			id: `pcl-${Date.now()}`,
			name: defaultName,
			area: "",
			type: defaultType,
			density,
			dissipation: 0,
			kw: 0,
			tr: 0,
			floor
		};
		saveRows([...rows, newRow]);
	};
	const handleDeleteSelected = async () => {
		const selectedIds = Array.from(selected);
		if (selectedIds.length === 0) {
			alert("Please select at least one space to delete.");
			return;
		}
		if (await confirm(`Are you sure you want to remove ${selectedIds.length} selected spaces?`)) {
			saveRows(rows.filter((r) => !selectedIds.includes(r.id)));
			setSelected(/* @__PURE__ */ new Set());
		}
	};
	const parseExcelFile = (file) => {
		const reader = new FileReader();
		reader.onload = async (evt) => {
			try {
				const workbook = readSync(new Uint8Array(evt.target?.result), { type: "array" });
				const firstSheetName = workbook.SheetNames[0];
				const worksheet = workbook.Sheets[firstSheetName];
				const jsonData = utils.sheet_to_json(worksheet, { header: 1 });
				if (jsonData.length === 0) {
					alert("Empty file!");
					return;
				}
				let headerRowIndex = -1;
				let headers = [];
				for (let r = 0; r < jsonData.length; r++) {
					const row = jsonData[r];
					if (row && row.length > 0) {
						const rowNormalized = row.map((cell) => cell ? String(cell).trim().toLowerCase() : "");
						const possibleHeaders = [
							"level",
							"floor",
							"name",
							"space name",
							"area"
						];
						if (rowNormalized.some((cell) => possibleHeaders.includes(cell))) {
							headerRowIndex = r;
							headers = rowNormalized;
							break;
						}
					}
				}
				if (headerRowIndex === -1) {
					alert("Missing header row! Excel must contain columns: Level/Floor, Name, Area.");
					return;
				}
				let idxLevel = headers.indexOf("level");
				if (idxLevel === -1) idxLevel = headers.indexOf("floor");
				let idxName = headers.indexOf("name");
				if (idxName === -1) idxName = headers.indexOf("space name");
				const idxArea = headers.indexOf("area");
				if (idxLevel === -1 && idxName === -1 || idxArea === -1) {
					alert("Missing Level/Floor, Name, or Area columns.");
					return;
				}
				const parsed = [];
				for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
					const row = jsonData[r];
					if (!row || row.length === 0) continue;
					const levelVal = idxLevel !== -1 ? String(row[idxLevel] || "").trim() : "";
					const nameVal = idxName !== -1 ? String(row[idxName] || "").trim() : "";
					if (!nameVal && !levelVal) continue;
					const areaCleaned = String(row[idxArea] || "").trim().replace(/[^\d\.]/g, "");
					const area = parseFloat(areaCleaned) || 0;
					const inferredType = inferTypeFromName(nameVal) || "Apartment - Dwelling Unit";
					const density = SPACE_DENSITIES[inferredType] || 120;
					const floor = levelVal || extractFloor(nameVal) || "GF";
					parsed.push({
						id: `pending-${r}-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
						floor,
						name: nameVal || `Space ${r}`,
						type: inferredType,
						density,
						area,
						kw: area * density / 1e3,
						tr: area * density / 1e3 / 3.517
					});
				}
				setPendingRecords(parsed);
				setSelectedPending(new Set(parsed.map((p) => p.id)));
			} catch (err) {
				console.error(err);
				alert("Failed to parse Excel file.");
			}
		};
		reader.readAsArrayBuffer(file);
	};
	const handleFileUpload = (e) => {
		const file = e.target.files?.[0];
		if (file) parseExcelFile(file);
	};
	const togglePendingRow = (id, isShift) => {
		setSelectedPending((prev) => {
			const clickedIndex = pendingRecords.findIndex((r) => r.id === id);
			if (clickedIndex === -1) return prev;
			const next = new Set(prev);
			if (isShift && lastClickedPendingIndex !== null) {
				const start = Math.min(lastClickedPendingIndex, clickedIndex);
				const end = Math.max(lastClickedPendingIndex, clickedIndex);
				const shouldSelect = prev.has(pendingRecords[lastClickedPendingIndex]?.id || "") || true;
				for (let i = start; i <= end; i++) {
					const rId = pendingRecords[i]?.id;
					if (rId) if (shouldSelect) next.add(rId);
					else next.delete(rId);
				}
			} else if (prev.has(id)) {
				next.delete(id);
				setLastClickedPendingIndex(null);
			} else {
				next.add(id);
				setLastClickedPendingIndex(clickedIndex);
			}
			return next;
		});
	};
	const handleCommitImport = () => {
		const importList = pendingRecords.filter((r) => selectedPending.has(r.id));
		if (importList.length === 0) {
			alert("No spaces selected for import.");
			return;
		}
		const nextRows = [...rows];
		importList.forEach((r, idx) => {
			nextRows.push({
				id: `pcl-${Date.now()}-${idx}-${Math.random()}`,
				name: r.name,
				area: r.area,
				type: r.type,
				density: r.density,
				dissipation: r.area * r.density,
				kw: r.kw,
				tr: r.tr,
				floor: r.floor
			});
		});
		saveRows(nextRows);
		setImportOpen(false);
		setPendingRecords([]);
		setSelectedPending(/* @__PURE__ */ new Set());
	};
	const handlePrintPDF = () => {
		const doc = new import_jspdf_node_min.default("p", "pt", "a4");
		doc.setFont("helvetica", "bold");
		doc.setFontSize(18);
		doc.text("PRELIMINARY COOLING LOAD REPORT", 40, 50);
		doc.setFontSize(10);
		doc.setFont("helvetica", "normal");
		doc.setTextColor(100);
		doc.text(`Generated on: ${projectInfo.date} | Consultant: ${projectInfo.consultant} | Standard: ASHRAE`, 40, 68);
		doc.setDrawColor(10, 123, 199);
		doc.line(40, 75, 550, 75);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(11);
		doc.setTextColor(0);
		doc.text("1. Project & Sizing Details", 40, 95);
		autoTable(doc, {
			startY: 105,
			head: [],
			body: [
				[
					"Project Name",
					projectInfo.projectName,
					"Project Number",
					projectInfo.projectNumber
				],
				[
					"Consultant",
					projectInfo.consultant,
					"Client",
					projectInfo.client
				],
				[
					"Revision",
					projectInfo.revision,
					"Calculation Ref",
					projectInfo.calcNumber
				]
			],
			theme: "plain",
			styles: {
				fontSize: 9.5,
				cellPadding: 4
			},
			columnStyles: {
				0: {
					fontStyle: "bold",
					cellWidth: 90
				},
				1: { cellWidth: 170 },
				2: {
					fontStyle: "bold",
					cellWidth: 90
				},
				3: { cellWidth: 170 }
			}
		});
		doc.setFont("helvetica", "bold");
		doc.text("2. Room Sizing Schedule", 40, doc.lastAutoTable.finalY + 25);
		const grouped = {};
		rows.forEach((row) => {
			if (!grouped[row.floor]) grouped[row.floor] = [];
			grouped[row.floor].push(row);
		});
		const loadHead = [[
			"S.No",
			"Space Name",
			"Area (m²)",
			"Space Type",
			"Density (W/m²)",
			"kW",
			"TR"
		]];
		const loadBody = [];
		let sNo = 1;
		Object.keys(grouped).sort().forEach((floor) => {
			loadBody.push([{
				content: `📍 Floor: ${floor}`,
				colSpan: 7,
				styles: {
					fillColor: [
						220,
						239,
						251
					],
					textColor: [
						6,
						69,
						111
					],
					fontStyle: "bold"
				}
			}]);
			grouped[floor].forEach((r) => {
				loadBody.push([
					sNo++,
					r.name,
					r.area,
					r.type,
					r.density,
					r.kw.toFixed(2),
					r.tr.toFixed(2)
				]);
			});
		});
		loadBody.push([
			{
				content: "TOTAL",
				colSpan: 2,
				styles: {
					fillColor: [
						220,
						239,
						251
					],
					textColor: [
						6,
						69,
						111
					],
					fontStyle: "bold"
				}
			},
			{
				content: calculatedData.totalArea.toFixed(1),
				styles: {
					fillColor: [
						220,
						239,
						251
					],
					textColor: [
						6,
						69,
						111
					],
					fontStyle: "bold"
				}
			},
			{
				content: "",
				styles: { fillColor: [
					220,
					239,
					251
				] }
			},
			{
				content: calculatedData.avgDensity.toFixed(1),
				styles: {
					fillColor: [
						220,
						239,
						251
					],
					textColor: [
						6,
						69,
						111
					],
					fontStyle: "bold"
				}
			},
			{
				content: calculatedData.totalKw.toFixed(2),
				styles: {
					fillColor: [
						220,
						239,
						251
					],
					textColor: [
						6,
						69,
						111
					],
					fontStyle: "bold"
				}
			},
			{
				content: calculatedData.totalTr.toFixed(2),
				styles: {
					fillColor: [
						220,
						239,
						251
					],
					textColor: [
						6,
						69,
						111
					],
					fontStyle: "bold"
				}
			}
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
				10,
				123,
				199
			] }
		});
		addPdfSignatureBlock(doc, doc.lastAutoTable?.finalY || 40, currentUserName, project?.id || "default", "preliminary-cooling-load");
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), `${projectInfo.projectName.replace(/\s+/g, "_")}_report.pdf`, "PDF Document", ["pdf"]);
	};
	const handleBulkEditSave = () => {
		const selectedIds = Array.from(selected);
		saveRows(rows.map((r) => {
			if (selectedIds.includes(r.id)) {
				const nextRow = { ...r };
				if (bulkEditFields.floor) nextRow.floor = bulkEditValues.floor.trim() || r.floor;
				if (bulkEditFields.type) {
					nextRow.type = bulkEditValues.type;
					nextRow.density = SPACE_DENSITIES[bulkEditValues.type] || 120;
				}
				if (bulkEditFields.area) nextRow.area = parseFloat(bulkEditValues.area) || r.area;
				nextRow.dissipation = (nextRow.area !== "" ? Number(nextRow.area) : 0) * nextRow.density;
				nextRow.kw = nextRow.dissipation / 1e3;
				nextRow.tr = nextRow.kw / 3.517;
				return nextRow;
			}
			return r;
		}));
		setBulkEditOpen(false);
		setSelected(/* @__PURE__ */ new Set());
	};
	const columns = [
		{
			key: "name",
			header: "Name of Space",
			width: 240,
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				value: r.name,
				onCommit: (newName) => {
					const floor = extractFloor(newName);
					const defaultType = inferTypeFromName(newName) || r.type;
					const density = SPACE_DENSITIES[defaultType] || 120;
					const dissipation = (r.area !== "" ? Number(r.area) : 0) * density;
					const kw = dissipation / 1e3;
					const tr = kw / 3.517;
					saveRows(rows.map((row) => row.id === r.id ? {
						...row,
						name: newName,
						floor,
						type: defaultType,
						density,
						dissipation,
						kw,
						tr
					} : row));
				},
				className: "font-semibold text-[13px] font-sans"
			})
		},
		{
			key: "area",
			header: "Area (m²)",
			width: 90,
			align: "center",
			mono: true,
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				min: 1,
				value: r.area,
				placeholder: "20",
				onCommit: (newAreaStr) => {
					const nextArea = newAreaStr === "" ? "" : Number(newAreaStr);
					const dissipation = (nextArea !== "" ? Number(nextArea) : 0) * r.density;
					const kw = dissipation / 1e3;
					const tr = kw / 3.517;
					saveRows(rows.map((row) => row.id === r.id ? {
						...row,
						area: nextArea,
						dissipation,
						kw,
						tr
					} : row));
				},
				className: "font-mono text-center text-[13px]"
			})
		},
		{
			key: "type",
			header: "Type of Space",
			width: 260,
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				value: r.type || "",
				onChange: (e) => {
					const nextType = e.target.value;
					const density = SPACE_DENSITIES[nextType] || 0;
					const dissipation = (r.area !== "" ? Number(r.area) : 0) * density;
					const kw = dissipation / 1e3;
					const tr = kw / 3.517;
					saveRows(rows.map((row) => row.id === r.id ? {
						...row,
						type: nextType,
						density,
						dissipation,
						kw,
						tr
					} : row));
				},
				className: `w-full bg-transparent border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-muted-foreground/20 focus:bg-background focus:ring-1 focus:ring-primary focus:outline-none py-0.5 px-1 rounded text-[12.5px] cursor-pointer font-sans ${!r.type ? "text-muted-foreground/45" : "text-foreground font-medium"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "",
					disabled: true,
					className: "text-muted-foreground",
					children: "Select"
				}), Object.keys(SPACE_DENSITIES).map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
					value: k,
					className: "bg-background text-foreground text-xs font-normal",
					children: [
						k,
						" (",
						SPACE_DENSITIES[k],
						" W/m²)"
					]
				}, k))]
			})
		},
		{
			key: "density",
			header: "Density",
			width: 100,
			align: "right",
			mono: true,
			render: (r) => r.type ? `${r.density} W/m²` : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground/45 font-mono font-normal",
				children: "120 W/m²"
			})
		},
		{
			key: "kw",
			header: "Load (kW)",
			width: 90,
			align: "right",
			mono: true,
			render: (r) => r.area === "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-muted-foreground/45 font-mono font-normal",
				children: [(20 * (r.density || 120) / 1e3).toFixed(2), " kW"]
			}) : `${r.kw.toFixed(2)} kW`
		},
		{
			key: "tr",
			header: "Load (TR)",
			width: 90,
			align: "right",
			mono: true,
			render: (r) => r.area === "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-muted-foreground/45 font-mono font-normal",
				children: [(20 * (r.density || 120) / 1e3 / 3.517).toFixed(2), " TR"]
			}) : `${r.tr.toFixed(2)} TR`
		}
	];
	const renderSpaceContextMenu = (row) => {
		const selectedIds = selected.has(row.id) ? Array.from(selected) : [row.id];
		const isMulti = selectedIds.length > 1;
		const targetsCount = selectedIds.length;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuContent, {
			className: "w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: () => {
						const clones = selectedIds.map((id, index) => {
							const targetRow = rows.find((s) => s.id === id);
							if (!targetRow) return null;
							return {
								...targetRow,
								id: `pcl-${Date.now()}-${index}-${Math.random()}`,
								name: `${targetRow.name} (Clone)`
							};
						}).filter(Boolean);
						if (clones.length > 0) saveRows([...rows, ...clones]);
					},
					className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: isMulti ? "Duplicate Selected" : "Duplicate Space" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, { className: "h-px bg-border my-1" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: async () => {
						if (await confirm(targetsCount === 1 ? `Are you sure you want to delete space "${row.name}"?` : `Are you sure you want to delete the ${targetsCount} selected spaces?`)) {
							saveRows(rows.filter((s) => !selectedIds.includes(s.id)));
							setSelected(/* @__PURE__ */ new Set());
						}
					},
					className: "flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Delete" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuShortcut, {
							className: "text-[10px] text-muted-foreground font-mono ml-auto",
							children: "Delete"
						})
					]
				})
			]
		});
	};
	const renderFloorGroupHeader = (floor) => {
		const floorRows = filteredRows.filter((r) => r.floor === floor);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex items-center gap-1.5 font-medium",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
				className: "font-bold text-primary",
				children: floor
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-[10px] text-muted-foreground font-normal",
				children: [
					"(",
					floorRows.length,
					" spaces) (Right-click or press Delete to remove)"
				]
			})]
		});
	};
	const renderFloorGroupContextMenu = (floor) => {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuContent, {
			className: "w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: async () => {
						const newFloor = await prompt("Enter new floor name:", floor, { title: "Rename Floor" });
						if (newFloor && newFloor.trim() !== "" && newFloor.trim() !== floor) {
							const trimmed = newFloor.trim();
							saveRows(rows.map((s) => s.floor === floor ? {
								...s,
								floor: trimmed
							} : s));
						}
					},
					className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Rename Floor" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, { className: "h-px bg-border my-1" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: async () => {
						const floorSpaces = rows.filter((s) => s.floor === floor);
						if (floorSpaces.length > 0) {
							if (await confirm(`Are you sure you want to delete all ${floorSpaces.length} spaces on floor "${floor}"?`)) {
								saveRows(rows.filter((s) => s.floor !== floor));
								setSelected(/* @__PURE__ */ new Set());
							}
						}
					},
					className: "flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Delete Floor" })]
				})
			]
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Preliminary Cooling Load",
		hideSubHeader: true,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex h-full min-h-0 bg-transparent font-sans",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-between items-start shrink-0 select-none no-print px-6",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-1 w-full",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
									children: "HVAC > PRELIMINARY COOLING LOAD"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex items-center gap-3 mt-0.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-baseline gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
											className: "text-[28px] font-bold tracking-tight text-foreground",
											children: "Preliminary Cooling Load"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[15px] font-semibold text-muted-foreground",
											children: [rows.length, " spaces"]
										})]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[13px] text-muted-foreground mt-0.5",
									children: "Preliminary room-by-room cooling load and heat density sizer schedule."
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-6 mb-6 bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/60",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setActiveTab("calculator"),
									className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${activeTab === "calculator" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
									children: "Sizing Calculator"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setActiveTab("report"),
									className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${activeTab === "report" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
									children: "Printable Report"
								})]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1 min-h-0 animate-fade-in flex flex-col",
							children: activeTab === "calculator" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 min-h-0 flex flex-col relative",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative flex items-center gap-1.5 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												value: query,
												onChange: (e) => setQuery(e.target.value),
												placeholder: "Filter spaces...",
												className: "h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
												asChild: true,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													className: `relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${activeFiltersCount > 0 ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15" : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Funnel, { className: "size-3.5 shrink-0" }), activeFiltersCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background",
														children: activeFiltersCount
													})]
												})
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PopoverContent, {
												align: "start",
												className: "w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center justify-between pb-1.5 border-b border-border",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[12px] font-semibold text-foreground",
															children: "Filters"
														}), activeFiltersCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: handleResetFilters,
															className: "text-[10px] text-primary hover:underline font-semibold",
															children: "Clear All"
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex flex-col gap-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider",
															children: "Floor"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
															value: selectedFloor || "",
															onChange: (e) => setSelectedFloor(e.target.value || null),
															className: "h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																value: "",
																children: "All Floors"
															}), allUniqueFloors.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																value: f,
																children: f
															}, f))]
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex flex-col gap-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider",
															children: "Space Type"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
															value: selectedType || "",
															onChange: (e) => setSelectedType(e.target.value || null),
															className: "h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																value: "",
																children: "All Space Types"
															}), allUniqueTypes.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																value: c,
																children: c
															}, c))]
														})]
													})
												]
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
												asChild: true,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													className: `relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${floorOrder.length > 0 ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15" : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpDown, { className: "size-3.5 shrink-0" }), floorOrder.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background",
														children: "✓"
													})]
												})
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PopoverContent, {
												align: "start",
												className: "w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans z-50",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center justify-between mb-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11.5px] font-semibold text-foreground",
															children: "Arrange Floors"
														}), floorOrder.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: handleResetFloorOrder,
															className: "text-[10px] text-primary hover:underline font-medium",
															children: "Reset"
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-[10.5px] text-muted-foreground mb-3 leading-snug",
														children: "Drag and drop floors to change their sorting order in the grid views."
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "flex flex-col gap-1.5 max-h-[250px] overflow-y-auto pr-0.5",
														children: sortedFloorsForGrid.map((floor, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															draggable: true,
															onDragStart: (e) => handleDragStart(e, index),
															onDragOver: (e) => handleDragOver(e, index),
															onDragEnd: handleDragEnd,
															className: `flex items-center gap-2 p-1.5 bg-surface rounded border border-border text-[11px] cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${draggingIndex === index ? "opacity-40 border-primary bg-primary/5" : "hover:bg-surface-2 hover:border-border-strong"}`,
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-semibold text-foreground uppercase truncate",
																children: floor
															})
														}, floor))
													})
												]
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "ml-auto flex items-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
													onClick: () => setImportOpen(true),
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }), " Import"]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
													primary: true,
													onClick: handleAddNewSpace,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " New Space"]
												})]
											}),
											selected.size > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-semibold",
														children: [selected.size, " selected"]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-primary/30",
														children: "·"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BulkBtn, {
														icon: PenLine,
														onClick: () => {
															setBulkEditValues({
																floor: "",
																type: "",
																area: ""
															});
															setBulkEditFields({
																floor: false,
																type: false,
																area: false
															});
															setBulkEditOpen(true);
														},
														children: "Bulk edit"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BulkBtn, {
														icon: Trash2,
														onClick: handleDeleteSelected,
														children: "Delete"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
														onClick: () => setSelected(/* @__PURE__ */ new Set()),
														className: "ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3" }), " Clear"]
													})
												]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex-1 min-h-0 relative flex flex-col",
										children: rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1 h-full min-h-[350px] flex flex-col items-center justify-center p-8 bg-surface-2 border border-dashed rounded-b-2xl",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-6" })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "text-[15px] font-semibold tracking-tight",
													children: "No Spaces Loaded"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "text-[12px] text-muted-foreground mt-2 mb-6 leading-relaxed text-center",
													children: "Start by importing a Revit space schedule or manually add spaces."
												})
											]
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataGrid, {
											rows,
											columns,
											selected,
											onToggle: toggle,
											onToggleAll: toggleAll,
											renderContextMenu: renderSpaceContextMenu,
											groupBy: (r) => r.floor,
											groupOrder: sortedFloorsForGrid,
											renderGroupHeader: renderFloorGroupHeader,
											renderGroupContextMenu: renderFloorGroupContextMenu,
											onToggleGroup: handleToggleGroup
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 select-none",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
											"Showing ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-foreground font-medium tabular",
												children: filteredRows.length.toLocaleString()
											}),
											" of ",
											rows.length.toLocaleString(),
											" spaces"
										] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3 tabular",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Σ Area: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-mono text-foreground font-bold",
													children: [calculatedData.totalArea.toFixed(1), " m²"]
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Avg Heat Density: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-mono text-foreground font-bold",
													children: [calculatedData.avgDensity.toFixed(1), " W/m²"]
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Σ Load (kW): ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-mono text-primary font-bold",
													children: [calculatedData.totalKw.toFixed(2), " kW"]
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Σ Load (TR): ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-mono text-pink-600 font-bold",
													children: [calculatedData.totalTr.toFixed(2), " TR"]
												})] })
											]
										})]
									})
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 flex flex-col min-h-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "relative flex items-center justify-end gap-3 px-6 h-12 bg-background border-b border-border/60 shrink-0 no-print select-none",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										onClick: handlePrintPDF,
										primary: true,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-3.5" }), " Print / Export PDF"]
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex-1 overflow-y-auto p-8 bg-slate-50/30 dark:bg-slate-950/20 font-sans print:p-0",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "no-print max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border border-blue-200/60 dark:border-blue-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "absolute right-4 top-4 bg-blue-500/10 text-blue-600 rounded-full p-2",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4" })
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1 font-sans",
															children: "Total Cooling Load (TR)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
															className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
															children: [calculatedData.totalTr.toFixed(2), " TR"]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[11px] text-muted-foreground mt-2 block font-sans",
															children: [
																"Total Load in kW: ",
																calculatedData.totalKw.toFixed(2),
																" kW"
															]
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "bg-gradient-to-br from-pink-50 to-pink-100/50 dark:from-pink-950/20 dark:to-pink-900/10 border border-pink-200/60 dark:border-pink-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "absolute right-4 top-4 bg-pink-500/10 text-pink-600 rounded-full p-2",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gauge, { className: "size-4" })
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-widest block mb-1 font-sans",
															children: "Average Load Density"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
															className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
															children: [calculatedData.avgDensity.toFixed(1), " W/m²"]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[11px] text-muted-foreground mt-2 block font-sans",
															children: [
																"Total Area Sized: ",
																calculatedData.totalArea.toFixed(1),
																" m²"
															]
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "absolute right-4 top-4 bg-emerald-500/10 text-emerald-600 rounded-full p-2",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4" })
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1 font-sans",
															children: "Total Spaces Sized"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
															className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
															children: [rows.length, " spaces"]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[11px] text-muted-foreground mt-2 block font-sans",
															children: [
																"Active Floors: ",
																new Set(rows.map((r) => r.floor)).size,
																" levels"
															]
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: `bg-gradient-to-br border rounded-2xl p-5 shadow-xs relative overflow-hidden ${calculatedData.avgDensity > 300 ? "from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200/60 dark:border-amber-800/50" : "from-teal-50 to-teal-100/50 dark:from-teal-950/20 dark:to-teal-900/10 border-teal-200/60 dark:border-teal-800/50"}`,
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "absolute right-4 top-4 text-muted-foreground rounded-full p-2",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4" })
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] font-bold uppercase tracking-widest block mb-1 font-sans",
															children: "Design Density Status"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
															className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
															children: calculatedData.avgDensity > 300 ? "High Load" : "Standard"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11px] text-muted-foreground mt-2 block font-sans",
															children: calculatedData.avgDensity > 300 ? "Requires mechanical ventilation review" : "Optimal cooling density range"
														})
													]
												})
											]
										}),
										validationLogs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "no-print max-w-4xl mx-auto w-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm font-sans",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
												className: "font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-3.5 flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 text-amber-500" }), " Sizing Validation Warnings"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex flex-col gap-2",
												children: validationLogs.map((log, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: `flex items-start gap-2.5 p-3 rounded-xl border text-[12.5px] ${log.type === "danger" ? "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400" : log.type === "warning" ? "bg-sky-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400" : log.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400" : "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400"}`,
													children: [log.type === "danger" || log.type === "warning" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5" }) : log.type === "success" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4 shrink-0 mt-0.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-4 shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: log.msg })]
												}, idx))
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-slate-300 dark:border-slate-800 rounded-xl p-8 max-w-4xl mx-auto shadow-sm print:border-none print:shadow-none print:p-0",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border-b-2 border-slate-800 pb-5 mb-6 flex justify-between items-start font-sans",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
														className: "text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wider",
														children: "PRELIMINARY COOLING LOAD REPORT"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-[12px] text-muted-foreground font-mono mt-1 font-sans",
														children: "Preliminary Cooling Load and Heat Density analysis grouped by floor level"
													})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-right",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[13px] font-bold text-primary font-mono block",
															children: "MEP CALCULATION SUITE"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[11px] text-muted-foreground block mt-0.5 font-sans",
															children: ["Date: ", projectInfo.date]
														})]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "mb-6 font-sans",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
														className: "font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 pb-1 mb-3",
														children: "1. Project Details"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "grid grid-cols-2 gap-4 text-xs font-sans",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground block",
																children: "Project Name:"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-semibold",
																children: projectInfo.projectName
															})] }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground block",
																children: "Project Number:"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-semibold",
																children: projectInfo.projectNumber
															})] }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground block",
																children: "Consultant / Engineer:"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-semibold",
																children: projectInfo.consultant
															})] }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground block",
																children: "Client Name:"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-semibold",
																children: projectInfo.client
															})] }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "col-span-2",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-muted-foreground block",
																	children: "Calculation Notes:"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "italic text-muted-foreground block mt-0.5",
																	children: projectInfo.notes
																})]
															})
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "mb-6 page-break font-sans",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
														className: "font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 pb-1 mb-3",
														children: "2. Sizing Details"
													}), (() => {
														const grouped = {};
														rows.forEach((row) => {
															if (!grouped[row.floor]) grouped[row.floor] = [];
															grouped[row.floor].push(row);
														});
														let sNo = 1;
														return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
															className: "w-full text-left text-[11px] border border-collapse border-slate-200 font-sans",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
																className: "bg-slate-100 font-bold text-slate-800 border-b border-slate-200",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																		className: "p-2 border-r border-slate-200",
																		children: "S.No"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																		className: "p-2 border-r border-slate-200",
																		children: "Space Name"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																		className: "p-2 text-right border-r border-slate-200",
																		children: "Area (m²)"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																		className: "p-2 border-r border-slate-200",
																		children: "Space Type"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																		className: "p-2 text-right border-r border-slate-200",
																		children: "Density (W/m²)"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																		className: "p-2 text-right border-r border-slate-200",
																		children: "kW"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																		className: "p-2 text-right",
																		children: "TR"
																	})
																]
															}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
																className: "divide-y divide-slate-200 font-mono",
																children: [Object.keys(grouped).sort().map((floor) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	colSpan: 7,
																	className: "p-0",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", {
																		className: "w-full border-collapse",
																		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
																			className: "bg-slate-50 font-bold text-slate-700 border-b border-slate-200",
																			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																				colSpan: 7,
																				className: "p-2 font-sans",
																				children: ["📍 Floor: ", floor]
																			})
																		}), grouped[floor].map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
																			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																				className: "p-2 border-r border-slate-200 w-12",
																				children: sNo++
																			}),
																			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																				className: "p-2 border-r border-slate-200 font-sans",
																				children: r.name
																			}),
																			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																				className: "p-2 text-right border-r border-slate-200 w-16",
																				children: r.area
																			}),
																			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																				className: "p-2 border-r border-slate-200 font-sans",
																				children: r.type
																			}),
																			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																				className: "p-2 text-right border-r border-slate-200 w-24",
																				children: r.density
																			}),
																			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																				className: "p-2 text-right border-r border-slate-200 w-24 font-bold",
																				children: r.kw.toFixed(2)
																			}),
																			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																				className: "p-2 text-right w-20 font-bold text-primary",
																				children: r.tr.toFixed(2)
																			})
																		] }, r.id))] })
																	})
																}) }, floor)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
																	className: "bg-blue-50 font-bold text-blue-950",
																	children: [
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																			colSpan: 2,
																			className: "p-2 border-r border-slate-200 font-sans",
																			children: "TOTAL"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																			className: "p-2 text-right border-r border-slate-200",
																			children: calculatedData.totalArea.toFixed(1)
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "p-2 border-r border-slate-200 font-sans" }),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																			className: "p-2 text-right border-r border-slate-200",
																			children: calculatedData.avgDensity.toFixed(1)
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																			className: "p-2 text-right border-r border-slate-200",
																			children: calculatedData.totalKw.toFixed(2)
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																			className: "p-2 text-right text-primary",
																			children: calculatedData.totalTr.toFixed(2)
																		})
																	]
																})]
															})]
														});
													})()]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-[11px] text-muted-foreground font-sans",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "font-semibold uppercase tracking-wider text-slate-800 mb-6 font-sans",
															children: "Prepared By:"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "border-b border-slate-300 w-48 mb-1" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "font-sans",
															children: "Consulting HVAC Engineer"
														})
													] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-right",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																className: "font-semibold uppercase tracking-wider text-slate-800 mb-6 font-sans",
																children: "Reviewed & Approved By:"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "border-b border-slate-300 w-48 ml-auto mb-1" }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																className: "font-sans",
																children: "Lead MEP Principal Engineer"
															})
														]
													})]
												})
											]
										})
									]
								})]
							})
						})]
					})]
				})
			}),
			importOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-xl shadow-lg w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden font-sans",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-6 py-4 border-b border-border flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-5 text-primary animate-bounce" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-bold text-[15px]",
									children: "Import Space Schedule (Excel / JSON)"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									setImportOpen(false);
									setPendingRecords([]);
								},
								className: "text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded-md p-1",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-6 flex-1 overflow-y-auto flex flex-col gap-6",
							children: pendingRecords.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								onDragOver: (e) => e.preventDefault(),
								onDrop: (e) => {
									e.preventDefault();
									const file = e.dataTransfer.files?.[0];
									if (file) parseExcelFile(file);
								},
								className: "flex-1 min-h-[300px] border-2 border-dashed border-border hover:border-primary/50 rounded-2xl flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/10 cursor-pointer transition-colors",
								onClick: () => fileInputRef.current?.click(),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-8" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold text-sm",
										children: "Drag & drop your Excel space schedule here"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-muted-foreground mt-1",
										children: "or click to browse files from your computer"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-muted-foreground mt-4 font-mono",
										children: "Supports Revit Space Schedules with columns: Level/Floor, Name, Area"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "file",
										ref: fileInputRef,
										onChange: handleFileUpload,
										accept: ".xlsx,.xls,.json",
										className: "hidden"
									})
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col lg:flex-row gap-6 min-h-[400px]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex-1 flex flex-col border border-border rounded-xl bg-card overflow-hidden",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-b border-border flex items-center justify-between text-xs font-semibold",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											"Previewing ",
											pendingRecords.length,
											" parsed spaces"
										] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [selectedPending.size, " selected"] })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex-1 overflow-y-auto max-h-[350px]",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
											className: "w-full text-xs text-left border-collapse",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
												className: "bg-slate-50/50 dark:bg-slate-900/20 border-b border-border text-[10.5px] font-bold text-muted-foreground uppercase",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3 text-center w-10",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "checkbox",
															checked: selectedPending.size === pendingRecords.length,
															onChange: (e) => {
																if (e.target.checked) setSelectedPending(new Set(pendingRecords.map((p) => p.id)));
																else setSelectedPending(/* @__PURE__ */ new Set());
															},
															className: "rounded border-gray-300 text-primary size-3.5 cursor-pointer"
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3",
														children: "Level"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3",
														children: "Name"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3",
														children: "Area (m²)"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3",
														children: "Space Type"
													})
												]
											}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
												className: "divide-y divide-border/40 font-medium",
												children: pendingRecords.map((r, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													onClick: (e) => togglePendingRow(r.id, e.shiftKey),
													className: `hover:bg-slate-50/40 dark:hover:bg-slate-900/10 cursor-pointer transition-colors ${selectedPending.has(r.id) ? "bg-primary/5" : ""}`,
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3 text-center",
															onClick: (e) => e.stopPropagation(),
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "checkbox",
																checked: selectedPending.has(r.id),
																onChange: () => togglePendingRow(r.id),
																className: "rounded border-gray-300 text-primary size-3.5 cursor-pointer"
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3 font-mono text-[11px] uppercase",
															children: r.floor
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3 text-foreground",
															children: r.name
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3 font-mono",
															children: r.area.toFixed(1)
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3 font-sans truncate max-w-[150px]",
															children: r.type
														})
													]
												}, r.id))
											})]
										})
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "w-full lg:w-72 border border-border rounded-xl bg-card p-4 flex flex-col gap-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200",
											children: "Bulk Parameters Config"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-[11px] text-muted-foreground leading-relaxed",
											children: [
												"Apply parameters to the ",
												selectedPending.size,
												" selected pending spaces before committing them."
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[11px] font-semibold text-muted-foreground",
												children: "Override Floor"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												value: importBulkValues.floor,
												onChange: (e) => setImportBulkValues({
													...importBulkValues,
													floor: e.target.value
												}),
												placeholder: "e.g. L01",
												className: "h-8 px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[11px] font-semibold text-muted-foreground",
												children: "Set Space Type"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: importBulkValues.type,
												onChange: (e) => setImportBulkValues({
													...importBulkValues,
													type: e.target.value
												}),
												className: "h-8 px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary cursor-pointer",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "",
													children: "Choose space type..."
												}), Object.keys(SPACE_DENSITIES).map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: k,
													children: k
												}, k))]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => {
												if (selectedPending.size === 0) {
													alert("Select pending spaces first.");
													return;
												}
												setPendingRecords(pendingRecords.map((r) => {
													if (selectedPending.has(r.id)) {
														const next = { ...r };
														if (importBulkValues.floor) next.floor = importBulkValues.floor.trim();
														if (importBulkValues.type) {
															next.type = importBulkValues.type;
															next.density = SPACE_DENSITIES[importBulkValues.type] || 120;
															next.kw = next.area * next.density / 1e3;
															next.tr = next.kw / 3.517;
														}
														return next;
													}
													return r;
												}));
											},
											className: "w-full bg-primary/10 hover:bg-primary/20 text-primary font-bold h-8.5 rounded-lg text-xs transition-colors cursor-pointer",
											children: "Apply Parameters"
										})
									]
								})]
							})
						}),
						pendingRecords.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-6 py-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/10 flex items-center justify-between shrink-0 font-sans text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									setPendingRecords([]);
									setSelectedPending(/* @__PURE__ */ new Set());
								},
								className: "h-9 px-4 border border-border rounded-lg hover:bg-surface-2 font-semibold text-foreground transition-all cursor-pointer",
								children: "Clear Preview"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setImportOpen(false),
									className: "h-9 px-4 border border-border rounded-lg hover:bg-surface-2 font-semibold text-foreground transition-all cursor-pointer",
									children: "Cancel"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: handleCommitImport,
									className: "h-9 px-5 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-lg shadow transition-all flex items-center gap-1.5 cursor-pointer",
									children: [
										"Import ",
										selectedPending.size,
										" Spaces"
									]
								})]
							})]
						})
					]
				})
			}),
			bulkEditOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-xl shadow-lg w-full max-w-md animate-scale-in font-sans",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-5 py-3.5 border-b border-border flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-bold text-[14px]",
								children: "Bulk Edit Parameters"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setBulkEditOpen(false),
								className: "text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded-md p-1",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-5 flex flex-col gap-4 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-muted-foreground leading-relaxed",
									children: [
										"Modify attributes for the ",
										selected.size,
										" selected spaces. Check the fields you want to update."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1.5 border border-border/60 rounded-xl p-3 bg-slate-50/30 dark:bg-slate-900/5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "flex items-center gap-2 font-semibold text-foreground cursor-pointer select-none",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: bulkEditFields.floor,
											onChange: (e) => setBulkEditFields({
												...bulkEditFields,
												floor: e.target.checked
											}),
											className: "rounded border-gray-300 text-primary size-3.5"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Floor Level" })]
									}), bulkEditFields.floor && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										value: bulkEditValues.floor,
										onChange: (e) => setBulkEditValues({
											...bulkEditValues,
											floor: e.target.value
										}),
										placeholder: "e.g. 1F, GF",
										className: "h-8 px-2.5 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary mt-1"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1.5 border border-border/60 rounded-xl p-3 bg-slate-50/30 dark:bg-slate-900/5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "flex items-center gap-2 font-semibold text-foreground cursor-pointer select-none",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: bulkEditFields.type,
											onChange: (e) => setBulkEditFields({
												...bulkEditFields,
												type: e.target.checked
											}),
											className: "rounded border-gray-300 text-primary size-3.5"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Space Type / Heat Density" })]
									}), bulkEditFields.type && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: bulkEditValues.type,
										onChange: (e) => setBulkEditValues({
											...bulkEditValues,
											type: e.target.value
										}),
										className: "h-8 px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary cursor-pointer mt-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "",
											disabled: true,
											children: "Select Space Type..."
										}), Object.keys(SPACE_DENSITIES).map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
											value: k,
											children: [
												k,
												" (",
												SPACE_DENSITIES[k],
												" W/m²)"
											]
										}, k))]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1.5 border border-border/60 rounded-xl p-3 bg-slate-50/30 dark:bg-slate-900/5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "flex items-center gap-2 font-semibold text-foreground cursor-pointer select-none",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: bulkEditFields.area,
											onChange: (e) => setBulkEditFields({
												...bulkEditFields,
												area: e.target.checked
											}),
											className: "rounded border-gray-300 text-primary size-3.5"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Area (m²)" })]
									}), bulkEditFields.area && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: bulkEditValues.area,
										onChange: (e) => setBulkEditValues({
											...bulkEditValues,
											area: e.target.value
										}),
										placeholder: "e.g. 50",
										className: "h-8 px-2.5 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary mt-1"
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-5 py-3.5 border-t border-border bg-slate-50/50 dark:bg-slate-900/10 flex justify-end gap-2 shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setBulkEditOpen(false),
								className: "h-8 px-4 border border-border rounded-lg hover:bg-surface-2 text-xs font-semibold text-foreground cursor-pointer",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleBulkEditSave,
								className: "h-8 px-4 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-semibold rounded-lg shadow cursor-pointer",
								children: "Apply Changes"
							})]
						})
					]
				})
			})
		]
	});
}
function BulkBtn({ icon: Icon, onClick, children, disabled }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		disabled,
		onClick,
		className: "flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-bold text-slate-800 dark:text-slate-200 select-none shadow-xs transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3.5" }), children]
	});
}
//#endregion
export { PreliminaryCoolingLoadPage as component };
