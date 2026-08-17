import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-Ct3ePlL1.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { K as LayoutDashboard, Lt as Boxes, Ot as ChevronRight, Ut as Activity, Wt as TriangleAlert, Xt as Layers, an as CircleCheck, b as ShieldCheck, f as TrendingUp, wt as Clock } from "../_libs/lucide-react.mjs";
import { i as useAuth } from "./AuthContext-CY5Koh3s.mjs";
import { g as Link, m as createFileRoute } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as AppShell } from "./AppShell-urg-0zDa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard-BMZG-Dii.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Route = createFileRoute("/dashboard")({});
function DashboardPage() {
	const { spaces, zones, equipment, activeProjectId, refreshProjects } = useWorkspace();
	const { profile } = useAuth();
	const [recentCalcs, setRecentCalcs] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		refreshProjects();
	}, []);
	(0, import_react.useEffect)(() => {
		if (profile?.id && activeProjectId) try {
			const key = `recent_calcs_${profile.id}_${activeProjectId}`;
			setRecentCalcs(JSON.parse(localStorage.getItem(key) || "[]"));
		} catch {}
	}, [profile?.id, activeProjectId]);
	const stats = (0, import_react.useMemo)(() => {
		const totalFresh = spaces.reduce((sum, s) => sum + (s.freshAir || 0), 0);
		const totalExtract = spaces.reduce((sum, s) => sum + (s.extractAir || 0), 0);
		let warnings = 0;
		spaces.forEach((s) => {
			if (s.freshAir === 0 && s.occupancy && s.occupancy > 0) warnings++;
			if (s.freshAir < (s.minOA || 0)) warnings++;
		});
		zones.forEach((z) => {
			if (z.pressureType === "neutral" && Math.abs(z.pressure) > 50) warnings++;
		});
		const compliance = Math.max(0, Math.min(100, Math.round(100 - warnings / (spaces.length || 1) * 100)));
		return {
			totalFresh,
			totalExtract,
			warnings,
			compliance
		};
	}, [spaces, zones]);
	const activeAlerts = (0, import_react.useMemo)(() => {
		const alerts = [];
		zones.forEach((z) => {
			if (Math.abs(z.pressure) > 100) alerts.push({
				id: `zone-${z.id}`,
				title: `Zone Imbalance: ${z.name}`,
				desc: `Flow imbalance is ${z.pressure > 0 ? "+" : ""}${z.pressure.toFixed(0)} L/s. Door force criteria may fail.`,
				type: "critical"
			});
		});
		spaces.slice(0, 4).forEach((s) => {
			if (s.freshAir < (s.minOA || 0)) alerts.push({
				id: `space-${s.id}`,
				title: `Low Fresh Air: ${s.name}`,
				desc: `Supplying ${s.freshAir} L/s but design standard requires minimum ${s.minOA} L/s.`,
				type: "warning"
			});
		});
		return alerts;
	}, [spaces, zones]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Dashboard",
		subtitle: "Active metrics summary",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "p-6 overflow-y-auto h-full bg-slate-50/30 dark:bg-zinc-950/20",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "max-w-5xl mx-auto flex flex-col gap-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "size-5 text-success" }),
							label: "Fresh Intake",
							value: `${stats.totalFresh.toLocaleString()} L/s`,
							desc: "Total treated air"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "size-5 text-primary" }),
							label: "Compliance",
							value: `${stats.compliance}%`,
							desc: "Ventilation score",
							progress: stats.compliance
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "size-5 text-blue-500" }),
							label: "Cooling Load",
							value: "--- TR",
							desc: "Global placeholder"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className: "size-5 text-amber-500" }),
							label: "Electrical Load",
							value: "--- kW",
							desc: "Global placeholder"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "size-5 text-primary" }),
							label: "Total Spaces",
							value: spaces.length,
							desc: "Active design rooms"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Boxes, { className: "size-5 text-primary" }),
							label: "Equipment",
							value: equipment.length,
							desc: "AHU, Fans, etc."
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border border-border/80 rounded-3xl bg-card p-6 flex flex-col gap-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between border-b border-border/50 pb-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4.5 text-warning" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-zinc-400",
									children: "Active Warnings & Compliance Issues"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[10px] font-mono bg-warning/10 text-warning px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
								children: [stats.warnings, " Flagged"]
							})]
						}), activeAlerts.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-col gap-3",
							children: activeAlerts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-4 rounded-2xl border text-[12.5px] flex gap-3.5 transition-all hover:bg-surface-2 dark:hover:bg-zinc-800/30 ${a.type === "critical" ? "border-destructive/20 bg-destructive/5 text-destructive-foreground" : "border-warning/20 bg-warning/5 text-foreground"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: `size-4.5 shrink-0 mt-0.5 ${a.type === "critical" ? "text-destructive" : "text-warning"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-bold text-[13px]",
									children: a.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[11.5px] text-muted-foreground mt-1 font-medium leading-relaxed",
									children: a.desc
								})] })]
							}, a.id))
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col items-center justify-center py-10 text-muted-foreground gap-3.5 bg-surface-2 dark:bg-zinc-800/40 rounded-2xl border border-border/80",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-10 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[13px] font-semibold text-center px-4",
								children: "All spaces and zones comply with current design criteria!"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-6",
						children: [recentCalcs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border/80 rounded-3xl bg-card p-6 flex flex-col gap-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 border-b border-border/50 pb-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-4.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-zinc-400",
									children: "Recently Opened"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-col gap-2",
								children: recentCalcs.map((calc) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalcLink, {
									name: calc,
									label: calc
								}, calc))
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border/80 rounded-3xl bg-card p-6 flex flex-col gap-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 border-b border-border/50 pb-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayoutDashboard, { className: "size-4.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-zinc-400",
									children: "Calculators Quick Access"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2 overflow-y-auto max-h-[360px] pr-1.5 custom-scrollbar",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalcLink, {
										name: "Cooling Load",
										label: "Cooling Load Sizer"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalcLink, {
										name: "Fresh Air Cooling Load",
										label: "Fresh Air Load"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalcLink, {
										name: "Heating Load",
										label: "Heating Load"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalcLink, {
										name: "Lobby Pressurization",
										label: "Lobby Smoke Control"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalcLink, {
										name: "Staircase Pressurization",
										label: "Staircase Overpressure"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/plumbing-sprinkler-kfactor",
										className: "flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sprinkler K-Factor" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5 text-muted-foreground group-hover:text-primary transition-colors" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/plumbing-sprinkler-density",
										className: "flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sprinkler Density & Flow" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5 text-muted-foreground group-hover:text-primary transition-colors" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/plumbing-hazen-williams",
										className: "flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Hazen-Williams" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5 text-muted-foreground group-hover:text-primary transition-colors" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/plumbing-fm200",
										className: "flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "FM-200 Calculation" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5 text-muted-foreground group-hover:text-primary transition-colors" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/plumbing-water-demand",
										className: "flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Water Demand Sizer" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5 text-muted-foreground group-hover:text-primary transition-colors" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/plumbing-fixture-unit",
										className: "flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Fixture Unit Sizer" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5 text-muted-foreground group-hover:text-primary transition-colors" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/plumbing-loading-unit",
										className: "flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Loading Unit Sizer" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5 text-muted-foreground group-hover:text-primary transition-colors" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/plumbing-supply-pipe-sizer",
										className: "flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Supply Pipe Sizer" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5 text-muted-foreground group-hover:text-primary transition-colors" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/plumbing-pump-sizing",
										className: "flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Pump Sizing (Transfer/Booster)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5 text-muted-foreground group-hover:text-primary transition-colors" })]
									})
								]
							})]
						})]
					})]
				})]
			})
		})
	});
}
function StatCard({ icon, label, value, desc, progress }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border border-border/80 rounded-3xl bg-card p-5 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)] min-h-[140px] transition-all hover:shadow-md hover:border-border/100",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex justify-between items-start",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground",
					children: label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "p-2 rounded-xl bg-surface-3 dark:bg-zinc-800/50 flex items-center justify-center shrink-0",
					children: icon
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[24px] font-bold tracking-tight font-mono text-foreground",
					children: value
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[11.5px] text-muted-foreground font-medium mt-0.5 block",
					children: desc
				})]
			}),
			progress !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "w-full h-2.5 bg-[#e2e8f0] dark:bg-zinc-700 rounded-full mt-2 overflow-hidden shadow-inner",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-full bg-primary rounded-full transition-all duration-500",
					style: { width: `${progress}%` }
				})
			})
		]
	});
}
function CalcLink({ name, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/calculators",
		search: { name },
		className: "flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5 text-muted-foreground group-hover:text-primary transition-colors" })]
	});
}
//#endregion
export { Route as n, DashboardPage as t };
