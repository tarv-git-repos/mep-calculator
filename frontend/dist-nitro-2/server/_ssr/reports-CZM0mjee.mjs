import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { gt as Download, lt as FileText } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reports-CZM0mjee.js
var import_jsx_runtime = require_jsx_runtime();
var REPORTS = [
	{
		name: "ASHRAE 62.1 Compliance",
		desc: "Ventilation rates per occupiable space, by zone and system.",
		date: "Updated 2h ago"
	},
	{
		name: "Pressure Balance Report",
		desc: "Building-wide pressure differentials and balance analysis.",
		date: "Updated 1d ago"
	},
	{
		name: "Equipment Schedule",
		desc: "AHU, EAF, and exhaust equipment schedule with capacities.",
		date: "Updated 3d ago"
	},
	{
		name: "Zone Airflow Summary",
		desc: "Fresh and extract air totals per zone, building, and floor.",
		date: "Updated 2h ago"
	},
	{
		name: "Spaces Without Equipment",
		desc: "Audit of spaces missing equipment assignment.",
		date: "Live"
	},
	{
		name: "Full Project Calculation Sheet",
		desc: "Complete engineering documentation for handover.",
		date: "Updated 5d ago"
	}
];
function ReportsPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Reports",
		subtitle: "6 templates",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
			primary: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5" }), " New Report"]
		}),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "p-6 overflow-auto h-full",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-3 max-w-5xl",
				children: REPORTS.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border border-border rounded p-4 hover:border-border-strong hover:shadow-sm transition-all bg-background",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-4 text-primary mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10.5px] text-muted-foreground uppercase tracking-wider",
								children: r.date
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "mt-3 text-[13.5px] font-semibold",
							children: r.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[12px] text-muted-foreground leading-relaxed",
							children: r.desc
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3" }), " PDF"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TBtn, { children: "Generate" })]
						})
					]
				}, r.name))
			})
		})
	});
}
//#endregion
export { ReportsPage as component };
