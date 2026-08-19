import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Ht as Activity, M as Printer, S as Settings, Ut as TriangleAlert, Wt as Sparkles, Y as Info, ht as Droplet, in as CircleCheck, lt as FileText, n as X, st as Flame } from "../_libs/lucide-react.mjs";
import { r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
import { t as addPdfSignatureBlock } from "./pdfHelpers-Cqwarpxq.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-hazen-williams-Dte8C1QV.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
function HazenWilliamsPage() {
	const { userData, profile } = useAuth();
	const currentUserName = userData?.name || profile?.name || "System Admin";
	const { project } = useWorkspace();
	const [tab, setTab] = (0, import_react.useState)("solver");
	const [intelOpen, setIntelOpen] = (0, import_react.useState)(false);
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("ip");
	const [flow, setFlow] = (0, import_react.useState)(100);
	const [pipeSize, setPipeSize] = (0, import_react.useState)(2.469);
	const [cFactor, setCFactor] = (0, import_react.useState)(120);
	const [length, setLength] = (0, import_react.useState)(100);
	const results = (0, import_react.useMemo)(() => {
		const ip = unitSystem === "ip";
		const Q = flow === "" ? 0 : flow;
		const d = pipeSize;
		const C = cFactor;
		const lenVal = length === "" ? 0 : length;
		const hf = 4.52 * (ip ? lenVal : lenVal / .3048) * Math.pow(Q, 1.85) / (Math.pow(C, 1.85) * Math.pow(d, 4.87));
		const hfp = 4.52 * 100 * Math.pow(Q, 1.85) / (Math.pow(C, 1.85) * Math.pow(d, 4.87));
		const v = Q / (2.448 * d * d);
		return {
			hf,
			hfp,
			v,
			chartVel: ip ? v : v * .3048,
			chartMaxVel: ip ? 8 : 2.44,
			chartHlPer100: ip ? hfp : hfp * .3048 / 100
		};
	}, [
		flow,
		pipeSize,
		cFactor,
		length,
		unitSystem
	]);
	const chartSvg = (0, import_react.useMemo)(() => {
		const ip = unitSystem === "ip";
		const u = ip ? "fps" : "m/s";
		const pU = ip ? "psi/100ft" : "m/100m";
		const bars = [
			{
				label: "Velocity",
				val: results.chartVel,
				color: results.chartVel > (ip ? 8 : 2.44) ? "#0A7BC7" : "#d17914",
				unit: ` ${u}`
			},
			{
				label: `Max Rec (${ip ? "8" : "2.4"})`,
				val: ip ? 8 : 2.44,
				color: "#94A3B8",
				unit: ` ${u}`
			},
			{
				label: "Head Loss",
				val: results.chartHlPer100,
				color: "#7C3AED",
				unit: ` ${pU}`
			}
		];
		const W = 360;
		const H = 200;
		const PL = 40;
		const PR = 16;
		const PT = 30;
		const PB = 44;
		const CW = W - PL - PR;
		const CH = H - PT - PB;
		const maxVal = Math.max(...bars.map((b) => b.val)) * 1.15 || 10;
		const bw = CW / bars.length;
		const gap = bw * .28;
		const sx = (i) => PL + i * bw + gap / 2;
		const bw2 = bw - gap;
		const sy = (v) => 156 - v / maxVal * CH;
		return {
			W,
			H,
			PL,
			PR,
			PT,
			PB,
			CW,
			CH,
			bars,
			maxVal,
			sx,
			bw2,
			sy,
			u,
			pU
		};
	}, [results, unitSystem]);
	const flowVal = typeof flow === "number" ? flow : 0;
	const lengthVal = typeof length === "number" ? length : 0;
	const exportPdf = () => {
		const doc = new import_jspdf_node_min.default();
		doc.setFont("helvetica", "bold");
		doc.setFontSize(16);
		doc.setTextColor(220, 76, 52);
		doc.text("Hazen-Williams Friction Loss Sizing Report", 14, 20);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(10);
		doc.setTextColor(80, 80, 80);
		doc.text(`Project: ${project.name} (${project.code})`, 14, 28);
		doc.text(`C-Factor: C-${cFactor}`, 14, 34);
		autoTable(doc, {
			startY: 42,
			head: [["Design Parameter", "Value / Sizing Results"]],
			body: [
				["Flow Rate (Q)", `${flowVal.toFixed(1)} GPM`],
				["Pipe Diameter (d)", `${pipeSize.toFixed(3)} inches`],
				["Pipe Roughness (C)", cFactor.toString()],
				["Segment Length (L)", `${lengthVal.toFixed(1)} ${unitSystem === "ip" ? "ft" : "m"}`],
				["Total Friction Loss (hf)", `${results.hf.toFixed(3)} psi`],
				["Friction Loss per 100 ft", `${results.hfp.toFixed(3)} psi/100ft`],
				["Flow Velocity (v)", `${results.v.toFixed(2)} fps`]
			],
			theme: "striped",
			styles: { fontSize: 10 },
			headStyles: { fillColor: [
				220,
				76,
				52
			] }
		});
		addPdfSignatureBlock(doc, doc.lastAutoTable?.finalY || 40, currentUserName, project?.id || "default", "plumbing-hazen-williams");
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), `Hazen_Williams_Report_${project.code}.pdf`, "PDF Document", ["pdf"]);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Hazen-Williams",
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
							children: "FIRE FIGHTING > HAZEN-WILLIAMS PRESSURE DROP"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 mt-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "text-[28px] font-bold tracking-tight text-foreground",
									children: "Hazen-Williams Pressure Drop"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[15px] font-semibold text-muted-foreground",
									children: "NFPA 13 piping hydraulics sizer"
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
												children: "Flow & Pressure - Hazen-Williams"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[12.5px] text-muted-foreground mt-1 leading-relaxed",
												children: "Calculate friction loss in fire protection piping using Hazen-Williams equation. Valid for turbulent water flow in clean pipes."
											})] })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-2 gap-4",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
													children: "Flow Rate (Q)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														value: flow,
														onChange: (e) => setFlow(e.target.value === "" ? "" : parseFloat(e.target.value) || 0),
														placeholder: "e.g. 100",
														className: "h-10 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[13px] font-mono outline-none"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[11.5px] text-muted-foreground font-mono mt-1.5 w-12 shrink-0",
														children: "GPM"
													})]
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
													children: "Pipe Size (NPS)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
													value: pipeSize,
													onChange: (e) => setPipeSize(parseFloat(e.target.value)),
													className: "w-full h-10 px-3 border border-border focus:border-primary focus:ring-0 rounded-xl bg-background text-[13px] outline-none font-medium cursor-pointer",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "1.049",
															children: "1\" - ID 1.049\""
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "1.380",
															children: "1¼\" - ID 1.380\""
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "1.610",
															children: "1½\" - ID 1.610\""
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "2.067",
															children: "2\" - ID 2.067\""
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "2.469",
															children: "2½\" - ID 2.469\""
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "3.068",
															children: "3\" - ID 3.068\""
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "4.026",
															children: "4\" - ID 4.026\""
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "6.065",
															children: "6\" - ID 6.065\""
														})
													]
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-2 gap-4",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
													children: "Pipe Material (C-factor)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
													value: cFactor,
													onChange: (e) => setCFactor(parseInt(e.target.value, 10) || 120),
													className: "w-full h-10 px-3 border border-border focus:border-primary focus:ring-0 rounded-xl bg-background text-[13px] outline-none font-medium cursor-pointer",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "120",
															children: "Schedule 40 Steel - C=120"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "100",
															children: "Black Steel (aged) - C=100"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "150",
															children: "CPVC - C=150"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "130",
															children: "Copper - C=130"
														})
													]
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
													children: [
														"Pipe Length (",
														unitSystem === "ip" ? "ft" : "m",
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "number",
														value: length,
														onChange: (e) => setLength(e.target.value === "" ? "" : parseFloat(e.target.value) || 0),
														placeholder: "e.g. 100",
														className: "h-10 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[13px] font-mono outline-none"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[11.5px] text-muted-foreground font-mono mt-2 w-8 text-center shrink-0",
														children: unitSystem === "ip" ? "ft" : "m"
													})]
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border rounded-3xl bg-background shadow-sm overflow-hidden",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "px-4 py-2 border-b border-border bg-header-bg",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
													children: "Friction Loss Result"
												})
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-2 divide-x divide-y divide-border",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "p-3.5 flex justify-between items-center text-[13px] bg-background",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground",
															children: "Loss per 100 ft"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "font-bold font-mono text-foreground",
															children: [results.hfp.toFixed(3), " psi/100ft"]
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "p-3.5 flex justify-between items-center text-[13px] bg-background",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground",
															children: "Flow Velocity"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "font-bold font-mono text-foreground",
															children: [results.v.toFixed(2), " fps"]
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "p-3.5 flex justify-between items-center text-[13px] bg-background col-span-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground font-bold",
															children: "Total Friction Loss"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "font-bold font-mono text-red-500 text-[15px]",
															children: [results.hf.toFixed(3), " psi"]
														})]
													})
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-border rounded-3xl bg-background shadow-sm overflow-hidden",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "px-4 py-2 border-b border-border bg-header-bg",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
													children: "∑ Calculation Steps"
												})
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "p-4 flex flex-col gap-4",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex flex-col gap-1 border-b border-border/50 pb-2",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "text-[12px] font-bold text-foreground",
																children: "1. Hazen-Williams friction loss"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "text-[11px] font-mono text-muted-foreground",
																children: "hf = 4.52 × L × Q^1.85 / (C^1.85 × d^4.87)"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "text-[12.5px] font-mono font-bold text-foreground mt-1",
																children: [results.hf.toFixed(3), " psi"]
															})
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex flex-col gap-1 border-b border-border/50 pb-2",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "text-[12px] font-bold text-foreground",
																children: "2. Loss per 100 ft"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "text-[11px] font-mono text-muted-foreground",
																children: "same formula with L=100"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "text-[12.5px] font-mono font-bold text-foreground mt-1",
																children: [results.hfp.toFixed(3), " psi/100ft"]
															})
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex flex-col gap-1",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "text-[12px] font-bold text-foreground",
																children: "3. Flow velocity"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "text-[11px] font-mono text-muted-foreground",
																children: "v = Q / (2.448 × d²)"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "text-[12.5px] font-mono font-bold text-foreground mt-1",
																children: [results.v.toFixed(2), " fps"]
															})
														]
													})
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-2",
											children: [results.v > 20 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-destructive/20 bg-destructive/5 text-destructive rounded-3xl p-3.5 flex gap-2.5 items-start",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "text-[12.5px] font-bold",
													children: "Velocity Alert"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-[11.5px] text-muted-foreground mt-0.5 leading-normal",
													children: [
														"Velocity ",
														results.v.toFixed(1),
														" fps - Very high. Water hammer risk in fire systems."
													]
												})] })]
											}), results.hf > 10 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-warning/20 bg-warning/5 text-warning rounded-3xl p-3.5 flex gap-2.5 items-start",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "text-[12.5px] font-bold",
													children: "Head Loss Alert"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-[11.5px] text-muted-foreground mt-0.5 leading-normal",
													children: [
														"High friction loss ",
														results.hf.toFixed(2),
														" psi - verify system pressure budget."
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
											children: "Flow & Hydraulics Summary"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-full relative select-none",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
												viewBox: `0 0 ${chartSvg.W} ${chartSvg.H}`,
												className: "w-full h-auto block font-sans overflow-visible",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
														x: chartSvg.PL,
														y: "18",
														fontSize: "9.5",
														fontWeight: "700",
														fill: "var(--muted)",
														letterSpacing: "0.5",
														children: "FLOW & HYDRAULICS SUMMARY"
													}),
													[
														.25,
														.5,
														.75,
														1
													].map((ratio) => {
														const val = ratio * chartSvg.maxVal;
														const y = chartSvg.sy(val);
														const lbl = val >= 1e3 ? (val / 1e3).toFixed(1) + "k" : val.toFixed(val < 10 ? 1 : 0);
														return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
															x1: chartSvg.PL,
															y1: y,
															x2: chartSvg.W - chartSvg.PR,
															y2: y,
															stroke: "var(--border)",
															strokeWidth: "0.5",
															strokeDasharray: "3,3"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
															x: chartSvg.PL - 5,
															y: y + 3.5,
															textAnchor: "end",
															fontSize: "8.5",
															fill: "var(--muted)",
															fontFamily: "var(--mono)",
															children: lbl
														})] }, ratio);
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
														x1: chartSvg.PL,
														y1: chartSvg.PT,
														x2: chartSvg.PL,
														y2: chartSvg.PT + chartSvg.CH,
														stroke: "var(--border)",
														strokeWidth: "1"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
														x1: chartSvg.PL,
														y1: chartSvg.PT + chartSvg.CH,
														x2: chartSvg.W - chartSvg.PR,
														y2: chartSvg.PT + chartSvg.CH,
														stroke: "var(--border)",
														strokeWidth: "1"
													}),
													chartSvg.bars.map((b, idx) => {
														const h = Math.max(3, b.val / chartSvg.maxVal * chartSvg.CH);
														const x = chartSvg.sx(idx);
														const y = chartSvg.sy(b.val);
														const valStr = b.val.toFixed(b.val < 10 ? 2 : 1);
														const lx = x + chartSvg.bw2 / 2;
														return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
																x,
																y,
																width: chartSvg.bw2,
																height: h,
																fill: b.color,
																rx: "3",
																opacity: "0.88"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("text", {
																x: lx,
																y: y - 5,
																textAnchor: "middle",
																fontSize: "9",
																fill: b.color,
																fontWeight: "700",
																fontFamily: "var(--mono)",
																children: [valStr, b.unit]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
																x: lx,
																y: chartSvg.PT + chartSvg.CH + 14,
																textAnchor: "middle",
																fontSize: "8.5",
																fill: "var(--muted)",
																children: b.label
															})
														] }, idx);
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
										children: "Hazen-Williams Friction Report"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[12.5px] text-muted-foreground mt-0.5",
										children: "Summary of black steel/CPVC pipe hydraulics sizing."
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
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-5" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground block",
													children: "Pipe Diameter"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[20px] font-extrabold font-mono text-foreground mt-0.5",
													children: [
														pipeSize.toFixed(3),
														" ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11px] font-normal text-muted-foreground",
															children: "in"
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[10.5px] text-muted-foreground mt-0.5 block",
													children: ["Material: C-", cFactor]
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
													children: "Design Flow"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[20px] font-extrabold font-mono text-primary mt-0.5",
													children: [
														flowVal.toFixed(1),
														" ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11px] font-normal text-muted-foreground",
															children: "GPM"
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10.5px] text-muted-foreground mt-0.5 block",
													children: "System supply rate"
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
													children: "Fluid Velocity"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[20px] font-extrabold font-mono text-primary mt-0.5",
													children: [
														results.v.toFixed(2),
														" ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11px] font-normal text-muted-foreground",
															children: "fps"
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10.5px] text-muted-foreground mt-0.5 block",
													children: "Erosion risk above 20 fps"
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
													children: "Total Friction Loss"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[20px] font-extrabold font-mono text-red-500 mt-0.5",
													children: [
														results.hf.toFixed(3),
														" ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11px] font-normal text-muted-foreground",
															children: "psi"
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[10.5px] text-muted-foreground mt-0.5 block",
													children: [
														"Over ",
														lengthVal.toFixed(1),
														" ",
														unitSystem === "ip" ? "ft" : "m"
													]
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
												children: "Hydraulic Sizing Summary Preview"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[11px] text-muted-foreground font-mono",
												children: "Hazen-Williams"
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
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Roughness Coefficient (C): ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold font-mono",
														children: cFactor
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
																children: "Design Flow Rate"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-right font-mono font-bold text-foreground",
																children: flowVal.toFixed(1)
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center text-muted-foreground",
																children: "GPM"
															})
														] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-muted-foreground",
																children: "Internal Diameter"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-right font-mono font-bold text-foreground",
																children: pipeSize.toFixed(3)
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center text-muted-foreground",
																children: "inches"
															})
														] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-muted-foreground",
																children: "Pipe Segment Length"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-right font-mono font-bold text-foreground",
																children: lengthVal.toFixed(1)
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center text-muted-foreground",
																children: unitSystem === "ip" ? "ft" : "m"
															})
														] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-muted-foreground",
																children: "Fluid Velocity"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-right font-mono font-bold text-foreground",
																children: results.v.toFixed(2)
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center text-muted-foreground",
																children: "fps"
															})
														] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-muted-foreground",
																children: "Friction Loss per 100 ft"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-right font-mono font-bold text-foreground",
																children: results.hfp.toFixed(3)
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "py-2.5 text-center text-muted-foreground",
																children: "psi/100ft"
															})
														] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
															className: "bg-surface/50 border-t border-border font-bold",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "py-2.5 text-foreground",
																	children: "Total Friction Loss"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "py-2.5 text-right font-mono font-bold text-red-500 text-[14.5px]",
																	children: results.hf.toFixed(3)
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																	className: "py-2.5 text-center text-muted-foreground",
																	children: "psi"
																})
															]
														})
													]
												})]
											})]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "w-full lg:w-[350px] shrink-0 flex flex-col gap-4",
										children: [
											(() => {
												const isHighVelocity = results.v > 20;
												const isWarningVelocity = results.v > 8 && results.v <= 20;
												if (isHighVelocity) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-destructive/20 bg-destructive/5 rounded-3xl p-4 flex gap-3 shadow-xs",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-5 text-destructive shrink-0 mt-0.5 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
														className: "text-[13px] font-bold text-destructive",
														children: "Severe Velocity Warning"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
														className: "text-[12px] text-muted-foreground mt-1 leading-normal",
														children: [
															"Fluid velocity of ",
															results.v.toFixed(1),
															" fps exceeds standard limits, posing serious water hammer and pipe erosion risks. Sizing adjustments required."
														]
													})] })]
												});
												if (isWarningVelocity) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-warning/20 bg-warning/5 rounded-3xl p-4 flex gap-3 shadow-xs",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-5 text-warning shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
														className: "text-[13px] font-bold text-warning",
														children: "Velocity Limit Warning"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
														className: "text-[12px] text-muted-foreground mt-1 leading-normal",
														children: [
															"Velocity of ",
															results.v.toFixed(1),
															" fps exceeds recommended 8.0 fps guideline. Check local codes."
														]
													})] })]
												});
												return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-success/20 bg-success/5 rounded-3xl p-4 flex gap-3 shadow-xs",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-5 text-success shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
														className: "text-[13px] font-bold text-success",
														children: "Velocity Sizing Compliant"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
														className: "text-[12px] text-muted-foreground mt-1 leading-normal",
														children: [
															"Piping fluid velocity is ",
															results.v.toFixed(2),
															" fps, which complies with fire protection standard design guidelines."
														]
													})] })]
												});
											})(),
											results.hf > 10 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-warning/20 bg-warning/5 rounded-3xl p-4 flex gap-3 shadow-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-5 text-warning shrink-0 mt-0.5 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "text-[13px] font-bold text-warning",
													children: "High Friction Loss"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-[12px] text-muted-foreground mt-1 leading-normal",
													children: [
														"High segment friction loss of ",
														results.hf.toFixed(2),
														" psi detected. Ensure layout operates within your project's overall hydraulic pressure budget."
													]
												})] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-3.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-[13px] font-bold text-foreground leading-snug flex items-center gap-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5 text-primary" }), " Hydraulic Sizing Advice"]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[12px] text-muted-foreground leading-relaxed flex flex-col gap-2.5",
													children: [
														results.v > 20 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "p-2.5 rounded bg-destructive/5 border border-destructive/10 text-foreground",
															children: "Increasing pipe internal diameter to next standard nominal size is highly recommended to suppress erosion risks."
														}),
														results.v > 8 && results.v <= 20 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "p-2.5 rounded bg-muted/65 border border-border text-foreground",
															children: "Increasing diameter slightly would decrease velocity and lower pump head demand."
														}),
														results.v <= 8 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "p-2.5 rounded bg-success/5 border border-success/10 text-foreground",
															children: "Operating parameters are within optimal ranges. Piping friction loss is minimized."
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[11px] text-muted-foreground mt-1 border-t border-border pt-2 leading-normal",
															children: "Friction calculations based on Hazen-Williams equation under standard fluid parameters."
														})
													]
												})]
											})
										]
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
									children: "NFPA 13 Velocity Guidelines"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11.5px] text-muted-foreground mt-1 leading-relaxed",
									children: "Hazen-Williams friction loss check:"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
									className: "text-[11px] text-muted-foreground mt-2 list-disc pl-4 flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Fluid velocity should ideally remain below 20.0 fps (6.0 m/s) to avoid surge pressure/water hammer." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Sizing standard Black Steel wet piping utilizes a C-Factor of 120, dry piping utilizes C-100, and CPVC utilizes C-150." })]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border rounded p-3.5 bg-background shadow-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "text-[12.5px] font-bold text-foreground",
								children: "AI Sizing Recommendations"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2.5 mt-2",
								children: [
									results.v > 20 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[11.5px] text-destructive flex gap-1.5 items-start",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5 text-destructive animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											"Fluid velocity is high (",
											results.v.toFixed(1),
											" fps). Increasing pipe diameter to next standard nominal size is highly recommended."
										] })]
									}),
									results.v > 8 && results.v <= 20 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[11.5px] text-warning flex gap-1.5 items-start",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5 text-warning" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											"Velocity (",
											results.v.toFixed(1),
											" fps) exceeds standard 8.0 fps guideline. Check local code requirements."
										] })]
									}),
									results.v <= 8 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[11.5px] text-success flex gap-1.5 items-start",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4 shrink-0 mt-0.5 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Pipe sizing is optimal. Flow velocity is well within standard hydraulic parameters." })]
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
export { HazenWilliamsPage as component };
