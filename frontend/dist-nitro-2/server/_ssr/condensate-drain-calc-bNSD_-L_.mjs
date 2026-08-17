import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, N as Plus, m as Trash2 } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { a as fToC, l as lpsToCfm, n as cToF, r as cfmToLps, u as lpsToGpm } from "./conversions-kXRQ6bCu.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/condensate-drain-calc-bNSD_-L_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function satP(tK) {
	if (tK >= 273.15) return Math.exp(-5800.2206 / tK + 1.3914993 - .04864 * tK + 41764768e-12 * tK ** 2 - 1.4452093e-8 * tK ** 3 + 6.5459673 * Math.log(tK));
	return Math.exp(-5674.5359 / tK + 6.3925247 - .009677843 * tK + 6.2215701e-7 * tK ** 2 + 2.0747825e-9 * tK ** 3 - 9484024e-25 * tK ** 4 + 4.1635019 * Math.log(tK));
}
function wFromWB(db, wb, p) {
	const ws = .621945 * satP(wb + 273.15) / (p - satP(wb + 273.15));
	return ((2501 - 2.381 * wb) * ws - 1.006 * (db - wb)) / (2501 + 1.805 * db - 4.186 * wb);
}
function CondensateDrainCalcPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("si");
	const [rows, setRows] = (0, import_react.useState)([]);
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!project?.id) return;
		try {
			const stored = localStorage.getItem(`mep_condensate_calc_${project.id}`);
			if (stored) {
				const data = JSON.parse(stored);
				if (data.unitSystem) setUnitSystem(data.unitSystem);
				if (data.rows) setRows(data.rows);
			} else {
				setUnitSystem("si");
				setRows([{
					id: "coil-1",
					name: "AHU-01",
					dbIn: 24,
					wbIn: 18,
					dbOut: 13,
					wbOut: 12,
					flow: 1500
				}, {
					id: "coil-2",
					name: "FCU-01",
					dbIn: 24,
					wbIn: 17,
					dbOut: 14,
					wbOut: 13,
					flow: 400
				}]);
			}
			setTimeout(() => dirtyStore.set(false), 50);
		} catch (e) {
			console.error("Failed to load condensate calculation", e);
		}
		setLoadedProjectId(project.id);
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				unitSystem,
				rows
			};
			localStorage.setItem(`mep_condensate_calc_${project.id}`, JSON.stringify(dataToSave));
		}
	}, [
		project?.id,
		loadedProjectId,
		unitSystem,
		rows
	]);
	const handleSaveCurrent = () => {
		try {
			const dataToSave = {
				unitSystem,
				rows
			};
			localStorage.setItem(`mep_condensate_calc_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(false);
			forceSaveToCloud();
			toast.success("Condensate Calculation saved to project successfully!");
		} catch (e) {
			toast.error("Failed to save calculation.");
		}
	};
	const [newCoil, setNewCoil] = (0, import_react.useState)({
		name: "",
		dbIn: "",
		wbIn: "",
		dbOut: "",
		wbOut: "",
		flow: ""
	});
	const ip = unitSystem === "ip";
	const handleUnitSystemChange = (unit) => {
		if (unit === unitSystem) return;
		setUnitSystem(unit);
		dirtyStore.set(true);
		if (window.__mep_keep_values) return;
		const convT = (t) => unit === "ip" ? cToF(t) : fToC(t);
		const convF = (f) => unit === "ip" ? lpsToCfm(f) : cfmToLps(f);
		setRows(rows.map((r) => ({
			...r,
			dbIn: Number(convT(r.dbIn).toFixed(1)),
			wbIn: Number(convT(r.wbIn).toFixed(1)),
			dbOut: Number(convT(r.dbOut).toFixed(1)),
			wbOut: Number(convT(r.wbOut).toFixed(1)),
			flow: Number(convF(r.flow).toFixed(0))
		})));
		setNewCoil((prev) => ({
			...prev,
			dbIn: prev.dbIn !== "" ? Number(convT(Number(prev.dbIn)).toFixed(1)) : "",
			wbIn: prev.wbIn !== "" ? Number(convT(Number(prev.wbIn)).toFixed(1)) : "",
			dbOut: prev.dbOut !== "" ? Number(convT(Number(prev.dbOut)).toFixed(1)) : "",
			wbOut: prev.wbOut !== "" ? Number(convT(Number(prev.wbOut)).toFixed(1)) : "",
			flow: prev.flow !== "" ? Number(convF(Number(prev.flow)).toFixed(0)) : ""
		}));
	};
	const calculatedRows = (0, import_react.useMemo)(() => {
		const pAtm = 101325;
		return rows.map((r) => {
			const dbInC = ip ? fToC(r.dbIn) : r.dbIn;
			const wbInC = ip ? fToC(r.wbIn) : r.wbIn;
			const dbOutC = ip ? fToC(r.dbOut) : r.dbOut;
			const wbOutC = ip ? fToC(r.wbOut) : r.wbOut;
			let wIn = 0, wOut = 0;
			try {
				wIn = wFromWB(dbInC, wbInC, pAtm);
			} catch (e) {}
			try {
				wOut = wFromWB(dbOutC, wbOutC, pAtm);
			} catch (e) {}
			const dw = Math.max(0, wIn - wOut);
			const condFlow = (ip ? cfmToLps(r.flow) : r.flow) / 1e3 * 1.2 * dw;
			return {
				...r,
				wIn,
				wOut,
				condFlow
			};
		});
	}, [rows, ip]);
	const totals = (0, import_react.useMemo)(() => {
		return {
			totalFlow: rows.reduce((a, b) => a + b.flow, 0),
			totalCond: calculatedRows.reduce((a, b) => a + b.condFlow, 0)
		};
	}, [calculatedRows, rows]);
	const handleAddCoil = () => {
		if (!newCoil.name) return;
		const id = "coil-" + Date.now();
		const dbIn = newCoil.dbIn !== "" ? Number(newCoil.dbIn) : ip ? 75.2 : 24;
		const wbIn = newCoil.wbIn !== "" ? Number(newCoil.wbIn) : ip ? 62.6 : 17;
		const dbOut = newCoil.dbOut !== "" ? Number(newCoil.dbOut) : ip ? 57.2 : 14;
		const wbOut = newCoil.wbOut !== "" ? Number(newCoil.wbOut) : ip ? 55.4 : 13;
		const flow = newCoil.flow !== "" ? Number(newCoil.flow) : ip ? 1e3 : 500;
		setRows([...rows, {
			id,
			name: newCoil.name,
			dbIn,
			wbIn,
			dbOut,
			wbOut,
			flow
		}]);
		dirtyStore.set(true);
		setNewCoil({
			name: "",
			dbIn: "",
			wbIn: "",
			dbOut: "",
			wbOut: "",
			flow: ""
		});
	};
	const handleDeleteCoil = (id) => {
		setRows(rows.filter((r) => r.id !== id));
		dirtyStore.set(true);
	};
	const uTemp = ip ? "°F" : "°C";
	const uFlow = ip ? "CFM" : "L/s";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Condensate Drain Calc",
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
									children: "HVAC > CONDENSATE CALCULATION"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
									children: "Coil Condensate Calculator"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[13px] text-muted-foreground mt-0.5",
									children: "Input entering and leaving air conditions for multiple cooling coils to formulate aggregate condensate drainage loads."
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: handleSaveCurrent,
							className: "flex items-center gap-2 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-xl px-4 py-2 text-[12.5px] font-bold transition-all border-0 cursor-pointer shadow-sm mt-3 animate-in fade-in zoom-in-95 duration-150",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-4" }), " Save Calculation"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-border/60 self-start select-none",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => handleUnitSystemChange("ip"),
							className: `px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
							children: "Imperial (IP)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => handleUnitSystemChange("si"),
							className: `px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
							children: "Metric (SI)"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "lg:col-span-8 flex flex-col gap-5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-card border border-border rounded-2xl shadow-xs p-5 flex flex-col gap-5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex justify-between items-center pb-2 border-b border-border/60",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
											children: "Moisture Extraction Schedule"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-slate-50 dark:bg-slate-950/20 p-4 border border-border/80 rounded-xl flex gap-3 flex-wrap items-end text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex-1 min-w-[150px] flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-muted-foreground font-sans",
													children: "Unit Ref"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "text",
													placeholder: "e.g. AHU-2",
													value: newCoil.name,
													onChange: (e) => setNewCoil({
														...newCoil,
														name: e.target.value
													}),
													className: "bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "w-20 flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "font-semibold text-muted-foreground font-sans",
													children: [
														"On DB (",
														uTemp,
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													value: newCoil.dbIn,
													placeholder: ip ? "75.2" : "24.0",
													onChange: (e) => setNewCoil({
														...newCoil,
														dbIn: e.target.value === "" ? "" : Number(e.target.value)
													}),
													className: "bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "w-20 flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "font-semibold text-muted-foreground font-sans",
													children: [
														"On WB (",
														uTemp,
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													value: newCoil.wbIn,
													placeholder: ip ? "62.6" : "17.0",
													onChange: (e) => setNewCoil({
														...newCoil,
														wbIn: e.target.value === "" ? "" : Number(e.target.value)
													}),
													className: "bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "w-20 flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "font-semibold text-muted-foreground font-sans",
													children: [
														"Off DB (",
														uTemp,
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													value: newCoil.dbOut,
													placeholder: ip ? "57.2" : "14.0",
													onChange: (e) => setNewCoil({
														...newCoil,
														dbOut: e.target.value === "" ? "" : Number(e.target.value)
													}),
													className: "bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "w-20 flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "font-semibold text-muted-foreground font-sans",
													children: [
														"Off WB (",
														uTemp,
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													value: newCoil.wbOut,
													placeholder: ip ? "55.4" : "13.0",
													onChange: (e) => setNewCoil({
														...newCoil,
														wbOut: e.target.value === "" ? "" : Number(e.target.value)
													}),
													className: "bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "w-24 flex flex-col gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-muted-foreground font-sans",
													children: "Airflow"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													value: newCoil.flow,
													placeholder: ip ? "1000" : "500",
													onChange: (e) => setNewCoil({
														...newCoil,
														flow: e.target.value === "" ? "" : Number(e.target.value)
													}),
													className: "bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: handleAddCoil,
												className: "bg-[#0A7BC7] text-white px-4 py-2 font-bold rounded-lg hover:bg-[#06456F] cursor-pointer flex items-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add"]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "overflow-x-auto mt-2",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
											className: "w-full text-xs text-left border-collapse",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
												className: "border-b border-border/70 text-muted-foreground font-semibold",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "py-2.5",
														children: "Unit Ref"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "py-2.5",
														children: "Entering DB/WB"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "py-2.5",
														children: "Leaving DB/WB"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "py-2.5",
														children: "Air Flow"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "py-2.5",
														children: "W_in (kg/kg)"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "py-2.5",
														children: "W_out (kg/kg)"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
														className: "py-2.5 text-primary",
														children: [
															"Condensate (",
															ip ? "GPM" : "L/s",
															")"
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "py-2.5 text-center",
														children: "Action"
													})
												]
											}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
												className: "divide-y divide-border/40 font-mono",
												children: calculatedRows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "hover:bg-slate-50/50 dark:hover:bg-slate-900/10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "py-2.5 font-sans font-semibold text-[13px]",
															children: r.name
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
															className: "py-2.5 text-[13px]",
															children: [
																r.dbIn,
																"/",
																r.wbIn,
																" ",
																uTemp
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
															className: "py-2.5 text-[13px]",
															children: [
																r.dbOut,
																"/",
																r.wbOut,
																" ",
																uTemp
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
															className: "py-2.5 text-[13px]",
															children: [
																r.flow.toLocaleString(),
																" ",
																uFlow
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "py-2.5 text-[13px]",
															children: r.wIn.toFixed(6)
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "py-2.5 text-[13px]",
															children: r.wOut.toFixed(6)
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
															className: "py-2.5 text-[13px] font-bold text-primary",
															children: [
																ip ? lpsToGpm(r.condFlow).toFixed(5) : r.condFlow.toFixed(5),
																" ",
																ip ? "GPM" : "L/s"
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "py-2.5 text-center",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: () => handleDeleteCoil(r.id),
																className: "text-red-500 hover:text-red-700 transition cursor-pointer",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
															})
														})
													]
												}, r.id))
											})]
										})
									})
								]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "lg:col-span-4 flex flex-col gap-5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 pb-2 border-b border-border/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
										children: "Totals Summary"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-3.5 text-xs font-sans",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-1.5 border-b border-border/40",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-semibold text-muted-foreground",
											children: "Total Sized Airflow"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "font-bold text-foreground font-mono",
											children: [
												totals.totalFlow.toLocaleString(),
												" ",
												uFlow
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-semibold text-muted-foreground text-primary",
											children: "Total Condensate Flow"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "font-bold text-primary text-[15px] font-mono",
											children: [
												ip ? lpsToGpm(totals.totalCond).toFixed(4) : totals.totalCond.toFixed(4),
												" ",
												ip ? "GPM" : "L/s"
											]
										})]
									})]
								})]
							})
						})]
					})
				]
			})
		})
	});
}
//#endregion
export { CondensateDrainCalcPage as component };
