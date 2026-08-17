import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, Et as ChevronUp, Ot as ChevronDown, Y as Info, m as Trash2 } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { n as IP_FIXTURE_UNITS, t as FU_FIXTURES_META } from "./plumbing-fixture-unit-DcPVxtoe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-fixture-unit-Dbq8bI1F.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var IPC_TABLE = [
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
	for (let i = 0; i < IPC_TABLE.length; i++) if (IPC_TABLE[i].wsfu === clamped) return IPC_TABLE[i].gpm;
	for (let i = 0; i < IPC_TABLE.length - 1; i++) {
		const lower = IPC_TABLE[i];
		const upper = IPC_TABLE[i + 1];
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
function extractFloorFU(name) {
	const match = name.match(/^([0-9]|B|G|LG|UG|SF|RF|M|P)[FLfli]?/i);
	return match ? match[0].toUpperCase().replace(/L$/i, "F") : "G";
}
function FixtureUnitPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("si");
	const [fuSpaces, setFuSpaces] = (0, import_react.useState)([]);
	const [newDesc, setNewDesc] = (0, import_react.useState)("");
	const [newStd, setNewStd] = (0, import_react.useState)("ipc-total");
	const [newFixtures, setNewFixtures] = (0, import_react.useState)({});
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	const [selectedIds, setSelectedIds] = (0, import_react.useState)([]);
	const [bulkStd, setBulkStd] = (0, import_react.useState)("ipc-total");
	(0, import_react.useEffect)(() => {
		if (project?.id) {
			try {
				const stored = localStorage.getItem(`mep_fixture_unit_calc_${project.id}`);
				if (stored) {
					const data = JSON.parse(stored);
					if (data.unitSystem) setUnitSystem(data.unitSystem);
					if (data.fuSpaces) setFuSpaces(data.fuSpaces);
				} else {
					setUnitSystem("si");
					setFuSpaces([{
						id: 1,
						desc: "1F Male Washroom",
						floor: "1F",
						std: "ipc-total",
						fixtures: {
							wc: 4,
							urinal: 3,
							basin: 4
						}
					}, {
						id: 2,
						desc: "1F Female Washroom",
						floor: "1F",
						std: "ipc-total",
						fixtures: {
							wc: 5,
							basin: 4
						}
					}]);
				}
				setTimeout(() => dirtyStore.set(false), 50);
			} catch (e) {
				console.error("Failed to load fixture unit calculation", e);
			}
			setLoadedProjectId(project.id);
		}
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				unitSystem,
				fuSpaces
			};
			localStorage.setItem(`mep_fixture_unit_calc_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		unitSystem,
		fuSpaces
	]);
	const handleSaveCurrent = () => {
		try {
			if (project?.id) {
				const dataToSave = {
					unitSystem,
					fuSpaces
				};
				localStorage.setItem(`mep_fixture_unit_calc_${project.id}`, JSON.stringify(dataToSave));
				dirtyStore.set(false);
				if (forceSaveToCloud) forceSaveToCloud();
				toast.success("Fixture Unit Calculation saved to project successfully!");
			}
		} catch (e) {
			toast.error("Failed to save calculation.");
		}
	};
	const [expandDetails, setExpandDetails] = (0, import_react.useState)(false);
	const [expandAssumptions, setExpandAssumptions] = (0, import_react.useState)(false);
	const ip = unitSystem === "ip";
	const calculations = (0, import_react.useMemo)(() => {
		let totalWSFU = 0;
		const spaceTotals = {};
		const breakdown = [];
		const detailedSteps = [];
		fuSpaces.forEach((s) => {
			let spaceWSFU = 0;
			const spaceParts = [];
			const spaceStd = s.std;
			FU_FIXTURES_META.forEach((f) => {
				const qty = s.fixtures[f.id] || 0;
				if (qty > 0) {
					const unitFU = IP_FIXTURE_UNITS[f.id][spaceStd] || 0;
					const subTotal = qty * unitFU;
					spaceWSFU += subTotal;
					spaceParts.push(`${f.short} (${qty} × ${unitFU})`);
				}
			});
			spaceTotals[s.id] = spaceWSFU;
			totalWSFU += spaceWSFU;
			if (spaceWSFU > 0) {
				const stdLabel = spaceStd.replace("ipc-", "").toUpperCase();
				breakdown.push(`${s.desc} [${stdLabel}]: ${spaceWSFU.toFixed(1)} WSFU`);
				detailedSteps.push({
					title: `Area: ${s.desc} (${stdLabel})`,
					expr: spaceParts.join(" + ") + ` = ${spaceWSFU.toFixed(1)} WSFU`
				});
			}
		});
		const flowGPM = wsfuToGPM(totalWSFU);
		const flowLPS = wsfuToLPS(totalWSFU);
		return {
			totalWSFU,
			spaceTotals,
			breakdown,
			detailedSteps,
			displayFlow: ip ? `${flowGPM.toFixed(1)} GPM` : `${flowLPS.toFixed(2)} L/s`
		};
	}, [fuSpaces, ip]);
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape") {
				if (selectedIds.length > 0) {
					e.preventDefault();
					setSelectedIds([]);
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedIds]);
	const handleAddSpace = () => {
		if (!newDesc.trim()) return;
		const floor = extractFloorFU(newDesc);
		const fixturesCleaned = {};
		FU_FIXTURES_META.forEach((f) => {
			const q = newFixtures[f.id] || 0;
			if (q > 0) fixturesCleaned[f.id] = q;
		});
		setFuSpaces([...fuSpaces, {
			id: Date.now(),
			desc: newDesc.trim(),
			floor,
			std: newStd,
			fixtures: fixturesCleaned
		}]);
		setNewDesc("");
		setNewFixtures({});
	};
	const handleFixtureChange = (spaceId, fixtureId, val) => {
		setFuSpaces(fuSpaces.map((s) => {
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
	const handleSpaceChange = (spaceId, field, val) => {
		setFuSpaces(fuSpaces.map((s) => {
			if (s.id !== spaceId) return s;
			const updated = {
				...s,
				[field]: val
			};
			if (field === "desc") updated.floor = extractFloorFU(val);
			return updated;
		}));
	};
	const handleToggleSelectAll = (checked) => {
		if (checked) setSelectedIds(fuSpaces.map((s) => s.id));
		else setSelectedIds([]);
	};
	const handleToggleSelect = (id, checked) => {
		if (checked) setSelectedIds([...selectedIds, id]);
		else setSelectedIds(selectedIds.filter((x) => x !== id));
	};
	const handleApplyBulkStd = () => {
		if (selectedIds.length === 0) return;
		setFuSpaces(fuSpaces.map((s) => {
			if (selectedIds.includes(s.id)) return {
				...s,
				std: bulkStd
			};
			return s;
		}));
		setSelectedIds([]);
	};
	const floorsGrouped = (0, import_react.useMemo)(() => {
		const grouped = {};
		fuSpaces.forEach((s) => {
			const fl = s.floor || "G";
			if (!grouped[fl]) grouped[fl] = [];
			grouped[fl].push(s);
		});
		return grouped;
	}, [fuSpaces]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Fixture Unit Calculator",
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
									children: "PLUMBING > FIXTURE UNIT SIZER"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
									children: "Fixture Unit Calculator"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[13px] text-muted-foreground mt-0.5",
									children: "Select fixtures, quantity, and apply usage standards to calculate Water Supply Fixture Units (WSFU) and peak demand flow."
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
								onClick: () => setUnitSystem("si"),
								className: `px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
								children: "Metric (SI)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setUnitSystem("ip"),
								className: `px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`,
								children: "Imperial (IP)"
							})]
						})
					}),
					selectedIds.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 bg-[#0A7BC7]/10 border border-[#0A7BC7]/20 rounded-xl p-3.5 animate-in fade-in slide-in-from-top-2 duration-150",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xs font-bold text-[#06456F] dark:text-sky-400",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "bg-[#0A7BC7] text-white size-5.5 rounded-full inline-flex items-center justify-center font-mono mr-1.5 text-[10.5px]",
									children: selectedIds.length
								}), "Zones Selected"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-px h-5 bg-border" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5 text-xs font-semibold",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground",
										children: "Batch Standard:"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: bulkStd,
										onChange: (e) => setBulkStd(e.target.value),
										className: "bg-white dark:bg-slate-950 border border-border rounded-lg px-2 py-1 outline-none",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "ipc-cold",
												children: "IPC Cold"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "ipc-hot",
												children: "IPC Hot"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "ipc-total",
												children: "IPC Total"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: handleApplyBulkStd,
										className: "bg-[#0A7BC7] hover:bg-[#06456F] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
										children: "Apply to Selected"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setSelectedIds([]),
								className: "ml-auto text-xs text-muted-foreground hover:text-foreground font-semibold hover:underline",
								children: "Deselect All"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "lg:col-span-8 flex flex-col gap-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
											onClick: () => setFuSpaces([]),
											className: "text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-1 rounded transition-colors cursor-pointer border-0 bg-transparent",
											children: "🗑 Clear All Spaces"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "overflow-x-auto border border-border rounded-xl",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
											className: "w-full border-collapse text-[11.5px] font-sans",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "bg-slate-100 dark:bg-slate-800/80 border-b border-border text-foreground font-semibold",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2 text-center w-8",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "checkbox",
																checked: selectedIds.length === fuSpaces.length && fuSpaces.length > 0,
																onChange: (e) => handleToggleSelectAll(e.target.checked),
																className: "size-3.5 accent-orange-500 cursor-pointer"
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2 text-left min-w-[150px]",
															children: "Description"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2 text-left w-24",
															children: "Standard"
														}),
														FU_FIXTURES_META.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2 text-center w-12",
															children: f.short
														}, f.id)),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2 text-right w-20",
															children: "Total WSFU"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "p-2 text-center w-8" })
													]
												}) }),
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
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "p-1.5",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																	value: newStd,
																	onChange: (e) => setNewStd(e.target.value),
																	className: "w-full bg-white dark:bg-slate-950 border border-border rounded-md px-1.5 py-1 outline-none",
																	children: [
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "ipc-cold",
																			children: "IPC Cold"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "ipc-hot",
																			children: "IPC Hot"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "ipc-total",
																			children: "IPC Total"
																		})
																	]
																})
															}),
															FU_FIXTURES_META.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
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
												fuSpaces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													colSpan: FU_FIXTURES_META.length + 5,
													className: "p-8 text-center text-muted-foreground italic",
													children: "No spaces added. Add one above."
												}) }) }) : Object.keys(floorsGrouped).map((floor) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
													className: "bg-slate-50 dark:bg-slate-900/60 border-b border-border text-foreground font-bold select-none text-[11px]",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
														colSpan: FU_FIXTURES_META.length + 5,
														className: "p-1.5 px-3",
														children: ["📍 Floor: ", floor]
													})
												}), floorsGrouped[floor].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "border-b border-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2 text-center",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "checkbox",
																checked: selectedIds.includes(s.id),
																onChange: (e) => handleToggleSelect(s.id, e.target.checked),
																className: "size-3.5 accent-orange-500 cursor-pointer"
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-1.5",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "text",
																value: s.desc,
																onChange: (e) => handleSpaceChange(s.id, "desc", e.target.value),
																className: "w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded"
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-1.5",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																value: s.std,
																onChange: (e) => handleSpaceChange(s.id, "std", e.target.value),
																className: "w-full bg-transparent border-0 outline-none cursor-pointer focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "ipc-cold",
																		children: "IPC Cold"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "ipc-hot",
																		children: "IPC Hot"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "ipc-total",
																		children: "IPC Total"
																	})
																]
															})
														}),
														FU_FIXTURES_META.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
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
															className: "p-2 text-right font-mono font-bold text-[#0A7BC7]",
															children: (calculations.spaceTotals[s.id] || 0).toFixed(1)
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2 text-center",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: () => setFuSpaces(fuSpaces.filter((x) => x.id !== s.id)),
																className: "text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer transition-colors border-0 bg-transparent",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
															})
														})
													]
												}, s.id))] }, floor))
											]
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setExpandDetails(!expandDetails),
										className: "w-full px-5 py-4 flex items-center justify-between border-0 bg-transparent text-left cursor-pointer",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
												children: "Σ Detailed Calculations"
											})]
										}), expandDetails ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-4 text-muted-foreground" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted-foreground" })]
									}), expandDetails && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "px-5 pb-5 pt-1 border-t border-border/40 flex flex-col gap-3 text-xs font-sans",
										children: calculations.detailedSteps.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted-foreground italic",
											children: "No detailed calculations available yet. Add spaces above."
										}) : calculations.detailedSteps.map((s, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-border/50",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "font-bold text-foreground mb-1",
												children: s.title
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "font-mono text-muted-foreground break-all",
												children: s.expr
											})]
										}, idx))
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setExpandAssumptions(!expandAssumptions),
										className: "w-full px-5 py-4 flex items-center justify-between border-0 bg-transparent text-left cursor-pointer",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
												children: "ℹ Assumptions & Basis"
											})]
										}), expandAssumptions ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-4 text-muted-foreground" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted-foreground" })]
									}), expandAssumptions && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "px-5 pb-5 pt-1 border-t border-border/40 text-xs font-sans text-muted-foreground flex flex-col gap-2.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[#0A7BC7] font-bold",
													children: "•"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sizing is based on the Water Supply Fixture Units (WSFU) methodology." })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[#0A7BC7] font-bold",
													children: "•"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Standards options support IPC Cold, IPC Hot, or IPC Total loadings." })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[#0A7BC7] font-bold",
													children: "•"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Probable peak flow rate conversion is derived from the Curve Fit Polynomial matching the Hunter's curve chart data up to 5,000 WSFUs." })]
											})
										]
									})]
								})
							]
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
													children: "Total Fixture Units"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [calculations.totalWSFU.toFixed(1), " WSFU"]
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
													children: "Applied Sizing standard"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-foreground",
													children: "IPC Polynomial Method"
												})]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-[#0A7BC7]/10 border border-[#0A7BC7]/20 text-[#06456F] dark:text-sky-300 rounded-xl p-3.5 flex gap-2.5 text-[11px] font-sans",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-4 shrink-0 mt-0.5 text-[#0A7BC7]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "The fixture values are automatically synced with downstream sizing schedules (e.g. Booster Pump, Transfer Pump, Storage Tanks)." })]
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
export { FixtureUnitPage as component };
