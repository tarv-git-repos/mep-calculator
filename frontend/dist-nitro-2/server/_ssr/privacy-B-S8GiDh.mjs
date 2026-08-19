import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { in as CircleCheck, lt as FileText } from "../_libs/lucide-react.mjs";
import { r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { P as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/privacy-B-S8GiDh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function PrivacyPolicy() {
	const navigate = useNavigate();
	const { acceptPrivacy } = useAuth();
	const [agreed, setAgreed] = (0, import_react.useState)(false);
	const handleAccept = async () => {
		if (!agreed) return;
		await acceptPrivacy();
		navigate({ to: "/" });
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-3xl w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-6",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "w-8 h-8" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight",
							children: "Privacy Policy & Terms of Service"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-slate-500 dark:text-slate-400 text-lg",
							children: "Please review our end-user license agreement before using the MEP Calculator suite."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-8 prose prose-slate dark:prose-invert max-w-none h-[380px] overflow-y-auto custom-scrollbar",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "1. Acceptance of Terms" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "2. Data Storage & Telemetry" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "This application operates both locally on your device and via our secure cloud servers. Project calculations are auto-saved to your local AppData folder to prevent data loss. If you are signed in, your projects are synced securely to our cloud database to enable Real-Time Collaboration and Auto-Locking features." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "3. Licensing" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Your license is bound strictly to your registered email address. Sharing accounts or bypassing the license verification mechanisms is strictly prohibited and result in permanent account suspension." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "4. Auto-Updates" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The desktop version of this application periodically checks for updates to ensure you have the latest calculators, bug fixes, and security patches. By accepting these terms, you consent to these automatic background checks." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "5. Disclaimer of Liability" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The calculations provided by this software are for preliminary design and estimation purposes only. The authors and developers of this software are not liable for any structural, mechanical, or electrical failures that may occur based on these estimations. Always verify critical engineering data with certified local codes and professional engineers." })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-3 cursor-pointer select-none",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: agreed,
							onChange: (e) => setAgreed(e.target.checked),
							className: "size-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm font-semibold text-slate-700 dark:text-slate-200",
							children: "I have read, understood, and agree to the Privacy Policy & Terms of Service."
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-200/80 dark:border-slate-700/80",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-500 dark:text-slate-400",
							children: "By checking the box above and clicking \"I Accept\", you agree to our terms."
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: handleAccept,
							disabled: !agreed,
							className: `w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 font-bold rounded-xl transition-all shadow-md shrink-0 ${agreed ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer hover:shadow-lg" : "bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-5 h-5" }), "I Accept & Continue"]
						})]
					})]
				})
			]
		})
	});
}
//#endregion
export { PrivacyPolicy as component };
