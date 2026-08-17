import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Et as ChevronUp, N as Plus, Ot as ChevronDown, T as Search, Y as Info, Zt as Funnel, et as GripVertical, gt as Download, kt as Check, m as Trash2, ot as FolderKanban, v as SlidersHorizontal } from "../_libs/lucide-react.mjs";
import { a as usePrompt, i as useConfirm, r as cn } from "./use-confirm-BT3fngjN.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { t as ImportExcelBtn } from "./ImportExcelBtn-rAnQAoVD.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
import { a as useShortcuts, i as useSelection, n as useClipboard, r as useHistory, t as toast$1 } from "./useShortcuts-D4qmUsvw.mjs";
import { a as SelectItemIndicator, c as SelectPortal, d as SelectSeparator$1, f as SelectTrigger$1, i as SelectItem$1, l as SelectScrollDownButton$1, m as SelectViewport, n as SelectContent$1, o as SelectItemText, p as SelectValue$1, r as SelectIcon, s as SelectLabel$1, t as Select$1, u as SelectScrollUpButton$1 } from "../_libs/@radix-ui/react-select+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/generator-sizing-C2h4sLM5.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
var import_excel = /* @__PURE__ */ __toESM(require_excel());
function useBulkActions(rows, selectedIds, pushState) {
	return {
		bulkDelete: (0, import_react.useCallback)(() => {
			if (selectedIds.size === 0) return;
			pushState(rows.filter((r) => !selectedIds.has(r.id)));
			toast$1.success(`${selectedIds.size} rows deleted`);
		}, [
			rows,
			selectedIds,
			pushState
		]),
		bulkDuplicate: (0, import_react.useCallback)(() => {
			if (selectedIds.size === 0) return;
			const newRows = [...rows];
			let addedCount = 0;
			rows.forEach((r) => {
				if (selectedIds.has(r.id)) {
					newRows.push({
						...r,
						id: crypto.randomUUID()
					});
					addedCount++;
				}
			});
			pushState(newRows);
			toast$1.success(`${addedCount} rows duplicated`);
		}, [
			rows,
			selectedIds,
			pushState
		]),
		bulkEdit: (0, import_react.useCallback)((field, value) => {
			if (selectedIds.size === 0) return;
			pushState(rows.map((r) => {
				if (selectedIds.has(r.id)) return {
					...r,
					[field]: value
				};
				return r;
			}));
			toast$1.success(`Updated ${selectedIds.size} rows`);
		}, [
			rows,
			selectedIds,
			pushState
		])
	};
}
function useEditableGrid(config) {
	const { currentState: rows, pushState, undo, redo, canUndo, canRedo } = useHistory(config.initialRows);
	const { selectedIds, toggleSelection, selectAll, clearSelection } = useSelection(rows);
	(0, import_react.useEffect)(() => {
		if (config.onStateChange) config.onStateChange(rows);
	}, [rows, config.onStateChange]);
	const { copy, cut, paste } = useClipboard(rows, selectedIds, pushState);
	const { bulkDelete, bulkDuplicate, bulkEdit } = useBulkActions(rows, selectedIds, pushState);
	useShortcuts({
		onUndo: undo,
		onRedo: redo,
		onCopy: copy,
		onCut: cut,
		onPaste: paste,
		onSelectAll: selectAll,
		onClearSelection: clearSelection,
		onDelete: bulkDelete,
		onDuplicate: bulkDuplicate,
		onNewRow: config.onNewRow,
		onSave: config.onSave,
		onPrint: config.onPrint,
		onExportExcel: config.onExportExcel,
		onExportPdf: config.onExportPdf
	});
	return {
		rows,
		selectedIds,
		toggleSelection,
		clearSelection,
		selectAll,
		updateRow: (0, import_react.useCallback)((id, field, value) => {
			pushState(rows.map((r) => r.id === id ? {
				...r,
				[field]: value
			} : r));
		}, [rows, pushState]),
		addRow: (0, import_react.useCallback)((newRow) => {
			pushState([...rows, newRow]);
		}, [rows, pushState]),
		removeRow: (0, import_react.useCallback)((id) => {
			pushState(rows.filter((r) => r.id !== id));
		}, [rows, pushState]),
		bulkDelete,
		bulkDuplicate,
		bulkEdit,
		undo,
		redo,
		canUndo,
		canRedo,
		pushState
	};
}
function useGridNavigation({ gridId }) {
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			const target = e.target;
			if (!target.closest(`#${gridId}`)) return;
			if (target.tagName !== "INPUT" && target.tagName !== "SELECT") return;
			const rowStr = target.getAttribute("data-row");
			const colStr = target.getAttribute("data-col");
			if (!rowStr || !colStr) return;
			const rowIndex = parseInt(rowStr, 10);
			const colIndex = parseInt(colStr, 10);
			if ([
				"ArrowUp",
				"ArrowDown",
				"Enter"
			].includes(e.key)) {
				e.preventDefault();
				let nextRow = rowIndex;
				if (e.key === "ArrowUp") nextRow--;
				if (e.key === "ArrowDown" || e.key === "Enter") nextRow++;
				const nextEl = document.querySelector(`#${gridId} [data-row="${nextRow}"][data-col="${colIndex}"]`);
				if (nextEl) {
					nextEl.focus();
					if (nextEl instanceof HTMLInputElement) nextEl.select();
				}
			} else if ([
				"ArrowLeft",
				"ArrowRight",
				"Tab"
			].includes(e.key)) {
				let shouldMove = false;
				if (e.key === "Tab") {
					shouldMove = true;
					e.preventDefault();
				} else if (target.tagName === "SELECT" || target.value === "") shouldMove = true;
				else if (target instanceof HTMLInputElement) {
					if (e.key === "ArrowLeft" && target.selectionStart === 0) shouldMove = true;
					if (e.key === "ArrowRight" && target.selectionEnd === (target.value || "").length) shouldMove = true;
				}
				if (shouldMove) {
					if (e.key !== "Tab") e.preventDefault();
					let nextCol = colIndex;
					let nextRow = rowIndex;
					if (e.key === "ArrowLeft" || e.key === "Tab" && e.shiftKey) nextCol--;
					else if (e.key === "ArrowRight" || e.key === "Tab" && !e.shiftKey) nextCol++;
					let nextEl = document.querySelector(`#${gridId} [data-row="${nextRow}"][data-col="${nextCol}"]`);
					if (!nextEl && e.key === "Tab") {
						if (!e.shiftKey) {
							nextRow++;
							nextCol = 0;
						} else {
							nextRow--;
							nextCol = 99;
						}
						const rowEls = document.querySelectorAll(`#${gridId} [data-row="${nextRow}"]`);
						if (rowEls.length > 0) if (!e.shiftKey) nextEl = rowEls[0];
						else nextEl = rowEls[rowEls.length - 1];
					}
					if (nextEl) {
						nextEl.focus();
						if (nextEl instanceof HTMLInputElement) nextEl.select();
					}
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [gridId]);
}
var Select = Select$1;
var SelectValue = SelectValue$1;
var SelectTrigger = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectTrigger$1, {
	ref,
	className: cn("flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background cursor-pointer data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1", className),
	...props,
	children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectIcon, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "h-4 w-4 opacity-50" })
	})]
}));
SelectTrigger.displayName = SelectTrigger$1.displayName;
var SelectScrollUpButton = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectScrollUpButton$1, {
	ref,
	className: cn("flex cursor-default items-center justify-center py-1", className),
	...props,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "h-4 w-4" })
}));
SelectScrollUpButton.displayName = SelectScrollUpButton$1.displayName;
var SelectScrollDownButton = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectScrollDownButton$1, {
	ref,
	className: cn("flex cursor-default items-center justify-center py-1", className),
	...props,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "h-4 w-4" })
}));
SelectScrollDownButton.displayName = SelectScrollDownButton$1.displayName;
var SelectContent = import_react.forwardRef(({ className, children, position = "popper", ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectPortal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent$1, {
	ref,
	className: cn("relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-select-content-transform-origin)", position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1", className),
	position,
	...props,
	children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectScrollUpButton, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectViewport, {
			className: cn("p-1", position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"),
			children
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectScrollDownButton, {})
	]
}) }));
SelectContent.displayName = SelectContent$1.displayName;
var SelectLabel = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectLabel$1, {
	ref,
	className: cn("px-2 py-1.5 text-sm font-semibold", className),
	...props
}));
SelectLabel.displayName = SelectLabel$1.displayName;
var SelectItem = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectItem$1, {
	ref,
	className: cn("relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className),
	...props,
	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "absolute right-2 flex h-3.5 w-3.5 items-center justify-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItemIndicator, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-4 w-4" }) })
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItemText, { children })]
}));
SelectItem.displayName = SelectItem$1.displayName;
var SelectSeparator = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectSeparator$1, {
	ref,
	className: cn("-mx-1 my-1 h-px bg-muted", className),
	...props
}));
SelectSeparator.displayName = SelectSeparator$1.displayName;
import_FileSaver_min.default.saveAs;
var STARTER_MULTIPLIERS = {
	DOL: 7,
	SD: 3,
	"Soft Starter": 2,
	VFD: 1,
	None: 0
};
var STANDARD_SIZES = [
	125,
	160,
	200,
	250,
	320,
	400,
	500,
	625,
	750,
	800,
	1e3,
	1250,
	1500,
	1600,
	2e3,
	2500,
	2750,
	3e3,
	3250,
	3500,
	3750,
	4e3,
	4250,
	4500,
	4750,
	5e3
];
function GeneratorSizingPage() {
	useConfirm();
	const prompt = usePrompt();
	const { project, forceSaveToCloud } = useWorkspace();
	const [projects, setProjects] = (0, import_react.useState)({ "Default Project": [] });
	const [currentProject, setCurrentProject] = (0, import_react.useState)("Default Project");
	const [isLoaded, setIsLoaded] = (0, import_react.useState)(false);
	const { rows, selectedIds: selectedRows, toggleSelection, clearSelection, selectAll, updateRow: baseUpdateRow, addRow: baseAddRow, removeRow: baseRemoveRow, bulkDelete, bulkDuplicate, pushState, undo: handleUndo, redo: handleRedo, canUndo, canRedo } = useEditableGrid({
		initialRows: projects[currentProject] || [],
		onStateChange: (newRows) => {
			setProjects((prev) => {
				if (prev[currentProject] === newRows) return prev;
				return {
					...prev,
					[currentProject]: newRows
				};
			});
		},
		onNewRow: () => addRow(),
		onSave: () => saveProject(),
		onPrint: () => exportPdf(),
		onExportPdf: () => exportPdf()
	});
	useGridNavigation({ gridId: "generator-grid" });
	const saveProject = () => {
		const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects));
		const dlAnchorElem = document.createElement("a");
		dlAnchorElem.setAttribute("href", dataStr);
		dlAnchorElem.setAttribute("download", "mep_gen_projects.json");
		dlAnchorElem.click();
		toast$1.success("Project saved successfully");
	};
	const toggleRowSelect = (rowId, isShift, isCtrl) => {
		toggleSelection(rowId, isCtrl, isShift);
	};
	const [pf, setPf] = (0, import_react.useState)(.8);
	const [lf, setLf] = (0, import_react.useState)(.9);
	const [userSelectedSize, setUserSelectedSize] = (0, import_react.useState)(null);
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("si");
	const [manualOverrides, setManualOverrides] = (0, import_react.useState)({});
	const [activeTab, setActiveTab] = (0, import_react.useState)("equipment");
	const [draggedRowIndex, setDraggedRowIndex] = (0, import_react.useState)(null);
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!project?.id) return;
		try {
			const saved = window.localStorage.getItem(`mep_gen_projects_${project.id}`);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (parsed.projects) {
					setProjects(parsed.projects);
					setCurrentProject(parsed.currentProject || "Default Project");
					if (parsed.pf) setPf(parsed.pf);
					if (parsed.lf) setLf(parsed.lf);
					if (parsed.userSelectedSize) setUserSelectedSize(parsed.userSelectedSize);
					if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
					if (parsed.manualOverrides) setManualOverrides(parsed.manualOverrides);
					if (parsed.projects[parsed.currentProject || "Default Project"]) pushState(parsed.projects[parsed.currentProject || "Default Project"]);
				} else {
					setProjects(parsed);
					if (parsed["Default Project"]) pushState(parsed["Default Project"]);
				}
			}
			setTimeout(() => dirtyStore.set(false), 50);
		} catch {
			console.error("Failed to load generator sizing data");
		}
		setLoadedProjectId(project.id);
		setIsLoaded(true);
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				projects,
				currentProject,
				pf,
				lf,
				userSelectedSize,
				unitSystem,
				manualOverrides
			};
			window.localStorage.setItem(`mep_gen_projects_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		projects,
		currentProject,
		pf,
		lf,
		userSelectedSize,
		unitSystem,
		manualOverrides
	]);
	const setOverride = (key, val) => {
		setManualOverrides((prev) => ({
			...prev,
			[key]: val
		}));
	};
	const clearOverrides = () => {
		setManualOverrides({});
	};
	const handleUnitToggle = (newSystem) => {
		if (newSystem === unitSystem) return;
		setUnitSystem(newSystem);
		clearOverrides();
		pushState(rows.map((r) => {
			const kw = Number(r.kwPerUnit) || 0;
			const sb = Number(r.standby) || 0;
			const em = r.excludeEmergency ? 0 : Number(r.emergency) || 0;
			const pf = Number(r.powerFail) || 0;
			return {
				...r,
				kwPerUnit: newSystem === "ip" ? Number((kw / .746).toFixed(2)) : Number((kw * .746).toFixed(2)),
				standby: newSystem === "ip" ? Number((sb / .746).toFixed(2)) : Number((sb * .746).toFixed(2)),
				emergency: newSystem === "ip" ? Number((em / .746).toFixed(2)) : Number((em * .746).toFixed(2)),
				powerFail: newSystem === "ip" ? Number((pf / .746).toFixed(2)) : Number((pf * .746).toFixed(2))
			};
		}));
	};
	const addRow = () => {
		baseAddRow({
			id: `gen_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
			desc: "",
			unit: "",
			kwPerUnit: "",
			starter: "DOL",
			multiplier: STARTER_MULTIPLIERS["DOL"],
			standby: "",
			emergency: "",
			powerFail: "",
			remark: ""
		});
	};
	const updateRow = (id, field, val) => {
		const targetIds = selectedRows.has(id) ? Array.from(selectedRows) : [id];
		pushState(rows.map((row) => {
			if (!targetIds.includes(row.id)) return row;
			const newRow = {
				...row,
				[field]: val
			};
			if (field === "starter") newRow.multiplier = STARTER_MULTIPLIERS[val] || 1;
			if (field === "kwPerUnit" || field === "unit" || field === "standby") {
				const u = Number(newRow.unit) || 0;
				const kw = Number(newRow.kwPerUnit) || 0;
				const sb = Number(newRow.standby) || 0;
				const ac = u * kw - sb;
				newRow.emergency = ac > 0 ? ac : "";
			}
			return newRow;
		}));
	};
	const setPowerFailPercent = (id, percentStr) => {
		const percent = parseFloat(percentStr);
		if (!percent || isNaN(percent)) return;
		pushState(rows.map((row) => {
			if (row.id !== id) return row;
			const u = Number(row.unit) || 0;
			const kw = Number(row.kwPerUnit) || 0;
			const sb = Number(row.standby) || 0;
			const actualKw = u * kw - sb;
			return {
				...row,
				powerFail: parseFloat((actualKw * (percent / 100)).toFixed(2))
			};
		}));
	};
	const handleImportExcelRows = (mappedRows) => {
		const newGenRows = mappedRows.map((mr) => ({
			id: `gen_${Date.now()}_${Math.floor(Math.random() * 1e5)}`,
			desc: mr.desc || "",
			unit: mr.unit || "",
			kwPerUnit: mr.kwPerUnit || "",
			starter: mr.starter || "DOL",
			multiplier: mr.multiplier || "",
			standby: mr.standby || "",
			emergency: mr.emergency || "",
			powerFail: mr.powerFail || "",
			remark: mr.remark || ""
		}));
		pushState([...rows, ...newGenRows]);
	};
	const handleDragStart = (e, index) => {
		setDraggedRowIndex(index);
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/html", e.currentTarget.outerHTML);
	};
	const handleDragOver = (e, index) => {
		e.preventDefault();
		if (draggedRowIndex === null || draggedRowIndex === index) return;
		const newRows = [...rows];
		const draggedRow = newRows[draggedRowIndex];
		newRows.splice(draggedRowIndex, 1);
		newRows.splice(index, 0, draggedRow);
		setDraggedRowIndex(index);
		pushState(newRows);
	};
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape") {
				if (selectedRows.size > 0) {
					e.preventDefault();
					clearSelection();
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedRows, clearSelection]);
	const handleDrop = () => setDraggedRowIndex(null);
	const calc = (0, import_react.useMemo)(() => {
		let totalAcl = 0;
		let totalEmergency = 0;
		let maxStartCur = 0;
		let largestMotorKw = 0;
		let largestMotorStarter = "-";
		rows.forEach((r) => {
			const rKw = Number(r.kwPerUnit) || 0;
			const rSb = Number(r.standby) || 0;
			const rEm = r.excludeEmergency ? 0 : Number(r.emergency) || 0;
			const rUnit = Number(r.unit) || 0;
			const rMult = Number(r.multiplier) || 0;
			const kwPerUnit = unitSystem === "ip" ? rKw * .746 : rKw;
			const standby = unitSystem === "ip" ? rSb * .746 : rSb;
			const emergency = unitSystem === "ip" ? rEm * .746 : rEm;
			const actualKw = rUnit * kwPerUnit - standby;
			totalAcl += actualKw;
			totalEmergency += emergency;
			const startCur = kwPerUnit * 1.739 * rMult;
			if (startCur > maxStartCur) maxStartCur = startCur;
			if (kwPerUnit > largestMotorKw) {
				largestMotorKw = kwPerUnit;
				largestMotorStarter = r.starter;
			}
		});
		const getEffective = (key, computed) => {
			if (manualOverrides[key] !== void 0 && manualOverrides[key] !== "") return parseFloat(manualOverrides[key]) || 0;
			return computed;
		};
		const baseAcl = getEffective("acl", unitSystem === "ip" ? totalAcl / .746 : totalAcl);
		const baseEm = getEffective("em", unitSystem === "ip" ? totalEmergency / .746 : totalEmergency);
		const aclKw = unitSystem === "ip" ? baseAcl * .746 : baseAcl;
		const emKw = unitSystem === "ip" ? baseEm * .746 : baseEm;
		const demandLoadAcl = getEffective("demandAcl", aclKw / pf);
		const demandLoadEm = getEffective("demandEm", emKw / pf);
		const calcSizeAcl = getEffective("calcAcl", demandLoadAcl / lf);
		const calcSizeEm = getEffective("calcEm", demandLoadEm / lf);
		const effectiveMaxStart = getEffective("maxStart", maxStartCur);
		const maxCalcSize = Math.max(calcSizeAcl, calcSizeEm);
		let autoSize = STANDARD_SIZES.find((size) => size >= maxCalcSize);
		if (!autoSize) autoSize = STANDARD_SIZES[STANDARD_SIZES.length - 1];
		return {
			totalAcl: baseAcl,
			totalEmergency: baseEm,
			demandLoadAcl,
			demandLoadEm,
			calcSizeAcl,
			calcSizeEm,
			selectedSize: userSelectedSize !== null ? userSelectedSize : autoSize,
			maxStartCur: effectiveMaxStart,
			largestMotorKw,
			largestMotorStarter
		};
	}, [
		rows,
		pf,
		lf,
		unitSystem,
		userSelectedSize,
		manualOverrides
	]);
	const exportExcel = async () => {
		const workbook = new import_excel.default.Workbook();
		const worksheet = workbook.addWorksheet("Generator Sizing", { views: [{ showGridLines: false }] });
		const fontNormal = {
			name: "Cambria",
			size: 10,
			bold: false
		};
		const fontBold = {
			name: "Cambria",
			size: 10,
			bold: true
		};
		const fontTitle = {
			name: "Cambria",
			size: 11,
			bold: true
		};
		const alignCenter = {
			horizontal: "center",
			vertical: "middle",
			wrapText: true
		};
		const alignLeft = {
			horizontal: "left",
			vertical: "middle",
			wrapText: true
		};
		const alignRight = {
			horizontal: "right",
			vertical: "middle",
			wrapText: true
		};
		const bgGray = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFD9D9D9" }
		};
		const bgYellow = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFFFFF00" }
		};
		const bgGreen = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFC6E0B4" }
		};
		const borderThin = {
			top: { style: "thin" },
			left: { style: "thin" },
			bottom: { style: "thin" },
			right: { style: "thin" }
		};
		worksheet.columns = [
			{ width: 8 },
			{ width: 40 },
			{ width: 8 },
			{ width: 12 },
			{ width: 15 },
			{ width: 15 },
			{ width: 12 },
			{ width: 12 },
			{ width: 15 },
			{ width: 15 },
			{ width: 15 },
			{ width: 30 }
		];
		const setBorder = (cell) => {
			cell.border = borderThin;
		};
		worksheet.mergeCells("A1:F1");
		const r1c1 = worksheet.getCell("A1");
		r1c1.value = "Calculation No:";
		r1c1.font = fontBold;
		r1c1.alignment = alignLeft;
		setBorder(r1c1);
		worksheet.mergeCells("G1:L1");
		const r1c2 = worksheet.getCell("G1");
		r1c2.value = "Date     :";
		r1c2.font = fontBold;
		r1c2.alignment = alignLeft;
		setBorder(r1c2);
		worksheet.mergeCells("A2:F2");
		const r2c1 = worksheet.getCell("A2");
		r2c1.value = "Project No   :";
		r2c1.font = fontBold;
		r2c1.alignment = alignLeft;
		setBorder(r2c1);
		worksheet.mergeCells("G2:L2");
		const r2c2 = worksheet.getCell("G2");
		r2c2.value = "Client   :";
		r2c2.font = fontBold;
		r2c2.alignment = alignLeft;
		setBorder(r2c2);
		worksheet.mergeCells("A3:F3");
		const r3c1 = worksheet.getCell("A3");
		r3c1.value = "Project Name :";
		r3c1.font = fontBold;
		r3c1.alignment = alignLeft;
		setBorder(r3c1);
		worksheet.mergeCells("G3:L3");
		const r3c2 = worksheet.getCell("G3");
		r3c2.value = "End User :";
		r3c2.font = fontBold;
		r3c2.alignment = alignLeft;
		setBorder(r3c2);
		for (let i = 1; i <= 3; i++) for (let j = 1; j <= 12; j++) setBorder(worksheet.getCell(i, j));
		const h1 = worksheet.addRow([
			"Sr. No.",
			"Description",
			"Unit",
			"kW / UNIT",
			"Starter Types",
			"Starting Current",
			"Total Connected Load",
			"Total Standby Load",
			"Actual Connected Load",
			"Emergency Load",
			"Power Failure Load",
			"Remarks"
		]);
		const h2 = worksheet.addRow([
			"",
			"",
			"",
			"",
			"",
			"Amps",
			"kW",
			"kW",
			"kW",
			"kW",
			"kW",
			""
		]);
		[
			"A",
			"B",
			"C",
			"D",
			"E",
			"L"
		].forEach((col) => {
			worksheet.mergeCells(`${col}4:${col}5`);
		});
		[h1, h2].forEach((r) => {
			r.eachCell((cell, colNumber) => {
				cell.font = fontBold;
				cell.alignment = alignCenter;
				setBorder(cell);
				if (colNumber === 10 || colNumber === 11) cell.fill = bgYellow;
				else cell.fill = bgGray;
			});
		});
		worksheet.mergeCells("A6:L6");
		const titleRow = worksheet.getCell("A6");
		titleRow.value = "GENERATOR LOAD - CALCULATION";
		titleRow.font = fontTitle;
		titleRow.alignment = alignCenter;
		setBorder(titleRow);
		for (let j = 1; j <= 12; j++) setBorder(worksheet.getCell(6, j));
		let rowIndex = 7;
		rows.forEach((r, idx) => {
			const rUnit = Number(r.unit) || 0;
			const rKw = Number(r.kwPerUnit) || 0;
			const rSb = Number(r.standby) || 0;
			const rMult = Number(r.multiplier) || 1;
			const startCur = rKw * 1.739 * rMult;
			const totalKw = rUnit * rKw;
			const actualKw = totalKw - rSb;
			const emergency = r.excludeEmergency ? 0 : Number(r.emergency) || 0;
			worksheet.addRow([
				idx + 1,
				r.desc,
				rUnit,
				rKw,
				r.starter,
				{
					formula: `D${rowIndex}*1.739*${rMult}`,
					result: startCur
				},
				{
					formula: `C${rowIndex}*D${rowIndex}`,
					result: totalKw
				},
				rSb,
				{
					formula: `G${rowIndex}-H${rowIndex}`,
					result: actualKw
				},
				emergency,
				Number(r.powerFail) || 0,
				r.remark || ""
			]).eachCell((cell, colNumber) => {
				cell.font = fontNormal;
				setBorder(cell);
				cell.alignment = colNumber === 2 ? alignLeft : alignCenter;
				if (colNumber === 10 || colNumber === 11) cell.fill = bgYellow;
			});
			rowIndex++;
		});
		rowIndex++;
		const addFooterRow = (title, aclVal, emVal, extra1 = "", extra2 = "") => {
			worksheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
			const titleCell = worksheet.getCell(`A${rowIndex}`);
			titleCell.value = title;
			titleCell.alignment = alignRight;
			titleCell.font = fontNormal;
			for (let col = 1; col <= 8; col++) setBorder(worksheet.getCell(rowIndex, col));
			const aclCell = worksheet.getCell(`I${rowIndex}`);
			aclCell.value = aclVal !== null ? aclVal : "";
			aclCell.alignment = alignCenter;
			aclCell.font = fontNormal;
			setBorder(aclCell);
			if (aclVal !== null) aclCell.fill = bgYellow;
			const emCell = worksheet.getCell(`J${rowIndex}`);
			emCell.value = emVal !== null ? emVal : "";
			emCell.alignment = alignCenter;
			emCell.font = fontNormal;
			setBorder(emCell);
			if (emVal !== null) emCell.fill = bgYellow;
			const x1Cell = worksheet.getCell(`K${rowIndex}`);
			x1Cell.value = extra1;
			x1Cell.font = fontBold;
			setBorder(x1Cell);
			const x2Cell = worksheet.getCell(`L${rowIndex}`);
			x2Cell.value = extra2;
			x2Cell.font = fontNormal;
			setBorder(x2Cell);
			rowIndex++;
		};
		addFooterRow("Total Actual Connected Load in kW (ACL)", Number(calc.totalAcl.toFixed(2)), Number(calc.totalEmergency.toFixed(2)), "Type of Starter", "Starting current");
		worksheet.getCell(`L${rowIndex - 1}`).font = fontBold;
		addFooterRow("Consider power factor (PF Lagging)", pf, pf, "Direct On Line (DOL)", "Full load current x 7");
		addFooterRow("Demand load in KVA ( DL = ACL / PF ) kVA", Number(calc.demandLoadAcl.toFixed(2)), Number(calc.demandLoadEm.toFixed(2)), "Star Delta Starter (SD)", "Full load current x 3");
		addFooterRow("Consider 90% loading for standby OR 80% loading for Prime Generators (If Standby DG )", lf, lf, "Variable Frequency Drive (VFD)", "Full load current");
		addFooterRow("Calculated size for DG set ( DL / LF ) kVA", Number(calc.calcSizeAcl.toFixed(2)), Number(calc.calcSizeEm.toFixed(2)));
		addFooterRow("Maximum Starting Current for Motor (Amp)", Number(calc.maxStartCur.toFixed(2)), "");
		worksheet.getCell(`J${rowIndex - 1}`).fill = bgYellow;
		addFooterRow("Calculated DG Set Size in kVA", Math.max(calc.calcSizeAcl, calc.calcSizeEm).toFixed(2), "");
		worksheet.getCell(`J${rowIndex - 1}`).fill = bgYellow;
		worksheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
		const selTitle = worksheet.getCell(`A${rowIndex}`);
		selTitle.value = "Selected size of DG Set Size in kVA";
		selTitle.font = fontBold;
		selTitle.alignment = alignRight;
		for (let col = 1; col <= 8; col++) {
			const c = worksheet.getCell(rowIndex, col);
			setBorder(c);
			c.fill = bgGray;
		}
		worksheet.mergeCells(`I${rowIndex}:J${rowIndex}`);
		const selVal = worksheet.getCell(`I${rowIndex}`);
		selVal.value = calc.selectedSize;
		selVal.font = fontBold;
		selVal.alignment = alignCenter;
		setBorder(worksheet.getCell(`I${rowIndex}`));
		setBorder(worksheet.getCell(`J${rowIndex}`));
		selVal.fill = bgYellow;
		worksheet.getCell(`J${rowIndex}`).fill = bgYellow;
		worksheet.mergeCells(`K${rowIndex}:L${rowIndex}`);
		for (let col = 11; col <= 12; col++) {
			const c = worksheet.getCell(rowIndex, col);
			setBorder(c);
			c.fill = bgGray;
		}
		rowIndex++;
		worksheet.getCell(`A${rowIndex}`).value = "";
		setBorder(worksheet.getCell(`A${rowIndex}`));
		worksheet.mergeCells(`B${rowIndex}:E${rowIndex}`);
		const origTitle = worksheet.getCell(`B${rowIndex}`);
		origTitle.value = "Originated By";
		origTitle.font = fontBold;
		origTitle.alignment = alignCenter;
		origTitle.fill = bgGreen;
		for (let c = 2; c <= 5; c++) setBorder(worksheet.getCell(rowIndex, c));
		worksheet.mergeCells(`F${rowIndex}:I${rowIndex}`);
		const revTitle = worksheet.getCell(`F${rowIndex}`);
		revTitle.value = "Reviewed By";
		revTitle.font = fontBold;
		revTitle.alignment = alignCenter;
		revTitle.fill = bgGreen;
		for (let c = 6; c <= 9; c++) setBorder(worksheet.getCell(rowIndex, c));
		worksheet.mergeCells(`J${rowIndex}:L${rowIndex}`);
		const appTitle = worksheet.getCell(`J${rowIndex}`);
		appTitle.value = "Approved By";
		appTitle.font = fontBold;
		appTitle.alignment = alignCenter;
		appTitle.fill = bgGreen;
		for (let c = 10; c <= 12; c++) setBorder(worksheet.getCell(rowIndex, c));
		rowIndex++;
		worksheet.getCell(`A${rowIndex}`).value = "Name";
		worksheet.getCell(`A${rowIndex}`).font = fontBold;
		setBorder(worksheet.getCell(`A${rowIndex}`));
		worksheet.mergeCells(`B${rowIndex}:E${rowIndex}`);
		worksheet.getCell(`B${rowIndex}`).value = "";
		worksheet.getCell(`B${rowIndex}`).alignment = alignCenter;
		for (let c = 2; c <= 5; c++) setBorder(worksheet.getCell(rowIndex, c));
		worksheet.mergeCells(`F${rowIndex}:I${rowIndex}`);
		worksheet.getCell(`F${rowIndex}`).value = "";
		worksheet.getCell(`F${rowIndex}`).alignment = alignCenter;
		for (let c = 6; c <= 9; c++) setBorder(worksheet.getCell(rowIndex, c));
		worksheet.mergeCells(`J${rowIndex}:L${rowIndex}`);
		worksheet.getCell(`J${rowIndex}`).value = "";
		worksheet.getCell(`J${rowIndex}`).alignment = alignCenter;
		for (let c = 10; c <= 12; c++) setBorder(worksheet.getCell(rowIndex, c));
		rowIndex++;
		worksheet.getCell(`A${rowIndex}`).value = "Signature";
		worksheet.getCell(`A${rowIndex}`).font = fontBold;
		setBorder(worksheet.getCell(`A${rowIndex}`));
		worksheet.mergeCells(`B${rowIndex}:E${rowIndex}`);
		for (let c = 2; c <= 5; c++) setBorder(worksheet.getCell(rowIndex, c));
		worksheet.mergeCells(`F${rowIndex}:I${rowIndex}`);
		for (let c = 6; c <= 9; c++) setBorder(worksheet.getCell(rowIndex, c));
		worksheet.mergeCells(`J${rowIndex}:L${rowIndex}`);
		for (let c = 10; c <= 12; c++) setBorder(worksheet.getCell(rowIndex, c));
		worksheet.getRow(rowIndex).height = 40;
		rowIndex++;
		worksheet.getCell(`A${rowIndex}`).value = "Date";
		worksheet.getCell(`A${rowIndex}`).font = fontBold;
		setBorder(worksheet.getCell(`A${rowIndex}`));
		const today = "";
		worksheet.mergeCells(`B${rowIndex}:E${rowIndex}`);
		worksheet.getCell(`B${rowIndex}`).value = today;
		worksheet.getCell(`B${rowIndex}`).alignment = alignCenter;
		for (let c = 2; c <= 5; c++) setBorder(worksheet.getCell(rowIndex, c));
		worksheet.mergeCells(`F${rowIndex}:I${rowIndex}`);
		worksheet.getCell(`F${rowIndex}`).value = today;
		worksheet.getCell(`F${rowIndex}`).alignment = alignCenter;
		for (let c = 6; c <= 9; c++) setBorder(worksheet.getCell(rowIndex, c));
		worksheet.mergeCells(`J${rowIndex}:L${rowIndex}`);
		worksheet.getCell(`J${rowIndex}`).value = today;
		worksheet.getCell(`J${rowIndex}`).alignment = alignCenter;
		for (let c = 10; c <= 12; c++) setBorder(worksheet.getCell(rowIndex, c));
		const buffer = await workbook.xlsx.writeBuffer();
		await downloadFile(new Uint8Array(buffer), "Generator_Sizing_Calculation.xlsx", "Excel Document", ["xlsx"]);
	};
	const exportPdf = () => {
		const doc = new import_jspdf_node_min.default();
		doc.text("Generator Sizing Calculation", 14, 15);
		const tableData = rows.map((r) => {
			const rKw = Number(r.kwPerUnit) || 0;
			const rUnit = Number(r.unit) || 0;
			const rSb = Number(r.standby) || 0;
			const rEm = r.excludeEmergency ? 0 : Number(r.emergency) || 0;
			const rMult = Number(r.multiplier) || 0;
			return [
				r.desc,
				rUnit.toString(),
				rKw.toString(),
				r.starter,
				rMult.toString(),
				(rUnit * rKw - rSb).toFixed(2),
				rEm.toString()
			];
		});
		autoTable(doc, {
			head: [[
				"Description",
				"Unit",
				unitSystem === "ip" ? "HP/Unit" : "kW/Unit",
				"Starter",
				"Multiplier",
				unitSystem === "ip" ? "ACL (HP)" : "ACL (kW)",
				unitSystem === "ip" ? "Emerg (HP)" : "Emerg (kW)"
			]],
			body: tableData,
			startY: 20
		});
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), "generator_sizing.pdf", "PDF Document", ["pdf"]);
	};
	const createNewProject = async () => {
		const name = await prompt("Enter new project name:", "", { title: "New Project" });
		if (name && !projects[name]) {
			setProjects((p) => ({
				...p,
				[name]: []
			}));
			setCurrentProject(name);
			pushState([]);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Generator Sizing",
		subtitle: "Calculate DG set size based on connected and emergency loads",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex flex-col h-full w-full",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex px-4 border-b border-border gap-6 bg-surface-1 pt-1 shrink-0 select-none",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setActiveTab("equipment"),
							className: `py-2 text-[13px] font-semibold tracking-wide border-b-2 transition-colors ${activeTab === "equipment" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`,
							children: "Generator"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setActiveTab("report"),
							className: `py-2 text-[13px] font-semibold tracking-wide border-b-2 transition-colors ${activeTab === "report" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`,
							children: "Report"
						})]
					}),
					activeTab === "report" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex-1 p-6 overflow-y-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "max-w-3xl mx-auto bg-surface-1 border border-border rounded-lg p-6 shadow-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-lg font-semibold mb-4",
									children: "Calculator Reports"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[13.5px] text-muted-foreground mb-6",
									children: "Export your finalized generator sizing calculations. Make sure you have completed all manual overrides and configuration before exporting."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "border border-border rounded-lg p-4 bg-background flex flex-col items-start gap-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "size-10 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-5" })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "font-semibold text-[14px]",
												children: "Excel Spreadsheet"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[12.5px] text-muted-foreground mt-1",
												children: "Export raw calculation rows to an XLSX file."
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TBtn, {
												primary: true,
												onClick: exportExcel,
												className: "mt-2 w-full justify-center"
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "border border-border rounded-lg p-4 bg-background flex flex-col items-start gap-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "size-10 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-5" })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "font-semibold text-[14px]",
												children: "PDF Document"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[12.5px] text-muted-foreground mt-1",
												children: "Generate a formatted PDF calculation report."
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TBtn, {
												primary: true,
												onClick: exportPdf,
												className: "mt-2 w-full justify-center",
												children: "Export PDF"
											})
										]
									})]
								})
							]
						})
					}),
					activeTab === "equipment" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col h-full overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col md:flex-row items-start md:items-center justify-between px-4 py-2 min-h-[48px] h-auto border-b border-border bg-background shrink-0 select-none gap-y-3 overflow-x-auto",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											placeholder: "Search...",
											className: "h-7 w-56 pl-8 pr-2 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded text-[12.5px] outline-none transition-colors"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Funnel, { className: "size-3.5" }), " Filters"] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, { className: "size-3.5" }), " View"] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-px h-4 bg-border mx-1" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex rounded border border-border p-0.5 bg-surface-2 shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => handleUnitToggle("si"),
											className: `px-3 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer ${unitSystem === "si" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
											children: "SI"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => handleUnitToggle("ip"),
											className: `px-3 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer ${unitSystem === "ip" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
											children: "IP"
										})]
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportExcelBtn, {
										columnMapping: {
											"Description": "desc",
											"Unit": "unit",
											"kW / UNIT": "kwPerUnit",
											"Starter Types": "starter",
											"Standby (A)": "standby",
											"Emergency Load": "emergency",
											"Power Failure Load": "powerFail",
											"Remarks": "remark"
										},
										onImport: handleImportExcelRows
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-px h-4 bg-border mx-1" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
										className: "h-8 text-[12.5px] font-medium bg-surface-2 hover:bg-surface-3 border border-transparent hover:border-border rounded px-2 outline-none cursor-pointer transition-colors",
										value: currentProject,
										onChange: (e) => {
											if (e.target.value !== "NEW_PROJECT") {
												setCurrentProject(e.target.value);
												pushState(projects[e.target.value] || []);
											}
										},
										children: Object.keys(projects).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: p,
											children: p
										}, p))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										onClick: createNewProject,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderKanban, { className: "size-3.5" }), " New Project"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										primary: true,
										onClick: addRow,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " New Row"]
									})
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col xl:flex-row flex-1 min-h-0 overflow-y-auto xl:overflow-hidden",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-col flex-1 min-w-0 min-h-0 border-b xl:border-b-0 xl:border-r border-white/40 dark:border-white/10 overflow-y-auto bg-transparent",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "p-4 flex-1 overflow-x-auto w-full",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl overflow-x-auto shadow-[0_20px_50px_rgba(0,0,0,0.1)] min-w-[1000px]",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
											id: "generator-grid",
											className: "w-full text-[12.5px] border-collapse",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
												className: "bg-white/40 dark:bg-white/5 sticky top-0 border-b border-white/40 dark:border-white/10 z-10 font-semibold text-muted-foreground",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "text-left font-semibold",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-2 py-2 border-r border-border w-14 text-center",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "checkbox",
																className: "cursor-pointer",
																checked: rows.length > 0 && selectedRows.size === rows.length,
																onChange: (e) => {
																	if (e.target.checked) selectAll();
																	else clearSelection();
																}
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-2 border-r border-border",
															children: "Description"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-2 border-r border-border w-16 text-center",
															children: "Unit"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-2 border-r border-border w-20 text-center",
															children: unitSystem === "ip" ? "HP / UNIT" : "kW / UNIT"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-2 border-r border-border w-32 text-center",
															children: "Starter Type"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-2 border-r border-border w-16 text-center",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "flex items-center gap-1 justify-center w-full cursor-help",
																title: "Multiplication factor for starting current. Typically 7 for DOL, 3.5 for Star Delta/Soft Starter, 1 for VFD.",
																children: ["Mult. ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-3" })]
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-2 border-r border-border w-24 text-center",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "flex items-center gap-1 justify-center w-full cursor-help",
																title: "kW * 1.739 * Multiplier",
																children: ["Start Cur. ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-3" })]
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-2 border-r border-border w-20 text-center",
															children: unitSystem === "ip" ? "Total (HP)" : "Total (kW)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-2 border-r border-border w-20 text-center",
															children: unitSystem === "ip" ? "Standby (HP)" : "Standby (kW)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-2 border-r border-border w-20 text-center",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "flex items-center gap-1 justify-center w-full cursor-help",
																title: "Actual Connected Load (Total kW - Standby)",
																children: ["ACL ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-3" })]
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-2 border-r border-border w-24 text-center",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "flex items-center gap-1 justify-center w-full cursor-help",
																title: "Defaults to ACL. Used to calculate emergency DG size.",
																children: ["Emergency ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-3" })]
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-2 border-r border-border w-32 text-center",
															children: unitSystem === "ip" ? "Power Fail (HP)" : "Power Fail (kW)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "px-3 py-2 border-r border-border w-48 text-center",
															children: "Remark"
														})
													]
												})
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
												className: "divide-y divide-border",
												children: rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													colSpan: 12,
													className: "text-center py-10 text-muted-foreground italic",
													children: "No loads added. Click \"+ Add Load\" to begin."
												}) }) : rows.map((r, rowIndex) => {
													const rKw = Number(r.kwPerUnit) || 0;
													const rSb = Number(r.standby) || 0;
													const rUnit = Number(r.unit) || 0;
													const rMult = Number(r.multiplier) || 0;
													const startCur = rKw * 1.739 * rMult;
													const totalKw = rUnit * rKw;
													const actualKw = totalKw - rSb;
													return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
														className: `hover:bg-surface-2 transition-colors cursor-pointer ${selectedRows.has(r.id) ? "bg-primary/5" : ""} ${draggedRowIndex === rowIndex ? "opacity-50" : ""}`,
														draggable: true,
														onDragStart: (e) => handleDragStart(e, rowIndex),
														onDragOver: (e) => handleDragOver(e, rowIndex),
														onDrop: handleDrop,
														onDragEnd: handleDrop,
														onClick: (e) => {
															if (e.target.tagName === "TD") toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
														},
														onContextMenu: (e) => {
															e.preventDefault();
															alert("Context Menu: \n- Edit Row\n- Duplicate\n- Delete");
														},
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "flex items-center justify-center gap-1.5 h-9 px-1",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GripVertical, { className: "size-3.5 text-muted-foreground/50 cursor-grab active:cursor-grabbing hover:text-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																		type: "checkbox",
																		className: "cursor-pointer",
																		checked: selectedRows.has(r.id),
																		onChange: () => {},
																		onClick: (e) => {
																			e.stopPropagation();
																			toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
																		}
																	})]
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																	"data-row": rowIndex,
																	"data-col": 0,
																	type: "text",
																	className: "w-full h-9 px-3 bg-transparent outline-none focus:bg-white",
																	value: r.desc,
																	onChange: (e) => updateRow(r.id, "desc", e.target.value),
																	placeholder: "Description"
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																	"data-row": rowIndex,
																	"data-col": 1,
																	type: "number",
																	className: "w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
																	value: r.unit,
																	onChange: (e) => updateRow(r.id, "unit", e.target.value)
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																	"data-row": rowIndex,
																	"data-col": 2,
																	type: "number",
																	className: "w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
																	value: r.kwPerUnit,
																	onChange: (e) => updateRow(r.id, "kwPerUnit", e.target.value)
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																	"data-row": rowIndex,
																	"data-col": 3,
																	className: "w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white cursor-pointer",
																	value: r.starter,
																	onChange: (e) => updateRow(r.id, "starter", e.target.value),
																	children: [
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "DOL",
																			children: "DOL"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "SD",
																			children: "Star Delta"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "Soft Starter",
																			children: "Soft Starter"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "VFD",
																			children: "VFD"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "None",
																			children: "None"
																		})
																	]
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border bg-primary/10",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																	"data-row": rowIndex,
																	"data-col": 4,
																	type: "number",
																	className: "w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
																	value: r.multiplier,
																	onChange: (e) => updateRow(r.id, "multiplier", e.target.value)
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "px-3 py-2 text-center font-semibold text-foreground border-r border-border",
																children: startCur.toFixed(2)
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "px-3 py-2 text-center text-muted-foreground border-r border-border",
																children: totalKw.toFixed(2)
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																	"data-row": rowIndex,
																	"data-col": 5,
																	type: "number",
																	className: "w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
																	value: r.standby,
																	onChange: (e) => updateRow(r.id, "standby", e.target.value)
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "px-3 py-2 text-center font-semibold text-primary border-r border-border",
																children: actualKw.toFixed(2)
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border relative group/em",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "flex items-center w-full h-full",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																		"data-row": rowIndex,
																		"data-col": 6,
																		type: "number",
																		className: `w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${r.excludeEmergency ? "opacity-30 line-through" : ""}`,
																		value: r.emergency,
																		onChange: (e) => updateRow(r.id, "emergency", e.target.value),
																		disabled: r.excludeEmergency
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																		onClick: () => updateRow(r.id, "excludeEmergency", !r.excludeEmergency),
																		className: "absolute right-1 opacity-0 group-hover/em:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-opacity bg-white shadow-sm rounded border border-border",
																		title: r.excludeEmergency ? "Include Emergency Load" : "Exclude Emergency Load",
																		children: r.excludeEmergency ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3" })
																	})]
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																className: "p-0 flex items-center border-r border-border",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																	"data-row": rowIndex,
																	"data-col": 7,
																	type: "number",
																	className: "w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none flex-1",
																	value: r.powerFail,
																	onChange: (e) => updateRow(r.id, "powerFail", e.target.value)
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																	className: "h-9 w-12 px-1 bg-primary/10 text-primary outline-none cursor-pointer border-l border-border/50 text-[11px] font-medium",
																	defaultValue: "",
																	onChange: (e) => {
																		setPowerFailPercent(r.id, e.target.value);
																		e.target.value = "";
																	},
																	children: [
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "",
																			disabled: true,
																			children: "%"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "10",
																			children: "10%"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "20",
																			children: "20%"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "30",
																			children: "30%"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "40",
																			children: "40%"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "50",
																			children: "50%"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "60",
																			children: "60%"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "70",
																			children: "70%"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "80",
																			children: "80%"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "90",
																			children: "90%"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "100",
																			children: "100%"
																		})
																	]
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-0 border-r border-border",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																	"data-row": rowIndex,
																	"data-col": 8,
																	type: "text",
																	className: "w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white",
																	value: r.remark || "",
																	onChange: (e) => updateRow(r.id, "remark", e.target.value)
																})
															})
														]
													}, r.id);
												})
											})]
										})
									})
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col w-full xl:w-[320px] shrink-0 border-t xl:border-t-0 xl:border-l border-white/40 dark:border-white/10 bg-transparent overflow-y-auto p-4 gap-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-4 shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 border-b border-white/40 dark:border-white/10 pb-2",
											children: "Sizing Parameters"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "space-y-3 text-[13px]",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-medium",
													children: "Power Factor (Lag)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "0.01",
													className: "w-20 px-2 py-1 border border-border rounded outline-none text-right [appearance:textfield]",
													value: pf,
													onChange: (e) => setPf(parseFloat(e.target.value) || .8)
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-medium",
													children: "Loading Factor"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "0.01",
													className: "w-20 px-2 py-1 border border-border rounded outline-none text-right [appearance:textfield]",
													value: lf,
													onChange: (e) => setLf(parseFloat(e.target.value) || .9)
												})]
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										"data-ignore-persist": "true",
										className: "bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col justify-between overflow-hidden shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "px-4 py-3 border-b border-white/40 dark:border-white/10 flex items-center justify-between bg-primary/10",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-primary rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "font-bold text-[12px] text-primary uppercase tracking-wide",
													children: "Generator Result"
												})]
											}), Object.keys(manualOverrides).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: clearOverrides,
												className: "text-[10px] bg-white/50 hover:bg-white dark:bg-black/20 dark:hover:bg-black/40 text-primary px-2 py-0.5 rounded font-bold uppercase transition-colors shadow-sm",
												children: "Clear Overrides"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "p-4 space-y-3",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid grid-cols-[1fr_80px_80px] gap-4 pb-2 border-b border-surface-2",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
															children: "Parameter"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right",
															children: "ACL Base"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right",
															children: "Emerg. Base"
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid grid-cols-[1fr_80px_80px] gap-4 items-center pb-2 border-b border-surface-2",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[12.5px] font-medium text-muted-foreground border-b border-dotted border-muted-foreground/50 cursor-help inline-block w-fit",
															title: "Total Actual Connected Load",
															children: [
																"Total ACL (",
																unitSystem === "ip" ? "HP" : "kW",
																")"
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-right",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																className: "w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]",
																value: manualOverrides["acl"] !== void 0 ? manualOverrides["acl"] : calc.totalAcl.toFixed(2),
																onChange: (e) => setOverride("acl", e.target.value),
																onBlur: (e) => {
																	if (e.target.value === "") {
																		const copy = { ...manualOverrides };
																		delete copy["acl"];
																		setManualOverrides(copy);
																	}
																}
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-right",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																className: "w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]",
																value: manualOverrides["em"] !== void 0 ? manualOverrides["em"] : calc.totalEmergency.toFixed(2),
																onChange: (e) => setOverride("em", e.target.value),
																onBlur: (e) => {
																	if (e.target.value === "") {
																		const copy = { ...manualOverrides };
																		delete copy["em"];
																		setManualOverrides(copy);
																	}
																}
															})
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid grid-cols-[1fr_80px_80px] gap-4 items-center pb-2 border-b border-surface-2",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[12.5px] font-medium text-muted-foreground border-b border-dotted border-muted-foreground/50 cursor-help inline-block w-fit",
															title: "Demand Load = Actual Connected Load / Power Factor",
															children: "Demand Load (kVA)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-right",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																className: "w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]",
																value: manualOverrides["demandAcl"] !== void 0 ? manualOverrides["demandAcl"] : calc.demandLoadAcl.toFixed(2),
																onChange: (e) => setOverride("demandAcl", e.target.value),
																onBlur: (e) => {
																	if (e.target.value === "") {
																		const copy = { ...manualOverrides };
																		delete copy["demandAcl"];
																		setManualOverrides(copy);
																	}
																}
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-right",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																className: "w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]",
																value: manualOverrides["demandEm"] !== void 0 ? manualOverrides["demandEm"] : calc.demandLoadEm.toFixed(2),
																onChange: (e) => setOverride("demandEm", e.target.value),
																onBlur: (e) => {
																	if (e.target.value === "") {
																		const copy = { ...manualOverrides };
																		delete copy["demandEm"];
																		setManualOverrides(copy);
																	}
																}
															})
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid grid-cols-[1fr_80px_80px] gap-4 items-center pb-2 border-b border-surface-2",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[12.5px] font-medium text-muted-foreground border-b border-dotted border-muted-foreground/50 cursor-help inline-block w-fit",
															title: "Calculated size for DG set (Demand Load / Loading Factor)",
															children: "Calc. DG Size (kVA)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-right",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																className: "w-full text-right text-[13px] font-bold text-primary bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]",
																value: manualOverrides["calcAcl"] !== void 0 ? manualOverrides["calcAcl"] : calc.calcSizeAcl.toFixed(2),
																onChange: (e) => setOverride("calcAcl", e.target.value),
																onBlur: (e) => {
																	if (e.target.value === "") {
																		const copy = { ...manualOverrides };
																		delete copy["calcAcl"];
																		setManualOverrides(copy);
																	}
																}
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-right",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																className: "w-full text-right text-[13px] font-bold text-primary bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]",
																value: manualOverrides["calcEm"] !== void 0 ? manualOverrides["calcEm"] : calc.calcSizeEm.toFixed(2),
																onChange: (e) => setOverride("calcEm", e.target.value),
																onBlur: (e) => {
																	if (e.target.value === "") {
																		const copy = { ...manualOverrides };
																		delete copy["calcEm"];
																		setManualOverrides(copy);
																	}
																}
															})
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "pt-2 flex justify-between items-end",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1",
														children: "Selected DG Set Size"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "flex items-center gap-1.5 mt-1",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
															value: calc.selectedSize.toString(),
															onValueChange: (val) => setUserSelectedSize(Number(val)),
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
																className: "text-[28px] h-auto font-bold tracking-tight text-primary bg-transparent outline-none border border-border rounded px-3 py-1 cursor-pointer hover:bg-surface-2 transition-colors focus:ring-2 focus:ring-primary/20 shadow-sm w-[180px]",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, {
																className: "max-h-[300px]",
																children: STANDARD_SIZES.map((size) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectItem, {
																	value: size.toString(),
																	className: "text-[14px]",
																	children: [size, " kVA"]
																}, size))
															})]
														})
													})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-right pb-1",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "text-[13px] font-medium text-muted-foreground",
																children: ["Max Start:", " "]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "inline-block w-16 ml-1",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																	type: "number",
																	className: "w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]",
																	value: manualOverrides["maxStart"] !== void 0 ? manualOverrides["maxStart"] : calc.maxStartCur.toFixed(2),
																	onChange: (e) => setOverride("maxStart", e.target.value),
																	onBlur: (e) => {
																		if (e.target.value === "") {
																			const copy = { ...manualOverrides };
																			delete copy["maxStart"];
																			setManualOverrides(copy);
																		}
																	}
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[13px] font-bold text-foreground ml-1",
																children: "A"
															})
														]
													})]
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-4 text-[12.5px] shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "font-semibold text-muted-foreground mb-3 pb-2 border-b border-white/40 dark:border-white/10",
											children: "Motor Analysis"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "space-y-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground",
														children: "Max Starting Current"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-medium font-mono",
														children: [calc.maxStartCur.toFixed(2), " A"]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground",
														children: "Largest Motor Size"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-medium font-mono",
														children: calc.largestMotorKw > 0 ? unitSystem === "ip" ? (calc.largestMotorKw / .746).toFixed(2) + " HP" : calc.largestMotorKw.toFixed(2) + " kW" : "-"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground",
														children: "Largest Motor Starter"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-medium",
														children: calc.largestMotorKw > 0 ? calc.largestMotorStarter : "-"
													})]
												})
											]
										})]
									})
								]
							})]
						})]
					})
				]
			})]
		})
	});
}
//#endregion
export { GeneratorSizingPage as component };
