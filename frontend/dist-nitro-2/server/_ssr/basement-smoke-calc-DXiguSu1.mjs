import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Gt as PenLine, N as Plus, Ut as TriangleAlert, m as Trash2 } from "../_libs/lucide-react.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/basement-smoke-calc-DXiguSu1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function BasementSmokeCalcPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("si");
	const [floors, setFloors] = (0, import_react.useState)([]);
	const [newFloor, setNewFloor] = (0, import_react.useState)({
		name: "",
		area: 1200,
		effArea: 1e3,
		height: 3.5
	});
	const [fanSystems, setFanSystems] = (0, import_react.useState)([]);
	const [totalFans, setTotalFans] = (0, import_react.useState)(2);
	const [showFSModal, setShowFSModal] = (0, import_react.useState)(false);
	const [modalFSId, setModalFSId] = (0, import_react.useState)(null);
	const [modalFSName, setModalFSName] = (0, import_react.useState)("");
	const [modalFSType, setModalFSType] = (0, import_react.useState)("Extract");
	const [modalSelectedFloorIds, setModalSelectedFloorIds] = (0, import_react.useState)([]);
	const [modalError, setModalError] = (0, import_react.useState)("");
	const ip = unitSystem === "ip";
	(0, import_react.useEffect)(() => {
		try {
			const savedRows = localStorage.getItem("bs_rows");
			if (savedRows) setFloors(JSON.parse(savedRows));
			else setFloors([{
				id: "floor-1",
				name: "Basement 1",
				area: 1500,
				effArea: 1200,
				height: 3.5
			}, {
				id: "floor-2",
				name: "Basement 2",
				area: 1500,
				effArea: 1200,
				height: 3.5
			}]);
			const savedFans = localStorage.getItem("bs_fan_systems");
			if (savedFans) setFanSystems(JSON.parse(savedFans));
			else setFanSystems([{
				id: "fs-1",
				name: "Basement Extract System 1",
				floorIds: ["floor-1", "floor-2"],
				fanType: "Extract",
				length: 30,
				frictionFactor: 1.2,
				louver: 40,
				grille: 15,
				sa: 30,
				collapsed: false
			}]);
			const savedTotalFans = localStorage.getItem("bs_total_fans");
			if (savedTotalFans) setTotalFans(Number(savedTotalFans));
		} catch (e) {
			console.error("Failed to load basement smoke calc configurations", e);
			if (project?.id) setLoadedProjectId(project.id);
			else setLoadedProjectId("loaded");
		}
	}, []);
	(0, import_react.useEffect)(() => {
		if (floors.length > 0) {
			localStorage.setItem("bs_rows", JSON.stringify(floors));
			dirtyStore.set(true);
		}
	}, [floors]);
	(0, import_react.useEffect)(() => {
		if (fanSystems.length > 0) {
			localStorage.setItem("bs_fan_systems", JSON.stringify(fanSystems));
			dirtyStore.set(true);
		}
	}, [fanSystems]);
	(0, import_react.useEffect)(() => {
		localStorage.setItem("bs_total_fans", totalFans.toString());
		dirtyStore.set(true);
	}, [totalFans]);
	const handleUnitSystemChange = (unit) => {
		if (unit === unitSystem) return;
		setUnitSystem(unit);
		if (window.__mep_keep_values) return;
		const conv = unit === "ip" ? 10.7639 : 1 / 10.7639;
		const convH = unit === "ip" ? 3.28084 : 1 / 3.28084;
		setFloors(floors.map((f) => ({
			...f,
			area: Number((f.area * conv).toFixed(0)),
			effArea: Number((f.effArea * conv).toFixed(0)),
			height: Number((f.height * convH).toFixed(1))
		})));
		setNewFloor((prev) => ({
			...prev,
			area: Number((prev.area * conv).toFixed(0)),
			effArea: Number((prev.effArea * conv).toFixed(0)),
			height: Number((prev.height * convH).toFixed(1))
		}));
	};
	const calculatedRows = (0, import_react.useMemo)(() => {
		return floors.map((f) => {
			const vol = f.effArea * f.height;
			let f3 = 0, f6 = 0, f10 = 0;
			if (ip) {
				f3 = Math.ceil(vol * 3 / 60);
				f6 = Math.ceil(vol * 6 / 60);
				f10 = Math.ceil(vol * 10 / 60);
			} else {
				f3 = Math.ceil(vol * 3 / 3.6);
				f6 = Math.ceil(vol * 6 / 3.6);
				f10 = Math.ceil(vol * 10 / 3.6);
			}
			return {
				...f,
				volume: vol,
				flow3ach: f3,
				flow6ach: f6,
				flow10ach: f10
			};
		});
	}, [
		floors,
		ip,
		unitSystem
	]);
	const totals = (0, import_react.useMemo)(() => {
		const total3 = calculatedRows.reduce((a, b) => a + b.flow3ach, 0);
		const total6 = calculatedRows.reduce((a, b) => a + b.flow6ach, 0);
		const max10 = Math.max(...calculatedRows.map((r) => r.flow10ach), 0);
		return {
			total3,
			total6,
			max10,
			lowCap: Math.ceil(total3 / (totalFans || 1)),
			highCap: Math.ceil(Math.max(total6, max10) / (totalFans || 1))
		};
	}, [calculatedRows, totalFans]);
	const handleAddFloor = () => {
		if (!newFloor.name) return;
		const id = "floor-" + Date.now();
		setFloors([...floors, {
			...newFloor,
			id
		}]);
		setNewFloor({
			name: "",
			area: ip ? 12e3 : 1200,
			effArea: ip ? 1e4 : 1e3,
			height: ip ? 11.5 : 3.5
		});
	};
	const handleDeleteFloor = (id) => {
		setFloors(floors.filter((f) => f.id !== id));
		setFanSystems(fanSystems.map((fs) => ({
			...fs,
			floorIds: fs.floorIds.filter((fId) => fId !== id)
		})));
	};
	const handleOpenCreateFS = () => {
		setModalFSId(null);
		setModalFSName("");
		setModalFSType("Extract");
		setModalSelectedFloorIds([]);
		setModalError("");
		setShowFSModal(true);
	};
	const handleOpenEditFS = (fs) => {
		setModalFSId(fs.id);
		setModalFSName(fs.name);
		setModalFSType(fs.fanType);
		setModalSelectedFloorIds(fs.floorIds);
		setModalError("");
		setShowFSModal(true);
	};
	const handleSaveFanSystem = () => {
		if (!modalFSName.trim()) {
			setModalError("Please enter a Fan System Name.");
			return;
		}
		if (modalSelectedFloorIds.length === 0) {
			setModalError("Please select at least one floor to serve.");
			return;
		}
		if (modalFSId) setFanSystems(fanSystems.map((fs) => fs.id === modalFSId ? {
			...fs,
			name: modalFSName.trim(),
			fanType: modalFSType,
			floorIds: modalSelectedFloorIds
		} : fs));
		else {
			const newFS = {
				id: "fs-" + Date.now(),
				name: modalFSName.trim(),
				fanType: modalFSType,
				floorIds: modalSelectedFloorIds,
				length: 20,
				frictionFactor: 1.2,
				louver: 0,
				grille: 0,
				sa: 0,
				collapsed: false
			};
			setFanSystems([...fanSystems, newFS]);
		}
		setShowFSModal(false);
	};
	const calculatedFanSystems = (0, import_react.useMemo)(() => {
		return fanSystems.map((fs) => {
			const fittings = fs.length * .6;
			const eqLen = fs.length + fittings;
			const frictionLoss = eqLen * fs.frictionFactor;
			const safety = (frictionLoss + fs.louver + fs.grille + fs.sa) * .1;
			const totalStatic = Math.round((frictionLoss + fs.louver + fs.grille + fs.sa + safety) / 10) * 10;
			const servedFloors = calculatedRows.filter((r) => fs.floorIds.includes(r.id));
			let flow3 = servedFloors.reduce((a, b) => a + b.flow3ach, 0);
			let flow6 = servedFloors.reduce((a, b) => a + b.flow6ach, 0);
			let flow10Max = Math.max(...servedFloors.map((r) => r.flow10ach), 0);
			let lowCap = Math.ceil(flow3 / (totalFans || 1));
			let highCap = Math.ceil(Math.max(flow6, flow10Max) / (totalFans || 1));
			if (fs.fanType === "Makeup") {
				flow3 = Math.round(flow3 * .85);
				flow6 = Math.round(flow6 * .85);
				flow10Max = Math.round(flow10Max * .85);
				lowCap = Math.round(lowCap * .85);
				highCap = Math.round(highCap * .85);
			}
			return {
				...fs,
				fittings,
				eqLen,
				frictionLoss,
				safety,
				totalStatic,
				flow3,
				flow6,
				flow10Max,
				lowCap,
				highCap,
				servedFloors
			};
		});
	}, [
		fanSystems,
		calculatedRows,
		totalFans
	]);
	const assignedFloorsMap = (0, import_react.useMemo)(() => {
		const map = {};
		fanSystems.forEach((fs) => {
			if (fs.id !== modalFSId && fs.fanType === modalFSType) fs.floorIds.forEach((id) => {
				map[id] = fs.name;
			});
		});
		return map;
	}, [
		fanSystems,
		modalFSId,
		modalFSType
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Basement Smoke Calc",
		hideSubHeader: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-full min-h-0 bg-transparent font-sans",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1 select-none",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
								children: "SMOKE MANAGEMENT > BASEMENT VENTILATION"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
								children: "Basement Smoke Extract Schedule"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground mt-0.5",
								children: "Formulate car park ventilating schedule calculations (3, 6, and 10 ACH) and head losses for extract/makeup fan systems."
							})
						]
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
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "lg:col-span-8 flex flex-col gap-5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl shadow-xs p-5 flex flex-col gap-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex justify-between items-center pb-2 border-b border-border/60",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
												children: "Basement Level Schedule"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "bg-slate-50 dark:bg-slate-950/20 p-4 border border-border/80 rounded-xl flex gap-3 flex-wrap items-end text-xs",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex-1 min-w-[120px] flex flex-col gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "font-semibold text-muted-foreground",
														children: "Floor Name"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "text",
														placeholder: "e.g. B3",
														value: newFloor.name,
														onChange: (e) => setNewFloor({
															...newFloor,
															name: e.target.value
														}),
														className: "bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "w-24 flex flex-col gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "font-semibold text-muted-foreground",
														children: "Gross Area"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														value: newFloor.area,
														onChange: (e) => setNewFloor({
															...newFloor,
															area: Number(e.target.value)
														}),
														className: "bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "w-24 flex flex-col gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "font-semibold text-muted-foreground",
														children: "Eff. Area"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														value: newFloor.effArea,
														onChange: (e) => setNewFloor({
															...newFloor,
															effArea: Number(e.target.value)
														}),
														className: "bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "w-20 flex flex-col gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "font-semibold text-muted-foreground",
														children: "Height"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														step: "0.1",
														value: newFloor.height,
														onChange: (e) => setNewFloor({
															...newFloor,
															height: Number(e.target.value)
														}),
														className: "bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7]"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													onClick: handleAddFloor,
													className: "bg-[#0A7BC7] text-white px-4 py-2 font-bold rounded-lg hover:bg-[#06456F] cursor-pointer flex items-center gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add"]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "overflow-x-auto",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
												className: "w-full text-xs text-left border-collapse",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "border-b border-border/70 text-muted-foreground font-semibold",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "py-2.5",
															children: "Level Name"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "py-2.5",
															children: "Gross Area"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "py-2.5",
															children: "Eff. Area"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "py-2.5",
															children: "Height"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "py-2.5",
															children: "3 ACH (Normal)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "py-2.5",
															children: "6 ACH (Max Normal)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "py-2.5 text-primary",
															children: "10 ACH (Fire)"
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
																className: "py-2.5 font-sans font-semibold",
																children: r.name
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																className: "py-2.5",
																children: [
																	r.area,
																	" ",
																	ip ? "ft²" : "m²"
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																className: "py-2.5",
																children: [
																	r.effArea,
																	" ",
																	ip ? "ft²" : "m²"
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																className: "py-2.5",
																children: [
																	r.height,
																	" ",
																	ip ? "ft" : "m"
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 font-semibold text-slate-700 dark:text-slate-300",
																children: r.flow3ach.toLocaleString()
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5",
																children: r.flow6ach.toLocaleString()
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 font-bold text-primary",
																children: r.flow10ach.toLocaleString()
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																	onClick: () => handleDeleteFloor(r.id),
																	className: "text-red-500 hover:text-red-700 transition cursor-pointer",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4 animate-scale" })
																})
															})
														]
													}, r.id))
												})]
											})
										})
									]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "lg:col-span-4 flex flex-col gap-5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 pb-2 border-b border-border/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
											children: "Global Fan Sizing"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-3.5 text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Total Fan Qty Sized"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: "1",
												step: "1",
												value: totalFans,
												onChange: (e) => setTotalFans(Number(e.target.value)),
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[#0A7BC7]"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-2 gap-3 font-sans mt-2 pt-2 border-t border-border/60",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] text-muted-foreground block font-bold uppercase",
													children: "Total 3 ACH Flow"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "text-sm font-bold text-foreground font-mono",
													children: [
														totals.total3.toLocaleString(),
														" ",
														ip ? "CFM" : "L/s"
													]
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] text-primary block font-bold uppercase",
													children: "Max 10 ACH Flow"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "text-sm font-bold text-primary font-mono",
													children: [
														totals.max10.toLocaleString(),
														" ",
														ip ? "CFM" : "L/s"
													]
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "col-span-2 pt-2 border-t border-border/40",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] text-muted-foreground block font-bold uppercase",
														children: "Low Speed Capacity / Fan"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-base font-bold text-foreground font-mono",
														children: [
															totals.lowCap.toLocaleString(),
															" ",
															ip ? "CFM" : "L/s"
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "col-span-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] text-primary block font-bold uppercase",
														children: "High Speed Capacity / Fan"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "text-base font-bold text-primary font-mono",
														children: [
															totals.highCap.toLocaleString(),
															" ",
															ip ? "CFM" : "L/s"
														]
													})]
												})
											]
										})]
									})]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-12 flex flex-col gap-4",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl shadow-xs p-5 flex flex-col gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center pb-2 border-b border-border/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
												children: "Fan Systems Head Loss Calculations"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
											onClick: handleOpenCreateFS,
											className: "h-8.5 text-xs",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Create Fan System"]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "grid grid-cols-1 md:grid-cols-2 gap-6",
										children: calculatedFanSystems.map((fs) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border/75 rounded-2xl bg-slate-50/30 dark:bg-slate-900/10 flex flex-col overflow-hidden shadow-xs",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												onClick: () => setFanSystems(fanSystems.map((x) => x.id === fs.id ? {
													...x,
													collapsed: !x.collapsed
												} : x)),
												className: "flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/40 p-4 border-b border-border/70 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/60 select-none transition",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2 flex-wrap max-w-[80%]",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: `text-[10px] text-muted-foreground transition duration-200 block ${fs.collapsed ? "-rotate-90" : ""}`,
															children: "▼"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
															className: "text-xs text-foreground font-sans font-bold",
															children: fs.name
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[9.5px] px-2 py-0.5 bg-primary/10 text-primary font-bold rounded-full uppercase",
															children: [fs.fanType, " System"]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "flex items-center gap-1.5 ml-2",
															children: fs.servedFloors.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[10px] bg-slate-200/50 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded-md",
																children: f.name
															}, f.id))
														})
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex gap-1.5 items-center",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
														onClick: (e) => {
															e.stopPropagation();
															handleOpenEditFS(fs);
														},
														className: "bg-transparent text-primary hover:bg-primary/10 font-bold px-2 py-1 rounded text-[11px] flex items-center gap-1 transition cursor-pointer",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3" }), " Edit"]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
														onClick: (e) => {
															e.stopPropagation();
															setFanSystems(fanSystems.filter((x) => x.id !== fs.id));
														},
														className: "bg-transparent text-red-500 hover:bg-red-500/10 font-bold px-2 py-1 rounded text-[11px] flex items-center gap-1 transition cursor-pointer",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3" }), " Delete"]
													})]
												})]
											}), !fs.collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "p-5 flex flex-col gap-4",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "grid grid-cols-5 gap-2 select-none",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "bg-slate-100/30 dark:bg-slate-900/30 border border-border/80 rounded-xl p-2.5 flex flex-col justify-between shadow-xs",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[9px] font-bold text-muted-foreground uppercase tracking-wider block",
																	children: "3 ACH Total"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																	className: "text-[12px] font-bold text-primary font-mono mt-1 block",
																	children: [
																		fs.flow3.toLocaleString(),
																		" ",
																		ip ? "CFM" : "L/s"
																	]
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "bg-slate-100/30 dark:bg-slate-900/30 border border-border/80 rounded-xl p-2.5 flex flex-col justify-between shadow-xs",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[9px] font-bold text-muted-foreground uppercase tracking-wider block",
																	children: "6 ACH Total"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																	className: "text-[12px] font-bold text-primary font-mono mt-1 block",
																	children: [
																		fs.flow6.toLocaleString(),
																		" ",
																		ip ? "CFM" : "L/s"
																	]
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "bg-slate-100/30 dark:bg-slate-900/30 border border-border/80 rounded-xl p-2.5 flex flex-col justify-between shadow-xs",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[9px] font-bold text-muted-foreground uppercase tracking-wider block",
																	children: "10 ACH Max"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																	className: "text-[12px] font-bold text-red-500 font-mono mt-1 block",
																	children: [
																		fs.flow10Max.toLocaleString(),
																		" ",
																		ip ? "CFM" : "L/s"
																	]
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex flex-col justify-between shadow-xs",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[9px] font-bold text-primary uppercase tracking-wider block",
																	children: "Low Speed"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																	className: "text-[12px] font-bold text-primary font-mono mt-1 block",
																	children: [
																		fs.lowCap.toLocaleString(),
																		" ",
																		ip ? "CFM" : "L/s"
																	]
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "bg-red-500/5 border border-red-500/10 rounded-xl p-2.5 flex flex-col justify-between shadow-xs",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[9px] font-bold text-red-500 uppercase tracking-wider block",
																	children: "High Speed"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																	className: "text-[12px] font-bold text-red-500 font-mono mt-1 block",
																	children: [
																		fs.highCap.toLocaleString(),
																		" ",
																		ip ? "CFM" : "L/s"
																	]
																})]
															})
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex justify-between items-center bg-slate-100/30 dark:bg-slate-900/30 border border-border rounded-xl px-4 py-2.5 text-xs select-none",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-bold text-muted-foreground uppercase tracking-wider text-[10px]",
															children: "Design Friction Rate"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Friction Factor:" }),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																	type: "number",
																	step: "0.1",
																	value: fs.frictionFactor,
																	onChange: (e) => {
																		const val = Number(e.target.value);
																		setFanSystems(fanSystems.map((x) => x.id === fs.id ? {
																			...x,
																			frictionFactor: val
																		} : x));
																	},
																	className: "w-12 bg-transparent text-primary font-bold text-center border-b border-primary/50 outline-none"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Pa/m of ducting" })
															]
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "grid grid-cols-2 gap-5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-2.5 text-xs",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																	className: "font-bold text-[#64748b] border-b border-border pb-1.5 uppercase tracking-wider text-[10px]",
																	children: "Ductwork Inputs"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "flex flex-col gap-1",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																		className: "font-semibold text-muted-foreground",
																		children: "Duct Length (m)"
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																		type: "number",
																		value: fs.length,
																		onChange: (e) => {
																			const val = Number(e.target.value);
																			setFanSystems(fanSystems.map((x) => x.id === fs.id ? {
																				...x,
																				length: val
																			} : x));
																		},
																		className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
																	})]
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "flex flex-col gap-1",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																		className: "font-semibold text-muted-foreground",
																		children: "Losses in Louver (Pa)"
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																		type: "number",
																		value: fs.louver,
																		onChange: (e) => {
																			const val = Number(e.target.value);
																			setFanSystems(fanSystems.map((x) => x.id === fs.id ? {
																				...x,
																				louver: val
																			} : x));
																		},
																		className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
																	})]
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "flex flex-col gap-1",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																		className: "font-semibold text-muted-foreground",
																		children: "Losses in Grille (Pa)"
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																		type: "number",
																		value: fs.grille,
																		onChange: (e) => {
																			const val = Number(e.target.value);
																			setFanSystems(fanSystems.map((x) => x.id === fs.id ? {
																				...x,
																				grille: val
																			} : x));
																		},
																		className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
																	})]
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "flex flex-col gap-1",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																		className: "font-semibold text-muted-foreground",
																		children: "Losses in SAs (Pa)"
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																		type: "number",
																		value: fs.sa,
																		onChange: (e) => {
																			const val = Number(e.target.value);
																			setFanSystems(fanSystems.map((x) => x.id === fs.id ? {
																				...x,
																				sa: val
																			} : x));
																		},
																		className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
																	})]
																})
															]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-2.5 text-xs",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "font-bold text-[#64748b] border-b border-border pb-1.5 uppercase tracking-wider text-[10px]",
																children: "Calculated Results"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "bg-slate-100/20 dark:bg-slate-900/10 border border-border rounded-xl p-3 flex flex-col gap-2 font-sans",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																		className: "flex justify-between items-center py-1 border-b border-border/40",
																		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																			className: "font-semibold text-muted-foreground",
																			children: "Fittings in Ducting"
																		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																			className: "font-bold text-foreground font-mono",
																			children: [fs.fittings.toFixed(1), " m"]
																		})]
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																		className: "flex justify-between items-center py-1 border-b border-border/40",
																		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																			className: "font-semibold text-muted-foreground",
																			children: "Equivalent Length"
																		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																			className: "font-bold text-foreground font-mono",
																			children: [fs.eqLen.toFixed(1), " m"]
																		})]
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																		className: "flex justify-between items-center py-1 border-b border-border/40",
																		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																			className: "font-semibold text-muted-foreground",
																			children: "Frictional Losses"
																		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																			className: "font-bold text-foreground font-mono",
																			children: [fs.frictionLoss.toFixed(2), " Pa"]
																		})]
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																		className: "flex justify-between items-center py-1 border-b border-border/40",
																		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																			className: "font-semibold text-muted-foreground",
																			children: "Safety Overhead (10%)"
																		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																			className: "font-bold text-foreground font-mono",
																			children: [fs.safety.toFixed(2), " Pa"]
																		})]
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																		className: "flex justify-between items-center pt-1 text-[#0A7BC7]",
																		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																			className: "font-bold",
																			children: "Total Static Sized"
																		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																			className: "font-bold text-sm font-mono",
																			children: [fs.totalStatic, " Pa"]
																		})]
																	})
																]
															})]
														})]
													})
												]
											})]
										}, fs.id))
									})]
								})
							})
						]
					})
				]
			})
		}), showFSModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-fade-in",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "font-bold text-base text-foreground",
						children: modalFSId ? "Edit Fan System" : "Create Fan System"
					}),
					modalError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 rounded-lg p-2.5 text-xs flex items-center gap-2 select-none",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 text-red-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: modalError })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-3.5 text-xs font-sans",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "font-semibold text-foreground",
									children: "System Name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: modalFSName,
									onChange: (e) => setModalFSName(e.target.value),
									placeholder: "e.g. SF-1 Extract",
									className: "bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "font-semibold text-foreground",
									children: "System Type"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: modalFSType,
									onChange: (e) => setModalFSType(e.target.value),
									className: "bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "Extract",
										children: "Smoke Extract Fan"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "Makeup",
										children: "Makeup Air Fan"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "font-semibold text-foreground",
									children: "Associate Floor Levels"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "border border-border/80 rounded-lg p-1.5 bg-background max-h-36 overflow-y-auto flex flex-col gap-1 select-none",
									children: floors.map((f) => {
										const checked = modalSelectedFloorIds.includes(f.id);
										const assignedTo = assignedFloorsMap[f.id];
										const isDisabled = !!assignedTo;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: `flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold cursor-pointer ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`,
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked,
													disabled: isDisabled,
													onChange: () => {
														if (isDisabled) return;
														setModalSelectedFloorIds(checked ? modalSelectedFloorIds.filter((id) => id !== f.id) : [...modalSelectedFloorIds, f.id]);
													}
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "flex-1 text-foreground",
													children: f.name
												}),
												assignedTo && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[10px] text-red-500 font-bold",
													children: ["Assigned to ", assignedTo]
												})
											]
										}, f.id);
									})
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-end gap-2.5 mt-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setShowFSModal(false),
							className: "px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer",
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: handleSaveFanSystem,
							className: "px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer",
							children: modalFSId ? "Save Changes" : "Create System"
						})]
					})
				]
			})
		})]
	});
}
//#endregion
export { BasementSmokeCalcPage as component };
