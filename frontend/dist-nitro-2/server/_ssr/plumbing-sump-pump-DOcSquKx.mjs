import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, S as Settings, Vt as ArrowDown, Y as Info, ht as Droplet } from "../_libs/lucide-react.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-sump-pump-DOcSquKx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
require_excel();
import_FileSaver_min.default.saveAs;
function SumpPumpPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const [req, setReq] = (0, import_react.useState)(1e3);
	const [time, setTime] = (0, import_react.useState)(1);
	const [flow, setFlow] = (0, import_react.useState)(0);
	const [pitFlow, setPitFlow] = (0, import_react.useState)(5);
	const [pitHold, setPitHold] = (0, import_react.useState)(5);
	const [longestPipe, setLongestPipe] = (0, import_react.useState)(15);
	const [propSide, setPropSide] = (0, import_react.useState)(2);
	const [pipeVert, setPipeVert] = (0, import_react.useState)(5);
	const [pipeHoriz, setPipeHoriz] = (0, import_react.useState)(20);
	const [fricFactor, setFricFactor] = (0, import_react.useState)(.4);
	const [staticHead, setStaticHead] = (0, import_react.useState)(5);
	const [presid, setPresid] = (0, import_react.useState)(1);
	const [suction, setSuction] = (0, import_react.useState)(0);
	const [sfHead, setSfHead] = (0, import_react.useState)(10);
	const [selectedHead, setSelectedHead] = (0, import_react.useState)(0);
	const [effMotor, setEffMotor] = (0, import_react.useState)(85);
	const [effPump, setEffPump] = (0, import_react.useState)(70);
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!project?.id) return;
		if (project) {
			const saved = localStorage.getItem(`sumpPump_${project.id}`);
			if (saved) {
				const p = JSON.parse(saved);
				setReq(p.req ?? 1e3);
				setTime(p.time ?? 1);
				setFlow(p.flow ?? 0);
				setPitFlow(p.pitFlow ?? 5);
				setPitHold(p.pitHold ?? 5);
				setLongestPipe(p.longestPipe ?? 15);
				setPropSide(p.propSide ?? 2);
				setPipeVert(p.pipeVert ?? 5);
				setPipeHoriz(p.pipeHoriz ?? 20);
				setFricFactor(p.fricFactor ?? .4);
				setStaticHead(p.staticHead ?? 5);
				setPresid(p.presid ?? 1);
				setSuction(p.suction ?? 0);
				setSfHead(p.sfHead ?? 10);
				setSelectedHead(p.selectedHead ?? 0);
				setEffMotor(p.effMotor ?? 85);
				setEffPump(p.effPump ?? 70);
			}
			if (project?.id) setLoadedProjectId(project.id);
			else setLoadedProjectId("loaded");
		}
	}, [project]);
	const saveState = () => {
		if (!project?.id) return;
		if (project) {
			localStorage.setItem(`sumpPump_${project.id}`, JSON.stringify({
				req,
				time,
				flow,
				pitFlow,
				pitHold,
				longestPipe,
				propSide,
				pipeVert,
				pipeHoriz,
				fricFactor,
				staticHead,
				presid,
				suction,
				sfHead,
				selectedHead,
				effMotor,
				effPump
			}));
			dirtyStore.set(true);
		}
	};
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				req,
				time,
				flow,
				pitFlow,
				pitHold,
				longestPipe,
				propSide,
				pipeVert,
				pipeHoriz,
				fricFactor,
				staticHead,
				presid,
				suction,
				sfHead,
				selectedHead,
				effMotor,
				effPump
			};
			localStorage.setItem(`sumpPump_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		req,
		time,
		flow,
		pitFlow,
		pitHold,
		longestPipe,
		propSide,
		pipeVert,
		pipeHoriz,
		fricFactor,
		staticHead,
		presid,
		suction,
		sfHead,
		selectedHead,
		effMotor,
		effPump
	]);
	const handleSave = () => {
		saveState();
		alert("Calculation saved successfully!");
	};
	const Q_flow = req > 0 && time > 0 ? req / (time * 3600) : flow;
	const pitVol = pitFlow * pitHold * 60 / 1e3;
	const invertVal = longestPipe > 0 ? Math.ceil(longestPipe / 90 * 100) / 100 + .16 : 0;
	let propDepth = 0;
	if (propSide > 0) {
		const waterDepthRaw = pitVol / (propSide * propSide);
		propDepth = Math.ceil(((waterDepthRaw < 1 ? 1 : waterDepthRaw) + invertVal + .25) * 100) / 100;
	}
	const L_elbows = (pipeVert + pipeHoriz) * .3;
	const L_valves = (pipeVert + pipeHoriz) * .3;
	const L_sum = pipeVert + pipeHoriz + L_elbows + L_valves;
	const L_equiv = Math.ceil(L_sum * 1.05 / 10) * 10;
	const H_loss = L_equiv * (fricFactor / 100);
	const H_pump_calc = Math.max(0, H_loss + staticHead + presid - suction) * (1 + sfHead / 100);
	const P_motor = Q_flow * (selectedHead > 0 ? selectedHead : H_pump_calc) * 100 / (1e3 * (effPump / 100)) / (effMotor / 100);
	const HP = P_motor * 1.34102;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Sump Pump Sizing",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-6 max-w-6xl mx-auto space-y-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex justify-between items-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "text-2xl font-bold text-gray-900 flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Droplet, { className: "w-6 h-6 text-emerald-500" }), "Sump Pump Sizing"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-gray-500 text-sm mt-1",
					children: "Calculate sump pit volume, flow, head, and motor requirements"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center gap-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: handleSave,
						className: "flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors shadow-sm text-sm font-medium",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "w-4 h-4" }), "Save Calculation"]
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 lg:grid-cols-2 gap-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "bg-gray-50 border-b border-gray-200 px-5 py-4",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
									className: "text-lg font-semibold text-gray-800 flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "w-5 h-5 text-gray-500" }), "Flow & Volume Parameters"]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-5 grid grid-cols-2 gap-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "col-span-2 sm:col-span-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-xs font-medium text-gray-700 mb-1",
											children: "Vol Requirement (L)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: req,
											onChange: (e) => setReq(Number(e.target.value)),
											className: "w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "col-span-2 sm:col-span-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-xs font-medium text-gray-700 mb-1",
											children: "Drawdown Time (Hrs)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: time,
											onChange: (e) => setTime(Number(e.target.value)),
											className: "w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "col-span-2 sm:col-span-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-xs font-medium text-gray-700 mb-1",
											children: "Manual Flow (L/s)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: flow,
											onChange: (e) => setFlow(Number(e.target.value)),
											className: "w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50",
											disabled: req > 0 && time > 0
										})]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "bg-gray-50 border-b border-gray-200 px-5 py-4",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
									className: "text-lg font-semibold text-gray-800 flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "w-5 h-5 text-gray-500" }), "Pit Sizing"]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-5 grid grid-cols-2 gap-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-medium text-gray-700 mb-1",
										children: "Flow per Pit (L/s)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: pitFlow,
										onChange: (e) => setPitFlow(Number(e.target.value)),
										className: "w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-medium text-gray-700 mb-1",
										children: "Holding Time (min)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: pitHold,
										onChange: (e) => setPitHold(Number(e.target.value)),
										className: "w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-medium text-gray-700 mb-1",
										children: "Longest Pipe (m)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: longestPipe,
										onChange: (e) => setLongestPipe(Number(e.target.value)),
										className: "w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-medium text-gray-700 mb-1",
										children: "Prop. Side (m)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: propSide,
										onChange: (e) => setPropSide(Number(e.target.value)),
										className: "w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500"
									})] })
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "bg-gray-50 border-b border-gray-200 px-5 py-4",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
									className: "text-lg font-semibold text-gray-800 flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "w-5 h-5 text-gray-500" }), "Piping & Head"]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-5 grid grid-cols-2 gap-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-medium text-gray-700 mb-1",
										children: "Vert Pipe (m)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: pipeVert,
										onChange: (e) => setPipeVert(Number(e.target.value)),
										className: "w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-medium text-gray-700 mb-1",
										children: "Horiz Pipe (m)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: pipeHoriz,
										onChange: (e) => setPipeHoriz(Number(e.target.value)),
										className: "w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-medium text-gray-700 mb-1",
										children: "Friction (bar/100m)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: fricFactor,
										onChange: (e) => setFricFactor(Number(e.target.value)),
										className: "w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-medium text-gray-700 mb-1",
										children: "Static Head (bar)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: staticHead,
										onChange: (e) => setStaticHead(Number(e.target.value)),
										className: "w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-medium text-gray-700 mb-1",
										children: "Residual (bar)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: presid,
										onChange: (e) => setPresid(Number(e.target.value)),
										className: "w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-medium text-gray-700 mb-1",
										children: "Suction (bar)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: suction,
										onChange: (e) => setSuction(Number(e.target.value)),
										className: "w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500"
									})] })
								]
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "bg-gray-50 border-b border-gray-200 px-5 py-4",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								className: "text-lg font-semibold text-gray-800 flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "w-5 h-5 text-gray-500" }), "Calculated Results"]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-5 space-y-4 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-gray-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-gray-600",
										children: "Design Flow"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-semibold text-emerald-700",
										children: [Q_flow.toFixed(2), " L/s"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-gray-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-gray-600",
										children: "Pit Volume"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-semibold text-gray-900",
										children: [pitVol.toFixed(2), " m³"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-gray-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-gray-600",
										children: "Pipe Invert"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-semibold text-gray-900",
										children: [invertVal.toFixed(2), " m"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-gray-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-gray-600",
										children: "Prop Depth"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-semibold text-gray-900",
										children: [propDepth.toFixed(2), " m"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-gray-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-gray-600",
										children: "Equiv Pipe Length"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-semibold text-gray-900",
										children: [L_equiv.toFixed(2), " m"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-gray-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-gray-600",
										children: "Friction Loss"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-semibold text-gray-900",
										children: [H_loss.toFixed(3), " bar"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-gray-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-gray-600",
										children: "TDH Calc"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-bold text-emerald-700 text-lg",
										children: [H_pump_calc.toFixed(3), " bar"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-gray-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-gray-600",
										children: "Motor Power"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-bold text-emerald-700 text-lg",
										children: [
											P_motor.toFixed(2),
											" kW / ",
											HP.toFixed(2),
											" HP"
										]
									})]
								})
							]
						})]
					})
				})]
			})]
		})
	});
}
//#endregion
export { SumpPumpPage as component };
