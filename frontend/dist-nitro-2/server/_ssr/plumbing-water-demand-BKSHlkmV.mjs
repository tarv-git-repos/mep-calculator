import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-Ct3ePlL1.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, N as Plus, Y as Info, m as Trash2 } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-urg-0zDa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-water-demand-BKSHlkmV.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var WD_TYPE_MAP = {
	"Residential buildings (flat)": 300,
	"Villas": 350,
	"Mixed used residential": 350,
	"Labour accommodation": 150,
	"Offices": 60,
	"Headquarters": 80,
	"Commercial buildings": 100,
	"Mixed used commercial": 80,
	"Logistic, academic & business center": 75,
	"Local plaza / retail / town center": 82,
	"Shops": 60,
	"Club house / recreation": 100,
	"Entertainment & leisure / theater": 60,
	"Theatre": 50,
	"Events": 50,
	"Hotels (per guest)": 300,
	"Hotels (per employee)": 80,
	"Restaurant (per meal)": 15,
	"Visitors": 40,
	"Schools / university": 60,
	"Nursery / child care centre": 70,
	"Medical (per bed)": 450,
	"Day clinic (per medical practitioner) incl. visitors": 450,
	"Laboratory": 80,
	"Manufacturing / mineral": 80,
	"Industrial (workshops / machinery / warehouse)": 80,
	"Guardhouse": 75,
	"Mosques": 60,
	"Public amenities": 50
};
var IRR_TYPE_MAP = {
	"Palm Trees": 150,
	"Small Palm Tree": 75,
	"Ornamental trees": 80,
	"Shrubs & hedges": 15,
	"Ground cover and succulents": 12,
	"Seasonal flowers and creepers": 12,
	"Lawn with pop-up sprays": 10
};
function WaterDemandPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("si");
	const [wdRows, setWdRows] = (0, import_react.useState)([]);
	const [newWdName, setNewWdName] = (0, import_react.useState)("");
	const [newWdPeople, setNewWdPeople] = (0, import_react.useState)("");
	const [newWdCat, setNewWdCat] = (0, import_react.useState)("");
	const [irrRows, setIrrRows] = (0, import_react.useState)([]);
	const [newIrrArea, setNewIrrArea] = (0, import_react.useState)("");
	const [newIrrVegType, setNewIrrVegType] = (0, import_react.useState)("");
	const [poolArea, setPoolArea] = (0, import_react.useState)("");
	const [poolDepth, setPoolDepth] = (0, import_react.useState)("");
	const [poolEvap, setPoolEvap] = (0, import_react.useState)(10);
	const [fireFlow, setFireFlow] = (0, import_react.useState)("");
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!project?.id) return;
		try {
			const stored = localStorage.getItem(`mep_water_demand_calc_${project.id}`);
			if (stored) {
				const data = JSON.parse(stored);
				if (data.unitSystem) setUnitSystem(data.unitSystem);
				if (data.wdRows) setWdRows(data.wdRows);
				if (data.irrRows) setIrrRows(data.irrRows);
				if (data.poolArea !== void 0) setPoolArea(data.poolArea);
				if (data.poolDepth !== void 0) setPoolDepth(data.poolDepth);
				if (data.poolEvap !== void 0) setPoolEvap(data.poolEvap);
				if (data.fireFlow !== void 0) setFireFlow(data.fireFlow);
			} else {
				setUnitSystem("si");
				setWdRows([{
					id: 1,
					name: "Apartment Block A",
					ppl: 150,
					cat: "Residential buildings (flat)",
					lpd: 300
				}, {
					id: 2,
					name: "Ground Floor Offices",
					ppl: 45,
					cat: "Offices",
					lpd: 60
				}]);
				setIrrRows([{
					id: 1,
					area: 120,
					vegType: "Lawn with pop-up sprays",
					lpd: 10
				}, {
					id: 2,
					area: 15,
					vegType: "Palm Trees",
					lpd: 150
				}]);
				setPoolArea("");
				setPoolDepth("");
				setPoolEvap(10);
				setFireFlow("");
			}
			setTimeout(() => dirtyStore.set(false), 50);
		} catch (e) {
			console.error("Failed to load water demand calculation", e);
		}
		setLoadedProjectId(project.id);
	}, [project?.id]);
	const handleSaveCurrent = () => {
		try {
			const dataToSave = {
				unitSystem,
				wdRows,
				irrRows,
				poolArea,
				poolDepth,
				poolEvap,
				fireFlow
			};
			localStorage.setItem(`mep_water_demand_calc_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(false);
			if (forceSaveToCloud) forceSaveToCloud();
			toast.success("Water Demand Calculation saved to project successfully!");
		} catch (e) {
			toast.error("Failed to save calculation.");
		}
	};
	const ip = unitSystem === "ip";
	const calculations = (0, import_react.useMemo)(() => {
		let totalPeople = 0;
		let totalWaterL = 0;
		wdRows.forEach((r) => {
			totalPeople += r.ppl;
			totalWaterL += r.ppl * r.lpd;
		});
		let totalIrrL = 0;
		irrRows.forEach((r) => {
			totalIrrL += r.area * r.lpd;
		});
		const poolVolL = (Number(poolArea) || 0) * (Number(poolDepth) || 0) * 1e3;
		const poolDemandL = poolVolL * (poolEvap / 100);
		const fireLPM = (Number(fireFlow) || 0) * 3.785;
		const fireCapL = fireLPM * 60;
		const grandTotalL = totalWaterL + totalIrrL + poolDemandL;
		const formatVol = (liters) => {
			if (ip) return `${Math.round(liters / 3.78541).toLocaleString()} gal`;
			return `${Math.round(liters).toLocaleString()} L`;
		};
		const formatRate = (litersPerDay) => {
			if (ip) return `${Math.round(litersPerDay / 3.78541).toLocaleString()} gal/day`;
			return `${Math.round(litersPerDay).toLocaleString()} L/day`;
		};
		return {
			totalPeople,
			totalWaterL,
			totalIrrL,
			poolVolL,
			poolDemandL,
			fireLPM,
			fireCapL,
			grandTotalL,
			displayDomestic: formatRate(totalWaterL),
			displayDomesticPeak: formatVol(totalWaterL / 10) + "/hr",
			displayIrrigation: formatRate(totalIrrL),
			displayPoolVol: formatVol(poolVolL),
			displayPoolDemand: formatRate(poolDemandL),
			displayFireLPM: `${fireLPM.toFixed(1)} L/min`,
			displayFireCap: formatVol(fireCapL),
			displayGrandTotal: formatRate(grandTotalL)
		};
	}, [
		wdRows,
		irrRows,
		poolArea,
		poolDepth,
		poolEvap,
		fireFlow,
		ip
	]);
	const handleAddWd = () => {
		if (!newWdName.trim() || !newWdPeople || !newWdCat) return;
		const lpd = WD_TYPE_MAP[newWdCat] || 0;
		setWdRows([...wdRows, {
			id: Date.now(),
			name: newWdName.trim(),
			ppl: Number(newWdPeople),
			cat: newWdCat,
			lpd
		}]);
		setNewWdName("");
		setNewWdPeople("");
		setNewWdCat("");
	};
	const handleWdRowChange = (id, field, val) => {
		setWdRows(wdRows.map((r) => {
			if (r.id !== id) return r;
			const updated = {
				...r,
				[field]: val
			};
			if (field === "cat") updated.lpd = WD_TYPE_MAP[val] || 0;
			return updated;
		}));
	};
	const handleAddIrr = () => {
		if (!newIrrArea || !newIrrVegType) return;
		const lpd = IRR_TYPE_MAP[newIrrVegType] || 0;
		setIrrRows([...irrRows, {
			id: Date.now(),
			area: Number(newIrrArea),
			vegType: newIrrVegType,
			lpd
		}]);
		setNewIrrArea("");
		setNewIrrVegType("");
	};
	const handleIrrRowChange = (id, field, val) => {
		setIrrRows(irrRows.map((r) => {
			if (r.id !== id) return r;
			const updated = {
				...r,
				[field]: val
			};
			if (field === "vegType") updated.lpd = IRR_TYPE_MAP[val] || 0;
			return updated;
		}));
	};
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			const dataToSave = {
				unitSystem,
				wdRows,
				newWdName,
				newWdPeople,
				newWdCat,
				irrRows,
				newIrrArea,
				newIrrVegType,
				poolArea,
				poolDepth,
				poolEvap,
				fireFlow
			};
			localStorage.setItem(`mep_water_demand_calc_${project.id}`, JSON.stringify(dataToSave));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		unitSystem,
		wdRows,
		newWdName,
		newWdPeople,
		newWdCat,
		irrRows,
		newIrrArea,
		newIrrVegType,
		poolArea,
		poolDepth,
		poolEvap,
		fireFlow
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Water Demand Calculator",
		hideSubHeader: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-full min-h-0 bg-transparent font-sans",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-between items-start select-none",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
									children: "PLUMBING > WATER DEMAND"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "text-[28px] font-bold tracking-tight text-foreground mt-0.5",
									children: "Water Demand Sizer"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[13px] text-muted-foreground mt-0.5",
									children: "Estimate daily domestic load, irrigation requirements, swimming pool make-up, and fire reserves."
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "lg:col-span-8 flex flex-col gap-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 pb-2 border-b border-border/60",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
												children: "🏠 Domestic Water Demand"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-slate-50/50 dark:bg-slate-900/30 p-3.5 border border-border rounded-xl text-xs",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "font-semibold text-foreground",
														children: "Description"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "text",
														placeholder: "e.g. Office Floor 1",
														value: newWdName,
														onChange: (e) => setNewWdName(e.target.value),
														className: "bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "font-semibold text-foreground",
														children: "No. of People"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														placeholder: "e.g. 50",
														value: newWdPeople,
														onChange: (e) => setNewWdPeople(e.target.value !== "" ? Number(e.target.value) : ""),
														className: "bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "font-semibold text-foreground",
														children: "Category"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
														value: newWdCat,
														onChange: (e) => setNewWdCat(e.target.value),
														className: "bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																value: "",
																children: "— Select Category —"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("optgroup", {
																label: "Residential",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Residential buildings (flat)",
																		children: "Residential buildings (flat) — 300 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Villas",
																		children: "Villas — 350 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Mixed used residential",
																		children: "Mixed used residential — 350 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Labour accommodation",
																		children: "Labour accommodation — 150 LPD"
																	})
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("optgroup", {
																label: "Office & Commercial",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Offices",
																		children: "Offices — 60 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Headquarters",
																		children: "Headquarters — 80 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Commercial buildings",
																		children: "Commercial buildings — 100 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Mixed used commercial",
																		children: "Mixed used commercial — 80 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Logistic, academic & business center",
																		children: "Logistic, academic & business center — 75 LPD"
																	})
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("optgroup", {
																label: "Retail & Leisure",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Local plaza / retail / town center",
																		children: "Local plaza / retail / town center — 82 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Shops",
																		children: "Shops — 60 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Club house / recreation",
																		children: "Club house / recreation — 100 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Entertainment & leisure / theater",
																		children: "Entertainment & leisure / theater — 60 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Theatre",
																		children: "Theatre — 50 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Events",
																		children: "Events — 50 LPD"
																	})
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("optgroup", {
																label: "Hospitality",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Hotels (per guest)",
																		children: "Hotels (per guest) — 300 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Hotels (per employee)",
																		children: "Hotels (per employee) — 80 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Restaurant (per meal)",
																		children: "Restaurant (per meal) — 15 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Visitors",
																		children: "Visitors — 40 LPD"
																	})
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("optgroup", {
																label: "Education",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "Schools / university",
																	children: "Schools / university — 60 LPD"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "Nursery / child care centre",
																	children: "Nursery / child care centre — 70 LPD"
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("optgroup", {
																label: "Medical & Healthcare",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Medical (per bed)",
																		children: "Medical (per bed) — 450 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Day clinic (per medical practitioner) incl. visitors",
																		children: "Day clinic (per practitioner) — 450 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Laboratory",
																		children: "Laboratory — 80 LPD"
																	})
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("optgroup", {
																label: "Industrial",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Manufacturing / mineral",
																		children: "Manufacturing / mineral — 80 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Industrial (workshops / machinery / warehouse)",
																		children: "Industrial — 80 LPD"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Guardhouse",
																		children: "Guardhouse — 75 LPD"
																	})
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("optgroup", {
																label: "Public & Assembly",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "Mosques",
																	children: "Mosques — 60 LPD"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "Public amenities",
																	children: "Public amenities — 50 LPD"
																})]
															})
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													type: "button",
													onClick: handleAddWd,
													className: "h-8.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Add Entry"]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "overflow-x-auto border border-border rounded-xl",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
												className: "w-full border-collapse text-[12.5px] font-sans",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "bg-slate-100 dark:bg-slate-800/80 border-b border-border text-foreground font-semibold",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-center w-12",
															children: "S.No"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-left",
															children: "Description"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-center w-24",
															children: "People"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-left w-48",
															children: "Category"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-right w-28",
															children: "Consumption"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-right w-28",
															children: "Total"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-center w-12",
															children: "Action"
														})
													]
												}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: wdRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													colSpan: 7,
													className: "p-8 text-center text-muted-foreground italic",
													children: "No entries added. Fill in the form above to populate."
												}) }) : wdRows.map((r, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "border-b border-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2 text-center text-muted-foreground font-mono",
															children: idx + 1
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "text",
																value: r.name,
																onChange: (e) => handleWdRowChange(r.id, "name", e.target.value),
																className: "w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded"
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2 text-center font-bold",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																value: r.ppl,
																onChange: (e) => handleWdRowChange(r.id, "ppl", Number(e.target.value)),
																className: "w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono"
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
																value: r.cat,
																onChange: (e) => handleWdRowChange(r.id, "cat", e.target.value),
																className: "w-full bg-transparent border-0 outline-none cursor-pointer focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded",
																children: Object.keys(WD_TYPE_MAP).map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: k,
																	children: k
																}, k))
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
															className: "p-2 text-right font-mono font-medium text-muted-foreground",
															children: [
																(ip ? Math.round(r.lpd / 3.78541) : r.lpd).toLocaleString(),
																" ",
																ip ? "gpd" : "LPD"
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
															className: "p-2 text-right font-mono font-bold text-[#0A7BC7]",
															children: [
																(ip ? Math.round(r.ppl * r.lpd / 3.78541) : r.ppl * r.lpd).toLocaleString(),
																" ",
																ip ? "gal" : "L"
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2 text-center",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: () => setWdRows(wdRows.filter((x) => x.id !== r.id)),
																className: "text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer transition-colors",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
															})
														})
													]
												}, r.id)) })]
											})
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 pb-2 border-b border-border/60",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
												children: "🌿 Irrigation Water Demand"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-slate-50/50 dark:bg-slate-900/30 p-3.5 border border-border rounded-xl text-xs",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
														className: "font-semibold text-foreground",
														children: [
															"Area (",
															ip ? "ft²" : "m²",
															")"
														]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														placeholder: "e.g. 100",
														value: newIrrArea,
														onChange: (e) => setNewIrrArea(e.target.value !== "" ? Number(e.target.value) : ""),
														className: "bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "font-semibold text-foreground",
														children: "Vegetation Type"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
														value: newIrrVegType,
														onChange: (e) => setNewIrrVegType(e.target.value),
														className: "bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "",
															children: "— Select Plant Type —"
														}), Object.keys(IRR_TYPE_MAP).map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
															value: k,
															children: [
																k,
																" — ",
																IRR_TYPE_MAP[k],
																" L/m²"
															]
														}, k))]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													type: "button",
													onClick: handleAddIrr,
													className: "h-8.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Add Plant Area"]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "overflow-x-auto border border-border rounded-xl",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
												className: "w-full border-collapse text-[12.5px] font-sans",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "bg-slate-100 dark:bg-slate-800/80 border-b border-border text-foreground font-semibold",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-center w-12",
															children: "S.No"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-left",
															children: "Vegetation Type"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-center w-32",
															children: "Area"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-right w-36",
															children: "Rate"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-right w-36",
															children: "Total Load"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "p-2.5 text-center w-12",
															children: "Action"
														})
													]
												}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: irrRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													colSpan: 6,
													className: "p-8 text-center text-muted-foreground italic",
													children: "No irrigation entries."
												}) }) : irrRows.map((r, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "border-b border-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2 text-center text-muted-foreground font-mono",
															children: idx + 1
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
																value: r.vegType,
																onChange: (e) => handleIrrRowChange(r.id, "vegType", e.target.value),
																className: "w-full bg-transparent border-0 outline-none cursor-pointer focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded",
																children: Object.keys(IRR_TYPE_MAP).map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: k,
																	children: k
																}, k))
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2 text-center font-bold font-mono",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																value: r.area,
																onChange: (e) => handleIrrRowChange(r.id, "area", Number(e.target.value)),
																className: "w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded"
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
															className: "p-2 text-right font-mono font-medium text-muted-foreground",
															children: [
																(ip ? Math.round(r.lpd / 40.7458 * 100) / 100 : r.lpd).toFixed(ip ? 3 : 1),
																" ",
																ip ? "gal/ft²" : "L/m²"
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
															className: "p-2 text-right font-mono font-bold text-[#0A7BC7]",
															children: [
																(ip ? Math.round(r.area * r.lpd / 3.78541) : r.area * r.lpd).toLocaleString(),
																" ",
																ip ? "gal" : "L"
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-2 text-center",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: () => setIrrRows(irrRows.filter((x) => x.id !== r.id)),
																className: "text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer transition-colors",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
															})
														})
													]
												}, r.id)) })]
											})
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 pb-2 border-b border-border/60",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
												children: "🏊 Swimming Pool Make-up"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-1 md:grid-cols-3 gap-5 text-xs font-sans",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col gap-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
														className: "font-semibold text-foreground",
														children: [
															"Pool Surface Area (",
															ip ? "ft²" : "m²",
															")"
														]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														placeholder: "e.g. 80",
														value: poolArea,
														onChange: (e) => setPoolArea(e.target.value !== "" ? Number(e.target.value) : ""),
														className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col gap-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
														className: "font-semibold text-foreground",
														children: [
															"Average Depth (",
															ip ? "ft" : "m",
															")"
														]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														placeholder: "e.g. 1.5",
														value: poolDepth,
														onChange: (e) => setPoolDepth(e.target.value !== "" ? Number(e.target.value) : ""),
														className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col gap-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "font-semibold text-foreground",
														children: "Evaporation Rate (% of pool vol / day)"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														value: poolEvap,
														onChange: (e) => setPoolEvap(Number(e.target.value)),
														className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
													})]
												})
											]
										}),
										poolArea && poolDepth && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-3 gap-3.5 mt-2.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[10px] text-blue-500 uppercase tracking-wider font-semibold",
														children: "Total Pool Volume"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-base font-extrabold font-mono text-blue-700 dark:text-blue-400 mt-0.5",
														children: calculations.displayPoolVol
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[10px] text-blue-500 uppercase tracking-wider font-semibold",
														children: "Evaporating rate"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-base font-extrabold font-mono text-blue-700 dark:text-blue-400 mt-0.5",
														children: [poolEvap, " %"]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "p-3 bg-blue-600 border border-blue-700 rounded-xl text-white",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[10px] text-blue-100 uppercase tracking-wider font-semibold",
														children: "Daily Makeup Water"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-base font-extrabold font-mono mt-0.5",
														children: calculations.displayPoolDemand
													})]
												})
											]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 pb-2 border-b border-border/60",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
												children: "🔥 Fire Fighting Reserve Sizing"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-sans",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Fire Pump Flow Rate (USGPM)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													placeholder: "e.g. 500",
													value: fireFlow,
													onChange: (e) => setFireFlow(e.target.value !== "" ? Number(e.target.value) : ""),
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Required Sizing Duration"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "w-full bg-slate-100 dark:bg-slate-800 text-muted-foreground border border-border/85 rounded-lg px-3 py-2 font-bold select-none cursor-not-allowed",
													children: "60 Minutes (Standard fixed duration)"
												})]
											})]
										}),
										fireFlow && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-3 gap-3.5 mt-2.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[10px] text-red-500 uppercase tracking-wider font-semibold",
														children: "Flow Rate Metric"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-base font-extrabold font-mono text-red-700 dark:text-red-400 mt-0.5",
														children: calculations.displayFireLPM
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[10px] text-red-500 uppercase tracking-wider font-semibold",
														children: "Duration Period"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-base font-extrabold font-mono text-red-700 dark:text-red-400 mt-0.5",
														children: "60 min"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "p-3 bg-red-600 border border-red-700 rounded-xl text-white",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[10px] text-red-100 uppercase tracking-wider font-semibold",
														children: "Reserve Tank Capacity"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-base font-extrabold font-mono mt-0.5",
														children: calculations.displayFireCap
													})]
												})
											]
										})
									]
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
											children: "📊 Site Sizing Summary"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-3 font-sans text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Domestic Daily Demand"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: calculations.displayDomestic
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Domestic Peak Flow Rate"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: calculations.displayDomesticPeak
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Irrigation Daily Demand"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: calculations.displayIrrigation
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Pool Daily Makeup Demand"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-bold text-foreground font-mono",
													children: calculations.displayPoolDemand
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-2.5 border-t border-border/60 mt-1 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-bold text-foreground uppercase text-[11px] tracking-wide",
													children: "GRAND TOTAL DEMAND"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "font-extrabold text-[#0A7BC7] text-[16px] font-mono",
													children: calculations.displayGrandTotal
												})]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 rounded-xl p-3.5 flex gap-2.5 text-[11px]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-4 shrink-0 mt-0.5 text-blue-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sizing complies with ASHRAE standards, local municipality consumption regulations, and standard Hunter's curve diversity assumptions." })]
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
export { WaterDemandPage as component };
