import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Ht as Activity, M as Printer, Ut as TriangleAlert, Wt as Sparkles, Xt as Grid3x3, Y as Info, ht as Droplet, in as CircleCheck, lt as FileText, n as X, st as Flame } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-sprinkler-density-uyG07A7C.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
var STANDARD_K_FACTORS = [
	2.8,
	4.2,
	5.6,
	8,
	11.2,
	14,
	16.8,
	19.6,
	22.4,
	25.2,
	28
];
function SprinklerDensityPage() {
	const { project } = useWorkspace();
	const [tab, setTab] = (0, import_react.useState)("solver");
	const [intelOpen, setIntelOpen] = (0, import_react.useState)(false);
	const [hazard, setHazard] = (0, import_react.useState)("0.15,1500");
	const [customDens, setCustomDens] = (0, import_react.useState)(.2);
	const [customArea, setCustomArea] = (0, import_react.useState)(1500);
	const [coverage, setCoverage] = (0, import_react.useState)(130);
	const [kFactor, setKFactor] = (0, import_react.useState)(5.6);
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("ip");
	const calcResults = (0, import_react.useMemo)(() => {
		const customDensVal = customDens === "" ? 0 : customDens;
		const customAreaVal = customArea === "" ? 0 : customArea;
		const coverageVal = coverage === "" ? 0 : coverage;
		let dens = .15;
		let designArea = 1500;
		if (hazard === "custom") {
			dens = customDensVal;
			designArea = customAreaVal;
		} else {
			const parts = hazard.split(",");
			dens = parseFloat(parts[0]);
			designArea = parseFloat(parts[1]);
		}
		const ip = unitSystem === "ip";
		const densIP = ip ? dens : dens / 40.74;
		const coverFt2 = ip ? coverageVal : coverageVal * 10.7639;
		const designAreaFt2 = ip ? designArea : designArea * 10.7639;
		const flowPerSprink = densIP * coverFt2;
		const pressReq = Math.pow(flowPerSprink / kFactor, 2);
		const nSprink = Math.ceil(designAreaFt2 / coverFt2);
		const totalSprinkFlow = densIP * designAreaFt2;
		const hoseAllow = densIP <= .1 ? 100 : densIP <= .2 ? 250 : 500;
		const systemTotal = totalSprinkFlow + hoseAllow;
		const formatFlow = (gpm) => {
			return ip ? `${gpm.toFixed(1)} GPM` : `${(gpm * .06309).toFixed(2)} L/s`;
		};
		const formatArea = (ft2) => {
			return ip ? `${ft2.toFixed(0)} ft²` : `${(ft2 / 10.7639).toFixed(0)} m²`;
		};
		const formatDens = (gpmft2) => {
			return ip ? `${gpmft2.toFixed(3)} GPM/ft²` : `${(gpmft2 * 40.74).toFixed(2)} mm/min`;
		};
		return {
			densIP,
			coverFt2,
			designAreaFt2,
			flowPerSprink,
			pressReq,
			nSprink,
			totalSprinkFlow,
			hoseAllow,
			systemTotal,
			formatFlow,
			formatArea,
			formatDens
		};
	}, [
		hazard,
		customDens,
		customArea,
		coverage,
		kFactor,
		unitSystem
	]);
	const chartData = (0, import_react.useMemo)(() => {
		const W = 400;
		const H = 220;
		const PL = 60;
		const PR = 20;
		const PT = 30;
		const PB = 40;
		const CW = W - PL - PR;
		const CH = H - PT - PB;
		const items = [
			{
				label: "Density x100",
				val: calcResults.densIP * 100,
				color: "#d17914",
				unit: ""
			},
			{
				label: "Cover/head",
				val: calcResults.coverFt2,
				color: "#06456F",
				unit: " ft²"
			},
			{
				label: "Design Area / 10",
				val: calcResults.designAreaFt2 / 10,
				color: "#7C3AED",
				unit: " ft²"
			},
			{
				label: "Min Pressure",
				val: calcResults.pressReq,
				color: "#D97706",
				unit: " psi"
			}
		];
		const maxVal = Math.max(...items.map((i) => i.val)) * 1.15 || 100;
		const sx = (v) => PL + v / maxVal * CW;
		return {
			W,
			H,
			PL,
			PR,
			PT,
			PB,
			CW,
			CH,
			items,
			maxVal,
			sx
		};
	}, [calcResults]);
	const exportPdf = () => {
		const doc = new import_jspdf_node_min.default();
		doc.setFont("helvetica", "bold");
		doc.setFontSize(16);
		doc.setTextColor(220, 76, 52);
		doc.text("NFPA 13 Sprinkler Density & Flow Report", 14, 20);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(10);
		doc.setTextColor(80, 80, 80);
		doc.text(`Project Name: ${project.name}`, 14, 28);
		doc.text(`Project Code: ${project.code}`, 14, 34);
		autoTable(doc, {
			startY: 42,
			head: [["Sizing Parameters", "Value / Output"]],
			body: [
				["Design Density", calcResults.formatDens(calcResults.densIP)],
				["Design Area", calcResults.formatArea(calcResults.designAreaFt2)],
				["Coverage per Sprinkler", `${coverage} ${unitSystem === "ip" ? "ft²" : "m²"}`],
				["Sprinkler K-Factor", `K-${kFactor.toFixed(1)}`],
				["Flow per Sprinkler", calcResults.formatFlow(calcResults.flowPerSprink)],
				["Operating Pressure", `${calcResults.pressReq.toFixed(1)} psi`],
				["Sprinkler Count (Heads)", `${calcResults.nSprink} heads`],
				["Total Sprinkler Flow", calcResults.formatFlow(calcResults.totalSprinkFlow)],
				["NFPA 13 Hose Allowance", calcResults.formatFlow(calcResults.hoseAllow)],
				["Total Design Water Demand", calcResults.formatFlow(calcResults.systemTotal)]
			],
			theme: "striped",
			styles: { fontSize: 10 },
			headStyles: { fillColor: [
				220,
				76,
				52
			] }
		});
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), `Sprinkler_Density_Flow_Report_${project.code}.pdf`, "PDF Document", ["pdf"]);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Sprinkler Density & Flow",
		hideSubHeader: true,
		onIntelClick: () => setIntelOpen((v) => !v),
		intelOpen,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex h-full min-h-0 bg-transparent",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between items-start shrink-0 select-none no-print modal-blur-bg px-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1 w-full",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
							children: "FIRE FIGHTING > SPRINKLER DENSITY & FLOW"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 mt-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "text-[28px] font-bold tracking-tight text-foreground",
									children: "Sprinkler Density & Flow"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[15px] font-semibold text-muted-foreground",
									children: "NFPA 13 density/area calculations"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setIntelOpen((v) => !v),
								className: `flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${intelOpen ? "bg-primary text-primary-foreground border-primary" : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }), "Intelligence"]
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center gap-2 shrink-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex rounded-full border border-border p-0.5 bg-surface-2 shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setUnitSystem("si"),
								className: `px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${unitSystem === "si" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "SI"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setUnitSystem("ip"),
								className: `px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${unitSystem === "ip" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "IP"
							})]
						})
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-card border border-border rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden mx-6 mb-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setTab("solver"),
								className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${tab === "solver" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Calculator"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setTab("report"),
								className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${tab === "report" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Report Summary"
							})]
						})
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
											className: "flex gap-3.5 p-4 bg-background border border-border rounded-3xl shadow-sm",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-4.5 text-primary mt-0.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
												className: "text-[13.5px] font-bold text-foreground",
												children: "NFPA 13 Density/Area Method"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[12.5px] text-muted-foreground mt-1 leading-relaxed",
												children: "Determine the minimum sprinkler water flow rate and operating pressure based on standard NFPA 13 hazard category densities. Sizing is preliminary and excludes complex hydraulic balancing."
											})] })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "grid grid-cols-2 gap-4",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-2.5 col-span-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
													children: "Hazard Category"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
													value: hazard,
													onChange: (e) => setHazard(e.target.value),
													className: "w-full h-10 px-3 border border-border focus:border-primary focus:ring-0 rounded-xl bg-background text-[13px] outline-none font-medium cursor-pointer",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "0.10,1500",
															children: "Light Hazard - 0.10 GPM/ft² / 1500 ft²"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "0.15,1500",
															children: "Ordinary Hazard Gp 1 - 0.15 / 1500 ft²"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "0.20,1500",
															children: "Ordinary Hazard Gp 2 - 0.20 / 1500 ft²"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "0.30,2500",
															children: "Extra Hazard Gp 1 - 0.30 / 2500 ft²"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "0.40,2500",
															children: "Extra Hazard Gp 2 - 0.40 / 2500 ft²"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "custom",
															children: "Custom Parameters..."
														})
													]
												})]
											})
										}),
										hazard === "custom" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-2 gap-4",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-baseline",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "text-[13px] font-bold text-foreground",
														children: "Custom Density"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[11.5px] text-muted-foreground font-mono",
														children: unitSystem === "ip" ? "GPM/ft²" : "mm/min"
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "0.01",
													min: "0.05",
													max: "1.0",
													value: customDens,
													onChange: (e) => setCustomDens(e.target.value === "" ? "" : parseFloat(e.target.value) || .1),
													className: "h-10 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[13px] font-mono outline-none"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-baseline",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "text-[13px] font-bold text-foreground",
														children: "Custom Design Area"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[11.5px] text-muted-foreground font-mono",
														children: unitSystem === "ip" ? "ft²" : "m²"
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "50",
													min: "500",
													value: customArea,
													onChange: (e) => setCustomArea(e.target.value === "" ? "" : parseFloat(e.target.value) || 1e3),
													className: "h-10 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[13px] font-mono outline-none"
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-2 gap-4",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-baseline",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "text-[13px] font-bold text-foreground",
														children: "Coverage Area per Sprinkler"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[11.5px] text-muted-foreground font-mono",
														children: unitSystem === "ip" ? "ft²" : "m²"
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													min: "20",
													max: "400",
													value: coverage,
													onChange: (e) => setCoverage(e.target.value === "" ? "" : parseFloat(e.target.value) || 130),
													className: "h-10 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[13px] font-mono outline-none"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-baseline",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "text-[13px] font-bold text-foreground",
														children: "Sprinkler K-Factor"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[11.5px] text-muted-foreground font-mono",
														children: "GPM/√psi"
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
													value: kFactor,
													onChange: (e) => setKFactor(parseFloat(e.target.value)),
													className: "h-10 w-full px-3 border border-border focus:border-primary focus:ring-0 rounded-xl bg-background text-[13px] font-medium outline-none cursor-pointer",
													children: STANDARD_K_FACTORS.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
														value: k,
														children: ["K-", k.toFixed(1)]
													}, k))
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border rounded-3xl bg-background shadow-sm overflow-hidden",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "px-4 py-2 border-b border-border bg-header-bg",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
													children: "Calculated Outputs Summary"
												})
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-2 divide-x divide-y divide-border",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "p-3.5 flex justify-between items-center text-[13px] bg-background",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground",
															children: "Flow rate per head"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-bold font-mono text-foreground",
															children: calcResults.formatFlow(calcResults.flowPerSprink)
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "p-3.5 flex justify-between items-center text-[13px] bg-background",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground",
															children: "Min operating pressure"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "font-bold font-mono text-foreground",
															children: [calcResults.pressReq.toFixed(1), " psi"]
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "p-3.5 flex justify-between items-center text-[13px] bg-background",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground",
															children: "Sprinkler count in area"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "font-bold font-mono text-foreground",
															children: [calcResults.nSprink, " heads"]
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "p-3.5 flex justify-between items-center text-[13px] bg-background",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground",
															children: "Sprinklers flow demand"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-bold font-mono text-foreground",
															children: calcResults.formatFlow(calcResults.totalSprinkFlow)
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "p-3.5 flex justify-between items-center text-[13px] bg-background",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground",
															children: "Hose stream allowance"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-bold font-mono text-foreground",
															children: calcResults.formatFlow(calcResults.hoseAllow)
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "p-3.5 flex justify-between items-center text-[13px] bg-background col-span-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground font-bold",
															children: "Total water demand"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-bold font-mono text-red-500 text-[15px]",
															children: calcResults.formatFlow(calcResults.systemTotal)
														})]
													})
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-2",
											children: [calcResults.pressReq < 7 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-destructive/20 bg-destructive/5 text-destructive rounded-3xl p-3.5 flex gap-2.5 items-start",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "text-[12.5px] font-bold",
													children: "Low Operating Pressure Violation"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-[11.5px] text-muted-foreground mt-0.5 leading-normal",
													children: [
														"Required pressure (",
														calcResults.pressReq.toFixed(1),
														" psi) is below the NFPA 13 minimum of 7.0 psi. Sizing is invalid. Increase hazard design density or use a sprinkler with a smaller K-Factor."
													]
												})] })]
											}), calcResults.coverFt2 > 225 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-warning/20 bg-warning/5 text-warning rounded-3xl p-3.5 flex gap-2.5 items-start",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "text-[12.5px] font-bold",
													children: "Coverage Spacing Warning"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-[11.5px] text-muted-foreground mt-0.5 leading-normal",
													children: [
														"Sprinkler coverage area (",
														calcResults.coverFt2.toFixed(0),
														" ft²) exceeds standard maximum spacing limit of 225 ft² per sprinkler. Verify listings for extended coverage heads."
													]
												})] })]
											})]
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "w-[360px] shrink-0 p-6 bg-surface/10 flex flex-col gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
										children: "Parameters Distribution"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "border border-border-strong rounded-3xl bg-background p-4 shadow-sm flex flex-col gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-[12.5px] font-bold text-foreground",
											children: "Sprinkler Design Parameters"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-full relative select-none",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
												viewBox: `0 0 ${chartData.W} ${chartData.H}`,
												className: "w-full h-auto block font-sans",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
														x: chartData.PL + chartData.CW / 2,
														y: "15",
														textAnchor: "middle",
														fontSize: "9.5",
														fontWeight: "700",
														fill: "var(--muted)",
														children: "NFPA 13 PARAMETERS CHART"
													}),
													chartData.items.map((item, idx) => {
														const barH = 22;
														const y = chartData.PT + idx * 36;
														const w = Math.max(5, item.val / chartData.maxVal * chartData.CW);
														return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
																x: chartData.PL - 8,
																y: y + barH / 2 + 3,
																textAnchor: "end",
																fontSize: "9",
																fontWeight: "bold",
																fill: "var(--muted)",
																children: item.label
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
																x: chartData.PL,
																y,
																width: chartData.CW,
																height: barH,
																fill: "var(--border)",
																rx: "3",
																opacity: "0.2"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
																x: chartData.PL,
																y,
																width: w,
																height: barH,
																fill: item.color,
																rx: "3",
																opacity: "0.85"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("text", {
																x: chartData.PL + w + 5,
																y: y + barH / 2 + 3.5,
																textAnchor: "start",
																fontSize: "9.5",
																fontWeight: "700",
																fill: item.color,
																fontFamily: "var(--mono)",
																children: [item.val.toFixed(1), item.unit]
															})
														] }, idx);
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
														x1: chartData.PL,
														y1: chartData.PT - 5,
														x2: chartData.PL,
														y2: chartData.H - chartData.PB + 10,
														stroke: "var(--border-strong)",
														strokeWidth: "1"
													})
												]
											})
										})]
									})]
								})]
							})
						}), tab === "report" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6 w-full",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center pb-4 border-b border-border",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[16px] font-bold text-foreground",
										children: "Sprinkler Density & Demand Report"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[12.5px] text-muted-foreground mt-0.5",
										children: "Summary of NFPA 13 preliminary water supply requirements."
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 no-print print:hidden",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: exportPdf,
											className: "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl text-[12.5px] font-semibold border border-border bg-background hover:bg-surface-2 text-foreground cursor-pointer",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5 text-destructive" }), " Export PDF"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => window.print(),
											className: "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl text-[12.5px] font-semibold border border-border bg-background hover:bg-surface-2 text-foreground cursor-pointer",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-3.5 text-muted-foreground" }), " Print Report"]
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-4 gap-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "size-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Grid3x3, { className: "size-5" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground block",
													children: "Design Area"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[20px] font-extrabold font-mono text-foreground mt-0.5",
													children: calcResults.formatArea(calcResults.designAreaFt2)
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[10.5px] text-muted-foreground mt-0.5 block",
													children: [calcResults.nSprink, " heads in area"]
												})
											] })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Droplet, { className: "size-5" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground block",
													children: "Discharge / Head"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[20px] font-extrabold font-mono text-primary mt-0.5",
													children: calcResults.formatFlow(calcResults.flowPerSprink)
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[10.5px] text-muted-foreground mt-0.5 block",
													children: [
														"K-",
														kFactor,
														" coefficient"
													]
												})
											] })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "size-10 rounded-xl bg-sky-500/10 text-amber-500 flex items-center justify-center shrink-0",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "size-5" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground block",
													children: "Pressure Required"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[20px] font-extrabold font-mono text-primary mt-0.5",
													children: [
														calcResults.pressReq.toFixed(1),
														" ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11px] font-normal text-muted-foreground",
															children: "psi"
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10.5px] text-muted-foreground mt-0.5 block",
													children: "At remote sprinkler"
												})
											] })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "size-5" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground block",
													children: "Total Water Supply"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[20px] font-extrabold font-mono text-red-500 mt-0.5",
													children: calcResults.formatFlow(calcResults.systemTotal)
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10.5px] text-muted-foreground mt-0.5 block",
													children: "With hose allowance"
												})
											] })]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col lg:flex-row gap-6 items-start",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex-1 min-w-0 w-full border border-border rounded-3xl bg-background shadow-sm overflow-hidden",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "px-4 py-3 border-b border-border bg-surface-2/15 flex items-center justify-between",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[13px] font-bold text-foreground",
												children: "Sprinkler Sizing Parameters Preview"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[11px] text-muted-foreground font-mono",
												children: "NFPA 13"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "p-4 flex flex-col gap-4 text-[13px] text-foreground",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-2 gap-y-2 border-b border-border pb-3",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Project Code: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold font-mono",
														children: project.code
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Project Name: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold",
														children: project.name
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Client Name: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold",
														children: project.client
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Hazard Sized: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold capitalize",
														children: hazard === "custom" ? "Custom" : hazard
													})] })
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
												className: "w-full text-left border-collapse text-[12.5px]",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "border-b border-border text-muted-foreground font-bold text-[11px] uppercase tracking-wider",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "py-2.5",
															children: "Sizing Parameter"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "py-2.5 text-right",
															children: "Value"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: "py-2.5 text-center",
															children: "Unit"
														})
													]
												}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
													className: "divide-y divide-border font-medium",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-muted-foreground",
																children: "Design Density"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-right font-mono font-bold text-foreground",
																children: calcResults.formatDens(calcResults.densIP).split(" ")[0]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center text-muted-foreground",
																children: calcResults.formatDens(calcResults.densIP).split(" ").slice(1).join(" ")
															})
														] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-muted-foreground",
																children: "Design Area"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-right font-mono font-bold text-foreground",
																children: calcResults.formatArea(calcResults.designAreaFt2).split(" ")[0]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center text-muted-foreground",
																children: calcResults.formatArea(calcResults.designAreaFt2).split(" ").slice(1).join(" ")
															})
														] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-muted-foreground",
																children: "Coverage per Sprinkler"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-right font-mono font-bold text-foreground",
																children: coverage
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center text-muted-foreground",
																children: unitSystem === "ip" ? "ft²" : "m²"
															})
														] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-muted-foreground",
																children: "Sprinkler K-Factor"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-right font-mono font-bold text-foreground",
																children: kFactor
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center text-muted-foreground",
																children: "gpm/psi⁰·⁵"
															})
														] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-muted-foreground",
																children: "Flow Rate per Sprinkler"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-right font-mono font-bold text-foreground",
																children: calcResults.formatFlow(calcResults.flowPerSprink).split(" ")[0]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center text-muted-foreground",
																children: calcResults.formatFlow(calcResults.flowPerSprink).split(" ").slice(1).join(" ")
															})
														] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-muted-foreground",
																children: "Sprinkler Count in Area"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-right font-mono font-bold text-foreground",
																children: calcResults.nSprink
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center text-muted-foreground",
																children: "heads"
															})
														] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-muted-foreground",
																children: "Sprinkler Flow Demand"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-right font-mono font-bold text-foreground",
																children: calcResults.formatFlow(calcResults.totalSprinkFlow).split(" ")[0]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center text-muted-foreground",
																children: calcResults.formatFlow(calcResults.totalSprinkFlow).split(" ").slice(1).join(" ")
															})
														] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-muted-foreground",
																children: "Hose Allowance (NFPA 13)"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-right font-mono font-bold text-foreground",
																children: calcResults.formatFlow(calcResults.hoseAllow).split(" ")[0]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center text-muted-foreground",
																children: calcResults.formatFlow(calcResults.hoseAllow).split(" ").slice(1).join(" ")
															})
														] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
															className: "bg-surface/50 border-t border-border font-bold",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "py-2.5 text-foreground",
																	children: "Total Water Supply Demand"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "py-2.5 text-right font-mono font-bold text-red-500 text-[14.5px]",
																	children: calcResults.formatFlow(calcResults.systemTotal).split(" ")[0]
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "py-2.5 text-center text-muted-foreground",
																	children: calcResults.formatFlow(calcResults.systemTotal).split(" ").slice(1).join(" ")
																})
															]
														})
													]
												})]
											})]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "w-full lg:w-[350px] shrink-0 flex flex-col gap-4",
										children: [(() => {
											const hasLowPressure = calcResults.pressReq < 7;
											const hasOverCoverage = calcResults.coverFt2 > 225;
											if (hasLowPressure) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-destructive/20 bg-destructive/5 rounded-3xl p-4 flex gap-3 shadow-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-5 text-destructive shrink-0 mt-0.5 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "text-[13px] font-bold text-destructive",
													children: "NFPA 13 Code Warning"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-[12px] text-muted-foreground mt-1 leading-normal",
													children: [
														"Required sprinkler pressure is ",
														calcResults.pressReq.toFixed(1),
														" psi, which is below the NFPA 13 code minimum limit of 7.0 psi. System is non-compliant."
													]
												})] })]
											});
											if (hasOverCoverage) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-warning/20 bg-warning/5 rounded-3xl p-4 flex gap-3 shadow-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-5 text-warning shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "text-[13px] font-bold text-warning",
													children: "Coverage Area Alert"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-[12px] text-muted-foreground mt-1 leading-normal",
													children: [
														"Sprinkler coverage area (",
														calcResults.coverFt2.toFixed(0),
														" ft²) exceeds the standard maximum limit of 225 ft² per head. Check listings for extended coverage."
													]
												})] })]
											});
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-success/20 bg-success/5 rounded-3xl p-4 flex gap-3 shadow-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-5 text-success shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "text-[13px] font-bold text-success",
													children: "NFPA 13 Sizing Audit"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "text-[12px] text-muted-foreground mt-1 leading-normal",
													children: "System meets sizing code guidelines. Pressure and coverage requirements comply with general NFPA 13 design criteria."
												})] })]
											});
										})(), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-3.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "text-[13px] font-bold text-foreground leading-snug flex items-center gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5 text-primary" }), " Sizing Recommendations"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[12px] text-muted-foreground leading-relaxed flex flex-col gap-2.5",
												children: [
													calcResults.pressReq > 35 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "p-2.5 rounded bg-muted/65 border border-border text-foreground",
														children: [
															"Operating pressure is very high (",
															calcResults.pressReq.toFixed(1),
															" psi). Changing to a larger sprinkler coefficient (e.g. K-8.0 or K-11.2) is recommended to decrease friction loss."
														]
													}),
													calcResults.pressReq < 7 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "p-2.5 rounded bg-destructive/5 border border-destructive/10 text-foreground",
														children: "Decrease sprinkler K-Factor (e.g. K-4.2) or increase design density to raise pressure above 7.0 psi."
													}),
													calcResults.pressReq >= 7 && calcResults.pressReq <= 35 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "p-2.5 rounded bg-success/5 border border-success/10 text-foreground",
														children: [
															"Operating pressure is optimal (",
															calcResults.pressReq.toFixed(1),
															" psi). No adjustments required."
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[11px] text-muted-foreground mt-1 border-t border-border pt-2 leading-normal",
														children: "Always check sprinkler manufacturer datasheets for exact listing criteria and k-factor coefficients."
													})
												]
											})]
										})]
									})]
								})
							]
						})]
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `shrink-0 bg-background overflow-hidden transition-[width] duration-300 ease-out select-none no-print print:hidden ${intelOpen ? "w-[360px] border-l border-border" : "w-0"}`,
				children: intelOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-[360px] h-full flex flex-col min-h-0 bg-background font-sans",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between p-4 border-b border-border bg-header-bg shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-[13.5px] font-bold uppercase tracking-wider text-foreground",
								children: "Live Intelligence"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setIntelOpen(false),
							className: "text-muted-foreground hover:text-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 overflow-y-auto p-4 flex flex-col gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border rounded p-3.5 bg-background shadow-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
									className: "text-[12.5px] font-bold text-foreground",
									children: "NFPA 13 Rules Guidance"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11.5px] text-muted-foreground mt-1 leading-relaxed",
									children: "Preliminary sizing based on density/area curves. Minimum pressure check is required."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
									className: "text-[11px] text-muted-foreground mt-2 list-disc pl-4 flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Minimum nozzle operating pressure is 7.0 psi." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Standard maximum spacing is 225 ft² for Light, 130 ft² for Ordinary hazards." })]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border rounded p-3.5 bg-background shadow-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "text-[12.5px] font-bold text-foreground",
								children: "Design Recommendations"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2.5 mt-2",
								children: [
									calcResults.pressReq > 35 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[11.5px] text-warning flex gap-1.5 items-start",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5 text-warning" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											"Operating pressure is very high (",
											calcResults.pressReq.toFixed(1),
											" psi). Changing K-",
											kFactor,
											" to a larger size (e.g. K-8.0 or K-11.2) is recommended to decrease required pressure and pump size."
										] })]
									}),
									calcResults.pressReq < 7 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[11.5px] text-destructive flex gap-1.5 items-start",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5 text-destructive" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											"Required pressure (",
											calcResults.pressReq.toFixed(1),
											" psi) is below 7.0 psi. System violates code. Decrease sprinkler K-Factor (e.g., K-4.2) or increase design density to raise pressure."
										] })]
									}),
									calcResults.pressReq >= 7 && calcResults.pressReq <= 35 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[11.5px] text-success flex gap-1.5 items-start",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4 shrink-0 mt-0.5 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											"Sizing meets code requirements. Operating pressure is optimal (",
											calcResults.pressReq.toFixed(1),
											" psi)."
										] })]
									})
								]
							})]
						})]
					})]
				})
			})]
		})
	});
}
//#endregion
export { SprinklerDensityPage as component };
