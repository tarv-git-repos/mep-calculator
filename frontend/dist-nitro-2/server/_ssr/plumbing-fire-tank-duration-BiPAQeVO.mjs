import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-Ct3ePlL1.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, Nt as Calculator, S as Settings, Wt as TriangleAlert, Y as Info, in as CircleCheckBig, on as CircleAlert } from "../_libs/lucide-react.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-urg-0zDa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-fire-tank-duration-BiPAQeVO.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function FireTankDurationPage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const [unit, setUnit] = (0, import_react.useState)("si");
	const [demand, setDemand] = (0, import_react.useState)(1892.7);
	const [durationSel, setDurationSel] = (0, import_react.useState)("60");
	const [customDur, setCustomDur] = (0, import_react.useState)(60);
	const [tankCap, setTankCap] = (0, import_react.useState)(12e4);
	const [refillRate, setRefillRate] = (0, import_react.useState)(0);
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (project?.id) {
			try {
				const saved = localStorage.getItem(`fireTankDuration_${project.id}`);
				if (saved) {
					const parsed = JSON.parse(saved);
					setUnit(parsed.unit ?? "si");
					setDemand(parsed.demand ?? 1892.7);
					setDurationSel(parsed.durationSel ?? "60");
					setCustomDur(parsed.customDur ?? 60);
					setTankCap(parsed.tankCap ?? 12e4);
					setRefillRate(parsed.refillRate ?? 0);
				}
			} catch (e) {
				console.error(e);
			}
			setLoadedProjectId(project.id);
		}
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			localStorage.setItem(`fireTankDuration_${project.id}`, JSON.stringify({
				unit,
				demand,
				durationSel,
				customDur,
				tankCap,
				refillRate
			}));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		unit,
		demand,
		durationSel,
		customDur,
		tankCap,
		refillRate
	]);
	const saveState = () => {
		if (project?.id) {
			localStorage.setItem(`fireTankDuration_${project.id}`, JSON.stringify({
				unit,
				demand,
				durationSel,
				customDur,
				tankCap,
				refillRate
			}));
			dirtyStore.set(true);
			if (forceSaveToCloud) forceSaveToCloud();
		}
	};
	const handleSave = () => {
		saveState();
		alert("Calculation saved successfully!");
	};
	const isIP = unit === "ip";
	const duration = durationSel === "custom" ? customDur : parseFloat(durationSel) || 60;
	const reqVol = demand * duration;
	const actualDurMin = demand > 0 ? tankCap / demand : 0;
	const refillMin = refillRate > 0 ? tankCap / refillRate : Infinity;
	const ok = tankCap >= reqVol;
	const shortfall = reqVol > tankCap ? reqVol - tankCap : 0;
	const formatVol = (v) => isIP ? `${(v * .264172).toFixed(0)} gal` : `${v.toFixed(0)} L`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Fire Tank Duration",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-6 max-w-5xl mx-auto space-y-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex justify-between items-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "text-2xl font-bold text-gray-900 flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calculator, { className: "w-6 h-6 text-[#0A7BC7]" }), "Fire Tank Duration"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-gray-500 text-sm mt-1",
					children: "Verify tank capacity against required fire demand duration"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: unit,
						onChange: (e) => setUnit(e.target.value),
						className: "border-gray-300 rounded-md text-sm shadow-sm focus:border-[#0A7BC7] focus:ring-[#0A7BC7]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "si",
							children: "SI (L/min, L)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "ip",
							children: "IP (GPM, gal)"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: handleSave,
						className: "flex items-center gap-2 px-4 py-2 bg-[#0A7BC7] text-white rounded-md hover:bg-[#06456F] transition-colors shadow-sm text-sm font-medium",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "w-4 h-4" }), "Save Calculation"]
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 lg:grid-cols-2 gap-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "bg-gray-50 border-b border-gray-200 px-5 py-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
							className: "text-lg font-semibold text-gray-800 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "w-5 h-5 text-gray-500" }), "Design Parameters"]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-5 space-y-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-sm font-medium text-gray-700 mb-1",
								children: [
									"Total System Demand (",
									isIP ? "GPM" : "L/min",
									")"
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "number",
								value: isIP ? (demand * .264172).toFixed(1) : demand,
								onChange: (e) => setDemand(isIP ? parseFloat(e.target.value) / .264172 : parseFloat(e.target.value)),
								className: "w-full border-gray-300 rounded-md shadow-sm focus:ring-[#0A7BC7] focus:border-[#0A7BC7]"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-sm font-medium text-gray-700 mb-1",
								children: "Required Duration"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: durationSel,
								onChange: (e) => setDurationSel(e.target.value),
								className: "w-full border-gray-300 rounded-md shadow-sm focus:ring-[#0A7BC7] focus:border-[#0A7BC7]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "30",
										children: "30 minutes (Light Hazard)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "60",
										children: "60 minutes (Ordinary Hazard)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "90",
										children: "90 minutes (Ordinary/Extra Hazard)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "120",
										children: "120 minutes (Extra Hazard)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "custom",
										children: "Custom duration"
									})
								]
							})] }),
							durationSel === "custom" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-sm font-medium text-gray-700 mb-1",
								children: "Custom Duration (min)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "number",
								value: customDur,
								onChange: (e) => setCustomDur(parseFloat(e.target.value)),
								className: "w-full border-gray-300 rounded-md shadow-sm focus:ring-[#0A7BC7] focus:border-[#0A7BC7]"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-sm font-medium text-gray-700 mb-1",
								children: [
									"Tank Actual Capacity (",
									isIP ? "gal" : "L",
									")"
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "number",
								value: isIP ? (tankCap * .264172).toFixed(0) : tankCap,
								onChange: (e) => setTankCap(isIP ? parseFloat(e.target.value) / .264172 : parseFloat(e.target.value)),
								className: "w-full border-gray-300 rounded-md shadow-sm focus:ring-[#0A7BC7] focus:border-[#0A7BC7]"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-sm font-medium text-gray-700 mb-1",
								children: [
									"Refill Supply Rate (",
									isIP ? "GPM" : "L/min",
									") ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-gray-400 font-normal",
										children: "(Optional)"
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "number",
								value: isIP ? (refillRate * .264172).toFixed(1) : refillRate,
								onChange: (e) => setRefillRate(isIP ? parseFloat(e.target.value) / .264172 : parseFloat(e.target.value)),
								className: "w-full border-gray-300 rounded-md shadow-sm focus:ring-[#0A7BC7] focus:border-[#0A7BC7]"
							})] })
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "bg-gray-50 border-b border-gray-200 px-5 py-4",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
									className: "text-lg font-semibold text-gray-800 flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "w-5 h-5 text-gray-500" }), "Tank Results"]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-5 space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-2 border-b border-gray-100",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-gray-600",
											children: "Required Volume"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-semibold text-gray-900",
											children: formatVol(reqVol)
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-2 border-b border-gray-100",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-gray-600",
											children: "Actual Tank Capacity"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-semibold text-gray-900",
											children: formatVol(tankCap)
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-2 border-b border-gray-100",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-gray-600",
											children: "Target Duration"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-semibold text-gray-900",
											children: [duration, " min"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-2 border-b border-gray-100",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-gray-600",
											children: "Actual Duration"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: `font-semibold ${actualDurMin < duration ? "text-red-600" : "text-gray-900"}`,
											children: [actualDurMin.toFixed(0), " min"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between items-center py-2 border-b border-gray-100",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-gray-600",
											children: "Tank Refill Time"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-semibold text-gray-900",
											children: refillMin === Infinity ? "No refill supply" : `${refillMin.toFixed(0)} min (${(refillMin / 60).toFixed(1)} hrs)`
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-4 rounded-lg flex items-center gap-3 ${ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`,
										children: [ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheckBig, { className: "w-6 h-6 flex-shrink-0" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "w-6 h-6 flex-shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "font-bold",
											children: ok ? "ADEQUATE" : "UNDERSIZED"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-sm mt-0.5 opacity-90",
											children: ok ? "Tank meets the required duration capacity." : `Increase tank capacity by ${formatVol(shortfall)}.`
										})] })]
									})
								]
							})]
						}),
						!ok && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "bg-red-50 border-l-4 border-red-500 p-4 rounded-md",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-red-800 font-semibold text-sm",
									children: "Tank Undersized"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-red-700 text-sm mt-1",
									children: [
										"Tank ",
										formatVol(tankCap),
										" is ",
										((reqVol - tankCap) / reqVol * 100).toFixed(0),
										"% short of required ",
										formatVol(reqVol),
										". Increase tank capacity."
									]
								})] })]
							})
						}),
						refillMin > 480 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-amber-800 font-semibold text-sm",
									children: "Slow Refill"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-amber-700 text-sm mt-1",
									children: [
										"Refill time ",
										(refillMin / 60).toFixed(1),
										" hrs - slow. Verify mains supply capacity can restore tank within 24 hrs (AHJ requirement may vary)."
									]
								})] })]
							})
						})
					]
				})]
			})]
		})
	});
}
//#endregion
export { FireTankDurationPage as component };
