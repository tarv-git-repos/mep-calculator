import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { N as Plus, Ot as ChevronRight, _t as Download, kt as ChevronDown, l as Upload, m as Trash2 } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { t as AppShell } from "./AppShell-urg-0zDa.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { n as utils, t as readSync } from "../_libs/xlsx.mjs";
import { t as ImportExcelBtn } from "./ImportExcelBtn-rAnQAoVD.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/busbar-calculation-BkXUov7X.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
require_excel();
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
var COPPER_BUSBAR_DATA = {
	"1000_rt": {
		r: .0523,
		x: .019,
		label: "1000 (Rt)"
	},
	"1000_r50": {
		r: .0474,
		x: .019,
		label: "1000 (R@50%RC)"
	},
	"1250_rt": {
		r: .0398,
		x: .017,
		label: "1250 (Rt)"
	},
	"1250_r50": {
		r: .0348,
		x: .017,
		label: "1250 (R@50%RC)"
	},
	"1600_rt": {
		r: .0277,
		x: .015,
		label: "1600 (Rt)"
	},
	"1600_r50": {
		r: .0237,
		x: .015,
		label: "1600 (R@50%RC)"
	},
	"2000_rt": {
		r: .0218,
		x: .014,
		label: "2000 (Rt)"
	},
	"2000_r50": {
		r: .0187,
		x: .014,
		label: "2000 (R@50%RC)"
	},
	"2500_rt": {
		r: .0177,
		x: .01,
		label: "2500 (Rt)"
	},
	"2500_r50": {
		r: .0151,
		x: .01,
		label: "2500 (R@50%RC)"
	},
	"3200_rt": {
		r: .0121,
		x: .006,
		label: "3200 (Rt)"
	},
	"3200_r50": {
		r: .0114,
		x: .006,
		label: "3200 (R@50%RC)"
	},
	"4000_rt": {
		r: .0108,
		x: .006,
		label: "4000 (Rt)"
	},
	"4000_r50": {
		r: .0093,
		x: .006,
		label: "4000 (R@50%RC)"
	},
	"5000_rt": {
		r: .0089,
		x: .005,
		label: "5000 (Rt)"
	},
	"5000_r50": {
		r: .0075,
		x: .005,
		label: "5000 (R@50%RC)"
	},
	"6300_rt": {
		r: .0065,
		x: .005,
		label: "6300 (Rt)"
	},
	"6300_r50": {
		r: .0061,
		x: .005,
		label: "6300 (R@50%RC)"
	}
};
function BusbarCalculationPage() {
	const confirm = useConfirm();
	const [panels, setPanels] = (0, import_react.useState)(() => {
		if (typeof window !== "undefined") try {
			const saved = localStorage.getItem("mep-busbar-calculation-v1");
			if (saved) return JSON.parse(saved);
		} catch (e) {
			console.error("Failed to parse busbar panels:", e);
		}
		return [{
			id: `pan_${Date.now()}`,
			name: "LV PANEL-1",
			sections: [{
				id: `sec_${Date.now()}`,
				name: "BB-1",
				ratingId: "2500_rt",
				volts: 415,
				pf: .8,
				rows: [
					{
						id: `bb_${Date.now()}_1`,
						from: "LV PANEL-1",
						desc: "SMDB-L7-1",
						ref: "BB-1",
						length: 160,
						loadKw: 112.08,
						div: .7
					},
					{
						id: `bb_${Date.now()}_2`,
						from: "LV PANEL-1",
						desc: "SMDB-L8-1",
						ref: "BB-1",
						length: 3.5,
						loadKw: 112.08,
						div: .7
					},
					{
						id: `bb_${Date.now()}_3`,
						from: "LV PANEL-1",
						desc: "SMDB-L9-1",
						ref: "BB-1",
						length: 3.5,
						loadKw: 112.08,
						div: .7
					},
					{
						id: `bb_${Date.now()}_4`,
						from: "LV PANEL-1",
						desc: "SMDB-L10-1",
						ref: "BB-1",
						length: 3.5,
						loadKw: 112.08,
						div: .7
					}
				]
			}]
		}];
	});
	(0, import_react.useEffect)(() => {
		localStorage.setItem("mep-busbar-calculation-v1", JSON.stringify(panels));
	}, [panels]);
	const [customBusbars, setCustomBusbars] = (0, import_react.useState)({});
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("si");
	const [collapsedPanels, setCollapsedPanels] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [selectedRows, setSelectedRows] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [lastSelectedRowId, setLastSelectedRowId] = (0, import_react.useState)(null);
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
		setRedoStack((old) => [...old, JSON.parse(JSON.stringify(panels))]);
		setPanels(prev);
	};
	const handleRedo = () => {
		if (redoStack.length === 0) return;
		const next = redoStack[redoStack.length - 1];
		setRedoStack((old) => old.slice(0, -1));
		setUndoStack((old) => [...old, JSON.parse(JSON.stringify(panels))]);
		setPanels(next);
	};
	const toggleRowSelect = (rowId, isShift, isCtrl) => {
		setSelectedRows((prev) => {
			const next = new Set(prev);
			const allRows = [];
			panels.forEach((p) => p.sections.forEach((s) => s.rows.forEach((r) => allRows.push(r))));
			const clickedIdx = allRows.findIndex((r) => r.id === rowId);
			if (clickedIdx === -1) return prev;
			if (isShift && lastSelectedRowId) {
				const lastIdx = allRows.findIndex((r) => r.id === lastSelectedRowId);
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
		panels.forEach((p) => p.sections.forEach((s) => s.rows.forEach((r) => {
			if (ids.includes(r.id)) toCopy.push(r);
		})));
		if (toCopy.length > 0) {
			localStorage.setItem("mep_clipboard_busbars", JSON.stringify(toCopy));
			const text = toCopy.map((r) => `${r.from}\t${r.desc}\t${r.ref}\t${r.length}\t${r.loadKw}\t${r.div}`).join("\n");
			navigator.clipboard?.writeText(text).catch(() => {});
		}
	};
	const cutRows = (ids) => {
		pushToUndo(panels);
		copyRows(ids);
		setPanels((prev) => prev.map((p) => ({
			...p,
			sections: p.sections.map((s) => ({
				...s,
				rows: s.rows.filter((r) => !ids.includes(r.id))
			}))
		})));
	};
	const pasteRows = () => {
		pushToUndo(panels);
		try {
			const clipboardData = localStorage.getItem("mep_clipboard_busbars");
			if (clipboardData) {
				const parsed = JSON.parse(clipboardData);
				if (Array.isArray(parsed)) {
					const newRows = parsed.map((r) => ({
						...r,
						id: `bb_${Date.now()}_${Math.floor(Math.random() * 1e3)}`
					}));
					setPanels((prev) => {
						const next = [...prev];
						if (next.length > 0 && next[0].sections.length > 0) next[0].sections[0] = {
							...next[0].sections[0],
							rows: [...next[0].sections[0].rows, ...newRows]
						};
						return next;
					});
					setSelectedRows(new Set(newRows.map((r) => r.id)));
					return newRows;
				}
			}
		} catch (err) {
			console.error(err);
		}
		return [];
	};
	const ALL_BUSBAR_DATA = (0, import_react.useMemo)(() => ({
		...COPPER_BUSBAR_DATA,
		...customBusbars
	}), [customBusbars]);
	(0, import_react.useEffect)(() => {
		const handlePaste = (e) => {
			if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT") return;
			const clipboardData = e.clipboardData?.getData("Text");
			if (!clipboardData) return;
			e.preventDefault();
			pushToUndo(panels);
			try {
				if (clipboardData.trim().startsWith("[") && clipboardData.trim().endsWith("]")) {
					const parsed = JSON.parse(clipboardData);
					if (Array.isArray(parsed) && parsed.length > 0 && "from" in parsed[0]) {
						const newRows = parsed.map((r) => ({
							...r,
							id: `bb_${Date.now()}_${Math.floor(Math.random() * 1e3)}`
						}));
						setPanels((prev) => {
							const next = [...prev];
							if (next.length > 0 && next[0].sections.length > 0) next[0].sections[0] = {
								...next[0].sections[0],
								rows: [...next[0].sections[0].rows, ...newRows]
							};
							return next;
						});
						setSelectedRows(new Set(newRows.map((r) => r.id)));
						return;
					}
				}
			} catch (err) {}
			const newRows = clipboardData.trim().split("\n").map((r) => r.split("	")).map((cols) => {
				return {
					id: `bb_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
					from: cols[0]?.trim() || "LV PANEL-1",
					desc: cols[1]?.trim() || "",
					ref: cols[2]?.trim() || "BB-1",
					length: cols[3] !== void 0 && cols[3] !== "" ? Number(cols[3]) : "",
					loadKw: cols[4] !== void 0 && cols[4] !== "" ? Number(cols[4]) : "",
					div: cols[5] !== void 0 && cols[5] !== "" ? Number(cols[5]) : .7
				};
			});
			setPanels((prev) => {
				const next = [...prev];
				if (next.length > 0 && next[0].sections.length > 0) next[0].sections[0] = {
					...next[0].sections[0],
					rows: [...next[0].sections[0].rows, ...newRows]
				};
				return next;
			});
			setSelectedRows(new Set(newRows.map((r) => r.id)));
		};
		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [panels]);
	(0, import_react.useEffect)(() => {
		const handleGlobalKeyDown = (e) => {
			if (e.key === "Escape") {
				if (selectedRows.size > 0) {
					e.preventDefault();
					setSelectedRows(/* @__PURE__ */ new Set());
					setLastSelectedRowId(null);
				}
				return;
			}
			if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT") return;
			const isCmdOrCtrl = navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? e.metaKey : e.ctrlKey;
			if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
				e.preventDefault();
				const allIds = /* @__PURE__ */ new Set();
				panels.forEach((p) => p.sections.forEach((s) => s.rows.forEach((r) => allIds.add(r.id))));
				setSelectedRows(allIds);
			}
			if (e.key === "Delete" || e.key === "Backspace") {
				if (selectedRows.size > 0) {
					e.preventDefault();
					pushToUndo(panels);
					setPanels((prev) => prev.map((p) => ({
						...p,
						sections: p.sections.map((s) => ({
							...s,
							rows: s.rows.filter((r) => !selectedRows.has(r.id))
						}))
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
	}, [
		panels,
		selectedRows,
		undoStack,
		redoStack
	]);
	const togglePanel = (id) => {
		setCollapsedPanels((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};
	const handleUnitToggle = (newSystem) => {
		if (newSystem === unitSystem) return;
		pushToUndo(panels);
		setUnitSystem(newSystem);
		setPanels((prev) => prev.map((p) => ({
			...p,
			sections: p.sections.map((s) => ({
				...s,
				rows: s.rows.map((r) => ({
					...r,
					length: newSystem === "ip" ? Number((Number(r.length) * 3.28084).toFixed(2)) : Number((Number(r.length) / 3.28084).toFixed(2))
				}))
			}))
		})));
	};
	const addPanel = () => {
		pushToUndo(panels);
		const num = panels.length + 1;
		setPanels([...panels, {
			id: `pan_${Date.now()}`,
			name: `LV PANEL-${num}`,
			sections: [{
				id: `sec_${Date.now()}`,
				name: `BB-1`,
				ratingId: "2500_rt",
				volts: 415,
				pf: .8,
				rows: []
			}]
		}]);
	};
	const removePanel = async (id) => {
		if (panels.length === 1) {
			if (await confirm("Are you sure you want to clear the only panel?")) {
				pushToUndo(panels);
				setPanels([{
					...panels[0],
					sections: []
				}]);
			}
			return;
		}
		if (await confirm("Are you sure you want to remove this LV Panel?")) {
			pushToUndo(panels);
			setPanels(panels.filter((p) => p.id !== id));
		}
	};
	const updatePanel = (id, field, val) => {
		pushToUndo(panels);
		setPanels(panels.map((p) => p.id === id ? {
			...p,
			[field]: val
		} : p));
	};
	const addSection = (panelId) => {
		pushToUndo(panels);
		setPanels(panels.map((p) => {
			if (p.id === panelId) {
				const num = p.sections.length + 1;
				return {
					...p,
					sections: [...p.sections, {
						id: `sec_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
						name: `BB-${num}`,
						ratingId: "2500_rt",
						volts: 415,
						pf: .8,
						rows: []
					}]
				};
			}
			return p;
		}));
	};
	const removeSection = async (panelId, sectionId) => {
		pushToUndo(panels);
		setPanels(panels.map((p) => {
			if (p.id === panelId) return {
				...p,
				sections: p.sections.filter((s) => s.id !== sectionId)
			};
			return p;
		}));
	};
	const updateSection = (panelId, sectionId, field, val) => {
		pushToUndo(panels);
		setPanels(panels.map((p) => {
			if (p.id === panelId) return {
				...p,
				sections: p.sections.map((s) => s.id === sectionId ? {
					...s,
					[field]: val
				} : s)
			};
			return p;
		}));
	};
	const handleImportExcelRows = (panelId, sectionId, mappedRows) => {
		pushToUndo(panels);
		setPanels(panels.map((p) => {
			if (p.id === panelId) return {
				...p,
				sections: p.sections.map((s) => {
					if (s.id === sectionId) {
						const newRows = mappedRows.map((mr, idx) => ({
							id: `bb_${Date.now()}_${Math.floor(Math.random() * 1e3)}_${idx}`,
							from: mr.from || (s.rows.length === 0 && idx === 0 ? p.name : ""),
							desc: mr.desc || `Tap Off ${s.rows.length + idx + 1}`,
							ref: mr.ref || "",
							length: Number(mr.length) || 10,
							loadKw: Number(mr.loadKw) || 0,
							div: Number(mr.div) || 1
						}));
						return {
							...s,
							rows: [...s.rows, ...newRows]
						};
					}
					return s;
				})
			};
			return p;
		}));
	};
	const addRow = (panelId, sectionId) => {
		pushToUndo(panels);
		setPanels(panels.map((p) => {
			if (p.id === panelId) return {
				...p,
				sections: p.sections.map((s) => {
					if (s.id === sectionId) {
						const newRow = {
							id: `bb_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
							from: s.rows.length === 0 ? p.name : s.rows[s.rows.length - 1].from,
							desc: s.rows.length === 0 ? "SMDB-L7-1" : "",
							ref: s.name,
							length: "",
							loadKw: "",
							div: .7
						};
						return {
							...s,
							rows: [...s.rows, newRow]
						};
					}
					return s;
				})
			};
			return p;
		}));
	};
	const removeRow = (panelId, sectionId, rowId) => {
		pushToUndo(panels);
		setPanels(panels.map((p) => {
			if (p.id === panelId) return {
				...p,
				sections: p.sections.map((s) => {
					if (s.id === sectionId) return {
						...s,
						rows: s.rows.filter((r) => r.id !== rowId)
					};
					return s;
				})
			};
			return p;
		}));
	};
	const updateRow = (panelId, sectionId, rowId, field, val) => {
		pushToUndo(panels);
		const isBulkEdit = selectedRows.has(rowId);
		setPanels(panels.map((p) => {
			if (!isBulkEdit && p.id !== panelId) return p;
			return {
				...p,
				sections: p.sections.map((s) => {
					if (!isBulkEdit && s.id !== sectionId) return s;
					return {
						...s,
						rows: s.rows.map((r) => {
							if (isBulkEdit && selectedRows.has(r.id)) return {
								...r,
								[field]: val
							};
							else if (!isBulkEdit && r.id === rowId) return {
								...r,
								[field]: val
							};
							return r;
						})
					};
				})
			};
		}));
	};
	const clearAll = async () => {
		if (await confirm("Are you sure you want to clear all data?")) {
			pushToUndo(panels);
			setPanels([{
				id: `pan_${Date.now()}`,
				name: "LV PANEL-1",
				sections: [{
					id: `sec_${Date.now()}`,
					name: "BB-1",
					ratingId: "2500_rt",
					volts: 415,
					pf: .8,
					rows: []
				}]
			}]);
		}
	};
	const calculatedPanels = (0, import_react.useMemo)(() => {
		return panels.map((panel) => {
			const calcSections = panel.sections.map((section) => {
				let totalLoad = 0;
				section.rows.forEach((r) => totalLoad += Number(r.loadKw) || 0);
				let currentRemainingTCL = totalLoad;
				let cumulativeVdPercent = 0;
				const calcRows = section.rows.map((r) => {
					const tcl = currentRemainingTCL;
					const md = tcl * (Number(r.div) || 0);
					let current = 0;
					const volts = Number(section.volts) || 0;
					const isThreePhase = volts >= 300;
					const pf = Number(section.pf) || 0;
					if (volts > 0 && pf > 0) if (isThreePhase) current = md * 1e3 / (Math.sqrt(3) * volts * pf);
					else current = md * 1e3 / (volts * pf);
					const rData = ALL_BUSBAR_DATA[section.ratingId] || {
						r: 0,
						x: 0
					};
					const sinPhi = Math.sin(Math.acos(pf));
					const lenNum = Number(r.length) || 0;
					const lenMeters = unitSystem === "ip" ? lenNum * .3048 : lenNum;
					let vd = 0;
					if (isThreePhase) vd = Math.sqrt(3) * current * lenMeters * (rData.r * pf + rData.x * sinPhi) / 1e3;
					else vd = 2 * current * lenMeters * (rData.r * pf + rData.x * sinPhi) / 1e3;
					const vdPercent = volts > 0 ? vd / volts * 100 : 0;
					cumulativeVdPercent += vdPercent;
					currentRemainingTCL -= Number(r.loadKw) || 0;
					return {
						...r,
						tcl,
						md,
						current,
						r: rData.r,
						x: rData.x,
						vd,
						vdPercent,
						cumulativeVdPercent
					};
				});
				const totalCumulativeVd = calcRows.length > 0 ? calcRows[calcRows.length - 1].cumulativeVdPercent : 0;
				return {
					...section,
					calcRows,
					totalCumulativeVd
				};
			});
			return {
				...panel,
				calcSections
			};
		});
	}, [
		panels,
		ALL_BUSBAR_DATA,
		unitSystem
	]);
	(0, import_react.useEffect)(() => {
		const vdMap = {};
		calculatedPanels.forEach((p) => {
			p.calcSections.forEach((s) => {
				s.calcRows.forEach((r) => {
					if (r.desc) vdMap[r.desc.trim()] = r.cumulativeVdPercent;
				});
				if (s.name) vdMap[s.name.trim()] = s.totalCumulativeVd;
			});
		});
		localStorage.setItem("mep-busbar-calculated-vd-v1", JSON.stringify(vdMap));
	}, [calculatedPanels]);
	const flatCalculatedSections = (0, import_react.useMemo)(() => {
		return calculatedPanels.flatMap((p) => p.calcSections.map((s) => ({
			...s,
			panelName: p.name
		})));
	}, [calculatedPanels]);
	const exportPdf = () => {
		const doc = new import_jspdf_node_min.default("landscape");
		flatCalculatedSections.forEach((section, sIndex) => {
			if (sIndex > 0) doc.addPage();
			doc.setFontSize(14);
			doc.text(`Busbar Voltage Drop Calculation - ${section.name}`, 14, 15);
			const tableData = section.calcRows.map((r, idx) => [
				idx + 1,
				r.desc,
				(r.length || 0).toString(),
				(r.loadKw || 0).toString(),
				r.tcl.toFixed(2),
				r.md.toFixed(2),
				r.current.toFixed(2),
				r.vd.toFixed(2),
				r.vdPercent.toFixed(3) + "%",
				r.cumulativeVdPercent.toFixed(3) + "%"
			]);
			autoTable(doc, {
				head: [[
					"No.",
					"Description",
					unitSystem === "ip" ? "Len(ft)" : "Len(m)",
					"Load(kW)",
					"TCL(kW)",
					"MD(kW)",
					"Current(A)",
					"Vdrop(V)",
					"Vdrop %",
					"Cum.%"
				]],
				body: tableData,
				startY: 20,
				styles: { fontSize: 8 }
			});
		});
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), "Busbar_Calculation.pdf", "PDF Document", ["pdf"]);
	};
	const handleImport = (event) => {
		const file = event.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			const workbook = readSync(new Uint8Array(e.target?.result), { type: "array" });
			const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
			const excelRows = utils.sheet_to_json(firstSheet, { raw: true });
			let importedCount = 0;
			const newCustoms = { ...customBusbars };
			excelRows.forEach((row) => {
				let rating = null, r = null, x = null, label = null;
				for (const key in row) {
					if (!key) continue;
					const k = key.toString().toLowerCase();
					const val = row[key];
					if (k.includes("rating") || k.includes("size")) rating = val;
					else if (k === "r" || k.includes("resist")) r = parseFloat(val);
					else if (k === "x" || k.includes("react")) x = parseFloat(val);
					else if (k.includes("label") || k.includes("type")) label = val;
				}
				if (rating && r != null && !isNaN(r) && x != null && !isNaN(x)) {
					const ratingStr = String(rating).trim();
					const safeLabel = label ? `${ratingStr} (${label})` : `${ratingStr} (Custom)`;
					const id = `custom_${ratingStr}_${Date.now()}_${importedCount}`;
					newCustoms[id] = {
						r,
						x,
						label: safeLabel
					};
					importedCount++;
				}
			});
			if (importedCount > 0) {
				setCustomBusbars(newCustoms);
				confirm(`Successfully imported ${importedCount} custom busbar ratings!`);
			} else confirm("Could not find columns for Rating, Resistance, and Reactance in the Excel file.\nPlease ensure your Excel file has headers like 'Busbar Rating', 'Resistance', and 'Reactance'.");
			event.target.value = "";
		};
		reader.readAsArrayBuffer(file);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Busbar Calculation",
		subtitle: "Calculate voltage drop over multiple busbars and panels",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }),
					" Import Ratings",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "file",
						accept: ".xlsx, .xls",
						className: "hidden",
						onChange: handleImport
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
				onClick: exportPdf,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" }), " PDF"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
				onClick: clearAll,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), " Clear All"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
				primary: true,
				onClick: addPanel,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add LV Panel"]
			})
		] }),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex flex-col h-full w-full",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between px-4 h-9 border-b border-border bg-background shrink-0 select-none",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[12px] font-semibold text-muted-foreground uppercase tracking-wide",
						children: "Sizer Workspace"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex rounded border border-border p-0.5 bg-surface-2 shrink-0 my-1 mr-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => handleUnitToggle("si"),
							className: `px-2.5 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer ${unitSystem === "si" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
							children: "SI"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => handleUnitToggle("ip"),
							className: `px-2.5 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer ${unitSystem === "ip" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
							children: "IP"
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex-1 overflow-auto bg-surface-1/50 p-4 gap-6 flex flex-col min-h-0",
					children: calculatedPanels.map((panel, pIdx) => {
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col bg-surface-2/30 border-2 border-border/60 rounded-2xl shadow-xl overflow-hidden shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-surface-2/80 border-b border-border/60 py-2 px-4 flex gap-4 items-center flex-wrap hover:bg-surface-2 transition-colors",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => togglePanel(panel.id),
										className: "p-1 rounded hover:bg-black/5 flex items-center justify-center shrink-0",
										children: collapsedPanels.has(panel.id) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-5 text-muted-foreground" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-5 text-muted-foreground" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[13px] font-bold text-foreground uppercase tracking-wider",
											children: "Panel Name:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: panel.name,
											onChange: (e) => updatePanel(panel.id, "name", e.target.value),
											className: "h-8 px-2 border border-border rounded bg-background focus:bg-white outline-none font-bold w-48 text-[13px]",
											onClick: (e) => e.stopPropagation()
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "ml-auto flex items-center gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
											onClick: (e) => {
												e.stopPropagation();
												addSection(panel.id);
											},
											primary: true,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add Busbar"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
											onClick: (e) => {
												e.stopPropagation();
												removePanel(panel.id);
											},
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), " Remove Panel"]
										})]
									})
								]
							}), !collapsedPanels.has(panel.id) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "p-4 flex flex-col gap-4",
								children: panel.calcSections.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-center py-10 text-muted-foreground italic bg-background rounded-lg border border-border",
									children: [
										"No busbars added to ",
										panel.name,
										". Click \"+ Add Busbar\"."
									]
								}) : panel.calcSections.map((section, sIdx) => {
									const isAllSelected = section.calcRows.length > 0 && section.calcRows.every((r) => selectedRows.has(r.id));
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "bg-white/40 dark:bg-white/5 border-b border-white/40 dark:border-white/10 py-2 px-3 flex gap-4 items-center justify-between flex-wrap",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-3 flex-wrap",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-xs font-semibold text-muted-foreground",
															children: "Name:"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "text",
															value: section.name,
															onChange: (e) => updateSection(panel.id, section.id, "name", e.target.value),
															className: "h-7 px-2 border border-border rounded bg-background focus:bg-white outline-none font-medium w-24 text-sm"
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-xs font-semibold text-muted-foreground",
															children: "Volts:"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "number",
															value: section.volts,
															onChange: (e) => updateSection(panel.id, section.id, "volts", e.target.value === "" ? "" : Number(e.target.value)),
															className: "h-7 px-2 border border-border rounded bg-background focus:bg-white outline-none font-medium w-16 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-xs font-semibold text-muted-foreground",
															children: "PF:"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "number",
															step: "0.01",
															max: "1",
															value: section.pf,
															onChange: (e) => updateSection(panel.id, section.id, "pf", e.target.value === "" ? "" : Number(e.target.value)),
															className: "h-7 px-2 border border-border rounded bg-background focus:bg-white outline-none font-medium w-16 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-xs font-semibold text-muted-foreground",
															children: "Rating:"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
															className: "h-7 px-2 border border-border rounded bg-background focus:bg-white outline-none font-medium cursor-pointer text-sm",
															value: section.ratingId,
															onChange: (e) => updateSection(panel.id, section.id, "ratingId", e.target.value),
															children: Object.entries(ALL_BUSBAR_DATA).map(([id, data]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																value: id,
																children: data.label
															}, id))
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-3 ml-2 bg-surface-1 px-2 py-1 rounded border border-border/50",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[10px] text-muted-foreground font-medium uppercase",
															children: ["R: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-foreground text-[11px] font-mono",
																children: ((unitSystem === "ip" ? ALL_BUSBAR_DATA[section.ratingId]?.r * .3048 : ALL_BUSBAR_DATA[section.ratingId]?.r) || 0).toFixed(4)
															})]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[10px] text-muted-foreground font-medium uppercase",
															children: ["X: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-foreground text-[11px] font-mono",
																children: ((unitSystem === "ip" ? ALL_BUSBAR_DATA[section.ratingId]?.x * .3048 : ALL_BUSBAR_DATA[section.ratingId]?.x) || 0).toFixed(4)
															})]
														})]
													})
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2 shrink-0",
												children: [
													section.totalCumulativeVd > 2.5 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-3 bg-destructive/10 border border-destructive/20 px-3 py-1.5 rounded-md mr-1",
														title: "Voltage drop exceeds the 2.5% standard limit!",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] font-bold uppercase tracking-wider text-destructive",
															children: "Cum V.Drop"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[15px] font-black font-mono text-destructive leading-none",
															children: [section.totalCumulativeVd.toFixed(3), "% ⚠"]
														})]
													}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-3 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-md mr-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] font-bold uppercase tracking-wider text-primary",
															children: "Cum V.Drop"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[15px] font-black font-mono text-primary leading-none",
															children: [section.totalCumulativeVd.toFixed(3), "%"]
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportExcelBtn, {
														columnMapping: {
															"From": "from",
															"Tap Off Points": "desc",
															"Description": "desc",
															"Busbar Reference": "ref",
															"Ref": "ref",
															"Length (m)": "length",
															"Length": "length",
															"SMDB Load (kW)": "loadKw",
															"Load (kW)": "loadKw",
															"Load": "loadKw",
															"Diversity Factor": "div",
															"DF": "div"
														},
														onImport: (rows) => handleImportExcelRows(panel.id, section.id, rows),
														className: "h-7 px-3 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-md transition-colors"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
														onClick: () => addRow(panel.id, section.id),
														primary: true,
														className: "h-7 px-3 text-xs",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3" }), " Tap Off"]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
														onClick: () => removeSection(panel.id, section.id),
														className: "h-7 px-3 text-xs",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3" }), " Remove"]
													})
												]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "overflow-auto max-h-[500px]",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
												className: "w-full text-[12px] border-collapse whitespace-nowrap",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
													className: "bg-header-bg sticky top-0 z-10 border-b border-border text-muted-foreground font-semibold",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
														className: "text-left",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "px-2 py-2 border-r border-border text-center w-8",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																	type: "checkbox",
																	className: "cursor-pointer",
																	checked: isAllSelected,
																	onChange: (e) => {
																		const newSet = new Set(selectedRows);
																		section.calcRows.forEach((r) => {
																			if (e.target.checked) newSet.add(r.id);
																			else newSet.delete(r.id);
																		});
																		setSelectedRows(newSet);
																	}
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "px-2 py-2 border-r border-border text-center w-10",
																children: "No."
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "px-2 py-2 border-r border-border w-32",
																children: "Description"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
																className: "px-2 py-2 border-r border-border w-20 text-center",
																children: [
																	"Len (",
																	unitSystem === "ip" ? "ft" : "m",
																	")"
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "px-2 py-2 border-r border-border w-20 text-center",
																children: "Load (kW)"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "px-2 py-2 border-r border-border w-20 text-center bg-surface-2 text-foreground",
																children: "TCL (kW)"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "px-2 py-2 border-r border-border w-16 text-center",
																children: "Div"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "px-2 py-2 border-r border-border w-20 text-center bg-surface-2 text-foreground",
																children: "MD (kW)"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "px-2 py-2 border-r border-border w-20 text-center bg-surface-2 text-foreground",
																children: "Cur. (A)"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "px-2 py-2 border-r border-border w-16 text-center text-primary",
																children: "Vd (V)"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "px-2 py-2 border-r border-border w-20 text-center text-primary",
																children: "Vd %"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
																className: "px-2 py-2 text-center w-10",
																children: "✕"
															})
														]
													})
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
													className: "divide-y divide-border",
													children: section.calcRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
														colSpan: 16,
														className: "text-center py-10 text-muted-foreground italic",
														children: [
															"No tap offs added to ",
															section.name,
															"."
														]
													}) }) : section.calcRows.map((r, idx) => {
														const handleKeyDown = (e, colIndex) => {
															const target = e.target;
															if ([
																"ArrowUp",
																"ArrowDown",
																"Enter"
															].includes(e.key)) {
																e.preventDefault();
																let nextRow = idx;
																if (e.key === "ArrowUp") nextRow--;
																if (e.key === "ArrowDown" || e.key === "Enter") nextRow++;
																const nextEl = document.querySelector(`[data-pan="${pIdx}"][data-sec="${sIdx}"][data-row="${nextRow}"][data-col="${colIndex}"]`);
																if (nextEl) {
																	nextEl.focus();
																	if (nextEl instanceof HTMLInputElement) nextEl.select();
																}
															} else if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
																let shouldMove = false;
																if (target.tagName === "SELECT" || target.value === "" || target.value === void 0) shouldMove = true;
																else {
																	if (e.key === "ArrowLeft" && target.selectionStart === 0) shouldMove = true;
																	if (e.key === "ArrowRight" && target.selectionEnd === target.value.length) shouldMove = true;
																}
																if (shouldMove) {
																	e.preventDefault();
																	let nextCol = colIndex;
																	if (e.key === "ArrowLeft") nextCol--;
																	if (e.key === "ArrowRight") nextCol++;
																	const nextEl = document.querySelector(`[data-pan="${pIdx}"][data-sec="${sIdx}"][data-row="${idx}"][data-col="${nextCol}"]`);
																	if (nextEl) {
																		nextEl.focus();
																		if (nextEl instanceof HTMLInputElement) nextEl.select();
																	}
																}
															}
														};
														return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
															className: `hover:bg-surface-2 transition-colors cursor-pointer ${selectedRows.has(r.id) ? "bg-primary/5" : ""}`,
															onClick: (e) => {
																if (e.target.tagName === "TD") toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
															},
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "p-0 border-r border-border text-center",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																		className: "flex items-center justify-center h-full w-full",
																		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																			type: "checkbox",
																			className: "cursor-pointer",
																			checked: selectedRows.has(r.id),
																			onChange: () => {},
																			onClick: (e) => {
																				e.stopPropagation();
																				toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
																			}
																		})
																	})
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "text-center text-muted-foreground font-medium border-r border-border",
																	children: idx + 1
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "p-0 border-r border-border",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																		"data-pan": pIdx,
																		"data-sec": sIdx,
																		"data-row": idx,
																		"data-col": 0,
																		onKeyDown: (e) => handleKeyDown(e, 0),
																		type: "text",
																		className: "w-full h-8 px-2 bg-transparent outline-none focus:bg-white",
																		value: r.desc,
																		onChange: (e) => updateRow(panel.id, section.id, r.id, "desc", e.target.value)
																	})
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "p-0 border-r border-border",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																		"data-pan": pIdx,
																		"data-sec": sIdx,
																		"data-row": idx,
																		"data-col": 1,
																		onKeyDown: (e) => handleKeyDown(e, 1),
																		type: "number",
																		step: "0.1",
																		className: "w-full h-8 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground",
																		value: r.length,
																		onChange: (e) => updateRow(panel.id, section.id, r.id, "length", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)
																	})
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "p-0 border-r border-border",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																		"data-pan": pIdx,
																		"data-sec": sIdx,
																		"data-row": idx,
																		"data-col": 2,
																		onKeyDown: (e) => handleKeyDown(e, 2),
																		type: "number",
																		step: "0.1",
																		className: "w-full h-8 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground",
																		value: r.loadKw,
																		onChange: (e) => updateRow(panel.id, section.id, r.id, "loadKw", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)
																	})
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1 text-center font-bold bg-surface-2 border-r border-border text-foreground",
																	children: r.tcl.toFixed(2)
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "p-0 border-r border-border",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																		"data-pan": pIdx,
																		"data-sec": sIdx,
																		"data-row": idx,
																		"data-col": 3,
																		onKeyDown: (e) => handleKeyDown(e, 3),
																		type: "number",
																		step: "0.01",
																		max: "1",
																		className: "w-full h-8 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground",
																		value: r.div,
																		onChange: (e) => updateRow(panel.id, section.id, r.id, "div", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)
																	})
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1 text-center font-semibold bg-surface-2 border-r border-border font-mono text-foreground",
																	children: r.md.toFixed(2)
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1 text-center font-semibold bg-surface-2 border-r border-border font-mono text-foreground",
																	children: r.current.toFixed(2)
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "px-2 py-1 text-center text-primary font-medium border-r border-border font-mono",
																	children: r.vd.toFixed(2)
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																	className: `px-2 py-1 text-center border-r border-border font-mono font-medium ${r.vdPercent > 2.5 ? "text-destructive bg-destructive/5" : "text-primary"}`,
																	children: [r.vdPercent.toFixed(3), "%"]
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "text-center p-0",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																		onClick: () => removeRow(panel.id, section.id, r.id),
																		className: "text-destructive/70 hover:text-destructive w-full h-8 flex items-center justify-center transition-colors",
																		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
																	})
																})
															]
														}, r.id);
													})
												})]
											})
										})]
									}, section.id);
								})
							})]
						}, panel.id);
					})
				})]
			})]
		})
	});
}
//#endregion
export { BusbarCalculationPage as component };
