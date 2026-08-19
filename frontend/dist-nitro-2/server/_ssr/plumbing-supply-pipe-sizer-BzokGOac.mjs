import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, Ut as TriangleAlert, Y as Info } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-Blf5aT0O.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-supply-pipe-sizer-BzokGOac.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var PIPE_SIZES = [
	{
		nps: "¾\"",
		dn: "20 mm",
		id: .811
	},
	{
		nps: "1\"",
		dn: "25 mm",
		id: 1.055
	},
	{
		nps: "1¼\"",
		dn: "32 mm",
		id: 1.265
	},
	{
		nps: "1½\"",
		dn: "40 mm",
		id: 1.505
	},
	{
		nps: "2\"",
		dn: "50 mm",
		id: 2.009
	},
	{
		nps: "2½\"",
		dn: "65 mm",
		id: 2.495
	},
	{
		nps: "3\"",
		dn: "80 mm",
		id: 3.035
	},
	{
		nps: "4\"",
		dn: "100 mm",
		id: 4.009
	}
];
function SupplyPipeSizerPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("si");
	const [flow, setFlow] = (0, import_react.useState)("");
	const [pAvail, setPAvail] = (0, import_react.useState)("");
	const [pResid, setPResid] = (0, import_react.useState)("");
	const [length, setLength] = (0, import_react.useState)("");
	const [fittingAllowance, setFittingAllowance] = (0, import_react.useState)(20);
	const [elevation, setElevation] = (0, import_react.useState)("");
	const [pipeMaterial, setPipeMaterial] = (0, import_react.useState)("150");
	(0, import_react.useEffect)(() => {
		if (!project?.id) return;
		try {
			const stored = localStorage.getItem(`mep_supply_pipe_sizer_${project.id}`);
			if (stored) {
				const data = JSON.parse(stored);
				if (data.unitSystem) setUnitSystem(data.unitSystem);
				if (data.flow !== void 0) setFlow(data.flow);
				if (data.pAvail !== void 0) setPAvail(data.pAvail);
				if (data.pResid !== void 0) setPResid(data.pResid);
				if (data.length !== void 0) setLength(data.length);
				if (data.fittingAllowance !== void 0) setFittingAllowance(data.fittingAllowance);
				if (data.elevation !== void 0) setElevation(data.elevation);
				if (data.pipeMaterial !== void 0) setPipeMaterial(data.pipeMaterial);
			} else {
				setUnitSystem("si");
				setFlow("");
				setPAvail("");
				setPResid("");
				setLength("");
				setFittingAllowance(20);
				setElevation("");
				setPipeMaterial("150");
			}
			setTimeout(() => dirtyStore.set(false), 50);
		} catch (e) {
			console.error("Failed to load supply pipe sizer calculation", e);
		}
		setLoadedProjectId(project.id);
	}, [project?.id]);
	const handleSaveCurrent = () => {
		try {
			const dataToSave = {
				unitSystem,
				flow,
				pAvail,
				pResid,
				length,
				fittingAllowance,
				elevation,
				pipeMaterial
			};
			localStorage.setItem(`mep_supply_pipe_sizer_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(false);
			if (forceSaveToCloud) forceSaveToCloud();
			toast.success("Supply Pipe Sizer Calculation saved to project successfully!");
		} catch (e) {
			toast.error("Failed to save calculation.");
		}
	};
	const ip = unitSystem === "ip";
	const handleUnitSystemChange = (targetUnit) => {
		if (targetUnit === unitSystem) return;
		const toIP = targetUnit === "ip";
		if (!window.__mep_keep_values) {
			setFlow((prev) => {
				if (prev === "") return "";
				const val = toIP ? prev * 15.8503 : prev / 15.8503;
				return Number(val.toFixed(2));
			});
			setPAvail((prev) => {
				if (prev === "") return "";
				const val = toIP ? prev / 6.89476 : prev * 6.89476;
				return Number(val.toFixed(1));
			});
			setPResid((prev) => {
				if (prev === "") return "";
				const val = toIP ? prev / 6.89476 : prev * 6.89476;
				return Number(val.toFixed(1));
			});
			setLength((prev) => {
				if (prev === "") return "";
				const val = toIP ? prev * 3.28084 : prev / 3.28084;
				return Number(val.toFixed(1));
			});
			setElevation((prev) => {
				if (prev === "") return "";
				const val = toIP ? prev * 3.28084 : prev / 3.28084;
				return Number(val.toFixed(1));
			});
		}
		setUnitSystem(targetUnit);
	};
	const calculations = (0, import_react.useMemo)(() => {
		if (!flow || !pAvail || !pResid || !length) return null;
		const Q_gpm = ip ? Number(flow) : Number(flow) * 15.8503;
		const pAvail_psi = ip ? Number(pAvail) : Number(pAvail) / 6.89476;
		const pResid_psi = ip ? Number(pResid) : Number(pResid) / 6.89476;
		const L_ft = ip ? Number(length) : Number(length) * 3.28084;
		const elev_ft = ip ? Number(elevation) || 0 : (Number(elevation) || 0) * 3.28084;
		const C = Number(pipeMaterial);
		const Leff = L_ft * (1 + fittingAllowance / 100);
		const elevLoss_psi = elev_ft / 2.31;
		const elevLoss_kpa = elevLoss_psi * 6.89476;
		const rows = PIPE_SIZES.map((s) => {
			const hf_psi = 4.52 * Leff * Math.pow(Q_gpm, 1.85) / (Math.pow(C, 1.85) * Math.pow(s.id, 4.87));
			const hf_kpa = hf_psi * 6.89476;
			const A = Math.PI * Math.pow(s.id / 12, 2) / 4;
			const v_fps = Q_gpm / 448.8 / A;
			const v_ms = v_fps * .3048;
			const resid_psi = pAvail_psi - hf_psi - elevLoss_psi;
			const resid_kpa = resid_psi * 6.89476;
			const isPressureOk = resid_psi >= pResid_psi;
			const isVelocityOk = v_fps >= 1 && v_fps <= 8;
			const ok = isPressureOk && isVelocityOk;
			return {
				...s,
				hf_psi,
				hf_kpa,
				v_fps,
				v_ms,
				resid_psi,
				resid_kpa,
				ok,
				isPressureOk,
				isVelocityOk
			};
		});
		return {
			rows,
			rec: rows.find((r) => r.ok),
			elevLoss_psi,
			elevLoss_kpa
		};
	}, [
		flow,
		pAvail,
		pResid,
		length,
		fittingAllowance,
		elevation,
		pipeMaterial,
		ip
	]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				unitSystem,
				flow,
				pAvail,
				pResid,
				length,
				fittingAllowance,
				elevation,
				pipeMaterial
			};
			localStorage.setItem(`mep_supply_pipe_sizer_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		unitSystem,
		flow,
		pAvail,
		pResid,
		length,
		fittingAllowance,
		elevation,
		pipeMaterial
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Water Supply Pipe Sizer",
		hideSubHeader: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-full min-h-0 bg-transparent font-sans",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6 animate-in fade-in-50 duration-200",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-between items-start select-none",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
									children: "PLUMBING > SUPPLY PIPE SIZER"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
									children: "Water Supply Pipe Sizer"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[13px] text-muted-foreground mt-0.5",
									children: "Size domestic water supply distribution pipes and calculate residual fixture pressure using the Hazen-Williams equation."
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: handleSaveCurrent,
							className: "flex items-center gap-2 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-xl px-4 py-2 text-[12.5px] font-bold transition-all border-0 cursor-pointer shadow-sm mt-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-4" }), " Save Calculation"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 p-2 border border-border rounded-xl",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl gap-1 select-none",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => handleUnitSystemChange("si"),
								className: `px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
								children: "Metric (SI)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => handleUnitSystemChange("ip"),
								className: `px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
								children: "Imperial (IP)"
							})]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "lg:col-span-4 flex flex-col gap-5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 pb-2 border-b border-border/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
										children: "⚙ System Inputs"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-4 text-xs font-sans",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground flex justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Design Flow Rate" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground font-bold font-mono",
													children: ip ? "GPM" : "L/s"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												placeholder: "e.g. 25",
												value: flow,
												onChange: (e) => setFlow(e.target.value !== "" ? Number(e.target.value) : ""),
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground flex justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Available Supply Pressure" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground font-bold font-mono",
													children: ip ? "psi" : "kPa"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												placeholder: "e.g. 60",
												value: pAvail,
												onChange: (e) => setPAvail(e.target.value !== "" ? Number(e.target.value) : ""),
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground flex justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Required Residual at Fixture" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground font-bold font-mono",
													children: ip ? "psi" : "kPa"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												placeholder: "e.g. 20",
												value: pResid,
												onChange: (e) => setPResid(e.target.value !== "" ? Number(e.target.value) : ""),
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground flex justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total Pipe Length" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground font-bold font-mono",
													children: ip ? "ft" : "m"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												placeholder: "e.g. 120",
												value: length,
												onChange: (e) => setLength(e.target.value !== "" ? Number(e.target.value) : ""),
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground flex justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Fitting Allowance" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground font-bold font-mono",
													children: "% of pipe length"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												placeholder: "e.g. 20",
												value: fittingAllowance,
												onChange: (e) => setFittingAllowance(Number(e.target.value)),
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "font-semibold text-foreground flex justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Elevation Rise (supply to fixture)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground font-bold font-mono",
													children: ip ? "ft" : "m"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												placeholder: "e.g. 20",
												value: elevation,
												onChange: (e) => setElevation(e.target.value !== "" ? Number(e.target.value) : ""),
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Pipe Material"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: pipeMaterial,
												onChange: (e) => setPipeMaterial(e.target.value),
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "150",
														children: "Copper Type L (C=150)"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "150",
														children: "CPVC (C=150)"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "120",
														children: "Galvanized Steel (C=120)"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "130",
														children: "PEX (C=130)"
													})
												]
											})]
										})
									]
								})]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "lg:col-span-8 flex flex-col gap-6",
							children: !calculations ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground italic flex flex-col gap-2 items-center justify-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-8 text-[#0A7BC7]/70" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Enter all system parameters on the left to calculate recommended pipe sizing." })]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-6 animate-in fade-in duration-200",
								children: [
									!calculations.rec && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 text-xs text-red-700 dark:text-red-400 font-sans",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-5 shrink-0 text-red-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "font-bold",
											children: "Pressure Insufficient"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-0.5",
											children: "No standard pipe size satisfies both velocity (1-8 fps) and residual pressure requirements. Consider boosting available supply pressure or reducing pipe elevation/run."
										})] })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 pb-2 border-b border-border/60",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
												children: "📋 Sizing Schedule (All Pipe Sizes)"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "overflow-x-auto border border-border rounded-xl",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
												className: "w-full border-collapse text-[12.5px] font-sans",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "bg-slate-100 dark:bg-slate-800/80 border-b border-border text-foreground font-semibold",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-center",
															children: "NPS"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-center",
															children: "DN Size"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-right",
															children: "Velocity"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-right",
															children: "Friction Loss"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-right",
															children: "Elevation Loss"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-right",
															children: "Residual Pressure"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-center w-24",
															children: "Status"
														})
													]
												}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: calculations.rows.map((r) => {
													const showVel = ip ? r.v_fps : r.v_ms;
													const showFric = ip ? r.hf_psi : r.hf_kpa;
													const showElev = ip ? calculations.elevLoss_psi : calculations.elevLoss_kpa;
													const showResid = ip ? r.resid_psi : r.resid_kpa;
													const isVelWarning = r.v_fps < 1 || r.v_fps > 8;
													const isPressWarning = r.resid_psi < (ip ? Number(pResid) : Number(pResid) / 6.89476);
													return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
														className: `border-b border-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 ${r.ok ? "bg-emerald-500/5" : ""}`,
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-2.5 text-center font-bold text-foreground",
																children: r.nps
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-2.5 text-center font-medium text-muted-foreground",
																children: r.dn
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																className: `p-2.5 text-right font-mono font-medium ${isVelWarning ? "text-amber-500 font-bold" : "text-foreground"}`,
																children: [
																	showVel.toFixed(2),
																	" ",
																	ip ? "fps" : "m/s"
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																className: "p-2.5 text-right font-mono font-medium text-muted-foreground",
																children: [
																	showFric.toFixed(2),
																	" ",
																	ip ? "psi" : "kPa"
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																className: "p-2.5 text-right font-mono font-medium text-muted-foreground",
																children: [
																	showElev.toFixed(2),
																	" ",
																	ip ? "psi" : "kPa"
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																className: `p-2.5 text-right font-mono font-bold ${isPressWarning ? "text-red-500" : "text-emerald-500"}`,
																children: [
																	showResid.toFixed(1),
																	" ",
																	ip ? "psi" : "kPa"
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-2.5 text-center",
																children: r.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded text-[10.5px]",
																	children: "✓ PASS"
																}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-muted-foreground/60 font-semibold",
																	children: "-"
																})
															})
														]
													}, r.nps);
												}) })]
											})
										})]
									}),
									calculations.rec && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 pb-2 border-b border-border/60",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-emerald-500 rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
												children: "✅ Recommended Sizing Selection"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-1 md:grid-cols-2 gap-4 font-sans text-xs",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex justify-between items-center md:col-span-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-bold text-foreground",
														children: "Recommended Pipe Size"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-[17px] font-extrabold text-emerald-500 font-mono",
														children: [
															calculations.rec.nps,
															" NPS (",
															calculations.rec.dn,
															")"
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-center py-2 border-b border-border/30",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-muted-foreground",
														children: "Velocity"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-mono font-bold text-foreground",
														children: [
															(ip ? calculations.rec.v_fps : calculations.rec.v_ms).toFixed(2),
															" ",
															ip ? "fps" : "m/s"
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-center py-2 border-b border-border/30",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-muted-foreground",
														children: "Friction Loss"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-mono font-bold text-foreground",
														children: [
															(ip ? calculations.rec.hf_psi : calculations.rec.hf_kpa).toFixed(2),
															" ",
															ip ? "psi" : "kPa"
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-center py-2 border-b border-border/30",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-muted-foreground",
														children: "Elevation pressure loss"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-mono font-bold text-foreground",
														children: [
															(ip ? calculations.elevLoss_psi : calculations.elevLoss_kpa).toFixed(2),
															" ",
															ip ? "psi" : "kPa"
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-center py-2 border-b border-border/30",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-muted-foreground",
														children: "Residual at remote fixture"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-mono font-bold text-emerald-500 text-sm",
														children: [
															(ip ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1),
															" ",
															ip ? "psi" : "kPa"
														]
													})]
												})
											]
										})]
									})
								]
							})
						})]
					})
				]
			})
		})
	});
}
//#endregion
export { SupplyPipeSizerPage as component };
