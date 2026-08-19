import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { M as Printer, Ut as TriangleAlert, Wt as Sparkles, gt as Download, in as CircleCheck, l as Upload, nn as CircleQuestionMark, rt as Gauge } from "../_libs/lucide-react.mjs";
import { r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
import { t as addPdfSignatureBlock } from "./pdfHelpers-Cqwarpxq.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/chw-pipe-sizer-BpPyeAAf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
require_excel();
import_FileSaver_min.default.saveAs;
var pipeTable = {
	.5: 15.8,
	.75: 20.93,
	1: 26.64,
	1.25: 35.05,
	1.5: 40.89,
	2: 52.5,
	2.5: 62.71,
	3: 77.93,
	3.5: 90.12,
	4: 102.26,
	5: 128.19,
	6: 154.05,
	8: 202.72,
	10: 254.46,
	12: 303.23
};
var GLYCOL_VISC = {
	chw: 1,
	cw: 1,
	g25: 1.8,
	g40: 2.6
};
var GLYCOL_DENS = {
	chw: 1,
	cw: 1,
	g25: 1.03,
	g40: 1.05
};
function colebrook(Re, relR) {
	if (Re <= 0) return .1;
	if (Re < 2300) return 64 / Re;
	let f = .25 / Math.pow(Math.log(relR / 3.7 + 5.74 / Math.pow(Re, .9)) / Math.LN10, 2);
	for (let i = 0; i < 80; i++) {
		const r = -2 * Math.log(relR / 3.7 + 2.51 / (Re * Math.sqrt(f))) / Math.LN10;
		const fn = 1 / (r * r);
		if (Math.abs(fn - f) < 1e-10) {
			f = fn;
			break;
		}
		f = fn;
	}
	return f;
}
function waterDens(tC) {
	return 999.842594 + .06793952 * tC - .00909529 * Math.pow(tC, 2) + .0001001685 * Math.pow(tC, 3) - 1120083e-12 * Math.pow(tC, 4) + 6.536332e-9 * Math.pow(tC, 5);
}
function waterVisc(tC) {
	return 2414e-8 * Math.pow(10, 247.8 / (tC + 406.15));
}
function fToC(f) {
	return (f - 32) * 5 / 9;
}
function ChwPipeSizerPage() {
	const { userData, profile } = useAuth();
	const currentUserName = userData?.name || profile?.name || "System Admin";
	const { project, forceSaveToCloud } = useWorkspace();
	const [projectInfo, setProjectInfo] = (0, import_react.useState)({
		projectName: "Commercial Tower CHW Sizing",
		projectNumber: "MEP-CHW-02",
		client: "Summit Estates Ltd",
		consultant: "Consistent Engineering Consultants",
		date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
		revision: "Rev 0",
		calcNumber: "CALC-HVAC-CHW02",
		notes: "Chilled water distribution pipe sizing study to identify optimal NPS sizes and pressure drops."
	});
	const [unitSystem, setUnitSystem] = (0, import_react.useState)("ip");
	const [sizingParams, setSizingParams] = (0, import_react.useState)({
		flowRate: "",
		fluidType: "chw",
		temperature: "",
		materialRoughness: 46e-6,
		targetDp: ""
	});
	const [activeTab, setActiveTab] = (0, import_react.useState)("calculator");
	const [showFormulaPanel, setShowFormulaPanel] = (0, import_react.useState)(false);
	const [hasCalculated, setHasCalculated] = (0, import_react.useState)(false);
	const [inputError, setInputError] = (0, import_react.useState)(null);
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		try {
			const saved = localStorage.getItem("chw_pipe_sizer_params");
			if (saved) {
				const parsed = JSON.parse(saved);
				if (parsed.sizingParams) {
					let loadedParams = { ...parsed.sizingParams };
					if (loadedParams.materialRoughness >= .001) loadedParams.materialRoughness = loadedParams.materialRoughness / 1e3;
					setSizingParams(loadedParams);
				}
				if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
				if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
				setHasCalculated(true);
			}
		} catch (e) {
			console.error(e);
			if (project?.id) setLoadedProjectId(project.id);
			else setLoadedProjectId("loaded");
		}
	}, []);
	const saveParams = (params, unit, proj) => {
		setSizingParams(params);
		setUnitSystem(unit);
		if (window.__mep_keep_values) return;
		setProjectInfo(proj);
	};
	(0, import_react.useEffect)(() => {
		try {
			localStorage.setItem("chw_pipe_sizer_params", JSON.stringify({
				sizingParams,
				unitSystem,
				projectInfo
			}));
			dirtyStore.set(true);
		} catch (e) {
			console.error(e);
		}
	}, [
		sizingParams,
		unitSystem,
		projectInfo
	]);
	const handleUnitSystemChange = (unit) => {
		if (unit === unitSystem) return;
		let nextFlow = sizingParams.flowRate;
		let nextDp = sizingParams.targetDp;
		let nextTemp = sizingParams.temperature;
		if (unit === "ip") {
			nextFlow = sizingParams.flowRate !== "" ? Number((Number(sizingParams.flowRate) * 15.8503).toFixed(1)) : "";
			nextDp = sizingParams.targetDp !== "" ? Number((Number(sizingParams.targetDp) / 22.62).toFixed(2)) : "";
			nextTemp = sizingParams.temperature !== "" ? Number((Number(sizingParams.temperature) * 1.8 + 32).toFixed(1)) : "";
		} else {
			nextFlow = sizingParams.flowRate !== "" ? Number((Number(sizingParams.flowRate) / 15.8503).toFixed(2)) : "";
			nextDp = sizingParams.targetDp !== "" ? Number((Number(sizingParams.targetDp) * 22.62).toFixed(0)) : "";
			nextTemp = sizingParams.temperature !== "" ? Number(((Number(sizingParams.temperature) - 32) / 1.8).toFixed(1)) : "";
		}
		saveParams({
			...sizingParams,
			flowRate: nextFlow,
			targetDp: nextDp,
			temperature: nextTemp
		}, unit, projectInfo);
	};
	const calculatedData = (0, import_react.useMemo)(() => {
		const ip = unitSystem === "ip";
		const flowVal = sizingParams.flowRate !== "" ? Number(sizingParams.flowRate) : ip ? 80 : 5;
		const Q = ip ? flowVal * 630902e-10 : flowVal * .001;
		const tRaw = sizingParams.temperature !== "" ? Number(sizingParams.temperature) : ip ? 44 : 6.7;
		const tC = ip ? fToC(tRaw) : tRaw;
		const eps = Number(sizingParams.materialRoughness) || 46e-6;
		const dpRaw = sizingParams.targetDp !== "" ? Number(sizingParams.targetDp) : ip ? 4 : 40;
		const targetDpPaM = ip ? dpRaw * 22.62 : dpRaw;
		const rho = waterDens(tC) * GLYCOL_DENS[sizingParams.fluidType];
		const mu = waterVisc(tC) * GLYCOL_VISC[sizingParams.fluidType];
		let chosen = null;
		const allPipes = [];
		for (const [nps, idMm] of Object.entries(pipeTable)) {
			const D = idMm / 1e3;
			const v = Q / (Math.PI * D * D / 4);
			const Re = rho * v * D / mu;
			const f = colebrook(Re, eps / D);
			const dp = f * rho * v * v / (2 * D);
			const dpFt = dp / 22.62;
			const vFps = v / .3048;
			const isCompliant = dp <= targetDpPaM * 1.05;
			const item = {
				nps,
				idMm,
				D,
				v,
				vFps,
				Re,
				f,
				dp,
				dpFt,
				isCompliant
			};
			allPipes.push(item);
			if (isCompliant) {
				chosen = item;
				break;
			}
		}
		if (!chosen) {
			const last = Object.entries(pipeTable).pop();
			const D = last[1] / 1e3;
			const v = Q / (Math.PI * D * D / 4);
			const Re = rho * v * D / mu;
			const f = colebrook(Re, eps / D);
			const dp = f * rho * v * v / (2 * D);
			chosen = {
				nps: last[0],
				idMm: last[1],
				D,
				v,
				vFps: v / .3048,
				Re,
				f,
				dp,
				dpFt: dp / 22.62
			};
		}
		const regime = chosen.Re < 2300 ? "Laminar" : chosen.Re < 4e3 ? "Transitional" : "Turbulent";
		return {
			nps: chosen.nps,
			DN: (chosen.D * 1e3).toFixed(0),
			innerDiameterMm: chosen.D * 1e3,
			velocity: chosen.v,
			velocityFps: chosen.vFps,
			pressureDropPaM: chosen.dp,
			pressureDropFt100ft: chosen.dpFt,
			reynoldsNumber: chosen.Re,
			frictionFactor: chosen.f,
			regime,
			rho,
			mu,
			allPipes
		};
	}, [sizingParams, unitSystem]);
	const handleSizePipe = () => {
		if (!sizingParams.flowRate || !sizingParams.temperature || !sizingParams.targetDp) {
			setInputError("Please fill in all required fields before calculating.");
			return;
		}
		setInputError(null);
		setHasCalculated(true);
	};
	const handleExportJSON = () => {
		const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
			projectInfo,
			sizingParams,
			unitSystem
		}));
		const downloadAnchor = document.createElement("a");
		downloadAnchor.setAttribute("href", dataStr);
		downloadAnchor.setAttribute("download", `${projectInfo.projectName.replace(/\s+/g, "_")}_chw_pipe_sizer.json`);
		document.body.appendChild(downloadAnchor);
		downloadAnchor.click();
		downloadAnchor.remove();
	};
	const handleImportJSON = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const parsed = JSON.parse(event.target?.result);
				if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
				if (parsed.sizingParams) {
					let loadedParams = { ...parsed.sizingParams };
					if (loadedParams.materialRoughness >= .001) loadedParams.materialRoughness = loadedParams.materialRoughness / 1e3;
					setSizingParams(loadedParams);
				}
				if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
				setHasCalculated(true);
			} catch (err) {
				alert("Failed to parse JSON file.");
			}
		};
		reader.readAsText(file);
	};
	const handlePrintPDF = () => {
		const doc = new import_jspdf_node_min.default("p", "pt", "a4");
		doc.setFont("helvetica", "bold");
		doc.setFontSize(20);
		doc.text("CHW PIPE SIZING REPORT", 40, 50);
		doc.setFontSize(10);
		doc.setFont("helvetica", "normal");
		doc.setTextColor(100);
		doc.text(`Generated on: ${projectInfo.date} | Calculation Code: ${projectInfo.calcNumber} | Standard: ASHRAE`, 40, 68);
		doc.setDrawColor(200);
		doc.line(40, 75, 550, 75);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(12);
		doc.setTextColor(0);
		doc.text("1. Project Details", 40, 95);
		autoTable(doc, {
			startY: 105,
			head: [],
			body: [
				[
					"Project Name",
					projectInfo.projectName,
					"Project Number",
					projectInfo.projectNumber
				],
				[
					"Consultant",
					projectInfo.consultant,
					"Client",
					projectInfo.client
				],
				[
					"Revision",
					projectInfo.revision,
					"Calculation Ref",
					projectInfo.calcNumber
				]
			],
			theme: "plain",
			styles: {
				fontSize: 9.5,
				cellPadding: 4
			},
			columnStyles: {
				0: {
					fontStyle: "bold",
					cellWidth: 90
				},
				1: { cellWidth: 170 },
				2: {
					fontStyle: "bold",
					cellWidth: 90
				},
				3: { cellWidth: 170 }
			}
		});
		doc.setFont("helvetica", "bold");
		doc.text("2. Design & Fluid Parameters", 40, doc.lastAutoTable.finalY + 25);
		const paramData = [
			[
				"Fluid Type Sized",
				sizingParams.fluidType === "chw" ? "Chilled Water" : sizingParams.fluidType === "cw" ? "Condenser Water" : sizingParams.fluidType === "g25" ? "25% Glycol" : "40% Glycol",
				"Fluid Flow Rate",
				`${sizingParams.flowRate} ${unitSystem === "ip" ? "GPM" : "L/s"}`
			],
			[
				"Operating Temp",
				`${sizingParams.temperature} ${unitSystem === "ip" ? "°F" : "°C"}`,
				"Material Roughness",
				`${(sizingParams.materialRoughness * 1e3).toFixed(4)} mm`
			],
			[
				"Target Pressure Drop Limit",
				`${sizingParams.targetDp} ${unitSystem === "ip" ? "ft w.g./100ft" : "Pa/m"}`,
				"Calculated Density",
				`${calculatedData.rho.toFixed(1)} kg/m³`
			]
		];
		autoTable(doc, {
			startY: doc.lastAutoTable.finalY + 35,
			head: [],
			body: paramData,
			theme: "striped",
			styles: {
				fontSize: 9,
				cellPadding: 4
			},
			columnStyles: {
				0: {
					fontStyle: "bold",
					cellWidth: 130
				},
				1: { cellWidth: 120 },
				2: {
					fontStyle: "bold",
					cellWidth: 130
				},
				3: { cellWidth: 120 }
			}
		});
		doc.setFont("helvetica", "bold");
		doc.text("3. Pipe Sizing Summary", 40, doc.lastAutoTable.finalY + 25);
		const summaryData = [
			["Recommended Pipe Size", `NPS ${calculatedData.nps}" / DN ${calculatedData.DN} mm`],
			["Inner Diameter (Actual)", unitSystem === "ip" ? `${(calculatedData.innerDiameterMm / 25.4).toFixed(3)} in` : `${calculatedData.innerDiameterMm.toFixed(1)} mm`],
			["Fluid Velocity Sized", unitSystem === "ip" ? `${calculatedData.velocityFps.toFixed(2)} fps` : `${calculatedData.velocity.toFixed(3)} m/s`],
			["Calculated Friction Loss", unitSystem === "ip" ? `${calculatedData.pressureDropFt100ft.toFixed(2)} ft/100ft` : `${calculatedData.pressureDropPaM.toFixed(1)} Pa/m`],
			["Reynolds Number", `${Math.round(calculatedData.reynoldsNumber).toLocaleString()}`],
			["Friction Factor (Colebrook)", `${calculatedData.frictionFactor.toFixed(5)}`],
			["Flow Regime Class", `${calculatedData.regime}`]
		];
		autoTable(doc, {
			startY: doc.lastAutoTable.finalY + 35,
			head: [],
			body: summaryData,
			theme: "striped",
			styles: {
				fontSize: 9.5,
				cellPadding: 4
			},
			columnStyles: {
				0: {
					fontStyle: "bold",
					cellWidth: 220
				},
				1: { cellWidth: 280 }
			}
		});
		addPdfSignatureBlock(doc, doc.lastAutoTable?.finalY || 40, currentUserName, project?.id || "default", "chw-pipe-sizer");
		const pdfBuffer = doc.output("arraybuffer");
		downloadFile(new Uint8Array(pdfBuffer), `${projectInfo.projectName.replace(/\s+/g, "_")}_report.pdf`, "PDF Document", ["pdf"]);
	};
	const renderSvgChart = () => {
		const ip = unitSystem === "ip";
		const vel = ip ? calculatedData.velocityFps : calculatedData.velocity;
		const vMax = ip ? 8 : 2.4;
		const flow = Number(sizingParams.flowRate);
		const u = ip ? "fps" : "m/s";
		const flowU = ip ? "GPM" : "L/s";
		const bars = [
			{
				label: "Velocity",
				value: vel,
				color: vel > vMax ? "#0A7BC7" : "#d17914",
				unit: " " + u
			},
			{
				label: "Max Allow",
				value: vMax,
				color: "#64748B",
				unit: " " + u
			},
			{
				label: "Flow Rate",
				value: flow,
				color: "#06456F",
				unit: " " + flowU
			}
		];
		const W = 540;
		const H = 160;
		const PL = 42;
		const PR = 16;
		const PT = 32;
		const PB = 44;
		const CW = W - PL - PR;
		const CH = H - PT - PB;
		const maxV = Math.max(...bars.map((b) => Math.abs(b.value || 0))) * 1.18 || 1;
		const bw = CW / bars.length;
		const gap = bw * .28;
		const bw2 = bw - gap;
		const sx = (i) => PL + i * bw + gap / 2;
		const sy = (v) => 116 - Math.max(0, v) / maxV * CH;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
			viewBox: `0 0 ${W} ${H}`,
			xmlns: "http://www.w3.org/2000/svg",
			className: "w-full h-auto block overflow-visible font-sans",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
					x: PL,
					y: "18",
					fontSize: "9.5",
					fontWeight: "700",
					fill: "var(--muted)",
					letterSpacing: "0.5",
					children: "PIPE VELOCITY & SIZING"
				}),
				[
					.25,
					.5,
					.75,
					1
				].map((t) => {
					const v = maxV * t;
					const y = sy(v);
					const lbl = v >= 1e3 ? (v / 1e3).toFixed(1) + "k" : v.toFixed(v < 10 ? 1 : 0);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: PL,
						y1: y,
						x2: W - PR,
						y2: y,
						stroke: "var(--border)",
						strokeWidth: "0.5",
						strokeDasharray: "3,3"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x: PL - 5,
						y: y + 3.5,
						textAnchor: "end",
						fontSize: "8.5",
						fill: "var(--muted)",
						className: "font-mono",
						children: lbl
					})] }, t);
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
					x1: PL,
					y1: PT,
					x2: PL,
					y2: 116,
					stroke: "var(--border)",
					strokeWidth: "1"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
					x1: PL,
					y1: 116,
					x2: W - PR,
					y2: 116,
					stroke: "var(--border)",
					strokeWidth: "1"
				}),
				bars.map((b, i) => {
					const h = Math.max(3, Math.abs(b.value || 0) / maxV * CH);
					const x = sx(i);
					const y = sy(Math.abs(b.value || 0));
					const valStr = typeof b.value === "number" ? Math.abs(b.value) >= 1e3 ? (b.value / 1e3).toFixed(1) + "k" : b.value.toFixed(b.value < 10 ? 2 : 1) : "-";
					const words = b.label.split(" ");
					const lx = x + bw2 / 2;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
							x,
							y,
							width: bw2,
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
							className: "font-mono",
							children: [valStr, b.unit]
						}),
						words.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
							x: lx,
							y: 132,
							textAnchor: "middle",
							fontSize: "8.5",
							fill: "var(--muted)",
							children: words[0]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
							x: lx,
							y: 143,
							textAnchor: "middle",
							fontSize: "8.5",
							fill: "var(--muted)",
							children: words.slice(1).join(" ")
						})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
							x: lx,
							y: 132,
							textAnchor: "middle",
							fontSize: "8.5",
							fill: "var(--muted)",
							children: b.label
						})
					] }, i);
				})
			]
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "CHW Pipe Sizer",
		hideSubHeader: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-full min-h-0 bg-transparent font-sans",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-between items-start shrink-0 select-none no-print px-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1 w-full",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
								children: "HVAC > CHW PIPE SIZER"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center gap-3 mt-0.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-baseline gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
										className: "text-[28px] font-bold tracking-tight text-foreground",
										children: "Pipe Sizer - CHW / CW"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[15px] font-semibold text-muted-foreground",
										children: "ASHRAE / SMACNA - Velocity & Pressure Drop Method"
									})]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground mt-0.5",
								children: "Size chilled water or condenser water pipes. Iterates through Sch 40 sizes to find the smallest meeting target ΔP. Glycol viscosity correction included."
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-6 mb-6 bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/60",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setActiveTab("calculator"),
								className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${activeTab === "calculator" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Sizing Calculator"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setActiveTab("report"),
								className: `px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${activeTab === "report" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Printable Report"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => handleUnitSystemChange("ip"),
								className: `px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${unitSystem === "ip" ? "bg-background text-primary shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Imperial (IP)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => handleUnitSystemChange("si"),
								className: `px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${unitSystem === "si" ? "bg-background text-primary shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`,
								children: "Metric (SI)"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex-1 min-h-0 animate-fade-in flex flex-col",
						children: activeTab === "calculator" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 min-h-0 flex flex-col relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative flex items-center justify-between gap-4 px-6 h-12 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
											children: "File Actions:"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
											onClick: handleExportJSON,
											className: "h-8.5 text-xs",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" }), " Export JSON"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "flex items-center gap-1.5 h-8.5 px-3 border border-border/80 hover:bg-surface-2 rounded-lg text-xs cursor-pointer font-semibold text-foreground select-none transition-all",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }),
												" Import JSON",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "file",
													onChange: handleImportJSON,
													accept: ".json",
													className: "hidden"
												})
											]
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										onClick: () => setShowFormulaPanel(!showFormulaPanel),
										className: "h-8.5 text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "size-3.5 text-primary" }), " Formula Reference"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										onClick: handlePrintPDF,
										primary: true,
										className: "h-8.5 text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-3.5" }), " Generate PDF Report"]
									})]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-950/20 flex flex-col gap-6",
								children: [showFormulaPanel && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm animate-slide-in flex flex-col gap-5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
										className: "font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-2.5 flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-1.5 h-3.5 bg-primary rounded-sm" }), "Features: CHW Pipe Sizer Calculator"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
										className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-muted-foreground list-disc list-inside",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "All Keyboard shortcuts" }), ": Core navigation & hotkeys."] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Velocity or Pressure Drop Method" }), ": Sizing based on maximum velocity or maximum friction head loss rate."] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Glycol Mixture Correction" }), ": Dynamically adjusts density & viscosity for glycol mixtures (0% to 50%)."] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Interactive Pipe Schedule Table" }), ": Add, remove, and size pipes dynamically; customize recommended and selected nominal pipe sizes."] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Reynolds Number & Colebrook Friction Solver" }), ": Calculates regime type and iteratively solves Colebrook-White friction factors."] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "SI / IP Dual Unit System" }), ": Dynamic Metric and Imperial unit conversion."] })
										]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "border-t border-border/40 pt-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
											className: "font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "size-4 text-primary" }), " CHW Pipe Sizer Formulas Reference"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-semibold block mb-1",
															children: "Darcy-Weisbach Equation:"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
															className: "text-primary block font-bold mb-1 font-mono text-[11px]",
															children: "hf = f × (L/D) × (v²/2g)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] text-muted-foreground",
															children: "Friction loss head in meters of water column."
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-semibold block mb-1",
															children: "Colebrook Friction Factor:"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
															className: "text-primary block font-bold mb-1 font-mono text-[11px]",
															children: "1/√f = -2log(ε/3.7D + 2.51/Re√f)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] text-muted-foreground",
															children: "Solved iteratively using Colebrook-White algorithm."
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-semibold block mb-1",
															children: "Reynolds Number:"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
															className: "text-primary block font-bold mb-1 font-mono text-[11px]",
															children: "Re = ρ × v × D / μ"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] text-muted-foreground",
															children: "Differentiates Laminar, Transitional, and Turbulent flow."
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-semibold block mb-1",
															children: "Fluid Properties:"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
															className: "text-primary block font-bold mb-1 font-mono text-[11px]",
															children: "Density (ρ) & Viscosity (μ)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] text-muted-foreground",
															children: "Calculated dynamically based on temperature and glycol%."
														})
													]
												})
											]
										})]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "lg:col-span-5 flex flex-col gap-6",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5 flex flex-col gap-4 relative",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2 pb-2.5 border-b border-border/60",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
														className: "text-xs font-bold uppercase tracking-wider text-muted-foreground",
														children: "Inputs"
													})]
												}),
												inputError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl p-3 text-xs flex gap-2 items-center",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 text-red-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: inputError })]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col gap-3.5 text-xs font-sans",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-1.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex justify-between items-center",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																	className: "text-xs font-semibold text-foreground",
																	children: "Flow Rate"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-muted-foreground rounded uppercase font-mono",
																	children: unitSystem === "ip" ? "GPM" : "L/s"
																})]
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																step: "any",
																value: sizingParams.flowRate,
																onChange: (e) => {
																	const val = e.target.value === "" ? "" : Number(e.target.value);
																	saveParams({
																		...sizingParams,
																		flowRate: val
																	}, unitSystem, projectInfo);
																},
																placeholder: unitSystem === "ip" ? "80" : "5.0",
																className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-1.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																className: "text-xs font-semibold text-foreground flex justify-between items-center",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Fluid Type" })
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																value: sizingParams.fluidType,
																onChange: (e) => saveParams({
																	...sizingParams,
																	fluidType: e.target.value
																}, unitSystem, projectInfo),
																className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "chw",
																		children: "Chilled Water"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "cw",
																		children: "Condenser Water"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "g25",
																		children: "25% Glycol"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "g40",
																		children: "40% Glycol"
																	})
																]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-1.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex justify-between items-center",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																	className: "text-xs font-semibold text-foreground",
																	children: "Fluid Temperature"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-muted-foreground rounded uppercase font-mono",
																	children: unitSystem === "ip" ? "°F" : "°C"
																})]
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																step: "any",
																value: sizingParams.temperature,
																onChange: (e) => {
																	const val = e.target.value === "" ? "" : Number(e.target.value);
																	saveParams({
																		...sizingParams,
																		temperature: val
																	}, unitSystem, projectInfo);
																},
																placeholder: unitSystem === "ip" ? "44" : "6.7",
																className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-1.5",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																	className: "text-xs font-semibold text-foreground",
																	children: "Pipe Material"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																	value: sizingParams.materialRoughness,
																	onChange: (e) => saveParams({
																		...sizingParams,
																		materialRoughness: Number(e.target.value)
																	}, unitSystem, projectInfo),
																	className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]",
																	children: [
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "0.000046",
																			children: "Carbon Steel"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "0.0000015",
																			children: "Copper"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "0.000150",
																			children: "Galvanized Steel"
																		})
																	]
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																	className: "text-[10.5px] text-muted-foreground mt-0.5 block",
																	children: [
																		"Roughness: ",
																		(sizingParams.materialRoughness * 1e3).toFixed(4),
																		" mm"
																	]
																})
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col gap-1.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex justify-between items-center",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
																	className: "text-xs font-semibold text-foreground",
																	children: "Target ΔP"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-muted-foreground rounded uppercase font-mono",
																	children: unitSystem === "ip" ? "ft w.g./100ft" : "Pa/m"
																})]
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																step: "any",
																value: sizingParams.targetDp,
																onChange: (e) => {
																	const val = e.target.value === "" ? "" : Number(e.target.value);
																	saveParams({
																		...sizingParams,
																		targetDp: val
																	}, unitSystem, projectInfo);
																},
																placeholder: unitSystem === "ip" ? "4.0" : "40",
																className: "w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
															})]
														})
													]
												})
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: handleSizePipe,
											className: "w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer text-xs",
											children: "⚡ Size Pipe"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "lg:col-span-7 flex flex-col gap-6",
										children: !hasCalculated ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none",
													children: "❄️"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "text-xs font-bold text-foreground mb-1 uppercase tracking-wider",
													children: "Ready for Sizing"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-[11.5px] text-muted-foreground max-w-xs leading-normal",
													children: [
														"Fill in the design inputs on the left and click ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Size Pipe" }),
														" to compute optimal pipe sizes and view velocity profiles."
													]
												})
											]
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
											(calculatedData.velocityFps < 2 || calculatedData.velocityFps > 8) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col gap-3",
												children: [calculatedData.velocityFps < 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "bg-sky-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl p-3.5 flex gap-2.5 text-[11.5px] items-start",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5 text-amber-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
														className: "font-bold",
														children: "Velocity Alert"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
														className: "mt-0.5 text-muted-foreground leading-normal",
														children: [
															"Velocity ",
															calculatedData.velocityFps.toFixed(2),
															" fps - Below 2 fps. Air pocket/sedimentation risk."
														]
													})] })]
												}), calculatedData.velocityFps > 8 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "bg-sky-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl p-3.5 flex gap-2.5 text-[11.5px] items-start",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 mt-0.5 text-amber-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
														className: "font-bold",
														children: "Velocity Alert"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
														className: "mt-0.5 text-muted-foreground leading-normal",
														children: [
															"Velocity ",
															calculatedData.velocityFps.toFixed(2),
															" fps - Exceeds 8 fps. Erosion risk at fittings."
														]
													})] })]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5 flex flex-col gap-4 relative",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2 pb-2.5 border-b border-border/60",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-3.5 bg-[#0A7BC7] rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
														className: "text-xs font-bold uppercase tracking-wider text-muted-foreground",
														children: "Pipe Selection"
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col gap-3 font-sans text-xs",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-1.5 border-b border-border/40",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-semibold text-muted-foreground",
																children: "Selected Pipe Size"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
																className: "font-bold text-[#0A7BC7] text-[13px] font-mono",
																children: [
																	"NPS ",
																	calculatedData.nps,
																	"\" / DN ",
																	calculatedData.DN,
																	" mm"
																]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-1.5 border-b border-border/40",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-semibold text-muted-foreground",
																children: "Internal Diameter"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
																className: "font-bold text-foreground font-mono",
																children: unitSystem === "ip" ? `${(calculatedData.innerDiameterMm / 25.4).toFixed(3)} in` : `${calculatedData.innerDiameterMm.toFixed(1)} mm`
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-1.5 border-b border-border/40",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-semibold text-muted-foreground",
																children: "Velocity"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
																className: "font-bold text-[#0A7BC7] font-mono",
																children: unitSystem === "ip" ? `${calculatedData.velocityFps.toFixed(2)} fps` : `${calculatedData.velocity.toFixed(3)} m/s`
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-1.5 border-b border-border/40",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-semibold text-muted-foreground",
																children: "Pressure Drop"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
																className: "font-bold text-foreground font-mono",
																children: unitSystem === "ip" ? `${calculatedData.pressureDropFt100ft.toFixed(2)} ft/100ft` : `${calculatedData.pressureDropPaM.toFixed(1)} Pa/m`
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-1.5 border-b border-border/40",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-semibold text-muted-foreground",
																children: "Reynolds Number"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
																className: "font-bold text-foreground font-mono",
																children: Math.round(calculatedData.reynoldsNumber).toLocaleString()
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-center py-1.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-semibold text-muted-foreground",
																children: "Flow Regime"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
																className: "font-bold text-foreground font-mono",
																children: calculatedData.regime
															})]
														})
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5 flex flex-col gap-4 relative",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "w-full relative select-none",
													children: renderSvgChart()
												})
											})
										] })
									})]
								})]
							})]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 flex flex-col min-h-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "relative flex items-center justify-end gap-3 px-6 h-12 bg-background border-b border-border/60 shrink-0 no-print select-none",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
									onClick: handlePrintPDF,
									primary: true,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-3.5" }), " Print / Export PDF"]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 overflow-y-auto p-8 bg-slate-50/30 dark:bg-slate-950/20 font-sans print:p-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "no-print max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10 border border-blue-100/60 dark:border-orange-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "absolute right-4 top-4 bg-[#0A7BC7]/10 text-[#06456F] rounded-full p-2",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4" })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold text-[#06456F] dark:text-sky-400 uppercase tracking-widest block mb-1",
													children: "Recommended size"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
													children: [
														"NPS ",
														calculatedData.nps,
														"\""
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[11px] text-muted-foreground mt-2 block",
													children: [
														"Inner Diameter: ",
														calculatedData.innerDiameterMm.toFixed(1),
														" mm (DN ",
														calculatedData.DN,
														")"
													]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "bg-gradient-to-br from-pink-50 to-pink-100/50 dark:from-pink-950/20 dark:to-pink-900/10 border border-pink-200/60 dark:border-pink-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "absolute right-4 top-4 bg-pink-500/10 text-pink-600 rounded-full p-2",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gauge, { className: "size-4" })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-widest block mb-1",
													children: "Fluid Velocity"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
													children: unitSystem === "ip" ? `${calculatedData.velocityFps.toFixed(2)} fps` : `${calculatedData.velocity.toFixed(3)} m/s`
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[11px] text-muted-foreground mt-2 block",
													children: ["Flow Type: ", sizingParams.fluidType === "chw" ? "Chilled Water" : "Condenser Water"]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "absolute right-4 top-4 bg-emerald-500/10 text-emerald-600 rounded-full p-2",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4" })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1",
													children: "Pressure Drop"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
													children: unitSystem === "ip" ? `${calculatedData.pressureDropFt100ft.toFixed(2)} ft/100ft` : `${calculatedData.pressureDropPaM.toFixed(1)} Pa/m`
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[11px] text-muted-foreground mt-2 block",
													children: [
														"Target limit: ",
														sizingParams.targetDp,
														" ",
														unitSystem === "ip" ? "ft/100ft" : "Pa/m"
													]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: `bg-gradient-to-br border rounded-2xl p-5 shadow-xs relative overflow-hidden ${calculatedData.velocityFps > 8 ? "from-rose-50 to-rose-100/50 dark:from-rose-950/20 dark:to-rose-900/10 border-rose-200/60 dark:border-rose-800/50" : calculatedData.velocityFps < 2 ? "from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200/60 dark:border-amber-800/50" : "from-teal-50 to-teal-100/50 dark:from-teal-950/20 dark:to-teal-900/10 border-teal-200/60 dark:border-teal-800/50"}`,
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "absolute right-4 top-4 text-muted-foreground rounded-full p-2",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4" })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-bold uppercase tracking-widest block mb-1",
													children: "Flow Velocity Status"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "text-2xl font-black text-slate-900 dark:text-white block font-mono",
													children: calculatedData.velocityFps > 8 ? "High" : calculatedData.velocityFps < 2 ? "Low" : "Optimal"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[11px] text-muted-foreground mt-2 block",
													children: calculatedData.velocityFps > 8 ? "Erosion & noise hazard" : calculatedData.velocityFps < 2 ? "Air pocket & settling hazard" : "Sizing parameters in range"
												})
											]
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "border border-slate-300 dark:border-slate-800 rounded-xl p-8 max-w-4xl mx-auto shadow-sm print:border-none print:shadow-none print:p-0 bg-white",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border-b-2 border-slate-800 pb-5 mb-6 flex justify-between items-start",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
												className: "text-xl font-extrabold text-slate-900 uppercase tracking-wider",
												children: "CHW PIPE SIZING REPORT"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[12px] text-muted-foreground font-mono mt-1",
												children: "Chilled Water Pipe Sizing compliant with ASHRAE / Colebrook equation"
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-right",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[13px] font-bold text-[#0A7BC7] font-mono block",
													children: "MEP CALCULATION SUITE"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[11px] text-muted-foreground block mt-0.5",
													children: ["Date: ", projectInfo.date]
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mb-6",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "font-bold text-[13px] text-slate-900 border-b border-slate-200 pb-1 mb-3",
												children: "1. Project Details"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-2 gap-4 text-xs",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Project Name:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-slate-900",
														children: projectInfo.projectName
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Project Number:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-slate-900",
														children: projectInfo.projectNumber
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Consultant / Engineer:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-slate-900",
														children: projectInfo.consultant
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Client Name:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-slate-900",
														children: projectInfo.client
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "col-span-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground block",
															children: "Calculation Notes:"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "italic text-muted-foreground block mt-0.5",
															children: projectInfo.notes
														})]
													})
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mb-6",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "font-bold text-[13px] text-slate-900 border-b border-slate-200 pb-1 mb-3",
												children: "2. Fluid Sizing Parameters"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-3 gap-y-3.5 gap-x-4 text-xs",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Fluid Type:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
														className: "font-mono text-slate-900 font-bold",
														children: sizingParams.fluidType === "chw" ? "Chilled Water" : sizingParams.fluidType === "cw" ? "Condenser Water" : sizingParams.fluidType === "g25" ? "25% Glycol" : "40% Glycol"
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Operating Flow Rate:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "font-mono text-slate-900 font-bold",
														children: [
															sizingParams.flowRate,
															" ",
															unitSystem === "ip" ? "GPM" : "L/s"
														]
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Operating Temperature:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "font-mono text-slate-900 font-bold",
														children: [
															sizingParams.temperature,
															" ",
															unitSystem === "ip" ? "°F" : "°C"
														]
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Material Roughness:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "font-mono text-slate-900 font-bold",
														children: [(sizingParams.materialRoughness * 1e3).toFixed(4), " mm"]
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Target Friction Loss Limit:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "font-mono text-slate-900 font-bold",
														children: [
															sizingParams.targetDp,
															" ",
															unitSystem === "ip" ? "ft w.g./100ft" : "Pa/m"
														]
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground block",
														children: "Calculated Density:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "font-mono text-slate-900 font-bold",
														children: [calculatedData.rho.toFixed(1), " kg/m³"]
													})] })
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mb-6",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "font-bold text-[13px] text-slate-900 border-b border-slate-200 pb-1 mb-3",
												children: "3. Sizing Summary Results"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border border-slate-200 rounded-lg p-4 flex flex-col gap-3 bg-slate-50 text-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid grid-cols-2 gap-4 pb-2 border-b border-slate-200",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground",
														children: "Recommended Diameter:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: "block text-[13px] font-mono mt-0.5 text-[#0A7BC7]",
														children: [
															"NPS ",
															calculatedData.nps,
															"\" / DN ",
															calculatedData.DN,
															" mm"
														]
													})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground",
														children: "Actual Inner Diameter:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
														className: "block text-[13px] font-mono mt-0.5 text-slate-900",
														children: unitSystem === "ip" ? `${(calculatedData.innerDiameterMm / 25.4).toFixed(3)} in` : `${calculatedData.innerDiameterMm.toFixed(1)} mm`
													})] })]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid grid-cols-3 gap-4 pt-1",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground",
															children: "Fluid Velocity:"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
															className: "block font-mono mt-0.5 text-slate-900",
															children: unitSystem === "ip" ? `${calculatedData.velocityFps.toFixed(2)} fps` : `${calculatedData.velocity.toFixed(3)} m/s`
														})] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground",
															children: "Actual Friction Loss:"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
															className: "block text-[13px] text-[#06456F] font-mono mt-0.5",
															children: unitSystem === "ip" ? `${calculatedData.pressureDropFt100ft.toFixed(2)} ft/100ft` : `${calculatedData.pressureDropPaM.toFixed(1)} Pa/m`
														})] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground",
															children: "Friction Factor (f):"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
															className: "block font-mono mt-0.5 text-slate-900",
															children: calculatedData.frictionFactor.toFixed(5)
														})] })
													]
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-[11px] text-muted-foreground",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "font-semibold uppercase tracking-wider text-slate-800 mb-6 font-bold",
													children: "Prepared By:"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "border-b border-slate-300 w-48 mb-1" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Consulting HVAC Engineer" })
											] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-right",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "font-semibold uppercase tracking-wider text-slate-800 mb-6 font-bold",
														children: "Reviewed & Approved By:"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "border-b border-slate-300 w-48 ml-auto mb-1" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Lead MEP Principal Engineer" })
												]
											})]
										})
									]
								})]
							})]
						})
					})]
				})]
			})
		})
	});
}
//#endregion
export { ChwPipeSizerPage as component };
