import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, Et as ChevronUp, Ot as ChevronDown, X as Import, at as FolderOpen, m as Trash2, nn as CircleQuestionMark } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-Blf5aT0O.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/lobby-pressurisation-To-w8uEw.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function LobbyPressurisationPage() {
	const [area, setArea] = (0, import_react.useState)("");
	const [height, setHeight] = (0, import_react.useState)("");
	const [acph, setAcph] = (0, import_react.useState)("");
	const [fanQty, setFanQty] = (0, import_react.useState)("");
	const [ductLength, setDuctLength] = (0, import_react.useState)("");
	const [frictionFactor, setFrictionFactor] = (0, import_react.useState)("");
	const [louverLoss, setLouverLoss] = (0, import_react.useState)("");
	const [fanLoss, setFanLoss] = (0, import_react.useState)("");
	const [effMotor, setEffMotor] = (0, import_react.useState)(90);
	const [effFan, setEffFan] = (0, import_react.useState)(75);
	const [numFansMotor, setNumFansMotor] = (0, import_react.useState)("");
	const [showDetailedCalcs, setShowDetailedCalcs] = (0, import_react.useState)(true);
	const [saves, setSaves] = (0, import_react.useState)([]);
	const [showSaveModal, setShowSaveModal] = (0, import_react.useState)(false);
	const [showLoadModal, setShowLoadModal] = (0, import_react.useState)(false);
	const [saveName, setSaveName] = (0, import_react.useState)("");
	const [showImportDropdown, setShowImportDropdown] = (0, import_react.useState)(false);
	const { project, forceSaveToCloud } = useWorkspace();
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (project?.id) {
			try {
				const stored = localStorage.getItem(`lobby_press_state_${project.id}`);
				if (stored) {
					const data = JSON.parse(stored);
					if (data.area !== void 0) setArea(data.area);
					if (data.height !== void 0) setHeight(data.height);
					if (data.acph !== void 0) setAcph(data.acph);
					if (data.fanQty !== void 0) setFanQty(data.fanQty);
					if (data.ductLength !== void 0) setDuctLength(data.ductLength);
					if (data.frictionFactor !== void 0) setFrictionFactor(data.frictionFactor);
					if (data.louverLoss !== void 0) setLouverLoss(data.louverLoss);
					if (data.fanLoss !== void 0) setFanLoss(data.fanLoss);
					if (data.effMotor !== void 0) setEffMotor(data.effMotor);
					if (data.effFan !== void 0) setEffFan(data.effFan);
					if (data.numFansMotor !== void 0) setNumFansMotor(data.numFansMotor);
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
				area,
				height,
				acph,
				fanQty,
				ductLength,
				frictionFactor,
				louverLoss,
				fanLoss,
				effMotor,
				effFan,
				numFansMotor
			};
			localStorage.setItem(`lobby_press_state_${project.id}`, JSON.stringify(dataToSave));
		}
	}, [
		project?.id,
		loadedProjectId,
		area,
		height,
		acph,
		fanQty,
		ductLength,
		frictionFactor,
		louverLoss,
		fanLoss,
		effMotor,
		effFan,
		numFansMotor
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
			id: "custom_calc_" + Date.now(),
			type: "lobby-press",
			name: saveName.trim(),
			savedAt: (/* @__PURE__ */ new Date()).toISOString(),
			values: {
				"lp-area": area,
				"lp-height": height,
				"lp-acph": acph,
				"lp-fan-qty": fanQty,
				"lp-head-duct-len": ductLength,
				"lp-head-friction-factor": frictionFactor,
				"lp-head-louvers": louverLoss,
				"lp-head-fan-losses": fanLoss,
				"lp-motor-eff-motor": effMotor,
				"lp-motor-eff-fan": effFan,
				"lp-motor-fan-qty": numFansMotor
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
		if (v["lp-area"] !== void 0) setArea(Number(v["lp-area"]));
		if (v["lp-height"] !== void 0) setHeight(Number(v["lp-height"]));
		if (v["lp-acph"] !== void 0) setAcph(Number(v["lp-acph"]));
		if (v["lp-fan-qty"] !== void 0) setFanQty(Number(v["lp-fan-qty"]));
		if (v["lp-head-duct-len"] !== void 0) setDuctLength(Number(v["lp-head-duct-len"]));
		if (v["lp-head-friction-factor"] !== void 0) setFrictionFactor(Number(v["lp-head-friction-factor"]));
		if (v["lp-head-louvers"] !== void 0) setLouverLoss(Number(v["lp-head-louvers"]));
		if (v["lp-head-fan-losses"] !== void 0) setFanLoss(Number(v["lp-head-fan-losses"]));
		if (v["lp-motor-eff-motor"] !== void 0) setEffMotor(Number(v["lp-motor-eff-motor"]));
		if (v["lp-motor-eff-fan"] !== void 0) setEffFan(Number(v["lp-motor-eff-fan"]));
		if (v["lp-motor-fan-qty"] !== void 0) setNumFansMotor(Number(v["lp-motor-fan-qty"]));
		setShowLoadModal(false);
	};
	const handleDeleteSave = (id, e) => {
		e.stopPropagation();
		saveToLocalStorage(saves.filter((s) => s.id !== id));
	};
	const handleImportSmokeExtract = (target) => {
		const v = target.values;
		if (v["se-corridor-area"] !== void 0) setArea(Number(v["se-corridor-area"]));
		if (v["se-corridor-height"] !== void 0) setHeight(Number(v["se-corridor-height"]));
		if (v["se-acph"] !== void 0) setAcph(Number(v["se-acph"]));
		if (v["se-fan-qty"] !== void 0) setFanQty(Number(v["se-fan-qty"]));
		if (v["se-smoke-duct-length"] !== void 0) setDuctLength(Number(v["se-smoke-duct-length"]));
		if (v["se-smoke-duct-friction-factor"] !== void 0) setFrictionFactor(Number(v["se-smoke-duct-friction-factor"]));
		if (v["se-smoke-losses-louvers"] !== void 0) setLouverLoss(Number(v["se-smoke-losses-louvers"]));
		if (v["se-smoke-losses-fan"] !== void 0) setFanLoss(Number(v["se-smoke-losses-fan"]));
		if (v["se-motor-eff-motor"] !== void 0) setEffMotor(Number(v["se-motor-eff-motor"]));
		if (v["se-motor-eff-fan"] !== void 0) setEffFan(Number(v["se-motor-eff-fan"]));
		if (v["se-motor-fan-qty"] !== void 0) setNumFansMotor(Number(v["se-motor-fan-qty"]));
		setShowImportDropdown(false);
	};
	const smokeExtractSaves = (0, import_react.useMemo)(() => {
		return saves.filter((s) => s.type === "smoke-extract");
	}, [saves]);
	const calculatedData = (0, import_react.useMemo)(() => {
		const areaVal = area !== "" ? Number(area) : 50;
		const heightVal = height !== "" ? Number(height) : 3;
		const acphVal = acph !== "" ? Number(acph) : 10;
		const fanQtyVal = fanQty !== "" ? Number(fanQty) : 2;
		const ductLenVal = ductLength !== "" ? Number(ductLength) : 20;
		const ffVal = frictionFactor !== "" ? Number(frictionFactor) : 1;
		const louverVal = louverLoss !== "" ? Number(louverLoss) : 50;
		const fanLossVal = fanLoss !== "" ? Number(fanLoss) : 20;
		const effMotorVal = effMotor !== "" ? Number(effMotor) : 90;
		const effFanVal = effFan !== "" ? Number(effFan) : 75;
		const numFansVal = numFansMotor !== "" ? Number(numFansMotor) : fanQtyVal || 1;
		const volume = areaVal * heightVal;
		const freshAirRate = volume * acphVal / 3600;
		const flowEachM3s = freshAirRate / (fanQtyVal || 1);
		const flowEachLsRound = Math.ceil(flowEachM3s * 1e3 / 5) * 5;
		const fittingsEqLen = ductLenVal * .6;
		const totalEqLen = ductLenVal + fittingsEqLen;
		const frictionLoss = ffVal * totalEqLen;
		const baseLosses = frictionLoss + louverVal + fanLossVal;
		const totalHead = baseLosses + baseLosses * .1;
		const headRound = Math.round(totalHead / 10) * 10;
		const effM = effMotorVal / 100;
		const effF = effFanVal / 100;
		const powerEach = flowEachM3s * headRound / ((effM * effF || 1) * 1e3);
		const powerEachRound = Math.ceil(powerEach * 100) / 100;
		return {
			volume,
			freshAirRate,
			flowEachM3s,
			flowEachLsRound,
			fittingsEqLen,
			totalEqLen,
			frictionLoss,
			totalHead,
			headRound,
			powerEachRound,
			totalMotorPower: powerEachRound * 1.1 * numFansVal
		};
	}, [
		area,
		height,
		acph,
		fanQty,
		ductLength,
		frictionFactor,
		louverLoss,
		fanLoss,
		effMotor,
		effFan,
		numFansMotor
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Lobby Pressurisation",
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
								children: "HVAC > LOBBY PRESSURISATION"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-4 mt-0.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "text-[28px] font-bold tracking-tight text-foreground",
									children: "Lobby Pressurisation/Makeup Fan"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-border/80 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-semibold text-muted-foreground px-2",
											children: "💾 Calculation Files:"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "relative",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => setShowImportDropdown(!showImportDropdown),
												className: "bg-primary/10 hover:bg-primary/20 text-primary font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Import, { className: "size-3.5" }),
													" Import ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3" })
												]
											}), showImportDropdown && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-xl shadow-xl z-50 p-2 text-left",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[10px] font-bold text-muted-foreground uppercase tracking-wider p-2 border-b border-border/60",
													children: "Select Saved Smoke Extract Zone"
												}), smokeExtractSaves.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "p-3 text-muted-foreground text-center",
													children: "No saved Smoke Extract calculations found."
												}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "max-h-48 overflow-y-auto py-1",
													children: smokeExtractSaves.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
														onClick: () => handleImportSmokeExtract(s),
														className: "w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg text-xs font-semibold flex flex-col gap-0.5 transition cursor-pointer",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-foreground truncate",
															children: s.name
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[10px] text-muted-foreground font-mono",
															children: [
																"Area: ",
																s.values["se-corridor-area"],
																"m² · Ht: ",
																s.values["se-corridor-height"],
																"m"
															]
														})]
													}, s.id))
												})]
											})]
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
								children: "Calculate lobby air volume supply rates and duct static pressure drops for pressurisation systems."
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "lg:col-span-5 flex flex-col gap-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 pb-2 border-b border-border/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
											children: "1. Space Parameters"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-3.5 text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Area of Lobby (m²)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: area,
													onChange: (e) => setArea(e.target.value === "" ? "" : Number(e.target.value)),
													placeholder: "50",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Height of Lobby (m)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: height,
													onChange: (e) => setHeight(e.target.value === "" ? "" : Number(e.target.value)),
													placeholder: "3.0",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Air Changes per Hour (ACPH)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: acph,
													onChange: (e) => setAcph(e.target.value === "" ? "" : Number(e.target.value)),
													placeholder: "10",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Quantity of Fans"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													min: "1",
													step: "1",
													value: fanQty,
													onChange: (e) => {
														const v = e.target.value === "" ? "" : Number(e.target.value);
														setFanQty(v);
														setNumFansMotor(v);
													},
													placeholder: "2",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 pb-2 border-b border-border/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
											children: "2. Duct Static Head Loss"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-3.5 text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Ducting Length (m)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: ductLength,
													onChange: (e) => setDuctLength(e.target.value === "" ? "" : Number(e.target.value)),
													placeholder: "20",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Frictional Factor (Pa/m)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: frictionFactor,
													onChange: (e) => setFrictionFactor(e.target.value === "" ? "" : Number(e.target.value)),
													placeholder: "1.0",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Louver & Grille Pressure Drop (Pa)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: louverLoss,
													onChange: (e) => setLouverLoss(e.target.value === "" ? "" : Number(e.target.value)),
													placeholder: "50",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Fan Internal Losses (Pa)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: fanLoss,
													onChange: (e) => setFanLoss(e.target.value === "" ? "" : Number(e.target.value)),
													placeholder: "20",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 pb-2 border-b border-border/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
											children: "3. Fan Motor Sizing"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-3.5 text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Motor Efficiency (%)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: effMotor,
													onChange: (e) => setEffMotor(e.target.value === "" ? "" : Number(e.target.value)),
													placeholder: "90",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Fan Efficiency (%)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "any",
													value: effFan,
													onChange: (e) => setEffFan(e.target.value === "" ? "" : Number(e.target.value)),
													placeholder: "75",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "font-semibold text-foreground",
													children: "Number of Fans (Motor calculation)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													min: "1",
													step: "1",
													value: numFansMotor,
													onChange: (e) => setNumFansMotor(e.target.value === "" ? "" : Number(e.target.value)),
													placeholder: "2",
													className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
												})]
											})
										]
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "lg:col-span-7 flex flex-col gap-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 pb-2 border-b border-border/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
											children: "Airflow & static head results"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Lobby Volume"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [calculatedData.volume.toFixed(1), " m\\u00b3"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Fresh Air supply"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [calculatedData.freshAirRate.toFixed(3), " m\\u00b3/s"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Flow of each fan"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-[#0A7BC7] text-[13px] font-mono",
													children: [calculatedData.flowEachLsRound, " L/s"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Total Equivalent Length"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [calculatedData.totalEqLen.toFixed(1), " m"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Equivalent Length of Fittings + Accessories"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [calculatedData.fittingsEqLen.toFixed(1), " m"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground",
													children: "Head Loss in Ducting"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-foreground font-mono",
													children: [calculatedData.frictionLoss.toFixed(1), " Pa"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center py-1.5 border-b border-border/40 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-muted-foreground text-primary",
													children: "Total Static of the Fan"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "font-bold text-[#0A7BC7] text-[14px] font-mono",
													children: [calculatedData.headRound, " Pa"]
												})]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 pb-2 border-b border-border/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans",
											children: "Motor Sizing Results"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center py-1.5 border-b border-border/40 col-span-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-semibold text-muted-foreground",
												children: "Power Required per Fan"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
												className: "font-bold text-foreground font-mono",
												children: [calculatedData.powerEachRound.toFixed(2), " kW"]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center py-1.5 col-span-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-semibold text-muted-foreground",
												children: "Total Motor Power (+10% Safety margin)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
												className: "font-bold text-[#0A7BC7] text-[14px] font-mono",
												children: [calculatedData.totalMotorPower.toFixed(2), " kW"]
											})]
										})]
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
										className: "p-5 pt-0 border-t border-border/40 text-xs font-sans flex flex-col gap-4 max-h-[400px] overflow-y-auto",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-3 items-start border-b border-border/40 pb-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
													children: "1"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-bold text-foreground",
														children: "Step 1: Lobby Volume"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-mono text-primary my-1",
														children: "V = Area × Height"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-mono text-[10.5px] text-muted-foreground",
														children: [
															"V = ",
															area,
															" m² × ",
															height,
															" m"
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-bold text-[11px] text-foreground mt-0.5",
														children: [calculatedData.volume.toFixed(2), " m³"]
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
														children: "Step 2: Fresh Air Supply Rate"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-mono text-primary my-1",
														children: "q = (Volume × ACPH) / 3600"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-mono text-[10.5px] text-muted-foreground",
														children: [
															"q = (",
															calculatedData.volume.toFixed(2),
															" m³ × ",
															acph,
															" ACPH) / 3600"
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-bold text-[11px] text-foreground mt-0.5",
														children: [calculatedData.freshAirRate.toFixed(3), " m³/s"]
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
														children: "Step 3: Sized Flow Rate per Fan"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-mono text-primary my-1",
														children: "Q_each = Ceiling( (q / qtyFans * 1000) / 5 ) * 5"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-mono text-[10.5px] text-muted-foreground",
														children: [
															"Q_each = Ceiling( (",
															calculatedData.freshAirRate.toFixed(3),
															" / ",
															fanQty,
															" × 1000) / 5 ) * 5"
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-bold text-[11px] text-[#0A7BC7] mt-0.5",
														children: [calculatedData.flowEachLsRound, " L/s"]
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
														children: "Step 4: Ducting Equivalent Length & Friction Loss"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-mono text-primary my-1",
														children: "Eq. Length = DuctLength × 1.6 | frictionLoss = Eq. Length × frictionFactor"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-mono text-[10.5px] text-muted-foreground",
														children: [
															"Eq. Length = ",
															calculatedData.totalEqLen.toFixed(1),
															" m | frictionLoss = ",
															calculatedData.totalEqLen.toFixed(1),
															" m × ",
															frictionFactor,
															" Pa/m"
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-bold text-[11px] text-foreground mt-0.5",
														children: [calculatedData.frictionLoss.toFixed(2), " Pa"]
													})
												] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-3 items-start border-b border-border/40 pb-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
													children: "5"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-bold text-foreground",
														children: "Step 5: Fan Total Static Head"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-mono text-primary my-1",
														children: "Total Head = Round( (frictionLoss + LouverDrop + FanDrop) × 1.1 ) to nearest 10"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-mono text-[10.5px] text-muted-foreground",
														children: [
															"Total Head = Round( (",
															calculatedData.frictionLoss.toFixed(2),
															" + ",
															louverLoss,
															" + ",
															fanLoss,
															") × 1.1 ) to nearest 10"
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-bold text-[11px] text-[#0A7BC7] mt-0.5",
														children: [calculatedData.headRound, " Pa"]
													})
												] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-3 items-start border-b border-border/40 pb-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
													children: "6"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-bold text-foreground",
														children: "Step 6: Sized Power per Fan"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-mono text-primary my-1",
														children: "Power = (FlowEachM3s × HeadRound) / (Eff_Motor × Eff_Fan × 1000)"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-mono text-[10.5px] text-muted-foreground",
														children: [
															"Power = (",
															calculatedData.flowEachM3s.toFixed(4),
															" m³/s × ",
															calculatedData.headRound,
															" Pa) / (",
															(Number(effMotor) || 90) / 100,
															" × ",
															(Number(effFan) || 75) / 100,
															" × 1000)"
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-bold text-[11px] text-foreground mt-0.5",
														children: [calculatedData.powerEachRound.toFixed(2), " kW"]
													})
												] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-3 items-start",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]",
													children: "7"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-bold text-foreground",
														children: "Step 7: Sized Total Motor Power"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-mono text-primary my-1",
														children: "Total Power = PowerEach × 1.1 × qtyFans (Motor calculation)"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-mono text-[10.5px] text-muted-foreground",
														children: [
															"Total Power = ",
															calculatedData.powerEachRound.toFixed(2),
															" kW × 1.1 × ",
															numFansMotor
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "font-bold text-[11px] text-[#0A7BC7] mt-0.5",
														children: [calculatedData.totalMotorPower.toFixed(2), " kW"]
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
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Calculates fresh air requirements in accordance with NFPA 92 and BS EN 12101-6." }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Friction loss calculation uses equivalent length sizers for typical fitting indices ($1.6 \\times$ duct length)." }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Fan motor sizing includes a $+10\\%$ electrical security factor applied to nominal shaft horsepower outputs." })
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
							children: "Save Current Lobby Pressurisation"
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
								placeholder: "e.g. Zone A Ground Floor",
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
							children: saves.filter((s) => s.type === "lobby-press").length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-center py-6 text-muted-foreground text-xs",
								children: "📭 No saved calculations found."
							}) : saves.filter((s) => s.type === "lobby-press").map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
												"Area: ",
												s.values["lp-area"],
												"m² · Ht: ",
												s.values["lp-height"],
												"m · ACPH: ",
												s.values["lp-acph"]
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
export { LobbyPressurisationPage as component };
