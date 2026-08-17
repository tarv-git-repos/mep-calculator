import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-Ct3ePlL1.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, Y as Info, m as Trash2 } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-urg-0zDa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-loading-unit-DplpTB3g.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var IP_FIXTURE_UNITS = {
	wc: {
		low: 1,
		med: 2,
		high: 5
	},
	urinal: {
		low: 1,
		med: 1,
		high: 1
	},
	basin: {
		low: 1,
		med: 2,
		high: 4
	},
	bidet: {
		low: 1,
		med: 1,
		high: 1
	},
	handspray: {
		low: 1,
		med: 1,
		high: 1
	},
	bath: {
		low: 4,
		med: 8,
		high: 16
	},
	shower: {
		low: 2,
		med: 3,
		high: 6
	},
	sink: {
		low: 2,
		med: 5,
		high: 10
	},
	bibtap: {
		low: 1,
		med: 1,
		high: 1
	},
	washingmachine: {
		low: 2,
		med: 2,
		high: 2
	},
	dishwasher: {
		low: 2,
		med: 2,
		high: 2
	}
};
var LU_FIXTURES_META = [
	{
		id: "wc",
		short: "WC"
	},
	{
		id: "urinal",
		short: "Urinal"
	},
	{
		id: "basin",
		short: "Basin"
	},
	{
		id: "bidet",
		short: "Bidet"
	},
	{
		id: "handspray",
		short: "Spray"
	},
	{
		id: "bath",
		short: "Bath"
	},
	{
		id: "shower",
		short: "Shower"
	},
	{
		id: "sink",
		short: "Sink"
	},
	{
		id: "bibtap",
		short: "BibTap"
	},
	{
		id: "washingmachine",
		short: "Washer"
	},
	{
		id: "dishwasher",
		short: "Dishwasher"
	}
];
function huntersCurve(fu) {
	const t = [
		[1, 1],
		[2, 1.5],
		[3, 2],
		[5, 3],
		[6, 3.5],
		[10, 5.5],
		[12, 6],
		[20, 9],
		[30, 12],
		[50, 18],
		[75, 24],
		[100, 29],
		[150, 38],
		[200, 45],
		[300, 57],
		[400, 66],
		[500, 73],
		[600, 79],
		[750, 87],
		[1e3, 98],
		[1500, 114],
		[2e3, 127]
	];
	if (fu <= 0) return 0;
	for (let i = 0; i < t.length - 1; i++) if (fu >= t[i][0] && fu < t[i + 1][0]) return t[i][1] + (t[i + 1][1] - t[i][1]) * (fu - t[i][0]) / (t[i + 1][0] - t[i][0]);
	return fu >= 2e3 ? 127 + (fu - 2e3) * .03 : 0;
}
function extractFloorFU(name) {
	const match = name.match(/^([0-9]|B|G|LG|UG|SF|RF|M|P)[FLfli]?/i);
	return match ? match[0].toUpperCase().replace(/L$/i, "F") : "G";
}
function LoadingUnitPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("si");
	const [iopSpaces, setIopSpaces] = (0, import_react.useState)([]);
	const [newDesc, setNewDesc] = (0, import_react.useState)("");
	const [newFixtures, setNewFixtures] = (0, import_react.useState)({});
	const [globalBuildingType, setGlobalBuildingType] = (0, import_react.useState)("med");
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (project?.id) {
			try {
				const stored = localStorage.getItem(`mep_loading_unit_calc_${project.id}`);
				if (stored) {
					const data = JSON.parse(stored);
					if (data.unitSystem) setUnitSystem(data.unitSystem);
					if (data.iopSpaces) setIopSpaces(data.iopSpaces);
					if (data.globalBuildingType) setGlobalBuildingType(data.globalBuildingType);
				} else {
					setUnitSystem("si");
					setIopSpaces([{
						id: 1,
						desc: "Office Washroom A",
						floor: "G",
						std: "med",
						fixtures: {
							wc: 3,
							basin: 2,
							urinal: 2
						}
					}]);
					setGlobalBuildingType("med");
				}
				setTimeout(() => dirtyStore.set(false), 50);
			} catch (e) {
				console.error("Failed to load loading unit calculation", e);
			}
			setLoadedProjectId(project.id);
		}
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				unitSystem,
				iopSpaces,
				globalBuildingType
			};
			localStorage.setItem(`mep_loading_unit_calc_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		unitSystem,
		iopSpaces,
		globalBuildingType
	]);
	const handleSaveCurrent = () => {
		try {
			if (project?.id) {
				const dataToSave = {
					unitSystem,
					iopSpaces,
					globalBuildingType
				};
				localStorage.setItem(`mep_loading_unit_calc_${project.id}`, JSON.stringify(dataToSave));
				dirtyStore.set(false);
				if (forceSaveToCloud) forceSaveToCloud();
				toast.success("Loading Unit Calculation saved to project successfully!");
			}
		} catch (e) {
			toast.error("Failed to save calculation.");
		}
	};
	const ip = unitSystem === "ip";
	const calculations = (0, import_react.useMemo)(() => {
		let totalLU = 0;
		const spaceTotals = {};
		const breakdown = [];
		iopSpaces.forEach((s) => {
			let spaceLU = 0;
			const spaceStd = s.std;
			LU_FIXTURES_META.forEach((f) => {
				const qty = s.fixtures[f.id] || 0;
				if (qty > 0) {
					const unitLU = IP_FIXTURE_UNITS[f.id][spaceStd] || 0;
					spaceLU += qty * unitLU;
				}
			});
			spaceTotals[s.id] = spaceLU;
			totalLU += spaceLU;
			if (spaceLU > 0) breakdown.push(`sm${s.desc} [${spaceStd.toUpperCase()}]: ${spaceLU.toFixed(1)} L.U`);
		});
		const flowGPM = huntersCurve(totalLU);
		const flowLPS = flowGPM * .06309;
		return {
			totalLU,
			spaceTotals,
			breakdown,
			displayFlow: ip ? `${flowGPM.toFixed(1)} GPM` : `${flowLPS.toFixed(1)} L/s`
		};
	}, [iopSpaces, ip]);
	const handleAddSpace = () => {
		if (!newDesc.trim()) return;
		const floor = extractFloorFU(newDesc);
		const fixturesCleaned = {};
		LU_FIXTURES_META.forEach((f) => {
			const q = newFixtures[f.id] || 0;
			if (q > 0) fixturesCleaned[f.id] = q;
		});
		setIopSpaces([...iopSpaces, {
			id: Date.now(),
			desc: newDesc.trim(),
			floor,
			std: globalBuildingType,
			fixtures: fixturesCleaned
		}]);
		setNewDesc("");
		setNewFixtures({});
	};
	const handleFixtureChange = (spaceId, fixtureId, val) => {
		setIopSpaces(iopSpaces.map((s) => {
			if (s.id !== spaceId) return s;
			return {
				...s,
				fixtures: {
					...s.fixtures,
					[fixtureId]: Math.max(0, val)
				}
			};
		}));
	};
	const handleSpaceDescChange = (spaceId, val) => {
		setIopSpaces(iopSpaces.map((s) => {
			if (s.id !== spaceId) return s;
			return {
				...s,
				desc: val,
				floor: extractFloorFU(val)
			};
		}));
	};
	const handleBuildingTypeChange = (type) => {
		setGlobalBuildingType(type);
		setIopSpaces(iopSpaces.map((s) => ({
			...s,
			std: type
		})));
	};
	const floorsGrouped = (0, import_react.useMemo)(() => {
		const grouped = {};
		iopSpaces.forEach((s) => {
			const fl = s.floor || "G";
			if (!grouped[fl]) grouped[fl] = [];
			grouped[fl].push(s);
		});
		return grouped;
	}, [iopSpaces]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Loading Unit Calculator",
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
									children: "PLUMBING > LOADING UNIT SIZER"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
									children: "Loading Unit Calculator"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[13px] text-muted-foreground mt-0.5",
									children: "Specify fixture quantities building-wide using standard frequencies to determine loading units and flow rates."
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: handleSaveCurrent,
							className: "flex items-center gap-2 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-xl px-4 py-2 text-[12.5px] font-bold transition-all border-0 cursor-pointer shadow-sm mt-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-4" }), " Save Calculation"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 p-2 border border-border rounded-xl",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl gap-1 select-none",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setUnitSystem("si"),
								className: `px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
								children: "Metric (SI)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setUnitSystem("ip"),
								className: `px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
								children: "Imperial (IP)"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center gap-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl gap-1 select-none text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => handleBuildingTypeChange("low"),
										className: `px-3 py-1 font-bold rounded-md transition-all duration-150 cursor-pointer ${globalBuildingType === "low" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
										children: "Low"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => handleBuildingTypeChange("med"),
										className: `px-3 py-1 font-bold rounded-md transition-all duration-150 cursor-pointer ${globalBuildingType === "med" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
										children: "Medium"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => handleBuildingTypeChange("high"),
										className: `px-3 py-1 font-bold rounded-md transition-all duration-150 cursor-pointer ${globalBuildingType === "high" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
										children: "High"
									})
								]
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "lg:col-span-8 flex flex-col gap-6",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between pb-2 border-b border-border/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
											children: "📋 Fixture Quantities (By Space / Area)"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setIopSpaces([]),
										className: "text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-1 rounded transition-colors cursor-pointer border-0 bg-transparent",
										children: "🗑 Clear All"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "overflow-x-auto border border-border rounded-xl",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
										className: "w-full border-collapse text-[11.5px] font-sans",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("thead", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
												className: "bg-slate-100 dark:bg-slate-800/80 border-b border-border text-foreground font-semibold",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														rowSpan: 2,
														className: "p-2 text-center w-8",
														children: "#"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														rowSpan: 2,
														className: "p-2 text-left min-w-[150px]",
														children: "Description"
													}),
													LU_FIXTURES_META.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-2 text-center w-12",
														children: f.short
													}, f.id)),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														rowSpan: 2,
														className: "p-2 text-center w-24 bg-[#0A7BC7]/5 text-[#0A7BC7] font-bold",
														children: "TOTAL L.U"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														rowSpan: 2,
														className: "p-2 text-center w-8"
													})
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
												className: "bg-slate-50 dark:bg-slate-900 border-b border-border",
												children: LU_FIXTURES_META.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "p-1 px-2 text-center font-bold text-[#0A7BC7]/90 bg-[#0A7BC7]/5",
													children: IP_FIXTURE_UNITS[f.id][globalBuildingType]
												}, f.id))
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
												className: "bg-blue-50/40/30 dark:bg-orange-950/10 border-b border-border/70 border-dashed",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "bg-blue-50/40/30 dark:bg-orange-950/10 border-b border-border/70 border-dashed",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2 text-center font-extrabold text-[#0A7BC7] text-[15px]",
															children: "+"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-1.5",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "text",
																placeholder: "e.g. 1F Washroom",
																value: newDesc,
																onChange: (e) => setNewDesc(e.target.value),
																className: "w-full bg-white dark:bg-slate-950 border border-border rounded-md px-2 py-1 outline-none focus:border-[#0A7BC7]"
															})
														}),
														LU_FIXTURES_META.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-1",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																min: "0",
																placeholder: "-",
																value: newFixtures[f.id] || "",
																onChange: (e) => setNewFixtures({
																	...newFixtures,
																	[f.id]: e.target.value !== "" ? Number(e.target.value) : 0
																}),
																className: "w-full bg-white dark:bg-slate-950 border border-border rounded-md py-1 text-center outline-none"
															})
														}, f.id)),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2 text-right font-bold text-[#0A7BC7] font-mono",
															children: "-"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2 text-center",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: handleAddSpace,
																className: "bg-[#0A7BC7] hover:bg-[#06456F] text-white px-2 py-1 rounded font-bold transition-all cursor-pointer border-0",
																children: "Done"
															})
														})
													]
												})
											}),
											iopSpaces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												colSpan: LU_FIXTURES_META.length + 4,
												className: "p-8 text-center text-muted-foreground italic",
												children: "No spaces added. Add one above."
											}) }) }) : Object.keys(floorsGrouped).map((floor) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
												className: "bg-slate-50 dark:bg-slate-900/60 border-b border-border text-foreground font-bold select-none text-[11px]",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
													colSpan: LU_FIXTURES_META.length + 4,
													className: "p-1.5 px-3",
													children: ["📍 Floor: ", floor]
												})
											}), floorsGrouped[floor].map((s, sidx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
												className: "border-b border-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-2 text-center text-muted-foreground font-mono",
														children: sidx + 1
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-1.5",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "text",
															value: s.desc,
															onChange: (e) => handleSpaceDescChange(s.id, e.target.value),
															className: "w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-bold text-foreground"
														})
													}),
													LU_FIXTURES_META.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-1",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "number",
															min: "0",
															value: s.fixtures[f.id] || "",
															onChange: (e) => handleFixtureChange(s.id, f.id, Number(e.target.value)),
															className: "w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium"
														})
													}, f.id)),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-2 text-center font-mono font-bold text-[#0A7BC7] bg-[#0A7BC7]/5",
														children: (calculations.spaceTotals[s.id] || 0).toFixed(1)
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-2 text-center",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => setIopSpaces(iopSpaces.filter((x) => x.id !== s.id)),
															className: "text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer transition-colors border-0 bg-transparent",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
														})
													})
												]
											}, s.id))] }, floor))
										]
									})
								})]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "lg:col-span-4 flex flex-col gap-5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs sticky top-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 pb-2 border-b border-border/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
											children: "📊 Sizing Results"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-3 font-sans text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Total Loading Units"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [calculations.totalLU.toFixed(1), " LU"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-2.5 border-t border-border/60 mt-1 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-bold text-foreground uppercase text-[11px] tracking-wide",
													children: "Probable Peak Flow"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-extrabold text-[#0A7BC7] text-[16px] font-mono",
													children: calculations.displayFlow
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Applied Standard"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-foreground",
													children: "IOP Sizing Method"
												})]
											})
										]
									}),
									calculations.totalLU > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/30 border border-border rounded-xl p-3.5 font-sans",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[10px] font-bold text-muted-foreground uppercase tracking-wide",
											children: "Zone-wise breakdown"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex flex-col gap-1 text-[11.5px] font-semibold text-foreground",
											children: iopSpaces.map((s, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between py-1 border-b border-border/20 last:border-0",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "truncate max-w-[70%]",
													children: [
														s.desc,
														" (",
														s.std.toUpperCase(),
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-mono font-bold text-[#0A7BC7]",
													children: [(calculations.spaceTotals[s.id] || 0).toFixed(1), " LU"]
												})]
											}, idx))
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-[#0A7BC7]/10 border border-[#0A7BC7]/20 text-[#06456F] dark:text-sky-300 rounded-xl p-3.5 flex gap-2.5 text-[11px] font-sans",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-4 shrink-0 mt-0.5 text-[#0A7BC7]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Loading Units are computed in compliance with IOP standards and mapped to equivalent peak flow rates." })]
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
export { LoadingUnitPage as component };
