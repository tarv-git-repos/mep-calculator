import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-Ct3ePlL1.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Gt as Sparkles, M as Printer, Wt as TriangleAlert, Y as Info, lt as FileText, n as X } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-urg-0zDa.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-fm200-BPc7d14n.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
function FM200SizerPage() {
	const { project } = useWorkspace();
	const [tab, setTab] = (0, import_react.useState)("solver");
	const [intelOpen, setIntelOpen] = (0, import_react.useState)(false);
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("si");
	const [area, setArea] = (0, import_react.useState)(100);
	const [height, setHeight] = (0, import_react.useState)(3);
	const [preset, setPreset] = (0, import_react.useState)("class_a");
	const [customConc, setCustomConc] = (0, import_react.useState)(7);
	const [temp, setTemp] = (0, import_react.useState)(20);
	const [useStandardS, setUseStandardS] = (0, import_react.useState)(true);
	const [safetyFactor, setSafetyFactor] = (0, import_react.useState)(1);
	const handleUnitSystemChange = (system) => {
		setUnitSystem(system);
		if (system === "si") {
			setTemp(20);
			setArea((prev) => {
				return Math.round((prev === "" ? 0 : prev) / 10.7639 * 10) / 10 || 100;
			});
			setHeight((prev) => {
				return Math.round((prev === "" ? 0 : prev) / 3.28084 * 10) / 10 || 3;
			});
		} else {
			setTemp(68);
			setArea((prev) => {
				return Math.round((prev === "" ? 0 : prev) * 10.7639 * 10) / 10 || 1e3;
			});
			setHeight((prev) => {
				return Math.round((prev === "" ? 0 : prev) * 3.28084 * 10) / 10 || 10;
			});
		}
	};
	const calcResults = (0, import_react.useMemo)(() => {
		const isSI = unitSystem === "si";
		const areaVal = area === "" ? 0 : area;
		const heightVal = height === "" ? 0 : height;
		const customConcVal = customConc === "" ? 0 : customConc;
		const tempVal = temp === "" ? 0 : temp;
		const safetyFactorVal = safetyFactor === "" ? 1 : safetyFactor;
		const volume = areaVal * heightVal;
		let C = 6.857;
		if (preset === "class_b") C = 8.7;
		else if (preset === "class_c") C = 7;
		else if (preset === "custom") C = customConcVal;
		let S = .1473;
		if (useStandardS) if (isSI) S = .1473;
		else S = 2.3595;
		else if (isSI) S = .1269 + 513e-6 * tempVal;
		else S = 1.885 + .0046 * tempVal;
		let weight = 0;
		if (S > 0 && 100 - C > 0) weight = volume / S * (C / (100 - C)) * safetyFactorVal;
		const warnings = [];
		if (C > 9) warnings.push("Design concentration exceeds the human exposure NOAEL limit of 9.0%. For occupied spaces, limit exposure time per NFPA 2001.");
		if (C > 10.5) warnings.push("Design concentration exceeds the human exposure LOAEL limit of 10.5%. Strictly restrict occupancy or ensure rapid evacuation.");
		if (C < 5.8) warnings.push("Design concentration is below the minimum UL/FM listing concentration of 5.8% for HFC-227ea systems.");
		if (areaVal <= 0 || heightVal <= 0) warnings.push("Area and height must be positive, non-zero values.");
		return {
			volume,
			C,
			S,
			weight,
			warnings
		};
	}, [
		area,
		height,
		preset,
		customConc,
		temp,
		useStandardS,
		safetyFactor,
		unitSystem
	]);
	const areaVal = typeof area === "number" ? area : 0;
	const heightVal = typeof height === "number" ? height : 0;
	const safetyFactorVal = typeof safetyFactor === "number" ? safetyFactor : 1;
	const exportPdf = () => {
		const isSI = unitSystem === "si";
		const doc = new import_jspdf_node_min.default();
		doc.setFont("helvetica", "bold");
		doc.setFontSize(16);
		doc.setTextColor(220, 76, 52);
		doc.text("FM-200 Gas Suppression Sizing Report", 14, 20);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(10);
		doc.setTextColor(80, 80, 80);
		doc.text(`Project: ${project.name} (${project.code})`, 14, 28);
		doc.text(`Standard: NFPA 2001 Standard on Clean Agent Fire Extinguishing Systems`, 14, 34);
		autoTable(doc, {
			startY: 42,
			head: [[
				"Design Parameter",
				"Calculated Value",
				"Unit"
			]],
			body: [
				[
					"Enclosure Area",
					areaVal.toFixed(2),
					isSI ? "m²" : "ft²"
				],
				[
					"Enclosure Height",
					heightVal.toFixed(2),
					isSI ? "m" : "ft"
				],
				[
					"Enclosure Volume",
					calcResults.volume.toFixed(2),
					isSI ? "m³" : "ft³"
				],
				[
					"Hazard Classification",
					preset.replace("_", " ").toUpperCase(),
					""
				],
				[
					"Design Concentration (C)",
					calcResults.C.toFixed(3),
					"%"
				],
				[
					"Design Temp (T)",
					temp.toString(),
					isSI ? "°C" : "°F"
				],
				[
					"Specific Volume (S)",
					calcResults.S.toFixed(4),
					isSI ? "m³/kg" : "ft³/lb"
				],
				[
					"Safety Margin Factor",
					safetyFactorVal.toFixed(2),
					""
				],
				[
					"Required FM-200 Agent Weight",
					calcResults.weight.toFixed(2),
					isSI ? "kg" : "lb"
				]
			],
			theme: "striped",
			styles: { fontSize: 10 },
			headStyles: { fillColor: [
				220,
				76,
				52
			] }
		});
		const finalY = doc.lastAutoTable.finalY + 10;
		doc.setFontSize(9);
		doc.setFont("helvetica", "bold");
		doc.text("System Design Warnings / Notes:", 14, finalY);
		doc.setFont("helvetica", "italic");
		doc.setFontSize(8);
		doc.text("- Enclosure leakage testing (Door Fan Test) is required to ensure 10-minute agent retention holding time.", 14, finalY + 5);
		doc.text("- Max discharge time target: 10 seconds per NFPA 2001 to prevent high concentration of decomposition products.", 14, finalY + 9);
		if (calcResults.C > 9) doc.text("- WARNING: Design concentration exceeds human exposure limits for occupied zones.", 14, finalY + 13);
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), `FM200_Sizing_Report_${project.code}.pdf`, "PDF Document", ["pdf"]);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "FM-200 Calculation",
		hideSubHeader: true,
		onIntelClick: () => setIntelOpen((v) => !v),
		intelOpen,
		intelLabel: "Reference & Guide",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex h-full min-h-0 bg-transparent",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-between items-start shrink-0 select-none no-print modal-blur-bg px-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1 w-full",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
							children: "FIRE FIGHTING > FM-200 CLEAN AGENT SIZER"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 mt-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "text-[28px] font-bold tracking-tight text-foreground",
									children: "FM-200 Gas Sizing"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[15px] font-semibold text-muted-foreground",
									children: "Total flooding clean agent sizer (NFPA 2001)"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setIntelOpen((v) => !v),
								className: `flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${intelOpen ? "bg-primary text-primary-foreground border-primary" : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }), "Reference & Guide"]
							})]
						})]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-card border border-border rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden mx-6 mb-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setTab("solver"),
								className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${tab === "solver" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Sizing Calculator"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setTab("report"),
								className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${tab === "report" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Printable Report"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex bg-surface-2 p-1 rounded-full gap-1 border border-border/85",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => handleUnitSystemChange("ip"),
								className: `px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${unitSystem === "ip" ? "bg-background text-primary shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Imperial (IP)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => handleUnitSystemChange("si"),
								className: `px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${unitSystem === "si" ? "bg-background text-primary shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Metric (SI)"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 min-h-0 overflow-hidden flex flex-col",
						children: [tab === "solver" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1 min-h-0 overflow-y-auto",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex-1 min-w-0 p-6 flex flex-col gap-6 max-w-3xl",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border rounded-3xl bg-background shadow-sm overflow-hidden",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-surface px-4 py-2 border-b border-border flex items-center justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "text-[12.5px] font-bold uppercase tracking-wider text-foreground",
													children: "Enclosure Layout"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[11px] font-mono text-muted-foreground",
													children: "Dimensions"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "p-4 grid grid-cols-2 gap-4",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col gap-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
														className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
														children: [
															"Floor Area (",
															unitSystem === "si" ? "m²" : "ft²",
															")"
														]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														value: area,
														onChange: (e) => setArea(e.target.value === "" ? "" : parseFloat(e.target.value) || 0),
														className: "h-10 rounded-xl border border-border px-3 text-[12.5px] bg-background text-foreground focus:border-primary focus:outline-none",
														placeholder: "e.g. 100",
														step: "any"
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col gap-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
														className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
														children: [
															"Enclosure Height (",
															unitSystem === "si" ? "m" : "ft",
															")"
														]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														value: height,
														onChange: (e) => setHeight(e.target.value === "" ? "" : parseFloat(e.target.value) || 0),
														className: "h-10 rounded-xl border border-border px-3 text-[12.5px] bg-background text-foreground focus:border-primary focus:outline-none",
														placeholder: "e.g. 3",
														step: "any"
													})]
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border rounded-3xl bg-background shadow-sm overflow-hidden",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-surface px-4 py-2 border-b border-border flex items-center justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "text-[12.5px] font-bold uppercase tracking-wider text-foreground",
													children: "Design Parameters"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[11px] font-mono text-muted-foreground",
													children: "NFPA 2001"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "p-4 flex flex-col gap-4",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "grid grid-cols-2 gap-4",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-1.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
																children: "Hazard Classification"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																value: preset,
																onChange: (e) => setPreset(e.target.value),
																className: "h-10 rounded-xl border border-border px-3 text-[12.5px] bg-background text-foreground focus:border-primary focus:outline-none",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "class_a",
																		children: "Class A - Surface Fire (6.857%)"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "class_c",
																		children: "Class C - Electrical Hazards (7.00%)"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "class_b",
																		children: "Class B - Flammable Liquid (8.70%)"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "custom",
																		children: "Custom Concentration %"
																	})
																]
															})]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-1.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
																children: "Design Concentration (C %)"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																disabled: preset !== "custom",
																value: preset === "custom" ? customConc : calcResults.C,
																onChange: (e) => setCustomConc(e.target.value === "" ? "" : parseFloat(e.target.value) || 0),
																className: "h-10 rounded-xl border border-border px-3 text-[12.5px] bg-background text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2 disabled:text-muted-foreground",
																placeholder: "e.g. 7.0",
																step: "0.01"
															})]
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "grid grid-cols-2 gap-4 border-t border-border pt-4",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-1.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
																className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
																children: [
																	"Minimum Temperature (",
																	unitSystem === "si" ? "°C" : "°F",
																	")"
																]
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																value: temp,
																onChange: (e) => setTemp(e.target.value === "" ? "" : parseFloat(e.target.value) || 0),
																className: "h-10 rounded-xl border border-border px-3 text-[12.5px] bg-background text-foreground focus:border-primary focus:outline-none",
																placeholder: "e.g. 20",
																step: "any"
															})]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-1.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
																children: "Safety Factor Multiplier"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																value: safetyFactor,
																onChange: (e) => setSafetyFactor(e.target.value === "" ? "" : parseFloat(e.target.value) || 1),
																className: "h-10 rounded-xl border border-border px-3 text-[12.5px] bg-background text-foreground focus:border-primary focus:outline-none",
																placeholder: "e.g. 1.0",
																step: "0.05"
															})]
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center justify-between border-t border-border pt-4",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[12.5px] font-medium text-foreground",
																children: "Lock S Value to Standard Default"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "text-[11px] text-muted-foreground",
																children: [
																	"Forces $S$ to ",
																	unitSystem === "si" ? "0.1473 m³/kg" : "2.3595 ft³/lb",
																	" (Baseline reference temperature)"
																]
															})]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "checkbox",
															checked: useStandardS,
															onChange: (e) => setUseStandardS(e.target.checked),
															className: "size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
														})]
													})
												]
											})]
										}),
										area !== "" && height !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border rounded-3xl bg-background p-4 shadow-sm flex flex-col gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2 border-b border-border pb-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "text-[13px] font-bold uppercase tracking-wider text-foreground",
													children: "NFPA 2001 Formula Breakdown"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[12.5px] text-foreground space-y-2.5",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The clean agent flooding weight is calculated according to NFPA 2001 Clause 5.5.1:" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "bg-surface-2 p-3 rounded-2xl font-mono text-[11.5px] text-center border border-border",
														children: "W = (V / S) × (C / (100 - C)) × SafetyFactor"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-1",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex justify-between border-b border-border/40 py-1",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "font-semibold",
																	children: "V (Volume):"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
																	areaVal.toFixed(2),
																	" × ",
																	heightVal.toFixed(2),
																	" = ",
																	calcResults.volume.toFixed(2),
																	" ",
																	unitSystem === "si" ? "m³" : "ft³"
																] })]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex justify-between border-b border-border/40 py-1",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "font-semibold",
																	children: "S (Specific Volume):"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: useStandardS ? `${calcResults.S.toFixed(4)} (Locked baseline)` : unitSystem === "si" ? `0.1269 + (0.000513 × ${temp}°C) = ${calcResults.S.toFixed(4)} m³/kg` : `1.885 + (0.0046 × ${temp}°F) = ${calcResults.S.toFixed(4)} ft³/lb` })]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex justify-between border-b border-border/40 py-1",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "font-semibold",
																	children: "C (Design Concentration):"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [calcResults.C.toFixed(3), " %"] })]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex justify-between border-b border-border/40 py-1",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "font-semibold",
																	children: "Safety Multiplier:"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: safetyFactorVal.toFixed(2) })]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex justify-between py-1 text-primary font-semibold",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total Weight (W):" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
																	"(",
																	calcResults.volume.toFixed(2),
																	" / ",
																	calcResults.S.toFixed(4),
																	") × (",
																	calcResults.C.toFixed(3),
																	" / ",
																	(100 - calcResults.C).toFixed(3),
																	") × ",
																	safetyFactorVal.toFixed(2),
																	" = ",
																	calcResults.weight.toFixed(2),
																	" ",
																	unitSystem === "si" ? "kg" : "lb"
																] })]
															})
														]
													})
												]
											})]
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "w-full md:w-80 shrink-0 bg-surface/50 p-6 flex flex-col gap-6",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[13px] font-bold text-foreground uppercase tracking-wider",
										children: "Calculation Results"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[11.5px] text-muted-foreground",
										children: "Flooding weight outputs"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl bg-background p-4 flex flex-col gap-1 shadow-sm",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
													children: "Flooded Enclosure Volume"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[20px] font-bold tracking-tight font-mono text-primary",
													children: [
														calcResults.volume.toFixed(2),
														" ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[13px] font-normal",
															children: unitSystem === "si" ? "m³" : "ft³"
														})
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl bg-background p-4 flex flex-col gap-1 shadow-sm border-l-4 border-l-primary",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
														children: "Required FM-200 Agent Weight"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-[24px] font-bold tracking-tight font-mono text-primary",
														children: [
															calcResults.weight.toFixed(2),
															" ",
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[14px] font-normal",
																children: unitSystem === "si" ? "kg" : "lb"
															})
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-[10.5px] text-muted-foreground mt-1",
														children: [
															"Design Concentration: ",
															calcResults.C.toFixed(2),
															"%"
														]
													})
												]
											}),
											calcResults.warnings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-warning/20 bg-warning/5 rounded-3xl p-3 text-[12px] flex flex-col gap-1.5 text-foreground",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-1.5 text-warning font-semibold",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "NFPA 2001 Compliance Warning" })]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
													className: "list-disc pl-4 space-y-1 text-muted-foreground text-[11px]",
													children: calcResults.warnings.map((warn, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: warn }, i))
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl bg-background p-3 shadow-sm flex flex-col gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground block",
													children: "Agent Sizing Chart"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "bg-surface/50 rounded-2xl flex justify-center py-2 border border-border/50",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
														width: "220",
														height: "150",
														className: "overflow-visible",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
																x: "20",
																y: "20",
																width: "180",
																height: "90",
																rx: "12",
																fill: "none",
																stroke: "#E2E8F0",
																strokeWidth: "2",
																strokeDasharray: "3 3"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
																x: "21",
																y: "21",
																width: "178",
																height: "88",
																rx: "11",
																fill: "#0A7BC7",
																fillOpacity: calcResults.weight > 0 ? .15 : .02
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
																cx: "65",
																cy: "20",
																r: "3",
																fill: "#ef4444"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
																cx: "155",
																cy: "20",
																r: "3",
																fill: "#ef4444"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
																x1: "65",
																y1: "20",
																x2: "65",
																y2: "35",
																stroke: "#ef4444",
																strokeWidth: "1.5"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
																x1: "155",
																y1: "20",
																x2: "155",
																y2: "35",
																stroke: "#ef4444",
																strokeWidth: "1.5"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
																d: "M 60 38 Q 65 33 70 38",
																fill: "none",
																stroke: "#ef4444",
																strokeWidth: "1",
																opacity: "0.8"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
																d: "M 57 41 Q 65 31 73 41",
																fill: "none",
																stroke: "#ef4444",
																strokeWidth: "1",
																opacity: "0.6"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
																d: "M 150 38 Q 155 33 160 38",
																fill: "none",
																stroke: "#ef4444",
																strokeWidth: "1",
																opacity: "0.8"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
																d: "M 147 41 Q 155 31 163 41",
																fill: "none",
																stroke: "#ef4444",
																strokeWidth: "1",
																opacity: "0.6"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("text", {
																x: "110",
																y: "65",
																textAnchor: "middle",
																fontSize: "11",
																fontWeight: "bold",
																fill: "#334155",
																children: [
																	calcResults.volume.toFixed(1),
																	" ",
																	unitSystem === "si" ? "m³" : "ft³"
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
																x: "110",
																y: "82",
																textAnchor: "middle",
																fontSize: "9",
																fill: "#64748B",
																children: "FM-200 Flooding Room"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
																x: "50",
																y: "120",
																width: "120",
																height: "22",
																rx: "11",
																fill: "#ef4444",
																fillOpacity: "0.1",
																stroke: "#ef4444",
																strokeWidth: "1"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("text", {
																x: "110",
																y: "134",
																textAnchor: "middle",
																fontSize: "10.5",
																fontWeight: "bold",
																fill: "#ef4444",
																children: [
																	"Weight: ",
																	calcResults.weight.toFixed(1),
																	" ",
																	unitSystem === "si" ? "kg" : "lb"
																]
															})
														]
													})
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex gap-2",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													onClick: exportPdf,
													className: "flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-xl border border-border text-[12px] font-semibold bg-background hover:bg-surface-2 text-foreground transition-colors cursor-pointer",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5 text-danger" }), " PDF"]
												})
											})
										]
									})]
								})]
							})
						}), tab === "report" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1 min-h-0 overflow-y-auto p-6 bg-surface/30",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "max-w-3xl mx-auto flex flex-col gap-6",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "border border-border rounded-3xl bg-background p-6 flex flex-col gap-5 shadow-sm",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-start border-b border-border pb-4",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
												className: "text-[16px] font-bold text-foreground",
												children: "Clean Agent Design Sizing Sheet"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[12px] text-muted-foreground mt-0.5",
												children: "Calculated parameters for room fire flooding protection"
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: exportPdf,
												className: "inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/95 transition-colors cursor-pointer shadow-sm",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-3.5" }), " Print Report"]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-2 gap-x-6 gap-y-4 text-[13px] border-b border-border pb-5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between py-1.5 border-b border-border/50",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground",
														children: "Project Name"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-foreground",
														children: project.name
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between py-1.5 border-b border-border/50",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground",
														children: "Project Code"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold font-mono text-foreground",
														children: project.code
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between py-1.5 border-b border-border/50",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground",
														children: "Design Volume"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-semibold text-foreground",
														children: [
															calcResults.volume.toFixed(2),
															" ",
															unitSystem === "si" ? "m³" : "ft³"
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between py-1.5 border-b border-border/50",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground",
														children: "FM-200 Weight Required"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-semibold text-primary",
														children: [
															calcResults.weight.toFixed(2),
															" ",
															unitSystem === "si" ? "kg" : "lb"
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between py-1.5 border-b border-border/50",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground",
														children: "Concentration (C)"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-semibold text-foreground",
														children: [calcResults.C.toFixed(3), " %"]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between py-1.5 border-b border-border/50",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground",
														children: "Specific Volume (S)"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-semibold text-foreground",
														children: [
															calcResults.S.toFixed(4),
															" ",
															unitSystem === "si" ? "m³/kg" : "ft³/lb"
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between py-1.5 border-b border-border/50",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground",
														children: "Design Temp"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-semibold text-foreground",
														children: [
															temp,
															" ",
															unitSystem === "si" ? "°C" : "°F"
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between py-1.5 border-b border-border/50",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground",
														children: "Safety Multiplier Factor"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-foreground",
														children: safetyFactorVal.toFixed(2)
													})]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[12.5px] text-muted-foreground flex flex-col gap-2.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "font-semibold text-foreground",
													children: "Standard Notes:"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "This report qualifies agent calculations per the **NFPA 2001 (Standard on Clean Agent Fire Extinguishing Systems)** equations. Calculations are validated based on standard superheated vapor specific volumes of HFC-227ea." }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Actual installation requires hydraulic pipe routing verification using manufacturer-specific software to check flow balancing, pipe size schedules, nozzle orifice diameters, and split-tee flow distributions." })
											]
										})
									]
								})
							})
						})]
					})]
				})]
			}), intelOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-80 border-l border-border bg-background shrink-0 flex flex-col h-full overflow-hidden shadow-2xl",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 border-b border-border flex items-center justify-between bg-surface",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-4.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-bold text-[13px] uppercase tracking-wider text-foreground",
							children: "NFPA 2001 Guidelines"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setIntelOpen(false),
						className: "size-6 rounded hover:bg-surface-2 grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-[12.5px] leading-relaxed text-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
							className: "font-bold text-primary mb-1",
							children: "What is FM-200?"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground text-[12px]",
							children: "FM-200 (chemically HFC-227ea / heptafluoropropane) is a zero ozone-depleting clean agent chemical replacement for Halon 1301. It extinguishes fires by a combination of thermal absorbency and chemical disruption of the flame."
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
							className: "font-bold text-primary mb-1",
							children: "Hold Time Target"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground text-[12px]",
							children: "Per NFPA 2001, the room enclosure must retain the minimum design concentration for at least **10 minutes** (Hold Time) or until emergency responders arrive, to prevent hot surfaces from triggering re-ignition."
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
							className: "font-bold text-primary mb-1",
							children: "Enclosure Integrity Testing"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground text-[12px]",
							children: "Hold time is verified using a door fan room pressurization integrity test. Leakage at floor level and top ceilings can cause the heavy gas to drain quickly out of the space."
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
							className: "font-bold text-primary mb-1",
							children: "Discharge Time Requirement"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground text-[12px]",
							children: "The entire calculated agent weight must be discharged into the protected enclosure within **10 seconds** to establish extinguishing concentration rapidly and minimize decomposition products (HF acid vapor)."
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border-t border-border pt-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
									className: "font-bold text-primary mb-1",
									children: "Human Exposure Limits"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-1 mt-1 text-[11.5px] text-muted-foreground",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between border-b border-border/40 pb-0.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "NOAEL Limit" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-foreground",
											children: "9.0 %"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between border-b border-border/40 pb-0.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "LOAEL Limit" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-foreground",
											children: "10.5 %"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-muted-foreground text-[11px] mt-1.5 italic",
									children: "Note: If design concentration exceeds 9.0%, restricted egress times and self-contained breathing apparatus must be assessed."
								})
							]
						})
					]
				})]
			})]
		})
	});
}
//#endregion
export { FM200SizerPage as component };
