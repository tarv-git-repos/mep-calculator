import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Dt as ChevronRight, E as Save, Ot as ChevronDown } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
import { n as IP_FIXTURE_UNITS } from "./plumbing-fixture-unit-DcPVxtoe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-pump-sizing-DUdQxJgE.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
require_excel();
import_FileSaver_min.default.saveAs;
var ipcTable = [
	{
		wsfu: 0,
		gpm: 0
	},
	{
		wsfu: 1,
		gpm: 3
	},
	{
		wsfu: 2,
		gpm: 5
	},
	{
		wsfu: 3,
		gpm: 6.5
	},
	{
		wsfu: 5,
		gpm: 9.4
	},
	{
		wsfu: 10,
		gpm: 14.6
	},
	{
		wsfu: 15,
		gpm: 17.5
	},
	{
		wsfu: 20,
		gpm: 19.6
	},
	{
		wsfu: 25,
		gpm: 21.5
	},
	{
		wsfu: 30,
		gpm: 23.3
	},
	{
		wsfu: 40,
		gpm: 26.3
	},
	{
		wsfu: 50,
		gpm: 29.1
	},
	{
		wsfu: 60,
		gpm: 32
	},
	{
		wsfu: 70,
		gpm: 35
	},
	{
		wsfu: 80,
		gpm: 38
	},
	{
		wsfu: 90,
		gpm: 41
	},
	{
		wsfu: 100,
		gpm: 43.5
	},
	{
		wsfu: 120,
		gpm: 48
	},
	{
		wsfu: 140,
		gpm: 52.5
	},
	{
		wsfu: 160,
		gpm: 57
	},
	{
		wsfu: 180,
		gpm: 61
	},
	{
		wsfu: 200,
		gpm: 65
	},
	{
		wsfu: 225,
		gpm: 70
	},
	{
		wsfu: 250,
		gpm: 75
	},
	{
		wsfu: 275,
		gpm: 80
	},
	{
		wsfu: 300,
		gpm: 85
	},
	{
		wsfu: 400,
		gpm: 105
	},
	{
		wsfu: 500,
		gpm: 124
	},
	{
		wsfu: 750,
		gpm: 170
	},
	{
		wsfu: 1e3,
		gpm: 208
	},
	{
		wsfu: 1250,
		gpm: 239
	},
	{
		wsfu: 1500,
		gpm: 269
	},
	{
		wsfu: 1750,
		gpm: 297
	},
	{
		wsfu: 2e3,
		gpm: 325
	},
	{
		wsfu: 2500,
		gpm: 380
	},
	{
		wsfu: 3e3,
		gpm: 433
	},
	{
		wsfu: 4e3,
		gpm: 525
	},
	{
		wsfu: 5e3,
		gpm: 593
	}
];
function wsfuToGPM(wsfu) {
	const clamped = Math.max(0, Math.min(wsfu, 5e3));
	const exact = ipcTable.find((row) => row.wsfu === clamped);
	if (exact) return exact.gpm;
	for (let i = 0; i < ipcTable.length - 1; i++) {
		const lower = ipcTable[i];
		const upper = ipcTable[i + 1];
		if (clamped > lower.wsfu && clamped < upper.wsfu) {
			const ratio = (clamped - lower.wsfu) / (upper.wsfu - lower.wsfu);
			return lower.gpm + ratio * (upper.gpm - lower.gpm);
		}
	}
	return 0;
}
function wsfuToLPS(wsfu) {
	return wsfuToGPM(wsfu) * .06309;
}
function PumpSizingPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const scrollContainerRef = import_react.useRef(null);
	const [pumpType, setPumpType] = (0, import_react.useState)("booster");
	const [wsfuVal, setWsfuVal] = (0, import_react.useState)("21.6");
	const [manualFlow, setManualFlow] = (0, import_react.useState)("1.3");
	const [reqVolume, setReqVolume] = (0, import_react.useState)("5000");
	const [fillTime, setFillTime] = (0, import_react.useState)("2");
	const [workingPumps, setWorkingPumps] = (0, import_react.useState)("1");
	const [standbyPumps, setStandbyPumps] = (0, import_react.useState)("-");
	const [fricFactor, setFricFactor] = (0, import_react.useState)("0.4");
	const [pipeVert, setPipeVert] = (0, import_react.useState)("20");
	const [pipeHoriz, setPipeHoriz] = (0, import_react.useState)("50");
	const [filtCarbon, setFiltCarbon] = (0, import_react.useState)(false);
	const [filtMM, setFiltMM] = (0, import_react.useState)(false);
	const [filtCuAg, setFiltCuAg] = (0, import_react.useState)(false);
	const [filtSoftener, setFiltSoftener] = (0, import_react.useState)(false);
	const [staticHead, setStaticHead] = (0, import_react.useState)("5.0");
	const [presidHead, setPresidHead] = (0, import_react.useState)("1.0");
	const [suctionHead, setSuctionHead] = (0, import_react.useState)("0");
	const [sfHead, setSfHead] = (0, import_react.useState)("5");
	const [selectedHead, setSelectedHead] = (0, import_react.useState)("");
	const [effMotor, setEffMotor] = (0, import_react.useState)("85");
	const [effPump, setEffPump] = (0, import_react.useState)("70");
	const [expandDetails, setExpandDetails] = (0, import_react.useState)(false);
	const [expandAssumptions, setExpandAssumptions] = (0, import_react.useState)(false);
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!project?.id) return;
		try {
			const stored = localStorage.getItem(`mep_pump_sizing_calc_${project.id}`);
			if (stored) {
				const data = JSON.parse(stored);
				if (data.pumpType) setPumpType(data.pumpType);
				if (data.wsfuVal !== void 0) setWsfuVal(data.wsfuVal);
				if (data.manualFlow !== void 0) setManualFlow(data.manualFlow);
				if (data.reqVolume !== void 0) setReqVolume(data.reqVolume);
				if (data.fillTime !== void 0) setFillTime(data.fillTime);
				if (data.workingPumps !== void 0) setWorkingPumps(data.workingPumps);
				if (data.standbyPumps !== void 0) setStandbyPumps(data.standbyPumps);
				if (data.fricFactor !== void 0) setFricFactor(data.fricFactor);
				if (data.pipeVert !== void 0) setPipeVert(data.pipeVert);
				if (data.pipeHoriz !== void 0) setPipeHoriz(data.pipeHoriz);
				if (data.filtCarbon !== void 0) setFiltCarbon(data.filtCarbon);
				if (data.filtMM !== void 0) setFiltMM(data.filtMM);
				if (data.filtCuAg !== void 0) setFiltCuAg(data.filtCuAg);
				if (data.filtSoftener !== void 0) setFiltSoftener(data.filtSoftener);
				if (data.staticHead !== void 0) setStaticHead(data.staticHead);
				if (data.presidHead !== void 0) setPresidHead(data.presidHead);
				if (data.suctionHead !== void 0) setSuctionHead(data.suctionHead);
				if (data.sfHead !== void 0) setSfHead(data.sfHead);
				if (data.selectedHead !== void 0) setSelectedHead(data.selectedHead);
				if (data.effMotor !== void 0) setEffMotor(data.effMotor);
				if (data.effPump !== void 0) setEffPump(data.effPump);
			} else {
				setPumpType("booster");
				setWsfuVal("21.6");
				setManualFlow("1.3");
				setReqVolume("5000");
				setFillTime("2");
				setWorkingPumps("1");
				setStandbyPumps("-");
				setFricFactor("0.4");
				setPipeVert("20");
				setPipeHoriz("50");
				setFiltCarbon(false);
				setFiltMM(false);
				setFiltCuAg(false);
				setFiltSoftener(false);
				setStaticHead("5.0");
				setPresidHead("1.0");
				setSuctionHead("0");
				setSfHead("5");
				setSelectedHead("");
				setEffMotor("85");
				setEffPump("70");
			}
			setTimeout(() => dirtyStore.set(false), 50);
		} catch (e) {
			console.error("Failed to load pump sizing calculation", e);
		}
		setLoadedProjectId(project.id);
	}, [project?.id]);
	const handleSaveCurrent = () => {
		try {
			const dataToSave = {
				pumpType,
				wsfuVal,
				manualFlow,
				reqVolume,
				fillTime,
				workingPumps,
				standbyPumps,
				fricFactor,
				pipeVert,
				pipeHoriz,
				filtCarbon,
				filtMM,
				filtCuAg,
				filtSoftener,
				staticHead,
				presidHead,
				suctionHead,
				sfHead,
				selectedHead,
				effMotor,
				effPump
			};
			localStorage.setItem(`mep_pump_sizing_calc_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(false);
			if (forceSaveToCloud) forceSaveToCloud();
			toast.success("Pump Sizing Calculation saved to project successfully!");
		} catch (e) {
			toast.error("Failed to save calculation.");
		}
	};
	const handleImportWSFU = () => {
		try {
			const stored = localStorage.getItem(`mep_fixture_unit_calc_${project.id}`);
			if (stored) {
				const data = JSON.parse(stored);
				if (data.fuSpaces && Array.isArray(data.fuSpaces)) {
					let total = 0;
					data.fuSpaces.forEach((s) => {
						const spaceStd = s.std || "ipc-total";
						Object.keys(s.fixtures || {}).forEach((fid) => {
							const qty = s.fixtures[fid] || 0;
							const unitFU = IP_FIXTURE_UNITS[fid]?.[spaceStd] || 0;
							total += qty * unitFU;
						});
					});
					if (total > 0) {
						setWsfuVal(total.toFixed(1));
						dirtyStore.set(true);
						toast.success(`Imported ${total.toFixed(1)} WSFU from Fixture Unit Calculator!`);
					} else toast.error("No fixture unit calculations found in this project.");
				}
			} else toast.error("No saved Fixture Unit Calculator found for this project.");
		} catch (e) {
			console.error(e);
			toast.error("Failed to import values.");
		}
	};
	(0, import_react.useEffect)(() => {
		if (pumpType !== "transfer" && (wsfuVal === "" || wsfuVal === "0" || wsfuVal === "21.6")) try {
			const stored = localStorage.getItem(`mep_fixture_unit_calc_${project.id}`);
			if (stored) {
				const data = JSON.parse(stored);
				if (data.fuSpaces && Array.isArray(data.fuSpaces)) {
					let total = 0;
					data.fuSpaces.forEach((s) => {
						const spaceStd = s.std || "ipc-total";
						Object.keys(s.fixtures || {}).forEach((fid) => {
							const qty = s.fixtures[fid] || 0;
							const unitFU = IP_FIXTURE_UNITS[fid]?.[spaceStd] || 0;
							total += qty * unitFU;
						});
					});
					if (total > 0) setWsfuVal(total.toFixed(1));
				}
			}
		} catch (e) {
			console.error("Auto-import failed", e);
		}
	}, [project.id, pumpType]);
	(0, import_react.useEffect)(() => {
		if (pumpType !== "transfer") {
			const parsedWsfu = parseFloat(wsfuVal);
			if (!isNaN(parsedWsfu) && parsedWsfu > 0) setManualFlow((wsfuToLPS(parsedWsfu) / Math.max(1, parseInt(workingPumps) || 1)).toFixed(1));
		}
	}, [
		wsfuVal,
		pumpType,
		workingPumps
	]);
	(0, import_react.useEffect)(() => {
		if (pumpType === "transfer") {
			const vol = parseFloat(reqVolume) || 0;
			const hrs = parseFloat(fillTime) || 0;
			if (vol > 0 && hrs > 0) setManualFlow((vol / (hrs * 3600)).toFixed(1));
		}
	}, [
		reqVolume,
		fillTime,
		pumpType
	]);
	const results = (0, import_react.useMemo)(() => {
		const vert = parseFloat(pipeVert) || 0;
		const horiz = parseFloat(pipeHoriz) || 0;
		const ff = parseFloat(fricFactor) || .4;
		const elbows = (vert + horiz) * .3;
		const valves = (vert + horiz) * .3;
		vert + horiz;
		const L_sum = vert + horiz + elbows + valves;
		const equivLen = Math.ceil(L_sum * 1.05 / 10) * 10;
		const frictionLoss = equivLen * (ff / 100);
		let filterLoss = 0;
		if (pumpType === "transfer") {
			if (filtCarbon) filterLoss += .8;
			if (filtMM) filterLoss += .8;
			if (filtCuAg) filterLoss += .2;
			if (filtSoftener) filterLoss += .8;
		}
		const staticH = parseFloat(staticHead) || 0;
		const outletH = parseFloat(presidHead) || 0;
		const suctionH = parseFloat(suctionHead) || 0;
		const safetyMargin = (parseFloat(sfHead) || 0) / 100;
		const calcHead = (Math.max(0, frictionLoss + staticH + outletH - suctionH) + filterLoss) * (1 + safetyMargin);
		const selHead = parseFloat(selectedHead) || calcHead;
		const flowLps = parseFloat(manualFlow) || 0;
		const liftKpa = selHead * 100;
		const pEff = (parseFloat(effPump) || 70) / 100;
		const mEff = (parseFloat(effMotor) || 85) / 100;
		const shaftPower = pEff > 0 ? flowLps * liftKpa / (1e3 * pEff) : 0;
		const motorPower = mEff > 0 ? shaftPower / mEff : 0;
		const hp = motorPower * 1.34102;
		return {
			elbows,
			valves,
			totalLen: L_sum,
			equivLen,
			frictionLoss,
			filterLoss,
			calcHead,
			selectedHead: selHead,
			flowLps,
			liftKpa,
			shaftPower,
			motorPower,
			hp
		};
	}, [
		pipeVert,
		pipeHoriz,
		fricFactor,
		pumpType,
		filtCarbon,
		filtMM,
		filtCuAg,
		filtSoftener,
		staticHead,
		presidHead,
		suctionHead,
		sfHead,
		selectedHead,
		manualFlow,
		effPump,
		effMotor
	]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				pumpType,
				wsfuVal,
				manualFlow,
				reqVolume,
				fillTime,
				workingPumps,
				standbyPumps,
				fricFactor,
				pipeVert,
				pipeHoriz,
				filtCarbon,
				filtMM,
				filtCuAg,
				filtSoftener,
				staticHead,
				presidHead,
				suctionHead,
				sfHead,
				selectedHead,
				effMotor,
				effPump,
				expandDetails,
				expandAssumptions
			};
			localStorage.setItem(`mep_pump_sizing_calc_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		pumpType,
		wsfuVal,
		manualFlow,
		reqVolume,
		fillTime,
		workingPumps,
		standbyPumps,
		fricFactor,
		pipeVert,
		pipeHoriz,
		filtCarbon,
		filtMM,
		filtCuAg,
		filtSoftener,
		staticHead,
		presidHead,
		suctionHead,
		sfHead,
		selectedHead,
		effMotor,
		effPump,
		expandDetails,
		expandAssumptions
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Pump Sizing Calculator",
		subtitle: "Transfer & Booster Pump Duty Sizing",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			onClick: handleSaveCurrent,
			className: "flex items-center gap-1.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all border-0 cursor-pointer shadow-xs",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-3.5" }), " Save Calculation"]
		}),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: scrollContainerRef,
			className: "flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "lg:col-span-5 space-y-5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide",
									children: "📥 Sizing Parameters"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-slate-50/30 dark:bg-zinc-900/30 space-y-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
										children: "SELECT PUMP TYPE"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 pt-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setPumpType("booster"),
											className: `px-4 py-2 rounded-xl text-[12.5px] font-bold cursor-pointer transition-all border ${pumpType === "booster" ? "bg-sky-500/10 text-[#06456F] border-[#0A7BC7] dark:bg-amber-950/40 dark:text-sky-400" : "bg-background text-muted-foreground border-border hover:bg-slate-100 dark:hover:bg-zinc-800"}`,
											children: "Booster Pump"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setPumpType("transfer"),
											className: `px-4 py-2 rounded-xl text-[12.5px] font-bold cursor-pointer transition-all border ${pumpType === "transfer" ? "bg-sky-500/10 text-[#06456F] border-[#0A7BC7] dark:bg-amber-950/40 dark:text-sky-400" : "bg-background text-muted-foreground border-border hover:bg-slate-100 dark:hover:bg-zinc-800"}`,
											children: "Transfer Pump"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setPumpType("transfer-booster"),
											className: `px-4 py-2 rounded-xl text-[12.5px] font-bold cursor-pointer transition-all border ${pumpType === "transfer-booster" ? "bg-sky-500/10 text-[#06456F] border-[#0A7BC7] dark:bg-amber-950/40 dark:text-sky-400" : "bg-background text-muted-foreground border-border hover:bg-slate-100 dark:hover:bg-zinc-800"}`,
											children: "Transfer-Booster"
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
											children: "FLOW ESTIMATION MODE"
										})]
									}),
									pumpType !== "transfer" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-bold text-foreground",
											children: "Total Fixture Units"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: handleImportWSFU,
												className: "text-[10.5px] font-extrabold text-[#06456F] dark:text-sky-400 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 px-2 py-0.5 rounded-md uppercase cursor-pointer border-0 transition-colors",
												children: "Import from F.U. Calculator"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-2 py-0.5 rounded-md uppercase",
												children: "WSFU"
											})]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.1",
										value: wsfuVal,
										onChange: (e) => setWsfuVal(e.target.value),
										placeholder: "21.6",
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Number of pumps: Working"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: workingPumps,
											onChange: (e) => setWorkingPumps(e.target.value),
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground mb-1",
											children: "Number of pumps: Standby"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: standbyPumps,
											onChange: (e) => setStandbyPumps(e.target.value),
											placeholder: "-",
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] })]
									})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground uppercase mb-1",
											children: "Required Capacity (L)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: reqVolume,
											onChange: (e) => setReqVolume(e.target.value),
											placeholder: "5000",
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11.5px] font-bold text-muted-foreground uppercase mb-1",
											children: "Fill Time (Hours)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: fillTime,
											onChange: (e) => setFillTime(e.target.value),
											placeholder: "2",
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl flex items-start gap-2.5 text-[12px] text-amber-900 dark:text-amber-200 font-medium",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-amber-500 text-sm shrink-0 mt-0.5",
											children: "💡"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "leading-snug",
											children: pumpType === "transfer" ? "Flow will be calculated as Tank Capacity divided by Tank Fill Time (converted to L/s)." : "Flow will be calculated using the IPC Hunter Curve table with linear interpolation based on the WSFU."
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-bold text-foreground",
											children: "Design Flow Rate"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-2 py-0.5 rounded-md uppercase tracking-wider",
											children: "L/s"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-3.5 flex items-center justify-between",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "0.01",
											value: pumpType !== "transfer" && parseFloat(wsfuVal) > 0 ? results.flowLps.toFixed(1) : manualFlow,
											onChange: (e) => {
												setManualFlow(e.target.value);
												if (pumpType !== "transfer") setWsfuVal("0");
											},
											className: "w-full bg-transparent text-amber-600 dark:text-amber-400 font-extrabold text-xl outline-none",
											placeholder: "1.3"
										})
									})] })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
												children: "MAJOR & MINOR HEAD LOSS (PIPING RUN)"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[11.5px] font-semibold text-muted-foreground flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Friction Factor:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-[#0A7BC7] font-bold",
												children: [fricFactor || "0.4", " bar/100m length"]
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Vertical Pipe Length"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "m"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: pipeVert,
										onChange: (e) => setPipeVert(e.target.value),
										placeholder: "20",
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Horizontal Pipe Length"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "m"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: pipeHoriz,
										onChange: (e) => setPipeHoriz(e.target.value),
										placeholder: "50",
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Elbows & Reducers Equiv."
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "m"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										readOnly: true,
										value: results.elbows.toFixed(2),
										className: "w-full h-11 px-3 bg-slate-50 dark:bg-zinc-900/60 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-default"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Isolation Valves Equiv."
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "m"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										readOnly: true,
										value: results.valves.toFixed(2),
										className: "w-full h-11 px-3 bg-slate-50 dark:bg-zinc-900/60 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-default"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Equivalent Length"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "m"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										readOnly: true,
										value: results.equivLen.toFixed(2),
										className: "w-full h-11 px-3 bg-slate-50 dark:bg-zinc-900/60 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-default"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Major + Minor Losses"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "bar"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										readOnly: true,
										value: results.frictionLoss.toFixed(3),
										className: "w-full h-11 px-3 bg-slate-50 dark:bg-zinc-900/60 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-default"
									})] })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
											children: "PUMP HEAD REQUIREMENT"
										})]
									}),
									pumpType === "transfer" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-2.5 p-4 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 animate-in fade-in duration-200",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[12px] font-bold text-slate-800 dark:text-zinc-200",
												children: "Water Treatment Filters"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-2 py-0.5 rounded uppercase",
												children: "Added to Head"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-2.5 select-none mt-1",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "flex items-center gap-2.5 text-[12.5px] cursor-pointer text-slate-700 dark:text-zinc-300 font-semibold",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: filtCarbon,
														onChange: (e) => {
															setFiltCarbon(e.target.checked);
															dirtyStore.set(true);
														},
														className: "rounded text-[#0A7BC7] focus:ring-[#0A7BC7] cursor-pointer"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Carbon Filter (0.8 bar)" })]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "flex items-center gap-2.5 text-[12.5px] cursor-pointer text-slate-700 dark:text-zinc-300 font-semibold",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: filtMM,
														onChange: (e) => {
															setFiltMM(e.target.checked);
															dirtyStore.set(true);
														},
														className: "rounded text-[#0A7BC7] focus:ring-[#0A7BC7] cursor-pointer"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Multi-media Filter (0.8 bar)" })]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "flex items-center gap-2.5 text-[12.5px] cursor-pointer text-slate-700 dark:text-zinc-300 font-semibold",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: filtCuAg,
														onChange: (e) => {
															setFiltCuAg(e.target.checked);
															dirtyStore.set(true);
														},
														className: "rounded text-[#0A7BC7] focus:ring-[#0A7BC7] cursor-pointer"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Cu-Ag ionization (0.2 bar)" })]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "flex items-center gap-2.5 text-[12.5px] cursor-pointer text-slate-700 dark:text-zinc-300 font-semibold",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: filtSoftener,
														onChange: (e) => {
															setFiltSoftener(e.target.checked);
															dirtyStore.set(true);
														},
														className: "rounded text-[#0A7BC7] focus:ring-[#0A7BC7] cursor-pointer"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Softener (0.8 bar)" })]
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Pressure Drop in the Piping"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "bar"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										readOnly: true,
										value: results.frictionLoss.toFixed(3),
										className: "w-full h-11 px-3 bg-slate-50 dark:bg-zinc-900/60 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-default"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Static Head"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "bar"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.1",
										value: staticHead,
										onChange: (e) => setStaticHead(e.target.value),
										placeholder: "5.0",
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Residual Pressure at Outlet"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "bar"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.1",
										value: presidHead,
										onChange: (e) => setPresidHead(e.target.value),
										placeholder: "1.0",
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Suction Pressure (Available)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "bar"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-1",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "0.1",
											value: suctionHead,
											onChange: (e) => setSuctionHead(e.target.value),
											placeholder: "0",
											className: "w-full h-9 px-3 bg-transparent text-amber-700 dark:text-amber-300 font-semibold text-[14px] outline-none"
										})
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Considering safety margin"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "%"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: sfHead,
										onChange: (e) => setSfHead(e.target.value),
										placeholder: "5",
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Head for the Pump"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "bar"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										readOnly: true,
										value: results.calcHead.toFixed(3),
										className: "w-full h-11 px-3 bg-slate-50 dark:bg-zinc-900/60 border border-border dark:border-[#262626] rounded-xl text-[14px] font-bold text-foreground outline-none cursor-default"
									})] })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
											children: "SELECTED HEAD & EFFICIENCY FOR MOTOR SIZING"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[12px] font-semibold text-muted-foreground",
											children: "Selected Head for the Pump"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
											children: "bar"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.1",
										value: selectedHead,
										onChange: (e) => setSelectedHead(e.target.value),
										placeholder: "Same as calculated head if blank",
										className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[13px] font-medium outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/60"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between mb-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-[12px] font-semibold text-muted-foreground",
												children: "Motor Efficiency"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
												children: "%"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: effMotor,
											onChange: (e) => setEffMotor(e.target.value),
											placeholder: "85",
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between mb-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-[12px] font-semibold text-muted-foreground",
												children: "Pump Efficiency"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase",
												children: "%"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: effPump,
											onChange: (e) => setEffPump(e.target.value),
											placeholder: "70",
											className: "w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
										})] })]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									toast.success("Sizing & Motor parameters updated successfully!");
									if (scrollContainerRef.current) scrollContainerRef.current.scrollTo({
										top: 0,
										behavior: "smooth"
									});
								},
								className: "w-full py-4 bg-[#0A7BC7] hover:bg-[#06456F] active:bg-[#06456F] text-white font-bold text-[15px] rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "⚡ Calculate Sizing & Motor Sizing" })
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lg:col-span-7 space-y-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border-b border-slate-100 dark:border-zinc-800/80 px-4 py-3.5 bg-slate-50/50 dark:bg-zinc-900/30 flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
									children: "1. FRICTION AND EQUIVALENT LENGTH BREAKDOWN"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-4 space-y-3 text-[12.5px]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted-foreground font-medium",
											children: "Sum of Component Lengths"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-extrabold text-foreground",
											children: [results.totalLen.toFixed(1), " m"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted-foreground font-medium",
											children: "Total Equivalent Length (with Safety)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-extrabold text-foreground",
											children: [results.equivLen.toFixed(1), " m"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted-foreground font-medium",
											children: "Major + Minor Friction Losses"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-extrabold text-foreground",
											children: [results.frictionLoss.toFixed(3), " bar"]
										})]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border-b border-slate-100 dark:border-zinc-800/80 px-4 py-3.5 bg-slate-50/50 dark:bg-zinc-900/30 flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
									children: "2. SIZING HEAD REQUIREMENTS"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-4 space-y-3 text-[12.5px]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted-foreground font-medium",
											children: "Piping Friction Losses"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-extrabold text-foreground",
											children: [results.frictionLoss.toFixed(3), " bar"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted-foreground font-medium",
											children: "Static Elevation Lift"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-extrabold text-foreground",
											children: [(parseFloat(staticHead) || 0).toFixed(2), " bar"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted-foreground font-medium",
											children: "Residual Head at Outlet"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-extrabold text-foreground",
											children: [(parseFloat(presidHead) || 0).toFixed(2), " bar"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted-foreground font-medium",
											children: "Suction Pressure (Deducted)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-extrabold text-amber-600 dark:text-amber-400",
											children: [
												"-",
												(parseFloat(suctionHead) || 0).toFixed(2),
												" bar"
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center pt-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted-foreground font-bold text-[13px]",
											children: "Total Calculated Pump Head"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-black text-[#0A7BC7] text-base",
											children: [results.calcHead.toFixed(3), " bar"]
										})]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "border-b border-slate-100 dark:border-zinc-800/80 px-4 py-3.5 bg-slate-50/50 dark:bg-zinc-900/30 flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-4 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide",
										children: "3. CALCULATIONS FOR MOTOR SELECTION"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-4 space-y-3 text-[12.5px]",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-muted-foreground font-medium",
												children: "Selected Head for the Pump"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-extrabold text-foreground",
												children: [results.selectedHead.toFixed(3), " bar"]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-muted-foreground font-medium",
												children: "Pump Flow Rate"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-extrabold text-foreground",
												children: [results.flowLps.toFixed(3), " kg/s"]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-muted-foreground font-medium",
												children: "Pressure Lift Requirement"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-extrabold text-foreground",
												children: [results.liftKpa.toFixed(1), " kPa"]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-muted-foreground font-medium",
												children: "Shaft Power Requirement"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-extrabold text-foreground",
												children: [results.shaftPower.toFixed(2), " kW"]
											})]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-sky-500/10 dark:bg-amber-950/30 border-t border-amber-500/20 px-4 py-3.5 flex items-center justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-bold text-amber-700 dark:text-amber-300 text-[13px]",
										children: "Estimated Motor Power"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-black text-amber-600 dark:text-amber-400 text-base",
										children: [
											results.motorPower.toFixed(2),
											" kW / ",
											results.hp.toFixed(2),
											" HP"
										]
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border dark:border-[#262626] rounded-2xl overflow-hidden bg-background",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setExpandDetails(!expandDetails),
								className: "w-full px-5 py-3.5 bg-slate-50 dark:bg-zinc-900 border-b border-border dark:border-[#262626] flex items-center justify-between text-[13px] font-bold text-foreground outline-none cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono text-[#06456F] dark:text-sky-400",
										children: "Σ"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Detailed Calculations Breakdown" })]
								}), expandDetails ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
							}), expandDetails && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-5 space-y-4 text-[12.5px] leading-relaxed",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-slate-50/50 dark:bg-zinc-900/10 border border-slate-100 dark:border-zinc-800/80 p-3 rounded-xl",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-foreground block",
											children: "1. Piping friction losses:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-muted-foreground mt-0.5 block font-mono text-[11.5px]",
											children: [
												"H_loss = L_equiv × (FrictionFactor / 100) = ",
												results.equivLen.toFixed(1),
												" × (",
												fricFactor || "0.4",
												"/100) = ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[#06456F] dark:text-sky-400 font-bold",
													children: [results.frictionLoss.toFixed(3), " bar"]
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-slate-50/50 dark:bg-zinc-900/10 border border-slate-100 dark:border-zinc-800/80 p-3 rounded-xl",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-foreground block",
											children: "2. Total Dynamic Head required (TDH):"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-muted-foreground mt-0.5 block font-mono text-[11.5px] leading-normal",
											children: ["TDH = [ (H_loss + H_static + H_outlet − H_suction) + H_filter ] × (1 + SafetyMargin/100) = ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-[#06456F] dark:text-sky-400 font-bold",
												children: [results.calcHead.toFixed(3), " bar"]
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-slate-50/50 dark:bg-zinc-900/10 border border-slate-100 dark:border-zinc-800/80 p-3 rounded-xl",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-foreground block",
											children: "3. Required shaft and motor power:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-muted-foreground mt-0.5 block font-mono text-[11.5px]",
											children: [
												"Power = Flow × Head Lift ÷ (1000 × η) = ",
												results.flowLps.toFixed(2),
												" × ",
												results.liftKpa.toFixed(0),
												" ÷ (1000 × ",
												effPump || "70",
												"%) = ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[#06456F] dark:text-sky-400 font-bold",
													children: [
														results.motorPower.toFixed(2),
														" kW (",
														results.hp.toFixed(2),
														" HP)"
													]
												})
											]
										})]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border dark:border-[#262626] rounded-2xl overflow-hidden bg-background",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setExpandAssumptions(!expandAssumptions),
								className: "w-full px-5 py-3.5 bg-slate-50 dark:bg-zinc-900 border-b border-border dark:border-[#262626] flex items-center justify-between text-[13px] font-bold text-foreground outline-none cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[#06456F] dark:text-sky-400 font-bold font-sans",
										children: "i"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Assumptions & Basis" })]
								}), expandAssumptions ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
							}), expandAssumptions && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-5 text-[12.5px] text-muted-foreground space-y-2 leading-relaxed",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[#0A7BC7] font-bold shrink-0 mt-0.5",
											children: "•"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Booster pump adds pressure deficit between suction mains and required fixture pressure." })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[#0A7BC7] font-bold shrink-0 mt-0.5",
											children: "•"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Equivalent pipe length automatically includes a 30% allowance for elbows/fittings and 30% for isolation valves." })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[#0A7BC7] font-bold shrink-0 mt-0.5",
											children: "•"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Mass flow rate calculations assume clean fresh water density of approximately 1,000 kg/m³." })]
									})
								]
							})]
						})
					]
				})]
			})
		})
	});
}
//#endregion
export { PumpSizingPage as component };
