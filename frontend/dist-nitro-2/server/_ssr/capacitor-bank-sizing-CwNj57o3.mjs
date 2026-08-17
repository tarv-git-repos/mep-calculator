import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Dt as ChevronUp, N as Plus, Ut as Activity, _t as Download, kt as ChevronDown, n as X, t as Zap } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-urg-0zDa.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { t as ImportExcelBtn } from "./ImportExcelBtn-rAnQAoVD.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/capacitor-bank-sizing-CwNj57o3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
var defaultPanel = (id) => ({
	id: id.toString(),
	name: `SS1-LV-0${id}`,
	panelRef: `PFC (LV PANEL-0${id})`,
	totalLoadKw: 1688.8,
	maxDemandLoadKw: 1097.7,
	initialPf: .8,
	targetPf: .9,
	stepUnit: 50,
	overcurrentFactor: 1.35,
	voltageKv: .4
});
function CapacitorBankSizingPage() {
	const [project, setProject] = (0, import_react.useState)("");
	const [sub, setSub] = (0, import_react.useState)("");
	const [panels, setPanels] = (0, import_react.useState)([defaultPanel(1)]);
	const [activePanelId, setActivePanelId] = (0, import_react.useState)("1");
	const [nextId, setNextId] = (0, import_react.useState)(2);
	const [showMathId, setShowMathId] = (0, import_react.useState)(null);
	const updatePanel = (id, field, value) => {
		setPanels(panels.map((p) => p.id === id ? {
			...p,
			[field]: value
		} : p));
	};
	const addPanel = () => {
		const newPanel = defaultPanel(nextId);
		setPanels([...panels, newPanel]);
		setActivePanelId(newPanel.id);
		setNextId(nextId + 1);
	};
	const removePanel = (id, e) => {
		e.stopPropagation();
		if (panels.length <= 1) return;
		setPanels(panels.filter((p) => p.id !== id));
		if (activePanelId === id) setActivePanelId(null);
	};
	const calculatePanel = (p) => {
		const demand = Number(p.maxDemandLoadKw) || 0;
		const pf1 = Number(p.initialPf) || 1;
		const pf2 = Number(p.targetPf) || 1;
		const safePf1 = Math.min(Math.max(pf1, .1), 1);
		const safePf2 = Math.min(Math.max(pf2, .1), 1);
		const theta1Rad = Math.acos(safePf1);
		const theta2Rad = Math.acos(safePf2);
		const theta1Deg = theta1Rad * (180 / Math.PI);
		const theta2Deg = theta2Rad * (180 / Math.PI);
		const tanTheta1 = Math.tan(theta1Rad);
		const tanTheta2 = Math.tan(theta2Rad);
		const tanThetaDiff = tanTheta1 - tanTheta2;
		const requiredKvar = demand * tanThetaDiff;
		let proposedKvar = Math.ceil(requiredKvar / 25) * 25;
		if (proposedKvar <= 0) proposedKvar = 25;
		const numFullSteps = Math.floor(proposedKvar / p.stepUnit);
		const remainderStep = proposedKvar % p.stepUnit;
		const initialKva = demand / safePf1;
		const targetKva = demand / safePf2;
		const initialKvar = Math.sin(theta1Rad) * initialKva;
		const targetKvar = Math.sin(theta2Rad) * targetKva;
		const ampI = p.overcurrentFactor * proposedKvar / (1.732 * p.voltageKv);
		return {
			theta1Deg,
			theta2Deg,
			tanTheta1,
			tanTheta2,
			tanThetaDiff,
			requiredKvar,
			proposedKvar,
			numFullSteps,
			remainderStep,
			initialKva,
			targetKva,
			initialKvar,
			targetKvar,
			ampI
		};
	};
	const exportPdf = () => {
		const doc = new import_jspdf_node_min.jsPDF();
		const base64ImageURL = getDiagramBase64();
		panels.forEach((p, index) => {
			if (index > 0) doc.addPage();
			const c = calculatePanel(p);
			doc.setFontSize(14);
			doc.setFont("helvetica", "bold");
			doc.text("P.F. CORRECTION CAPACITOR CALCULATION", 14, 20);
			doc.setFontSize(10);
			doc.setFont("helvetica", "normal");
			doc.text(`PROJECT: ${project}`, 14, 30);
			doc.text(`PANEL REF: ${p.panelRef}`, 14, 36);
			doc.text(`Total Connected Load = ${p.totalLoadKw} kW`, 14, 50);
			doc.text(`Max Demand Load (IFC) = ${p.maxDemandLoadKw} kW`, 14, 56);
			doc.text(`Assumed Existing P.F = ${p.initialPf}`, 14, 68);
			doc.text(`Target P.F = ${p.targetPf}`, 14, 74);
			doc.text(`θ1 = ${c.theta1Deg.toFixed(2)}°`, 14, 86);
			doc.text(`θ2 = ${c.theta2Deg.toFixed(2)}°`, 14, 92);
			doc.text(`Tan θ = ${c.tanThetaDiff.toFixed(3)} kVAr/kW`, 14, 98);
			doc.setFont("helvetica", "bold");
			doc.text(`Therefore kVAr = ${c.requiredKvar.toFixed(2)} kVAr`, 14, 110);
			doc.text(`Proposed Capacitor Bank = ${c.proposedKvar} kVAr`, 14, 118);
			doc.setFont("helvetica", "normal");
			doc.text("STEPS OF CAPACITOR BANK:", 100, 118);
			let y = 126;
			for (let i = 0; i < c.numFullSteps; i++) {
				doc.text(`STEP-${i + 1} = ${p.stepUnit}kVAr(2x${p.stepUnit / 2}kVAr)`, 100, y);
				y += 6;
			}
			if (c.remainderStep > 0) {
				doc.text(`STEP-${c.numFullSteps + 1} = ${c.remainderStep}kVAr(2x${c.remainderStep / 2}kVAr)`, 100, y);
				y += 6;
			}
			doc.setFont("helvetica", "bold");
			doc.text(`TOTAL = ${c.proposedKvar} kVAr CAPACITORS`, 100, y + 2);
			doc.setFont("helvetica", "bold");
			doc.text(`Amp (I) = (${p.overcurrentFactor} X kVAr)/(1.732 X ${p.voltageKv})`, 14, 130);
			doc.text(`Amp (I) = ${c.ampI.toFixed(2)} A`, 14, 136);
			if (base64ImageURL) doc.addImage(base64ImageURL, "PNG", 100, 40, 90, 56);
		});
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), "Capacitor_Bank_Calculations.pdf", "PDF Document", ["pdf"]);
	};
	const handleImportExcelRows = (mappedRows) => {
		const newPanels = mappedRows.map((mr, idx) => ({
			id: `cap_import_${Date.now()}_${idx}`,
			name: mr.name || `Imported Panel ${idx + 1}`,
			panelRef: mr.panelRef || "",
			totalLoadKw: Number(mr.totalLoadKw) || 0,
			maxDemandLoadKw: Number(mr.maxDemandLoadKw) || 0,
			existingPf: Number(mr.existingPf) || .8,
			targetPf: Number(mr.targetPf) || .95,
			capacitorStepSize: Number(mr.capacitorStepSize) || 50,
			voltageKv: Number(mr.voltageKv) || .4,
			overcurrentFactor: Number(mr.overcurrentFactor) || 1.43
		}));
		setPanels((prev) => [...prev, ...newPanels]);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Capacitor Bank Sizing",
		hideSubHeader: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col h-full overflow-hidden pt-4 gap-4 bg-slate-50/30 dark:bg-slate-950/30 relative",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between items-start shrink-0 select-none no-print modal-blur-bg px-4 z-10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
								children: "ELECTRICAL > CAPACITOR BANK SIZING"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center gap-3 mt-0.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "text-[28px] font-bold tracking-tight text-foreground",
									children: "Capacitor Bank Sizing"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground mt-0.5",
								children: "P.F. Correction Capacitor Calculation"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center gap-2 flex-wrap",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportExcelBtn, {
							columnMapping: {
								"Name": "name",
								"Panel Ref": "panelRef",
								"Total Load (kW)": "totalLoadKw",
								"Max Demand Load (kW)": "maxDemandLoadKw",
								"Existing PF": "existingPf",
								"Target PF": "targetPf",
								"Step Size": "capacitorStepSize",
								"Voltage (kV)": "voltageKv",
								"Overcurrent Factor": "overcurrentFactor"
							},
							onImport: handleImportExcelRows
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
							onClick: exportPdf,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" }), " PDF"]
						})] })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 overflow-y-auto p-4 z-10 min-h-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 mb-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 flex flex-col gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "text-[10px] font-bold text-muted-foreground uppercase tracking-wider",
								children: "Report Project Name"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: project,
								onChange: (e) => setProject(e.target.value),
								placeholder: "e.g. Marina Bay Tower",
								className: "h-9 px-3 bg-surface-2 border border-transparent focus:border-primary rounded-xl text-[13px] outline-none transition-colors w-full"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 flex flex-col gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "text-[10px] font-bold text-muted-foreground uppercase tracking-wider",
								children: "Report Sub/System Reference"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: sub,
								onChange: (e) => setSub(e.target.value),
								placeholder: "e.g. Substation-1 LV Board",
								className: "h-9 px-3 bg-surface-2 border border-transparent focus:border-primary rounded-xl text-[13px] outline-none transition-colors w-full"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-full flex flex-col gap-4",
						children: [panels.map((p) => {
							const isActive = activePanelId === p.id;
							const calc = calculatePanel(p);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `flex flex-col bg-white/60 dark:bg-black/40 backdrop-blur-xl border rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all overflow-hidden ${isActive ? "border-white/80 dark:border-white/30 shadow-lg" : "border-white/50 dark:border-white/10 hover:border-white/80 dark:hover:border-white/30"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									onClick: () => setActivePanelId(isActive ? null : p.id),
									className: `flex flex-col sm:flex-row items-start sm:items-center justify-between py-2 px-4 cursor-pointer transition-colors ${isActive ? "bg-primary/5" : "bg-white/40 dark:bg-white/5 hover:bg-white/50 dark:hover:bg-white/10"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3 w-full sm:w-auto",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: `p-1 rounded ${isActive ? "bg-primary text-primary-foreground" : "bg-surface-3 text-muted-foreground"}`,
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-3" })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "text",
													value: p.name,
													onChange: (e) => updatePanel(p.id, "name", e.target.value),
													onClick: (e) => e.stopPropagation(),
													className: `bg-transparent outline-none font-bold text-sm w-28 focus:ring-1 focus:ring-primary/20 rounded px-1 transition-colors ${isActive ? "text-primary" : "text-foreground"}`,
													placeholder: "Panel Name"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-4 w-px bg-border hidden sm:block" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												value: p.panelRef,
												onChange: (e) => updatePanel(p.id, "panelRef", e.target.value),
												onClick: (e) => e.stopPropagation(),
												className: "bg-transparent outline-none text-xs text-muted-foreground w-40 focus:ring-1 focus:ring-primary/20 rounded px-1 hidden sm:block",
												placeholder: "Panel Reference"
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3 mt-1 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-baseline gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:block",
												children: "Total Cap:"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: `text-sm font-black font-mono ${isActive ? "text-primary" : "text-foreground"}`,
												children: [
													calc.proposedKvar,
													" ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] font-bold text-muted-foreground",
														children: "kVAr"
													})
												]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: (e) => removePanel(p.id, e),
												className: `p-1 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors ${panels.length <= 1 ? "hidden" : ""}`,
												title: "Remove Panel",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "p-0.5",
												children: isActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-4 text-muted-foreground" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted-foreground" })
											})]
										})]
									})]
								}), isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "p-3 sm:p-4 border-t border-border/50 animate-in slide-in-from-top-2 duration-200",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-1 lg:grid-cols-[2fr_1fr] xl:grid-cols-[3fr_2fr] gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex flex-col gap-3",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "bg-white/40 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-1",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																className: "text-[9px] font-bold text-muted-foreground uppercase tracking-widest",
																children: "Total Connected Load (kW)"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																className: "h-7 px-2 bg-surface-1 border border-border rounded outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all font-mono text-[11px]",
																value: p.totalLoadKw,
																onChange: (e) => updatePanel(p.id, "totalLoadKw", e.target.value === "" ? "" : Number(e.target.value))
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-1",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																className: "text-[9px] font-bold text-muted-foreground uppercase tracking-widest",
																children: "Max Demand Load (IFC)"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																className: "h-7 px-2 bg-primary/5 border border-primary/20 rounded outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary transition-all font-mono text-[11px] text-primary font-bold",
																value: p.maxDemandLoadKw,
																onChange: (e) => updatePanel(p.id, "maxDemandLoadKw", e.target.value === "" ? "" : Number(e.target.value))
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "col-span-1 sm:col-span-2 h-px bg-border/50 my-0.5" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-1",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																className: "text-[9px] font-bold text-muted-foreground uppercase tracking-widest",
																children: "Assumed Existing P.F."
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																step: "0.01",
																className: "h-7 px-2 bg-surface-1 border border-border rounded outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all font-mono text-[11px]",
																value: p.initialPf,
																onChange: (e) => updatePanel(p.id, "initialPf", e.target.value === "" ? "" : Number(e.target.value))
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-1",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																className: "text-[9px] font-bold text-muted-foreground uppercase tracking-widest",
																children: "Target P.F."
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																step: "0.01",
																className: "h-7 px-2 bg-surface-1 border border-border rounded outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all font-mono text-[11px]",
																value: p.targetPf,
																onChange: (e) => updatePanel(p.id, "targetPf", e.target.value === "" ? "" : Number(e.target.value))
															})]
														})
													]
												})
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-primary rounded-2xl shadow-xl overflow-hidden relative border border-primary/20",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "p-4 flex flex-col gap-3 relative z-10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-primary-foreground/80 text-[9px] font-bold uppercase tracking-widest",
																children: "Proposed Capacitor Bank"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex items-baseline gap-1.5",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-3xl font-black tracking-tight text-white",
																	children: calc.proposedKvar
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-sm font-bold text-primary-foreground/90",
																	children: "kVAr"
																})]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-px bg-white/20 w-full" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-primary-foreground/80 text-[9px] font-bold uppercase tracking-widest mb-0.5",
																children: "Required Breaker Amp (I)"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex items-center justify-between",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																	className: "text-xl font-black text-white drop-shadow-sm tracking-tight",
																	children: [calc.ampI.toFixed(2), " A"]
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																	className: "text-[9px] font-mono text-primary-foreground/90 bg-black/10 px-1.5 py-0.5 rounded border border-white/10",
																	children: [
																		"(",
																		p.overcurrentFactor,
																		"×kVAr)/(1.732×",
																		p.voltageKv,
																		")"
																	]
																})]
															})]
														})
													]
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white/40 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl shadow-xl p-4 h-full flex flex-col justify-center gap-4 relative overflow-hidden",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													onClick: () => setShowMathId(showMathId === p.id ? null : p.id),
													className: "w-full bg-surface-1/50 hover:bg-surface-2 transition-colors border-b border-border px-3 py-2 flex items-center justify-between",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "size-3 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
															className: "text-[9px] font-bold tracking-widest uppercase text-muted-foreground",
															children: "Mathematical Breakdown"
														})]
													}), showMathId === p.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-3 text-muted-foreground" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3 text-muted-foreground" })]
												}), showMathId === p.id && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "p-3 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200 bg-surface-1/20",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center justify-between pb-1.5 border-b border-border/50 text-[10px]",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "text-muted-foreground",
																children: ["Initial P.F (Cos θ1) = ", Number(p.initialPf).toFixed(2)]
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "font-mono",
																children: [
																	"θ1 = ",
																	calc.theta1Deg.toFixed(1),
																	"°"
																]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center justify-between pb-1.5 border-b border-border/50 text-[10px]",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "text-muted-foreground",
																children: ["Corrective P.F (Cos θ2) = ", Number(p.targetPf).toFixed(2)]
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "font-mono",
																children: [
																	"θ2 = ",
																	calc.theta2Deg.toFixed(1),
																	"°"
																]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center justify-between pb-1.5 border-b border-border/50 text-[10px]",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-muted-foreground",
																children: "Tan θ (Tan θ1 - Tan θ2)"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-mono text-primary font-medium",
																children: calc.tanThetaDiff.toFixed(3)
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "bg-primary/5 rounded p-2 border border-primary/10 flex items-center justify-between mt-1",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-primary font-bold text-[9px] uppercase tracking-wider",
																children: "kVAr = kW × Tan θ"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "font-mono font-bold text-primary text-[10px]",
																children: [calc.requiredKvar.toFixed(2), " kVAr"]
															})]
														})
													]
												})]
											})]
										})]
									})
								})]
							}, p.id);
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: addPanel,
							className: "w-full flex items-center justify-center gap-1 py-3 border border-dashed border-primary/30 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary font-bold transition-all text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Add New Panel"]
						})]
					})]
				})
			]
		})
	});
}
function getDiagramBase64() {
	const canvas = document.createElement("canvas");
	canvas.width = 400;
	canvas.height = 250;
	const ctx = canvas.getContext("2d");
	if (!ctx) return "";
	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, 400, 250);
	ctx.strokeStyle = "black";
	ctx.lineWidth = 1.5;
	ctx.font = "13px Arial";
	ctx.fillStyle = "black";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	const originX = 60;
	const originY = 200;
	const kwWidth = 200;
	const kvar1Height = 150;
	const kvar2Height = 80;
	ctx.beginPath();
	ctx.moveTo(originX, originY);
	ctx.lineTo(260, originY);
	ctx.stroke();
	ctx.fillText("KW", 160, 215);
	ctx.beginPath();
	ctx.moveTo(260, originY);
	ctx.lineTo(260, originY - kvar1Height);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(originX, originY);
	ctx.lineTo(260, originY - kvar1Height);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(originX, originY);
	ctx.lineTo(260, originY - kvar2Height);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(originX, originY, 40, 0, -Math.atan2(kvar2Height, kwWidth), true);
	ctx.stroke();
	ctx.fillText("θ2", 110, originY - 10);
	ctx.beginPath();
	ctx.arc(originX, originY, 70, 0, -Math.atan2(kvar1Height, kwWidth), true);
	ctx.stroke();
	ctx.fillText("θ1", 140, originY - 25);
	ctx.fillText("θ", 160, originY - 50);
	const dimX1 = 280;
	ctx.beginPath();
	ctx.moveTo(265, originY);
	ctx.lineTo(290, originY);
	ctx.moveTo(265, originY - kvar2Height);
	ctx.lineTo(290, originY - kvar2Height);
	ctx.moveTo(dimX1, originY);
	ctx.lineTo(dimX1, originY - kvar2Height);
	ctx.stroke();
	ctx.save();
	ctx.translate(dimX1 - 8, originY - kvar2Height / 2);
	ctx.rotate(-Math.PI / 2);
	ctx.fillText("KVAR - II", 0, 0);
	ctx.restore();
	const dimX2 = 310;
	ctx.beginPath();
	ctx.moveTo(290, originY);
	ctx.lineTo(320, originY);
	ctx.moveTo(265, originY - kvar1Height);
	ctx.lineTo(320, originY - kvar1Height);
	ctx.moveTo(dimX2, originY);
	ctx.lineTo(dimX2, originY - kvar1Height);
	ctx.stroke();
	ctx.save();
	ctx.translate(dimX2 - 8, originY - kvar1Height / 2);
	ctx.rotate(-Math.PI / 2);
	ctx.fillText("KVAR - I", 0, 0);
	ctx.restore();
	ctx.save();
	const angleKva = -Math.atan2(kvar1Height, kwWidth);
	ctx.translate(145, originY - kvar1Height / 2 - 15);
	ctx.rotate(angleKva);
	ctx.fillText("KVA", 0, 0);
	ctx.restore();
	return canvas.toDataURL("image/png");
}
//#endregion
export { CapacitorBankSizingPage as component };
