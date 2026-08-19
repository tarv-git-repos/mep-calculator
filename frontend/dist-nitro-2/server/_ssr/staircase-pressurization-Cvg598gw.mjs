import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, Et as ChevronUp, Ot as ChevronDown, at as FolderOpen, m as Trash2, nn as CircleQuestionMark } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-Blf5aT0O.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/staircase-pressurization-Cvg598gw.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function StaircasePressurizationPage() {
	const [doorWidth, setDoorWidth] = (0, import_react.useState)("");
	const [doorHeight, setDoorHeight] = (0, import_react.useState)("");
	const [leakageRate, setLeakageRate] = (0, import_react.useState)("");
	const [closedDoors, setClosedDoors] = (0, import_react.useState)("");
	const [hasCalculated, setHasCalculated] = (0, import_react.useState)(true);
	const [showDetailedCalcs, setShowDetailedCalcs] = (0, import_react.useState)(true);
	const [saves, setSaves] = (0, import_react.useState)([]);
	const [showSaveModal, setShowSaveModal] = (0, import_react.useState)(false);
	const [showLoadModal, setShowLoadModal] = (0, import_react.useState)(false);
	const [saveName, setSaveName] = (0, import_react.useState)("");
	const { project, forceSaveToCloud } = useWorkspace();
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (project?.id) {
			try {
				const stored = localStorage.getItem(`staircase_press_state_${project.id}`);
				if (stored) {
					const data = JSON.parse(stored);
					if (data.doorWidth !== void 0) setDoorWidth(data.doorWidth);
					if (data.doorHeight !== void 0) setDoorHeight(data.doorHeight);
					if (data.leakageRate !== void 0) setLeakageRate(data.leakageRate);
					if (data.closedDoors !== void 0) setClosedDoors(data.closedDoors);
				}
			} catch (e) {
				console.error(e);
			}
			setLoadedProjectId(project.id);
		}
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				doorWidth,
				doorHeight,
				leakageRate,
				closedDoors
			};
			localStorage.setItem(`staircase_press_state_${project.id}`, JSON.stringify(dataToSave));
		}
	}, [
		project?.id,
		loadedProjectId,
		doorWidth,
		doorHeight,
		leakageRate,
		closedDoors
	]);
	(0, import_react.useEffect)(() => {
		try {
			const stored = localStorage.getItem("mep_custom_calculator_saves");
			if (stored) setSaves(JSON.parse(stored));
		} catch (e) {
			console.error("Failed to load custom saves", e);
		}
	}, []);
	const saveToLocalStorage = (newSaves) => {
		setSaves(newSaves);
		localStorage.setItem("mep_custom_calculator_saves", JSON.stringify(newSaves));
	};
	const handleSaveCurrent = () => {
		if (!saveName.trim()) return;
		saveToLocalStorage([{
			id: Date.now().toString(),
			type: "Staircase Pressurization",
			name: saveName.trim(),
			savedAt: (/* @__PURE__ */ new Date()).toLocaleDateString(),
			values: {
				"sp-door-width": doorWidth,
				"sp-door-height": doorHeight,
				"sp-air-leakage": leakageRate,
				"sp-closed-doors": closedDoors
			}
		}, ...saves]);
		setSaveName("");
		setShowSaveModal(false);
		forceSaveToCloud();
	};
	const handleLoadSave = (id) => {
		const target = saves.find((s) => s.id === id);
		if (!target) return;
		const v = target.values;
		if (v["sp-door-width"] !== void 0) setDoorWidth(Number(v["sp-door-width"]));
		if (v["sp-door-height"] !== void 0) setDoorHeight(Number(v["sp-door-height"]));
		if (v["sp-air-leakage"] !== void 0) setLeakageRate(Number(v["sp-air-leakage"]));
		if (v["sp-closed-doors"] !== void 0) setClosedDoors(Number(v["sp-closed-doors"]));
		setShowLoadModal(false);
	};
	const handleDeleteSave = (id, e) => {
		e.stopPropagation();
		saveToLocalStorage(saves.filter((s) => s.id !== id));
	};
	const calculatedData = (0, import_react.useMemo)(() => {
		const wVal = doorWidth !== "" ? Number(doorWidth) : 1;
		const hVal = doorHeight !== "" ? Number(doorHeight) : 2.1;
		const leakVal = leakageRate !== "" ? Number(leakageRate) : .03;
		const closedVal = closedDoors !== "" ? Number(closedDoors) : 19;
		const doorArea = wVal * hVal;
		const openDoors = 2;
		const egressVelocity = 1;
		const safetyFactor = .15;
		const openFlow = doorArea * egressVelocity * openDoors;
		const closedFlow = leakVal * closedVal;
		const safetyFlow = closedFlow * safetyFactor;
		return {
			doorArea,
			openFlow,
			closedFlow,
			safetyFlow,
			totalVol: openFlow + closedFlow + safetyFlow
		};
	}, [
		doorWidth,
		doorHeight,
		leakageRate,
		closedDoors
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Staircase Pressurization",
		hideSubHeader: true,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex h-full min-h-0 bg-transparent font-sans",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1 select-none",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
								children: "SMOKE MANAGEMENT > STAIRCASE PRESSURIZATION"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-4 mt-0.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "text-[28px] font-bold tracking-tight text-foreground",
									children: "Staircase Pressurization Calculator"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-border/80 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-semibold text-muted-foreground px-2",
											children: "💾 Calculation Files:"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => setShowSaveModal(true),
											className: "bg-primary text-primary-foreground font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition hover:bg-primary/90 cursor-pointer",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-3.5" }), " Save Current"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => setShowLoadModal(true),
											className: "bg-primary/10 hover:bg-primary/20 text-primary font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "size-3.5" }), " Load Saved"]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground mt-0.5",
								children: "Calculate the required air supply volume for staircase containment systems to resist smoke ingress during fire evacuations."
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "lg:col-span-5 flex flex-col gap-5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 pb-2 border-b border-border/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
										children: "Design Parameters"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-3.5 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Door Width (m)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: doorWidth,
												onChange: (e) => setDoorWidth(e.target.value === "" ? "" : Number(e.target.value)),
												placeholder: "1.0",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Door Height (m)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: doorHeight,
												onChange: (e) => setDoorHeight(e.target.value === "" ? "" : Number(e.target.value)),
												placeholder: "2.1",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Air Leakage rate at 12.5 Pa (m³/s)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: leakageRate,
												onChange: (e) => setLeakageRate(e.target.value === "" ? "" : Number(e.target.value)),
												placeholder: "0.03",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "font-semibold text-foreground",
												children: "Number of Closed Doors"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: "1",
												step: "1",
												value: closedDoors,
												onChange: (e) => setClosedDoors(e.target.value === "" ? "" : Number(e.target.value)),
												placeholder: "19",
												className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
											})]
										})
									]
								})]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "lg:col-span-7 flex flex-col gap-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 pb-2 border-b border-border/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
											children: "Calculation Results"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Door Area"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [calculatedData.doorArea.toFixed(4), " m²"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Open Door Flow"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [calculatedData.openFlow.toFixed(4), " m³/s"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Closed Door Flow"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [calculatedData.closedFlow.toFixed(4), " m³/s"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Safety Flow (15%)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [calculatedData.safetyFlow.toFixed(4), " m³/s"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Total Air Volume Required"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-[#0A7BC7] text-[15px] font-mono",
													children: [calculatedData.totalVol.toFixed(4), " m³/s"]
												})]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl shadow-xs overflow-hidden",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => setShowDetailedCalcs(!showDetailedCalcs),
										className: "w-full flex items-center justify-between p-5 font-bold text-xs uppercase tracking-wider text-muted-foreground font-sans hover:bg-slate-50 dark:hover:bg-slate-900/40 select-none cursor-pointer",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "size-4 text-primary" }), " Σ Detailed Calculations Steps"]
										}), showDetailedCalcs ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4" })]
									}), showDetailedCalcs && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-5 pt-0 border-t border-border/40 text-xs font-sans flex flex-col gap-4 max-h-[350px] overflow-y-auto",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-3 items-start border-b border-border/40 pb-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
													children: "1"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-bold text-foreground",
														children: "Step 1: Door Area"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-mono text-primary my-1",
														children: "Door Area = Door Width × Door Height"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-mono text-[10.5px] text-muted-foreground",
														children: [
															"Door Area = ",
															doorWidth,
															" m × ",
															doorHeight,
															" m"
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-bold text-[11px] text-foreground mt-0.5",
														children: [calculatedData.doorArea.toFixed(4), " m²"]
													})
												] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-3 items-start border-b border-border/40 pb-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
													children: "2"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-bold text-foreground",
														children: "Step 2: Open Door Flow"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-mono text-primary my-1",
														children: "Open Door Flow = Door Area × Egress Velocity × Number of Open Doors"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-mono text-[10.5px] text-muted-foreground",
														children: [
															"Open Door Flow = ",
															calculatedData.doorArea.toFixed(4),
															" m² × 1 m/s × 2"
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-bold text-[11px] text-foreground mt-0.5",
														children: [calculatedData.openFlow.toFixed(4), " m³/s"]
													})
												] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-3 items-start border-b border-border/40 pb-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
													children: "3"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-bold text-foreground",
														children: "Step 3: Closed Door Flow"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-mono text-primary my-1",
														children: "Closed Door Flow = Air Leakage × Number of Closed Doors"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-mono text-[10.5px] text-muted-foreground",
														children: [
															"Closed Door Flow = ",
															(Number(leakageRate) || .03).toFixed(4),
															" m³/s × ",
															closedDoors || 19
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-bold text-[11px] text-foreground mt-0.5",
														children: [calculatedData.closedFlow.toFixed(4), " m³/s"]
													})
												] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-3 items-start border-b border-border/40 pb-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
													children: "4"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-bold text-foreground",
														children: "Step 4: Safety Flow"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-mono text-primary my-1",
														children: "Safety Flow = Closed Door Flow × Safety Factor (15%)"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-mono text-[10.5px] text-muted-foreground",
														children: [
															"Safety Flow = ",
															calculatedData.closedFlow.toFixed(4),
															" m³/s × 0.15"
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-bold text-[11px] text-foreground mt-0.5",
														children: [calculatedData.safetyFlow.toFixed(4), " m³/s"]
													})
												] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-3 items-start",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
													children: "5"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-bold text-foreground",
														children: "Step 5: Total Air Volume"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-mono text-primary my-1",
														children: "Total Air Volume = Open Door Flow + Closed Door Flow + Safety Flow"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-mono text-[10.5px] text-muted-foreground",
														children: [
															"Total = ",
															calculatedData.openFlow.toFixed(4),
															" + ",
															calculatedData.closedFlow.toFixed(4),
															" + ",
															calculatedData.safetyFlow.toFixed(4)
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-bold text-[11px] text-[#0A7BC7] mt-0.5",
														children: [calculatedData.totalVol.toFixed(4), " m³/s"]
													})
												] })]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl p-4 text-xs text-muted-foreground leading-relaxed",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-semibold text-foreground mb-1",
										children: "Standard Reference & Assumptions:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
										className: "list-disc pl-4 space-y-1.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Complies with NFPA 92 / BS EN 12101-6 standard design rules." }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Assumes an egress velocity through open doors of exactly 1.0 m/s." }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Assumes 2 open doors during active occupant escape." }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "A 15% safety factor is applied to closed door leakage calculations to account for construction leakage tolerances." })
										]
									})]
								})
							]
						})]
					})]
				})
			}),
			showSaveModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-bold text-base text-foreground",
							children: "Save Current Staircase Pressurization"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-1.5 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "font-semibold text-muted-foreground",
								children: "Calculation Name"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: saveName,
								onChange: (e) => setSaveName(e.target.value),
								placeholder: "e.g. West Staircase Main",
								className: "bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex justify-end gap-2.5 mt-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setShowSaveModal(false),
								className: "px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleSaveCurrent,
								className: "px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg text-xs transition hover:bg-primary/95 cursor-pointer",
								children: "Save"
							})]
						})
					]
				})
			}),
			showLoadModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-card border border-border rounded-2xl w-full max-w-lg p-6 flex flex-col gap-4 shadow-2xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-bold text-base text-foreground",
							children: "Load Saved Calculations"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-col gap-2 max-h-96 overflow-y-auto pr-1",
							children: saves.filter((s) => s.type === "stair-press").length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-center py-6 text-muted-foreground text-xs",
								children: "📭 No saved calculations found."
							}) : saves.filter((s) => s.type === "stair-press").map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								onClick: () => handleLoadSave(s.id),
								className: "border border-border/70 rounded-xl p-3.5 hover:border-primary/50 transition cursor-pointer bg-slate-50/20 dark:bg-slate-900/10 flex justify-between items-center gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-xs text-foreground block truncate",
											children: s.name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[10px] text-muted-foreground font-mono mt-0.5 block",
											children: [
												"Doors Closed: ",
												s.values["sp-closed-doors"],
												" · Door Size: ",
												s.values["sp-door-width"],
												"m × ",
												s.values["sp-door-height"],
												"m"
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[9.5px] text-muted-foreground/80 mt-1 block",
											children: ["Saved: ", new Date(s.savedAt).toLocaleString()]
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: (e) => handleDeleteSave(s.id, e),
									className: "text-muted-foreground hover:text-red-500 transition p-2 cursor-pointer",
									title: "Delete Save",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
								})]
							}, s.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex justify-end mt-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setShowLoadModal(false),
								className: "px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer",
								children: "Close"
							})
						})
					]
				})
			})
		]
	});
}
//#endregion
export { StaircasePressurizationPage as component };
