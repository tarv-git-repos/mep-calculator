import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { N as Plus, k as RefreshCw, m as Trash2, xt as Copy } from "../_libs/lucide-react.mjs";
import { t as Button } from "./use-confirm-BT3fngjN.mjs";
import { r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { a as ContextMenuSeparator, i as ContextMenuItem, r as ContextMenuContent, t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { t as DataGrid } from "./DataGrid-Ct9FtLBj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/conductor-sizing-D_z1cqsh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CABLE_DATABASE = [
	{
		size: 1.5,
		ampacityCuPVC_1Ph: 19.5,
		ampacityCuPVC_3Ph: 17.5,
		ampacityCuXLPE_1Ph: 24,
		ampacityCuXLPE_3Ph: 22,
		ampacityAlPVC_1Ph: 0,
		ampacityAlPVC_3Ph: 0,
		ampacityAlXLPE_1Ph: 0,
		ampacityAlXLPE_3Ph: 0,
		rCuPVC: 14.8,
		rCuXLPE: 15.4,
		rAlPVC: 24.4,
		rAlXLPE: 25.3,
		x: .09
	},
	{
		size: 2.5,
		ampacityCuPVC_1Ph: 27,
		ampacityCuPVC_3Ph: 24,
		ampacityCuXLPE_1Ph: 33,
		ampacityCuXLPE_3Ph: 30,
		ampacityAlPVC_1Ph: 0,
		ampacityAlPVC_3Ph: 0,
		ampacityAlXLPE_1Ph: 0,
		ampacityAlXLPE_3Ph: 0,
		rCuPVC: 8.87,
		rCuXLPE: 9.24,
		rAlPVC: 14.6,
		rAlXLPE: 15.1,
		x: .09
	},
	{
		size: 4,
		ampacityCuPVC_1Ph: 36,
		ampacityCuPVC_3Ph: 32,
		ampacityCuXLPE_1Ph: 45,
		ampacityCuXLPE_3Ph: 40,
		ampacityAlPVC_1Ph: 0,
		ampacityAlPVC_3Ph: 0,
		ampacityAlXLPE_1Ph: 0,
		ampacityAlXLPE_3Ph: 0,
		rCuPVC: 5.54,
		rCuXLPE: 5.77,
		rAlPVC: 9.15,
		rAlXLPE: 9.5,
		x: .085
	},
	{
		size: 6,
		ampacityCuPVC_1Ph: 46,
		ampacityCuPVC_3Ph: 41,
		ampacityCuXLPE_1Ph: 58,
		ampacityCuXLPE_3Ph: 52,
		ampacityAlPVC_1Ph: 0,
		ampacityAlPVC_3Ph: 0,
		ampacityAlXLPE_1Ph: 0,
		ampacityAlXLPE_3Ph: 0,
		rCuPVC: 3.69,
		rCuXLPE: 3.84,
		rAlPVC: 6.09,
		rAlXLPE: 6.32,
		x: .082
	},
	{
		size: 10,
		ampacityCuPVC_1Ph: 63,
		ampacityCuPVC_3Ph: 57,
		ampacityCuXLPE_1Ph: 80,
		ampacityCuXLPE_3Ph: 71,
		ampacityAlPVC_1Ph: 0,
		ampacityAlPVC_3Ph: 0,
		ampacityAlXLPE_1Ph: 0,
		ampacityAlXLPE_3Ph: 0,
		rCuPVC: 2.19,
		rCuXLPE: 2.28,
		rAlPVC: 3.61,
		rAlXLPE: 3.75,
		x: .078
	},
	{
		size: 16,
		ampacityCuPVC_1Ph: 85,
		ampacityCuPVC_3Ph: 76,
		ampacityCuXLPE_1Ph: 107,
		ampacityCuXLPE_3Ph: 96,
		ampacityAlPVC_1Ph: 66,
		ampacityAlPVC_3Ph: 59,
		ampacityAlXLPE_1Ph: 83,
		ampacityAlXLPE_3Ph: 74,
		rCuPVC: 1.38,
		rCuXLPE: 1.44,
		rAlPVC: 2.27,
		rAlXLPE: 2.36,
		x: .077
	},
	{
		size: 25,
		ampacityCuPVC_1Ph: 112,
		ampacityCuPVC_3Ph: 101,
		ampacityCuXLPE_1Ph: 138,
		ampacityCuXLPE_3Ph: 127,
		ampacityAlPVC_1Ph: 87,
		ampacityAlPVC_3Ph: 78,
		ampacityAlXLPE_1Ph: 107,
		ampacityAlXLPE_3Ph: 98,
		rCuPVC: .884,
		rCuXLPE: .927,
		rAlPVC: 1.46,
		rAlXLPE: 1.52,
		x: .076
	},
	{
		size: 35,
		ampacityCuPVC_1Ph: 138,
		ampacityCuPVC_3Ph: 125,
		ampacityCuXLPE_1Ph: 171,
		ampacityCuXLPE_3Ph: 155,
		ampacityAlPVC_1Ph: 108,
		ampacityAlPVC_3Ph: 97,
		ampacityAlXLPE_1Ph: 133,
		ampacityAlXLPE_3Ph: 120,
		rCuPVC: .638,
		rCuXLPE: .669,
		rAlPVC: 1.05,
		rAlXLPE: 1.09,
		x: .075
	},
	{
		size: 50,
		ampacityCuPVC_1Ph: 169,
		ampacityCuPVC_3Ph: 151,
		ampacityCuXLPE_1Ph: 209,
		ampacityCuXLPE_3Ph: 190,
		ampacityAlPVC_1Ph: 131,
		ampacityAlPVC_3Ph: 117,
		ampacityAlXLPE_1Ph: 162,
		ampacityAlXLPE_3Ph: 147,
		rCuPVC: .471,
		rCuXLPE: .494,
		rAlPVC: .778,
		rAlXLPE: .81,
		x: .074
	},
	{
		size: 70,
		ampacityCuPVC_1Ph: 213,
		ampacityCuPVC_3Ph: 192,
		ampacityCuXLPE_1Ph: 269,
		ampacityCuXLPE_3Ph: 240,
		ampacityAlPVC_1Ph: 166,
		ampacityAlPVC_3Ph: 149,
		ampacityAlXLPE_1Ph: 209,
		ampacityAlXLPE_3Ph: 189,
		rCuPVC: .328,
		rCuXLPE: .343,
		rAlPVC: .541,
		rAlXLPE: .563,
		x: .074
	},
	{
		size: 95,
		ampacityCuPVC_1Ph: 258,
		ampacityCuPVC_3Ph: 232,
		ampacityCuXLPE_1Ph: 326,
		ampacityCuXLPE_3Ph: 292,
		ampacityAlPVC_1Ph: 202,
		ampacityAlPVC_3Ph: 180,
		ampacityAlXLPE_1Ph: 253,
		ampacityAlXLPE_3Ph: 229,
		rCuPVC: .235,
		rCuXLPE: .246,
		rAlPVC: .388,
		rAlXLPE: .404,
		x: .073
	},
	{
		size: 120,
		ampacityCuPVC_1Ph: 299,
		ampacityCuPVC_3Ph: 269,
		ampacityCuXLPE_1Ph: 379,
		ampacityCuXLPE_3Ph: 340,
		ampacityAlPVC_1Ph: 235,
		ampacityAlPVC_3Ph: 209,
		ampacityAlXLPE_1Ph: 294,
		ampacityAlXLPE_3Ph: 267,
		rCuPVC: .186,
		rCuXLPE: .195,
		rAlPVC: .307,
		rAlXLPE: .32,
		x: .073
	},
	{
		size: 150,
		ampacityCuPVC_1Ph: 344,
		ampacityCuPVC_3Ph: 309,
		ampacityCuXLPE_1Ph: 436,
		ampacityCuXLPE_3Ph: 391,
		ampacityAlPVC_1Ph: 270,
		ampacityAlPVC_3Ph: 240,
		ampacityAlXLPE_1Ph: 338,
		ampacityAlXLPE_3Ph: 307,
		rCuPVC: .151,
		rCuXLPE: .158,
		rAlPVC: .25,
		rAlXLPE: .26,
		x: .073
	},
	{
		size: 185,
		ampacityCuPVC_1Ph: 392,
		ampacityCuPVC_3Ph: 353,
		ampacityCuXLPE_1Ph: 500,
		ampacityCuXLPE_3Ph: 448,
		ampacityAlPVC_1Ph: 309,
		ampacityAlPVC_3Ph: 275,
		ampacityAlXLPE_1Ph: 388,
		ampacityAlXLPE_3Ph: 352,
		rCuPVC: .122,
		rCuXLPE: .128,
		rAlPVC: .201,
		rAlXLPE: .21,
		x: .073
	},
	{
		size: 240,
		ampacityCuPVC_1Ph: 461,
		ampacityCuPVC_3Ph: 415,
		ampacityCuXLPE_1Ph: 590,
		ampacityCuXLPE_3Ph: 528,
		ampacityAlPVC_1Ph: 364,
		ampacityAlPVC_3Ph: 324,
		ampacityAlXLPE_1Ph: 457,
		ampacityAlXLPE_3Ph: 415,
		rCuPVC: .095,
		rCuXLPE: .099,
		rAlPVC: .157,
		rAlXLPE: .163,
		x: .072
	},
	{
		size: 300,
		ampacityCuPVC_1Ph: 530,
		ampacityCuPVC_3Ph: 477,
		ampacityCuXLPE_1Ph: 678,
		ampacityCuXLPE_3Ph: 608,
		ampacityAlPVC_1Ph: 419,
		ampacityAlPVC_3Ph: 373,
		ampacityAlXLPE_1Ph: 526,
		ampacityAlXLPE_3Ph: 478,
		rCuPVC: .077,
		rCuXLPE: .081,
		rAlPVC: .128,
		rAlXLPE: .133,
		x: .072
	},
	{
		size: 400,
		ampacityCuPVC_1Ph: 625,
		ampacityCuPVC_3Ph: 563,
		ampacityCuXLPE_1Ph: 800,
		ampacityCuXLPE_3Ph: 718,
		ampacityAlPVC_1Ph: 494,
		ampacityAlPVC_3Ph: 441,
		ampacityAlXLPE_1Ph: 621,
		ampacityAlXLPE_3Ph: 564,
		rCuPVC: .061,
		rCuXLPE: .064,
		rAlPVC: .101,
		rAlXLPE: .105,
		x: .072
	},
	{
		size: 500,
		ampacityCuPVC_1Ph: 720,
		ampacityCuPVC_3Ph: 648,
		ampacityCuXLPE_1Ph: 922,
		ampacityCuXLPE_3Ph: 827,
		ampacityAlPVC_1Ph: 570,
		ampacityAlPVC_3Ph: 508,
		ampacityAlXLPE_1Ph: 716,
		ampacityAlXLPE_3Ph: 651,
		rCuPVC: .05,
		rCuXLPE: .052,
		rAlPVC: .083,
		rAlXLPE: .086,
		x: .072
	},
	{
		size: 630,
		ampacityCuPVC_1Ph: 830,
		ampacityCuPVC_3Ph: 747,
		ampacityCuXLPE_1Ph: 1060,
		ampacityCuXLPE_3Ph: 952,
		ampacityAlPVC_1Ph: 657,
		ampacityAlPVC_3Ph: 586,
		ampacityAlXLPE_1Ph: 826,
		ampacityAlXLPE_3Ph: 751,
		rCuPVC: .041,
		rCuXLPE: .043,
		rAlPVC: .068,
		rAlXLPE: .071,
		x: .072
	}
];
function InlineInput({ value, onCommit, className = "", type = "text", step, min, onFocus }) {
	const [localVal, setLocalVal] = (0, import_react.useState)(String(value));
	(0, import_react.useEffect)(() => {
		const strVal = String(value);
		if (localVal !== strVal) {
			const parsedLocal = parseFloat(localVal);
			const parsedValue = parseFloat(strVal);
			if (localVal.endsWith(".") && parsedLocal === parsedValue) return;
			if (localVal === "" && parsedValue === 0) return;
			if (localVal === "-" && parsedValue === 0) return;
			setLocalVal(strVal);
		}
	}, [value, localVal]);
	const handleChange = (e) => {
		setLocalVal(e.target.value);
		onCommit(e.target.value);
	};
	const handleKeyDown = (e) => {
		if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		step,
		min,
		value: localVal,
		onChange: handleChange,
		onFocus,
		onKeyDown: handleKeyDown,
		onClick: (e) => e.stopPropagation(),
		onDoubleClick: (e) => e.stopPropagation(),
		className: `bg-transparent w-full border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-foreground transition-colors cursor-text ${className}`
	});
}
function ConductorSizingPage() {
	const { userData, profile } = useAuth();
	userData?.name || profile?.name;
	const [globalDerating, setGlobalDerating] = (0, import_react.useState)(.85);
	const [globalVdLimit, setGlobalVdLimit] = (0, import_react.useState)(3);
	const [globalPf, setGlobalPf] = (0, import_react.useState)(.85);
	const [activeRowId, setActiveRowId] = (0, import_react.useState)();
	const [rows, setRows] = (0, import_react.useState)([]);
	const [selected, setSelected] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [history, setHistory] = (0, import_react.useState)([]);
	const pushToHistory = (newRows) => {
		setHistory([...history, newRows]);
	};
	const calculatedRows = (0, import_react.useMemo)(() => {
		return rows.map((r, index) => {
			const srNo = index + 1;
			const loadKw = r.connectedLoad === "" ? 0 : Number(r.connectedLoad);
			const v = r.voltage === "" ? 0 : Number(r.voltage);
			const runs = r.parallelRuns === "" || Number(r.parallelRuns) <= 0 ? 1 : Number(r.parallelRuns);
			const length = r.length === "" ? 0 : Number(r.length);
			let designCurrent = 0;
			if (loadKw > 0 && v > 0 && r.phase !== "") {
				if (r.phase === "Single Phase") designCurrent = loadKw * 1e3 / (v * globalPf);
				else if (r.phase === "Three Phase") designCurrent = loadKw * 1e3 / (Math.sqrt(3) * v * globalPf);
			}
			let minCableSize = 0;
			let baseAmpacity = 0;
			let deratedAmpacity = 0;
			let vdV = 0;
			let vdPercent = 0;
			let utilization = 0;
			let status = "Pass";
			let notes = "";
			if (designCurrent > 0 && r.material !== "" && r.type !== "" && r.phase !== "") {
				let found = false;
				for (const spec of CABLE_DATABASE) {
					if (r.material === "Aluminium" && spec.size < 16) continue;
					let baseAmp = 0;
					if (r.material === "Copper") if (r.type === "PVC") baseAmp = r.phase === "Single Phase" ? spec.ampacityCuPVC_1Ph : spec.ampacityCuPVC_3Ph;
					else baseAmp = r.phase === "Single Phase" ? spec.ampacityCuXLPE_1Ph : spec.ampacityCuXLPE_3Ph;
					else if (r.type === "PVC") baseAmp = r.phase === "Single Phase" ? spec.ampacityAlPVC_1Ph : spec.ampacityAlPVC_3Ph;
					else baseAmp = r.phase === "Single Phase" ? spec.ampacityAlXLPE_1Ph : spec.ampacityAlXLPE_3Ph;
					const deratedAmp = baseAmp * globalDerating * runs;
					if (deratedAmp >= designCurrent) {
						const rVal = r.material === "Copper" ? r.type === "PVC" ? spec.rCuPVC : spec.rCuXLPE : r.type === "PVC" ? spec.rAlPVC : spec.rAlXLPE;
						const xVal = spec.x;
						const cosPhi = globalPf;
						const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
						let calculatedVd = 0;
						const currentPerRun = designCurrent / runs;
						if (r.phase === "Single Phase") calculatedVd = 2 * currentPerRun * length * (rVal * cosPhi + xVal * sinPhi) / 1e3;
						else calculatedVd = Math.sqrt(3) * currentPerRun * length * (rVal * cosPhi + xVal * sinPhi) / 1e3;
						const calculatedVdPercent = v > 0 ? calculatedVd / v * 100 : 0;
						if (calculatedVdPercent <= globalVdLimit) {
							minCableSize = spec.size;
							baseAmpacity = baseAmp;
							deratedAmpacity = deratedAmp;
							vdV = calculatedVd;
							vdPercent = calculatedVdPercent;
							utilization = designCurrent / deratedAmp * 100;
							found = true;
							break;
						}
					}
				}
				if (!found) {
					status = "Fail";
					notes = "No standard cable size satisfies both voltage drop and derated ampacity criteria.";
				} else if (utilization > 95) {
					status = "Warning";
					notes = "Cable utilization is very high (> 95%). Consider upgrading to a larger size.";
				}
			} else {
				status = "Error";
				notes = "Missing Connected Load or Voltage parameters.";
			}
			return {
				...r,
				srNo,
				designCurrent: Number(designCurrent.toFixed(2)),
				minCableSize,
				baseAmpacity: Number(baseAmpacity.toFixed(1)),
				deratedAmpacity: Number(deratedAmpacity.toFixed(1)),
				vdV: Number(vdV.toFixed(2)),
				vdPercent: Number(vdPercent.toFixed(2)),
				utilization: Number(utilization.toFixed(1)),
				status,
				notes
			};
		});
	}, [
		rows,
		globalDerating,
		globalVdLimit,
		globalPf
	]);
	const totalConnectedKw = (0, import_react.useMemo)(() => rows.reduce((acc, row) => acc + (row.connectedLoad === "" ? 0 : Number(row.connectedLoad)), 0), [rows]);
	const maxDesignCurrent = (0, import_react.useMemo)(() => calculatedRows.reduce((max, row) => Math.max(max, row.designCurrent), 0), [calculatedRows]);
	(0, import_react.useMemo)(() => calculatedRows.reduce((max, row) => Math.max(max, row.vdPercent), 0), [calculatedRows]);
	(0, import_react.useMemo)(() => calculatedRows.reduce((max, row) => Math.max(max, row.utilization), 0), [calculatedRows]);
	const largestCableSize = (0, import_react.useMemo)(() => calculatedRows.reduce((max, row) => Math.max(max, row.minCableSize), 0), [calculatedRows]);
	const activeCalculatedRow = (0, import_react.useMemo)(() => activeRowId ? calculatedRows.find((cr) => cr.id === activeRowId) || null : null, [calculatedRows, activeRowId]);
	const handleAddRow = () => {
		const newRow = {
			id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
			description: "",
			connectedLoad: "",
			voltage: "",
			phase: "",
			length: "",
			material: "",
			type: "",
			parallelRuns: "",
			remarks: ""
		};
		setRows([...rows, newRow]);
		setActiveRowId(newRow.id);
	};
	const clearSelection = () => setSelected(/* @__PURE__ */ new Set());
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Delete" || e.key === "Backspace") {
				if (selected.size === 0) return;
				if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT") return;
				setRows((prev) => prev.filter((r) => !selected.has(r.id)));
				clearSelection();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selected]);
	const handleUpdateRow = (id, field, val) => {
		pushToHistory(rows);
		if (selected.size > 1 && selected.has(id)) setRows(rows.map((r) => {
			if (selected.has(r.id)) {
				const updated = {
					...r,
					[field]: val
				};
				if (field === "phase") updated.voltage = val === "Single Phase" ? 230 : 400;
				return updated;
			}
			return r;
		}));
		else setRows(rows.map((r) => {
			if (r.id === id) {
				const updated = {
					...r,
					[field]: val
				};
				if (field === "phase") updated.voltage = val === "Single Phase" ? 230 : 400;
				return updated;
			}
			return r;
		}));
	};
	const handleReset = async () => {
		if (window.confirm("Are you sure you want to reset all calculations?")) {
			setRows([]);
			setGlobalDerating(.85);
			setGlobalVdLimit(3);
			setGlobalPf(.85);
			clearSelection();
			setActiveRowId(void 0);
		}
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
	const columns = [
		{
			key: "srNo",
			header: "Sr. No.",
			width: 50,
			align: "center",
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-center font-mono text-[11px]",
				children: row.srNo
			})
		},
		{
			key: "description",
			header: "Description",
			width: 170,
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				value: row.description,
				onCommit: (val) => handleUpdateRow(row.id, "description", val),
				onFocus: () => {
					if (!selected.has(row.id)) {
						clearSelection();
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				},
				className: "text-[11px] font-medium"
			})
		},
		{
			key: "connectedLoad",
			header: "Load (kW)",
			width: 95,
			align: "center",
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: row.connectedLoad,
				onCommit: (val) => handleUpdateRow(row.id, "connectedLoad", val === "" ? "" : Number(val)),
				onFocus: () => {
					if (!selected.has(row.id)) {
						clearSelection();
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				},
				className: "text-[11px] text-center font-bold font-mono"
			})
		},
		{
			key: "voltage",
			header: "Voltage (V)",
			width: 90,
			align: "center",
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: row.voltage,
				onCommit: (val) => handleUpdateRow(row.id, "voltage", val === "" ? "" : Number(val)),
				onFocus: () => {
					if (!selected.has(row.id)) {
						clearSelection();
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				},
				className: "text-[11px] text-center font-medium font-mono"
			})
		},
		{
			key: "phase",
			header: "Phase",
			width: 125,
			align: "center",
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				value: row.phase,
				onChange: (e) => handleUpdateRow(row.id, "phase", e.target.value),
				onClick: (e) => e.stopPropagation(),
				onFocus: () => {
					if (!selected.has(row.id)) {
						clearSelection();
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				},
				className: "w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded pl-2 pr-4.5 py-0.5 text-[11px] font-semibold cursor-pointer text-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "",
						disabled: true,
						hidden: true,
						children: "Phase"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "Single Phase",
						children: "Single Phase"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "Three Phase",
						children: "Three Phase"
					})
				]
			})
		},
		{
			key: "length",
			header: "Length (m)",
			width: 90,
			align: "center",
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				value: row.length,
				onCommit: (val) => handleUpdateRow(row.id, "length", val === "" ? "" : Number(val)),
				onFocus: () => {
					if (!selected.has(row.id)) {
						clearSelection();
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				},
				className: "text-[11px] text-center font-medium font-mono"
			})
		},
		{
			key: "material",
			header: "Material",
			width: 110,
			align: "center",
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				value: row.material,
				onChange: (e) => handleUpdateRow(row.id, "material", e.target.value),
				onClick: (e) => e.stopPropagation(),
				onFocus: () => {
					if (!selected.has(row.id)) {
						clearSelection();
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				},
				className: "w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded pl-2 pr-4.5 py-0.5 text-[11px] font-medium cursor-pointer text-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "",
						disabled: true,
						hidden: true,
						children: "Material"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "Copper",
						children: "Copper"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "Aluminium",
						children: "Aluminium"
					})
				]
			})
		},
		{
			key: "type",
			header: "Cable Type",
			width: 110,
			align: "center",
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				value: row.type,
				onChange: (e) => handleUpdateRow(row.id, "type", e.target.value),
				onClick: (e) => e.stopPropagation(),
				onFocus: () => {
					if (!selected.has(row.id)) {
						clearSelection();
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				},
				className: "w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded pl-2 pr-4.5 py-0.5 text-[11px] font-medium cursor-pointer text-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "",
						disabled: true,
						hidden: true,
						children: "Type"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "XLPE",
						children: "XLPE"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "PVC",
						children: "PVC"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "LSZH",
						children: "LSZH"
					})
				]
			})
		},
		{
			key: "parallelRuns",
			header: "Runs",
			width: 70,
			align: "center",
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				type: "number",
				min: 1,
				value: row.parallelRuns,
				onCommit: (val) => handleUpdateRow(row.id, "parallelRuns", val === "" ? "" : Math.max(1, Number(val))),
				onFocus: () => {
					if (!selected.has(row.id)) {
						clearSelection();
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				},
				className: "text-[11px] text-center font-medium font-mono"
			})
		},
		{
			key: "designCurrent",
			header: "Current (A)",
			width: 105,
			align: "center",
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-center font-mono text-[11px] font-bold text-primary",
				children: row.designCurrent
			})
		},
		{
			key: "minCableSize",
			header: "Sized Cable",
			width: 115,
			align: "center",
			render: (row) => {
				if (row.connectedLoad === "" || row.voltage === "") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-center text-muted-foreground/60 text-[11px] font-mono",
					children: "-"
				});
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `text-center font-bold text-[11px] ${row.minCableSize > 0 ? "text-emerald-600 dark:text-emerald-400 font-mono" : "text-red-500 font-sans"}`,
					children: row.minCableSize > 0 ? `${row.minCableSize} mm²` : "Size Out of Range"
				});
			}
		},
		{
			key: "remarks",
			header: "Remarks",
			width: 130,
			render: (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineInput, {
				value: row.remarks,
				onCommit: (val) => handleUpdateRow(row.id, "remarks", val),
				onFocus: () => {
					if (!selected.has(row.id)) {
						clearSelection();
						setSelected(/* @__PURE__ */ new Set([row.id]));
						setActiveRowId(row.id);
					}
				},
				className: "text-[11px] font-medium"
			})
		}
	];
	const renderRowContextMenu = (row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuContent, {
		className: "w-48 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
				onClick: () => {
					const duplicated = {
						...row,
						id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
						description: `${row.description} (Copy)`
					};
					setRows([...rows, duplicated]);
					setActiveRowId(duplicated.id);
				},
				className: "flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" }), " Duplicate Row"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, { className: "my-1 border-t border-border" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
				onClick: () => {
					if (window.confirm("Are you sure you want to delete this row?")) {
						setRows(rows.filter((r) => r.id !== row.id));
						if (activeRowId === row.id) setActiveRowId(void 0);
					}
				},
				className: "flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-red-500 font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), " Delete Row"]
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Conductor (Cable) Sizing",
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
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
								children: [
									"ELECTRICAL ",
									">",
									" CONDUCTOR (CABLE) Sizing"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center gap-3 mt-0.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-baseline gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
										className: "text-[28px] font-bold tracking-tight text-foreground",
										children: "Conductor (Cable) Sizing"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[15px] font-semibold text-muted-foreground",
										children: [rows.length, " segments"]
									})]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground mt-0.5",
								children: "Calculate conductor (cable) sizing automatically complying with IEC standards."
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex-1 flex flex-col gap-6 min-h-[450px] mb-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/80",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-6 text-xs font-semibold",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted-foreground uppercase tracking-wider text-[10.5px]",
											children: "Derating Factor:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "0.05",
											value: globalDerating,
											onChange: (e) => setGlobalDerating(Number(e.target.value)),
											className: "w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted-foreground uppercase tracking-wider text-[10.5px]",
											children: "VD Limit (%):"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "0.5",
											value: globalVdLimit,
											onChange: (e) => setGlobalVdLimit(Number(e.target.value)),
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
											value: globalPf,
											onChange: (e) => setGlobalPf(Number(e.target.value)),
											className: "w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none"
										})]
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "outline",
									size: "sm",
									onClick: handleReset,
									className: "h-8 text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3.5 mr-1.5" }), " Reset"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									onClick: handleAddRow,
									className: "h-8 text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5 mr-1.5" }), " Add Row"]
								})]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col xl:flex-row flex-1 min-h-0 overflow-y-auto xl:overflow-hidden",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex-grow min-w-0 flex flex-col bg-transparent relative",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex-grow flex flex-col relative min-h-[350px]",
									children: rows.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataGrid, {
										rows: calculatedRows,
										columns,
										selected,
										onToggle: handleToggle,
										onToggleAll: handleToggleAll,
										renderContextMenu: renderRowContextMenu
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex-grow flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-2xl bg-slate-50/20 dark:bg-slate-900/10 m-4 min-h-[350px]",
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
												children: "Add a conductor row or import data to start calculating."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												onClick: handleAddRow,
												className: "h-8 text-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5 mr-1.5" }), " Add First Row"]
											})
										]
									})
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col w-full xl:w-[320px] shrink-0 border-t xl:border-t-0 xl:border-l border-border bg-slate-50/30 dark:bg-slate-900/20 overflow-y-auto p-4 gap-4",
								children: [activeCalculatedRow && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-background border border-border rounded-xl shadow-sm p-4 shrink-0 transition-all duration-300",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
										className: "text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 border-b border-border pb-2 flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Active Conductor Sizing" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-mono text-[10px] text-muted-foreground/80",
											children: ["#", activeCalculatedRow.srNo]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-4 text-[13px]",
										children: [
											activeCalculatedRow.minCableSize > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col border border-emerald-500/30 rounded-xl bg-emerald-500/10 p-3 shadow-sm transition-all",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400",
														children: "Recommended Cable Size"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-[24px] font-black text-emerald-600 dark:text-emerald-500 mt-1 font-mono tracking-tight",
														children: [activeCalculatedRow.minCableSize, " mm²"]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-medium mt-0.5",
														children: [
															activeCalculatedRow.material || "-",
															" / ",
															activeCalculatedRow.type || "-",
															" Insulation"
														]
													})
												]
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col border border-red-500/30 rounded-xl bg-red-500/10 p-3 shadow-sm transition-all",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400",
														children: "Recommended Cable Size"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[20px] font-black text-red-600 dark:text-red-500 mt-1 font-sans",
														children: "Size Out of Range"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] text-red-700/80 dark:text-red-400/80 font-medium mt-0.5",
														children: "Criteria not met"
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-2 gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "bg-background border border-border rounded-xl p-3 flex flex-col shadow-sm",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider",
														children: "Design Current"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-[14px] font-bold font-mono text-foreground mt-1",
														children: [activeCalculatedRow.designCurrent, " A"]
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "bg-background border border-border rounded-xl p-3 flex flex-col shadow-sm",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider",
														children: "Capacity (Iz)"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-[14px] font-bold font-mono text-foreground mt-1",
														children: [activeCalculatedRow.deratedAmpacity, " A"]
													})]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-background border border-border rounded-xl p-3 flex flex-col shadow-sm gap-1.5",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex justify-between items-center",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider",
															children: "Voltage Drop"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "font-mono text-xs font-bold text-foreground",
															children: [activeCalculatedRow.vdPercent.toFixed(2), "%"]
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: `h-full rounded-full transition-all duration-500 ${activeCalculatedRow.vdPercent > globalVdLimit ? "bg-red-500" : activeCalculatedRow.vdPercent > globalVdLimit * .8 ? "bg-amber-500" : "bg-emerald-500"}`,
															style: { width: `${Math.min(100, activeCalculatedRow.vdPercent / (globalVdLimit || 3) * 100)}%` }
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-[9px] text-muted-foreground",
														children: [
															"Limit: ",
															globalVdLimit,
															"%"
														]
													})
												]
											})
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-background border border-border rounded-xl shadow-sm p-4 shrink-0 transition-all duration-300",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 border-b border-border pb-2",
										children: "Project Sizing Summary"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-4 text-[13px]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col border border-indigo-500/30 rounded-xl bg-indigo-500/10 p-3 shadow-sm",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400",
												children: "Largest Conductor Size"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[24px] font-black text-indigo-600 dark:text-indigo-500 mt-1 font-mono tracking-tight",
												children: largestCableSize ? `${largestCableSize} mm²` : "-"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-2 gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-background border border-border rounded-xl p-3 flex flex-col shadow-sm",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider",
													children: "Connected Load"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "text-[14px] font-bold font-mono text-foreground mt-1",
													children: [totalConnectedKw.toFixed(1), " kW"]
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-background border border-border rounded-xl p-3 flex flex-col shadow-sm",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider",
													children: "Max Current"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "text-[14px] font-bold font-mono text-foreground mt-1",
													children: [maxDesignCurrent.toFixed(1), " A"]
												})]
											})]
										})]
									})]
								})]
							})]
						})]
					})
				})]
			})
		})
	});
}
//#endregion
export { ConductorSizingPage as component };
