import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { d as workspaceStore } from "./workspace-store-Ct3ePlL1.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { D as RotateCcw, E as Save, I as Network, It as Briefcase, Kt as PenLine, L as Moon, Mt as Calendar, Ot as ChevronRight, Pt as Building, R as Monitor, T as Search, U as LogOut, W as Lock, Wt as TriangleAlert, Xt as Layers, Yt as LoaderCircle, a as Users, an as CircleCheck, at as FolderOpen, c as UserCheck, d as Trophy, en as CloudUpload, g as Sun, jt as Camera, k as RefreshCw, kt as ChevronDown, l as Upload, m as Trash2, n as X, nt as GitFork, o as User, s as UserPlus, st as Flame, tn as CloudDownload, tt as Globe, wt as Clock, x as ShieldAlert, y as Shield, yt as Crown } from "../_libs/lucide-react.mjs";
import { n as ConfirmProvider } from "./use-confirm-BT3fngjN.mjs";
import { n as toast$1, t as Toaster } from "../_libs/sonner.mjs";
import { i as useAuth, t as AuthProvider } from "./AuthContext-CY5Koh3s.mjs";
import { F as useRouter, N as Navigate, c as HeadContent, d as createRouter, f as Outlet, g as Link, h as createRootRouteWithContext, l as useRouterState, m as createFileRoute, p as lazyRouteComponent, s as Scripts } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as mkdir, o as writeTextFile, t as exists } from "../_libs/tauri-apps__plugin-fs.mjs";
import { _ as dirtyStore, g as WelcomeToTarvModal, h as PricingModal, t as AppShell } from "./AppShell-urg-0zDa.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as Route$65 } from "./calculators-kkhAxRzw.mjs";
import { r as Route$66 } from "./plumbing-fixture-unit-BURa7brs.mjs";
import { n as Route$67 } from "./dashboard-BMZG-Dii.mjs";
import { t as Route$68 } from "./routes-BuxhLTxn.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { t as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
import { t as require_client } from "../_libs/react-dom+scheduler.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-DLEVVvnU.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
var import_client = require_client();
var styles_default = "/assets/styles-Cp5Sb4N2.css";
function reportLovableError(error, context = {}) {
	if (typeof window === "undefined") return;
	window.__lovableEvents?.captureException?.(error, {
		source: "react_error_boundary",
		route: window.location.pathname,
		...context
	}, {
		mechanism: "react_error_boundary",
		handled: false,
		severity: "error"
	});
}
var Toaster$1 = ({ ...props }) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
		className: "toaster group",
		toastOptions: { classNames: {
			toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
			description: "group-[.toast]:text-muted-foreground",
			actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
			cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
		} },
		...props
	});
};
var gatherProjectData = () => {
	const data = {};
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key && (key.startsWith("mep-") || key.startsWith("feature_"))) try {
			data[key] = JSON.parse(localStorage.getItem(key) || "null");
		} catch {
			data[key] = localStorage.getItem(key);
		}
	}
	return JSON.stringify(data, null, 2);
};
function useAutoBackup() {
	(0, import_react.useEffect)(() => {
		if (!(typeof window !== "undefined" && "__TAURI_IPC__" in window)) return;
		const backupToPath = async (path, type) => {
			if (!path) return;
			try {
				if (!await exists(path).catch(() => false)) await mkdir(path, { recursive: true }).catch((e) => console.warn("mkdir warning:", e));
				const fullPath = `${path}\\${`MEP_Project_Backup_${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.json`}`;
				await writeTextFile(fullPath, gatherProjectData());
				console.log(`Successfully saved ${type} backup to ${fullPath}`);
			} catch (err) {
				console.error(`Failed to save ${type} backup:`, err);
			}
		};
		const localInterval = setInterval(() => {
			const localPath = localStorage.getItem("localBackupPath");
			if (localPath) backupToPath(localPath, "Local");
		}, 6e5);
		const serverInterval = setInterval(() => {
			const serverPath = localStorage.getItem("serverBackupPath");
			if (serverPath) backupToPath(serverPath, "Server");
		}, 36e5);
		return () => {
			clearInterval(localInterval);
			clearInterval(serverInterval);
		};
	}, []);
}
function AuthGuard({ children }) {
	const { session, profile, loading, isLoggedin, logout } = useAuth();
	const routerState = useRouterState();
	const [showPricing, setShowPricing] = (0, import_react.useState)(false);
	if (loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-screen w-screen items-center justify-center bg-slate-950",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sky-400 font-medium",
			children: "Loading session..."
		})
	});
	const isLoginPage = routerState.location.pathname === "/login";
	const isAdminPage = routerState.location.pathname.startsWith("/admin");
	if (!isLoggedin && !isLoginPage) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, {
		to: "/login",
		replace: true
	});
	if (session && profile && !isLoginPage) {
		if (profile.isAccountVerified === false) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, {
			to: "/login",
			replace: true
		});
	}
	if (session && profile && !isLoginPage) {
		if (profile.role !== "SUPER_ADMIN" && profile.role !== "ORG_ADMIN" && isAdminPage) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, {
			to: "/",
			replace: true
		});
	}
	if (session && profile && !isLoginPage) {
		if (profile.role !== "SUPER_ADMIN" && profile.subscription_expires) {
			const expiryDate = new Date(profile.subscription_expires);
			if (/* @__PURE__ */ new Date() > expiryDate) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-16 h-16 text-amber-500 mb-4" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-2xl font-bold",
						children: "Subscription Expired"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground mt-2 max-w-md",
						children: "Your access to the MEP Calculator has expired. Please renew your subscription or contact your administrator to continue."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-8 p-4 bg-slate-200 dark:bg-slate-800 rounded-lg",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm",
							children: ["Expired on: ", expiryDate.toLocaleDateString()]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setShowPricing(true),
							className: "w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all",
							children: "Renew Subscription"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: async () => {
								try {
									await logout();
									window.location.href = "/login";
								} catch (e) {
									console.error("Logout failed", e);
								}
							},
							className: "w-full sm:w-auto px-6 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-all",
							children: "Sign out"
						})]
					}),
					showPricing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PricingModal, {
						isOpen: showPricing,
						onClose: () => setShowPricing(false)
					})
				]
			});
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
function NotFoundComponent() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-7xl font-bold text-foreground",
					children: "404"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-4 text-xl font-semibold text-foreground",
					children: "Page not found"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "The page you're looking for doesn't exist or has been moved."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Go home"
					})
				})
			]
		})
	});
}
function ErrorComponent({ error, reset }) {
	console.error(error);
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		reportLovableError(error, { boundary: "tanstack_root_error_component" });
	}, [error]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold tracking-tight text-foreground",
					children: "This page didn't load"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Something went wrong on our end. You can try refreshing or head back home."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							router.invalidate();
							reset();
						},
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Try again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/",
						className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
						children: "Go home"
					})]
				})
			]
		})
	});
}
var Route$64 = createRootRouteWithContext()({
	head: () => {
		let titleText = "Airflow — Ventilation Calculation Platform";
		let descText = "Enterprise MEP ventilation calculation platform for spaces, zones, and equipment at scale.";
		return {
			meta: [
				{ charSet: "utf-8" },
				{
					name: "viewport",
					content: "width=device-width, initial-scale=1"
				},
				{ title: titleText },
				{
					name: "description",
					content: descText
				},
				{
					name: "author",
					content: "Airflow"
				},
				{
					property: "og:title",
					content: titleText
				},
				{
					property: "og:description",
					content: descText
				},
				{
					property: "og:type",
					content: "website"
				},
				{
					name: "twitter:card",
					content: "summary"
				},
				{
					name: "twitter:site",
					content: "@Lovable"
				}
			],
			links: [
				{
					rel: "stylesheet",
					href: styles_default
				},
				{
					rel: "preconnect",
					href: "https://fonts.googleapis.com"
				},
				{
					rel: "preconnect",
					href: "https://fonts.gstatic.com",
					crossOrigin: ""
				},
				{
					rel: "stylesheet",
					href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
				}
			]
		};
	},
	shellComponent: RootShell,
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
	errorComponent: ErrorComponent
});
function RootShell({ children }) {
	if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
	let initialDark = false;
	if (typeof window !== "undefined") try {
		const t = localStorage.getItem("mep_theme") || "dark";
		if (t === "dark") initialDark = true;
		else if (t === "light") initialDark = false;
		else initialDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	} catch (e) {}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: initialDark ? "dark" : "",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("head", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("script", { dangerouslySetInnerHTML: { __html: `(function(){try{var t=localStorage.getItem('mep_theme')||'dark';var d=false;if(t==='dark')d=true;else if(t==='light')d=false;else d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();` } }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	});
}
function ThemeWatcher() {
	(0, import_react.useEffect)(() => {
		const applyCurrentTheme = () => {
			if (typeof window === "undefined") return;
			const savedTheme = localStorage.getItem("mep_theme") || "dark";
			let isDark = false;
			if (savedTheme === "dark") isDark = true;
			else if (savedTheme === "light") isDark = false;
			else isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			if (isDark) document.documentElement.classList.add("dark");
			else document.documentElement.classList.remove("dark");
		};
		applyCurrentTheme();
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleSystemChange = () => {
			const savedTheme = localStorage.getItem("mep_theme") || "dark";
			if (savedTheme === "system" || savedTheme === "dark") applyCurrentTheme();
		};
		const handleThemeEvent = () => applyCurrentTheme();
		mediaQuery.addEventListener("change", handleSystemChange);
		window.addEventListener("mep-theme-change", handleThemeEvent);
		window.addEventListener("storage", handleThemeEvent);
		return () => {
			mediaQuery.removeEventListener("change", handleSystemChange);
			window.removeEventListener("mep-theme-change", handleThemeEvent);
			window.removeEventListener("storage", handleThemeEvent);
		};
	}, []);
	return null;
}
function DirtyWatcher() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		if (typeof window !== "undefined") window.alert = (message) => {
			toast$1(String(message), { duration: 4e3 });
		};
		const onInput = (e) => {
			if (window.__mep_is_restoring) return;
			const target = e.target;
			if (target && (target.closest("aside") || target.closest("header") || target.closest("[data-ignore-persist]"))) return;
			const path = window.location.pathname || "";
			if (path === "/projects" || path.endsWith("/projects")) return;
			dirtyStore.set(true);
		};
		document.addEventListener("input", onInput, true);
		document.addEventListener("change", onInput, true);
		const unsub = router.subscribe("onResolved", () => dirtyStore.set(false));
		const onBeforeUnload = (e) => {
			if (dirtyStore.isDirty) {
				e.preventDefault();
				e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
				return e.returnValue;
			}
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => {
			document.removeEventListener("input", onInput, true);
			document.removeEventListener("change", onInput, true);
			window.removeEventListener("beforeunload", onBeforeUnload);
			unsub();
		};
	}, [router]);
	return null;
}
function RootComponent() {
	const { queryClient } = Route$64.useRouteContext();
	useAutoBackup();
	(0, import_react.useEffect)(() => {
		workspaceStore.initCloud();
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ConfirmProvider, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeWatcher, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DirtyWatcher, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthGuard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {})
		] }) })
	});
}
var $$splitComponentImporter$61 = () => import("./zones-BOqBgRY8.mjs");
var Route$63 = createFileRoute("/zones")({
	head: () => ({ meta: [{ title: "Zones — Airflow" }, {
		name: "description",
		content: "Master-detail zone management with live pressure balance and equipment assignment."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$61, "component")
});
var $$splitComponentImporter$60 = () => import("./ventilation-DpK9JVp_.mjs");
var Route$62 = createFileRoute("/ventilation")({
	head: () => ({ meta: [{ title: "Ventilation — MEP Calculator" }, {
		name: "description",
		content: "Ventilation module: spaces, zones, equipment, and reports with live intelligence."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$60, "component")
});
var $$splitComponentImporter$59 = () => import("./ups-sizing-calculation-Cl6KZe6X.mjs");
var Route$61 = createFileRoute("/ups-sizing-calculation")({
	head: () => ({ meta: [{ title: "UPS Sizing Calculation — MEP Calc" }, {
		name: "description",
		content: "Simple UPS capacity sizing calculator based on connected socket load schedule and diversity."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$59, "component")
});
var $$splitComponentImporter$58 = () => import("./transformer-sizing-BqxpOaA6.mjs");
var Route$60 = createFileRoute("/transformer-sizing")({
	head: () => ({ meta: [{ title: "Transformer Sizing — MEP Calc" }, {
		name: "description",
		content: "Determine power transformer size based on connected loads, demand/diversity factors, and deratings."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$58, "component")
});
var $$splitComponentImporter$57 = () => import("./teams-DOr4jouU.mjs");
var Route$59 = createFileRoute("/teams")({
	head: () => ({ meta: [{ title: "Teams — MEP Calc" }] }),
	component: lazyRouteComponent($$splitComponentImporter$57, "component")
});
var $$splitComponentImporter$56 = () => import("./staircase-pressurization-DjfnPdWO.mjs");
var Route$58 = createFileRoute("/staircase-pressurization")({
	head: () => ({ meta: [{ title: "Staircase Pressurization — MEP Calc" }, {
		name: "description",
		content: "Staircase Pressurization calculator for sizing smoke containment air volume flowrates."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$56, "component")
});
var $$splitComponentImporter$55 = () => import("./smoke-extract-fan-DRrtTudC.mjs");
var Route$57 = createFileRoute("/smoke-extract-fan")({
	head: () => ({ meta: [{ title: "Smoke Extract Fan — MEP Calc" }, {
		name: "description",
		content: "Smoke Extract Fan calculator for corridor smoke extract sizing and static pressure."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$55, "component")
});
var $$splitComponentImporter$54 = () => import("./short-circuit-calculations-C93kTeHq.mjs");
var Route$56 = createFileRoute("/short-circuit-calculations")({
	head: () => ({ meta: [{ title: "Short Circuit Current Calculation — MEP Calc" }, {
		name: "description",
		content: "IEC 60909 prospective short circuit current analysis for electrical power networks."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$54, "component")
});
var Route$55 = createFileRoute("/settings")({
	head: () => ({ meta: [{ title: "Settings — MEP Calc" }, {
		name: "description",
		content: "Configure calculation standards, default safety factor multipliers, profile, units, themes, and autosave settings."
	}] }),
	component: SettingsPage
});
function SettingsPage() {
	const { userData, profile, logout, logoutAllDevices, deleteAccount, updateProfileDetails, setUserData } = useAuth();
	profile?.role === "SUPER_ADMIN" || profile?.role === "ORG_ADMIN" || userData?.role === "SUPER_ADMIN" || userData?.role;
	const fileInputRef = (0, import_react.useRef)(null);
	const [savedSuccess, setSavedSuccess] = (0, import_react.useState)(false);
	const [cloudSaveLoading, setCloudSaveLoading] = (0, import_react.useState)(false);
	const [cloudSaveMessage, setCloudSaveMessage] = (0, import_react.useState)(null);
	const [nameError, setNameError] = (0, import_react.useState)(null);
	const [showClearModal, setShowClearModal] = (0, import_react.useState)(false);
	const [showDeleteModal, setShowDeleteModal] = (0, import_react.useState)(false);
	const [showPioneerModal, setShowPioneerModal] = (0, import_react.useState)(false);
	const [deleteConfirmText, setDeleteConfirmText] = (0, import_react.useState)("");
	const [deletePassword, setDeletePassword] = (0, import_react.useState)("");
	const [isDeleting, setIsDeleting] = (0, import_react.useState)(false);
	const [deleteError, setDeleteError] = (0, import_react.useState)(null);
	const [theme, setTheme] = (0, import_react.useState)(() => {
		if (typeof window !== "undefined") return localStorage.getItem("mep_theme") || "dark";
		return "system";
	});
	const [unitSystem, setUnitSystem] = (0, import_react.useState)(() => {
		if (typeof window !== "undefined") return localStorage.getItem("mep_unit_system") || "SI";
		return "SI";
	});
	const uId = userData?.id || profile?.id;
	const [profilePhoto, setProfilePhoto] = (0, import_react.useState)(() => {
		return profile?.profile_photo || userData?.profile_photo || (uId && typeof window !== "undefined" ? localStorage.getItem(`mep_profile_photo_${uId}`) || "" : "");
	});
	const [fullName, setFullName] = (0, import_react.useState)(() => {
		return profile?.name || userData?.name || (uId && typeof window !== "undefined" ? localStorage.getItem(`mep_user_name_${uId}`) || "" : "");
	});
	const handleNameChange = (val) => {
		const strippedVal = val.replace(/[0-9]/g, "");
		setFullName(strippedVal);
		const nameRegex = /^[a-zA-Z\s'\-]+$/;
		if (!strippedVal.trim()) setNameError("Full Name is required.");
		else if (!nameRegex.test(strippedVal.trim())) setNameError("Full Name should only contain letters, spaces, hyphens, or apostrophes (no numbers).");
		else if (strippedVal.trim().length < 2) setNameError("Full Name must be at least 2 characters long.");
		else setNameError(null);
	};
	const isSuperAdminUser = userData?.email === "admin@tarv.ai" || profile?.email === "admin@tarv.ai" || profile?.role === "SUPER_ADMIN" || userData?.role === "SUPER_ADMIN";
	const [company, setCompany] = (0, import_react.useState)(() => {
		if (isSuperAdminUser) return "TARV AI System (Super Admin)";
		return profile?.company || userData?.company || (uId && typeof window !== "undefined" ? localStorage.getItem(`mep_user_company_${uId}`) || "" : "");
	});
	const [assignedOrgName, setAssignedOrgName] = (0, import_react.useState)(() => {
		if (isSuperAdminUser) return "TARV AI System (Super Admin)";
		return "";
	});
	(0, import_react.useEffect)(() => {
		async function resolveUserOrg() {
			const currentEmail = userData?.email || profile?.email;
			const currentId = profile?.id || userData?.id;
			if (currentEmail === "admin@tarv.ai" || profile?.role === "SUPER_ADMIN" || userData?.role === "SUPER_ADMIN") {
				setAssignedOrgName("TARV AI System (Super Admin)");
				setCompany("TARV AI System (Super Admin)");
				return;
			}
			try {
				const orgs = await api.getOrganizations();
				const allUsers = await api.getUsers();
				const myRecord = Array.isArray(allUsers) ? allUsers.find((u) => currentEmail && u.email?.toLowerCase() === currentEmail.toLowerCase() || currentId && u.id === currentId) : null;
				const userOrgId = myRecord?.organization_id || profile?.organization_id || userData?.organization_id;
				if (userOrgId && Array.isArray(orgs)) {
					const match = orgs.find((o) => o.id === userOrgId);
					if (match && match.name) {
						setAssignedOrgName(match.name);
						setCompany(match.name);
						return;
					}
				}
				const directOrg = myRecord?.organization || myRecord?.company || profile?.organization || profile?.company || userData?.organization || userData?.company;
				if (directOrg && directOrg.trim()) {
					setAssignedOrgName(directOrg.trim());
					setCompany(directOrg.trim());
					return;
				}
				if (typeof window !== "undefined" && currentId) {
					const cachedUserCompany = localStorage.getItem(`mep_user_company_${currentId}`);
					if (cachedUserCompany && cachedUserCompany.trim()) {
						setAssignedOrgName(cachedUserCompany.trim());
						setCompany(cachedUserCompany.trim());
						return;
					}
				}
			} catch (e) {}
		}
		resolveUserOrg();
	}, [
		userData?.email,
		profile?.email,
		profile?.organization_id,
		userData?.organization_id,
		profile?.id,
		userData?.id,
		profile?.company,
		userData?.company
	]);
	const [designation, setDesignation] = (0, import_react.useState)(() => {
		if (isSuperAdminUser) return "Super Admin";
		return profile?.role || profile?.designation || userData?.role || userData?.designation || (uId && typeof window !== "undefined" ? localStorage.getItem(`mep_user_designation_${uId}`) || "Design Engineer" : "Design Engineer");
	});
	(0, import_react.useEffect)(() => {
		async function resolveUserRole() {
			const currentEmail = userData?.email || profile?.email;
			if (currentEmail === "admin@tarv.ai" || profile?.role === "SUPER_ADMIN" || userData?.role === "SUPER_ADMIN") {
				setDesignation("Super Admin");
				return;
			}
			try {
				const allUsers = await api.getUsers();
				const myRecord = Array.isArray(allUsers) ? allUsers.find((u) => u.email?.toLowerCase() === currentEmail?.toLowerCase()) : null;
				if (myRecord?.role) setDesignation(myRecord.role);
			} catch (e) {}
		}
		resolveUserRole();
	}, [
		userData?.email,
		profile?.email,
		profile?.role,
		userData?.role
	]);
	const [autoSaveEnabled, setAutoSaveEnabled] = (0, import_react.useState)(() => {
		if (typeof window !== "undefined") return localStorage.getItem("mep_auto_save_enabled") !== "false";
		return true;
	});
	const [autoSavePath, setAutoSavePath] = (0, import_react.useState)(() => {
		if (typeof window !== "undefined") return localStorage.getItem("localBackupPath") || "C:\\MEP_Calculator_Autosaves";
		return "C:\\MEP_Calculator_Autosaves";
	});
	const [autoSaveInterval, setAutoSaveInterval] = (0, import_react.useState)(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("mep_auto_save_interval");
			return saved ? parseInt(saved, 10) : 10;
		}
		return 10;
	});
	const [standard, setStandard] = (0, import_react.useState)("ASHRAE 62.1 - 2022");
	const [flowUnit, setFlowUnit] = (0, import_react.useState)(() => unitSystem === "IP" ? "cfm" : "L/s");
	const [tempUnit, setTempUnit] = (0, import_react.useState)(() => unitSystem === "IP" ? "F" : "C");
	const [chwDeltaT, setChwDeltaT] = (0, import_react.useState)(5.5);
	const [safetyMargin, setSafetyMargin] = (0, import_react.useState)(10);
	const [isCheckingUpdate, setIsCheckingUpdate] = (0, import_react.useState)(false);
	const [updateStatus, setUpdateStatus] = (0, import_react.useState)(null);
	const [hasUpdate, setHasUpdate] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (profile || userData) {
			if (profile?.name || userData?.name) setFullName(profile?.name || userData?.name || "");
			if (profile?.company || userData?.company) setCompany(profile?.company || userData?.company || "");
			const activeRole = profile?.role || profile?.designation || userData?.role || userData?.designation;
			if (activeRole) setDesignation(activeRole);
			if (profile?.profile_photo || userData?.profile_photo) setProfilePhoto(profile?.profile_photo || userData?.profile_photo || "");
		}
	}, [profile, userData]);
	const handleThemeChange = (newTheme) => {
		setTheme(newTheme);
		if (typeof window !== "undefined") {
			localStorage.setItem("mep_theme", newTheme);
			window.dispatchEvent(new Event("mep-theme-change"));
		}
	};
	const handleUnitSystemChange = (system) => {
		setUnitSystem(system);
		if (typeof window !== "undefined") localStorage.setItem("mep_unit_system", system);
		if (system === "IP") {
			setFlowUnit("cfm");
			setTempUnit("F");
		} else {
			setFlowUnit("L/s");
			setTempUnit("C");
		}
	};
	const handleImageUpload = (event) => {
		const file = event.target.files?.[0];
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			alert("Please select a valid image file.");
			return;
		}
		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement("canvas");
				const MAX_SIZE = 250;
				let width = img.width;
				let height = img.height;
				if (width > height) {
					if (width > MAX_SIZE) {
						height *= MAX_SIZE / width;
						width = MAX_SIZE;
					}
				} else if (height > MAX_SIZE) {
					width *= MAX_SIZE / height;
					height = MAX_SIZE;
				}
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext("2d");
				if (ctx) {
					ctx.drawImage(img, 0, 0, width, height);
					const compressedDataUrl = canvas.toDataURL("image/jpeg", .85);
					setProfilePhoto(compressedDataUrl);
					if (typeof window !== "undefined") {
						if (uId) localStorage.setItem(`mep_profile_photo_${uId}`, compressedDataUrl);
						localStorage.removeItem("mep_profile_photo");
					}
					if (userData) setUserData({
						...userData,
						profile_photo: compressedDataUrl
					});
					updateProfileDetails({ profile_photo: compressedDataUrl });
				}
			};
			img.src = e.target?.result;
		};
		reader.readAsDataURL(file);
	};
	const handleRemovePhoto = () => {
		setProfilePhoto("");
		if (typeof window !== "undefined") {
			if (uId) localStorage.removeItem(`mep_profile_photo_${uId}`);
			localStorage.removeItem("mep_profile_photo");
		}
		if (userData) setUserData({
			...userData,
			profile_photo: ""
		});
		updateProfileDetails({ profile_photo: "" });
	};
	const handleBrowseFolder = async () => {
		try {
			if (typeof window !== "undefined") {
				const { open: openFileDialog } = await import("../_libs/tauri-apps__plugin-dialog.mjs").then((n) => n.t);
				const selected = await openFileDialog({
					directory: true,
					multiple: false,
					title: "Select Auto Save Backup Directory"
				});
				if (selected && typeof selected === "string") {
					setAutoSavePath(selected);
					localStorage.setItem("localBackupPath", selected);
				}
			}
		} catch (err) {
			console.warn("Folder selection prompt fallback", err);
		}
	};
	const handleSaveLocal = () => {
		if (!fullName || !fullName.trim()) {
			setNameError("Full Name is required.");
			toast.error("Full Name is required.", { style: {
				border: "1px solid #ef4444",
				color: "#ef4444"
			} });
			return false;
		}
		if (!/^[a-zA-Z\s'\-]+$/.test(fullName.trim())) {
			setNameError("Full Name should only contain letters, spaces, hyphens, or apostrophes (no numbers).");
			toast.error("Full Name should only contain letters, spaces, hyphens, or apostrophes (no numbers).", { style: {
				border: "1px solid #ef4444",
				color: "#ef4444"
			} });
			return false;
		}
		if (fullName.trim().length < 2) {
			setNameError("Full Name must be at least 2 characters long.");
			toast.error("Full Name must be at least 2 characters long.", { style: {
				border: "1px solid #ef4444",
				color: "#ef4444"
			} });
			return false;
		}
		setNameError(null);
		if (typeof window !== "undefined") {
			if (uId) {
				localStorage.setItem(`mep_profile_photo_${uId}`, profilePhoto);
				localStorage.setItem(`mep_user_name_${uId}`, fullName);
				localStorage.setItem(`mep_user_company_${uId}`, company);
				localStorage.setItem(`mep_user_designation_${uId}`, designation);
			}
			localStorage.setItem("mep_unit_system", unitSystem);
			localStorage.setItem("mep_auto_save_enabled", String(autoSaveEnabled));
			localStorage.setItem("localBackupPath", autoSavePath);
			localStorage.setItem("mep_auto_save_interval", String(autoSaveInterval));
			localStorage.setItem("mep_ventilation_standard", standard);
			localStorage.setItem("mep_flow_unit", flowUnit);
			localStorage.setItem("mep_temp_unit", tempUnit);
			localStorage.setItem("mep_chw_deltat", String(chwDeltaT));
			localStorage.setItem("mep_safety_margin", String(safetyMargin));
		}
		if (userData) setUserData({
			...userData,
			name: fullName,
			company,
			designation,
			profile_photo: profilePhoto
		});
		updateProfileDetails({
			name: fullName,
			company,
			designation,
			profile_photo: profilePhoto,
			settings: {
				theme,
				default_units: unitSystem,
				auto_save: autoSaveEnabled,
				autosave_path: autoSavePath,
				autosave_interval: autoSaveInterval,
				ventilation_standard: standard,
				flow_unit: flowUnit,
				temp_unit: tempUnit,
				chw_delta_t: chwDeltaT,
				safety_margin: safetyMargin
			}
		});
		setSavedSuccess(true);
		setTimeout(() => setSavedSuccess(false), 3e3);
		return true;
	};
	const handleSaveToCloud = async () => {
		try {
			setCloudSaveLoading(true);
			setCloudSaveMessage(null);
			if (!handleSaveLocal()) {
				setCloudSaveLoading(false);
				return;
			}
			const res = await updateProfileDetails({
				name: fullName,
				company,
				designation,
				profile_photo: profilePhoto,
				settings: {
					theme,
					default_units: unitSystem,
					auto_save: autoSaveEnabled,
					autosave_path: autoSavePath,
					autosave_interval: autoSaveInterval,
					ventilation_standard: standard,
					flow_unit: flowUnit,
					temp_unit: tempUnit,
					chw_delta_t: chwDeltaT,
					safety_margin: safetyMargin
				}
			});
			if (res.success) setCloudSaveMessage("Settings & Profile successfully synced to cloud!");
			else setCloudSaveMessage(res.message || "Failed to sync settings with cloud. Local settings were saved.");
		} catch (err) {
			setCloudSaveMessage(`Cloud sync error: ${err.message || "Network issue"}`);
		} finally {
			setCloudSaveLoading(false);
			setTimeout(() => setCloudSaveMessage(null), 4e3);
		}
	};
	const handleClearAllData = () => {
		if (typeof window !== "undefined") {
			const keysToRemove = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key && (key.startsWith("mep-") || key.startsWith("mep_") || key.startsWith("pcl_") || key.includes("project") || key.includes("calculator"))) keysToRemove.push(key);
			}
			keysToRemove.forEach((k) => localStorage.removeItem(k));
		}
		setShowClearModal(false);
		setCloudSaveMessage("All local workspace cache & draft calculations cleared!");
		setTimeout(() => setCloudSaveMessage(null), 3500);
	};
	const handleDeleteAccount = async () => {
		if (deleteConfirmText.toUpperCase() !== "DELETE") {
			setDeleteError("Please type DELETE to confirm account removal.");
			return;
		}
		try {
			setIsDeleting(true);
			setDeleteError(null);
			const res = await deleteAccount(deletePassword || void 0);
			if (res.success) window.location.href = "/login";
			else setDeleteError(res.message || "Failed to delete account.");
		} catch (err) {
			setDeleteError(err.message || "An error occurred during account deletion.");
		} finally {
			setIsDeleting(false);
		}
	};
	const handleLogoutThisDevice = async () => {
		await logout();
		window.location.href = "/login";
	};
	const handleLogoutAllDevices = async () => {
		await logoutAllDevices();
		window.location.href = "/login";
	};
	const getExpiryDisplay = () => {
		const rawExpiry = userData?.subscription_expires || profile?.subscription_expires;
		if (!rawExpiry) return {
			status: "Active Trial / License",
			formatted: "Lifetime / 30 Days Free Trial",
			badgeColor: "bg-success/15 text-success border-success/30"
		};
		const expDate = new Date(rawExpiry);
		if (!!isNaN(expDate.getTime())) return {
			status: "Active License",
			formatted: String(rawExpiry),
			badgeColor: "bg-primary/15 text-primary border-primary/30"
		};
		const now = /* @__PURE__ */ new Date();
		const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1e3 * 3600 * 24));
		if (daysLeft < 0) return {
			status: "Expired",
			formatted: `Expired on ${expDate.toLocaleDateString()}`,
			badgeColor: "bg-destructive/15 text-destructive border-destructive/30"
		};
		return {
			status: `${daysLeft} Days Remaining`,
			formatted: `Expires on ${expDate.toLocaleDateString("en-US", {
				year: "numeric",
				month: "short",
				day: "numeric"
			})}`,
			badgeColor: daysLeft < 7 ? "bg-warning/15 text-warning border-warning/30" : "bg-success/15 text-success border-success/30"
		};
	};
	const expiryInfo = getExpiryDisplay();
	const checkForUpdates = async () => {
		try {
			setIsCheckingUpdate(true);
			setUpdateStatus("Checking for updates...");
			const { check } = await import("../_libs/tauri-apps__plugin-updater.mjs").then((n) => n.t);
			const update = await check();
			if (update) {
				setHasUpdate(update);
				setUpdateStatus(`Version ${update.version} available! Release notes: ${update.body}`);
			} else setUpdateStatus("You are on the latest version.");
		} catch (e) {
			console.error("Update error:", e);
			setUpdateStatus(`Error checking for updates: ${e.message || String(e)}`);
		} finally {
			setIsCheckingUpdate(false);
		}
	};
	const installUpdate = async () => {
		if (!hasUpdate) return;
		try {
			setIsCheckingUpdate(true);
			setUpdateStatus("Downloading and installing update... Please do not close the app.");
			let downloaded = 0;
			let contentLength = 0;
			await hasUpdate.downloadAndInstall((event) => {
				switch (event.event) {
					case "Started":
						contentLength = event.data.contentLength;
						setUpdateStatus(`Downloading update: 0%`);
						break;
					case "Progress":
						downloaded += event.data.chunkLength;
						if (contentLength) setUpdateStatus(`Downloading update: ${Math.round(downloaded / contentLength * 100)}%`);
						break;
					case "Finished":
						setUpdateStatus("Update installed successfully. Restarting...");
						break;
				}
			});
			const { relaunch } = await import("../_libs/tauri-apps__plugin-process.mjs").then((n) => n.t);
			await relaunch();
		} catch (e) {
			setUpdateStatus(`Error installing update: ${e.message}`);
		} finally {
			setIsCheckingUpdate(false);
		}
	};
	const getInitials = (nameStr) => {
		if (!nameStr) return "MEP";
		const parts = nameStr.trim().split(" ");
		if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
		return parts[0].slice(0, 2).toUpperCase();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Settings",
		subtitle: "Profile, units, cloud backup, theme & workspace preferences",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-6 overflow-y-auto h-full bg-surface/30",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-3xl mx-auto flex flex-col gap-6",
					children: [
						cloudSaveMessage && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 text-primary rounded-md text-[13px] font-medium shadow-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4 shrink-0" }), cloudSaveMessage]
						}),
						savedSuccess && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 p-3 bg-success/10 border border-success/20 text-success rounded-md text-[13px] font-medium shadow-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4 shrink-0" }), "Settings updated successfully in current workspace."]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between border-b border-border pb-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-4.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-[14px] font-bold uppercase tracking-wider text-foreground",
											children: "User Profile & Identity"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [userData?.is_founding_pioneer && userData?.pioneer_number && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => setShowPioneerModal(true),
											className: "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-yellow-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/40 hover:from-amber-500/30 hover:to-orange-500/30 transition shadow-sm cursor-pointer",
											title: "View Founding Pioneer Badge",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trophy, { className: "size-3 text-amber-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["PIONEER #", userData.pioneer_number] })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-muted-foreground",
											children: ["ID: ", userData?.id?.slice(0, 8) || "LOCAL_USER"]
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col sm:flex-row items-center gap-5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative group shrink-0",
										children: [
											profilePhoto ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
												src: profilePhoto,
												alt: "Profile Avatar",
												className: "size-20 rounded-full object-cover border-2 border-primary shadow-xs"
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "size-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-[22px] font-bold text-primary shadow-xs",
												children: getInitials(fullName)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => fileInputRef.current?.click(),
												className: "absolute bottom-0 right-0 p-1.5 bg-primary text-white rounded-full shadow-md hover:bg-primary/90 transition-colors",
												title: "Upload / Edit Photo",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Camera, { className: "size-3.5" })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "file",
												ref: fileInputRef,
												onChange: handleImageUpload,
												accept: "image/*",
												className: "hidden"
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-2.5 flex-1 w-full",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
												onClick: () => fileInputRef.current?.click(),
												className: "px-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }), " Upload / Change Photo"]
											}), profilePhoto && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
												onClick: handleRemovePhoto,
												className: "px-3 text-destructive border-destructive/30 hover:bg-destructive/10",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" }), " Remove"]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] text-muted-foreground",
											children: "PNG, JPG, or GIF up to 5MB. Photo is stored locally and synced to your profile."
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "text-[12.5px] font-semibold text-foreground flex items-center gap-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-3.5 text-muted-foreground" }), " Full Name"]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "text",
													value: fullName,
													onChange: (e) => handleNameChange(e.target.value),
													placeholder: "e.g. Vikram Kadam",
													className: `bg-surface border focus:border-primary rounded-md px-3 py-1.5 text-[13px] outline-none ${nameError ? "border-red-500 focus:ring-red-500/20" : "border-border"}`
												}),
												nameError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-red-500 dark:text-red-400 text-xs font-semibold mt-1.5 flex items-center gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1 rounded-full bg-red-500 dark:bg-red-400" }), nameError]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[12.5px] font-semibold text-foreground flex items-center gap-1.5",
												children: "Email Address"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "email",
												value: userData?.email || profile?.email || "engineer@mepcalc.com",
												disabled: true,
												className: "bg-surface/50 border border-border/70 rounded-md px-3 py-1.5 text-[13px] text-muted-foreground outline-none cursor-not-allowed font-mono"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "text-[12.5px] font-semibold text-foreground flex items-center gap-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Building, { className: "size-3.5 text-muted-foreground" }), " Company / Organization"]
												}), (assignedOrgName || company || profile?.company || userData?.company || profile?.organization_id || userData?.organization_id) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-3" }), " Admin Managed"]
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												value: assignedOrgName || company || profile?.company || userData?.company || (profile?.organization_id || userData?.organization_id ? "Consitent" : ""),
												disabled: Boolean(assignedOrgName || company || profile?.company || userData?.company || profile?.organization_id || userData?.organization_id),
												onChange: (e) => setCompany(e.target.value),
												placeholder: "No Organization Assigned",
												className: `bg-surface border border-border rounded-md px-3 py-1.5 text-[13px] outline-none ${assignedOrgName || company || profile?.company || userData?.company || profile?.organization_id || userData?.organization_id ? "bg-surface/50 text-muted-foreground cursor-not-allowed font-semibold" : "focus:border-primary"}`
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-1.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center justify-between",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
														className: "text-[12.5px] font-semibold text-foreground flex items-center gap-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Briefcase, { className: "size-3.5 text-muted-foreground" }), " Designation / Role"]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-3" }), " Admin Managed"]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "text",
													value: designation === "SUPER_ADMIN" ? "Super Admin" : designation === "ORG_ADMIN" ? "Organization Admin" : designation,
													disabled: true,
													className: "bg-surface/50 border border-border/70 rounded-md px-3 py-1.5 text-[13px] text-muted-foreground outline-none cursor-not-allowed font-semibold"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "text-[11px] text-muted-foreground italic",
													children: "Your role is managed in the Admin Control Panel and cannot be self-edited."
												})
											]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex justify-end border-t border-border/60 pt-4 mt-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										primary: true,
										onClick: handleSaveToCloud,
										disabled: cloudSaveLoading,
										className: "px-4 py-1.5",
										children: [cloudSaveLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-3.5" }), " Save Profile"]
									})
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between border-b border-border pb-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { className: "size-4.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[14px] font-bold uppercase tracking-wider text-foreground",
										children: "Subscription & License Expiry"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full border ${expiryInfo.badgeColor}`,
									children: expiryInfo.status
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-1 sm:grid-cols-3 gap-4 bg-surface/50 p-4 rounded-md border border-border",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11px] text-muted-foreground uppercase tracking-wider",
											children: "Current Tier"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[14px] font-bold text-foreground",
											children: profile?.role === "SUPER_ADMIN" ? "ENTERPRISE (SUPER ADMIN)" : profile?.role === "ORG_ADMIN" ? "ENTERPRISE (ORG ADMIN)" : "ENTERPRISE PRO"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11px] text-muted-foreground uppercase tracking-wider",
											children: "License Expiry Date"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[13px] font-semibold text-foreground font-mono",
											children: expiryInfo.formatted
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11px] text-muted-foreground uppercase tracking-wider",
											children: "Verification Status"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[13px] font-medium text-success flex items-center gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-3.5" }), " Account Verified"]
										})]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 border-b border-border pb-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-4.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[14px] font-bold uppercase tracking-wider text-foreground",
										children: "Theme & Interface Appearance"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-[13px] font-semibold text-foreground",
										children: "Select Display Mode"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-3 gap-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => handleThemeChange("light"),
												className: `flex flex-col items-center justify-center gap-2 p-3.5 rounded-lg border transition-all cursor-pointer ${theme === "light" ? "border-primary bg-primary/10 text-primary font-bold shadow-xs" : "border-border bg-surface text-muted-foreground hover:bg-surface-2"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[12.5px]",
													children: "Light Mode"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => handleThemeChange("dark"),
												className: `flex flex-col items-center justify-center gap-2 p-3.5 rounded-lg border transition-all cursor-pointer ${theme === "dark" ? "border-primary bg-primary/10 text-primary font-bold shadow-xs" : "border-border bg-surface text-muted-foreground hover:bg-surface-2"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "size-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[12.5px]",
													children: "Dark Mode"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => handleThemeChange("system"),
												className: `flex flex-col items-center justify-center gap-2 p-3.5 rounded-lg border transition-all cursor-pointer ${theme === "system" ? "border-primary bg-primary/10 text-primary font-bold shadow-xs" : "border-border bg-surface text-muted-foreground hover:bg-surface-2"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Monitor, { className: "size-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[12.5px]",
													children: "System Default"
												})]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex justify-end border-t border-border/60 pt-4 mt-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										primary: true,
										onClick: handleSaveToCloud,
										disabled: cloudSaveLoading,
										className: "px-4 py-1.5",
										children: [cloudSaveLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-3.5" }), " Save Appearance"]
									})
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 border-b border-border pb-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "size-4.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[14px] font-bold uppercase tracking-wider text-foreground",
										children: "Default Unit System & Calculations"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-[13px] font-semibold text-foreground",
										children: "Global Primary Unit System"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => handleUnitSystemChange("SI"),
											className: `flex items-center justify-center gap-2.5 p-3 rounded-lg border transition-all cursor-pointer ${unitSystem === "SI" ? "border-primary bg-primary/10 text-primary font-bold shadow-xs" : "border-border bg-surface text-muted-foreground hover:bg-surface-2"}`,
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[13px]",
												children: "Metric System (SI) — L/s, m³, °C, kW"
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => handleUnitSystemChange("IP"),
											className: `flex items-center justify-center gap-2.5 p-3 rounded-lg border transition-all cursor-pointer ${unitSystem === "IP" ? "border-primary bg-primary/10 text-primary font-bold shadow-xs" : "border-border bg-surface text-muted-foreground hover:bg-surface-2"}`,
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[13px]",
												children: "Imperial System (IP) — CFM, ft³, °F, HP"
											})
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1.5 pt-2 border-t border-border/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-[13px] font-semibold text-foreground",
										children: "Default Ventilation Standard"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: standard,
										onChange: (e) => setStandard(e.target.value),
										className: "bg-surface border border-border focus:border-primary rounded-md px-3 py-2 text-[13px] outline-none",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "ASHRAE 62.1 - 2022",
												children: "ASHRAE 62.1 - 2022 (Ventilation for Acceptable IAQ)"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "ASHRAE 62.1 - 2019",
												children: "ASHRAE 62.1 - 2019"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "BS EN 16798-1",
												children: "BS EN 16798-1:2019 (Indoor environmental input parameters)"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "CIBSE Guide A",
												children: "CIBSE Guide A (Environmental design standards)"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "text-[13px] font-semibold text-foreground",
											children: "Airflow Unit Preference"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: flowUnit,
											onChange: (e) => setFlowUnit(e.target.value),
											className: "bg-surface border border-border focus:border-primary rounded-md px-3 py-2 text-[13px] outline-none",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "L/s",
													children: "Litres per second (L/s)"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "m3h",
													children: "Cubic meters per hour (m³/hr)"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "cfm",
													children: "Cubic feet per minute (CFM)"
												})
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "text-[13px] font-semibold text-foreground",
											children: "Temperature Unit Preference"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: tempUnit,
											onChange: (e) => setTempUnit(e.target.value),
											className: "bg-surface border border-border focus:border-primary rounded-md px-3 py-2 text-[13px] outline-none",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "C",
												children: "Celsius (°C)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "F",
												children: "Fahrenheit (°F)"
											})]
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "text-[13px] font-semibold text-foreground",
											children: "CHW Delta T (K)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "0.1",
											min: "3.0",
											max: "12.0",
											value: chwDeltaT,
											onChange: (e) => setChwDeltaT(Number(e.target.value)),
											className: "bg-surface border border-border focus:border-primary rounded-md px-3 py-1.5 text-[13px] outline-none font-mono"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "text-[13px] font-semibold text-foreground",
											children: "Design Safety Margin (%)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											min: "0",
											max: "50",
											value: safetyMargin,
											onChange: (e) => setSafetyMargin(Number(e.target.value)),
											className: "bg-surface border border-border focus:border-primary rounded-md px-3 py-1.5 text-[13px] outline-none font-mono"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex justify-end border-t border-border/60 pt-4 mt-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										primary: true,
										onClick: handleSaveToCloud,
										disabled: cloudSaveLoading,
										className: "px-4 py-1.5",
										children: [cloudSaveLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-3.5" }), " Save Calculations & Units"]
									})
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between border-b border-border pb-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-4.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-[14px] font-bold uppercase tracking-wider text-foreground",
											children: "Auto Save & Workspace Backups"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "flex items-center gap-2 cursor-pointer",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[12.5px] font-medium text-foreground",
											children: autoSaveEnabled ? "Auto Save Active" : "Auto Save Disabled"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: autoSaveEnabled,
											onChange: (e) => setAutoSaveEnabled(e.target.checked),
											className: "size-4 accent-primary rounded cursor-pointer"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-1 sm:grid-cols-3 gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "sm:col-span-2 flex flex-col gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "text-[12.5px] font-semibold text-foreground flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "size-3.5 text-muted-foreground" }), " Auto Save Target Folder Path"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												value: autoSavePath,
												onChange: (e) => setAutoSavePath(e.target.value),
												placeholder: "e.g. C:\\MEP_Backups",
												disabled: !autoSaveEnabled,
												className: "flex-1 bg-surface border border-border focus:border-primary rounded-md px-3 py-1.5 text-[13px] outline-none font-mono disabled:opacity-50"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
												type: "button",
												onClick: handleBrowseFolder,
												disabled: !autoSaveEnabled,
												className: "px-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "size-3.5" }), " Browse..."]
											})]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "text-[12.5px] font-semibold text-foreground flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-3.5 text-muted-foreground" }), " Auto Save Interval"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: autoSaveInterval,
											onChange: (e) => setAutoSaveInterval(Number(e.target.value)),
											disabled: !autoSaveEnabled,
											className: "bg-surface border border-border focus:border-primary rounded-md px-3 py-1.5 text-[13px] outline-none disabled:opacity-50",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 1,
													children: "Every 1 Minute"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 5,
													children: "Every 5 Minutes"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 10,
													children: "Every 10 Minutes (Default)"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 15,
													children: "Every 15 Minutes"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 30,
													children: "Every 30 Minutes"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 60,
													children: "Every 60 Minutes"
												})
											]
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex justify-end border-t border-border/60 pt-4 mt-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										primary: true,
										onClick: handleSaveToCloud,
										disabled: cloudSaveLoading,
										className: "px-4 py-1.5",
										children: [cloudSaveLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-3.5" }), " Save Backup Settings"]
									})
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 border-b border-border pb-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudUpload, { className: "size-4.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[14px] font-bold uppercase tracking-wider text-foreground",
										children: "Cloud Sync & Cache Management"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center justify-between gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1 max-w-md",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[13px] font-semibold text-foreground",
											children: "Save & Sync to Cloud"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] text-muted-foreground",
											children: "Pushes your profile details, unit choices, and workspace settings to your online account."
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										primary: true,
										onClick: handleSaveToCloud,
										disabled: cloudSaveLoading,
										className: "px-4 py-1.5 bg-primary hover:bg-primary/90 text-white font-medium",
										children: [cloudSaveLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudUpload, { className: "size-4" }), cloudSaveLoading ? "Syncing..." : "Save to Cloud"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border/60",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1 max-w-md",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[13px] font-semibold text-foreground",
											children: "Clear All Local Data & Drafts"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] text-muted-foreground",
											children: "Erases local calculation drafts, temporary caches, and local workspace state."
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
										onClick: () => setShowClearModal(true),
										className: "px-4 text-warning border-warning/40 hover:bg-warning/10",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), " Clear All Data"]
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 border-b border-border pb-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudDownload, { className: "size-4.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-[14px] font-bold uppercase tracking-wider text-foreground",
									children: "Application Updates"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[12.5px] text-muted-foreground",
										children: "Check for new versions of the MEP Calculator to get the latest features and calculation updates."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
											primary: !hasUpdate,
											onClick: checkForUpdates,
											disabled: isCheckingUpdate,
											className: "px-4",
											children: [isCheckingUpdate && !hasUpdate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudDownload, { className: "size-3.5" }), isCheckingUpdate && !hasUpdate ? "Checking..." : "Check for Updates"]
										}), hasUpdate && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
											primary: true,
											onClick: installUpdate,
											disabled: isCheckingUpdate,
											className: "px-4 bg-success hover:bg-success/90",
											children: [isCheckingUpdate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-3.5" }), isCheckingUpdate ? "Installing..." : "Install & Restart"]
										})]
									}),
									updateStatus && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[12.5px] font-medium p-3 bg-surface/50 rounded border border-border",
										children: updateStatus
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-destructive/30 bg-destructive/5 rounded-lg p-6 shadow-xs flex flex-col gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 border-b border-destructive/20 pb-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "size-4.5 text-destructive" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-[14px] font-bold uppercase tracking-wider text-destructive",
									children: "Account Sessions & Security"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-2 p-4 bg-background rounded-md border border-border",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[13px] font-bold text-foreground",
											children: "Log Out Sessions"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] text-muted-foreground",
											children: "Sign out from this device or revoke all active device sessions."
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap gap-2 mt-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
												onClick: handleLogoutThisDevice,
												className: "px-3 border-border hover:bg-surface",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "size-3.5" }), " Logout (This Device)"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
												onClick: handleLogoutAllDevices,
												className: "px-3 border-warning/40 text-warning hover:bg-warning/10",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "size-3.5" }), " Logout (All Devices)"]
											})]
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-2 p-4 bg-background rounded-md border border-destructive/30",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[13px] font-bold text-destructive",
											children: "Delete Account"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] text-muted-foreground",
											children: "Permanently delete your profile and cloud workspace data."
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
												onClick: () => {
													setShowDeleteModal(true);
													setDeleteError(null);
												},
												className: "px-3 bg-destructive text-white border-destructive hover:bg-destructive/90",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), " Delete Account"]
											})
										})
									]
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-3 justify-end border-t border-border pt-4 mt-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
								onClick: handleSaveLocal,
								className: "px-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-3.5" }), " Save Locally"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
								primary: true,
								onClick: handleSaveToCloud,
								disabled: cloudSaveLoading,
								className: "px-5 py-1.5",
								children: [cloudSaveLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-3.5" }), " Save Settings"]
							})]
						})
					]
				}),
				showClearModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-background border border-border rounded-lg max-w-md w-full p-6 shadow-xl flex flex-col gap-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 text-warning",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-[15px] font-bold",
									children: "Clear All Local Data?"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground leading-normal",
								children: "This action will purge all local calculation drafts, temporary space configurations, and cached workspace states stored in your browser. This action cannot be undone."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-end gap-3 pt-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TBtn, {
									onClick: () => setShowClearModal(false),
									className: "px-4",
									children: "Cancel"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TBtn, {
									onClick: handleClearAllData,
									className: "px-4 bg-warning text-black border-warning font-semibold",
									children: "Yes, Clear All Data"
								})]
							})
						]
					})
				}),
				showDeleteModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-background border border-destructive/50 rounded-lg max-w-md w-full p-6 shadow-2xl flex flex-col gap-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 text-destructive",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "size-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-[16px] font-bold",
									children: "Permanently Delete Account?"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground leading-normal",
								children: "Are you sure you want to permanently delete your account? All projects, custom calculations, and settings will be permanently removed from the server."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "text-[12px] font-semibold text-foreground",
									children: [
										"Type ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-destructive",
											children: "DELETE"
										}),
										" to confirm:"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: deleteConfirmText,
									onChange: (e) => setDeleteConfirmText(e.target.value),
									placeholder: "DELETE",
									className: "bg-surface border border-border focus:border-destructive rounded px-3 py-1.5 text-[13px] font-mono outline-none"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "text-[12px] font-semibold text-foreground",
									children: "Account Password (Optional verification):"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "password",
									value: deletePassword,
									onChange: (e) => setDeletePassword(e.target.value),
									placeholder: "Enter password",
									className: "bg-surface border border-border focus:border-destructive rounded px-3 py-1.5 text-[13px] outline-none"
								})]
							}),
							deleteError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[12px] text-destructive bg-destructive/10 p-2.5 rounded border border-destructive/20",
								children: deleteError
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-end gap-3 pt-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TBtn, {
									onClick: () => setShowDeleteModal(false),
									disabled: isDeleting,
									className: "px-4",
									children: "Cancel"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
									onClick: handleDeleteAccount,
									disabled: isDeleting || deleteConfirmText.toUpperCase() !== "DELETE",
									className: "px-4 bg-destructive text-white border-destructive font-semibold disabled:opacity-50",
									children: [isDeleting ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), isDeleting ? "Deleting..." : "Permanently Delete Account"]
								})]
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WelcomeToTarvModal, {
					isOpen: showPioneerModal,
					onClose: () => setShowPioneerModal(false),
					userName: userData?.name || profile?.name || "Engineer",
					pioneerNumber: userData?.pioneer_number || 1
				})
			]
		})
	});
}
var $$splitComponentImporter$53 = () => import("./sanity-check-tool-DF5LqtUq.mjs");
var Route$54 = createFileRoute("/sanity-check-tool")({
	head: () => ({ meta: [{ title: "Sanity Check Tool — MEP Calc" }, {
		name: "description",
		content: "Interactive engineering sanity checker for duct, pipe, and energy values."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$53, "component")
});
var $$splitComponentImporter$52 = () => import("./reset-password-CdceW-fO.mjs");
var Route$53 = createFileRoute("/reset-password")({ component: lazyRouteComponent($$splitComponentImporter$52, "component") });
var $$splitComponentImporter$51 = () => import("./reports-DylMGg9_.mjs");
var Route$52 = createFileRoute("/reports")({
	head: () => ({ meta: [{ title: "Reports — Airflow" }, {
		name: "description",
		content: "Generate compliance reports and engineering documentation."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$51, "component")
});
var $$splitComponentImporter$50 = () => import("./refrigerant-pipe-sizing-B4OylNi7.mjs");
var Route$51 = createFileRoute("/refrigerant-pipe-sizing")({
	head: () => ({ meta: [{ title: "Refrigerant Pipe Sizing — MEP Calc" }, {
		name: "description",
		content: "Refrigerant pipe OD sizing tool for suction, liquid, and discharge lines."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$50, "component")
});
var $$splitComponentImporter$49 = () => import("./psychrometric-ezJ1smto.mjs");
var Route$50 = createFileRoute("/psychrometric")({
	head: () => ({ meta: [{ title: "Psychrometric — MEP Calc" }, {
		name: "description",
		content: "Moist air psychrometric properties calculator utilizing standard Hyland-Wexler equations."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$49, "component")
});
var $$splitComponentImporter$48 = () => import("./projects-Bv586KYe.mjs");
var Route$49 = createFileRoute("/projects")({
	head: () => ({ meta: [{ title: "Projects — MEP Calc" }, {
		name: "description",
		content: "Manage project workspaces and calculations schedules."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$48, "component")
});
var $$splitComponentImporter$47 = () => import("./project-load-schedule-MTgIl6-F.mjs");
var Route$48 = createFileRoute("/project-load-schedule")({
	head: () => ({ meta: [{ title: "Project Load Schedule — MEP Calc" }, {
		name: "description",
		content: "Hierarchical MEP Load Distribution Manager."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$47, "component")
});
var $$splitComponentImporter$46 = () => import("./privacy-Cfu0lmuz.mjs");
var Route$47 = createFileRoute("/privacy")({ component: lazyRouteComponent($$splitComponentImporter$46, "component") });
var $$splitComponentImporter$45 = () => import("./preliminary-cooling-load-DGNLT7Rx.mjs");
var Route$46 = createFileRoute("/preliminary-cooling-load")({
	head: () => ({ meta: [{ title: "Preliminary Cooling Load — MEP Calc" }, {
		name: "description",
		content: "Preliminary room-by-room cooling load and heat density estimation."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$45, "component")
});
var $$splitComponentImporter$44 = () => import("./plumbing-water-demand-BKSHlkmV.mjs");
var Route$45 = createFileRoute("/plumbing-water-demand")({
	head: () => ({ meta: [{ title: "Water Demand Calculator — MEP Calc" }, {
		name: "description",
		content: "Water demand sizing tool for domestic, irrigation, swimming pool, and firefighting systems."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$44, "component")
});
var $$splitComponentImporter$43 = () => import("./plumbing-tank-sizing-C5J6Pd2H.mjs");
var Route$44 = createFileRoute("/plumbing-tank-sizing")({
	head: () => ({ meta: [{ title: "Tank Sizing — MEP Calc" }] }),
	component: lazyRouteComponent($$splitComponentImporter$43, "component")
});
var $$splitComponentImporter$42 = () => import("./plumbing-supply-pipe-sizer-BbWNPuJE.mjs");
var Route$43 = createFileRoute("/plumbing-supply-pipe-sizer")({
	head: () => ({ meta: [{ title: "Supply Pipe Sizer — MEP Calc" }, {
		name: "description",
		content: "Water supply pipe sizer using ASPE/IPC velocity and friction loss constraints."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$42, "component")
});
var $$splitComponentImporter$41 = () => import("./plumbing-sump-pump-BwE_D-h4.mjs");
var Route$42 = createFileRoute("/plumbing-sump-pump")({
	head: () => ({ meta: [{ title: "Sump Pump — MEP Calc" }] }),
	component: lazyRouteComponent($$splitComponentImporter$41, "component")
});
var $$splitComponentImporter$40 = () => import("./plumbing-storm-water-Od02izMx.mjs");
import_FileSaver_min.default.saveAs;
var Route$41 = createFileRoute("/plumbing-storm-water")({
	head: () => ({ meta: [{ title: "Storm Water Sizing — MEP Calc" }, {
		name: "description",
		content: "Calculate storm water runoff flow rate using the Rational Method."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$40, "component")
});
var $$splitComponentImporter$39 = () => import("./plumbing-sprinkler-kfactor-C3JgKsNM.mjs");
var Route$40 = createFileRoute("/plumbing-sprinkler-kfactor")({
	head: () => ({ meta: [{ title: "Sprinkler K-Factor — MEP Calc" }, {
		name: "description",
		content: "NFPA 13 Sprinkler K-Factor calculations, flow rates, operating pressures, and design schedules."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$39, "component")
});
var $$splitComponentImporter$38 = () => import("./plumbing-sprinkler-density-DZhmLGnL.mjs");
var Route$39 = createFileRoute("/plumbing-sprinkler-density")({
	head: () => ({ meta: [{ title: "Sprinkler Density & Flow — MEP Calc" }, {
		name: "description",
		content: "Calculate sprinkler flow rates from design density, design area, and sprinkler K-factor per NFPA 13."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$38, "component")
});
var $$splitComponentImporter$37 = () => import("./plumbing-sewage-pump-tZ-m-Zwh.mjs");
var Route$38 = createFileRoute("/plumbing-sewage-pump")({
	head: () => ({ meta: [{ title: "Sewage Pump — MEP Calc" }] }),
	component: lazyRouteComponent($$splitComponentImporter$37, "component")
});
var $$splitComponentImporter$36 = () => import("./plumbing-pump-sizing-B4BMpPJ4.mjs");
var Route$37 = createFileRoute("/plumbing-pump-sizing")({
	head: () => ({ meta: [{ title: "Pump Sizing (Transfer/Booster) — MEP Calc" }, {
		name: "description",
		content: "Determine domestic water booster or transfer pump capacity, dynamic head, and motor sizing."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$36, "component")
});
var $$splitComponentImporter$35 = () => import("./plumbing-pressure-vessel-R0DuCEjc.mjs");
var Route$36 = createFileRoute("/plumbing-pressure-vessel")({
	head: () => ({ meta: [{ title: "Pressure Vessel Sizing — MEP Calc" }, {
		name: "description",
		content: "Calculate the required volume of water supply expansion or bladder pressure vessels."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$35, "component")
});
var $$splitComponentImporter$34 = () => import("./plumbing-loading-unit-DplpTB3g.mjs");
var Route$35 = createFileRoute("/plumbing-loading-unit")({
	head: () => ({ meta: [{ title: "Loading Unit Calculator — MEP Calc" }, {
		name: "description",
		content: "Traditional loading unit calculator for plumbing system pipe sizing."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$34, "component")
});
var $$splitComponentImporter$33 = () => import("./plumbing-hazen-williams-C1DfAvcK.mjs");
var Route$34 = createFileRoute("/plumbing-hazen-williams")({
	head: () => ({ meta: [{ title: "Hazen-Williams Pressure Drop — MEP Calc" }, {
		name: "description",
		content: "Calculate fire sprinkler piping friction loss, velocity, and pressure drop using the Hazen-Williams equation."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$33, "component")
});
var $$splitComponentImporter$32 = () => import("./plumbing-gas-tank-B2B0s3C3.mjs");
var Route$33 = createFileRoute("/plumbing-gas-tank")({
	head: () => ({ meta: [{ title: "Gas Tank — MEP Calc" }] }),
	component: lazyRouteComponent($$splitComponentImporter$32, "component")
});
var $$splitComponentImporter$31 = () => import("./plumbing-fm200-BPc7d14n.mjs");
var Route$32 = createFileRoute("/plumbing-fm200")({
	head: () => ({ meta: [{ title: "FM-200 Clean Agent Sizer — MEP Calc" }, {
		name: "description",
		content: "Calculate FM-200 (HFC-227ea) required agent weight for total flooding clean agent suppression per NFPA 2001."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$31, "component")
});
var $$splitComponentImporter$30 = () => import("./plumbing-fire-water-demand-DovcyiVS.mjs");
var Route$31 = createFileRoute("/plumbing-fire-water-demand")({
	head: () => ({ meta: [{ title: "Fire Water Demand Calculator — MEP Calc" }, {
		name: "description",
		content: "Determine total fire water demand based on sprinklers, hydrants, and hose reels."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$30, "component")
});
var $$splitComponentImporter$29 = () => import("./plumbing-fire-tank-duration-BiPAQeVO.mjs");
var Route$30 = createFileRoute("/plumbing-fire-tank-duration")({
	head: () => ({ meta: [{ title: "Fire Tank Duration — MEP Calc" }] }),
	component: lazyRouteComponent($$splitComponentImporter$29, "component")
});
var $$splitComponentImporter$28 = () => import("./plumbing-fire-tank-capacity-NAdFdCWw.mjs");
var Route$29 = createFileRoute("/plumbing-fire-tank-capacity")({
	head: () => ({ meta: [{ title: "Fire Tank Capacity Calculator — MEP Calc" }, {
		name: "description",
		content: "Calculate fire water storage tank capacity based on NFPA 22 guidelines."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$28, "component")
});
var $$splitComponentImporter$27 = () => import("./plumbing-fire-pump-duty-D17C80UT.mjs");
var Route$28 = createFileRoute("/plumbing-fire-pump-duty")({
	head: () => ({ meta: [{ title: "Fire Pump Duty Calculator — MEP Calc" }, {
		name: "description",
		content: "Calculate fire pump rated flow, head, churn pressure, and motor sizing."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$27, "component")
});
var $$splitComponentImporter$26 = () => import("./plumbing-drainage-CD1rpZRj.mjs");
var Route$27 = createFileRoute("/plumbing-drainage")({
	head: () => ({ meta: [{ title: "Drainage — MEP Calc" }] }),
	component: lazyRouteComponent($$splitComponentImporter$26, "component")
});
var $$splitComponentImporter$25 = () => import("./lpd-calculation-CAVkiFzl.mjs");
var Route$26 = createFileRoute("/lpd-calculation")({
	head: () => ({ meta: [{ title: "LPD Calculation — MEP Calc" }, {
		name: "description",
		content: "Lighting Power Density (LPD) Calculations."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$25, "component")
});
var $$splitComponentImporter$24 = () => import("./login-lc1PHXcQ.mjs");
var Route$25 = createFileRoute("/login")({ component: lazyRouteComponent($$splitComponentImporter$24, "component") });
var $$splitComponentImporter$23 = () => import("./lobby-pressurisation-Ceha13ob.mjs");
var Route$24 = createFileRoute("/lobby-pressurisation")({
	head: () => ({ meta: [{ title: "Lobby Pressurisation — MEP Calc" }, {
		name: "description",
		content: "Lobby Pressurisation calculator for sizing supply airflow rates and static pressures."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$23, "component")
});
var $$splitComponentImporter$22 = () => import("./load-summary-DInj7vNb.mjs");
var Route$23 = createFileRoute("/load-summary")({
	head: () => ({ meta: [{ title: "Load Summary — MEP Calc" }, {
		name: "description",
		content: "Calculate electrical load summary"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$22, "component")
});
var $$splitComponentImporter$21 = () => import("./lighting-lux-calculation-DrIDS-tg.mjs");
var Route$22 = createFileRoute("/lighting-lux-calculation")({
	head: () => ({ meta: [{ title: "Lighting LUX Calculation — MEP Calc" }, {
		name: "description",
		content: "Calculate Lighting LUX requirements"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$21, "component")
});
var $$splitComponentImporter$20 = () => import("./heating-load-Di0k6EkN.mjs");
var Route$21 = createFileRoute("/heating-load")({
	head: () => ({ meta: [{ title: "Heating Load — MEP Calc" }, {
		name: "description",
		content: "Winter envelope heat loss and heating load sizer."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$20, "component")
});
var $$splitComponentImporter$19 = () => import("./generator-sizing-D9nZ_4ka.mjs");
import_FileSaver_min.default.saveAs;
var Route$20 = createFileRoute("/generator-sizing")({
	head: () => ({ meta: [{ title: "Generator Sizing — MEP Calc" }, {
		name: "description",
		content: "Calculate DG set size based on connected and emergency loads."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$19, "component")
});
var $$splitComponentImporter$18 = () => import("./fresh-air-cooling-load-Bl9Qo_0W.mjs");
var Route$19 = createFileRoute("/fresh-air-cooling-load")({
	head: () => ({ meta: [{ title: "Fresh Air Cooling Load — MEP Calc" }, {
		name: "description",
		content: "Fresh Air Cooling Load calculator for sensible, latent, and total loads."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$18, "component")
});
var $$splitComponentImporter$17 = () => import("./equipment-tk-FYw7L.mjs");
var Route$18 = createFileRoute("/equipment")({
	head: () => ({ meta: [{ title: "Equipment — Airflow" }, {
		name: "description",
		content: "Manage HVAC equipment assignments, capacity utilization, and zone coverage."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$17, "component")
});
var $$splitComponentImporter$16 = () => import("./duct-sizer-BjWw62Zr.mjs");
var Route$17 = createFileRoute("/duct-sizer")({
	head: () => ({ meta: [{ title: "Duct Sizer — MEP Calc" }, {
		name: "description",
		content: "Interactive HVAC duct sizer implementing Equal Friction Method."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$16, "component")
});
var $$splitComponentImporter$15 = () => import("./diffuser-selector-BHMqD5s0.mjs");
var Route$16 = createFileRoute("/diffuser-selector")({
	head: () => ({ meta: [{ title: "Diffuser Selector — MEP Calc" }, {
		name: "description",
		content: "HVAC Diffuser Selector matching neck sizes and throw ranges."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$15, "component")
});
var $$splitComponentImporter$14 = () => import("./conductor-sizing-C3pYl2RZ.mjs");
var Route$15 = createFileRoute("/conductor-sizing")({
	head: () => ({ meta: [{ title: "Conductor Sizing — MEP Calc" }, {
		name: "description",
		content: "Electrical conductor (cable) sizing calculations"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$14, "component")
});
var $$splitComponentImporter$13 = () => import("./condensate-drain-calc-CTXwG8dZ.mjs");
var Route$14 = createFileRoute("/condensate-drain-calc")({
	head: () => ({ meta: [{ title: "Coil Condensate Calculator — MEP Calc" }, {
		name: "description",
		content: "AC cooling coil condensation schedule sizer and total moisture calculator."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$13, "component")
});
var $$splitComponentImporter$12 = () => import("./condensate-drain-ChfusoOq.mjs");
var Route$13 = createFileRoute("/condensate-drain")({
	head: () => ({ meta: [{ title: "Condensate Drain Sizing — MEP Calc" }, {
		name: "description",
		content: "Condensate Drain pipe sizing, slope, and drop calculator."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$12, "component")
});
var Route$12 = createFileRoute("/company-hierarchy")({
	head: () => ({ meta: [{ title: "Company Hierarchy — MEP Calc" }, {
		name: "description",
		content: "Organization Company Hierarchy & Role Management"
	}] }),
	component: CompanyHierarchyPage
});
var DEFAULT_HIERARCHY = [
	{
		id: "usr-101",
		name: "Alex Mercer",
		email: "alex.mercer@mep-calc.com",
		designation: "Chief Executive Officer & Founder",
		department: "Management",
		role: "SUPER_ADMIN",
		parentId: null,
		avatarColor: "bg-indigo-600",
		status: "active"
	},
	{
		id: "usr-102",
		name: "David Vance",
		email: "david.vance@mep-calc.com",
		designation: "Director of MEP Engineering",
		department: "Management",
		role: "ORG_ADMIN",
		parentId: "usr-101",
		avatarColor: "bg-blue-600",
		status: "active"
	},
	{
		id: "usr-103",
		name: "Elena Rostova",
		email: "elena.rostova@mep-calc.com",
		designation: "Director of BIM & Technology",
		department: "BIM & IT",
		role: "ORG_ADMIN",
		parentId: "usr-101",
		avatarColor: "bg-purple-600",
		status: "active"
	},
	{
		id: "usr-104",
		name: "Vikram Kadam",
		email: "vikram.kadam@mep-calc.com",
		designation: "Lead HVAC Principal PM",
		department: "HVAC",
		role: "PROJECT_MANAGER",
		parentId: "usr-102",
		avatarColor: "bg-emerald-600",
		status: "active"
	},
	{
		id: "usr-105",
		name: "Sarah Jenkins",
		email: "sarah.jenkins@mep-calc.com",
		designation: "Lead Electrical PM",
		department: "Electrical",
		role: "PROJECT_MANAGER",
		parentId: "usr-102",
		avatarColor: "bg-amber-600",
		status: "active"
	},
	{
		id: "usr-106",
		name: "Marcus Brody",
		email: "marcus.brody@mep-calc.com",
		designation: "Lead Plumbing & Fire Protection PM",
		department: "Plumbing",
		role: "PROJECT_MANAGER",
		parentId: "usr-102",
		avatarColor: "bg-teal-600",
		status: "active"
	},
	{
		id: "usr-107",
		name: "Rahul Sharma",
		email: "rahul.sharma@mep-calc.com",
		designation: "Senior HVAC Mechanical Engineer",
		department: "HVAC",
		role: "ENGINEER",
		parentId: "usr-104",
		avatarColor: "bg-cyan-600",
		status: "active"
	},
	{
		id: "usr-108",
		name: "Priya Nair",
		email: "priya.nair@mep-calc.com",
		designation: "Senior Electrical Systems Engineer",
		department: "Electrical",
		role: "ENGINEER",
		parentId: "usr-105",
		avatarColor: "bg-rose-600",
		status: "active"
	},
	{
		id: "usr-109",
		name: "Tariq Al-Mansoor",
		email: "tariq.mansoor@mep-calc.com",
		designation: "Fire Suppression Systems Specialist",
		department: "Fire Fighting",
		role: "ENGINEER",
		parentId: "usr-106",
		avatarColor: "bg-orange-600",
		status: "active"
	},
	{
		id: "usr-110",
		name: "Daniel Kim",
		email: "daniel.kim@mep-calc.com",
		designation: "HVAC Design & Load Calculation Specialist",
		department: "HVAC",
		role: "ENGINEER",
		parentId: "usr-107",
		avatarColor: "bg-sky-600",
		status: "active"
	},
	{
		id: "usr-111",
		name: "Amina Zaidi",
		email: "amina.zaidi@mep-calc.com",
		designation: "Electrical BIM Specialist & Modeler",
		department: "BIM & IT",
		role: "ENGINEER",
		parentId: "usr-103",
		avatarColor: "bg-violet-600",
		status: "active"
	},
	{
		id: "usr-112",
		name: "Kevin Chen",
		email: "kevin.chen@mep-calc.com",
		designation: "Junior Plumbing & Hydraulics Engineer",
		department: "Plumbing",
		role: "USER",
		parentId: "usr-106",
		avatarColor: "bg-slate-600",
		status: "active"
	}
];
function CompanyHierarchyPage() {
	const { profile, userData } = useAuth();
	const currentRole = userData?.role || profile?.role || "SUPER_ADMIN";
	const isAuthorized = ["SUPER_ADMIN", "ORG_ADMIN"].includes(currentRole);
	const [members, setMembers] = (0, import_react.useState)(() => {
		try {
			const saved = localStorage.getItem("mep_company_hierarchy");
			if (saved) return JSON.parse(saved);
		} catch (e) {}
		return DEFAULT_HIERARCHY;
	});
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const [selectedDept, setSelectedDept] = (0, import_react.useState)("ALL");
	const [viewMode, setViewMode] = (0, import_react.useState)("tree");
	const [collapsedNodes, setCollapsedNodes] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [isAddModalOpen, setIsAddModalOpen] = (0, import_react.useState)(false);
	const [editingMember, setEditingMember] = (0, import_react.useState)(null);
	const [formName, setFormName] = (0, import_react.useState)("");
	const [formEmail, setFormEmail] = (0, import_react.useState)("");
	const [formDesignation, setFormDesignation] = (0, import_react.useState)("");
	const [formDepartment, setFormDepartment] = (0, import_react.useState)("HVAC");
	const [formRole, setFormRole] = (0, import_react.useState)("ENGINEER");
	const [formParentId, setFormParentId] = (0, import_react.useState)(null);
	const saveHierarchy = (newMembers) => {
		setMembers(newMembers);
		try {
			localStorage.setItem("mep_company_hierarchy", JSON.stringify(newMembers));
		} catch (e) {}
	};
	const handleResetDefault = () => {
		saveHierarchy(DEFAULT_HIERARCHY);
		toast$1.success("Hierarchy reset to default organization structure!");
	};
	const toggleCollapse = (id) => {
		setCollapsedNodes((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};
	const handleOpenAddModal = (presetParentId) => {
		setFormName("");
		setFormEmail("");
		setFormDesignation("");
		setFormDepartment("HVAC");
		setFormRole("ENGINEER");
		setFormParentId(presetParentId !== void 0 ? presetParentId : members[0]?.id || null);
		setEditingMember(null);
		setIsAddModalOpen(true);
	};
	const handleOpenEditModal = (member) => {
		setEditingMember(member);
		setFormName(member.name);
		setFormEmail(member.email);
		setFormDesignation(member.designation);
		setFormDepartment(member.department);
		setFormRole(member.role);
		setFormParentId(member.parentId);
		setIsAddModalOpen(true);
	};
	const handleFormSubmit = (e) => {
		e.preventDefault();
		if (!formName.trim() || !formEmail.trim()) {
			toast$1.error("Please provide both name and email.");
			return;
		}
		const colorPalette = [
			"bg-indigo-600",
			"bg-blue-600",
			"bg-purple-600",
			"bg-emerald-600",
			"bg-amber-600",
			"bg-teal-600",
			"bg-rose-600",
			"bg-cyan-600",
			"bg-sky-600"
		];
		if (editingMember) {
			saveHierarchy(members.map((m) => {
				if (m.id === editingMember.id) return {
					...m,
					name: formName.trim(),
					email: formEmail.trim(),
					designation: formDesignation.trim() || "MEP Specialist",
					department: formDepartment,
					role: formRole,
					parentId: formParentId
				};
				return m;
			}));
			toast$1.success(`Updated ${formName} in hierarchy!`);
		} else {
			const newMember = {
				id: `usr-${Date.now()}`,
				name: formName.trim(),
				email: formEmail.trim(),
				designation: formDesignation.trim() || "MEP Engineer",
				department: formDepartment,
				role: formRole,
				parentId: formParentId,
				avatarColor: colorPalette[Math.floor(Math.random() * colorPalette.length)],
				status: "active"
			};
			saveHierarchy([...members, newMember]);
			toast$1.success(`Added ${newMember.name} to hierarchy!`);
		}
		setIsAddModalOpen(false);
	};
	const handleDeleteMember = (id, name) => {
		if (confirm(`Are you sure you want to remove ${name} from the hierarchy? Subordinates will be re-assigned to their manager.`)) {
			const target = members.find((m) => m.id === id);
			const parentOfTarget = target ? target.parentId : null;
			saveHierarchy(members.filter((m) => m.id !== id).map((m) => {
				if (m.parentId === id) return {
					...m,
					parentId: parentOfTarget
				};
				return m;
			}));
			toast$1.success(`Removed ${name} from hierarchy.`);
		}
	};
	const visibleMembers = (0, import_react.useMemo)(() => {
		if (currentRole === "SUPER_ADMIN") return members;
		const emailToMatch = userData?.email || profile?.email;
		let currentUserNode = members.find((m) => m.email === emailToMatch);
		if (!currentUserNode) currentUserNode = members.find((m) => m.role === "ORG_ADMIN");
		if (!currentUserNode) return [];
		const visibleIds = /* @__PURE__ */ new Set();
		const toProcess = [currentUserNode.id];
		while (toProcess.length > 0) {
			const currentId = toProcess.pop();
			if (!visibleIds.has(currentId)) {
				visibleIds.add(currentId);
				const children = members.filter((m) => m.parentId === currentId).map((m) => m.id);
				toProcess.push(...children);
			}
		}
		return members.filter((m) => visibleIds.has(m.id));
	}, [
		members,
		currentRole,
		userData?.email,
		profile?.email
	]);
	const filteredMembers = (0, import_react.useMemo)(() => {
		return visibleMembers.filter((m) => {
			const matchQuery = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.email.toLowerCase().includes(searchQuery.toLowerCase()) || m.designation.toLowerCase().includes(searchQuery.toLowerCase());
			const matchDept = selectedDept === "ALL" || m.department === selectedDept;
			return matchQuery && matchDept;
		});
	}, [
		visibleMembers,
		searchQuery,
		selectedDept
	]);
	const rootMembers = (0, import_react.useMemo)(() => {
		const ids = new Set(visibleMembers.map((m) => m.id));
		return visibleMembers.filter((m) => !m.parentId || !ids.has(m.parentId));
	}, [visibleMembers]);
	const reportsMap = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		visibleMembers.forEach((m) => {
			if (m.parentId) {
				if (!map.has(m.parentId)) map.set(m.parentId, []);
				map.get(m.parentId).push(m);
			}
		});
		return map;
	}, [visibleMembers]);
	if (!isAuthorized) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Company Hierarchy",
		subtitle: "Organization Role & Reporting Hierarchy",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-[calc(100vh-120px)] items-center justify-center bg-background p-6",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col items-center gap-4 text-center max-w-md bg-card border border-border p-8 rounded-3xl shadow-lg",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "size-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "size-8" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-xl font-bold text-foreground",
					children: "Access Restricted"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground mt-1",
					children: "Company Hierarchy management is restricted to Super Admins and Organization Admins."
				})] })]
			})
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Company Hierarchy",
		subtitle: "Super Admin & Organization Hierarchy Builder",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => handleOpenAddModal(null),
				className: "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-xs cursor-pointer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserPlus, { className: "size-3.5" }), " Add Member"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => {
					saveHierarchy([...members]);
					toast$1.success("Company hierarchy configuration saved!");
				},
				className: "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-2 border border-border text-foreground hover:bg-surface-3 text-xs font-bold transition-all cursor-pointer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-3.5 text-primary" }), " Save Changes"]
			})]
		}),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col flex-1 h-full min-h-0 bg-slate-50/40 dark:bg-zinc-950/20 overflow-y-auto custom-scrollbar p-6 space-y-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-card border border-border p-4.5 rounded-2xl shadow-xs flex items-center gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "size-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-semibold text-muted-foreground",
								children: "Total Members"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xl font-extrabold text-foreground",
								children: [members.length, " Users"]
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-card border border-border p-4.5 rounded-2xl shadow-xs flex items-center gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "size-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crown, { className: "size-5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-semibold text-muted-foreground",
								children: "Admins & PMs"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xl font-extrabold text-foreground",
								children: [members.filter((m) => [
									"SUPER_ADMIN",
									"ORG_ADMIN",
									"PROJECT_MANAGER"
								].includes(m.role)).length, " Leaders"]
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-card border border-border p-4.5 rounded-2xl shadow-xs flex items-center gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "size-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Briefcase, { className: "size-5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-semibold text-muted-foreground",
								children: "Engineers & Staff"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xl font-extrabold text-foreground",
								children: [members.filter((m) => [
									"ENGINEER",
									"USER",
									"VIEWER"
								].includes(m.role)).length, " Staff"]
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-card border border-border p-4.5 rounded-2xl shadow-xs flex items-center gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "size-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "size-5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-semibold text-muted-foreground",
								children: "Departments"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xl font-extrabold text-foreground",
								children: "6 Disciplines"
							})] })]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-card border border-border p-3.5 rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 w-full md:w-auto flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative flex-1 max-w-md",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								placeholder: "Search member, email, title...",
								value: searchQuery,
								onChange: (e) => setSearchQuery(e.target.value),
								className: "w-full bg-surface-2 border border-border/80 focus:border-primary rounded-full pl-9 pr-4 py-2 text-xs outline-none transition-all"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: selectedDept,
							onChange: (e) => setSelectedDept(e.target.value),
							className: "bg-surface-2 border border-border/80 text-foreground font-semibold rounded-full px-3.5 py-2 text-xs outline-none focus:border-primary cursor-pointer shrink-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "ALL",
									children: "All Departments"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "Management",
									children: "Management"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "HVAC",
									children: "HVAC Engineering"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "Electrical",
									children: "Electrical Engineering"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "Plumbing",
									children: "Plumbing Engineering"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "Fire Fighting",
									children: "Fire Protection"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "BIM & IT",
									children: "BIM & Technology"
								})
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex bg-surface-2 p-1 rounded-full border border-border/80",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setViewMode("tree"),
								className: `px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${viewMode === "tree" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GitFork, { className: "size-3.5 inline mr-1" }), " Tree View"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setViewMode("table"),
								className: `px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${viewMode === "table" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-3.5 inline mr-1" }), " List Grid"]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: handleResetDefault,
							className: "px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-full hover:bg-surface-2 transition-all cursor-pointer",
							title: "Reset to default mock hierarchy",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3.5 inline mr-1" }), " Reset"]
						})]
					})]
				}),
				viewMode === "tree" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "bg-card border border-border rounded-3xl p-6 shadow-sm overflow-x-auto custom-scrollbar min-h-[500px]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-col items-center min-w-[750px] space-y-6",
						children: rootMembers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-12 text-center text-muted-foreground text-sm",
							children: "No hierarchy members found matching query."
						}) : rootMembers.map((root) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TreeNode, {
							member: root,
							reportsMap,
							collapsedNodes,
							onToggleCollapse: toggleCollapse,
							onAddReport: handleOpenAddModal,
							onEdit: handleOpenEditModal,
							onDelete: handleDeleteMember,
							allMembers: members
						}, root.id))
					})
				}),
				viewMode === "table" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "bg-card border border-border rounded-3xl overflow-hidden shadow-sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-x-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-left text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "bg-surface-2 text-muted-foreground font-bold uppercase text-[10px] tracking-wider border-b border-border",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-3 px-4",
										children: "Member Name & Email"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-3 px-4",
										children: "Designation"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-3 px-4",
										children: "Department"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-3 px-4",
										children: "Role Tier"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-3 px-4",
										children: "Reporting Manager"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-3 px-4 text-center",
										children: "Direct Reports"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-3 px-4 text-right",
										children: "Actions"
									})
								] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
								className: "divide-y divide-border/60",
								children: filteredMembers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									colSpan: 7,
									className: "py-8 text-center text-muted-foreground italic",
									children: "No team members found matching search query."
								}) }) : filteredMembers.map((m) => {
									const manager = members.find((p) => p.id === m.parentId);
									const directReportsCount = (reportsMap.get(m.id) || []).length;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
										className: "hover:bg-surface-2/60 transition-colors",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3 px-4",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-3",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: `size-8 rounded-full ${m.avatarColor || "bg-primary"} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`,
														children: m.name.charAt(0)
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex flex-col",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-bold text-foreground",
															children: m.name
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] text-muted-foreground",
															children: m.email
														})]
													})]
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3 px-4 font-medium text-foreground",
												children: m.designation
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3 px-4",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-primary/10 text-primary border border-primary/20",
													children: m.department
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3 px-4",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RoleBadge, { role: m.role })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3 px-4 text-muted-foreground",
												children: manager ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-1.5 font-medium text-foreground",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-3.5 text-muted-foreground" }), manager.name]
												}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-emerald-600 dark:text-emerald-400 font-bold text-[10.5px]",
													children: "Top Leader"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3 px-4 text-center",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "px-2 py-0.5 bg-surface-2 rounded-full font-bold text-[11px] text-foreground",
													children: directReportsCount
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3 px-4 text-right",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center justify-end gap-1",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => handleOpenAddModal(m.id),
															className: "p-1.5 hover:bg-primary/10 text-primary rounded-lg transition-all cursor-pointer",
															title: "Add Direct Report",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserPlus, { className: "size-3.5" })
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => handleOpenEditModal(m),
															className: "p-1.5 hover:bg-surface-3 text-muted-foreground hover:text-foreground rounded-lg transition-all cursor-pointer",
															title: "Edit Role & Reporting",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5" })
														}),
														m.parentId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => handleDeleteMember(m.id, m.name),
															className: "p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-all cursor-pointer",
															title: "Remove Member",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
														})
													]
												})
											})
										]
									}, m.id);
								})
							})]
						})
					})
				})
			]
		}), isAddModalOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-card border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between border-b border-border/60 pb-3.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "size-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Network, { className: "size-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-bold text-foreground text-base",
							children: editingMember ? "Edit Team Member" : "Add Team Member"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: "Define user role and reporting hierarchy line."
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setIsAddModalOpen(false),
						className: "size-8 rounded-full hover:bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer",
						children: "✕"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: handleFormSubmit,
					className: "space-y-4 text-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "font-bold text-foreground block mb-1",
							children: "Full Name *"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							required: true,
							placeholder: "e.g. Vikram Kadam",
							value: formName,
							onChange: (e) => setFormName(e.target.value),
							className: "w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "font-bold text-foreground block mb-1",
							children: "Email Address *"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "email",
							required: true,
							placeholder: "vikram@company.com",
							value: formEmail,
							onChange: (e) => setFormEmail(e.target.value),
							className: "w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "font-bold text-foreground block mb-1",
								children: "Designation / Title"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								placeholder: "e.g. Lead HVAC Engineer",
								value: formDesignation,
								onChange: (e) => setFormDesignation(e.target.value),
								className: "w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "font-bold text-foreground block mb-1",
								children: "Department"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: formDepartment,
								onChange: (e) => setFormDepartment(e.target.value),
								className: "w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium cursor-pointer",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "Management",
										children: "Management"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "HVAC",
										children: "HVAC Engineering"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "Electrical",
										children: "Electrical Engineering"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "Plumbing",
										children: "Plumbing Engineering"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "Fire Fighting",
										children: "Fire Protection"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "BIM & IT",
										children: "BIM & Technology"
									})
								]
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "font-bold text-foreground block mb-1",
								children: "System Role Tier"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: formRole,
								onChange: (e) => setFormRole(e.target.value),
								className: "w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium cursor-pointer",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "SUPER_ADMIN",
										children: "Super Admin (CEO)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "ORG_ADMIN",
										children: "Org Admin (Director)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "PROJECT_MANAGER",
										children: "Project Manager (PM)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "ENGINEER",
										children: "Senior Engineer"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "USER",
										children: "Engineer / Staff"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "VIEWER",
										children: "Viewer / Guest"
									})
								]
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "font-bold text-foreground block mb-1",
								children: "Reporting Manager"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: formParentId || "",
								onChange: (e) => setFormParentId(e.target.value || null),
								className: "w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "",
									children: "No Manager (Top Leader)"
								}), members.filter((m) => !editingMember || m.id !== editingMember.id).map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
									value: m.id,
									children: [
										m.name,
										" (",
										m.designation,
										")"
									]
								}, m.id))]
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-end gap-2.5 pt-4 border-t border-border/60",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setIsAddModalOpen(false),
								className: "px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-surface-2 transition-all cursor-pointer",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								className: "px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-xs cursor-pointer",
								children: editingMember ? "Save Changes" : "Add to Hierarchy"
							})]
						})
					]
				})]
			})
		})]
	});
}
function TreeNode({ member, reportsMap, collapsedNodes, onToggleCollapse, onAddReport, onEdit, onDelete, allMembers }) {
	const children = reportsMap.get(member.id) || [];
	const isCollapsed = collapsedNodes.has(member.id);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col items-center relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "group relative bg-card border border-border hover:border-primary/50 p-4 rounded-2xl shadow-xs hover:shadow-md transition-all w-72 flex flex-col gap-2.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RoleBadge, { role: member.role }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => onAddReport(member.id),
								className: "p-1 hover:bg-primary/10 text-primary rounded-md transition-all cursor-pointer",
								title: "Add Subordinate",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserPlus, { className: "size-3.5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => onEdit(member),
								className: "p-1 hover:bg-surface-3 text-muted-foreground hover:text-foreground rounded-md transition-all cursor-pointer",
								title: "Edit Member",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5" })
							}),
							member.parentId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => onDelete(member.id, member.name),
								className: "p-1 hover:bg-rose-500/10 text-rose-500 rounded-md transition-all cursor-pointer",
								title: "Remove Member",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `size-10 rounded-2xl ${member.avatarColor || "bg-primary"} text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs`,
						children: member.name.charAt(0)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-extrabold text-foreground text-sm truncate",
							children: member.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-medium text-muted-foreground truncate",
							children: member.designation
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between pt-2 border-t border-border/50 text-[11px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20 text-[10px]",
						children: member.department
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground text-[10px] truncate max-w-[130px]",
						title: member.email,
						children: member.email
					})]
				}),
				children.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => onToggleCollapse(member.id),
					className: "absolute -bottom-3 left-1/2 -translate-x-1/2 size-6 rounded-full bg-card border border-border shadow-xs flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-all cursor-pointer z-10",
					title: isCollapsed ? "Expand Subordinates" : "Collapse Subordinates",
					children: isCollapsed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5" })
				})
			]
		}), children.length > 0 && !isCollapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col items-center pt-6 relative w-full",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-border/80" }),
				children.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute top-6 left-0 right-0 h-0.5 bg-border/80 mx-auto",
					style: { width: `calc(100% - 18rem)` }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-start justify-center gap-6 pt-2",
					children: children.map((child) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative pt-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-border/80" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TreeNode, {
							member: child,
							reportsMap,
							collapsedNodes,
							onToggleCollapse,
							onAddReport,
							onEdit,
							onDelete,
							allMembers
						})]
					}, child.id))
				})
			]
		})]
	});
}
function RoleBadge({ role }) {
	switch (role) {
		case "SUPER_ADMIN": return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-wider flex items-center gap-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crown, { className: "size-3" }), " Super Admin"]
		});
		case "ORG_ADMIN": return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wider flex items-center gap-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "size-3" }), " Org Admin"]
		});
		case "PROJECT_MANAGER": return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Briefcase, { className: "size-3" }), " Lead PM"]
		});
		case "ENGINEER": return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase tracking-wider flex items-center gap-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserCheck, { className: "size-3" }), " Sr. Engineer"]
		});
		default: return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 uppercase tracking-wider flex items-center gap-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-3" }), " Staff"]
		});
	}
}
var $$splitComponentImporter$11 = () => import("./circuit-breaker-sizing-Ciywta8G.mjs");
var Route$11 = createFileRoute("/circuit-breaker-sizing")({
	head: () => ({ meta: [{ title: "Circuit Breaker Sizing — MEP Calc" }, {
		name: "description",
		content: "Preliminary circuit breaker capacity rating sizing based on connected loads, voltage, and phase parameters."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$11, "component")
});
var $$splitComponentImporter$10 = () => import("./chw-pump-head-Vq5dc45Z.mjs");
var Route$10 = createFileRoute("/chw-pump-head")({
	head: () => ({ meta: [{ title: "CHW Pump Head — MEP Calc" }, {
		name: "description",
		content: "Chilled water pump head loss sizer based on pipe friction, fittings losses, and static elevation."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
var $$splitComponentImporter$9 = () => import("./chw-pipe-sizer-DdMHX38v.mjs");
var Route$9 = createFileRoute("/chw-pipe-sizer")({
	head: () => ({ meta: [{ title: "CHW Pipe Sizer — MEP Calc" }, {
		name: "description",
		content: "Chilled water and condenser water pipe sizer based on flowrate, fluid type, and target pressure drop."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
var $$splitComponentImporter$8 = () => import("./central-battery-sizing-D2ZZ2CGv.mjs");
var Route$8 = createFileRoute("/central-battery-sizing")({
	head: () => ({ meta: [{ title: "Central Battery Sizing — MEP Calc" }, {
		name: "description",
		content: "Electrical central battery sizing calculations for emergency and exit lighting systems."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
var $$splitComponentImporter$7 = () => import("./capacitor-bank-sizing-CwNj57o3.mjs");
var Route$7 = createFileRoute("/capacitor-bank-sizing")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
var $$splitComponentImporter$6 = () => import("./cable-voltage-drop-Clf-Cmy0.mjs");
var Route$6 = createFileRoute("/cable-voltage-drop")({
	head: () => ({ meta: [{ title: "Cable Voltage Drop — MEP Calc" }, {
		name: "description",
		content: "Electrical cable voltage drop calculations"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import("./cable-tray-sizing-CL_afdYl.mjs");
var Route$5 = createFileRoute("/cable-tray-sizing")({
	head: () => ({ meta: [{ title: "Cable Tray Sizing — MEP Calc" }, {
		name: "description",
		content: "Calculate cable tray containment sizes."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./busbar-voltage-drop-7ai-p2ji.mjs");
var Route$4 = createFileRoute("/busbar-voltage-drop")({
	head: () => ({ meta: [{ title: "Busbar Voltage Drop — MEP Calc" }, {
		name: "description",
		content: "Electrical busbar voltage drop calculations"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("./busbar-calculation-BkXUov7X.mjs");
var Route$3 = createFileRoute("/busbar-calculation")({
	head: () => ({ meta: [{ title: "Busbar Calculation — MEP Calc" }, {
		name: "description",
		content: "Calculate busbar voltage drop and parameters."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./basement-smoke-calc-DSdZuGlH.mjs");
var Route$2 = createFileRoute("/basement-smoke-calc")({
	head: () => ({ meta: [{ title: "Basement Smoke Calc — MEP Calc" }, {
		name: "description",
		content: "Basement smoke control ventilation calculator and fan system head sizer."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./admin--bF3ce7E.mjs");
var Route$1 = createFileRoute("/admin")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./3d-view-Da540jSq.mjs");
var Route = createFileRoute("/3d-view")({
	head: () => ({ meta: [{ title: "Platform 3D — MEP Calculator" }, {
		name: "description",
		content: "Interactive 3D and 2D BIM viewer for IFC spatial models and MEP equipment."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var ZonesRoute = Route$63.update({
	id: "/zones",
	path: "/zones",
	getParentRoute: () => Route$64
});
var VentilationRoute = Route$62.update({
	id: "/ventilation",
	path: "/ventilation",
	getParentRoute: () => Route$64
});
var UpsSizingCalculationRoute = Route$61.update({
	id: "/ups-sizing-calculation",
	path: "/ups-sizing-calculation",
	getParentRoute: () => Route$64
});
var TransformerSizingRoute = Route$60.update({
	id: "/transformer-sizing",
	path: "/transformer-sizing",
	getParentRoute: () => Route$64
});
var TeamsRoute = Route$59.update({
	id: "/teams",
	path: "/teams",
	getParentRoute: () => Route$64
});
var StaircasePressurizationRoute = Route$58.update({
	id: "/staircase-pressurization",
	path: "/staircase-pressurization",
	getParentRoute: () => Route$64
});
var SmokeExtractFanRoute = Route$57.update({
	id: "/smoke-extract-fan",
	path: "/smoke-extract-fan",
	getParentRoute: () => Route$64
});
var ShortCircuitCalculationsRoute = Route$56.update({
	id: "/short-circuit-calculations",
	path: "/short-circuit-calculations",
	getParentRoute: () => Route$64
});
var SettingsRoute = Route$55.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => Route$64
});
var SanityCheckToolRoute = Route$54.update({
	id: "/sanity-check-tool",
	path: "/sanity-check-tool",
	getParentRoute: () => Route$64
});
var ResetPasswordRoute = Route$53.update({
	id: "/reset-password",
	path: "/reset-password",
	getParentRoute: () => Route$64
});
var ReportsRoute = Route$52.update({
	id: "/reports",
	path: "/reports",
	getParentRoute: () => Route$64
});
var RefrigerantPipeSizingRoute = Route$51.update({
	id: "/refrigerant-pipe-sizing",
	path: "/refrigerant-pipe-sizing",
	getParentRoute: () => Route$64
});
var PsychrometricRoute = Route$50.update({
	id: "/psychrometric",
	path: "/psychrometric",
	getParentRoute: () => Route$64
});
var ProjectsRoute = Route$49.update({
	id: "/projects",
	path: "/projects",
	getParentRoute: () => Route$64
});
var ProjectLoadScheduleRoute = Route$48.update({
	id: "/project-load-schedule",
	path: "/project-load-schedule",
	getParentRoute: () => Route$64
});
var PrivacyRoute = Route$47.update({
	id: "/privacy",
	path: "/privacy",
	getParentRoute: () => Route$64
});
var PreliminaryCoolingLoadRoute = Route$46.update({
	id: "/preliminary-cooling-load",
	path: "/preliminary-cooling-load",
	getParentRoute: () => Route$64
});
var PlumbingWaterDemandRoute = Route$45.update({
	id: "/plumbing-water-demand",
	path: "/plumbing-water-demand",
	getParentRoute: () => Route$64
});
var PlumbingTankSizingRoute = Route$44.update({
	id: "/plumbing-tank-sizing",
	path: "/plumbing-tank-sizing",
	getParentRoute: () => Route$64
});
var PlumbingSupplyPipeSizerRoute = Route$43.update({
	id: "/plumbing-supply-pipe-sizer",
	path: "/plumbing-supply-pipe-sizer",
	getParentRoute: () => Route$64
});
var PlumbingSumpPumpRoute = Route$42.update({
	id: "/plumbing-sump-pump",
	path: "/plumbing-sump-pump",
	getParentRoute: () => Route$64
});
var PlumbingStormWaterRoute = Route$41.update({
	id: "/plumbing-storm-water",
	path: "/plumbing-storm-water",
	getParentRoute: () => Route$64
});
var PlumbingSprinklerKfactorRoute = Route$40.update({
	id: "/plumbing-sprinkler-kfactor",
	path: "/plumbing-sprinkler-kfactor",
	getParentRoute: () => Route$64
});
var PlumbingSprinklerDensityRoute = Route$39.update({
	id: "/plumbing-sprinkler-density",
	path: "/plumbing-sprinkler-density",
	getParentRoute: () => Route$64
});
var PlumbingSewagePumpRoute = Route$38.update({
	id: "/plumbing-sewage-pump",
	path: "/plumbing-sewage-pump",
	getParentRoute: () => Route$64
});
var PlumbingPumpSizingRoute = Route$37.update({
	id: "/plumbing-pump-sizing",
	path: "/plumbing-pump-sizing",
	getParentRoute: () => Route$64
});
var PlumbingPressureVesselRoute = Route$36.update({
	id: "/plumbing-pressure-vessel",
	path: "/plumbing-pressure-vessel",
	getParentRoute: () => Route$64
});
var PlumbingLoadingUnitRoute = Route$35.update({
	id: "/plumbing-loading-unit",
	path: "/plumbing-loading-unit",
	getParentRoute: () => Route$64
});
var PlumbingHazenWilliamsRoute = Route$34.update({
	id: "/plumbing-hazen-williams",
	path: "/plumbing-hazen-williams",
	getParentRoute: () => Route$64
});
var PlumbingGasTankRoute = Route$33.update({
	id: "/plumbing-gas-tank",
	path: "/plumbing-gas-tank",
	getParentRoute: () => Route$64
});
var PlumbingFm200Route = Route$32.update({
	id: "/plumbing-fm200",
	path: "/plumbing-fm200",
	getParentRoute: () => Route$64
});
var PlumbingFixtureUnitRoute = Route$66.update({
	id: "/plumbing-fixture-unit",
	path: "/plumbing-fixture-unit",
	getParentRoute: () => Route$64
});
var PlumbingFireWaterDemandRoute = Route$31.update({
	id: "/plumbing-fire-water-demand",
	path: "/plumbing-fire-water-demand",
	getParentRoute: () => Route$64
});
var PlumbingFireTankDurationRoute = Route$30.update({
	id: "/plumbing-fire-tank-duration",
	path: "/plumbing-fire-tank-duration",
	getParentRoute: () => Route$64
});
var PlumbingFireTankCapacityRoute = Route$29.update({
	id: "/plumbing-fire-tank-capacity",
	path: "/plumbing-fire-tank-capacity",
	getParentRoute: () => Route$64
});
var PlumbingFirePumpDutyRoute = Route$28.update({
	id: "/plumbing-fire-pump-duty",
	path: "/plumbing-fire-pump-duty",
	getParentRoute: () => Route$64
});
var PlumbingDrainageRoute = Route$27.update({
	id: "/plumbing-drainage",
	path: "/plumbing-drainage",
	getParentRoute: () => Route$64
});
var LpdCalculationRoute = Route$26.update({
	id: "/lpd-calculation",
	path: "/lpd-calculation",
	getParentRoute: () => Route$64
});
var LoginRoute = Route$25.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$64
});
var LobbyPressurisationRoute = Route$24.update({
	id: "/lobby-pressurisation",
	path: "/lobby-pressurisation",
	getParentRoute: () => Route$64
});
var LoadSummaryRoute = Route$23.update({
	id: "/load-summary",
	path: "/load-summary",
	getParentRoute: () => Route$64
});
var LightingLuxCalculationRoute = Route$22.update({
	id: "/lighting-lux-calculation",
	path: "/lighting-lux-calculation",
	getParentRoute: () => Route$64
});
var HeatingLoadRoute = Route$21.update({
	id: "/heating-load",
	path: "/heating-load",
	getParentRoute: () => Route$64
});
var GeneratorSizingRoute = Route$20.update({
	id: "/generator-sizing",
	path: "/generator-sizing",
	getParentRoute: () => Route$64
});
var FreshAirCoolingLoadRoute = Route$19.update({
	id: "/fresh-air-cooling-load",
	path: "/fresh-air-cooling-load",
	getParentRoute: () => Route$64
});
var EquipmentRoute = Route$18.update({
	id: "/equipment",
	path: "/equipment",
	getParentRoute: () => Route$64
});
var DuctSizerRoute = Route$17.update({
	id: "/duct-sizer",
	path: "/duct-sizer",
	getParentRoute: () => Route$64
});
var DiffuserSelectorRoute = Route$16.update({
	id: "/diffuser-selector",
	path: "/diffuser-selector",
	getParentRoute: () => Route$64
});
var DashboardRoute = Route$67.update({
	id: "/dashboard",
	path: "/dashboard",
	getParentRoute: () => Route$64
});
var ConductorSizingRoute = Route$15.update({
	id: "/conductor-sizing",
	path: "/conductor-sizing",
	getParentRoute: () => Route$64
});
var CondensateDrainCalcRoute = Route$14.update({
	id: "/condensate-drain-calc",
	path: "/condensate-drain-calc",
	getParentRoute: () => Route$64
});
var CondensateDrainRoute = Route$13.update({
	id: "/condensate-drain",
	path: "/condensate-drain",
	getParentRoute: () => Route$64
});
var CompanyHierarchyRoute = Route$12.update({
	id: "/company-hierarchy",
	path: "/company-hierarchy",
	getParentRoute: () => Route$64
});
var CircuitBreakerSizingRoute = Route$11.update({
	id: "/circuit-breaker-sizing",
	path: "/circuit-breaker-sizing",
	getParentRoute: () => Route$64
});
var ChwPumpHeadRoute = Route$10.update({
	id: "/chw-pump-head",
	path: "/chw-pump-head",
	getParentRoute: () => Route$64
});
var ChwPipeSizerRoute = Route$9.update({
	id: "/chw-pipe-sizer",
	path: "/chw-pipe-sizer",
	getParentRoute: () => Route$64
});
var CentralBatterySizingRoute = Route$8.update({
	id: "/central-battery-sizing",
	path: "/central-battery-sizing",
	getParentRoute: () => Route$64
});
var CapacitorBankSizingRoute = Route$7.update({
	id: "/capacitor-bank-sizing",
	path: "/capacitor-bank-sizing",
	getParentRoute: () => Route$64
});
var CalculatorsRoute = Route$65.update({
	id: "/calculators",
	path: "/calculators",
	getParentRoute: () => Route$64
});
var CableVoltageDropRoute = Route$6.update({
	id: "/cable-voltage-drop",
	path: "/cable-voltage-drop",
	getParentRoute: () => Route$64
});
var CableTraySizingRoute = Route$5.update({
	id: "/cable-tray-sizing",
	path: "/cable-tray-sizing",
	getParentRoute: () => Route$64
});
var BusbarVoltageDropRoute = Route$4.update({
	id: "/busbar-voltage-drop",
	path: "/busbar-voltage-drop",
	getParentRoute: () => Route$64
});
var BusbarCalculationRoute = Route$3.update({
	id: "/busbar-calculation",
	path: "/busbar-calculation",
	getParentRoute: () => Route$64
});
var BasementSmokeCalcRoute = Route$2.update({
	id: "/basement-smoke-calc",
	path: "/basement-smoke-calc",
	getParentRoute: () => Route$64
});
var AdminRoute = Route$1.update({
	id: "/admin",
	path: "/admin",
	getParentRoute: () => Route$64
});
var R3dViewRoute = Route.update({
	id: "/3d-view",
	path: "/3d-view",
	getParentRoute: () => Route$64
});
var rootRouteChildren = {
	IndexRoute: Route$68.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$64
	}),
	R3dViewRoute,
	AdminRoute,
	BasementSmokeCalcRoute,
	BusbarCalculationRoute,
	BusbarVoltageDropRoute,
	CableTraySizingRoute,
	CableVoltageDropRoute,
	CalculatorsRoute,
	CapacitorBankSizingRoute,
	CentralBatterySizingRoute,
	ChwPipeSizerRoute,
	ChwPumpHeadRoute,
	CircuitBreakerSizingRoute,
	CompanyHierarchyRoute,
	CondensateDrainRoute,
	CondensateDrainCalcRoute,
	ConductorSizingRoute,
	DashboardRoute,
	DiffuserSelectorRoute,
	DuctSizerRoute,
	EquipmentRoute,
	FreshAirCoolingLoadRoute,
	GeneratorSizingRoute,
	HeatingLoadRoute,
	LightingLuxCalculationRoute,
	LoadSummaryRoute,
	LobbyPressurisationRoute,
	LoginRoute,
	LpdCalculationRoute,
	PlumbingDrainageRoute,
	PlumbingFirePumpDutyRoute,
	PlumbingFireTankCapacityRoute,
	PlumbingFireTankDurationRoute,
	PlumbingFireWaterDemandRoute,
	PlumbingFixtureUnitRoute,
	PlumbingFm200Route,
	PlumbingGasTankRoute,
	PlumbingHazenWilliamsRoute,
	PlumbingLoadingUnitRoute,
	PlumbingPressureVesselRoute,
	PlumbingPumpSizingRoute,
	PlumbingSewagePumpRoute,
	PlumbingSprinklerDensityRoute,
	PlumbingSprinklerKfactorRoute,
	PlumbingStormWaterRoute,
	PlumbingSumpPumpRoute,
	PlumbingSupplyPipeSizerRoute,
	PlumbingTankSizingRoute,
	PlumbingWaterDemandRoute,
	PreliminaryCoolingLoadRoute,
	PrivacyRoute,
	ProjectLoadScheduleRoute,
	ProjectsRoute,
	PsychrometricRoute,
	RefrigerantPipeSizingRoute,
	ReportsRoute,
	ResetPasswordRoute,
	SanityCheckToolRoute,
	SettingsRoute,
	ShortCircuitCalculationsRoute,
	SmokeExtractFanRoute,
	StaircasePressurizationRoute,
	TeamsRoute,
	TransformerSizingRoute,
	UpsSizingCalculationRoute,
	VentilationRoute,
	ZonesRoute
};
var routeTree = Route$64._addFileChildren(rootRouteChildren)._addFileTypes();
if (typeof window !== "undefined" && window.__never_eval_createroot__) (0, import_client.createRoot)(document.getElementById("tauri-app-root"));
var originalCreateElement = import_react.createElement;
function NumericInput({ value, onChange, ...props }) {
	const [localVal, setLocalVal] = (0, import_react.useState)(value === 0 || value === "0" ? "" : String(value ?? ""));
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (document.activeElement !== ref.current) setLocalVal(value === 0 || value === "0" ? "" : String(value ?? ""));
	}, [value]);
	return originalCreateElement("input", {
		...props,
		ref,
		type: "number",
		value: localVal,
		onChange: (e) => {
			const val = e.target.value;
			setLocalVal(val);
			if (onChange) if (val === "") onChange({
				...e,
				target: {
					...e.target,
					value: "0",
					valueAsNumber: 0
				}
			});
			else onChange(e);
		},
		onBlur: (e) => {
			setLocalVal(value === 0 || value === "0" ? "" : String(value ?? ""));
			if (props.onBlur) props.onBlur(e);
		},
		"data-bypass-patch": true
	});
}
import_react.default.createElement = function(type, props, ...children) {
	if (type === "input" && props && props.type === "number" && !props["data-bypass-patch"] && props.onChange && props.value !== void 0 && typeof props.value === "number") return originalCreateElement(NumericInput, props, ...children);
	return originalCreateElement.apply(this, [
		type,
		props,
		...children
	]);
};
var getRouter = () => {
	return createRouter({
		routeTree,
		context: { queryClient: new QueryClient() },
		scrollRestoration: true,
		defaultPreloadStaleTime: 0
	});
};
//#endregion
export { getRouter };
