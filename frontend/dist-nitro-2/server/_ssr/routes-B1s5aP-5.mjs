import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { a as getOccupancyData, c as predictOccupancyCategory, d as workspaceStore, i as getOccupancyCategories, l as predictSpacePressure, r as getCategoryDisplayName, t as calculateVentilation, u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { $ as Group, Et as ChevronUp, Gt as PenLine, M as Printer, N as Plus, Ot as ChevronDown, Rt as ArrowUpDown, Ut as TriangleAlert, Wt as Sparkles, Y as Info, Zt as Funnel, ct as Flag, et as GripVertical, in as CircleCheck, l as Upload, lt as FileText, m as Trash2, n as X, r as Wrench, rt as Gauge, xt as Copy, z as MessageSquare } from "../_libs/lucide-react.mjs";
import { a as usePrompt, i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as ContextMenuSeparator, c as DropdownMenu, d as DropdownMenuRadioGroup, f as DropdownMenuRadioItem, i as ContextMenuItem, l as DropdownMenuContent, m as DropdownMenuTrigger, o as ContextMenuShortcut, p as DropdownMenuSeparator, r as ContextMenuContent, t as AppShell, u as DropdownMenuLabel } from "./AppShell-Blf5aT0O.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { n as utils, t as readSync } from "../_libs/xlsx.mjs";
import { t as DataGrid } from "./DataGrid-Ct9FtLBj.mjs";
import { n as PopoverContent, r as PopoverTrigger, t as Popover } from "./popover-CxE9vQwv.mjs";
import { c as EditSpaceModal, t as CategorySelect } from "./EditSpaceModal-CopS08FD.mjs";
import { i as exportVentilationPDF, n as CalculationReviewBar, r as SharedAssignmentModal, t as AssignCommentModal } from "./AssignCommentModal-DRNS2V-I.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B1s5aP-5.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var $$splitComponentImporter = () => import("./routes-BLGP48cm.mjs");
var Route = createFileRoute("/")({
	head: () => ({ meta: [{ title: "MEP Calculator" }, {
		name: "description",
		content: "System-wide calculations metrics, active warnings, and project compliance."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var PRESSURE_MAP = {
	"Neutral": "0",
	"Positive": "1",
	"Negative": "-1",
	"Critical": "-2"
};
var REVERSE_PRESSURE_MAP = {
	"0": "Neutral",
	"1": "Positive",
	"-1": "Negative",
	"-2": "Critical"
};
var TABS = [
	{
		id: "spaces",
		label: "Spaces"
	},
	{
		id: "zones",
		label: "Zones"
	},
	{
		id: "equipment",
		label: "Equipment"
	},
	{
		id: "report",
		label: "Report"
	}
];
function VentilationModule() {
	const [tab, setTab] = (0, import_react.useState)("spaces");
	const [intelOpen, setIntelOpen] = (0, import_react.useState)(false);
	const { spaces, zones, equipment, activeProjectId, roundOffPreset, setRoundOffPreset } = useWorkspace();
	const totalArea = Math.round(spaces.reduce((sum, s) => sum + (s.area || 0) * (s.multiplier || 1), 0));
	Math.round(spaces.reduce((sum, s) => sum + (s.minOA || 0), 0));
	Math.round(spaces.reduce((sum, s) => sum + (s.minExt || 0), 0));
	const netFlow = spaces.reduce((sum, s) => sum + (s.freshAir || 0), 0) - spaces.reduce((sum, s) => sum + (s.extractAir || 0), 0);
	totalArea > 0 && netFlow / totalArea * 5.6;
	const [calcReviewState, setCalcReviewState] = (0, import_react.useState)(() => {
		if (typeof window !== "undefined" && activeProjectId) try {
			const saved = localStorage.getItem(`mep_calc_review_${activeProjectId}_/ventilation`);
			if (saved) return JSON.parse(saved);
		} catch (e) {}
		return { status: "DRAFT" };
	});
	Boolean(activeProjectId) && calcReviewState?.status;
	(0, import_react.useEffect)(() => {
		if (typeof window !== "undefined") {
			if (!activeProjectId) {
				setCalcReviewState({ status: "DRAFT" });
				window.__mep_is_readonly = false;
				return;
			}
			try {
				const saved = localStorage.getItem(`mep_calc_review_${activeProjectId}_/ventilation`);
				if (saved) {
					const parsed = JSON.parse(saved);
					setCalcReviewState(parsed);
					window.__mep_is_readonly = parsed.status === "APPROVED";
				} else {
					setCalcReviewState({ status: "DRAFT" });
					window.__mep_is_readonly = false;
				}
			} catch (e) {}
		}
	}, [activeProjectId]);
	(0, import_react.useEffect)(() => {
		if (typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		const targetType = (params.get("commentTargetType") || "").toLowerCase();
		const targetId = params.get("commentTargetId");
		const targetName = params.get("commentTargetName");
		if (targetType === "zone") setTab("zones");
		else if (targetType === "equipment") setTab("equipment");
		else if (targetType === "space") setTab("spaces");
		if (targetId || targetName) {
			const timer = setTimeout(() => {
				window.dispatchEvent(new CustomEvent("mep-scroll-to-item", { detail: {
					id: targetId,
					name: targetName
				} }));
			}, 450);
			return () => clearTimeout(timer);
		}
	}, [typeof window !== "undefined" ? window.location.search : ""]);
	(0, import_react.useEffect)(() => {
		const handleUpdate = (e) => {
			if (e.detail) {
				setCalcReviewState(e.detail);
				if (typeof window !== "undefined") window.__mep_is_readonly = e.detail.status === "APPROVED";
			}
		};
		if (typeof window !== "undefined") window.addEventListener("mep-review-state-updated", handleUpdate);
		return () => {
			if (typeof window !== "undefined") window.removeEventListener("mep-review-state-updated", handleUpdate);
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Ventilation",
		hideSubHeader: true,
		onIntelClick: () => setIntelOpen((v) => !v),
		intelOpen,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex h-full min-h-0 bg-transparent",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 min-w-0 flex flex-col pt-3 pb-3 gap-3 h-full overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-between items-start shrink-0 select-none no-print modal-blur-bg",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1 w-full",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
								children: "HVAC > VENTILATION"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3 mt-0.5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-baseline gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
											className: "text-[28px] font-bold tracking-tight text-foreground",
											children: "Ventilation"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[15px] font-semibold text-muted-foreground",
											children: [spaces.length, " spaces"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => setIntelOpen((v) => !v),
										className: `flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${intelOpen ? "bg-primary text-primary-foreground border-primary" : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }), "Intelligence"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalculationReviewBar, {
										projectId: activeProjectId,
										calculatorPath: "/ventilation",
										calculatorTitle: "Ventilation",
										onReviewStateChange: setCalcReviewState
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground mt-0.5",
								children: "Fresh air, extract, and pressure balance for every space in the project."
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `flex-1 flex flex-col min-h-0 overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative z-10 flex items-center justify-between px-4 py-2.5 bg-card shrink-0 select-none no-print border-b border-border/50",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80",
							children: TABS.map((t) => {
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setTab(t.id),
									className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${t.id === tab ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
									children: t.label
								}, t.id);
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2.5 select-none shrink-0 bg-slate-50/40 dark:bg-zinc-900/10 border border-slate-200/40 dark:border-zinc-800/40 px-3.5 py-1 rounded-full",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider",
								children: "ROUND-OFF:"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex bg-[#f1f5f9] dark:bg-zinc-800/60 p-0.5 rounded-full border border-slate-200/40 dark:border-zinc-700/40 shadow-xs",
								children: [
									.5,
									1,
									5
								].map((preset) => {
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => setRoundOffPreset(preset),
										className: `px-3.5 py-1.5 text-[11px] font-bold rounded-full transition-all duration-150 cursor-pointer ${(roundOffPreset ?? 5) === preset ? "bg-white dark:bg-zinc-900 text-slate-850 dark:text-zinc-150 shadow-xs border border-slate-200/20 dark:border-zinc-800/20" : "text-slate-500 dark:text-zinc-400 hover:text-slate-850 dark:hover:text-zinc-150"}`,
										children: [preset, " L/s"]
									}, preset);
								})
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 min-h-0 animate-fade-in flex flex-col",
						children: [
							tab === "spaces" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpacesView, {}),
							tab === "zones" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZonesView, {}),
							tab === "equipment" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentView, {}),
							tab === "report" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportView, {})
						]
					}, tab)]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"}`,
				children: intelOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IntelligenceDrawer, {
					onClose: () => setIntelOpen(false),
					setTab
				})
			})]
		})
	});
}
function InlineInput({ value, onCommit, className = "", type = "text", step, min, placeholder }) {
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
		placeholder,
		value: localVal,
		onChange: (e) => setLocalVal(e.target.value),
		onBlur: () => {
			if (localVal !== String(value)) onCommit(localVal);
		},
		onKeyDown: handleKeyDown,
		onClick: (e) => e.stopPropagation(),
		onDoubleClick: (e) => e.stopPropagation(),
		className: `bg-transparent w-full border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-foreground transition-colors cursor-text ${className}`
	});
}
function SpacesView() {
	const [selected, setSelected] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [query, setQuery] = (0, import_react.useState)("");
	const [activeFilter, setActiveFilter] = (0, import_react.useState)(null);
	const { spaces, zones, equipment, updateSpaces, addSpace, addZone, addEquipment, deleteSpaces, addSpacesBulk, bulkUpdateSpaces, mergeSpaces, autoZoneSpaces, createNewProject, clearWorkspace, copySpaces, cutSpaces, pasteSpaces, setWorkspaceState, undo, redo } = useWorkspace();
	const [selectedBuilding, setSelectedBuilding] = (0, import_react.useState)(null);
	const [selectedFloor, setSelectedFloor] = (0, import_react.useState)(null);
	const [selectedZone, setSelectedZone] = (0, import_react.useState)(null);
	const [selectedCategory, setSelectedCategory] = (0, import_react.useState)(null);
	const activeFiltersCount = (0, import_react.useMemo)(() => {
		let count = 0;
		if (selectedBuilding) count++;
		if (selectedFloor) count++;
		if (selectedZone) count++;
		if (selectedCategory) count++;
		return count;
	}, [
		selectedBuilding,
		selectedFloor,
		selectedZone,
		selectedCategory
	]);
	const handleResetFilters = () => {
		setSelectedBuilding(null);
		setSelectedFloor(null);
		setSelectedZone(null);
		setSelectedCategory(null);
	};
	const [savedViews, setSavedViews] = (0, import_react.useState)(() => {
		try {
			const stored = localStorage.getItem("mep-saved-views");
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	});
	const [floorOrder, setFloorOrder] = (0, import_react.useState)(() => {
		try {
			const stored = localStorage.getItem("mep-floor-order");
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	});
	const [draggingIndex, setDraggingIndex] = (0, import_react.useState)(null);
	const allUniqueFloors = (0, import_react.useMemo)(() => {
		const vals = /* @__PURE__ */ new Set();
		spaces.forEach((s) => {
			if (s.floor) vals.add(s.floor);
		});
		return Array.from(vals).sort();
	}, [spaces]);
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
		localStorage.setItem("mep-floor-order", JSON.stringify(nextList));
	};
	const handleDragEnd = () => {
		setDraggingIndex(null);
	};
	const handleResetFloorOrder = () => {
		setFloorOrder([]);
		localStorage.removeItem("mep-floor-order");
	};
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape") {
				const activeEl = document.activeElement;
				if (!(activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT" || activeEl.tagName === "TEXTAREA" || activeEl.getAttribute("contenteditable") === "true"))) setSelected(/* @__PURE__ */ new Set());
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [setSelected]);
	const confirm = useConfirm();
	const prompt = usePrompt();
	const fileInputRef = (0, import_react.useRef)(null);
	const [editingSpace, setEditingSpace] = (0, import_react.useState)(null);
	const [assignCommentOpen, setAssignCommentOpen] = (0, import_react.useState)(false);
	const [commentTarget, setCommentTarget] = (0, import_react.useState)(null);
	const [newProjectOpen, setNewProjectOpen] = (0, import_react.useState)(false);
	const [newProjectValues, setNewProjectValues] = (0, import_react.useState)({
		name: "Marina Bay Tower",
		code: "MBT-2026-117",
		client: "Marina Holdings"
	});
	const [importOpen, setImportOpen] = (0, import_react.useState)(false);
	const [pendingRecords, setPendingRecords] = (0, import_react.useState)([]);
	const [selectedPending, setSelectedPending] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [lastClickedPendingIndex, setLastClickedPendingIndex] = (0, import_react.useState)(null);
	const [importBulkValues, setImportBulkValues] = (0, import_react.useState)({
		level: "",
		zone: "",
		category: "",
		pressure: "",
		height: "",
		fixtures: "",
		multiplier: ""
	});
	(0, import_react.useEffect)(() => {
		if (importOpen && pendingRecords.length === 0) {
			const timer = setTimeout(() => {
				if (fileInputRef.current) fileInputRef.current.click();
			}, 150);
			return () => clearTimeout(timer);
		}
	}, [importOpen, pendingRecords.length]);
	const [bulkEditOpen, setBulkEditOpen] = (0, import_react.useState)(false);
	const [bulkEditValues, setBulkEditValues] = (0, import_react.useState)({
		building: "",
		floor: "",
		category: "",
		pressure: "",
		area: "",
		height: "",
		fixtures: "",
		multiplier: "",
		zone: "",
		equipment: ""
	});
	const [bulkEditFields, setBulkEditFields] = (0, import_react.useState)({
		building: false,
		floor: false,
		category: false,
		pressure: false,
		area: false,
		height: false,
		fixtures: false,
		multiplier: false,
		zone: false,
		equipment: false
	});
	const [customParamModalSpace, setCustomParamModalSpace] = (0, import_react.useState)(null);
	const [restroomModalSpace, setRestroomModalSpace] = (0, import_react.useState)(null);
	const [assignZoneOpen, setAssignZoneOpen] = (0, import_react.useState)(false);
	const [targetZone, setTargetZone] = (0, import_react.useState)("");
	const [assignEquipOpen, setAssignEquipOpen] = (0, import_react.useState)(false);
	const [targetEquip, setTargetEquip] = (0, import_react.useState)("");
	const [mergeOpen, setMergeOpen] = (0, import_react.useState)(false);
	const [mergeName, setMergeName] = (0, import_react.useState)("");
	const [primarySpaceId, setPrimarySpaceId] = (0, import_react.useState)("");
	const [autoZoneFloorSelectOpen, setAutoZoneFloorSelectOpen] = (0, import_react.useState)(false);
	const [autoZoneAvailableFloors, setAutoZoneAvailableFloors] = (0, import_react.useState)([]);
	const [autoZoneSelectedFloors, setAutoZoneSelectedFloors] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [autoZoneConfirmOpen, setAutoZoneConfirmOpen] = (0, import_react.useState)(false);
	const [autoZoneSpacesToProcess, setAutoZoneSpacesToProcess] = (0, import_react.useState)([]);
	const [autoZoneIgnoredCount, setAutoZoneIgnoredCount] = (0, import_react.useState)(0);
	const parseExcelFile = (file) => {
		const reader = new FileReader();
		reader.onload = async (evt) => {
			try {
				const workbook = readSync(new Uint8Array(evt.target?.result), { type: "array" });
				const firstSheetName = workbook.SheetNames[0];
				const worksheet = workbook.Sheets[firstSheetName];
				const jsonData = utils.sheet_to_json(worksheet, { header: 1 });
				if (jsonData.length === 0) {
					await confirm("Empty file!", {
						title: "Import Error",
						confirmText: "OK",
						hideCancel: true
					});
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
							"zone",
							"name",
							"area",
							"room: unbounded height",
							"unbounded height",
							"number of people",
							"occupants",
							"fixtures",
							"fixtures/occupancy",
							"occupancy"
						];
						if (rowNormalized.some((cell) => possibleHeaders.includes(cell))) {
							headerRowIndex = r;
							headers = rowNormalized;
							break;
						}
					}
				}
				if (headerRowIndex === -1) {
					await confirm("Missing header row! Excel must contain columns: Level, Zone, Name, Area.", {
						title: "Import Error",
						confirmText: "OK",
						hideCancel: true
					});
					return;
				}
				const idxLevel = headers.indexOf("level");
				const idxZone = headers.indexOf("zone");
				const idxName = headers.indexOf("name");
				const idxArea = headers.indexOf("area");
				let idxHeight = headers.indexOf("room: unbounded height");
				if (idxHeight === -1) idxHeight = headers.indexOf("unbounded height");
				let idxPeople = headers.indexOf("number of people");
				if (idxPeople === -1) idxPeople = headers.indexOf("occupants");
				if (idxPeople === -1) idxPeople = headers.indexOf("fixtures");
				if (idxPeople === -1) idxPeople = headers.indexOf("fixtures/occupancy");
				if (idxPeople === -1) idxPeople = headers.indexOf("occupancy");
				if (idxLevel === -1 || idxName === -1 || idxArea === -1) {
					await confirm("Missing Level, Name, or Area columns.", {
						title: "Import Error",
						confirmText: "OK",
						hideCancel: true
					});
					return;
				}
				const parsed = [];
				for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
					const row = jsonData[r];
					if (!row || row.length === 0) continue;
					const levelVal = String(row[idxLevel] || "").trim();
					const nameVal = String(row[idxName] || "").trim();
					const zoneVal = String(row[idxZone] || "").trim();
					if (!nameVal) continue;
					const areaCleaned = String(row[idxArea] || "").trim().replace(/[^\d\.]/g, "");
					const area = parseFloat(areaCleaned) || 0;
					let height = 3;
					if (idxHeight !== -1) {
						const heightCleaned = String(row[idxHeight] || "").trim().replace(/[^\d\.]/g, "");
						let hVal = parseFloat(heightCleaned) || 3;
						if (hVal > 100) hVal = hVal / 1e3;
						height = Math.round(hVal * 100) / 100;
					}
					let fixtures = "";
					if (idxPeople !== -1) {
						const peopleCleaned = String(row[idxPeople] || "").trim().replace(/[^\d]/g, "");
						fixtures = peopleCleaned === "" ? "" : parseInt(peopleCleaned).toString();
					}
					const zoneName = zoneVal || "Default";
					const predCat = predictOccupancyCategory(nameVal);
					const predPress = predictSpacePressure(predCat.category || "");
					parsed.push({
						id: `pending-${r}-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
						level: levelVal,
						zone: zoneName,
						name: nameVal,
						category: predCat.category || "",
						aiDetected: !!predCat.category,
						confidence: predCat.confidence,
						pressure: predPress.pressure,
						pressureAutoDetected: predPress.autoDetected,
						area,
						height,
						fixtures,
						multiplier: 1
					});
				}
				setPendingRecords(parsed);
				setSelectedPending(new Set(parsed.map((p) => p.id)));
			} catch (err) {
				console.error(err);
				await confirm("Failed to parse Excel file.", {
					title: "Import Error",
					confirmText: "OK",
					hideCancel: true
				});
			}
		};
		reader.readAsArrayBuffer(file);
	};
	const handleFileUpload = (e) => {
		const file = e.target.files?.[0];
		if (file) parseExcelFile(file);
	};
	const handleFileDrop = async (e) => {
		e.preventDefault();
		const file = e.dataTransfer.files?.[0];
		if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) parseExcelFile(file);
		else if (file) await confirm("Invalid file type. Please upload an Excel sheet (.xlsx, .xls).", {
			title: "Invalid File",
			confirmText: "OK",
			hideCancel: true
		});
	};
	const handlePendingBulkApply = () => {
		setPendingRecords((prev) => prev.map((rec) => {
			if (selectedPending.has(rec.id)) return {
				...rec,
				level: importBulkValues.level || rec.level,
				zone: importBulkValues.zone || rec.zone,
				category: importBulkValues.category || rec.category,
				aiDetected: importBulkValues.category ? false : rec.aiDetected,
				pressure: importBulkValues.pressure || rec.pressure,
				pressureAutoDetected: importBulkValues.pressure ? false : rec.pressureAutoDetected,
				height: importBulkValues.height ? parseFloat(importBulkValues.height) || rec.height : rec.height,
				fixtures: importBulkValues.fixtures !== "" ? importBulkValues.fixtures : rec.fixtures,
				multiplier: importBulkValues.multiplier ? parseInt(importBulkValues.multiplier) || rec.multiplier : rec.multiplier
			};
			return rec;
		}));
	};
	const togglePending = (id, isShift, isCtrl) => {
		setSelectedPending((prev) => {
			const clickedIndex = pendingRecords.findIndex((r) => r.id === id);
			if (clickedIndex === -1) return prev;
			const next = new Set(prev);
			if (isShift && lastClickedPendingIndex !== null) {
				const start = Math.min(lastClickedPendingIndex, clickedIndex);
				const end = Math.max(lastClickedPendingIndex, clickedIndex);
				if (!isCtrl) next.clear();
				const shouldSelect = prev.has(pendingRecords[lastClickedPendingIndex]?.id || "") || true;
				for (let i = start; i <= end; i++) {
					const recId = pendingRecords[i]?.id;
					if (recId) if (shouldSelect) next.add(recId);
					else next.delete(recId);
				}
			} else if (isCtrl) {
				if (next.has(id)) next.delete(id);
				else next.add(id);
				setLastClickedPendingIndex(clickedIndex);
			} else {
				next.clear();
				next.add(id);
				setLastClickedPendingIndex(clickedIndex);
			}
			return next;
		});
	};
	const handleCommitImports = async () => {
		const toImport = pendingRecords.filter((rec) => selectedPending.has(rec.id));
		if (toImport.length === 0) {
			await confirm("No records selected!", {
				title: "Selection Required",
				confirmText: "OK",
				hideCancel: true
			});
			return;
		}
		clearWorkspace();
		addSpacesBulk(toImport.map((rec, index) => {
			const code = `${rec.level}-${rec.zone}-${String(index + 1).padStart(3, "0")}`;
			const parsedFixtures = rec.fixtures !== "" && rec.fixtures !== void 0 && rec.fixtures !== null ? parseInt(rec.fixtures) : NaN;
			const data = getOccupancyData(rec.category);
			const defaultOcc = data ? data.exhaustPerUnit > 0 && data.defaultDensity === 0 ? 1 : Math.ceil(rec.area * data.defaultDensity / 100) : 8;
			const occupancy = !isNaN(parsedFixtures) ? parsedFixtures : defaultOcc;
			return {
				id: `sp-${Date.now()}-${index}`,
				code,
				name: rec.name,
				building: "Tower A",
				floor: rec.level,
				zone: rec.zone,
				category: rec.category,
				area: rec.area,
				occupancy,
				freshAir: 0,
				extractAir: 0,
				pressure: rec.pressure,
				equipment: "",
				status: "complete",
				height: rec.height,
				fixtures: rec.fixtures,
				multiplier: rec.multiplier,
				aiDetected: rec.aiDetected,
				pressureAutoDetected: rec.pressureAutoDetected
			};
		}));
		setPendingRecords([]);
		setSelectedPending(/* @__PURE__ */ new Set());
		setImportOpen(false);
	};
	const validateSpacesForAutoZoning = async (spacesToValidate) => {
		const invalidSpaces = spacesToValidate.filter((s) => {
			const hasCategory = s.category && s.category.trim() !== "";
			const areaVal = parseFloat(String(s.area));
			const hasArea = !isNaN(areaVal) && areaVal > 0;
			const heightVal = parseFloat(String(s.height));
			const hasHeight = !isNaN(heightVal) && heightVal > 0;
			const multVal = parseFloat(String(s.multiplier));
			return !hasCategory || !hasArea || !hasHeight || !(!isNaN(multVal) && multVal > 0);
		});
		if (invalidSpaces.length > 0) {
			await confirm(`Auto-zoning stopped. The following spaces must have Category, Area, Height, and Multiplier filled with valid positive values:\n\n${invalidSpaces.map((s) => {
				const missing = [];
				if (!s.category || s.category.trim() === "") missing.push("Category");
				const areaVal = parseFloat(String(s.area));
				if (isNaN(areaVal) || areaVal <= 0) missing.push("Area");
				const heightVal = parseFloat(String(s.height));
				if (isNaN(heightVal) || heightVal <= 0) missing.push("Height");
				const multVal = parseFloat(String(s.multiplier));
				if (isNaN(multVal) || multVal <= 0) missing.push("Multiplier");
				return `- ${s.name} (${s.floor || "L01"}): Missing ${missing.join(", ")}`;
			}).join("\n")}`, {
				title: "Incomplete Parameters",
				confirmText: "OK",
				hideCancel: true
			});
			return false;
		}
		return true;
	};
	const triggerAutoZoning = async (spacesToConsider) => {
		const floors = Array.from(new Set(spaces.map((s) => s.floor || "L01"))).sort((a, b) => a.localeCompare(b, void 0, { numeric: true }));
		if (floors.length === 0) {
			await confirm("No floors found in the project.", {
				title: "Validation Error",
				confirmText: "OK",
				hideCancel: true
			});
			return;
		}
		setAutoZoneAvailableFloors(floors);
		setAutoZoneSelectedFloors(new Set(floors));
		setAutoZoneFloorSelectOpen(true);
	};
	const handleFloorSelectProceed = async () => {
		if (autoZoneSelectedFloors.size === 0) {
			await confirm("Please select at least one floor.", {
				title: "Validation Error",
				confirmText: "OK",
				hideCancel: true
			});
			return;
		}
		const selectedFloorsArr = Array.from(autoZoneSelectedFloors);
		const unzonedNegOrNeutral = spaces.filter((s) => {
			if (!autoZoneSelectedFloors.has(s.floor || "L01")) return false;
			const isUnzoned = !s.zone || s.zone.trim() === "" || s.zone.toLowerCase() === "default" || s.zone.toLowerCase() === "unzoned" || !zones.some((z) => z.id === s.zone || z.name === s.zone);
			const isNotPositive = s.pressure !== "Positive";
			return isUnzoned && isNotPositive;
		});
		if (unzonedNegOrNeutral.length > 0) {
			await confirm(`Auto-zoning stopped. The following unzoned neutral/negative spaces on the selected floor(s) must be manually zoned with a positive space:\n\n${unzonedNegOrNeutral.map((s) => `- ${s.name} (${s.floor || "L01"}) [${s.pressure || "Neutral"} Pressure]`).join("\n")}`, {
				title: "Validation Error",
				confirmText: "OK",
				hideCancel: true
			});
			return;
		}
		const eligible = spaces.filter((s) => {
			if (!autoZoneSelectedFloors.has(s.floor || "L01")) return false;
			const isPositive = s.pressure === "Positive";
			const isUnzoned = !s.zone || s.zone.trim() === "" || s.zone.toLowerCase() === "default" || s.zone.toLowerCase() === "unzoned" || !zones.some((z) => z.id === s.zone || z.name === s.zone);
			return isPositive && isUnzoned;
		});
		if (eligible.length === 0) {
			await confirm("No eligible positive-pressure, unzoned spaces found on the selected floor(s).", {
				title: "Validation Error",
				confirmText: "OK",
				hideCancel: true
			});
			return;
		}
		if (!await validateSpacesForAutoZoning(eligible)) return;
		const nextZones = [...zones];
		const nextSpaces = spaces.map((s) => ({ ...s }));
		eligible.forEach((s) => {
			const zoneId = `zone-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
			const baseName = `${s.name} Zone`;
			let uniqueName = baseName;
			let counter = 1;
			while (nextZones.some((z) => z.name.toLowerCase() === uniqueName.toLowerCase())) uniqueName = `${baseName} ${counter++}`;
			const newZone = {
				id: zoneId,
				name: uniqueName,
				building: s.building || "Tower A",
				floor: s.floor || "L01",
				spaceCount: 1,
				area: s.area || 0,
				freshAir: 0,
				extractAir: 0,
				pressure: 0,
				equipment: [],
				pressureType: "positive",
				faAssignment: null,
				eaAssignment: null
			};
			nextZones.push(newZone);
			const targetSpace = nextSpaces.find((sp) => sp.id === s.id);
			if (targetSpace) targetSpace.zone = uniqueName;
		});
		setWorkspaceState({
			spaces: nextSpaces,
			zones: nextZones,
			equipment
		});
		setAutoZoneFloorSelectOpen(false);
		setAutoZoneSpacesToProcess([]);
		setAutoZoneIgnoredCount(0);
		setSelected(/* @__PURE__ */ new Set());
		await confirm(`Successfully created ${eligible.length} zone(s) on floor(s): ${selectedFloorsArr.join(", ")}.`, {
			title: "Auto-Zoning Complete",
			confirmText: "OK",
			hideCancel: true
		});
	};
	const handleBulkEditApply = async () => {
		const spaceIds = Array.from(selected);
		if (bulkEditFields.zone && bulkEditValues.zone) {
			const trimmedZone = bulkEditValues.zone.trim();
			const selectedSpaces = spaces.filter((s) => spaceIds.includes(s.id));
			const uniqueFloors = Array.from(new Set(selectedSpaces.map((s) => s.floor || "Unassigned")));
			if (uniqueFloors.length > 1) {
				await confirm(`Spaces from different floors cannot be grouped into the same zone.\n\nSelected spaces belong to multiple floors: (${uniqueFloors.join(", ")}). Please select spaces from the same floor only.`, {
					title: "Multi-Floor Zone Error",
					confirmText: "OK",
					hideCancel: true
				});
				return;
			}
			const existingZone = zones.find((z) => z.name.toLowerCase() === trimmedZone.toLowerCase());
			if (existingZone && selectedSpaces[0]?.floor && existingZone.floor !== selectedSpaces[0].floor) {
				await confirm(`Zone "${existingZone.name}" already exists on floor ${existingZone.floor}.\n\nSpaces from ${selectedSpaces[0].floor} cannot be assigned to a zone on ${existingZone.floor}.`, {
					title: "Zone Floor Mismatch",
					confirmText: "OK",
					hideCancel: true
				});
				return;
			}
			const finalZoneName = existingZone?.name || trimmedZone;
			const finalSpacesInZone = spaces.map((s) => {
				if (spaceIds.includes(s.id)) return {
					...s,
					zone: finalZoneName,
					category: bulkEditFields.category ? bulkEditValues.category : s.category,
					area: s.area,
					pressure: bulkEditFields.pressure ? bulkEditValues.pressure : s.pressure
				};
				return s;
			}).filter((s) => s.zone === finalZoneName);
			if (finalSpacesInZone.some((s) => !s.category || s.category.trim() === "" || !s.area || s.area <= 0)) {
				await confirm("Cannot assign zone: Category and Area are compulsory for all spaces in the zone.", {
					title: "Validation Error",
					confirmText: "OK",
					hideCancel: true
				});
				return;
			}
			if (!finalSpacesInZone.some((s) => s.pressure === "Positive")) {
				await confirm("Cannot form zone: A zone must contain at least one positive-pressure space.", {
					title: "Validation Error",
					confirmText: "OK",
					hideCancel: true
				});
				return;
			}
			const spacesAlreadyInZone = selectedSpaces.filter((s) => s.zone && s.zone.trim() !== "" && s.zone.toLowerCase() !== finalZoneName.toLowerCase());
			if (spacesAlreadyInZone.length > 0) {
				if (!await confirm(spacesAlreadyInZone.length === 1 ? `Space "${spacesAlreadyInZone[0].name}" is already assigned to zone "${spacesAlreadyInZone[0].zone}". Do you want to reassign it to zone "${finalZoneName}"?` : `${spacesAlreadyInZone.length} spaces are already assigned to other zones (e.g. "${spacesAlreadyInZone[0].name}" in "${spacesAlreadyInZone[0].zone}"). Do you want to reassign them to zone "${finalZoneName}"?`, {
					title: "Reassign Zone?",
					confirmText: "Reassign",
					cancelText: "Cancel"
				})) return;
			}
			if (!zones.some((z) => z.name.toLowerCase() === trimmedZone.toLowerCase())) {
				const firstSpace = selectedSpaces[0];
				const building = firstSpace?.building || "Tower A";
				const floor = firstSpace?.floor || "L01";
				addZone({
					id: `zone-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
					name: trimmedZone,
					building,
					floor,
					spaceCount: 0,
					area: 0,
					freshAir: 0,
					extractAir: 0,
					pressure: 0,
					equipment: [],
					pressureType: "neutral"
				});
			}
		}
		if (bulkEditFields.equipment && bulkEditValues.equipment.trim()) {
			if (!equipment.some((e) => e.tag.toLowerCase() === bulkEditValues.equipment.trim().toLowerCase())) addEquipment({
				id: `equip-${Date.now()}`,
				tag: bulkEditValues.equipment.trim(),
				type: "AHU",
				zones: 0,
				spaces: 0,
				totalAirflow: 0,
				capacity: 1e3,
				utilization: 0,
				status: "design",
				zoneIds: []
			});
		}
		const changedSpaces = spaces.map((s) => {
			if (spaceIds.includes(s.id)) {
				const nextSpace = { ...s };
				if (bulkEditFields.building) nextSpace.building = bulkEditValues.building.trim();
				if (bulkEditFields.floor) nextSpace.floor = bulkEditValues.floor.trim();
				if (bulkEditFields.area) nextSpace.area = parseFloat(bulkEditValues.area) || 10;
				if (bulkEditFields.category) {
					const categoryVal = bulkEditValues.category;
					nextSpace.category = categoryVal;
					nextSpace.aiDetected = false;
					if (categoryVal === "Other" || categoryVal === "OTHER" || categoryVal.endsWith(" (Custom)")) nextSpace.category = categoryVal === "Other" || categoryVal === "OTHER" ? "Custom (Custom)" : categoryVal;
					else if (categoryVal) {
						const data = getOccupancyData(categoryVal);
						if (data && !nextSpace.isOccupancyCustomized) {
							const defaultOcc = data.exhaustPerUnit > 0 && data.defaultDensity === 0 ? 1 : Math.ceil(nextSpace.area * data.defaultDensity / 100);
							nextSpace.occupancy = defaultOcc;
							nextSpace.fixtures = data.exhaustPerUnit > 0 ? defaultOcc.toString() : "";
						}
					} else nextSpace.category = "";
				} else if (bulkEditFields.area) {
					if (nextSpace.category && !nextSpace.isOccupancyCustomized) {
						const data = getOccupancyData(nextSpace.category);
						if (data) {
							const defaultOcc = data.exhaustPerUnit > 0 && data.defaultDensity === 0 ? 1 : Math.ceil(nextSpace.area * data.defaultDensity / 100);
							nextSpace.occupancy = defaultOcc;
							nextSpace.fixtures = data.exhaustPerUnit > 0 ? defaultOcc.toString() : "";
						}
					}
				}
				if (bulkEditFields.pressure) {
					nextSpace.pressure = bulkEditValues.pressure;
					nextSpace.pressureAutoDetected = false;
				}
				if (bulkEditFields.height) nextSpace.height = parseFloat(bulkEditValues.height) || 3;
				if (bulkEditFields.fixtures) {
					const fixturesVal = bulkEditValues.fixtures.trim();
					nextSpace.fixtures = fixturesVal;
					if (nextSpace.category) {
						const data = getOccupancyData(nextSpace.category);
						if (data) nextSpace.occupancy = fixturesVal === "" ? Math.ceil(s.area * (data.defaultDensity || 0) / 100) : parseFloat(fixturesVal) || 0;
						else nextSpace.occupancy = fixturesVal === "" ? 0 : parseFloat(fixturesVal) || 0;
					} else nextSpace.occupancy = fixturesVal === "" ? 0 : parseFloat(fixturesVal) || 0;
				}
				if (bulkEditFields.multiplier) nextSpace.multiplier = parseInt(bulkEditValues.multiplier) || 1;
				if (bulkEditFields.zone) {
					const trimmedZone = bulkEditValues.zone.trim();
					if (trimmedZone) nextSpace.zone = zones.find((z) => z.name.toLowerCase() === trimmedZone.toLowerCase())?.name || trimmedZone;
					else nextSpace.zone = "";
				}
				if (bulkEditFields.equipment) {
					const trimmedEquip = bulkEditValues.equipment.trim();
					if (trimmedEquip) nextSpace.equipment = equipment.find((e) => e.tag.toLowerCase() === trimmedEquip.toLowerCase())?.tag || trimmedEquip;
					else nextSpace.equipment = "";
				}
				return nextSpace;
			}
			return s;
		}).filter((s) => spaceIds.includes(s.id));
		updateSpaces(changedSpaces);
		setBulkEditOpen(false);
		if (bulkEditFields.category && bulkEditValues.category === "Rest Room / Changing Room") {
			const firstUpdated = changedSpaces[0];
			if (firstUpdated) setTimeout(() => {
				setRestroomModalSpace({
					...firstUpdated,
					restroomSubCategories: firstUpdated.restroomSubCategories || {
						toiletPrivateContinuous: 0,
						toiletPublicContinuous: 0,
						toiletPrivateDiscontinuous: 0,
						toiletPublicDiscontinuous: 0,
						showerContinuous: 0,
						showerDiscontinuous: 0,
						janitorCloset: 0,
						lockerRoom: 0
					}
				});
			}, 50);
		} else setSelected(/* @__PURE__ */ new Set());
	};
	const handleAssignZoneApply = async () => {
		const trimmedZone = targetZone.trim();
		if (!trimmedZone) {
			await confirm("Please select or enter a zone name.", {
				title: "Validation Error",
				confirmText: "OK",
				hideCancel: true
			});
			return;
		}
		const selectedSpaces = spaces.filter((s) => Array.from(selected).includes(s.id));
		const uniqueFloors = Array.from(new Set(selectedSpaces.map((s) => s.floor || "Unassigned")));
		if (uniqueFloors.length > 1) {
			await confirm(`Spaces from different floors cannot be grouped into the same zone.\n\nSelected spaces belong to multiple floors: (${uniqueFloors.join(", ")}). Please select spaces from the same floor only.`, {
				title: "Multi-Floor Zone Error",
				confirmText: "OK",
				hideCancel: true
			});
			return;
		}
		if (selectedSpaces.some((s) => !s.category || s.category.trim() === "" || !s.area || s.area <= 0)) {
			await confirm("Cannot form zone: Category and Area are compulsory for all selected spaces.", {
				title: "Validation Error",
				confirmText: "OK",
				hideCancel: true
			});
			return;
		}
		const existingZone = zones.find((z) => z.name.toLowerCase() === trimmedZone.toLowerCase());
		const spaceWithZone = spaces.find((s) => s.zone && s.zone.toLowerCase() === trimmedZone.toLowerCase());
		const exists = !!existingZone || !!spaceWithZone;
		const finalZoneName = existingZone?.name || spaceWithZone?.zone || trimmedZone;
		if (exists) {
			const existingZoneFloor = existingZone?.floor || spaceWithZone?.floor;
			const currentSpaceFloor = selectedSpaces[0]?.floor;
			if (existingZoneFloor && currentSpaceFloor && existingZoneFloor !== currentSpaceFloor) {
				await confirm(`Zone "${finalZoneName}" already exists on floor ${existingZoneFloor}.\n\nSpaces from ${currentSpaceFloor} cannot be assigned to a zone on ${existingZoneFloor}.`, {
					title: "Zone Floor Mismatch",
					confirmText: "OK",
					hideCancel: true
				});
				return;
			}
		}
		const spacesAlreadyInZone = selectedSpaces.filter((s) => s.zone && s.zone.trim() !== "" && s.zone.toLowerCase() !== finalZoneName.toLowerCase());
		if (spacesAlreadyInZone.length > 0) {
			if (!await confirm(spacesAlreadyInZone.length === 1 ? `Space "${spacesAlreadyInZone[0].name}" is already assigned to zone "${spacesAlreadyInZone[0].zone}". Do you want to reassign it to zone "${finalZoneName}"?` : `${spacesAlreadyInZone.length} spaces are already assigned to other zones (e.g. "${spacesAlreadyInZone[0].name}" in "${spacesAlreadyInZone[0].zone}"). Do you want to reassign them to zone "${finalZoneName}"?`, {
				title: "Reassign Zone?",
				confirmText: "Reassign",
				cancelText: "Cancel"
			})) return;
		}
		if (!spaces.map((s) => {
			if (Array.from(selected).includes(s.id)) return {
				...s,
				zone: finalZoneName
			};
			return s;
		}).filter((s) => s.zone === finalZoneName).some((s) => s.pressure === "Positive")) {
			await confirm("Cannot form zone: A zone must contain at least one positive-pressure space.", {
				title: "Validation Error",
				confirmText: "OK",
				hideCancel: true
			});
			return;
		}
		if (!exists) {
			const firstSpace = selectedSpaces[0];
			const building = firstSpace?.building || "Tower A";
			const floor = firstSpace?.floor || "L01";
			addZone({
				id: `zone-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
				name: trimmedZone,
				building,
				floor,
				spaceCount: 0,
				area: 0,
				freshAir: 0,
				extractAir: 0,
				pressure: 0,
				equipment: [],
				pressureType: "neutral"
			});
		}
		bulkUpdateSpaces(Array.from(selected), { zone: finalZoneName });
		setAssignZoneOpen(false);
		setSelected(/* @__PURE__ */ new Set());
	};
	const handleAssignEquipApply = () => {
		bulkUpdateSpaces(Array.from(selected), { equipment: targetEquip });
		setAssignEquipOpen(false);
		setSelected(/* @__PURE__ */ new Set());
	};
	const handleMergeSpacesApply = async () => {
		if (!mergeName) {
			await confirm("Please enter a name for the merged space.", {
				title: "Required Field",
				confirmText: "OK",
				hideCancel: true
			});
			return;
		}
		mergeSpaces(Array.from(selected), primarySpaceId, mergeName);
		setMergeOpen(false);
		setSelected(/* @__PURE__ */ new Set());
	};
	const renderSpaceContextMenu = (row) => {
		const isMulti = selected.size > 1;
		const selectedIds = selected.has(row.id) ? Array.from(selected) : [row.id];
		const targetsCount = selectedIds.length;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuContent, {
			className: "w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground",
			children: [
				isMulti ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: () => {
						setBulkEditValues({
							building: "",
							floor: "",
							category: "",
							pressure: "",
							area: "",
							height: "",
							fixtures: "",
							multiplier: "",
							zone: "",
							equipment: ""
						});
						setBulkEditFields({
							building: false,
							floor: false,
							category: false,
							pressure: false,
							area: false,
							height: false,
							fixtures: false,
							multiplier: false,
							zone: false,
							equipment: false
						});
						setBulkEditOpen(true);
					},
					className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						"Bulk Edit (",
						targetsCount,
						" spaces)"
					] })]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: () => setEditingSpace(row),
					className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5 text-muted-foreground" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Edit Space" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuShortcut, {
							className: "text-[10px] text-muted-foreground font-mono ml-auto",
							children: "Double Click"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: () => {
						const clones = selectedIds.map((id, index) => {
							const targetRow = spaces.find((s) => s.id === id);
							if (!targetRow) return null;
							return {
								...targetRow,
								id: `sp-${Date.now()}-${index}-${Math.random()}`,
								code: `${targetRow.code}-CLONE`,
								name: `${targetRow.name} (Clone)`
							};
						}).filter(Boolean);
						if (clones.length > 0) addSpacesBulk(clones);
					},
					className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: isMulti ? "Duplicate Selected" : "Duplicate Space" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: () => {
						setCommentTarget({
							id: row.id,
							name: row.name,
							type: "space"
						});
						setAssignCommentOpen(true);
					},
					className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Add comment" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, { className: "h-px bg-border my-1" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: async () => {
						const targets = selected.has(row.id) ? Array.from(selected) : [row.id];
						const selectedSpaces = spaces.filter((s) => targets.includes(s.id));
						if (selectedSpaces.some((s) => !s.category || s.category.trim() === "" || !s.area || s.area <= 0)) {
							await confirm("Cannot form zone: Category and Area are compulsory for all selected spaces.", {
								title: "Validation Error",
								confirmText: "OK",
								hideCancel: true
							});
							return;
						}
						if (!selectedSpaces.some((s) => s.pressure === "Positive")) {
							await confirm("Cannot form zone: A zone must contain at least one positive-pressure space.", {
								title: "Validation Error",
								confirmText: "OK",
								hideCancel: true
							});
							return;
						}
						if (!selected.has(row.id)) setSelected(/* @__PURE__ */ new Set([row.id]));
						setAssignZoneOpen(true);
					},
					className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Group, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Assign Zone" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: () => {
						if (!selected.has(row.id)) setSelected(/* @__PURE__ */ new Set([row.id]));
						setAssignEquipOpen(true);
					},
					className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Assign Equipment" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: () => {
						const targets = selected.has(row.id) ? Array.from(selected) : [row.id];
						triggerAutoZoning(spaces.filter((s) => targets.includes(s.id)));
					},
					className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Auto-Zone" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					disabled: !isMulti,
					onClick: () => {
						setMergeName((selectedIds.map((id) => spaces.find((s) => s.id === id)?.name).filter(Boolean)[0] || "Merged Space") + " (Merged)");
						setPrimarySpaceId(selectedIds[0] || "");
						setMergeOpen(true);
					},
					className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Merge Spaces" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, { className: "h-px bg-border my-1" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: async () => {
						if (await confirm(targetsCount === 1 ? `Are you sure you want to delete space "${row.name}"?` : `Are you sure you want to delete the ${targetsCount} selected spaces?`)) {
							deleteSpaces(selectedIds);
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
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex items-center gap-1.5 font-medium",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
				className: "font-bold text-primary",
				children: floor
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[10px] text-muted-foreground font-normal",
				children: "(Right-click or press Delete to remove)"
			})]
		});
	};
	const renderFloorGroupContextMenu = (floor) => {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuContent, {
			className: "w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: async () => {
						const newFloor = await prompt("Enter new floor name:", floor, { title: "Rename Floor" });
						if (newFloor && newFloor.trim() !== "" && newFloor.trim() !== floor) bulkUpdateSpaces(spaces.filter((s) => s.floor === floor).map((s) => s.id), { floor: newFloor.trim() });
					},
					className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Rename Floor" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, { className: "h-px bg-border my-1" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
					onClick: async () => {
						const floorSpaces = spaces.filter((s) => s.floor === floor);
						if (floorSpaces.length > 0) {
							if (await confirm(`Are you sure you want to delete all ${floorSpaces.length} spaces on floor "${floor}"?`)) {
								deleteSpaces(floorSpaces.map((s) => s.id));
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
	const handleToggleGroup = (ids, select) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (select) ids.forEach((id) => next.add(id));
			else ids.forEach((id) => next.delete(id));
			return next;
		});
	};
	const uniqueBuildings = (0, import_react.useMemo)(() => {
		const vals = /* @__PURE__ */ new Set();
		spaces.forEach((s) => {
			if (s.building) vals.add(s.building);
		});
		return Array.from(vals).sort();
	}, [spaces]);
	const uniqueFloors = (0, import_react.useMemo)(() => {
		const vals = /* @__PURE__ */ new Set();
		spaces.forEach((s) => {
			if (s.floor) vals.add(s.floor);
		});
		return Array.from(vals).sort();
	}, [spaces]);
	const uniqueZones = (0, import_react.useMemo)(() => {
		const vals = /* @__PURE__ */ new Set();
		let hasUnzoned = false;
		spaces.forEach((s) => {
			if (s.zone) vals.add(s.zone);
			else hasUnzoned = true;
		});
		const list = Array.from(vals).sort();
		if (hasUnzoned) list.push("Unzoned");
		return list;
	}, [spaces]);
	const uniqueCategories = (0, import_react.useMemo)(() => {
		const vals = /* @__PURE__ */ new Set();
		let hasUnassigned = false;
		spaces.forEach((s) => {
			if (s.category) vals.add(s.category);
			else hasUnassigned = true;
		});
		const list = Array.from(vals).sort();
		if (hasUnassigned) list.push("Unassigned");
		return list;
	}, [spaces]);
	const currentFilterState = (0, import_react.useMemo)(() => ({
		building: selectedBuilding,
		floor: selectedFloor,
		zone: selectedZone,
		category: selectedCategory,
		warning: activeFilter === "warning",
		query
	}), [
		selectedBuilding,
		selectedFloor,
		selectedZone,
		selectedCategory,
		activeFilter,
		query
	]);
	(0, import_react.useMemo)(() => {
		if (!currentFilterState.building && !currentFilterState.floor && !currentFilterState.zone && !currentFilterState.category && !currentFilterState.warning && !currentFilterState.query) return "All Spaces";
		if (!currentFilterState.building && !currentFilterState.floor && !currentFilterState.zone && !currentFilterState.category && currentFilterState.warning && !currentFilterState.query) return "Warnings Only";
		const matched = savedViews.find((v) => {
			const f = v.filters;
			return f.building === currentFilterState.building && f.floor === currentFilterState.floor && f.zone === currentFilterState.zone && f.category === currentFilterState.category && f.warning === currentFilterState.warning && f.query === currentFilterState.query;
		});
		return matched ? matched.name : null;
	}, [currentFilterState, savedViews]);
	const rows = (0, import_react.useMemo)(() => {
		const q = query.toLowerCase().trim();
		return [...spaces.filter((s) => {
			if (activeFilter === "warning" && s.status !== "warning") return false;
			if (selectedBuilding && s.building !== selectedBuilding) return false;
			if (selectedFloor && s.floor !== selectedFloor) return false;
			if (selectedZone) {
				if (selectedZone === "Unzoned") {
					const zoneStr = (s.zone || "").trim().toLowerCase();
					if (zoneStr !== "" && zoneStr !== "unzoned" && zoneStr !== "default") return false;
				} else if (s.zone !== selectedZone) return false;
			}
			if (selectedCategory) {
				if (selectedCategory === "Unassigned") {
					if ((s.category || "").trim() !== "") return false;
				} else if (s.category !== selectedCategory) return false;
			}
			if (q) {
				const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
				const codeLower = (s.code || "").toLowerCase();
				const nameLower = (s.name || "").toLowerCase();
				const zoneLower = (s.zone || "").toLowerCase();
				const categoryLower = (s.category || "").toLowerCase();
				const textToSearch = `${codeLower} ${nameLower} ${zoneLower} ${categoryLower}`;
				if (!terms.every((term) => {
					if (term === "locker" || term === "room") return categoryLower.includes("locker") || categoryLower.includes("room") || codeLower.includes(term) || nameLower.includes(term) || zoneLower.includes(term);
					return textToSearch.includes(term);
				})) return false;
			}
			return true;
		})].sort((a, b) => {
			const zoneA = (a.zone || "").trim();
			const zoneB = (b.zone || "").trim();
			const isDefaultA = !zoneA || zoneA.toLowerCase() === "default" || zoneA.toLowerCase() === "unzoned";
			const isDefaultB = !zoneB || zoneB.toLowerCase() === "default" || zoneB.toLowerCase() === "unzoned";
			if (isDefaultA && !isDefaultB) return 1;
			if (!isDefaultA && isDefaultB) return -1;
			const zoneCompare = zoneA.localeCompare(zoneB, void 0, {
				numeric: true,
				sensitivity: "base"
			});
			if (zoneCompare !== 0) return zoneCompare;
			return a.name.localeCompare(b.name, void 0, {
				numeric: true,
				sensitivity: "base"
			});
		});
	}, [
		spaces,
		query,
		activeFilter,
		selectedBuilding,
		selectedFloor,
		selectedZone,
		selectedCategory
	]);
	const orderedRows = (0, import_react.useMemo)(() => {
		const groups = {};
		rows.forEach((s) => {
			const floor = s.floor || "Unknown";
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
	}, [rows, sortedFloorsForGrid]);
	const spaceRowClasses = (0, import_react.useMemo)(() => {
		const classes = {};
		let currentFloor = "";
		let currentZoneName = "";
		let globalZoneIndex = -1;
		orderedRows.forEach((s) => {
			const f = s.floor || "Unknown";
			const z = (s.zone || "").trim();
			const zoneName = !z || z.toLowerCase() === "default" || z.toLowerCase() === "unzoned" ? "Default" : z;
			if (f !== currentFloor || zoneName !== currentZoneName) {
				globalZoneIndex++;
				currentFloor = f;
				currentZoneName = zoneName;
			}
			if (globalZoneIndex % 2 === 0) classes[s.id] = "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebef]/80 dark:hover:bg-[#25252b]/80";
			else classes[s.id] = "bg-white dark:bg-zinc-950 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40";
		});
		return classes;
	}, [orderedRows]);
	const getSpaceEditIds = (rId) => {
		return selected.has(rId) ? Array.from(selected) : [rId];
	};
	const columns = [
		{
			key: "name",
			header: "Space Name",
			width: 240,
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1.5 w-full",
				children: [r.comments && r.comments.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					title: `${r.comments.length} comment(s):\n${r.comments.map((c) => `${c.authorName}: ${c.text}`).join("\n")}`,
					className: "inline-flex items-center justify-center p-1 rounded bg-primary/10 text-primary shrink-0 cursor-help",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-3.5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
					value: r.name,
					onCommit: (val) => bulkUpdateSpaces(getSpaceEditIds(r.id), { name: val.trim() || r.name }),
					className: "font-medium text-[13.5px] flex-1 min-w-0"
				})]
			})
		},
		{
			key: "zone",
			header: "Zone",
			width: 200,
			mono: true,
			editable: true,
			render: (r) => {
				const matchingZone = zones.find((z) => z.id === r.zone || z.name === r.zone);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
					value: matchingZone ? matchingZone.name : r.zone || "",
					onCommit: (val) => {
						const trimmed = val.trim();
						const editIds = getSpaceEditIds(r.id);
						const selectedSpaces = spaces.filter((s) => editIds.includes(s.id));
						if (trimmed === "") {
							bulkUpdateSpaces(editIds, { zone: "" });
							return;
						}
						const uniqueFloors = Array.from(new Set(selectedSpaces.map((s) => s.floor || "Unassigned")));
						if (uniqueFloors.length > 1) {
							confirm(`Spaces from different floors cannot be grouped into the same zone.\n\nSelected spaces belong to multiple floors: (${uniqueFloors.join(", ")}). Please select spaces from the same floor only.`, {
								title: "Multi-Floor Zone Error",
								confirmText: "OK",
								hideCancel: true
							});
							return;
						}
						const existingZone = zones.find((z) => z.id.toLowerCase() === trimmed.toLowerCase() || z.name.toLowerCase() === trimmed.toLowerCase());
						if (existingZone) {
							const currentFloor = selectedSpaces[0]?.floor || "L01";
							if (existingZone.floor && existingZone.floor !== currentFloor) {
								confirm(`Zone "${existingZone.name}" already exists on floor ${existingZone.floor}.\n\nSpaces from ${currentFloor} cannot be assigned to a zone on ${existingZone.floor}.`, {
									title: "Zone Floor Mismatch",
									confirmText: "OK",
									hideCancel: true
								});
								return;
							}
							bulkUpdateSpaces(editIds, { zone: existingZone.name });
						} else {
							addZone({
								id: `zone-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
								name: trimmed,
								building: selectedSpaces[0]?.building || "Tower A",
								floor: selectedSpaces[0]?.floor || "L01",
								spaceCount: 0,
								area: 0,
								freshAir: 0,
								extractAir: 0,
								pressure: 0,
								equipment: [],
								pressureType: "neutral",
								faAssignment: null,
								eaAssignment: null
							});
							bulkUpdateSpaces(editIds, { zone: trimmed });
						}
					},
					className: "font-medium text-[13.5px]"
				});
			}
		},
		{
			key: "category",
			header: "Category",
			width: 280,
			editable: true,
			render: (r) => {
				const isRestRoom = r.category === "Rest Room / Changing Room";
				const handleCategoryChange = (newVal) => {
					const editIds = getSpaceEditIds(r.id);
					if (newVal === "Other" || newVal === "OTHER") {
						const latestSpace = workspaceStore.getState().spaces.find((s) => s.id === r.id) || r;
						const categoryName = latestSpace.category && latestSpace.category.endsWith(" (Custom)") ? latestSpace.category : "Custom (Custom)";
						bulkUpdateSpaces(editIds, {
							category: categoryName,
							aiDetected: false
						});
						setTimeout(() => {
							const freshSpace = workspaceStore.getState().spaces.find((s) => s.id === r.id) || latestSpace;
							setCustomParamModalSpace({
								...freshSpace,
								category: categoryName,
								customWorkflow: freshSpace.customWorkflow || "calculate",
								customPeopleOA: freshSpace.customPeopleOA || 0,
								customAreaOA: freshSpace.customAreaOA || 0,
								customExhaustPerUnit: freshSpace.customExhaustPerUnit || 0,
								customExhaustPerArea: freshSpace.customExhaustPerArea || 0,
								customAch: freshSpace.customAch || 0,
								customFreshGiven: freshSpace.customFreshGiven || 0,
								customExtTaken: freshSpace.customExtTaken || 0
							});
						}, 50);
						return;
					}
					if (newVal === "Rest Room / Changing Room") {
						const latestSpace = workspaceStore.getState().spaces.find((s) => s.id === r.id) || r;
						const spaceCopy = {
							...latestSpace,
							category: newVal,
							aiDetected: false
						};
						if (!spaceCopy.restroomSubCategories) spaceCopy.restroomSubCategories = {
							toiletPrivateContinuous: 0,
							toiletPublicContinuous: 0,
							toiletPrivateDiscontinuous: 0,
							toiletPublicDiscontinuous: 0,
							showerContinuous: 0,
							showerDiscontinuous: 0,
							janitorCloset: 0,
							lockerRoom: 0
						};
						const data = getOccupancyData(newVal);
						const updates = {
							category: newVal,
							aiDetected: false,
							restroomSubCategories: spaceCopy.restroomSubCategories
						};
						if (data && !latestSpace.isOccupancyCustomized) {
							const defaultOcc = data.exhaustPerUnit > 0 && data.defaultDensity === 0 ? 1 : Math.ceil(latestSpace.area * data.defaultDensity / 100);
							updates.occupancy = defaultOcc;
							updates.fixtures = data.exhaustPerUnit > 0 ? defaultOcc.toString() : "";
						}
						bulkUpdateSpaces(editIds, updates);
						setTimeout(() => {
							setRestroomModalSpace(workspaceStore.getState().spaces.find((s) => s.id === r.id) || spaceCopy);
						}, 50);
						return;
					}
					const data = getOccupancyData(newVal);
					const updates = {
						category: newVal,
						aiDetected: false
					};
					if (data && !r.isOccupancyCustomized) {
						const defaultOcc = data.exhaustPerUnit > 0 && data.defaultDensity === 0 ? 1 : Math.ceil(r.area * data.defaultDensity / 100);
						updates.occupancy = defaultOcc;
						updates.fixtures = data.exhaustPerUnit > 0 ? defaultOcc.toString() : "";
					}
					bulkUpdateSpaces(editIds, updates);
				};
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1.5 w-full h-full",
					onClick: (e) => e.stopPropagation(),
					onDoubleClick: (e) => e.stopPropagation(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						title: r.aiDetected ? "Automatically identified" : void 0,
						className: `size-1.5 rounded-full shrink-0 ${r.aiDetected ? "bg-primary cursor-help" : "bg-transparent pointer-events-none"}`
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "w-full min-w-0",
						children: isRestRoom ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between w-full min-w-0 pr-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CategorySelect, {
								value: r.category || "",
								onChange: handleCategoryChange,
								triggerClassName: "pl-1 pr-2 flex-1",
								hideChevron: true
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setRestroomModalSpace(r),
								className: "flex items-center justify-center p-1 rounded hover:bg-surface-2 text-primary hover:text-primary/80 transition-colors cursor-pointer w-6 h-6 shrink-0 animate-fade-in",
								title: "Configure Rest Room subcategories",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wrench, { className: "size-3.5" })
							})]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CategorySelect, {
							value: r.category || "",
							onChange: handleCategoryChange,
							triggerClassName: "pl-1 pr-2"
						})
					})]
				});
			}
		},
		{
			key: "pressure",
			header: "Pressure",
			width: 80,
			align: "center",
			editable: true,
			render: (r) => {
				const displayVal = PRESSURE_MAP[r.pressure || "Positive"] || "1";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1.5 w-full",
					onClick: (e) => e.stopPropagation(),
					onDoubleClick: (e) => e.stopPropagation(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						title: r.pressureAutoDetected ? "Automatically identified" : void 0,
						className: `size-1.5 rounded-full shrink-0 ml-5 ${r.pressureAutoDetected ? "bg-primary cursor-help" : "bg-transparent pointer-events-none"}`
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: displayVal,
						onChange: (e) => {
							const newVal = REVERSE_PRESSURE_MAP[e.target.value] || "Positive";
							bulkUpdateSpaces(getSpaceEditIds(r.id), {
								pressure: newVal,
								pressureAutoDetected: false
							});
						},
						className: `font-bold rounded-full text-[11px] leading-none py-1 w-12 text-center font-mono border border-transparent cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none transition-all appearance-none ${r.pressure === "Positive" ? "bg-emerald-500/20 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" : r.pressure === "Negative" ? "bg-destructive/20 text-destructive dark:bg-destructive/20 dark:text-red-400" : r.pressure === "Critical" ? "bg-warning/20 text-warning dark:bg-warning/20 dark:text-amber-400" : "bg-muted text-muted-foreground hover:bg-muted/80"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "1",
								className: "bg-background text-success font-bold",
								children: "+1"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "0",
								className: "bg-background text-muted-foreground font-bold",
								children: "0"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "-1",
								className: "bg-background text-destructive font-bold",
								children: "-1"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "-2",
								className: "bg-background text-warning font-bold",
								children: "-2"
							})
						]
					})]
				});
			}
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
				step: "0.1",
				min: 0,
				value: r.area,
				onCommit: (val) => {
					const num = parseFloat(val);
					if (!isNaN(num) && num >= 0) bulkUpdateSpaces(getSpaceEditIds(r.id), { area: num });
				},
				className: "font-mono tabular text-[13.5px] text-center"
			})
		},
		{
			key: "occupancy",
			header: "Occ.",
			width: 80,
			align: "center",
			mono: true,
			editable: true,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-center gap-1.5 w-full h-full px-1",
				children: [!r.isOccupancyCustomized && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					title: "Default occupancy value",
					className: "size-1.5 rounded-full bg-blue-500 shrink-0"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
					type: "number",
					min: 0,
					value: r.occupancy,
					onCommit: (val) => {
						const num = parseInt(val);
						if (!isNaN(num) && num >= 0) {
							const data = getOccupancyData(r.category);
							const isFixtureBased = data && data.exhaustPerUnit > 0;
							const updates = {
								occupancy: num,
								isOccupancyCustomized: true
							};
							if (isFixtureBased || r.fixtures !== "" && r.fixtures !== void 0 && r.fixtures !== null) updates.fixtures = num.toString();
							bulkUpdateSpaces(getSpaceEditIds(r.id), updates);
						}
					},
					className: "font-mono tabular text-[13.5px] text-center min-w-0 flex-1"
				})]
			})
		},
		{
			key: "minFresh",
			header: "Min Fresh\n(L/s)",
			width: 100,
			align: "center",
			mono: true,
			render: (r) => Math.round(r.minOA || 0).toLocaleString()
		},
		{
			key: "minExtract",
			header: "Min Extract\n(L/s)",
			width: 100,
			align: "center",
			mono: true,
			render: (r) => Math.round(r.minExt || 0).toLocaleString()
		},
		{
			key: "flagged",
			header: "",
			width: 36,
			align: "center",
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: (e) => {
					e.stopPropagation();
					bulkUpdateSpaces(getSpaceEditIds(r.id), { flagged: !r.flagged });
				},
				className: "p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto",
				title: (() => {
					const isNoArea = !r.area || parseFloat(String(r.area)) === 0 || isNaN(parseFloat(String(r.area)));
					const isNoCategory = !r.category || r.category.trim() === "" || r.category.toLowerCase().includes("select category");
					if (isNoArea && isNoCategory) return "Missing space area and category";
					if (isNoArea) return "Missing space area";
					if (isNoCategory) return "Missing space category";
					if (r.category === "Rest Room / Changing Room") {
						const sub = r.restroomSubCategories || {};
						if ((sub.toiletPrivateContinuous || 0) + (sub.toiletPublicContinuous || 0) + (sub.toiletPrivateDiscontinuous || 0) + (sub.toiletPublicDiscontinuous || 0) + (sub.showerContinuous || 0) + (sub.showerDiscontinuous || 0) + (sub.janitorCloset || 0) + (sub.lockerRoom || 0) === 0) return "Rest Room has no subcategories (WC, shower, janitor, locker, etc.) configured";
					}
					return r.flagged ? "Unflag space" : "Flag space";
				})(),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flag, { className: `size-3.5 transition-all duration-200 ${r.flagged ? "fill-red-500 text-red-500 scale-110" : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"}` })
			})
		}
	];
	const [lastClickedIndex, setLastClickedIndex] = (0, import_react.useState)(null);
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
		setSelected((prev) => prev.size === rows.length ? /* @__PURE__ */ new Set() : new Set(rows.map((r) => r.id)));
	};
	const handleOpenAssignZone = async () => {
		const selectedSpaces = spaces.filter((s) => Array.from(selected).includes(s.id));
		const uniqueFloors = Array.from(new Set(selectedSpaces.map((s) => s.floor || "Unassigned")));
		if (uniqueFloors.length > 1) {
			await confirm(`Spaces from different floors cannot be grouped into the same zone.\n\nSelected spaces belong to multiple floors: (${uniqueFloors.join(", ")}). Please select spaces from the same floor only.`, {
				title: "Multi-Floor Zone Error",
				confirmText: "OK",
				hideCancel: true
			});
			return;
		}
		if (selectedSpaces.some((s) => !s.category || s.category.trim() === "" || !s.area || s.area <= 0)) {
			await confirm("Cannot form zone: Category and Area are compulsory for all selected spaces.", {
				title: "Validation Error",
				confirmText: "OK",
				hideCancel: true
			});
			return;
		}
		if (!selectedSpaces.some((s) => s.pressure === "Positive")) {
			await confirm("Cannot form zone: A zone must contain at least one positive-pressure space.", {
				title: "Validation Error",
				confirmText: "OK",
				hideCancel: true
			});
			return;
		}
		setAssignZoneOpen(true);
	};
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape") {
				if (selected.size > 0 || selectedPending.size > 0) {
					e.preventDefault();
					setSelected(/* @__PURE__ */ new Set());
					setSelectedPending(/* @__PURE__ */ new Set());
				}
				return;
			}
			const activeEl = document.activeElement;
			if (activeEl && (activeEl.tagName === "INPUT" && activeEl.type !== "checkbox" && activeEl.type !== "radio" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable || activeEl.tagName === "SELECT")) return;
			const isCmdOrCtrl = navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? e.metaKey : e.ctrlKey;
			if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
				e.preventDefault();
				if (importOpen && pendingRecords.length > 0) setSelectedPending(new Set(pendingRecords.map((r) => r.id)));
				else if (!importOpen && rows.length > 0) setSelected(new Set(rows.map((r) => r.id)));
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
							deleteSpaces(Array.from(selected));
							setSelected(/* @__PURE__ */ new Set());
						}
					});
				}
				return;
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
				if (!importOpen && selected.size > 0) {
					e.preventDefault();
					copySpaces(Array.from(selected));
				}
				return;
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
				if (!importOpen && selected.size > 0) {
					e.preventDefault();
					cutSpaces(Array.from(selected));
					setSelected(/* @__PURE__ */ new Set());
				}
				return;
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
				if (!importOpen) {
					e.preventDefault();
					const pasted = pasteSpaces();
					if (pasted.length > 0) setSelected(new Set(pasted.map((s) => s.id)));
				}
				return;
			}
			if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
				e.preventDefault();
				undo();
				return;
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "y" || isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z") {
				e.preventDefault();
				redo();
				return;
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		importOpen,
		pendingRecords,
		rows,
		selected,
		selectedPending,
		deleteSpaces,
		copySpaces,
		cutSpaces,
		pasteSpaces,
		undo,
		redo
	]);
	const handleNewSpace = () => {
		if (isApprovedLocked) {
			toast.error("Calculation is APPROVED (Official Record). Editing is locked until the Discipline Coordinator rejects.");
			return;
		}
		const defaultNum = spaces.length + 1;
		const newSpace = {
			id: `sp-${Date.now()}`,
			code: `T-L01-${String(defaultNum).padStart(3, "0")}`,
			name: `New Space ${defaultNum}`,
			building: "Tower A",
			floor: "L01",
			zone: "",
			category: "",
			area: 100,
			occupancy: 5,
			freshAir: 0,
			extractAir: 0,
			pressure: "Positive",
			equipment: "",
			status: "draft",
			height: 3,
			fixtures: "",
			multiplier: 1,
			aiDetected: false,
			pressureAutoDetected: false
		};
		addSpace(newSpace);
		setEditingSpace(newSpace);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col flex-1 min-h-0 h-full overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex items-center gap-1.5 px-3 min-h-10 py-1.5 bg-background shrink-0 flex-wrap no-print border-b border-border/50",
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
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Funnel, { className: "size-3.5 shrink-0" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap",
									children: "Filter"
								}),
								activeFiltersCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background",
									children: activeFiltersCount
								})
							]
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
									children: "Building"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: selectedBuilding || "",
									onChange: (e) => setSelectedBuilding(e.target.value || null),
									className: "h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "",
										children: "All Buildings"
									}), uniqueBuildings.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: b,
										children: b
									}, b))]
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
									}), uniqueFloors.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: f,
										children: f
									}, f))]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider",
									children: "Zone"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: selectedZone || "",
									onChange: (e) => setSelectedZone(e.target.value || null),
									className: "h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "",
										children: "All Zones"
									}), uniqueZones.map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: z,
										children: z
									}, z))]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider",
									children: "Category"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: selectedCategory || "",
									onChange: (e) => setSelectedCategory(e.target.value || null),
									className: "h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "",
										children: "All Categories"
									}), uniqueCategories.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: c,
										children: getCategoryDisplayName(c)
									}, c))]
								})]
							})
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: `relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${floorOrder.length > 0 ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15" : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpDown, { className: "size-3.5 shrink-0" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap",
									children: "Sort"
								}),
								floorOrder.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background",
									children: "âœ“"
								})
							]
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
									className: "text-[10px] text-primary hover:underline font-medium hover:text-primary-strong",
									children: "Reset"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10.5px] text-muted-foreground mb-3 leading-snug",
								children: "Drag and drop floors to change their sorting order in the grid views."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-col gap-1.5 max-h-[250px] overflow-y-auto pr-0.5 font-mori",
								children: sortedFloorsForGrid.map((floor, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									draggable: true,
									onDragStart: (e) => handleDragStart(e, index),
									onDragOver: (e) => handleDragOver(e, index),
									onDragEnd: handleDragEnd,
									className: `flex items-center gap-2 p-1.5 bg-surface rounded border border-border text-[11px] cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${draggingIndex === index ? "opacity-40 border-primary bg-primary/5" : "hover:bg-surface-2 hover:border-border-strong"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GripVertical, { className: "size-3 text-muted-foreground shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold text-foreground uppercase truncate",
										children: floor
									})]
								}, floor))
							})
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-auto flex items-center gap-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
								onClick: () => setImportOpen(true),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }), " Import"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
								onClick: () => exportVentilationPDF(spaces),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5" }), " Export PDF"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
								onClick: triggerAutoZoning,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5 text-primary" }), " Auto-Zone"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
								primary: true,
								onClick: handleNewSpace,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " New Space"]
							})
						]
					}),
					selected.size > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-semibold",
								children: [selected.size, " selected"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-primary/30",
								children: "Â·"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BulkBtn, {
								icon: PenLine,
								onClick: () => {
									setBulkEditValues({
										building: "",
										floor: "",
										category: "",
										pressure: "",
										area: "",
										height: "",
										fixtures: "",
										multiplier: "",
										zone: "",
										equipment: ""
									});
									setBulkEditFields({
										building: false,
										floor: false,
										category: false,
										pressure: false,
										area: false,
										height: false,
										fixtures: false,
										multiplier: false,
										zone: false,
										equipment: false
									});
									setBulkEditOpen(true);
								},
								children: "Bulk edit"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BulkBtn, {
								icon: Group,
								onClick: handleOpenAssignZone,
								children: "Assign zone"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BulkBtn, {
								icon: Plus,
								onClick: () => setAssignEquipOpen(true),
								children: "Assign equipment"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BulkBtn, {
								icon: Sparkles,
								onClick: () => {
									triggerAutoZoning(Array.from(selected).map((id) => spaces.find((s) => s.id === id)).filter(Boolean));
								},
								children: "Auto-Zone"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BulkBtn, {
								icon: Copy,
								onClick: () => {
									const selectedIdsArray = Array.from(selected);
									setMergeName((selectedIdsArray.map((id) => spaces.find((s) => s.id === id)?.name).filter(Boolean)[0] || "Merged Space") + " (Merged)");
									setPrimarySpaceId(selectedIdsArray[0] || "");
									setMergeOpen(true);
								},
								children: "Merge spaces"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BulkBtn, {
								icon: Trash2,
								onClick: async () => {
									if (await confirm(`Are you sure you want to delete the ${selected.size} selected spaces?`)) {
										deleteSpaces(Array.from(selected));
										setSelected(/* @__PURE__ */ new Set());
									}
								},
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
				className: "flex-1 min-h-0 overflow-hidden flex flex-col",
				children: spaces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex-1 flex flex-col items-center justify-center p-8 bg-surface-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-w-md w-full bg-background border border-border rounded-xl p-8 shadow-sm flex flex-col items-center text-center animate-scale-in",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 animate-bounce",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-6" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-base font-bold text-foreground mb-1",
								children: "No spaces in project"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground mb-6",
								children: "Start by uploading your Revit/Excel space schedule or create spaces manually."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-3 w-full",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setImportOpen(true),
									className: "flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-9 rounded transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }), " Import Revit Excel"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: handleNewSpace,
									className: "flex-1 border border-border hover:bg-surface-2 font-semibold h-9 rounded transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add Space"]
								})]
							})
						]
					})
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
					onToggleGroup: handleToggleGroup,
					onRowDoubleClick: (r) => setEditingSpace(r),
					activeRowId: editingSpace?.id,
					rowClassName: (r) => spaceRowClasses[r.id] || ""
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 no-print modal-blur-bg",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					"Showing ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-foreground font-medium tabular",
						children: rows.length.toLocaleString()
					}),
					" of ",
					spaces.length.toLocaleString(),
					" spaces"
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3 tabular",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Î£ Fresh: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-mono text-foreground",
							children: [rows.reduce((a, s) => a + (s.freshAir || 0), 0).toLocaleString(), " L/s"]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Î£ Extract: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-mono text-foreground",
							children: [rows.reduce((a, s) => a + (s.extractAir || 0), 0).toLocaleString(), " L/s"]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Î£ Area: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-mono text-foreground",
							children: [rows.reduce((a, s) => a + (s.area || 0) * (s.multiplier || 1), 0).toFixed(0), " mÂ²"]
						})] })
					]
				})]
			}),
			commentTarget && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssignCommentModal, {
				isOpen: assignCommentOpen,
				onClose: () => {
					setAssignCommentOpen(false);
					setCommentTarget(null);
				},
				targetId: commentTarget.id,
				targetName: commentTarget.name,
				targetType: commentTarget.type,
				onSave: (comment) => {
					workspaceStore.addCommentToTarget(commentTarget.id, commentTarget.type, comment);
					toast.success(`Comment assigned on ${commentTarget.type} "${commentTarget.name}"`);
				}
			}),
			editingSpace && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditSpaceModal, {
				space: editingSpace,
				onClose: () => setEditingSpace(null),
				onSave: (updated) => {
					let nextZones = [...zones];
					if (updated.zone && updated.zone !== "") {
						if (!zones.some((z) => z.id.toLowerCase() === updated.zone.toLowerCase() || z.name.toLowerCase() === updated.zone.toLowerCase())) {
							const newZone = {
								id: `zone-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
								name: updated.zone,
								building: updated.building || "Tower A",
								floor: updated.floor || "L01",
								spaceCount: 0,
								area: 0,
								freshAir: 0,
								extractAir: 0,
								pressure: 0,
								equipment: [],
								pressureType: "neutral",
								faAssignment: null,
								eaAssignment: null
							};
							nextZones.push(newZone);
						}
					}
					let nextEquipment = [...equipment];
					if (updated.equipment && updated.equipment !== "") {
						if (!equipment.some((eq) => eq.id.toLowerCase() === updated.equipment.toLowerCase() || eq.tag.toLowerCase() === updated.equipment.toLowerCase())) {
							const newEquip = {
								id: `equip-${Date.now()}`,
								tag: updated.equipment,
								type: "Air Handling Unit",
								zones: 0,
								spaces: 0,
								totalAirflow: 0,
								capacity: 2e3,
								utilization: 0,
								status: "design",
								mode: "Fresh Air + Extract Air",
								zoneIds: []
							};
							nextEquipment.push(newEquip);
						}
					}
					let nextSpaces = spaces.map((s) => s.id === updated.id ? updated : s);
					const mult = parseInt(String(updated.multiplier)) || 1;
					if (mult > 1) {
						const originalUpdated = {
							...updated,
							multiplier: 1
						};
						nextSpaces = nextSpaces.map((s) => s.id === updated.id ? originalUpdated : s);
						const clones = [];
						for (let i = 1; i < mult; i++) {
							const nextNum = Math.floor(Math.random() * 1e3);
							clones.push({
								...updated,
								id: `sp-${Date.now()}-${i}-${nextNum}`,
								code: `${updated.code}-${i}`,
								name: `${updated.name}-${i}`,
								multiplier: 1
							});
						}
						nextSpaces.push(...clones);
					}
					const balanced = calculateVentilation(nextSpaces, nextZones, nextEquipment);
					setWorkspaceState({
						spaces: balanced.spaces,
						zones: balanced.zones,
						equipment: balanced.equipment
					});
					setEditingSpace(null);
				},
				availableZones: zones.map((z) => z.name),
				availableEquipment: equipment.map((e) => e.tag),
				availableFloors: allUniqueFloors
			}),
			restroomModalSpace && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/30",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-sm font-bold text-slate-800 dark:text-zinc-200",
								children: "Rest Room / Changing Room Configuration"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-muted-foreground mt-0.5",
								children: "Enter the quantity of each sub-category to compute total exhaust."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setRestroomModalSpace(null),
								className: "text-muted-foreground hover:text-foreground rounded p-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-6 max-h-[60vh] overflow-y-auto space-y-4",
							children: [
								{
									key: "toiletPrivateContinuous",
									label: "Toilet - private (continuous)",
									rate: "12.5 L/s per toilet"
								},
								{
									key: "toiletPublicContinuous",
									label: "Toilet - public (continuous)",
									rate: "25.0 L/s per toilet"
								},
								{
									key: "toiletPrivateDiscontinuous",
									label: "Toilet - private (discontinuous)",
									rate: "25.0 L/s per toilet"
								},
								{
									key: "toiletPublicDiscontinuous",
									label: "Toilet - public (discontinuous)",
									rate: "35.0 L/s per toilet"
								},
								{
									key: "showerContinuous",
									label: "Shower Rooms (continuous)",
									rate: "10.0 L/s per shower"
								},
								{
									key: "showerDiscontinuous",
									label: "Shower Rooms (discontinuous)",
									rate: "25.0 L/s per shower"
								},
								{
									key: "janitorCloset",
									label: "Janitor Closets, Trash Rooms, Recycling",
									rate: `5.0 L/s per m² (${(5 * (restroomModalSpace.area || 0)).toFixed(1)} L/s for ${restroomModalSpace.area || 0} m² restroom)`
								},
								{
									key: "lockerRoom",
									label: "Locker Rooms",
									rate: `1.25 L/s per m² (${(1.25 * (restroomModalSpace.area || 0)).toFixed(1)} L/s for ${restroomModalSpace.area || 0} m² restroom)`
								}
							].map((subcat) => {
								const qty = (restroomModalSpace.restroomSubCategories || {})[subcat.key] || 0;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-4 py-1.5 border-b border-slate-100/60 dark:border-zinc-900/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[12.5px] font-semibold text-slate-700 dark:text-zinc-300",
											children: subcat.label
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-muted-foreground mt-0.5",
											children: subcat.rate
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex items-center gap-2",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											min: "0",
											value: qty,
											onChange: (e) => {
												const val = Math.max(0, parseInt(e.target.value) || 0);
												setRestroomModalSpace((prev) => {
													if (!prev) return null;
													const sub = prev.restroomSubCategories || {};
													return {
														...prev,
														restroomSubCategories: {
															...sub,
															[subcat.key]: val
														}
													};
												});
											},
											className: "w-20 h-9 px-2 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-[13px] font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-neutral-800 dark:text-neutral-200"
										})
									})]
								}, subcat.key);
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "px-6 py-4 bg-slate-50/50 dark:bg-zinc-900/30 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-bold text-muted-foreground uppercase tracking-wider",
									children: "Total Exhaust"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[15px] font-black text-primary",
									children: [
										(() => {
											const sub = restroomModalSpace.restroomSubCategories || {};
											const areaVal = restroomModalSpace.area || 0;
											let total = 0;
											total += (sub.toiletPrivateContinuous || 0) * 12.5;
											total += (sub.toiletPublicContinuous || 0) * 25;
											total += (sub.toiletPrivateDiscontinuous || 0) * 25;
											total += (sub.toiletPublicDiscontinuous || 0) * 35;
											total += (sub.showerContinuous || 0) * 10;
											total += (sub.showerDiscontinuous || 0) * 25;
											total += (sub.janitorCloset || 0) * areaVal * 5;
											total += (sub.lockerRoom || 0) * areaVal * 1.25;
											return total;
										})(),
										" ",
										"L/s"
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									const editIds = selected.has(restroomModalSpace.id) ? Array.from(selected) : [restroomModalSpace.id];
									updateSpaces(spaces.map((s) => {
										if (editIds.includes(s.id)) return {
											...s,
											category: "Rest Room / Changing Room",
											restroomSubCategories: restroomModalSpace.restroomSubCategories
										};
										return s;
									}));
									setRestroomModalSpace(null);
									if (selected.has(restroomModalSpace.id)) setSelected(/* @__PURE__ */ new Set());
								},
								className: "px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:bg-primary/95 transition cursor-pointer",
								children: "Apply & Close"
							})]
						})
					]
				})
			}),
			customParamModalSpace && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-lg shadow-lg w-full max-w-md animate-scale-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-4 py-3 border-b border-border flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-semibold text-[14px]",
									children: "Configure Custom Parameters"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setCustomParamModalSpace(null),
								className: "text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded p-0.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 flex flex-col gap-4 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-muted-foreground mb-2 leading-relaxed",
									children: [
										"Define custom calculation parameters for the category of space ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-semibold text-foreground",
											children: [
												"\"",
												customParamModalSpace.name,
												"\""
											]
										}),
										"."
									]
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium mb-1",
									children: "Custom Category Name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: customParamModalSpace.category,
									onChange: (e) => setCustomParamModalSpace({
										...customParamModalSpace,
										category: e.target.value
									}),
									placeholder: "e.g. Custom (Custom)",
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium mb-1",
									children: "Workflow Method"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: customParamModalSpace.customWorkflow || "calculate",
									onChange: (e) => setCustomParamModalSpace({
										...customParamModalSpace,
										customWorkflow: e.target.value
									}),
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none cursor-pointer text-foreground",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "calculate",
										children: "Calculate Airflow Rates"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "direct",
										children: "Direct Airflow Values"
									})]
								})] }),
								customParamModalSpace.customWorkflow === "direct" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-4 border-t border-border/40 pt-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-muted-foreground font-medium mb-1",
										children: "Outdoor Air (Fresh) Given (L/s)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "any",
										value: customParamModalSpace.customFreshGiven ?? "",
										onChange: (e) => setCustomParamModalSpace({
											...customParamModalSpace,
											customFreshGiven: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
										}),
										className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-muted-foreground font-medium mb-1",
										children: "Extract Air Taken (L/s)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "any",
										value: customParamModalSpace.customExtTaken ?? "",
										onChange: (e) => setCustomParamModalSpace({
											...customParamModalSpace,
											customExtTaken: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
										}),
										className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
									})] })]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-3 border-t border-border/40 pt-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-muted-foreground font-medium mb-1",
											children: "People OA (L/s/person)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "any",
											value: customParamModalSpace.customPeopleOA ?? "",
											onChange: (e) => setCustomParamModalSpace({
												...customParamModalSpace,
												customPeopleOA: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
											}),
											className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-muted-foreground font-medium mb-1",
											children: "Area OA (L/s/mÂ²)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "any",
											value: customParamModalSpace.customAreaOA ?? "",
											onChange: (e) => setCustomParamModalSpace({
												...customParamModalSpace,
												customAreaOA: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
											}),
											className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
										})] })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-3 gap-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-muted-foreground font-medium mb-1",
												children: "ACH"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: customParamModalSpace.customAch ?? "",
												onChange: (e) => setCustomParamModalSpace({
													...customParamModalSpace,
													customAch: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
												}),
												className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-muted-foreground font-medium mb-1",
												children: "Exh / Area (L/s/mÂ²)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: customParamModalSpace.customExhaustPerArea ?? "",
												onChange: (e) => setCustomParamModalSpace({
													...customParamModalSpace,
													customExhaustPerArea: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
												}),
												className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-muted-foreground font-medium mb-1",
												children: "Exh / Unit (L/s/unit)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: customParamModalSpace.customExhaustPerUnit ?? "",
												onChange: (e) => setCustomParamModalSpace({
													...customParamModalSpace,
													customExhaustPerUnit: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
												}),
												className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
											})] })
										]
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setCustomParamModalSpace(null),
								className: "border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									let catName = customParamModalSpace.category.trim();
									if (!catName) catName = "Custom (Custom)";
									else if (!catName.endsWith(" (Custom)")) catName = `${catName} (Custom)`;
									updateSpaces([{
										...customParamModalSpace,
										category: catName
									}]);
									setCustomParamModalSpace(null);
								},
								className: "bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 shadow-sm",
								children: "Save Parameters"
							})]
						})
					]
				})
			}),
			importOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `bg-background border border-border rounded-2xl shadow-lg w-full max-w-5xl max-h-[85vh] flex flex-col animate-scale-in ${pendingRecords.length === 0 ? "cursor-pointer" : ""}`,
					onDragOver: (e) => {
						if (pendingRecords.length === 0) e.preventDefault();
					},
					onDrop: (e) => {
						if (pendingRecords.length === 0) handleFileDrop(e);
					},
					onClick: (e) => {
						if (pendingRecords.length === 0) {
							const target = e.target;
							if (!target.closest("button") && !target.closest("input")) fileInputRef.current?.click();
						}
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-4 py-3 border-b border-border flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-semibold text-[14px]",
								children: "Import Revit Space Schedule"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setImportOpen(false),
								className: "text-muted-foreground hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `p-4 flex-1 flex flex-col gap-4 ${pendingRecords.length === 0 ? "min-h-[45vh]" : "overflow-y-auto"}`,
							children: pendingRecords.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border-2 border-dashed border-border rounded-lg p-10 flex flex-col items-center justify-center gap-3 text-center bg-surface-1 hover:bg-surface-2 transition-colors flex-1 justify-center",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-8 text-muted-foreground animate-pulse" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-sm font-medium",
										children: "Drag & drop Revit Excel export sheet here, or click to browse"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										ref: fileInputRef,
										type: "file",
										accept: ".xlsx, .xls",
										onChange: handleFileUpload,
										className: "hidden"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-[11px] text-muted-foreground max-w-md mt-2",
										children: [
											"Dynamic columns parser matches headers: ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Level" }),
											", ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Zone" }),
											", ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Name" }),
											", ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Area" }),
											", ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Room: Unbounded Height" }),
											", and ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Number of People" }),
											"."
										]
									})
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-surface-2 border border-border rounded p-3 flex flex-wrap items-center gap-3 text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-semibold text-muted-foreground",
										children: [
											"Bulk Edit (",
											selectedPending.size,
											" selected):"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										placeholder: "Level (e.g. 1F)",
										value: importBulkValues.level,
										onChange: (e) => setImportBulkValues({
											...importBulkValues,
											level: e.target.value
										}),
										className: "bg-background border border-border rounded px-2 py-1 w-20 outline-none"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										placeholder: "Zone (e.g. GF-01)",
										value: importBulkValues.zone,
										onChange: (e) => setImportBulkValues({
											...importBulkValues,
											zone: e.target.value
										}),
										className: "bg-background border border-border rounded px-2 py-1 w-20 outline-none"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: importBulkValues.category,
										onChange: (e) => setImportBulkValues({
											...importBulkValues,
											category: e.target.value
										}),
										className: "bg-background border border-border rounded px-2 py-1 max-w-[150px] outline-none",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "",
											children: "-- Category --"
										}), zones.map((z) => z.name).concat([
											"Office space",
											"Conference / meeting",
											"Corridors",
											"EX. Toilet - private (continuous)"
										]).filter((v, i, a) => a.indexOf(v) === i).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: c,
											children: c
										}, c))]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: importBulkValues.pressure,
										onChange: (e) => setImportBulkValues({
											...importBulkValues,
											pressure: e.target.value
										}),
										className: "bg-background border border-border rounded px-2 py-1 outline-none",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "",
												children: "-- Pressure --"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "Neutral",
												children: "Neutral"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "Positive",
												children: "Positive"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "Negative",
												children: "Negative"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "Critical",
												children: "Critical"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										placeholder: "Height",
										value: importBulkValues.height,
										onChange: (e) => setImportBulkValues({
											...importBulkValues,
											height: e.target.value
										}),
										className: "bg-background border border-border rounded px-2 py-1 w-14 outline-none"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										placeholder: "Fixtures",
										value: importBulkValues.fixtures,
										onChange: (e) => setImportBulkValues({
											...importBulkValues,
											fixtures: e.target.value
										}),
										className: "bg-background border border-border rounded px-2 py-1 w-16 outline-none"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										placeholder: "Mult.",
										value: importBulkValues.multiplier,
										onChange: (e) => setImportBulkValues({
											...importBulkValues,
											multiplier: e.target.value
										}),
										className: "bg-background border border-border rounded px-2 py-1 w-14 outline-none"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: handlePendingBulkApply,
										className: "bg-primary text-primary-foreground font-semibold px-3 py-1 rounded hover:bg-primary/90 transition-colors",
										children: "Apply Bulk"
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "border border-border rounded overflow-hidden max-h-[40vh] overflow-y-auto",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
									className: "w-full text-xs text-left border-collapse",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
										className: "bg-header-bg border-b border-border sticky top-0 font-semibold text-muted-foreground",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2 w-8 text-center",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: pendingRecords.length > 0 && selectedPending.size === pendingRecords.length,
													onChange: (e) => setSelectedPending(e.target.checked ? new Set(pendingRecords.map((p) => p.id)) : /* @__PURE__ */ new Set()),
													className: "cursor-pointer"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "Level"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "Name"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "Zone"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "ASHRAE Category"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "Pressure"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "Area (mÂ²)"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "Height (m)"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "Fixtures"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "Mult."
											})
										] })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
										className: "divide-y divide-border",
										children: pendingRecords.map((rec) => {
											const isSel = selectedPending.has(rec.id);
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
												onClick: (e) => togglePending(rec.id, e.shiftKey, e.ctrlKey || e.metaKey),
												className: `hover:bg-row-hover ${isSel ? "bg-accent/10" : ""} cursor-default select-none`,
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-2 text-center",
														onClick: (e) => e.stopPropagation(),
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "checkbox",
															checked: isSel,
															onClick: (e) => togglePending(rec.id, e.shiftKey, true),
															onChange: () => {},
															className: "cursor-pointer"
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-2 font-mono",
														children: rec.level
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-2 font-medium",
														children: rec.name
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-2 font-mono",
														children: rec.zone
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-2",
														onClick: (e) => e.stopPropagation(),
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "inline-flex items-center gap-1.5 w-full",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																title: rec.aiDetected ? "Automatically identified" : void 0,
																className: `size-1.5 rounded-full shrink-0 ${rec.aiDetected ? "bg-primary cursor-help" : "bg-transparent pointer-events-none"}`
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																value: rec.category && rec.category.endsWith(" (Custom)") ? "Other" : rec.category || "",
																onChange: (e) => {
																	const newVal = e.target.value;
																	setPendingRecords((prev) => prev.map((p) => p.id === rec.id ? {
																		...p,
																		category: newVal,
																		aiDetected: false
																	} : p));
																},
																className: "w-full bg-transparent border-0 hover:bg-surface-2 focus:bg-background focus:ring-1 focus:ring-primary focus:outline-none py-0.5 px-1 rounded text-foreground text-[11px] cursor-pointer truncate",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "",
																		className: "text-muted-foreground italic",
																		children: "Select Category..."
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Other",
																		className: "bg-background text-foreground",
																		children: "Other"
																	}),
																	getOccupancyCategories().map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: c,
																		className: "bg-background text-foreground",
																		children: c
																	}, c))
																]
															})]
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-2 font-mono",
														onClick: (e) => e.stopPropagation(),
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "inline-flex items-center gap-1.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																title: rec.pressureAutoDetected ? "Automatically identified" : void 0,
																className: `size-1.5 rounded-full shrink-0 ml-1 ${rec.pressureAutoDetected ? "bg-primary cursor-help" : "bg-transparent pointer-events-none"}`
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																value: PRESSURE_MAP[rec.pressure || "Positive"] || "1",
																onChange: (e) => {
																	const newVal = REVERSE_PRESSURE_MAP[e.target.value] || "Positive";
																	setPendingRecords((prev) => prev.map((p) => p.id === rec.id ? {
																		...p,
																		pressure: newVal,
																		pressureAutoDetected: false
																	} : p));
																},
																className: `font-bold rounded-full text-[11px] leading-none py-1 w-12 text-center font-mono border border-transparent cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none transition-all appearance-none ${rec.pressure === "Positive" ? "bg-emerald-500/20 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" : rec.pressure === "Negative" ? "bg-destructive/20 text-destructive dark:bg-destructive/20 dark:text-red-400" : rec.pressure === "Critical" ? "bg-warning/20 text-warning dark:bg-warning/20 dark:text-amber-400" : "bg-muted text-muted-foreground hover:bg-muted/80"}`,
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "1",
																		className: "bg-background text-success font-bold",
																		children: "+1"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "0",
																		className: "bg-background text-muted-foreground font-bold",
																		children: "0"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "-1",
																		className: "bg-background text-destructive font-bold",
																		children: "-1"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "-2",
																		className: "bg-background text-warning font-bold",
																		children: "-2"
																	})
																]
															})]
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-2 font-mono",
														children: rec.area.toFixed(1)
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-2 font-mono",
														children: rec.height.toFixed(2)
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-2 font-mono",
														children: rec.fixtures || "-"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-2 font-mono",
														children: rec.multiplier
													})
												]
											}, rec.id);
										})
									})]
								})
							})] })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-4 py-3 border-t border-border flex items-center justify-between bg-header-bg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									setPendingRecords([]);
									setSelectedPending(/* @__PURE__ */ new Set());
								},
								disabled: pendingRecords.length === 0,
								className: "border border-border text-muted-foreground text-xs px-3 py-1.5 rounded hover:bg-surface-2 disabled:opacity-50",
								children: "Clear parsed"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setImportOpen(false),
									className: "border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2",
									children: "Cancel"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: handleCommitImports,
									disabled: selectedPending.size === 0,
									className: "bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 transition-colors disabled:opacity-50",
									children: [
										"Commit ",
										selectedPending.size,
										" Spaces"
									]
								})]
							})]
						})
					]
				})
			}),
			autoZoneFloorSelectOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-lg shadow-lg w-full max-w-sm animate-scale-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-4 py-3 border-b border-border flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-semibold text-[14px]",
									children: "Select Floor"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setAutoZoneFloorSelectOpen(false),
								className: "text-muted-foreground hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 flex flex-col gap-3 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-muted-foreground leading-normal",
									children: "Select which floor you would like to run auto-zoning for."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-2 justify-end",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => setAutoZoneSelectedFloors(new Set(autoZoneAvailableFloors)),
											className: "text-[10px] text-primary hover:underline font-semibold",
											children: "Select All"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted-foreground/30",
											children: "|"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => setAutoZoneSelectedFloors(/* @__PURE__ */ new Set()),
											className: "text-[10px] text-primary hover:underline font-semibold",
											children: "Deselect All"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "border border-border rounded-md divide-y divide-border overflow-y-auto max-h-[30vh] bg-surface-2/40",
									children: autoZoneAvailableFloors.map((floor) => {
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "flex items-center gap-3 p-2.5 cursor-pointer hover:bg-row-hover transition-colors select-none font-sans",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: autoZoneSelectedFloors.has(floor),
												onChange: () => {
													const next = new Set(autoZoneSelectedFloors);
													if (next.has(floor)) next.delete(floor);
													else next.add(floor);
													setAutoZoneSelectedFloors(next);
												},
												className: "cursor-pointer"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-medium text-foreground",
												children: floor
											})]
										}, floor);
									})
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setAutoZoneFloorSelectOpen(false),
								className: "border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleFloorSelectProceed,
								disabled: autoZoneSelectedFloors.size === 0,
								className: "bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 disabled:opacity-50",
								children: "Done"
							})]
						})
					]
				})
			}),
			bulkEditOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-2xl shadow-lg w-full max-w-lg animate-scale-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-4 py-3 border-b border-border flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
									className: "font-semibold text-[14px]",
									children: [
										"Bulk Edit ",
										selected.size,
										" Spaces"
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setBulkEditOpen(false),
								className: "text-muted-foreground hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 flex flex-col gap-4 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-primary/5 border border-primary/10 rounded-md p-2.5 text-muted-foreground flex items-start gap-2 leading-normal",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-4 text-primary shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Check the box next to any parameter to enable and update it across all selected spaces. Unchecked parameters will remain unchanged." })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5 mb-1 select-none",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											id: "bulk-update-building",
											checked: bulkEditFields.building,
											onChange: (e) => setBulkEditFields({
												...bulkEditFields,
												building: e.target.checked
											}),
											className: "size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											htmlFor: "bulk-update-building",
											className: "text-muted-foreground font-medium cursor-pointer",
											children: "Building"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										placeholder: "e.g. Tower B (or blank to clear)",
										value: bulkEditValues.building,
										disabled: !bulkEditFields.building,
										onChange: (e) => setBulkEditValues({
											...bulkEditValues,
											building: e.target.value
										}),
										className: "bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5 mb-1 select-none",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											id: "bulk-update-floor",
											checked: bulkEditFields.floor,
											onChange: (e) => setBulkEditFields({
												...bulkEditFields,
												floor: e.target.checked
											}),
											className: "size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											htmlFor: "bulk-update-floor",
											className: "text-muted-foreground font-medium cursor-pointer",
											children: "Floor"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										placeholder: "e.g. L02 (or blank to clear)",
										value: bulkEditValues.floor,
										disabled: !bulkEditFields.floor,
										onChange: (e) => setBulkEditValues({
											...bulkEditValues,
											floor: e.target.value
										}),
										className: "bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all"
									})] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5 mb-1 select-none",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										id: "bulk-update-category",
										checked: bulkEditFields.category,
										onChange: (e) => setBulkEditFields({
											...bulkEditFields,
											category: e.target.checked
										}),
										className: "size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										htmlFor: "bulk-update-category",
										className: "text-muted-foreground font-medium cursor-pointer",
										children: "Category Classification"
									})]
								}), bulkEditFields.category ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CategorySelect, {
									value: bulkEditValues.category,
									onChange: (newVal) => setBulkEditValues({
										...bulkEditValues,
										category: newVal
									}),
									triggerClassName: "w-full bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none cursor-pointer transition-all text-foreground h-9"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "bg-surface-2 opacity-50 border border-border rounded px-2.5 py-1.5 w-full text-muted-foreground text-[13px] h-9 flex items-center select-none cursor-not-allowed",
									children: "-- Select Category (or blank to clear) --"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5 mb-1 select-none",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										id: "bulk-update-pressure",
										checked: bulkEditFields.pressure,
										onChange: (e) => setBulkEditFields({
											...bulkEditFields,
											pressure: e.target.checked
										}),
										className: "size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										htmlFor: "bulk-update-pressure",
										className: "text-muted-foreground font-medium cursor-pointer",
										children: "Pressure Mode"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: bulkEditValues.pressure,
									disabled: !bulkEditFields.pressure,
									onChange: (e) => setBulkEditValues({
										...bulkEditValues,
										pressure: e.target.value
									}),
									className: "bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none cursor-pointer transition-all text-foreground",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "",
											children: "-- Select Pressure Mode --"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "Neutral",
											children: "Neutral"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "Positive",
											children: "Positive"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "Negative",
											children: "Negative"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "Critical",
											children: "Critical"
										})
									]
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-4 gap-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1.5 mb-1 select-none",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "checkbox",
												id: "bulk-update-area",
												checked: bulkEditFields.area,
												onChange: (e) => setBulkEditFields({
													...bulkEditFields,
													area: e.target.checked
												}),
												className: "size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												htmlFor: "bulk-update-area",
												className: "text-muted-foreground font-medium cursor-pointer",
												children: "Area (m²)"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "any",
											placeholder: "e.g. 15.0",
											value: bulkEditValues.area,
											disabled: !bulkEditFields.area,
											onChange: (e) => setBulkEditValues({
												...bulkEditValues,
												area: e.target.value
											}),
											className: "bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all text-[13px] text-foreground"
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1.5 mb-1 select-none",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "checkbox",
												id: "bulk-update-height",
												checked: bulkEditFields.height,
												onChange: (e) => setBulkEditFields({
													...bulkEditFields,
													height: e.target.checked
												}),
												className: "size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												htmlFor: "bulk-update-height",
												className: "text-muted-foreground font-medium cursor-pointer",
												children: "Height (m)"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "any",
											placeholder: "e.g. 3.0",
											value: bulkEditValues.height,
											disabled: !bulkEditFields.height,
											onChange: (e) => setBulkEditValues({
												...bulkEditValues,
												height: e.target.value
											}),
											className: "bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all text-[13px] text-foreground"
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1.5 mb-1 select-none",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "checkbox",
												id: "bulk-update-fixtures",
												checked: bulkEditFields.fixtures,
												onChange: (e) => setBulkEditFields({
													...bulkEditFields,
													fixtures: e.target.checked
												}),
												className: "size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												htmlFor: "bulk-update-fixtures",
												className: "text-muted-foreground font-medium cursor-pointer",
												children: "Fixtures (Occ)"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											placeholder: "e.g. 5 (or blank)",
											value: bulkEditValues.fixtures,
											disabled: !bulkEditFields.fixtures,
											onChange: (e) => setBulkEditValues({
												...bulkEditValues,
												fixtures: e.target.value
											}),
											className: "bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all text-[13px] text-foreground"
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1.5 mb-1 select-none",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "checkbox",
												id: "bulk-update-multiplier",
												checked: bulkEditFields.multiplier,
												onChange: (e) => setBulkEditFields({
													...bulkEditFields,
													multiplier: e.target.checked
												}),
												className: "size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												htmlFor: "bulk-update-multiplier",
												className: "text-muted-foreground font-medium cursor-pointer",
												children: "Multiplier"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											placeholder: "e.g. 1",
											value: bulkEditValues.multiplier,
											disabled: !bulkEditFields.multiplier,
											onChange: (e) => setBulkEditValues({
												...bulkEditValues,
												multiplier: e.target.value
											}),
											className: "bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all text-[13px] text-foreground"
										})] })
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1.5 mb-1 select-none",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "checkbox",
												id: "bulk-update-zone",
												checked: bulkEditFields.zone,
												onChange: (e) => setBulkEditFields({
													...bulkEditFields,
													zone: e.target.checked
												}),
												className: "size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												htmlFor: "bulk-update-zone",
												className: "text-muted-foreground font-medium cursor-pointer",
												children: "Assign Zone ID"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											placeholder: "e.g. Z-002 (or blank to clear)",
											value: bulkEditValues.zone,
											disabled: !bulkEditFields.zone,
											onChange: (e) => setBulkEditValues({
												...bulkEditValues,
												zone: e.target.value
											}),
											className: "bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all",
											list: "bulk-zones-list"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
											id: "bulk-zones-list",
											children: zones.map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: z.name }, z.id))
										})
									] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1.5 mb-1 select-none",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "checkbox",
												id: "bulk-update-equipment",
												checked: bulkEditFields.equipment,
												onChange: (e) => setBulkEditFields({
													...bulkEditFields,
													equipment: e.target.checked
												}),
												className: "size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												htmlFor: "bulk-update-equipment",
												className: "text-muted-foreground font-medium cursor-pointer",
												children: "Assign Equip Tag"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											placeholder: "e.g. AHU-01 (or blank to clear)",
											value: bulkEditValues.equipment,
											disabled: !bulkEditFields.equipment,
											onChange: (e) => setBulkEditValues({
												...bulkEditValues,
												equipment: e.target.value
											}),
											className: "bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all",
											list: "bulk-equip-list"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
											id: "bulk-equip-list",
											children: equipment.map((eq) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: eq.tag }, eq.id))
										})
									] })]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setBulkEditOpen(false),
								className: "border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2 animate-fade-in",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleBulkEditApply,
								className: "bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 shadow-sm transition-colors",
								children: "Apply Updates"
							})]
						})
					]
				})
			}),
			assignZoneOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-2xl shadow-lg w-full max-w-sm animate-scale-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-4 py-3 border-b border-border flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-semibold text-[14px]",
								children: "Assign Zone"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setAssignZoneOpen(false),
								className: "text-muted-foreground hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 flex flex-col gap-3 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium",
									children: "Select or Type Zone name"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									placeholder: "e.g. Z-003 or WC Zone",
									value: targetZone,
									onChange: (e) => setTargetZone(e.target.value),
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none",
									list: "zones-list"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
									id: "zones-list",
									children: zones.map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: z.name }, z.id))
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setAssignZoneOpen(false),
								className: "border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleAssignZoneApply,
								className: "bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95",
								children: "Confirm Zone"
							})]
						})
					]
				})
			}),
			assignEquipOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-2xl shadow-lg w-full max-w-sm animate-scale-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-4 py-3 border-b border-border flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-semibold text-[14px]",
								children: "Assign Equipment"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setAssignEquipOpen(false),
								className: "text-muted-foreground hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 flex flex-col gap-3 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium",
									children: "Select or Type Equipment Tag"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									placeholder: "e.g. AHU-02",
									value: targetEquip,
									onChange: (e) => setTargetEquip(e.target.value),
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none",
									list: "equip-list"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
									id: "equip-list",
									children: equipment.map((eq) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: eq.tag }, eq.id))
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setAssignEquipOpen(false),
								className: "border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleAssignEquipApply,
								className: "bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95",
								children: "Confirm Equipment"
							})]
						})
					]
				})
			}),
			mergeOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-2xl shadow-lg w-full max-w-md animate-scale-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-4 py-3 border-b border-border flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-semibold text-[14px]",
								children: "Merge Spaces"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setMergeOpen(false),
								className: "text-muted-foreground hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 flex flex-col gap-3 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-muted-foreground",
									children: [
										"Merging ",
										selected.size,
										" spaces will combine their areas and occupancies. Select the primary space to inherit other properties from:"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium mb-1 font-semibold",
									children: "Merged Space Name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: mergeName,
									onChange: (e) => setMergeName(e.target.value),
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium mb-1 font-semibold",
									children: "Primary Space"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									value: primarySpaceId,
									onChange: (e) => setPrimarySpaceId(e.target.value),
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none",
									children: Array.from(selected).map((id) => {
										const sp = spaces.find((s) => s.id === id);
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
											value: id,
											children: [
												sp?.name || "Unnamed space",
												" (",
												sp?.code,
												")"
											]
										}, id);
									})
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setMergeOpen(false),
								className: "border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleMergeSpacesApply,
								className: "bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95",
								children: "Merge Spaces"
							})]
						})
					]
				})
			}),
			newProjectOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-2xl shadow-lg w-full max-w-sm animate-scale-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-4 py-3 border-b border-border flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-semibold text-[14px]",
								children: "Create New Project"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setNewProjectOpen(false),
								className: "text-muted-foreground hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 flex flex-col gap-3 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium mb-1",
									children: "Project Name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: newProjectValues.name,
									onChange: (e) => setNewProjectValues({
										...newProjectValues,
										name: e.target.value
									}),
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none",
									placeholder: "e.g. Marina Bay Tower"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium mb-1",
									children: "Project Code"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: newProjectValues.code,
									onChange: (e) => setNewProjectValues({
										...newProjectValues,
										code: e.target.value
									}),
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono",
									placeholder: "e.g. MBT-2026-117"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium mb-1",
									children: "Client Name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: newProjectValues.client,
									onChange: (e) => setNewProjectValues({
										...newProjectValues,
										client: e.target.value
									}),
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none",
									placeholder: "e.g. Marina Holdings"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-2 items-start mt-1 p-2 bg-primary/5 border border-primary/20 text-primary rounded",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px]",
										children: "Warning: Creating a new project will clear all spaces, zones, and equipment in the current schedule."
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setNewProjectOpen(false),
								className: "border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									createNewProject({
										name: newProjectValues.name,
										code: newProjectValues.code,
										client: newProjectValues.client
									});
									setNewProjectOpen(false);
								},
								className: "bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95",
								children: "Create Project"
							})]
						})
					]
				})
			})
		]
	});
}
function FilterDropdown({ label, selectedValue, onSelect, options }) {
	const active = !!selectedValue;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			className: `inline-flex items-center gap-1 h-7 px-3 rounded-full text-[11.5px] border transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer ${active ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15" : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: active ? `${label}: ${selectedValue}` : label }), active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				role: "button",
				tabIndex: 0,
				onClick: (e) => {
					e.preventDefault();
					e.stopPropagation();
					onSelect(null);
				},
				onKeyDown: (e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						e.stopPropagation();
						onSelect(null);
					}
				},
				className: "ml-1 hover:bg-primary/20 rounded-full p-0.5 cursor-pointer flex items-center justify-center shrink-0",
				title: `Clear ${label} filter`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3" })
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3 text-muted-foreground shrink-0" })]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
		align: "start",
		className: "w-56 font-mori",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuLabel, {
				className: "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-1 px-2",
				children: ["Filter by ", label]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuRadioGroup, {
				value: selectedValue || "all-options",
				onValueChange: (val) => {
					if (val === "all-options") onSelect(null);
					else onSelect(val);
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuRadioItem, {
					value: "all-options",
					className: "text-[12px] py-1 cursor-pointer font-mori focus:bg-primary/10 focus:text-primary",
					children: [
						"All ",
						label,
						"s"
					]
				}), options.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuRadioItem, {
					value: opt,
					className: "text-[12px] py-1 cursor-pointer font-mori focus:bg-primary/10 focus:text-primary",
					children: opt
				}, opt))]
			})
		]
	})] });
}
function BulkBtn({ icon: Icon, children, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		onClick,
		className: "inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11.5px] font-semibold transition-colors text-[#06456F] hover:bg-primary/10 dark:text-[#0A7BC7] dark:hover:bg-primary/20 border border-transparent hover:border-primary/20 active:bg-primary/20 dark:active:bg-primary/30 cursor-pointer",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3 shrink-0" }),
			" ",
			children
		]
	});
}
function ZonesView() {
	const [query, setQuery] = (0, import_react.useState)("");
	const [openId, setOpenId] = (0, import_react.useState)(null);
	const { spaces, zones, deleteZone, addZone, equipment, assignZoneToEquipment, removeZoneFromEquipment, updateZoneInstances, addEquipment, updateEquipment, updateSpaces, updateZones, bulkUpdateSpaces, setWorkspaceState, undo, redo } = useWorkspace();
	const confirm = useConfirm();
	const [editingSpace, setEditingSpace] = (0, import_react.useState)(null);
	const [customParamModalSpace, setCustomParamModalSpace] = (0, import_react.useState)(null);
	const [restroomModalSpace, setRestroomModalSpace] = (0, import_react.useState)(null);
	const [selectedZones, setSelectedZones] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [lastClickedZoneIndex, setLastClickedZoneIndex] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (openId) document.body.classList.add("modal-open-blur");
		else if (document.querySelectorAll(".fixed.z-50").length <= 1) document.body.classList.remove("modal-open-blur");
		return () => {
			if (document.querySelectorAll(".fixed.z-50").length <= 1) document.body.classList.remove("modal-open-blur");
		};
	}, [openId]);
	const toggleZone = (id, isShift, isCtrl) => {
		setSelectedZones((prev) => {
			const clickedIndex = rows.findIndex((r) => r.id === id);
			if (clickedIndex === -1) return prev;
			const next = new Set(prev);
			if (isShift && lastClickedZoneIndex !== null) {
				const start = Math.min(lastClickedZoneIndex, clickedIndex);
				const end = Math.max(lastClickedZoneIndex, clickedIndex);
				if (!isCtrl) next.clear();
				const shouldSelect = prev.has(rows[lastClickedZoneIndex]?.id || "") || true;
				for (let i = start; i <= end; i++) {
					const rId = rows[i]?.id;
					if (rId) if (shouldSelect) next.add(rId);
					else next.delete(rId);
				}
			} else if (isCtrl) {
				if (next.has(id)) next.delete(id);
				else next.add(id);
				setLastClickedZoneIndex(clickedIndex);
			} else if (prev.has(id)) {
				next.delete(id);
				setLastClickedZoneIndex(null);
			} else {
				next.clear();
				next.add(id);
				setLastClickedZoneIndex(clickedIndex);
			}
			return next;
		});
	};
	const [zoneAllocOpen, setZoneAllocOpen] = (0, import_react.useState)(false);
	const [allocZoneId, setAllocZoneId] = (0, import_react.useState)(null);
	const [allocEquipId, setAllocEquipId] = (0, import_react.useState)(null);
	const [editZoneOpen, setEditZoneOpen] = (0, import_react.useState)(false);
	const [editingZoneId, setEditingZoneId] = (0, import_react.useState)(null);
	const [editZoneName, setEditZoneName] = (0, import_react.useState)("");
	const handleRenameZone = async () => {
		const newName = editZoneName.trim();
		if (!newName || !editingZoneId) return;
		const zone = zones.find((z) => z.id === editingZoneId);
		if (!zone) return;
		if (newName.toLowerCase() !== zone.name.toLowerCase()) {
			if (zones.some((z) => z.id !== editingZoneId && z.name.toLowerCase() === newName.toLowerCase())) {
				await confirm(`Zone already exists with this name "${newName}".`, {
					title: "Zone Already Exists",
					confirmText: "OK",
					hideCancel: true
				});
				return;
			}
		}
		const updatedZones = zones.map((z) => {
			if (z.id === editingZoneId) return {
				...z,
				name: newName
			};
			return z;
		});
		const updatedSpaces = spaces.map((s) => {
			if (s.zone === editingZoneId || s.zone === zone.name) return {
				...s,
				zone: newName
			};
			return s;
		});
		updateZones(updatedZones);
		updateSpaces(updatedSpaces);
	};
	const handleCloseEditZone = () => {
		handleRenameZone();
		setEditZoneOpen(false);
		setEditingZoneId(null);
	};
	const handleCreateSpaceInZone = () => {
		const code = `SP-${String(spaces.length + 1).padStart(3, "0")}`;
		const newSpace = {
			id: `space-${Date.now()}`,
			code,
			name: `Space ${spaces.length + 1}`,
			building: "Tower A",
			floor: "L01",
			category: "",
			area: 20,
			occupancy: 0,
			height: 3,
			fixtures: 0,
			multiplier: 1,
			zone: editZoneName,
			equipment: "",
			freshAir: 0,
			extractAir: 0,
			pressure: "Neutral",
			status: "draft",
			aiDetected: false,
			pressureAutoDetected: false
		};
		updateSpaces([...spaces, newSpace]);
	};
	const addSpaceToEditingZone = async (spaceId) => {
		const targetSpace = spaces.find((s) => s.id === spaceId);
		if (targetSpace && targetSpace.zone && targetSpace.zone !== "Default" && targetSpace.zone !== "unzoned") {
			if (!await confirm(`This space is already assigned to "${targetSpace.zone}". Are you sure you want to move it to "${editZoneName}"?`, {
				title: "Reassign Space",
				confirmText: "Yes, Move Space",
				cancelText: "Cancel"
			})) return;
		}
		updateSpaces(spaces.map((s) => {
			if (s.id === spaceId) return {
				...s,
				zone: editZoneName
			};
			return s;
		}));
	};
	const removeSpaceFromEditingZone = (spaceId) => {
		updateSpaces(spaces.map((s) => {
			if (s.id === spaceId) return {
				...s,
				zone: "Default"
			};
			return s;
		}));
	};
	const [selectedBuilding, setSelectedBuilding] = (0, import_react.useState)(null);
	const [selectedFloor, setSelectedFloor] = (0, import_react.useState)(null);
	const [selectedPressure, setSelectedPressure] = (0, import_react.useState)(null);
	const uniqueBuildings = (0, import_react.useMemo)(() => {
		const vals = /* @__PURE__ */ new Set();
		zones.forEach((z) => {
			if (z.building) vals.add(z.building);
		});
		return Array.from(vals).sort();
	}, [zones]);
	const uniqueFloors = (0, import_react.useMemo)(() => {
		const vals = /* @__PURE__ */ new Set();
		zones.forEach((z) => {
			if (z.floor) vals.add(z.floor);
		});
		return Array.from(vals).sort();
	}, [zones]);
	const uniquePressures = (0, import_react.useMemo)(() => {
		const vals = /* @__PURE__ */ new Set();
		zones.forEach((z) => {
			if (z.pressureType) {
				const formatted = z.pressureType.charAt(0).toUpperCase() + z.pressureType.slice(1);
				vals.add(formatted);
			}
		});
		return Array.from(vals).sort();
	}, [zones]);
	const rows = (0, import_react.useMemo)(() => {
		const q = query.toLowerCase().trim();
		return zones.filter((z) => {
			if (selectedBuilding && z.building !== selectedBuilding) return false;
			if (selectedFloor && z.floor !== selectedFloor) return false;
			if (selectedPressure) {
				if (z.pressureType.toLowerCase() !== selectedPressure.toLowerCase()) return false;
			}
			return !q || `${z.name} ${z.building} ${z.floor}`.toLowerCase().includes(q);
		});
	}, [
		zones,
		query,
		selectedBuilding,
		selectedFloor,
		selectedPressure
	]);
	const opened = (0, import_react.useMemo)(() => {
		if (selectedZones.size > 1) return null;
		return zones.find((z) => z.id === openId);
	}, [
		zones,
		openId,
		selectedZones
	]);
	const openedSpaces = (0, import_react.useMemo)(() => opened ? spaces.filter((s) => s.zone === opened.id || s.zone === opened.name) : [], [spaces, opened]);
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			const activeEl = document.activeElement;
			if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT" || activeEl.tagName === "TEXTAREA" || activeEl.getAttribute("contenteditable") === "true")) return;
			const isCmdOrCtrl = navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? e.metaKey : e.ctrlKey;
			if (e.key === "Escape") {
				e.preventDefault();
				setSelectedZones(/* @__PURE__ */ new Set());
				setOpenId(null);
				return;
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
				e.preventDefault();
				if (rows.length > 0) setSelectedZones(new Set(rows.map((r) => r.id)));
				return;
			}
			if (e.key === "Delete" || e.key === "Backspace") {
				if (selectedZones.size > 0) {
					e.preventDefault();
					confirm(`Are you sure you want to dissolve the ${selectedZones.size} selected zones?`).then((ok) => {
						if (ok) {
							selectedZones.forEach((id) => deleteZone(id));
							setSelectedZones(/* @__PURE__ */ new Set());
						}
					});
				}
				return;
			}
			if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
				e.preventDefault();
				undo();
				return;
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "y" || isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z") {
				e.preventDefault();
				redo();
				return;
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [
		rows,
		selectedZones,
		deleteZone,
		setOpenId,
		undo,
		redo
	]);
	const getZoneEditIds = (zId) => {
		return selectedZones.has(zId) ? Array.from(selectedZones) : [zId];
	};
	const columns = [
		{
			key: "name",
			header: "Zone Name",
			width: 180,
			render: (z) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1.5 font-sans font-medium",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: (e) => {
						e.stopPropagation();
						setOpenId(openId === z.id ? null : z.id);
						setSelectedZones(/* @__PURE__ */ new Set([z.id]));
					},
					title: openId === z.id ? "Collapse detailed spaces list" : "Expand detailed spaces list",
					className: "p-0.5 rounded hover:bg-surface-3 text-muted-foreground hover:text-foreground cursor-pointer transition-colors",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: `size-3.5 transition-transform duration-200 ${openId === z.id ? "rotate-180" : ""}` })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: z.name })]
			})
		},
		{
			key: "floor",
			header: "Floor",
			width: 100,
			mono: true
		},
		{
			key: "spaceCount",
			header: "Spaces",
			width: 80,
			align: "center",
			mono: true
		},
		{
			key: "area",
			header: "Area (m²)",
			width: 100,
			align: "center",
			render: (z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: z.area.toFixed(0) }),
			mono: true
		},
		{
			key: "multiplier",
			header: "Mult.",
			width: 80,
			align: "center",
			render: (z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				onClick: (e) => e.stopPropagation(),
				onDoubleClick: (e) => e.stopPropagation(),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
					value: z.multiplier || 1,
					type: "number",
					min: 1,
					onCommit: (val) => {
						const m = Math.max(1, parseInt(val) || 1);
						const editIds = getZoneEditIds(z.id);
						updateZones(zones.map((zoneItem) => {
							if (editIds.includes(zoneItem.id)) {
								const clamp = (assigns) => {
									if (!assigns) return {};
									const res = {};
									let total = 0;
									for (const [eqId, q] of Object.entries(assigns)) {
										const left = m - total;
										if (left <= 0) break;
										const qClamp = Math.min(q, left);
										res[eqId] = qClamp;
										total += qClamp;
									}
									return res;
								};
								const faAssigns = clamp(zoneItem.faAssignments);
								const eaAssigns = clamp(zoneItem.eaAssignments);
								const firstFA = Object.keys(faAssigns)[0] || null;
								const firstEA = Object.keys(eaAssigns)[0] || null;
								return {
									...zoneItem,
									multiplier: m,
									faAssignments: faAssigns,
									eaAssignments: eaAssigns,
									faAssignment: firstFA,
									eaAssignment: firstEA,
									faAssignedQty: firstFA ? faAssigns[firstFA] : 1,
									eaAssignedQty: firstEA ? eaAssigns[firstEA] : 1
								};
							}
							return zoneItem;
						}));
					},
					className: "w-12 text-center text-xs"
				})
			}),
			mono: true
		},
		{
			key: "assignmentRate",
			header: "Assign Rate",
			width: 100,
			align: "center",
			render: (z) => {
				const mult = z.multiplier || 1;
				const totalSlots = 2 * mult;
				let assignedCount = 0;
				if (z.instances && z.instances.length > 0) for (let idx = 1; idx <= mult; idx++) {
					const inst = z.instances.find((i) => i.instanceIndex === idx);
					if (inst) {
						if (inst.faEquipId) assignedCount++;
						if (inst.eaEquipId) assignedCount++;
					}
				}
				else assignedCount = (z.faAssignments ? Object.values(z.faAssignments).reduce((a, b) => a + b, 0) : z.faAssignment ? z.faAssignedQty || 1 : 0) + (z.eaAssignments ? Object.values(z.eaAssignments).reduce((a, b) => a + b, 0) : z.eaAssignment ? z.eaAssignedQty || 1 : 0);
				const rate = Math.round(assignedCount / totalSlots * 100);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					title: `${assignedCount} of ${totalSlots} assignment slots filled`,
					className: `font-mono text-[11px] font-bold px-2 py-0.5 rounded-full select-none cursor-help ${rate === 100 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : rate > 0 ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "bg-muted text-muted-foreground/60"}`,
					children: [rate, "%"]
				});
			},
			mono: true
		},
		{
			key: "freshAir",
			header: "Fresh Given",
			width: 120,
			align: "center",
			render: (z) => z.faAssignment ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 tabular-nums",
				children: [z.freshAir.toLocaleString(), " L/s"]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-muted-foreground/40 font-normal tabular-nums",
				children: [z.freshAir.toLocaleString(), " L/s"]
			}),
			mono: true
		},
		{
			key: "extractAir",
			header: "Extract Taken",
			width: 120,
			align: "center",
			render: (z) => z.eaAssignment ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 tabular-nums",
				children: [z.extractAir.toLocaleString(), " L/s"]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-muted-foreground/40 font-normal tabular-nums",
				children: [z.extractAir.toLocaleString(), " L/s"]
			}),
			mono: true
		},
		{
			key: "equipment",
			header: "Equipment",
			width: 160,
			align: "center",
			render: (z) => {
				const list = [];
				const faAssigns = z.faAssignments ? Object.keys(z.faAssignments) : z.faAssignment ? [z.faAssignment] : [];
				const eaAssigns = z.eaAssignments ? Object.keys(z.eaAssignments) : z.eaAssignment ? [z.eaAssignment] : [];
				faAssigns.forEach((id) => {
					const eq = equipment.find((e) => e.id === id);
					if (eq && !list.includes(eq.tag)) list.push(eq.tag);
				});
				eaAssigns.forEach((id) => {
					const eq = equipment.find((e) => e.id === id);
					if (eq && !list.includes(eq.tag)) list.push(eq.tag);
				});
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate block text-muted-foreground font-medium",
					title: list.join(", "),
					children: list.join(", ") || "None"
				});
			},
			mono: true
		},
		{
			key: "flagged",
			header: "",
			width: 36,
			align: "center",
			render: (z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: (e) => {
					e.stopPropagation();
					updateZones(zones.map((zoneItem) => zoneItem.id === z.id ? {
						...zoneItem,
						flagged: !zoneItem.flagged
					} : zoneItem));
				},
				className: "p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto",
				title: z.freshAir === 0 && z.extractAir === 0 ? "The zone contains spaces which don't have min fresh and extract air" : z.flagged ? "Unflag zone" : "Flag zone",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flag, { className: `size-3.5 transition-all duration-200 ${z.flagged ? "fill-red-500 text-red-500 scale-110" : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"}` })
			})
		}
	];
	const toggleAllZones = () => {
		if (selectedZones.size === rows.length) setSelectedZones(/* @__PURE__ */ new Set());
		else setSelectedZones(new Set(rows.map((r) => r.id)));
	};
	const renderZoneContextMenu = (z) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuContent, {
		className: "w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50",
		children: [
			selectedZones.size <= 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
				onClick: () => {
					setEditingZoneId(z.id);
					setEditZoneName(z.name);
					setEditZoneOpen(true);
				},
				className: "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground cursor-pointer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Edit Zone Spaces" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
				onClick: () => {
					if (!zones.find((item) => item.id === z.id)) return;
					setAllocZoneId(z.id);
					setZoneAllocOpen(true);
				},
				className: "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground cursor-pointer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Manage Equipment" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
				onClick: () => {
					setCommentTarget({
						id: z.id,
						name: z.name,
						type: "zone"
					});
					setAssignCommentOpen(true);
				},
				className: "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground cursor-pointer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Add comment" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, { className: "h-px bg-border my-1" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
				onClick: async () => {
					if (await confirm(`Are you sure you want to dissolve zone "${z.name}"?`)) {
						deleteZone(z.id);
						const next = new Set(selectedZones);
						next.delete(z.id);
						setSelectedZones(next);
					}
				},
				className: "flex items-center gap-2 px-2 py-1.5 rounded text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Dissolve Zone" })]
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col flex-1 min-h-0 h-full overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex items-center gap-1.5 px-3 min-h-10 py-1.5 shrink-0 flex-wrap bg-background no-print border-b border-border/50",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: query,
						onChange: (e) => setQuery(e.target.value),
						placeholder: "Filter zones...",
						className: "h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterDropdown, {
						label: "Building",
						selectedValue: selectedBuilding,
						onSelect: setSelectedBuilding,
						options: uniqueBuildings
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterDropdown, {
						label: "Floor",
						selectedValue: selectedFloor,
						onSelect: setSelectedFloor,
						options: uniqueFloors
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterDropdown, {
						label: "Pressure",
						selectedValue: selectedPressure,
						onSelect: setSelectedPressure,
						options: uniquePressures
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ml-auto flex items-center gap-1.5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								const name = `Z-${String(zones.length + 1).padStart(3, "0")}`;
								addZone({
									id: `zone-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
									name,
									building: "Tower A",
									floor: "L01",
									spaceCount: 0,
									area: 0,
									freshAir: 0,
									extractAir: 0,
									pressure: 0,
									equipment: [],
									pressureType: "neutral",
									multiplier: 1,
									faAssignedQty: 1,
									eaAssignedQty: 1
								});
							},
							className: "flex items-center gap-1 px-3 h-7 text-xs font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " New Zone"]
						})
					}),
					selectedZones.size > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-full bg-[#06456F]/10 border border-[#06456F]/25 dark:bg-[#0A7BC7]/15 dark:border-[#0A7BC7]/35 rounded-lg px-2.5 py-1 text-[11.5px] text-[#06456F] dark:text-[#0A7BC7] font-semibold flex items-center gap-2 mt-1 animate-fade-in shadow-xs",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "bg-[#06456F] text-white dark:bg-[#0A7BC7] dark:text-zinc-950 font-bold px-1.5 py-0.5 rounded text-[10px]",
								children: selectedZones.size
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "zone(s) selected" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-3 w-px bg-[#06456F]/20 dark:bg-[#0A7BC7]/30 mx-1" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: async () => {
									if (await confirm(`Are you sure you want to dissolve the ${selectedZones.size} selected zones?`)) {
										selectedZones.forEach((id) => deleteZone(id));
										setSelectedZones(/* @__PURE__ */ new Set());
									}
								},
								className: "hover:underline hover:text-[#06456F] font-bold text-destructive cursor-pointer",
								children: "Dissolve Selected"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setSelectedZones(/* @__PURE__ */ new Set()),
								className: "ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3" }), " Clear"]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex-1 min-h-0 overflow-hidden flex flex-col",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataGrid, {
					rows,
					columns,
					selected: selectedZones,
					onToggle: toggleZone,
					onToggleAll: toggleAllZones,
					renderContextMenu: renderZoneContextMenu,
					onRowDoubleClick: (z) => {
						setSelectedZones(/* @__PURE__ */ new Set([z.id]));
						setAllocZoneId(z.id);
						setZoneAllocOpen(true);
					},
					rowClassName: (row, index) => index % 2 === 0 ? "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebef]/80 dark:hover:bg-[#25252b]/80" : "bg-white dark:bg-zinc-950 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40"
				})
			}),
			opened && (() => {
				const faAssigns = opened.faAssignments ? Object.entries(opened.faAssignments).map(([id, q]) => [id, Number(q)]) : opened.faAssignment ? [[opened.faAssignment, opened.faAssignedQty || 1]] : [];
				const eaAssigns = opened.eaAssignments ? Object.entries(opened.eaAssignments).map(([id, q]) => [id, Number(q)]) : opened.eaAssignment ? [[opened.eaAssignment, opened.eaAssignedQty || 1]] : [];
				const totalFAQty = faAssigns.reduce((sum, [_, q]) => sum + q, 0);
				const totalEAQty = eaAssigns.reduce((sum, [_, q]) => sum + q, 0);
				const remainingFA = Math.max(0, (opened.multiplier || 1) - totalFAQty);
				const remainingEA = Math.max(0, (opened.multiplier || 1) - totalEAQty);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					onClick: () => setOpenId(null),
					className: "fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/10 dark:bg-black/30 p-4 animate-fade-in",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						onClick: (e) => e.stopPropagation(),
						className: "bg-white/70 dark:bg-neutral-950/70 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-[24px] shadow-[0_30px_70px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col w-full max-w-4xl max-h-[85vh] overflow-hidden",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
								className: "px-6 h-[64px] flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/10 dark:bg-black/10 select-none",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400",
											children: "Spaces in Zone"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono font-bold text-primary text-[13px] bg-primary/10 px-2 py-0.5 rounded-lg",
											children: opened.name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[11px] font-semibold text-muted-foreground/60",
											children: [
												"(",
												openedSpaces.length,
												" spaces)"
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => {
												setEditingZoneId(opened.id);
												setEditZoneName(opened.name);
												setEditZoneOpen(true);
											},
											className: "text-[11px] text-primary hover:text-primary-strong bg-primary/10 hover:bg-primary/20 px-2.5 py-0.5 rounded-full font-semibold ml-2 transition-colors duration-150 cursor-pointer",
											children: "Edit Zone"
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setOpenId(null),
									className: "text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1 rounded-full hover:bg-surface-3",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-4 px-6 py-4 border-b border-black/5 dark:border-white/5 bg-white/40 dark:bg-black/10 shrink-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between select-none",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] uppercase font-bold tracking-wider text-neutral-500 dark:text-neutral-400",
										children: "Equipment Assignments:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full px-2.5 py-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11px] font-bold text-neutral-500 dark:text-neutral-400 select-none",
											children: "Zone Multiplier:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => {
														const currentMult = opened.multiplier || 1;
														if (currentMult > 1) {
															const val = currentMult - 1;
															updateZones(zones.map((z) => z.id === opened.id ? {
																...z,
																multiplier: val
															} : z));
														}
													},
													className: "size-4.5 rounded-full bg-white dark:bg-white/10 shadow-sm flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-white/20 text-foreground transition-all duration-100 cursor-pointer font-bold text-xs",
													children: "-"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													min: 1,
													value: opened.multiplier || 1,
													onChange: (e) => {
														const val = Math.max(1, parseInt(e.target.value) || 1);
														updateZones(zones.map((z) => z.id === opened.id ? {
															...z,
															multiplier: val
														} : z));
													},
													className: "w-7 bg-transparent text-center border-0 outline-none text-foreground font-mono font-bold text-[11px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => {
														const val = (opened.multiplier || 1) + 1;
														updateZones(zones.map((z) => z.id === opened.id ? {
															...z,
															multiplier: val
														} : z));
													},
													className: "size-4.5 rounded-full bg-white dark:bg-white/10 shadow-sm flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-white/20 text-foreground transition-all duration-100 cursor-pointer font-bold text-xs",
													children: "+"
												})
											]
										})]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-1 md:grid-cols-2 gap-6",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-2.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between border-b border-black/5 pb-1 dark:border-white/5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[11.5px] font-bold text-neutral-700 dark:text-neutral-300",
													children: "Fresh Air (FA) Stream"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[10.5px] text-muted-foreground font-mono",
													children: [
														"Assigned: ",
														totalFAQty,
														"/",
														opened.multiplier || 1
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1",
												children: [faAssigns.map(([eqId, qty]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2 animate-fade-in",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
															value: eqId,
															onChange: (e) => {
																const nextVal = e.target.value;
																if (!nextVal) removeZoneFromEquipment(opened.id, eqId, "FA");
																else {
																	removeZoneFromEquipment(opened.id, eqId, "FA");
																	assignZoneToEquipment(opened.id, nextVal, "FA", qty);
																}
															},
															className: "flex-1 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground font-semibold cursor-pointer transition-all",
															children: equipment.filter((e) => e.type === "MAHU" || e.type === "Air Handling Unit" || e.type === "FAHU" && (e.mode === "Fresh Air Only" || e.mode === "Fresh Air + Extract Air") || e.id === eqId).map((eq) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
																value: eq.id,
																children: [
																	eq.tag,
																	" (",
																	eq.type,
																	")"
																]
															}, eq.id))
														}),
														(opened.multiplier || 1) > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-1 shrink-0",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[10px] text-muted-foreground",
																children: "Qty:"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																min: 1,
																max: qty + remainingFA,
																value: qty,
																onChange: (e) => {
																	const val = Math.max(1, Math.min(qty + remainingFA, parseInt(e.target.value) || 1));
																	assignZoneToEquipment(opened.id, eqId, "FA", val);
																},
																className: "w-12 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-1 py-1 text-[11px] text-center outline-none text-foreground font-semibold focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => removeZoneFromEquipment(opened.id, eqId, "FA"),
															className: "text-destructive hover:bg-destructive/10 p-1.5 rounded transition-colors cursor-pointer",
															title: "Remove assignment",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
														})
													]
												}, eqId)), faAssigns.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[11.5px] text-muted-foreground italic py-1",
													children: "No Fresh Air unit assigned."
												})]
											}),
											remainingFA > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex items-center gap-2",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
													value: "",
													onChange: (e) => {
														const val = e.target.value;
														if (val) assignZoneToEquipment(opened.id, val, "FA", (opened.multiplier || 1) > 1 ? 1 : remainingFA);
													},
													className: "w-full bg-white/30 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 border border-dashed border-black/20 dark:border-white/20 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "",
														children: "+ Assign Fresh Air (FA) Unit..."
													}), equipment.filter((e) => e.type === "MAHU" || e.type === "Air Handling Unit" || e.type === "FAHU" && (e.mode === "Fresh Air Only" || e.mode === "Fresh Air + Extract Air")).filter((e) => !faAssigns.some(([eqId]) => eqId === e.id)).map((eq) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
														value: eq.id,
														children: [
															eq.tag,
															" (",
															eq.type,
															")"
														]
													}, eq.id))]
												})
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-2.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between border-b border-black/5 pb-1 dark:border-white/5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[11.5px] font-bold text-neutral-700 dark:text-neutral-300",
													children: "Extract Air (EA) Stream"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[10.5px] text-muted-foreground font-mono",
													children: [
														"Assigned: ",
														totalEAQty,
														"/",
														opened.multiplier || 1
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1",
												children: [eaAssigns.map(([eqId, qty]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2 animate-fade-in",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
															value: eqId,
															onChange: (e) => {
																const nextVal = e.target.value;
																if (!nextVal) removeZoneFromEquipment(opened.id, eqId, "EA");
																else {
																	removeZoneFromEquipment(opened.id, eqId, "EA");
																	assignZoneToEquipment(opened.id, nextVal, "EA", qty);
																}
															},
															className: "flex-1 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground font-semibold cursor-pointer transition-all",
															children: equipment.filter((e) => e.type === "Ecology" || e.type === "FAHU" && (e.mode === "Extract Air Only" || e.mode === "Fresh Air + Extract Air") || e.id === eqId).map((eq) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
																value: eq.id,
																children: [
																	eq.tag,
																	" (",
																	eq.type,
																	")"
																]
															}, eq.id))
														}),
														(opened.multiplier || 1) > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-1 shrink-0",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[10px] text-muted-foreground",
																children: "Qty:"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																min: 1,
																max: qty + remainingEA,
																value: qty,
																onChange: (e) => {
																	const val = Math.max(1, Math.min(qty + remainingEA, parseInt(e.target.value) || 1));
																	assignZoneToEquipment(opened.id, eqId, "EA", val);
																},
																className: "w-12 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-1 py-1 text-[11px] text-center outline-none text-foreground font-semibold focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => removeZoneFromEquipment(opened.id, eqId, "EA"),
															className: "text-destructive hover:bg-destructive/10 p-1.5 rounded transition-colors cursor-pointer",
															title: "Remove assignment",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
														})
													]
												}, eqId)), eaAssigns.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[11.5px] text-muted-foreground italic py-1",
													children: "No Extract Air unit assigned."
												})]
											}),
											remainingEA > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex items-center gap-2",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
													value: "",
													onChange: (e) => {
														const val = e.target.value;
														if (val) assignZoneToEquipment(opened.id, val, "EA", (opened.multiplier || 1) > 1 ? 1 : remainingEA);
													},
													className: "w-full bg-white/30 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 border border-dashed border-black/20 dark:border-white/20 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "",
														children: "+ Assign Extract Air (EA) Unit..."
													}), equipment.filter((e) => e.type === "Ecology" || e.type === "FAHU" && (e.mode === "Extract Air Only" || e.mode === "Fresh Air + Extract Air")).filter((e) => !eaAssigns.some(([eqId]) => eqId === e.id)).map((eq) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
														value: eq.id,
														children: [
															eq.tag,
															" (",
															eq.type,
															")"
														]
													}, eq.id))]
												})
											})
										]
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex-1 overflow-auto",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
									className: "w-full text-[12.5px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
										className: "bg-header-bg sticky top-0 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/50 z-10 select-none",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-6 py-3 text-left font-bold",
												children: "ID"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-6 py-3 text-left font-bold",
												children: "Name"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-6 py-3 text-left font-bold",
												children: "Category"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-6 py-3 text-right font-bold",
												children: "Area (mÂ²)"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-6 py-3 text-right font-bold",
												children: "Fresh Given"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-6 py-3 text-right font-bold",
												children: "Extract Taken"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-6 py-3 text-center font-bold w-12",
												children: "Edit"
											})
										] })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: openedSpaces.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
										onDoubleClick: () => setEditingSpace(s),
										className: "border-b border-border/40 hover:bg-row-hover/50 cursor-pointer select-none text-[12px] transition-colors animate-fade-in",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-6 py-2.5 font-mono text-primary font-bold hover:underline cursor-pointer",
												onClick: (e) => {
													e.stopPropagation();
													setEditingSpace(s);
												},
												children: s.code
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-6 py-2.5 font-semibold text-foreground",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
													value: s.name,
													onCommit: (val) => bulkUpdateSpaces([s.id], { name: val.trim() || s.name }),
													className: "font-semibold text-[12px]"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-6 py-2.5 text-muted-foreground",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "inline-flex items-center gap-1.5 w-full",
													onClick: (e) => e.stopPropagation(),
													onDoubleClick: (e) => e.stopPropagation(),
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														title: s.aiDetected ? "Automatically identified" : void 0,
														className: `size-1.5 rounded-full shrink-0 ${s.aiDetected ? "bg-primary cursor-help" : "bg-transparent pointer-events-none"}`
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-1 w-full min-w-0",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CategorySelect, {
															value: s.category || "",
															onChange: (newVal) => {
																if (newVal === "Other" || newVal === "OTHER") {
																	const latestSpace = workspaceStore.getState().spaces.find((sp) => sp.id === s.id) || s;
																	const categoryName = latestSpace.category && latestSpace.category.endsWith(" (Custom)") ? latestSpace.category : "Custom (Custom)";
																	bulkUpdateSpaces([s.id], {
																		category: categoryName,
																		aiDetected: false
																	});
																	setTimeout(() => {
																		const freshSpace = workspaceStore.getState().spaces.find((sp) => sp.id === s.id) || latestSpace;
																		setCustomParamModalSpace({
																			...freshSpace,
																			category: categoryName,
																			customWorkflow: freshSpace.customWorkflow || "calculate",
																			customPeopleOA: freshSpace.customPeopleOA || 0,
																			customAreaOA: freshSpace.customAreaOA || 0,
																			customExhaustPerUnit: freshSpace.customExhaustPerUnit || 0,
																			customExhaustPerArea: freshSpace.customExhaustPerArea || 0,
																			customAch: freshSpace.customAch || 0,
																			customFreshGiven: freshSpace.customFreshGiven || 0,
																			customExtTaken: freshSpace.customExtTaken || 0
																		});
																	}, 50);
																	return;
																}
																if (newVal === "Rest Room / Changing Room") {
																	const latestSpace = workspaceStore.getState().spaces.find((sp) => sp.id === s.id) || s;
																	const spaceCopy = {
																		...latestSpace,
																		category: newVal,
																		aiDetected: false
																	};
																	if (!spaceCopy.restroomSubCategories) spaceCopy.restroomSubCategories = {
																		toiletPrivateContinuous: 0,
																		toiletPublicContinuous: 0,
																		toiletPrivateDiscontinuous: 0,
																		toiletPublicDiscontinuous: 0,
																		showerContinuous: 0,
																		showerDiscontinuous: 0,
																		janitorCloset: 0,
																		lockerRoom: 0
																	};
																	const data = getOccupancyData(newVal);
																	const updates = {
																		category: newVal,
																		aiDetected: false,
																		restroomSubCategories: spaceCopy.restroomSubCategories
																	};
																	if (data && !latestSpace.isOccupancyCustomized) {
																		const defaultOcc = data.exhaustPerUnit > 0 && data.defaultDensity === 0 ? 1 : Math.ceil(latestSpace.area * data.defaultDensity / 100);
																		updates.occupancy = defaultOcc;
																		updates.fixtures = data.exhaustPerUnit > 0 ? defaultOcc.toString() : "";
																	}
																	bulkUpdateSpaces([s.id], updates);
																	setTimeout(() => {
																		setRestroomModalSpace(workspaceStore.getState().spaces.find((sp) => sp.id === s.id) || spaceCopy);
																	}, 50);
																	return;
																}
																const data = getOccupancyData(newVal);
																const updates = {
																	category: newVal,
																	aiDetected: false
																};
																if (data && !s.isOccupancyCustomized) {
																	const defaultOcc = data.exhaustPerUnit > 0 && data.defaultDensity === 0 ? 1 : Math.ceil(s.area * data.defaultDensity / 100);
																	updates.occupancy = defaultOcc;
																	updates.fixtures = data.exhaustPerUnit > 0 ? defaultOcc.toString() : "";
																}
																bulkUpdateSpaces([s.id], updates);
															}
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															type: "button",
															onClick: () => {
																if (s.category === "Rest Room / Changing Room") setRestroomModalSpace(s);
																else setCustomParamModalSpace({
																	...s,
																	customWorkflow: s.customWorkflow || "calculate",
																	customPeopleOA: s.customPeopleOA || 0,
																	customAreaOA: s.customAreaOA || 0,
																	customExhaustPerUnit: s.customExhaustPerUnit || 0,
																	customExhaustPerArea: s.customExhaustPerArea || 0,
																	customAch: s.customAch || 0,
																	customFreshGiven: s.customFreshGiven || 0,
																	customExtTaken: s.customExtTaken || 0
																});
															},
															className: `flex items-center justify-center p-1 rounded-md hover:bg-surface-2 text-primary hover:text-primary/80 transition-colors shrink-0 cursor-pointer ${s.category === "Rest Room / Changing Room" || s.category && s.category.endsWith(" (Custom)") ? "opacity-100" : "opacity-0 pointer-events-none"}`,
															title: s.category === "Rest Room / Changing Room" ? "Configure Rest Room subcategories" : "Configure Custom Parameters",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wrench, { className: "size-3.5" })
														})]
													})]
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-6 py-2.5 text-right font-mono tabular",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
													type: "number",
													step: "0.1",
													min: 0,
													value: s.area,
													onCommit: (val) => {
														const num = parseFloat(val);
														if (!isNaN(num) && num >= 0) bulkUpdateSpaces([s.id], { area: num });
													},
													className: "font-mono tabular text-[12px] text-center"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "px-6 py-2.5 text-right font-mono font-semibold text-primary tabular-nums",
												children: [s.freshAir.toLocaleString(), " L/s"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "px-6 py-2.5 text-right font-mono font-semibold text-pink-600 dark:text-pink-400 tabular-nums",
												children: [s.extractAir.toLocaleString(), " L/s"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-6 py-2.5 text-center",
												onClick: (e) => e.stopPropagation(),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => setEditingSpace(s),
													title: "Edit Space Parameters",
													className: "p-1 rounded hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5" })
												})
											})
										]
									}, s.id)) })]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
								className: "px-6 py-4 border-t border-black/5 dark:border-white/5 flex items-center justify-end bg-white/10 dark:bg-black/10 shrink-0",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setOpenId(null),
									className: "bg-primary text-primary-foreground text-xs font-semibold px-5 py-2 rounded-xl hover:bg-primary/95 transition-all duration-150 cursor-pointer shadow-md shadow-primary/10",
									children: "Close"
								})
							})
						]
					})
				});
			})(),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SharedAssignmentModal, {
				isOpen: zoneAllocOpen,
				initialEquipmentId: allocEquipId,
				initialZoneId: selectedZones.size > 1 ? null : allocZoneId,
				initialZoneIds: selectedZones.size > 1 ? Array.from(selectedZones) : allocZoneId ? [] : Array.from(selectedZones),
				onClose: () => {
					setZoneAllocOpen(false);
					setAllocZoneId(null);
					setAllocEquipId(null);
				}
			}),
			editZoneOpen && (() => {
				const zoneObj = zones.find((z) => z.id === editingZoneId);
				if (!zoneObj) return null;
				const currentSpaces = spaces.filter((s) => s.zone === zoneObj.id || s.zone === zoneObj.name);
				const otherSpaces = spaces.filter((s) => s.zone !== zoneObj.id && s.zone !== zoneObj.name);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-background border border-border rounded-2xl shadow-lg w-full max-w-2xl animate-scale-in flex flex-col max-h-[85vh]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
								className: "px-4 py-3 border-b border-border flex items-center justify-between shrink-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
									className: "font-semibold text-[14px]",
									children: ["Edit Zone: ", zoneObj.name]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: handleCloseEditZone,
									className: "text-muted-foreground hover:text-foreground",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-4 flex flex-col gap-4 text-xs overflow-y-auto flex-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-2 items-end shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-muted-foreground font-medium mb-1",
												children: "Zone Name"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												value: editZoneName,
												onChange: (e) => setEditZoneName(e.target.value),
												className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none text-foreground font-medium"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: handleRenameZone,
											className: "bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded hover:bg-primary/95 h-[32px] shrink-0",
											children: "Save Name"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center border-t border-border pt-3 shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium text-muted-foreground",
											children: "Manage Spaces inside this Zone"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: handleCreateSpaceInZone,
											className: "border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2 text-foreground font-medium inline-flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), "Create Blank Space"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4 flex-1 min-h-[300px]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border rounded flex flex-col min-h-0 bg-surface-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "px-3 py-2 border-b border-border bg-header-bg font-semibold text-foreground flex justify-between items-center shrink-0",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
													"Spaces in Zone (",
													currentSpaces.length,
													")"
												] })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex-1 overflow-y-auto p-2 flex flex-col gap-1.5",
												children: currentSpaces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-muted-foreground text-center py-8",
													children: "No spaces in this zone."
												}) : currentSpaces.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-center bg-background border border-border rounded p-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "font-mono text-muted-foreground text-[10.5px]",
															children: s.code
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "font-medium text-foreground",
															children: s.name
														}),
														s.category && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[10px] text-muted-foreground",
															children: s.category
														})
													] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
														onClick: () => removeSpaceFromEditingZone(s.id),
														className: "text-destructive hover:bg-destructive/10 p-1 rounded transition-colors",
														title: "Remove from Zone",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
													})]
												}, s.id))
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border rounded flex flex-col min-h-0 bg-surface-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "px-3 py-2 border-b border-border bg-header-bg font-semibold text-foreground shrink-0",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
													"Other Project Spaces (",
													otherSpaces.length,
													")"
												] })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex-1 overflow-y-auto p-2 flex flex-col gap-1.5",
												children: otherSpaces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-muted-foreground text-center py-8",
													children: "No other spaces available."
												}) : otherSpaces.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-center bg-background border border-border rounded p-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "font-mono text-muted-foreground text-[10.5px]",
															children: s.code
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "font-medium text-foreground",
															children: s.name
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[10px] text-muted-foreground",
															children: s.zone && s.zone !== "Default" && s.zone !== "unzoned" ? `Zone: ${s.zone}` : "Unzoned"
														})
													] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
														onClick: () => addSpaceToEditingZone(s.id),
														className: "text-success hover:bg-success/10 p-1 rounded transition-colors",
														title: "Add to Zone",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" })
													})]
												}, s.id))
											})]
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
								className: "px-4 py-3 border-t border-border flex items-center justify-end bg-header-bg shrink-0",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: handleCloseEditZone,
									className: "bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95",
									children: "Close"
								})
							})
						]
					})
				});
			})(),
			editingSpace && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditSpaceModal, {
				space: editingSpace,
				onClose: () => setEditingSpace(null),
				onSave: (updated) => {
					let nextZones = [...zones];
					if (updated.zone && updated.zone !== "") {
						if (!zones.some((z) => z.id.toLowerCase() === updated.zone.toLowerCase() || z.name.toLowerCase() === updated.zone.toLowerCase())) {
							const newZone = {
								id: `zone-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
								name: updated.zone,
								building: updated.building || "Tower A",
								floor: updated.floor || "L01",
								spaceCount: 0,
								area: 0,
								freshAir: 0,
								extractAir: 0,
								pressure: 0,
								equipment: [],
								pressureType: "neutral",
								faAssignment: null,
								eaAssignment: null
							};
							nextZones.push(newZone);
						}
					}
					let nextEquipment = [...equipment];
					if (updated.equipment && updated.equipment !== "") {
						if (!equipment.some((eq) => eq.id.toLowerCase() === updated.equipment.toLowerCase() || eq.tag.toLowerCase() === updated.equipment.toLowerCase())) {
							const newEquip = {
								id: `equip-${Date.now()}`,
								tag: updated.equipment,
								type: "Air Handling Unit",
								zones: 0,
								spaces: 0,
								totalAirflow: 0,
								capacity: 2e3,
								utilization: 0,
								status: "design",
								mode: "Fresh Air + Extract Air",
								zoneIds: []
							};
							nextEquipment.push(newEquip);
						}
					}
					let nextSpaces = spaces.map((s) => s.id === updated.id ? updated : s);
					const mult = parseInt(String(updated.multiplier)) || 1;
					if (mult > 1) {
						const originalUpdated = {
							...updated,
							multiplier: 1
						};
						nextSpaces = nextSpaces.map((s) => s.id === updated.id ? originalUpdated : s);
						const clones = [];
						for (let i = 1; i < mult; i++) {
							const nextNum = Math.floor(Math.random() * 1e3);
							clones.push({
								...updated,
								id: `sp-${Date.now()}-${i}-${nextNum}`,
								code: `${updated.code}-${i}`,
								name: `${updated.name}-${i}`,
								multiplier: 1
							});
						}
						nextSpaces.push(...clones);
					}
					const balanced = calculateVentilation(nextSpaces, nextZones, nextEquipment);
					setWorkspaceState({
						spaces: balanced.spaces,
						zones: balanced.zones,
						equipment: balanced.equipment
					});
					setEditingSpace(null);
				},
				availableZones: zones.map((z) => z.name),
				availableEquipment: equipment.map((e) => e.tag),
				availableFloors: Array.from(new Set(spaces.map((s) => s.floor).filter(Boolean)))
			}),
			restroomModalSpace && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/30",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-sm font-bold text-slate-800 dark:text-zinc-200",
								children: "Rest Room / Changing Room Configuration"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-muted-foreground mt-0.5",
								children: "Enter the quantity of each sub-category to compute total exhaust."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setRestroomModalSpace(null),
								className: "text-muted-foreground hover:text-foreground rounded p-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-6 max-h-[60vh] overflow-y-auto space-y-4",
							children: [
								{
									key: "toiletPrivateContinuous",
									label: "Toilet - private (continuous)",
									rate: "12.5 L/s per toilet"
								},
								{
									key: "toiletPublicContinuous",
									label: "Toilet - public (continuous)",
									rate: "25.0 L/s per toilet"
								},
								{
									key: "toiletPrivateDiscontinuous",
									label: "Toilet - private (discontinuous)",
									rate: "25.0 L/s per toilet"
								},
								{
									key: "toiletPublicDiscontinuous",
									label: "Toilet - public (discontinuous)",
									rate: "35.0 L/s per toilet"
								},
								{
									key: "showerContinuous",
									label: "Shower Rooms (continuous)",
									rate: "10.0 L/s per shower"
								},
								{
									key: "showerDiscontinuous",
									label: "Shower Rooms (discontinuous)",
									rate: "25.0 L/s per shower"
								},
								{
									key: "janitorCloset",
									label: "Janitor Closets, Trash Rooms, Recycling",
									rate: `5.0 L/s per m² (${(5 * (restroomModalSpace.area || 0)).toFixed(1)} L/s for ${restroomModalSpace.area || 0} m² restroom)`
								},
								{
									key: "lockerRoom",
									label: "Locker Rooms",
									rate: `1.25 L/s per m² (${(1.25 * (restroomModalSpace.area || 0)).toFixed(1)} L/s for ${restroomModalSpace.area || 0} m² restroom)`
								}
							].map((subcat) => {
								const qty = (restroomModalSpace.restroomSubCategories || {})[subcat.key] || 0;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-4 py-1.5 border-b border-slate-100/60 dark:border-zinc-900/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[12.5px] font-semibold text-slate-700 dark:text-zinc-300",
											children: subcat.label
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-muted-foreground mt-0.5",
											children: subcat.rate
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex items-center gap-2",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											min: "0",
											value: qty,
											onChange: (e) => {
												const val = Math.max(0, parseInt(e.target.value) || 0);
												setRestroomModalSpace((prev) => {
													if (!prev) return null;
													const sub = prev.restroomSubCategories || {};
													return {
														...prev,
														restroomSubCategories: {
															...sub,
															[subcat.key]: val
														}
													};
												});
											},
											className: "w-20 h-9 px-2 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-[13px] font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-neutral-800 dark:text-neutral-200"
										})
									})]
								}, subcat.key);
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "px-6 py-4 bg-slate-50/50 dark:bg-zinc-900/30 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-bold text-muted-foreground uppercase tracking-wider",
									children: "Total Exhaust"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[15px] font-black text-primary",
									children: [
										(() => {
											const sub = restroomModalSpace.restroomSubCategories || {};
											const areaVal = restroomModalSpace.area || 0;
											let total = 0;
											total += (sub.toiletPrivateContinuous || 0) * 12.5;
											total += (sub.toiletPublicContinuous || 0) * 25;
											total += (sub.toiletPrivateDiscontinuous || 0) * 25;
											total += (sub.toiletPublicDiscontinuous || 0) * 35;
											total += (sub.showerContinuous || 0) * 10;
											total += (sub.showerDiscontinuous || 0) * 25;
											total += (sub.janitorCloset || 0) * areaVal * 5;
											total += (sub.lockerRoom || 0) * areaVal * 1.25;
											return total;
										})(),
										" ",
										"L/s"
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									updateSpaces(spaces.map((s) => s.id === restroomModalSpace.id ? restroomModalSpace : s));
									setRestroomModalSpace(null);
								},
								className: "px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:bg-primary/95 transition cursor-pointer",
								children: "Apply & Close"
							})]
						})
					]
				})
			}),
			customParamModalSpace && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-lg shadow-lg w-full max-w-md animate-scale-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-4 py-3 border-b border-border flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-semibold text-[14px]",
									children: "Configure Custom Parameters"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setCustomParamModalSpace(null),
								className: "text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded p-0.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 flex flex-col gap-4 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-muted-foreground mb-2 leading-relaxed",
									children: [
										"Define custom calculation parameters for the category of space ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-semibold text-foreground",
											children: [
												"\"",
												customParamModalSpace.name,
												"\""
											]
										}),
										"."
									]
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium mb-1",
									children: "Custom Category Name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: customParamModalSpace.category,
									onChange: (e) => setCustomParamModalSpace({
										...customParamModalSpace,
										category: e.target.value
									}),
									placeholder: "e.g. Custom (Custom)",
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium mb-1",
									children: "Workflow Method"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: customParamModalSpace.customWorkflow || "calculate",
									onChange: (e) => setCustomParamModalSpace({
										...customParamModalSpace,
										customWorkflow: e.target.value
									}),
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none cursor-pointer text-foreground",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "calculate",
										children: "Calculate Airflow Rates"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "direct",
										children: "Direct Airflow Values"
									})]
								})] }),
								customParamModalSpace.customWorkflow === "direct" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-4 border-t border-border/40 pt-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-muted-foreground font-medium mb-1",
										children: "Outdoor Air (Fresh) Given (L/s)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "any",
										value: customParamModalSpace.customFreshGiven ?? "",
										onChange: (e) => setCustomParamModalSpace({
											...customParamModalSpace,
											customFreshGiven: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
										}),
										className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-muted-foreground font-medium mb-1",
										children: "Extract Air Taken (L/s)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "any",
										value: customParamModalSpace.customExtTaken ?? "",
										onChange: (e) => setCustomParamModalSpace({
											...customParamModalSpace,
											customExtTaken: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
										}),
										className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
									})] })]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-3 border-t border-border/40 pt-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-muted-foreground font-medium mb-1",
											children: "People OA (L/s/person)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "any",
											value: customParamModalSpace.customPeopleOA ?? "",
											onChange: (e) => setCustomParamModalSpace({
												...customParamModalSpace,
												customPeopleOA: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
											}),
											className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-muted-foreground font-medium mb-1",
											children: "Area OA (L/s/mÂ²)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "any",
											value: customParamModalSpace.customAreaOA ?? "",
											onChange: (e) => setCustomParamModalSpace({
												...customParamModalSpace,
												customAreaOA: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
											}),
											className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
										})] })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-3 gap-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-muted-foreground font-medium mb-1",
												children: "ACH"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: customParamModalSpace.customAch ?? "",
												onChange: (e) => setCustomParamModalSpace({
													...customParamModalSpace,
													customAch: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
												}),
												className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-muted-foreground font-medium mb-1",
												children: "Exh / Area (L/s/mÂ²)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: customParamModalSpace.customExhaustPerArea ?? "",
												onChange: (e) => setCustomParamModalSpace({
													...customParamModalSpace,
													customExhaustPerArea: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
												}),
												className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-muted-foreground font-medium mb-1",
												children: "Exh / Unit (L/s/unit)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: customParamModalSpace.customExhaustPerUnit ?? "",
												onChange: (e) => setCustomParamModalSpace({
													...customParamModalSpace,
													customExhaustPerUnit: e.target.value === "" ? "" : parseFloat(e.target.value) || 0
												}),
												className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
											})] })
										]
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setCustomParamModalSpace(null),
								className: "border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									let catName = customParamModalSpace.category.trim();
									if (!catName) catName = "Custom (Custom)";
									else if (!catName.endsWith(" (Custom)")) catName = `${catName} (Custom)`;
									updateSpaces([{
										...customParamModalSpace,
										category: catName
									}]);
									setCustomParamModalSpace(null);
								},
								className: "bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 shadow-sm",
								children: "Save Parameters"
							})]
						})
					]
				})
			})
		]
	});
}
function EquipmentView() {
	const [query, setQuery] = (0, import_react.useState)("");
	const { spaces, zones, equipment, updateEquipment, deleteEquipment, setWorkspaceState, undo, redo } = useWorkspace();
	const confirm = useConfirm();
	const [sizerOpen, setSizerOpen] = (0, import_react.useState)(false);
	const [sizerEquipId, setSizerEquipId] = (0, import_react.useState)(null);
	const [sizerShowAdd, setSizerShowAdd] = (0, import_react.useState)(false);
	const onOpenSizer = (equipId) => {
		setSizerEquipId(equipId);
		setSizerShowAdd(false);
		setSizerOpen(true);
	};
	const [selectedType, setSelectedType] = (0, import_react.useState)(null);
	const [selectedEquips, setSelectedEquips] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [lastClickedEquipIndex, setLastClickedEquipIndex] = (0, import_react.useState)(null);
	const toggleEquipment = (id, isShift, isCtrl) => {
		setSelectedEquips((prev) => {
			const clickedIndex = rows.findIndex((r) => r.id === id);
			if (clickedIndex === -1) return prev;
			const next = new Set(prev);
			if (isShift && lastClickedEquipIndex !== null) {
				const start = Math.min(lastClickedEquipIndex, clickedIndex);
				const end = Math.max(lastClickedEquipIndex, clickedIndex);
				if (!isCtrl) next.clear();
				const shouldSelect = prev.has(rows[lastClickedEquipIndex]?.id || "") || true;
				for (let i = start; i <= end; i++) {
					const rId = rows[i]?.id;
					if (rId) if (shouldSelect) next.add(rId);
					else next.delete(rId);
				}
			} else if (isCtrl) {
				if (next.has(id)) next.delete(id);
				else next.add(id);
				setLastClickedEquipIndex(clickedIndex);
			} else if (prev.has(id)) {
				next.delete(id);
				setLastClickedEquipIndex(null);
			} else {
				next.clear();
				next.add(id);
				setLastClickedEquipIndex(clickedIndex);
			}
			return next;
		});
	};
	const getAirType = (type) => {
		const t = type.toLowerCase();
		if (t === "fahu") return "Fresh Air";
		if (t === "ecology" || t === "ecology unit") return "Extract Air";
		return "Fresh and Extract Air";
	};
	const columns = [
		{
			key: "tag",
			header: "Equipment",
			width: 220,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-semibold text-foreground text-[13px]",
				children: r.tag
			})
		},
		{
			key: "type",
			header: "Type",
			width: 140,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground text-[12.5px]",
				children: r.type
			})
		},
		{
			key: "airType",
			header: "Air Type",
			width: 200,
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground text-[12.5px]",
				children: getAirType(r.type)
			})
		},
		{
			key: "zones",
			header: "Zones",
			width: 100,
			align: "center",
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-[12.5px]",
				children: r.zones
			})
		},
		{
			key: "spaces",
			header: "Spaces",
			width: 100,
			align: "center",
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-[12.5px]",
				children: r.spaces
			})
		},
		{
			key: "totalFA",
			header: "Fresh Load (L/s)",
			width: 150,
			align: "center",
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-[12.5px]",
				children: (r.totalFA || 0).toLocaleString()
			})
		},
		{
			key: "totalEA",
			header: "Extract Load (L/s)",
			width: 150,
			align: "center",
			render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-[12.5px]",
				children: (r.totalEA || 0).toLocaleString()
			})
		}
	];
	const toggleAllEquipment = () => {
		setSelectedEquips((prev) => {
			if (prev.size === rows.length) return /* @__PURE__ */ new Set();
			else return new Set(rows.map((r) => r.id));
		});
	};
	const uniqueTypes = (0, import_react.useMemo)(() => {
		const vals = /* @__PURE__ */ new Set();
		equipment.forEach((e) => {
			if (e.type) vals.add(e.type);
		});
		return Array.from(vals).sort();
	}, [equipment]);
	const rows = (0, import_react.useMemo)(() => {
		const q = query.toLowerCase().trim();
		return equipment.filter((e) => {
			if (selectedType && e.type !== selectedType) return false;
			return !q || `${e.tag} ${e.type}`.toLowerCase().includes(q);
		});
	}, [
		equipment,
		query,
		selectedType
	]);
	const handleBulkDeleteEquipment = async () => {
		if (!await confirm(`Are you sure you want to delete the ${selectedEquips.size} selected equipment units?`, {
			title: "Delete Multiple Equipment",
			confirmText: "Delete",
			cancelText: "Cancel"
		})) return;
		let nextEquip = [...equipment];
		let nextZones = [...zones];
		selectedEquips.forEach((eqId) => {
			nextEquip = nextEquip.filter((e) => e.id !== eqId);
			nextZones = nextZones.map((g) => {
				const FA = g.faAssignments ? { ...g.faAssignments } : {};
				const EA = g.eaAssignments ? { ...g.eaAssignments } : {};
				delete FA[eqId];
				delete EA[eqId];
				const firstFA = Object.keys(FA)[0] || null;
				const firstEA = Object.keys(EA)[0] || null;
				return {
					...g,
					faAssignments: FA,
					faAssignment: firstFA,
					faAssignedQty: firstFA ? FA[firstFA] : 1,
					eaAssignments: EA,
					eaAssignment: firstEA,
					eaAssignedQty: firstEA ? EA[firstEA] : 1
				};
			});
		});
		const balanced = calculateVentilation(spaces, nextZones, nextEquip);
		setWorkspaceState({
			spaces: balanced.spaces,
			zones: balanced.zones,
			equipment: balanced.equipment
		});
		setSelectedEquips(/* @__PURE__ */ new Set());
	};
	const handleEquipmentDoubleClicked = (e) => {
		onOpenSizer(e.id);
	};
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			const activeEl = document.activeElement;
			if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT" || activeEl.tagName === "TEXTAREA" || activeEl.getAttribute("contenteditable") === "true")) return;
			const isCmdOrCtrl = navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? e.metaKey : e.ctrlKey;
			if (e.key === "Escape") {
				e.preventDefault();
				setSelectedEquips(/* @__PURE__ */ new Set());
				setSizerOpen(false);
				setSizerEquipId(null);
				return;
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
				e.preventDefault();
				if (rows.length > 0) setSelectedEquips(new Set(rows.map((r) => r.id)));
				return;
			}
			if (e.key === "Delete" || e.key === "Backspace") {
				if (selectedEquips.size > 0) {
					e.preventDefault();
					handleBulkDeleteEquipment();
				}
				return;
			}
			if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
				e.preventDefault();
				undo();
				return;
			}
			if (isCmdOrCtrl && e.key.toLowerCase() === "y" || isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z") {
				e.preventDefault();
				redo();
				return;
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [
		selectedEquips,
		rows,
		undo,
		redo
	]);
	const renderEquipmentContextMenu = (e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuContent, {
		className: "w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
				onClick: () => onOpenSizer(e.id),
				className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wrench, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Manage Assignments" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
				onClick: () => {
					setCommentTarget({
						id: e.id,
						name: e.tag || e.type,
						type: "equipment"
					});
					setAssignCommentOpen(true);
				},
				className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Add comment" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, { className: "h-px bg-border my-1" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
				onClick: async () => {
					if (await confirm(`Are you sure you want to delete equipment "${e.tag}"?`, {
						title: "Delete Equipment",
						confirmText: "Delete",
						cancelText: "Cancel"
					})) deleteEquipment(e.id);
				},
				className: "flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Delete Equipment" })]
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col flex-1 min-h-0 h-full overflow-hidden select-none",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex items-center gap-1.5 px-3 min-h-10 py-1.5 shrink-0 bg-background no-print border-b border-border/50",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: query,
						onChange: (e) => setQuery(e.target.value),
						placeholder: "Filter equipment...",
						className: "h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterDropdown, {
						label: "Type",
						selectedValue: selectedType,
						onSelect: setSelectedType,
						options: uniqueTypes
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-auto flex items-center gap-1",
						children: [selectedEquips.size === 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
							onClick: () => {
								const firstId = Array.from(selectedEquips)[0];
								if (firstId) onOpenSizer(firstId);
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wrench, { className: "size-3.5" }), " Assign"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
							primary: true,
							onClick: () => {
								setSizerEquipId(null);
								setSizerShowAdd(true);
								setSizerOpen(true);
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " New Equipment"]
						})]
					}),
					selectedEquips.size > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-semibold",
								children: [selectedEquips.size, " selected"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-primary/30",
								children: "·"
							}),
							selectedEquips.size === 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BulkBtn, {
								icon: Wrench,
								onClick: () => {
									const firstId = Array.from(selectedEquips)[0];
									if (firstId) onOpenSizer(firstId);
								},
								children: "Assign"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BulkBtn, {
								icon: Trash2,
								onClick: handleBulkDeleteEquipment,
								children: "Delete"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setSelectedEquips(/* @__PURE__ */ new Set()),
								className: "ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3" }), " Clear"]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex-1 min-h-0 overflow-hidden flex flex-col",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataGrid, {
					rows,
					columns,
					selected: selectedEquips,
					onToggle: toggleEquipment,
					onToggleAll: toggleAllEquipment,
					renderContextMenu: renderEquipmentContextMenu,
					onRowDoubleClick: handleEquipmentDoubleClicked,
					rowClassName: (row, index) => index % 2 === 0 ? "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebef]/80 dark:hover:bg-[#25252b]/80" : "bg-white dark:bg-zinc-950 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SharedAssignmentModal, {
				isOpen: sizerOpen,
				initialEquipmentId: sizerEquipId,
				initialZoneId: null,
				initialZoneIds: [],
				initialShowAddEquip: sizerShowAdd,
				onClose: () => {
					setSizerOpen(false);
					setSizerEquipId(null);
					setSizerShowAdd(false);
				}
			})
		]
	});
}
function ReportView() {
	const { spaces, zones, equipment } = useWorkspace();
	const totalFresh = spaces.reduce((a, s) => a + (s.freshAir || 0), 0);
	const totalExtract = spaces.reduce((a, s) => a + (s.extractAir || 0), 0);
	const totalArea = spaces.reduce((a, s) => a + (s.area || 0) * (s.multiplier || 1), 0);
	const balance = totalFresh - totalExtract;
	const warningsCount = spaces.filter((s) => s.status === "warning").length;
	const compliance = spaces.length > 0 ? Math.round((spaces.length - warningsCount) / spaces.length * 100) : 100;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col h-full",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-1 px-4 h-11 shrink-0 border-b border-border/50 bg-card/50",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-[12px] text-muted-foreground font-semibold",
				children: ["Generated: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-foreground font-mono",
					children: (/* @__PURE__ */ new Date()).toLocaleDateString()
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ml-auto flex items-center gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
					onClick: () => window.print(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-3.5" }), " Print"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
					primary: true,
					onClick: () => exportVentilationPDF(spaces),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5" }), " Export PDF"]
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex-1 overflow-auto p-6 bg-slate-50/30 dark:bg-zinc-950/20",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "max-w-4xl mx-auto space-y-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportSection, {
						title: "Project Summary",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 sm:grid-cols-4 gap-3.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KPI, {
									label: "Spaces",
									value: spaces.length.toLocaleString()
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KPI, {
									label: "Zones",
									value: zones.length
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KPI, {
									label: "Equipment",
									value: equipment.length
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KPI, {
									label: "Total Area",
									value: `${totalArea.toFixed(0)} m²`
								})
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 md:grid-cols-2 gap-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportSection, {
							title: "Fresh Air Totals",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-surface-2 dark:bg-zinc-800/40 p-4 rounded-2xl border border-border/80 space-y-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KVRow, {
										k: "Required (min)",
										v: `${spaces.reduce((a, s) => a + (s.minOA || 0), 0).toLocaleString()} L/s`
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KVRow, {
										k: "Supplied",
										v: `${totalFresh.toLocaleString()} L/s`,
										tone: "primary"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KVRow, {
										k: "Surplus",
										v: `+${(totalFresh - spaces.reduce((a, s) => a + (s.minOA || 0), 0)).toLocaleString()} L/s`,
										tone: "success"
									})
								]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportSection, {
							title: "Extract Air Totals",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-surface-2 dark:bg-zinc-800/40 p-4 rounded-2xl border border-border/80 space-y-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KVRow, {
										k: "Required (min)",
										v: `${spaces.reduce((a, s) => a + (s.minExt || 0), 0).toLocaleString()} L/s`
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KVRow, {
										k: "Extracted",
										v: `${totalExtract.toLocaleString()} L/s`,
										tone: "primary"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KVRow, {
										k: "Surplus",
										v: `+${(totalExtract - spaces.reduce((a, s) => a + (s.minExt || 0), 0)).toLocaleString()} L/s`,
										tone: "success"
									})
								]
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 md:grid-cols-2 gap-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportSection, {
							title: "Pressure Balance Summary",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-surface-2 dark:bg-zinc-800/40 p-4 rounded-2xl border border-border/80 space-y-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KVRow, {
										k: "Net Balance",
										v: `${balance > 0 ? "+" : ""}${balance.toLocaleString()} L/s`,
										tone: Math.abs(balance) < 500 ? "success" : "warning"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KVRow, {
										k: "Positive Zones",
										v: zones.filter((z) => z.pressureType === "positive").length
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KVRow, {
										k: "Negative Zones",
										v: zones.filter((z) => z.pressureType === "negative").length
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KVRow, {
										k: "Neutral Zones",
										v: zones.filter((z) => z.pressureType === "neutral").length
									})
								]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportSection, {
							title: "ASHRAE 62.1 Compliance",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-surface-2 dark:bg-zinc-800/40 p-5 rounded-2xl border border-border/80 flex flex-col justify-center h-full min-h-[155px]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-2.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[13px] font-semibold text-foreground",
											children: "Compliance Rating"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-mono tabular text-[18px] font-extrabold text-primary",
											children: [compliance, "%"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-full h-3 bg-[#e2e8f0] dark:bg-zinc-700 rounded-full overflow-hidden shadow-inner",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-full bg-success transition-all duration-500 rounded-full",
											style: { width: `${compliance}%` }
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[12px] text-muted-foreground mt-3 font-medium",
										children: [
											spaces.length - warningsCount,
											" compliant spaces · ",
											warningsCount,
											" require attention"
										]
									})
								]
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportSection, {
						title: "Equipment Summary",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-1 sm:grid-cols-3 gap-3.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KPI, {
									label: "Operational",
									value: zones.length
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KPI, {
									label: "Warnings",
									value: equipment.filter((e) => e.status === "warning").length
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KPI, {
									label: "Avg Utilization",
									value: `${equipment.length > 0 ? Math.round(equipment.reduce((a, e) => a + e.utilization, 0) / equipment.length) : 0}%`
								})
							]
						})
					})
				]
			})
		})]
	});
}
function ReportSection({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "border border-border/80 rounded-3xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "px-5 h-11 flex items-center border-b border-border/50 bg-card shrink-0",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-[10px] uppercase tracking-widest font-extrabold text-slate-500 dark:text-zinc-400",
				children: title
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "p-5",
			children
		})]
	});
}
function KPI({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "bg-surface-2 dark:bg-zinc-800/40 px-4 py-3.5 rounded-2xl border border-border/80 shadow-xs flex flex-col justify-between",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[9.5px] uppercase tracking-wider font-extrabold text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "font-mono tabular text-[20px] font-bold mt-1 text-foreground",
			children: value
		})]
	});
}
function KVRow({ k, v, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between py-2 border-b border-border/40 last:border-b-0 text-[12.5px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-muted-foreground font-medium",
			children: k
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: `font-mono tabular ${tone === "success" ? "text-success font-semibold" : tone === "warning" ? "text-warning font-semibold" : tone === "primary" ? "text-primary font-semibold" : "text-foreground"}`,
			children: v
		})]
	});
}
function CollapsibleMissingSection({ label, count, itemsList, isOpen, onToggle, onItemClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-border/40 last:border-b-0 py-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			onClick: onToggle,
			className: "w-full flex items-center justify-between text-[12.5px] font-medium text-foreground/90 hover:text-foreground transition-colors cursor-pointer select-none py-0.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex items-center gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), isOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-3 text-muted-foreground" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3 text-muted-foreground" })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono tabular font-semibold text-foreground/80",
				children: count
			})]
		}), isOpen && count > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-1.5 max-h-36 overflow-y-auto border border-border/60 rounded-md bg-surface-2 divide-y divide-border/40 font-mono text-[10.5px] text-muted-foreground custom-scrollbar",
			children: itemsList.map((item) => {
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => onItemClick(item.id),
					className: "block w-full px-2.5 py-1.5 hover:bg-surface-3 transition-colors text-left cursor-pointer select-none",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[11.5px] leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-sans font-medium text-foreground/80 hover:text-primary transition-colors",
							children: item.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted-foreground/50 text-[10px] font-mono ml-1.5",
							children: [
								"(",
								item.detail,
								")"
							]
						})]
					})
				}, item.id);
			})
		})]
	});
}
function IntelligenceDrawer({ onClose, setTab }) {
	const { spaces, zones, equipment } = useWorkspace();
	const [openSections, setOpenSections] = (0, import_react.useState)({
		unassigned: false,
		unzoned: false,
		noCategory: false,
		missingArea: false
	});
	const balance = spaces.reduce((a, s) => a + (s.freshAir || 0), 0) - spaces.reduce((a, s) => a + (s.extractAir || 0), 0);
	const warnings = spaces.filter((s) => s.flagged).length;
	const nonCompliantCount = spaces.filter((s) => s.flagged || s.status === "warning").length;
	const draft = spaces.filter((s) => s.status === "draft").length;
	const negZones = zones.filter((z) => z.pressureType === "negative").length;
	const unassignedItems = zones.filter((z) => {
		const hasEquipment = z.equipment && z.equipment.length > 0;
		const hasFA = z.faAssignment || z.faAssignments && Object.keys(z.faAssignments).length > 0;
		const hasEA = z.eaAssignment || z.eaAssignments && Object.keys(z.eaAssignments).length > 0;
		return !hasEquipment && !hasFA && !hasEA;
	}).map((z) => ({
		id: z.id,
		name: z.name,
		detail: z.floor || "L01"
	}));
	const unzonedItems = spaces.filter((s) => {
		const z = (s.zone || "").trim().toLowerCase();
		return !z || z === "" || z === "default" || z === "unzoned";
	}).map((s) => {
		const hasCategory = s.category && s.category.trim() !== "" && !s.category.toLowerCase().includes("select category");
		return {
			id: s.id,
			name: hasCategory ? `${s.name} + ${s.category}` : s.name,
			detail: s.floor || "L01"
		};
	});
	const noCategoryItems = spaces.filter((s) => {
		const c = (s.category || "").trim().toLowerCase();
		return !c || c === "" || c === "select category" || c.includes("select category");
	}).map((s) => ({
		id: s.id,
		name: s.name,
		detail: s.floor || "L01"
	}));
	const missingAreaItems = spaces.filter((s) => {
		const areaVal = parseFloat(String(s.area));
		return !s.area || isNaN(areaVal) || areaVal === 0;
	}).map((s) => ({
		id: s.id,
		name: s.name,
		detail: s.floor || "L01"
	}));
	const handleItemClick = (id, isZone) => {
		setTab(isZone ? "zones" : "spaces");
		setTimeout(() => {
			window.dispatchEvent(new CustomEvent("mep-scroll-to-item", { detail: { id } }));
		}, 100);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "h-full w-[360px] flex flex-col animate-fade-in",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "h-11 px-3 flex items-center justify-between border-b border-border shrink-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[13px] font-semibold tracking-tight",
					children: "Intelligence"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: onClose,
				className: "size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex-1 overflow-auto",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(IntelSection, {
					icon: CircleCheck,
					tone: "success",
					title: "Compliance Status",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[12px] text-muted-foreground",
						children: [
							"ASHRAE 62.1 validation across ",
							spaces.length.toLocaleString(),
							" spaces."
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full bg-success",
								style: { width: `${spaces.length > 0 ? Math.round((spaces.length - nonCompliantCount) / spaces.length * 100) : 100}%` }
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-mono tabular text-[11.5px]",
							children: [spaces.length > 0 ? Math.round((spaces.length - nonCompliantCount) / spaces.length * 100) : 100, "%"]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(IntelSection, {
					icon: Gauge,
					tone: Math.abs(balance) < 500 ? "success" : "warning",
					title: "Pressure Warnings",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KV, {
						k: "Project balance",
						v: `${balance > 0 ? "+" : ""}${balance.toLocaleString()} L/s`
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KV, {
						k: "Negative zones",
						v: negZones
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(IntelSection, {
					icon: TriangleAlert,
					tone: warnings > 0 ? "warning" : "muted",
					title: "Calculation Issues",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KV, {
						k: "Spaces flagged",
						v: warnings
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KV, {
						k: "Draft spaces",
						v: draft
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(IntelSection, {
					icon: Info,
					tone: "muted",
					title: "Missing Data",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollapsibleMissingSection, {
							label: "Unassigned equipment",
							count: unassignedItems.length,
							itemsList: unassignedItems,
							isOpen: openSections.unassigned,
							onToggle: () => setOpenSections((prev) => ({
								...prev,
								unassigned: !prev.unassigned
							})),
							onItemClick: (id) => handleItemClick(id, true)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollapsibleMissingSection, {
							label: "Unzoned spaces",
							count: unzonedItems.length,
							itemsList: unzonedItems,
							isOpen: openSections.unzoned,
							onToggle: () => setOpenSections((prev) => ({
								...prev,
								unzoned: !prev.unzoned
							})),
							onItemClick: (id) => handleItemClick(id, false)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollapsibleMissingSection, {
							label: "Spaces without Category",
							count: noCategoryItems.length,
							itemsList: noCategoryItems,
							isOpen: openSections.noCategory,
							onToggle: () => setOpenSections((prev) => ({
								...prev,
								noCategory: !prev.noCategory
							})),
							onItemClick: (id) => handleItemClick(id, false)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollapsibleMissingSection, {
							label: "Missing Area",
							count: missingAreaItems.length,
							itemsList: missingAreaItems,
							isOpen: openSections.missingArea,
							onToggle: () => setOpenSections((prev) => ({
								...prev,
								missingArea: !prev.missingArea
							})),
							onItemClick: (id) => handleItemClick(id, false)
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IntelSection, {
					icon: Sparkles,
					tone: "primary",
					title: "Optimization Suggestions",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Reduce AHU-12 setpoint by 8% to recover 1,200 L/s headroom." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Re-zone L09 corridors to balance negative pressure cluster." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Consolidate 3 underutilized exhaust fans on Tower B." })
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IntelSection, {
					icon: Info,
					tone: "muted",
					title: "Engineering Notes",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[12px] text-muted-foreground",
						children: "No outstanding reviewer notes. Last validated 2h ago."
					})
				})
			]
		})]
	});
}
function IntelSection({ icon: Icon, title, tone, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "px-3 py-3 border-b border-border",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 mb-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: `size-3.5 ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "primary" ? "text-primary" : "text-muted-foreground"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
				className: "text-[11px] uppercase tracking-wider font-semibold",
				children: title
			})]
		}), children]
	});
}
function KV({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between text-[12px] py-0.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-muted-foreground",
			children: k
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-mono tabular font-medium",
			children: v
		})]
	});
}
//#endregion
export { VentilationModule as n, Route as t };
