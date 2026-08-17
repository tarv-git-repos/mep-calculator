import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { E as Save, G as List, S as Settings, Y as Info } from "../_libs/lucide-react.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-drainage-ClWyf3dc.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var drainFxDef = [
	{
		name: "WC",
		dfu: 4,
		val: 0
	},
	{
		name: "Lavatory",
		dfu: 1,
		val: 2
	},
	{
		name: "Bathtub/Shower",
		dfu: 2,
		val: 2
	},
	{
		name: "Kitchen Sink",
		dfu: 2,
		val: 1
	},
	{
		name: "Dishwasher",
		dfu: 2,
		val: 0
	},
	{
		name: "Clothes Washer",
		dfu: 3,
		val: 0
	},
	{
		name: "Floor Drain (2\")",
		dfu: 2,
		val: 0
	},
	{
		name: "Urinal",
		dfu: 4,
		val: 0
	}
];
function DrainagePage() {
	const { project, forceSaveToCloud } = useWorkspace();
	const [fixtures, setFixtures] = (0, import_react.useState)(drainFxDef);
	const [drainType, setDrainType] = (0, import_react.useState)("branch");
	const [loadedProjectId, setLoadedProjectId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (project?.id) {
			try {
				const saved = localStorage.getItem(`drainage_${project.id}`);
				if (saved) {
					const p = JSON.parse(saved);
					setFixtures(p.fixtures ?? drainFxDef);
					setDrainType(p.drainType ?? "branch");
				}
			} catch (e) {
				console.error(e);
			}
			setLoadedProjectId(project.id);
		}
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && loadedProjectId === project.id) {
			localStorage.setItem(`drainage_${project.id}`, JSON.stringify({
				fixtures,
				drainType
			}));
			dirtyStore.set(true);
		}
	}, [
		project?.id,
		loadedProjectId,
		fixtures,
		drainType
	]);
	const saveState = () => {
		if (project?.id) {
			localStorage.setItem(`drainage_${project.id}`, JSON.stringify({
				fixtures,
				drainType
			}));
			dirtyStore.set(true);
			if (forceSaveToCloud) forceSaveToCloud();
		}
	};
	const handleSave = () => {
		saveState();
		alert("Calculation saved successfully!");
	};
	const adjFx = (index, d) => {
		const newFx = [...fixtures];
		newFx[index].val = Math.max(0, newFx[index].val + d);
		setFixtures(newFx);
	};
	const branchSize = (dfu) => {
		if (dfu <= 1) return 2;
		if (dfu <= 3) return 3;
		if (dfu <= 12) return 4;
		if (dfu <= 160) return 6;
		if (dfu <= 360) return 8;
		return 10;
	};
	const stackSize = (dfu) => {
		if (dfu <= 2) return 2;
		if (dfu <= 8) return 3;
		if (dfu <= 50) return 4;
		if (dfu <= 256) return 6;
		if (dfu <= 600) return 8;
		if (dfu <= 1380) return 10;
		return 12;
	};
	const total = fixtures.reduce((acc, f) => acc + f.dfu * f.val, 0);
	let size;
	if (drainType === "branch") size = branchSize(total);
	else if (drainType === "stack") size = stackSize(total);
	else {
		size = stackSize(total);
		if (size < 4) size = 4;
	}
	const slope = drainType === "branch" ? size < 3 ? "20.8 mm/m (¼\"/ft)" : "10.4 mm/m (⅛\"/ft)" : "N/A (vertical)";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Drainage Pipe Sizing",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-6 max-w-5xl mx-auto space-y-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex justify-between items-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "text-2xl font-bold text-gray-900 flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { className: "w-6 h-6 text-blue-500" }), "Drainage Pipe Sizing"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-gray-500 text-sm mt-1",
					children: "Determine branch and stack sizes based on Fixture Units (DFU)"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center gap-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: handleSave,
						className: "flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "w-4 h-4" }), "Save Calculation"]
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 lg:grid-cols-2 gap-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "bg-gray-50 border-b border-gray-200 px-5 py-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
							className: "text-lg font-semibold text-gray-800 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "w-5 h-5 text-gray-500" }), "Pipe Type & Fixtures"]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-5 space-y-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex gap-3",
							children: [
								"branch",
								"stack",
								"building"
							].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setDrainType(t),
								className: `px-4 py-2 rounded-full text-sm font-medium transition-colors border ${drainType === t ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`,
								children: [
									t.charAt(0).toUpperCase() + t.slice(1),
									" ",
									t === "building" ? "Drain" : ""
								]
							}, t))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-3",
							children: fixtures.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors bg-white",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-semibold text-sm text-gray-800",
									children: f.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-xs text-gray-500",
									children: [
										"DFU: ",
										f.dfu,
										" each"
									]
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => adjFx(i, -1),
											className: "w-8 h-8 flex items-center justify-center rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 text-lg font-medium",
											children: "−"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "w-6 text-center font-bold text-gray-800",
											children: f.val
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => adjFx(i, 1),
											className: "w-8 h-8 flex items-center justify-center rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 text-lg font-medium",
											children: "+"
										})
									]
								})]
							}, i))
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "bg-gray-50 border-b border-gray-200 px-5 py-4",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								className: "text-lg font-semibold text-gray-800 flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "w-5 h-5 text-gray-500" }), "Calculated Results"]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-5 space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-gray-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-gray-600",
										children: "Total DFU"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-semibold text-gray-900",
										children: [total, " DFU"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-gray-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-gray-600",
										children: "Required Minimum Size"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-bold text-blue-700 text-lg",
										children: [
											size,
											"\" NPS (",
											(size * 25.4).toFixed(0),
											" mm)"
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between items-center py-2 border-b border-gray-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-gray-600",
										children: "Required Slope"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold text-gray-900",
										children: slope
									})]
								})
							]
						})]
					})
				})]
			})]
		})
	});
}
//#endregion
export { DrainagePage as component };
