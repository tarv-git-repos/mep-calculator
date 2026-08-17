import { o as __toESM } from "../_runtime.mjs";
import { n as api } from "./api-BcQvT-mW.mjs";
import { t as supabase } from "./supabase-CCCDNKe9.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as getCalculatorTitleFromPath, o as logCalculatorUpdate, s as logCalculatorView, u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { B as Megaphone, Dt as ChevronRight, E as Save, G as List, Gt as PenLine, I as Network, Jt as LoaderCircle, Kt as PanelLeftOpen, L as Moon, Lt as Bell, N as Plus, O as Rocket, Ot as ChevronDown, Pt as Building2, S as Settings, T as Search, U as LogOut, Ut as TriangleAlert, W as Lock, Wt as Sparkles, Z as History, _ as Star, at as FolderOpen, b as ShieldCheck, d as Trophy, g as Sun, k as RefreshCw, kt as Check, m as Trash2, n as X, q as Key, qt as PanelLeftClose, rn as CircleCheckBig, t as Zap, wt as Circle, x as ShieldAlert, xt as Copy, yt as CreditCard } from "../_libs/lucide-react.mjs";
import { a as usePrompt, i as useConfirm, r as cn } from "./use-confirm-BT3fngjN.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as useAuth, n as authService, r as getHardwareFingerprint } from "./AuthContext-j7AuApR_.mjs";
import { t as NAV } from "./navigation-W62yd3w7.mjs";
import { F as useRouter, P as useNavigate, g as Link, l as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as invoke } from "../_libs/tauri-apps__api.mjs";
import { i as readTextFile, n as mkdir, r as readDir, t as exists } from "../_libs/tauri-apps__plugin-fs.mjs";
import { n as AnimatePresence, t as motion } from "../_libs/framer-motion.mjs";
import { a as Label2, c as Root2, d as SubTrigger2, f as Trigger, i as ItemIndicator2, l as Separator2, n as Content2, o as Portal2, r as Item2, s as RadioItem2, t as CheckboxItem2, u as SubContent2 } from "../_libs/@radix-ui/react-context-menu+[...].mjs";
import { a as Label2$1, c as RadioItem2$1, d as SubContent2$1, f as SubTrigger2$1, i as ItemIndicator2$1, l as Root2$1, n as Content2$1, o as Portal2$1, p as Trigger$1, r as Item2$1, s as RadioGroup2, t as CheckboxItem2$1, u as Separator2$1 } from "../_libs/radix-ui__react-dropdown-menu.mjs";
import { n as open } from "../_libs/tauri-apps__plugin-dialog.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AppShell-DWNCn_-Z.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var _dirty = false;
var _listeners = [];
var dirtyStore = {
	get isDirty() {
		return _dirty;
	},
	set(val) {
		if (_dirty === val) return;
		_dirty = val;
		_listeners.forEach((fn) => fn());
	},
	subscribe(fn) {
		_listeners.push(fn);
		return () => {
			const i = _listeners.indexOf(fn);
			if (i >= 0) _listeners.splice(i, 1);
		};
	}
};
var PricingModal = ({ isOpen, onClose, onSuccess, currentStatus }) => {
	const { userData } = useAuth();
	const userEmail = userData?.email || "";
	const hwid = getHardwareFingerprint();
	const [selectedPlan, setSelectedPlan] = (0, import_react.useState)("PRO_ANNUAL");
	const [checkoutStep, setCheckoutStep] = (0, import_react.useState)("SELECT");
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [generatedKey, setGeneratedKey] = (0, import_react.useState)("");
	const [inputKey, setInputKey] = (0, import_react.useState)("");
	const [activating, setActivating] = (0, import_react.useState)(false);
	const [promoInput, setPromoInput] = (0, import_react.useState)("");
	const [appliedDiscount, setAppliedDiscount] = (0, import_react.useState)(null);
	const PROMO_CODES = {
		"MEP50": .5,
		"WELCOME20": .2,
		"FREE100": 1
	};
	const handleApplyPromo = () => {
		const code = promoInput.trim().toUpperCase();
		if (PROMO_CODES[code]) {
			setAppliedDiscount({
				code,
				percent: PROMO_CODES[code]
			});
			toast.success(`Promo code ${code} applied! ${PROMO_CODES[code] * 100}% off.`);
		} else {
			toast.error("Invalid or expired promo code.");
			setAppliedDiscount(null);
		}
	};
	if (!isOpen) return null;
	const plans = [
		{
			id: "PRO_MONTHLY",
			name: "Pro Monthly",
			tier: "PRO",
			durationDays: 30,
			price: "$29",
			billing: "per month",
			popular: false,
			features: [
				"Full access to all 25+ MEP calculation modules",
				"Clean exports without DEMO watermarks",
				"Hardware fingerprinted license seat",
				"Export to PDF, Excel, & CAD",
				"Email support"
			]
		},
		{
			id: "PRO_ANNUAL",
			name: "Pro Annual",
			tier: "PRO",
			durationDays: 365,
			price: "$249",
			billing: "per year (Save 30%)",
			popular: true,
			features: [
				"Everything in Pro Monthly",
				"Priority calculation engine speed",
				"Automatic cloud sync & team sharing",
				"Priority 24/7 dedicated support",
				"Free minor & major updates"
			]
		},
		{
			id: "ENTERPRISE",
			name: "Enterprise Multi-Seat",
			tier: "ENTERPRISE",
			durationDays: 365,
			price: "$599",
			billing: "per year / 5 Seats",
			popular: false,
			features: [
				"Up to 5 multi-device hardware seats",
				"Custom company watermark branding on exports",
				"Real-time cloud collaboration rooms",
				"Dedicated account manager",
				"Custom code standards integration"
			]
		}
	];
	const targetPlan = plans.find((p) => p.id === selectedPlan) || plans[1];
	const getFinalPrice = () => {
		const originalPrice = parseFloat(targetPlan.price.replace("$", ""));
		if (appliedDiscount) return `$${(originalPrice * (1 - appliedDiscount.percent)).toFixed(2)}`;
		return targetPlan.price;
	};
	const handleMockPayment = async () => {
		if (!userEmail) {
			toast.error("Please sign in or enter your email to bind the license key.");
			return;
		}
		setLoading(true);
		try {
			const res = await authService.checkoutPlan(userEmail, targetPlan.tier, targetPlan.durationDays, hwid);
			if (res && res.success) {
				setGeneratedKey(res.key);
				setCheckoutStep("SUCCESS");
				toast.success("Payment completed! License key generated and bound to your email.");
				if (onSuccess) onSuccess();
			} else toast.error(res.message || "Payment checkout failed. Please try again.");
		} catch (err) {
			toast.error(err.message || "Error processing checkout");
		} finally {
			setLoading(false);
		}
	};
	const handleActivateKey = async (e) => {
		e.preventDefault();
		if (!inputKey.trim()) {
			toast.error("Please enter a valid license key.");
			return;
		}
		setActivating(true);
		try {
			const res = await authService.activateLicenseKey(inputKey.trim(), userEmail, hwid);
			if (res && res.success) {
				toast.success(res.message || "License key activated successfully!");
				if (onSuccess) onSuccess();
				onClose();
			} else toast.error(res.message || "Invalid or expired license key.");
		} catch (err) {
			toast.error(err.message || "Error activating key.");
		} finally {
			setActivating(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in font-sans",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative w-full max-w-4xl bg-[#090d16] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "p-2 rounded-xl bg-primary/10 text-primary border border-primary/20",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-5" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "text-base font-bold text-white tracking-wide flex items-center gap-2",
						children: ["MEP Calculator Pro Licensing", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
							children: "HWID Fingerprinted"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-neutral-400",
						children: ["Device Fingerprint: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
							className: "font-mono text-neutral-300",
							children: [hwid.slice(0, 18), "..."]
						})]
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onClose,
					className: "p-1.5 rounded-xl border border-white/10 hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-6 overflow-y-auto flex-1 space-y-6",
				children: [
					checkoutStep === "SELECT" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-1 md:grid-cols-3 gap-4",
						children: plans.map((plan) => {
							const isSelected = selectedPlan === plan.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								onClick: () => setSelectedPlan(plan.id),
								className: `relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${isSelected ? "bg-primary/10 border-primary shadow-lg shadow-primary/10" : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"}`,
								children: [
									plan.popular && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm",
										children: "Most Popular"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-sm font-bold text-white",
												children: plan.name
											}), isSelected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4 text-primary" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-3 flex items-baseline gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-2xl font-extrabold text-white",
												children: plan.price
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs text-neutral-400",
												children: plan.billing
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
											className: "mt-4 space-y-2 text-xs text-neutral-300",
											children: plan.features.map((feat, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
												className: "flex items-start gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5 text-emerald-400 shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: feat })]
											}, idx))
										})
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: (e) => {
											e.stopPropagation();
											window.location.href = `mailto:support@tarv.ai?subject=Purchase ${plan.name} License`;
										},
										className: `mt-6 w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${isSelected ? "bg-primary text-primary-foreground hover:opacity-95" : "bg-white/10 text-white hover:bg-white/20"}`,
										children: "Contact Sales"
									})
								]
							}, plan.id);
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-4 bg-white/[0.02] border border-white/10 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { className: "size-5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "text-xs font-bold text-white",
								children: "Already have a License Key?"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-[11px] text-neutral-400",
								children: [
									"Enter your unique key (formatted ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
										className: "font-mono text-amber-300",
										children: "MEP-PRO-XXXX-XXXX-XXXX"
									}),
									") to activate."
								]
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: handleActivateKey,
							className: "flex items-center gap-2 w-full md:w-auto",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: inputKey,
								onChange: (e) => setInputKey(e.target.value),
								placeholder: "MEP-PRO-XXXX-XXXX-XXXX",
								className: "h-9 px-3 bg-black/40 border border-white/15 rounded-xl text-xs font-mono text-white placeholder:text-neutral-500 outline-none focus:border-amber-400 w-full md:w-60"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								disabled: activating,
								className: "h-9 px-4 bg-amber-500 text-black hover:bg-amber-400 font-bold text-xs rounded-xl transition cursor-pointer shrink-0 disabled:opacity-50",
								children: activating ? "Activating..." : "Activate Key"
							})]
						})]
					})] }),
					checkoutStep === "PAYMENT" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-w-xl mx-auto space-y-5 animate-fade-in",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[11px] font-semibold text-primary uppercase tracking-wider",
								children: "Selected Plan"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "text-base font-bold text-white",
								children: [
									targetPlan.name,
									" (",
									targetPlan.price,
									")"
								]
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setCheckoutStep("SELECT"),
								className: "text-xs text-neutral-400 hover:text-white underline cursor-pointer",
								children: "Change Plan"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-5 bg-white/[0.02] border border-white/10 rounded-2xl space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 border-b border-white/10 pb-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreditCard, { className: "size-4 text-emerald-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "text-xs font-bold text-white uppercase tracking-wider",
										children: "Payment Gateway (Mock Checkout)"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-[11px] font-medium text-neutral-400 mb-1",
										children: "Registered Account Email"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "email",
										value: userEmail,
										readOnly: true,
										className: "w-full h-9 px-3 bg-black/40 border border-white/10 rounded-xl text-xs text-neutral-300 font-mono"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11px] font-medium text-neutral-400 mb-1",
											children: "Card / Payment Method"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: "•••• •••• •••• 4242 (Test Gateway)",
											readOnly: true,
											className: "w-full h-9 px-3 bg-black/40 border border-white/10 rounded-xl text-xs text-neutral-300 font-mono"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11px] font-medium text-neutral-400 mb-1",
											children: "Expiry / CVV"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: "12/28 - 123",
											readOnly: true,
											className: "w-full h-9 px-3 bg-black/40 border border-white/10 rounded-xl text-xs text-neutral-300 font-mono"
										})] })]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "pt-3 border-t border-white/10 flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										value: promoInput,
										onChange: (e) => setPromoInput(e.target.value),
										placeholder: "Promo Code (e.g. MEP50)",
										className: "flex-1 h-9 px-3 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder:text-neutral-500 outline-none focus:border-primary uppercase"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: handleApplyPromo,
										className: "px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl transition cursor-pointer",
										children: "Apply"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "pt-3 border-t border-white/10 flex items-center justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Instant Unique License Binding to ", userEmail] })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: handleMockPayment,
										disabled: loading,
										className: "px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2",
										children: loading ? "Processing Payment..." : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["Complete Payment", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "bg-black/20 px-2 py-0.5 rounded text-[10px]",
											children: appliedDiscount ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "line-through text-black/50 mr-1",
												children: targetPlan.price
											}), getFinalPrice()] }) : getFinalPrice()
										})] })
									})]
								})
							]
						})]
					}),
					checkoutStep === "SUCCESS" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-w-md mx-auto text-center space-y-5 animate-fade-in py-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "size-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-8" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-lg font-bold text-white",
								children: "License Key Generated & Activated!"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-neutral-400 mt-1",
								children: [
									"Your unique non-repeatable key is bound to ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-emerald-400 font-mono",
										children: userEmail
									}),
									" and saved in Supabase."
								]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-4 bg-black/60 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-base font-mono font-bold text-emerald-400 tracking-widest",
									children: generatedKey
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => {
										navigator.clipboard.writeText(generatedKey);
										toast.success("License key copied to clipboard!");
									},
									className: "p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer",
									title: "Copy Key",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									onClose();
									if (onSuccess) onSuccess();
								},
								className: "w-full py-3 bg-primary text-primary-foreground font-bold text-xs rounded-xl transition cursor-pointer shadow-md",
								children: "Return to Calculator"
							})
						]
					})
				]
			})]
		})
	});
};
var isFeatureLocked = (path, profile) => {
	if (!path) return false;
	if (profile?.role === "SUPER_ADMIN" || profile?.role === "ORG_ADMIN") {
		if (path === "/admin" || path === "/company-hierarchy") return false;
	}
	if ([
		"",
		"/",
		"/projects",
		"/reports",
		"/teams",
		"/settings",
		"/admin",
		"/company-hierarchy",
		"/login",
		"/register"
	].includes(path)) return false;
	const routeKey = path.startsWith("/") ? path.substring(1) : path;
	const features = profile?.features || {};
	if (routeKey === "ventilation") return features.ventilation === false;
	if (path === "/cable-voltage-drop" || path === "/busbar-voltage-drop") return features.voltageDrop !== true;
	if (path === "/project-load-schedule") return features.loadSchedule !== true;
	if (path === "/cable-tray-sizing" || path === "/conductor-sizing") return features.cableSizing !== true;
	if (path === "/short-circuit-calculations") return features.shortCircuit !== true;
	return features[routeKey] !== true;
};
var DropdownMenu = Root2$1;
var DropdownMenuTrigger = Trigger$1;
var DropdownMenuRadioGroup = RadioGroup2;
var DropdownMenuSubTrigger = import_react.forwardRef(({ className, inset, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SubTrigger2$1, {
	ref,
	className: cn("flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", inset && "pl-8", className),
	...props,
	children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "ml-auto" })]
}));
DropdownMenuSubTrigger.displayName = SubTrigger2$1.displayName;
var DropdownMenuSubContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SubContent2$1, {
	ref,
	className: cn("z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)", className),
	...props
}));
DropdownMenuSubContent.displayName = SubContent2$1.displayName;
var DropdownMenuContent = import_react.forwardRef(({ className, sideOffset = 4, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal2$1, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2$1, {
	ref,
	sideOffset,
	className: cn("z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md", "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)", className),
	...props
}) }));
DropdownMenuContent.displayName = Content2$1.displayName;
var DropdownMenuItem = import_react.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item2$1, {
	ref,
	className: cn("relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0", inset && "pl-8", className),
	...props
}));
DropdownMenuItem.displayName = Item2$1.displayName;
var DropdownMenuCheckboxItem = import_react.forwardRef(({ className, children, checked, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CheckboxItem2$1, {
	ref,
	className: cn("relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className),
	checked,
	...props,
	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemIndicator2$1, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-4 w-4" }) })
	}), children]
}));
DropdownMenuCheckboxItem.displayName = CheckboxItem2$1.displayName;
var DropdownMenuRadioItem = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(RadioItem2$1, {
	ref,
	className: cn("relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className),
	...props,
	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemIndicator2$1, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Circle, { className: "h-2 w-2 fill-current" }) })
	}), children]
}));
DropdownMenuRadioItem.displayName = RadioItem2$1.displayName;
var DropdownMenuLabel = import_react.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label2$1, {
	ref,
	className: cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className),
	...props
}));
DropdownMenuLabel.displayName = Label2$1.displayName;
var DropdownMenuSeparator = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator2$1, {
	ref,
	className: cn("-mx-1 my-1 h-px bg-muted", className),
	...props
}));
DropdownMenuSeparator.displayName = Separator2$1.displayName;
var DropdownMenuShortcut = ({ className, ...props }) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("ml-auto text-xs tracking-widest opacity-60", className),
		...props
	});
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";
function VersionManager({ projectName, calculatorName = "Unknown" }) {
	const { userData } = useAuth();
	const [isModalOpen, setIsModalOpen] = (0, import_react.useState)(false);
	const [descriptionInput, setDescriptionInput] = (0, import_react.useState)("");
	const [isHistoryOpen, setIsHistoryOpen] = (0, import_react.useState)(false);
	const [historyList, setHistoryList] = (0, import_react.useState)([]);
	const gatherProjectData = () => {
		const data = {};
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && (key.startsWith("mep-") || key.startsWith("feature_"))) try {
				data[key] = JSON.parse(localStorage.getItem(key) || "null");
			} catch {
				data[key] = localStorage.getItem(key);
			}
		}
		return data;
	};
	const handleSaveAsVersion = async () => {
		const currentPath = (typeof window !== "undefined" ? window.location.pathname : "").toLowerCase().replace(/\/$/, "") || "/";
		if ([
			"/",
			"/dashboard",
			"/projects",
			"/reports",
			"/report",
			"/teams",
			"/team",
			"/admin",
			"/settings",
			"/privacy",
			"/login",
			"/calculators",
			"/reset-password"
		].some((p) => currentPath === p || currentPath.startsWith(p + "/"))) {
			toast.error("Version creation is only allowed inside HVAC, Electrical, Plumbing, and Fire Fighting calculation sections.");
			return;
		}
		if (!(typeof window !== "undefined" && "__TAURI_INTERNALS__" in window)) {
			toast.error("Version saving requires the native desktop app.");
			return;
		}
		if (!(localStorage.getItem("versionsPath") || localStorage.getItem("localBackupPath"))) {
			toast.error("Please configure a Versions Path in the Admin Panel first.");
			return;
		}
		setDescriptionInput("");
		setIsModalOpen(true);
	};
	const confirmSaveAsVersion = async () => {
		setIsModalOpen(false);
		const basePath = localStorage.getItem("versionsPath") || localStorage.getItem("localBackupPath");
		if (!basePath) {
			toast.error("Please configure a Versions Path in the Admin Panel first.");
			return;
		}
		try {
			const safeBasePath = basePath.replace(/['"]/g, "");
			const safeProjectName = projectName.replace(/[<>:"/\\|?*]/g, "_");
			const safeCalculatorName = calculatorName.replace(/[<>:"/\\|?*]/g, "_");
			const userName = userData?.name || "SystemAdmin";
			const projectDir = `${safeBasePath}\\${safeProjectName}\\${safeCalculatorName}`;
			if (!await exists(projectDir)) await mkdir(projectDir, { recursive: true });
			let nextV = 0;
			const entries = await readDir(projectDir);
			const versionRegex = /^v(\d+)\.json$/i;
			for (const entry of entries) if (entry.isFile) {
				const match = entry.name.match(versionRegex);
				if (match && match[1]) {
					const vNum = parseInt(match[1], 10);
					if (vNum >= nextV) nextV = vNum + 1;
				}
			}
			const finalFileName = `v${nextV}.json`;
			const filePath = `${projectDir}\\${finalFileName}`;
			const payload = {
				_versionMetadata: {
					version: `V${nextV}`,
					description: descriptionInput.trim() || "No description",
					user: userName,
					timestamp: (/* @__PURE__ */ new Date()).toISOString()
				},
				data: gatherProjectData()
			};
			await invoke("save_backup", {
				path: filePath,
				content: JSON.stringify(payload, null, 2)
			});
			toast.success(`Successfully saved as ${finalFileName}`);
		} catch (err) {
			console.error(err);
			toast.error(`Error: ${err.message || err}`);
		}
	};
	const loadVersionData = (data) => {
		Object.keys(data).forEach((key) => {
			if (typeof data[key] === "string") localStorage.setItem(key, data[key]);
			else localStorage.setItem(key, JSON.stringify(data[key]));
		});
		toast.success("Version loaded successfully!");
		setTimeout(() => window.location.reload(), 1500);
	};
	const handleLoadVersion = async () => {
		if (!(typeof window !== "undefined" && "__TAURI_INTERNALS__" in window)) {
			toast.error("Version loading requires the native desktop app.");
			return;
		}
		try {
			const selectedPath = await open({
				multiple: false,
				filters: [{
					name: "JSON",
					extensions: ["json"]
				}]
			});
			if (!selectedPath || typeof selectedPath !== "string") return;
			const fileContent = await readTextFile(selectedPath);
			let parsed = JSON.parse(fileContent);
			loadVersionData(parsed._versionMetadata ? parsed.data : parsed);
		} catch (err) {
			console.error(err);
			toast.error("Failed to load version.");
		}
	};
	const handleOpenHistory = async () => {
		if (!(typeof window !== "undefined" && "__TAURI_INTERNALS__" in window)) {
			toast.error("Version history requires the native desktop app.");
			return;
		}
		const basePath = localStorage.getItem("versionsPath") || localStorage.getItem("localBackupPath");
		if (!basePath) {
			toast.error("Please configure a Versions Path in the Admin Panel first.");
			return;
		}
		try {
			const projectDir = `${basePath.replace(/['"]/g, "")}\\${projectName.replace(/[<>:"/\\|?*]/g, "_")}\\${calculatorName.replace(/[<>:"/\\|?*]/g, "_")}`;
			if (!await exists(projectDir)) {
				setHistoryList([]);
				setIsHistoryOpen(true);
				return;
			}
			const entries = await readDir(projectDir);
			const versionRegex = /^v(\d+)\.json$/i;
			const historyItems = [];
			for (const entry of entries) if (entry.isFile && versionRegex.test(entry.name)) try {
				const filePath = `${projectDir}\\${entry.name}`;
				const fileContent = await readTextFile(filePath);
				const parsed = JSON.parse(fileContent);
				if (parsed._versionMetadata) historyItems.push({
					...parsed._versionMetadata,
					filePath,
					fileName: entry.name,
					parsedData: parsed.data
				});
			} catch (e) {
				console.error(`Failed to parse version file ${entry.name}`, e);
			}
			historyItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
			setHistoryList(historyItems);
			setIsHistoryOpen(true);
		} catch (err) {
			console.error(err);
			toast.error(`Error loading history: ${err.message || err}`);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					className: "flex items-center gap-2 px-4 h-10 bg-surface-2 dark:bg-white/5 border border-border dark:border-[#262626] hover:bg-surface-3 dark:hover:bg-white/10 rounded-full text-[13.5px] cursor-pointer outline-none select-none transition-all duration-150 allow-read-only",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "w-4 h-4 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold text-foreground dark:text-white",
						children: "Versions"
					})]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
				align: "end",
				className: "w-56 z-50",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuLabel, { children: "Revision Manager" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
						onClick: handleSaveAsVersion,
						className: "gap-2 cursor-pointer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "w-4 h-4 text-blue-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Save as New Version..." })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
						onClick: handleLoadVersion,
						className: "gap-2 cursor-pointer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "w-4 h-4 text-emerald-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Load Past Version (File)..." })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
						onClick: handleOpenHistory,
						className: "gap-2 cursor-pointer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { className: "w-4 h-4 text-purple-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "History" })]
					})
				]
			})] }),
			isModalOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm p-5 animate-in fade-in zoom-in-95 duration-200",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-lg font-semibold mb-4 text-foreground",
						children: "Save as New Version"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-sm font-medium text-muted-foreground mb-1.5",
							children: "Description (Optional)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							autoFocus: true,
							value: descriptionInput,
							onChange: (e) => setDescriptionInput(e.target.value),
							className: "w-full h-24 p-3 bg-surface-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none",
							placeholder: "What changed in this version?"
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex justify-end gap-3 mt-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setIsModalOpen(false),
								className: "px-4 py-2 rounded-lg text-sm font-medium hover:bg-surface-2 text-muted-foreground transition-colors",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: confirmSaveAsVersion,
								className: "px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
								children: "Save"
							})]
						})]
					})]
				})
			}),
			isHistoryOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-6 py-4 border-b border-border flex justify-between items-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-lg font-bold text-foreground",
							children: "Version History"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [
								projectName,
								" - ",
								calculatorName
							]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setIsHistoryOpen(false),
							className: "text-muted-foreground hover:text-foreground text-xl leading-none",
							children: "×"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex-1 overflow-auto p-6 bg-surface-1",
						children: historyList.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-center py-12 text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "w-12 h-12 mx-auto mb-4 opacity-20" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No versions saved yet." })]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-3",
							children: historyList.map((item, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-background border border-border rounded-xl p-4 flex gap-4 items-center hover:border-primary/30 transition-colors",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-14 h-14 shrink-0 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-lg",
										children: item.version
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex-1 min-w-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-start mb-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
												className: "font-semibold text-foreground truncate",
												children: item.description
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs text-muted-foreground whitespace-nowrap ml-2",
												children: new Date(item.timestamp).toLocaleString()
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-sm text-muted-foreground",
											children: ["Created by ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-medium text-foreground",
												children: item.user
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => {
											setIsHistoryOpen(false);
											loadVersionData(item.parsedData);
										},
										className: "px-4 py-2 shrink-0 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors",
										children: "Restore"
									})
								]
							}, idx))
						})
					})]
				})
			})
		]
	});
}
var generateSessionId = () => {
	if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
var useCollaboration = create((set, get) => ({
	currentProject: null,
	channel: null,
	activeUsers: {},
	mySessionId: generateSessionId(),
	myEmail: "unknown",
	myName: "Unknown User",
	pendingModule: null,
	isSubscribed: false,
	onDataReceived: null,
	joinProject: (projectName, email, name) => {
		const existingChannel = get().channel;
		if (existingChannel) existingChannel.unsubscribe();
		const channel = supabase.channel(`project:${projectName}`, { config: { presence: { key: get().mySessionId } } });
		channel.on("presence", { event: "sync" }, () => {
			const state = channel.presenceState();
			const activeUsers = {};
			for (const [key, presences] of Object.entries(state)) if (presences.length > 0) activeUsers[key] = presences[0];
			set({ activeUsers });
		}).on("broadcast", { event: "module_update" }, (payload) => {
			const onDataReceived = get().onDataReceived;
			if (onDataReceived) onDataReceived(payload.payload.module, payload.payload.data);
		}).subscribe(async (status) => {
			if (status === "SUBSCRIBED") {
				set({
					isSubscribed: true,
					myEmail: email,
					myName: name || email
				});
				const pending = get().pendingModule;
				await channel.track({
					user_email: email,
					user_name: name || email,
					session_id: get().mySessionId,
					active_module: pending,
					joined_module_at: pending ? Date.now() : 0
				});
			}
		});
		set({
			currentProject: projectName,
			channel
		});
	},
	leaveProject: () => {
		const { channel } = get();
		if (channel) supabase.removeChannel(channel);
		set({
			currentProject: null,
			channel: null,
			activeUsers: {},
			isSubscribed: false,
			pendingModule: null
		});
	},
	setActiveModule: async (moduleName) => {
		const { channel, isSubscribed, myEmail, mySessionId } = get();
		set({ pendingModule: moduleName });
		if (channel && isSubscribed) try {
			await channel.track({
				user_email: myEmail,
				user_name: get().myName,
				session_id: mySessionId,
				active_module: moduleName,
				joined_module_at: moduleName ? Date.now() : 0
			});
		} catch (e) {
			console.error("Failed to track active module", e);
		}
	},
	getLockOwner: (moduleName) => {
		const { activeUsers } = get();
		let oldestUser = null;
		for (const [key, state] of Object.entries(activeUsers)) if (state.active_module === moduleName) if (!oldestUser) oldestUser = state;
		else {
			const timeA = state.joined_module_at || 0;
			const timeB = oldestUser.joined_module_at || 0;
			if (timeA < timeB) oldestUser = state;
			else if (timeA === timeB && state.session_id < oldestUser.session_id) oldestUser = state;
		}
		if (oldestUser) return {
			email: oldestUser.user_email,
			sessionId: oldestUser.session_id,
			name: oldestUser.user_name
		};
		return null;
	},
	broadcastData: (moduleName, data) => {
		const channel = get().channel;
		if (channel) channel.send({
			type: "broadcast",
			event: "module_update",
			payload: {
				module: moduleName,
				data
			}
		});
	},
	setOnDataReceived: (callback) => {
		set({ onDataReceived: callback });
	}
}));
async function fetchLicenseStatus(email) {
	try {
		const hwid = getHardwareFingerprint();
		const res = await authService.getLicenseStatus(hwid, email);
		if (res && res.sessionInvalidated) return {
			plan: "FREE",
			status: "UNLICENSED",
			remainingDays: 0,
			watermark: "SESSION_INVALIDATED",
			sessionInvalidated: true
		};
		if (res && res.success) return {
			plan: res.plan || "FREE",
			status: res.status || "FREE_TRIAL",
			key: res.key,
			expiresAt: res.expiresAt,
			remainingDays: res.remainingDays ?? 0,
			watermark: res.watermark || "FREE TRIAL"
		};
	} catch (err) {}
	return {
		plan: "FREE",
		status: "UNLICENSED",
		remainingDays: 0,
		watermark: "UNLICENSED / DEMO VERSION"
	};
}
function WelcomeToTarvModal({ isOpen, onClose, userName, pioneerNumber }) {
	const canvasRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!isOpen) return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		let animationFrameId;
		let width = canvas.width = canvas.offsetWidth;
		let height = canvas.height = canvas.offsetHeight;
		const particles = [];
		const colors = [
			"#f59e0b",
			"#fbbf24",
			"#3b82f6",
			"#ec4899",
			"#8b5cf6",
			"#10b981"
		];
		for (let i = 0; i < 70; i++) particles.push({
			x: Math.random() * width,
			y: Math.random() * height * .5,
			size: Math.random() * 7 + 4,
			color: colors[Math.floor(Math.random() * colors.length)],
			speedX: (Math.random() - .5) * 4,
			speedY: Math.random() * 3 + 2,
			spin: Math.random() * 360,
			spinSpeed: (Math.random() - .5) * 6,
			opacity: Math.random() * .8 + .2
		});
		const render = () => {
			ctx.clearRect(0, 0, width, height);
			particles.forEach((p) => {
				p.x += p.speedX;
				p.y += p.speedY;
				p.spin += p.spinSpeed;
				if (p.y > height) {
					p.y = -10;
					p.x = Math.random() * width;
				}
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.spin * Math.PI / 180);
				ctx.globalAlpha = p.opacity;
				ctx.fillStyle = p.color;
				ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
				ctx.restore();
			});
			animationFrameId = requestAnimationFrame(render);
		};
		render();
		return () => {
			cancelAnimationFrame(animationFrameId);
		};
	}, [isOpen]);
	if (!isOpen) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative w-full max-w-xl bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl shadow-amber-500/10 overflow-hidden text-slate-100 font-sans",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
					ref: canvasRef,
					className: "absolute inset-0 pointer-events-none w-full h-full z-0 opacity-80"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute -top-24 -left-24 w-60 h-60 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute -bottom-24 -right-24 w-60 h-60 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onClose,
					className: "absolute top-4 right-4 z-30 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-full transition cursor-pointer",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-5 h-5" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative z-10 p-8 text-center flex flex-col items-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-300 text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-amber-500/10 mb-4 animate-bounce",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trophy, { className: "w-4 h-4 text-amber-400" }),
								"Founding Pioneer #",
								pioneerNumber,
								" of 50"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative my-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/20 transform rotate-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rocket, { className: "w-10 h-10 text-slate-950 -rotate-12" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "absolute -top-2 -right-2 bg-yellow-400 p-1.5 rounded-full text-slate-950 shadow-md",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: "w-4 h-4 fill-slate-950" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-400 mt-2",
							children: "Welcome to TARV 🚀"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-semibold text-amber-400/90 mt-1",
							children: "Official Launch Early Pioneer"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-5 p-5 bg-slate-800/70 border border-amber-500/20 rounded-2xl text-xs text-slate-300 leading-relaxed text-center backdrop-blur-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-slate-200 font-medium",
								children: [
									"Hello ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
										className: "text-amber-300 font-bold",
										children: userName || "Engineer"
									}),
									"!"
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2",
								children: [
									"You are officially one of our first ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-amber-400 font-bold underline decoration-amber-500/40 underline-offset-4",
										children: "50 Founding Pioneers"
									}),
									" starting the journey with ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
										className: "text-white",
										children: "TARV MEP Engine"
									}),
									"! Your early trust and leadership power the future of our engineering platform. We are thrilled to have you lead the way!"
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-3 gap-3 w-full mt-5 text-left text-[11px]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-amber-400 font-bold flex items-center gap-1 mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "w-3.5 h-3.5" }), " Fast Sizing"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-400",
										children: "Duct, Chilled Water, Busbar & Pipes"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-blue-400 font-bold flex items-center gap-1 mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "w-3.5 h-3.5" }), " Org Backup"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-400",
										children: "Cloud & Local Server Auto-Sync"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-emerald-400 font-bold flex items-center gap-1 mb-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheckBig, { className: "w-3.5 h-3.5" }), " PDF Reports"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-400",
										children: "Branded Exports with 1 Click"
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: onClose,
							className: "w-full mt-6 py-3.5 px-6 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/20 transition transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rocket, { className: "w-4 h-4" }), "Start Journey with TARV"]
						})
					]
				})
			]
		})
	});
}
var ContextMenu = Root2;
var ContextMenuTrigger = Trigger;
var ContextMenuSubTrigger = import_react.forwardRef(({ className, inset, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SubTrigger2, {
	ref,
	className: cn("flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground", inset && "pl-8", className),
	...props,
	children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "ml-auto h-4 w-4" })]
}));
ContextMenuSubTrigger.displayName = SubTrigger2.displayName;
var ContextMenuSubContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SubContent2, {
	ref,
	className: cn("z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-context-menu-content-transform-origin)", className),
	...props
}));
ContextMenuSubContent.displayName = SubContent2.displayName;
var ContextMenuContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal2, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	className: cn("z-50 max-h-(--radix-context-menu-content-available-height) min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-context-menu-content-transform-origin)", className),
	...props
}) }));
ContextMenuContent.displayName = Content2.displayName;
var ContextMenuItem = import_react.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item2, {
	ref,
	className: cn("relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", inset && "pl-8", className),
	...props
}));
ContextMenuItem.displayName = Item2.displayName;
var ContextMenuCheckboxItem = import_react.forwardRef(({ className, children, checked, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CheckboxItem2, {
	ref,
	className: cn("relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className),
	checked,
	...props,
	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemIndicator2, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-4 w-4" }) })
	}), children]
}));
ContextMenuCheckboxItem.displayName = CheckboxItem2.displayName;
var ContextMenuRadioItem = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(RadioItem2, {
	ref,
	className: cn("relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className),
	...props,
	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemIndicator2, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Circle, { className: "h-4 w-4 fill-current" }) })
	}), children]
}));
ContextMenuRadioItem.displayName = RadioItem2.displayName;
var ContextMenuLabel = import_react.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label2, {
	ref,
	className: cn("px-2 py-1.5 text-sm font-semibold text-foreground", inset && "pl-8", className),
	...props
}));
ContextMenuLabel.displayName = Label2.displayName;
var ContextMenuSeparator = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator2, {
	ref,
	className: cn("-mx-1 my-1 h-px bg-border", className),
	...props
}));
ContextMenuSeparator.displayName = Separator2.displayName;
var ContextMenuShortcut = ({ className, ...props }) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("ml-auto text-xs tracking-widest text-muted-foreground", className),
		...props
	});
};
ContextMenuShortcut.displayName = "ContextMenuShortcut";
function getSections(children) {
	const sections = [];
	let currentSection = {
		header: "",
		items: []
	};
	children.forEach((c) => {
		if (c.isHeader) {
			if (currentSection.items.length > 0 || currentSection.header) sections.push(currentSection);
			currentSection = {
				header: c.label,
				items: []
			};
		} else currentSection.items.push(c);
	});
	if (currentSection.items.length > 0 || currentSection.header) sections.push(currentSection);
	return sections;
}
var setReactInputValue = (el, value) => {
	const descriptor = Object.getOwnPropertyDescriptor(el, "value");
	const prototype = Object.getPrototypeOf(el);
	const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, "value");
	if (prototypeDescriptor && prototypeDescriptor.set) prototypeDescriptor.set.call(el, value);
	else if (descriptor && descriptor.set) descriptor.set.call(el, value);
	else el.value = value;
};
var setReactCheckboxValue = (el, checked) => {
	const descriptor = Object.getOwnPropertyDescriptor(el, "checked");
	const prototype = Object.getPrototypeOf(el);
	const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, "checked");
	if (prototypeDescriptor && prototypeDescriptor.set) prototypeDescriptor.set.call(el, checked);
	else if (descriptor && descriptor.set) descriptor.set.call(el, checked);
	else el.checked = checked;
};
var setReactSelectValue = (el, value) => {
	const descriptor = Object.getOwnPropertyDescriptor(el, "value");
	const prototype = Object.getPrototypeOf(el);
	const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, "value");
	if (prototypeDescriptor && prototypeDescriptor.set) prototypeDescriptor.set.call(el, value);
	else if (descriptor && descriptor.set) descriptor.set.call(el, value);
	else el.value = value;
};
var getElementKey = (el, index) => {
	const id = el.id;
	if (id) return `id:${id}`;
	const name = el.getAttribute("name");
	if (name) return `name:${name}`;
	const placeholder = el.getAttribute("placeholder");
	if (placeholder) return `placeholder:${placeholder}_${index}`;
	return `idx:${el.tagName.toLowerCase()}_${index}`;
};
var EXCLUDED_PERSIST_PATHS = [
	"/",
	"/projects",
	"/reports",
	"/settings",
	"/3d-view",
	"/calculators",
	"/plumbing-fixture-unit",
	"/plumbing-loading-unit",
	"/plumbing-pump-sizing",
	"/plumbing-sprinkler-kfactor",
	"/plumbing-supply-pipe-sizer",
	"/plumbing-water-demand",
	"/lobby-pressurisation",
	"/smoke-extract-fan",
	"/staircase-pressurization",
	"/basement-smoke-calc",
	"/condensate-drain-calc",
	"/plumbing-pressure-vessel",
	"/plumbing-storm-water"
];
var NON_VERSION_PATHS = [
	"/",
	"/dashboard",
	"/projects",
	"/reports",
	"/report",
	"/teams",
	"/team",
	"/admin",
	"/settings",
	"/privacy",
	"/login",
	"/calculators",
	"/reset-password"
];
var savePageInputs = (projectId, pathname) => {
	if (typeof document === "undefined") return;
	if (EXCLUDED_PERSIST_PATHS.includes(pathname)) return;
	const inputs = Array.from(document.querySelectorAll("input, select, textarea"));
	const state = {};
	inputs.forEach((el, index) => {
		if (el.closest("aside") || el.closest("header") || el.closest("[data-ignore-persist]")) return;
		const key = getElementKey(el, index);
		if (el instanceof HTMLInputElement) if (el.type === "checkbox" || el.type === "radio") state[key] = {
			checked: el.checked,
			type: el.type
		};
		else state[key] = {
			value: el.value,
			type: el.type
		};
		else if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) state[key] = {
			value: el.value,
			type: el.tagName.toLowerCase()
		};
	});
	localStorage.setItem(`mep_auto_state_${projectId}_${pathname}`, JSON.stringify(state));
	useCollaboration.getState().broadcastData(pathname, state);
};
var applyLiveData = (state) => {
	if (typeof document === "undefined") return;
	const inputs = Array.from(document.querySelectorAll("input, select, textarea"));
	window.__mep_is_restoring = true;
	inputs.forEach((el, index) => {
		if (el.closest("aside") || el.closest("header") || el.closest("[data-ignore-persist]")) return;
		const savedVal = state[getElementKey(el, index)];
		if (!savedVal) return;
		if (el instanceof HTMLInputElement) {
			if (el.type === "checkbox" || el.type === "radio") {
				if (el.checked !== savedVal.checked) {
					setReactCheckboxValue(el, savedVal.checked);
					el.dispatchEvent(new Event("change", { bubbles: true }));
				}
			} else if (el.value !== savedVal.value) {
				setReactInputValue(el, savedVal.value);
				el.dispatchEvent(new Event("input", { bubbles: true }));
				el.dispatchEvent(new Event("change", { bubbles: true }));
			}
		} else if (el instanceof HTMLTextAreaElement) {
			if (el.value !== savedVal.value) {
				setReactInputValue(el, savedVal.value);
				el.dispatchEvent(new Event("input", { bubbles: true }));
				el.dispatchEvent(new Event("change", { bubbles: true }));
			}
		} else if (el instanceof HTMLSelectElement) {
			if (el.value !== savedVal.value) {
				setReactSelectValue(el, savedVal.value);
				el.dispatchEvent(new Event("change", { bubbles: true }));
			}
		}
	});
	setTimeout(() => {
		window.__mep_is_restoring = false;
	}, 100);
};
var restorePageInputs = (projectId, pathname) => {
	if (typeof document === "undefined") return;
	if (EXCLUDED_PERSIST_PATHS.includes(pathname)) return;
	const saved = localStorage.getItem(`mep_auto_state_${projectId}_${pathname}`);
	if (!saved) return;
	let state = {};
	try {
		state = JSON.parse(saved);
	} catch (e) {
		return;
	}
	const inputs = Array.from(document.querySelectorAll("input, select, textarea"));
	window.__mep_is_restoring = true;
	inputs.forEach((el, index) => {
		if (el.closest("aside") || el.closest("header") || el.closest("[data-ignore-persist]")) return;
		if (el instanceof HTMLInputElement && el.type === "file") return;
		const key = getElementKey(el, index);
		const savedVal = state[key];
		if (!savedVal) return;
		if (el instanceof HTMLInputElement) {
			if (el.type === "checkbox" || el.type === "radio") {
				if (el.checked !== savedVal.checked) {
					setReactCheckboxValue(el, savedVal.checked);
					el.dispatchEvent(new Event("change", { bubbles: true }));
				}
			} else if (el.value !== savedVal.value) {
				setReactInputValue(el, savedVal.value);
				el.dispatchEvent(new Event("input", { bubbles: true }));
				el.dispatchEvent(new Event("change", { bubbles: true }));
			}
		} else if (el instanceof HTMLTextAreaElement) {
			if (el.value !== savedVal.value) {
				setReactInputValue(el, savedVal.value);
				el.dispatchEvent(new Event("input", { bubbles: true }));
				el.dispatchEvent(new Event("change", { bubbles: true }));
			}
		} else if (el instanceof HTMLSelectElement) {
			if (el.value !== savedVal.value) {
				setReactSelectValue(el, savedVal.value);
				el.dispatchEvent(new Event("change", { bubbles: true }));
			}
		}
	});
	setTimeout(() => {
		window.__mep_is_restoring = false;
	}, 100);
};
var triggerSave = () => {
	if (typeof document === "undefined") return false;
	const pathname = window.location.pathname;
	const calcTitle = getCalculatorTitleFromPath(pathname) || "Ventilation";
	logCalculatorUpdate(calcTitle, `Saved changes in ${calcTitle}`);
	const saveBtn = Array.from(document.querySelectorAll("button")).find((btn) => {
		const txt = btn.textContent || "";
		return txt.toLowerCase().includes("save current") || txt.toLowerCase().includes("save calculation");
	});
	if (saveBtn) {
		saveBtn.click();
		return true;
	}
	toast.success("Calculation saved to project successfully!");
	return true;
};
var globalLicenseCache = null;
function AppShell({ children, title, subtitle, actions, onIntelClick, intelOpen, intelLabel, hideSubHeader, breadcrumb, spaceCount }) {
	const { profile, userData, logout, loading } = useAuth();
	const userId = userData?.id || profile?.id;
	const userPhoto = userData?.profile_photo || profile?.profile_photo || (userId && typeof window !== "undefined" ? localStorage.getItem(`mep_profile_photo_${userId}`) || "" : "");
	const confirm = useConfirm();
	const prompt = usePrompt();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const isVersionAllowed = (0, import_react.useMemo)(() => {
		const cleanPath = (pathname || "").toLowerCase().replace(/\/$/, "") || "/";
		return !NON_VERSION_PATHS.some((nonPath) => cleanPath === nonPath || cleanPath.startsWith(nonPath + "/"));
	}, [pathname]);
	const activeName = useRouterState({ select: (s) => s.location.search })?.name;
	const navigate = useNavigate();
	const { project, projects, selectProject, refreshProjects, deleteProject, duplicateProject, updateProject, isReadOnly, setReadOnly, saveAsRevision, forceSaveToCloud, syncFromCloud, isInitializing, spaces, zones, equipment } = useWorkspace();
	const { joinProject, leaveProject, setActiveModule, getLockOwner, mySessionId } = useCollaboration();
	useCollaboration((s) => s.activeUsers);
	const [myEmail, setMyEmail] = (0, import_react.useState)("unknown");
	const [pricingModalOpen, setPricingModalOpen] = (0, import_react.useState)(false);
	const [licenseInfo, setLicenseInfo] = (0, import_react.useState)(globalLicenseCache);
	const [showPioneerModal, setShowPioneerModal] = (0, import_react.useState)(false);
	const [notifTick, setNotifTick] = (0, import_react.useState)(0);
	const rawRole = profile?.designation || profile?.role || "";
	const isSrDesignEngineer = /senior|sr|lead|manager/i.test(rawRole);
	const isCoordinatorOrAdmin = /coordinator|admin/i.test(rawRole);
	const isJrDesignEngineer = !isSrDesignEngineer && !isCoordinatorOrAdmin;
	const myNotifications = (0, import_react.useMemo)(() => {
		if (!userId) return [];
		const notifs = [];
		const addNotifs = (items, typeName, projectName, projectId) => {
			if (!items) return;
			items.forEach((item) => {
				if (item.comments && Array.isArray(item.comments)) item.comments.forEach((c) => {
					if (c.assignedUsers?.includes(userId)) notifs.push({
						...c,
						targetId: item.id,
						targetName: item.name || item.id,
						targetType: typeName,
						projectName,
						projectId,
						calculatorPath: "/ventilation"
					});
				});
			});
		};
		projects.forEach((p) => {
			const wdata = p.workspace_data || {};
			addNotifs(wdata.spaces, "Space", p.name, p.id);
			addNotifs(wdata.zones, "Zone", p.name, p.id);
			addNotifs(wdata.equipment, "Equipment", p.name, p.id);
		});
		const isUserMemberOfProject = (targetProjectId) => {
			if (!targetProjectId || targetProjectId === "none") return false;
			const proj = projects.find((p) => p.id === targetProjectId);
			if (!proj) return false;
			const currentId = userId || userData?.id;
			const currentName = (userData?.name || profile?.name || "").toLowerCase().trim();
			const currentEmail = (userData?.email || profile?.email || "").toLowerCase().trim();
			if (proj.created_by === currentId) return true;
			if (Array.isArray(proj.project_users)) {
				if (proj.project_users.some((pu) => pu.user_id === currentId || pu.user?.email && pu.user.email.toLowerCase().trim() === currentEmail)) return true;
			}
			if (Array.isArray(proj.members)) {
				if (proj.members.some((m) => m.id === currentId || m.name && m.name.toLowerCase().trim() === currentName || m.email && m.email.toLowerCase().trim() === currentEmail)) return true;
			}
			const wdata = proj.workspace_data || {};
			if (Array.isArray(wdata.assigned_users)) {
				if (wdata.assigned_users.some((u) => {
					const uStr = String(u).toLowerCase().trim();
					return uStr === String(currentId).toLowerCase() || uStr === currentName || uStr === currentEmail;
				})) return true;
			}
			return false;
		};
		if (isSrDesignEngineer || isCoordinatorOrAdmin) try {
			const savedRejections = typeof localStorage !== "undefined" ? localStorage.getItem("mep_calc_rejection_notifs") : null;
			if (savedRejections) {
				const parsed = JSON.parse(savedRejections);
				if (Array.isArray(parsed)) parsed.forEach((rn) => {
					if (rn.projectId && isUserMemberOfProject(rn.projectId)) {
						const targetProj = projects.find((p) => p.id === rn.projectId);
						notifs.push({
							id: rn.id,
							authorName: rn.rejectedBy || rn.authorName || "Discipline Coordinator",
							text: `🚨 CALCULATION REJECTED (${rn.calculatorTitle || "Calculation"}): "${rn.reason}"`,
							timestamp: rn.timestamp,
							targetType: "Calculation",
							targetName: rn.calculatorTitle || "Calculation",
							projectName: targetProj?.name || rn.projectName || "Project",
							projectId: rn.projectId,
							calculatorPath: rn.calculatorPath || "/ventilation",
							targetId: rn.id
						});
					}
				});
			}
		} catch (e) {}
		if (isJrDesignEngineer || isCoordinatorOrAdmin) try {
			const savedJrNotifs = typeof localStorage !== "undefined" ? localStorage.getItem("mep_calc_jr_engineer_notifs") : null;
			if (savedJrNotifs) {
				const parsed = JSON.parse(savedJrNotifs);
				if (Array.isArray(parsed)) parsed.forEach((jn) => {
					if (jn.projectId && isUserMemberOfProject(jn.projectId)) {
						const targetProj = projects.find((p) => p.id === jn.projectId);
						notifs.push({
							id: jn.id,
							authorName: jn.reviewerName || "Sr. Design Engineer",
							text: `📝 REVISION INSTRUCTIONS (${jn.calculatorTitle || "Calculation"}): "${jn.comments}"`,
							timestamp: jn.timestamp,
							targetType: "Calculation",
							targetName: jn.calculatorTitle || "Calculation",
							projectName: targetProj?.name || jn.projectName || "Project",
							projectId: jn.projectId,
							calculatorPath: jn.calculatorPath || "/ventilation",
							targetId: jn.id
						});
					}
				});
			}
		} catch (e) {}
		notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
		return notifs;
	}, [
		userId,
		userData,
		profile,
		projects,
		notifTick,
		isSrDesignEngineer,
		isJrDesignEngineer,
		isCoordinatorOrAdmin
	]);
	(0, import_react.useEffect)(() => {
		const handleNotifAdded = () => setNotifTick((t) => t + 1);
		const handleReviewStateUpdate = (e) => {
			setNotifTick((t) => t + 1);
			const notifProjectId = e?.detail?.projectId;
			const isMember = () => {
				if (!notifProjectId) return true;
				const proj = projects.find((p) => p.id === notifProjectId);
				if (!proj) return false;
				const cId = userId || userData?.id;
				const cName = (userData?.name || profile?.name || "").toLowerCase().trim();
				const cEmail = (userData?.email || profile?.email || "").toLowerCase().trim();
				if (proj.created_by === cId) return true;
				if (Array.isArray(proj.project_users) && proj.project_users.some((pu) => pu.user_id === cId || pu.user?.email?.toLowerCase() === cEmail)) return true;
				if (Array.isArray(proj.members) && proj.members.some((m) => m.id === cId || m.name?.toLowerCase().trim() === cName || m.email?.toLowerCase().trim() === cEmail)) return true;
				const wdata = proj.workspace_data || {};
				if (Array.isArray(wdata.assigned_users) && wdata.assigned_users.some((u) => String(u).toLowerCase().trim() === String(cId).toLowerCase() || String(u).toLowerCase().trim() === cName || String(u).toLowerCase().trim() === cEmail)) return true;
				return false;
			};
			if (!isMember()) return;
			if (e?.detail?.status === "REJECTED" && (isSrDesignEngineer || isCoordinatorOrAdmin)) toast.error(`⚠️ CALCULATION REJECTED: Reason from ${e.detail.rejectedBy || "Discipline Coordinator"}: "${e.detail.rejectionDescription || "Revision required"}"`, { duration: 7e3 });
			if (e?.detail?.status === "SR_REVIEW_SUBMITTED" && (isJrDesignEngineer || isCoordinatorOrAdmin)) toast.info(`📝 REVISION REQUIRED: Notes from Sr. Design Engineer (${e.detail.reviewedBy}): "${e.detail.reviewerComments}"`, { duration: 7e3 });
		};
		if (typeof window !== "undefined") {
			window.addEventListener("mep-notification-added", handleNotifAdded);
			window.addEventListener("mep-review-state-updated", handleReviewStateUpdate);
		}
		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener("mep-notification-added", handleNotifAdded);
				window.removeEventListener("mep-review-state-updated", handleReviewStateUpdate);
			}
		};
	}, [
		userId,
		userData,
		profile,
		projects,
		isSrDesignEngineer,
		isJrDesignEngineer,
		isCoordinatorOrAdmin
	]);
	(0, import_react.useEffect)(() => {
		if (!userId) return;
		const interval = setInterval(() => {
			refreshProjects();
		}, 3e3);
		return () => clearInterval(interval);
	}, [userId, refreshProjects]);
	(0, import_react.useEffect)(() => {
		if (userData?.is_founding_pioneer && userId) {
			if (!localStorage.getItem(`tarv_pioneer_welcome_shown_${userId}`)) setShowPioneerModal(true);
		}
	}, [
		userData?.is_founding_pioneer,
		userData?.pioneer_number,
		userId
	]);
	(0, import_react.useEffect)(() => {
		if (!userId) return;
		const interval = setInterval(async () => {
			const res = await authService.getUserData();
			if (res && res.success === false && res.message && !res.message.includes("Network Error")) {
				toast.error("Your account has been deleted or deactivated by an administrator.");
				logout();
				navigate({ to: "/login" });
			}
		}, 5e3);
		return () => clearInterval(interval);
	}, [
		userId,
		logout,
		navigate
	]);
	const refreshLicenseStatus = (0, import_react.useCallback)(async () => {
		if (loading) return;
		const hwid = getHardwareFingerprint();
		const userEmail = userData?.email || myEmail;
		if (!userData || userData.role !== "ORG_USER" && userData.role !== "ORG_ADMIN" && userData.role !== "SUPER_ADMIN") await authService.initHardwareTrial(hwid, userEmail);
		const status = await fetchLicenseStatus(userEmail);
		if (status.sessionInvalidated) {
			toast.error("Your session has been transferred to another device. You are now logged out.");
			logout();
			navigate({ to: "/login" });
			return;
		}
		globalLicenseCache = status;
		setLicenseInfo(status);
	}, [
		userData?.email,
		userData?.role,
		myEmail,
		loading,
		logout,
		navigate
	]);
	(0, import_react.useEffect)(() => {
		refreshLicenseStatus();
	}, [refreshLicenseStatus]);
	const [announcement, setAnnouncement] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const fetchActiveAnnouncement = async () => {
			const activeAnnouncements = (await api.getAnnouncements()).filter((a) => a.is_active);
			if (activeAnnouncements && activeAnnouncements.length > 0) {
				const target = activeAnnouncements[0];
				if (!(typeof localStorage !== "undefined" ? localStorage.getItem(`tarv_dismissed_announcement_${target.id}`) : null)) setAnnouncement(target);
			}
		};
		fetchActiveAnnouncement();
	}, []);
	(0, import_react.useEffect)(() => {
		if (profile?.id && pathname && pathname !== "/" && pathname !== "/login") logCalculatorView(pathname.replace("/", "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Dashboard", pathname);
	}, [pathname, profile?.id]);
	(0, import_react.useEffect)(() => {
		if (project?.id && typeof localStorage !== "undefined") {
			localStorage.setItem("mep_active_project_id", project.id);
			localStorage.setItem("mep_last_worked_project_id", project.id);
		}
	}, [project?.id]);
	(0, import_react.useEffect)(() => {
		const initCollab = async () => {
			const { data } = await supabase.auth.getSession();
			const userEmail = data.session?.user.email || "unknown";
			const userName = userData?.name || profile?.name || userEmail;
			setMyEmail(userEmail);
			if (project?.id) joinProject(project.id, userEmail, userName);
		};
		initCollab();
		return () => {
			leaveProject();
		};
	}, [
		project?.id,
		userData?.name,
		profile?.name
	]);
	(0, import_react.useEffect)(() => {
		if (typeof window !== "undefined") window.currentMepUserName = userData?.name || profile?.name || "System Admin";
	}, [userData?.name, profile?.name]);
	(0, import_react.useEffect)(() => {
		if (pathname && !EXCLUDED_PERSIST_PATHS.includes(pathname)) setActiveModule(pathname);
		else setActiveModule(null);
		if (!(userData?.privacyPolicyAccepted === true || typeof window !== "undefined" && localStorage.getItem("privacy_policy_accepted") === "true") && pathname !== "/login" && pathname !== "/privacy") navigate({ to: "/privacy" });
	}, [
		pathname,
		navigate,
		userData?.privacyPolicyAccepted
	]);
	const lockOwnerObj = getLockOwner(pathname);
	const isLockedByOther = lockOwnerObj && lockOwnerObj.sessionId !== mySessionId;
	const lockOwnerName = lockOwnerObj ? lockOwnerObj.name || lockOwnerObj.email : "Unknown";
	(0, import_react.useEffect)(() => {
		const runRestore = () => {
			restorePageInputs(project.id, pathname);
		};
		runRestore();
		const t1 = setTimeout(runRestore, 100);
		const t2 = setTimeout(runRestore, 300);
		const t3 = setTimeout(runRestore, 600);
		const t4 = setTimeout(runRestore, 1200);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
			clearTimeout(t3);
			clearTimeout(t4);
		};
	}, [pathname, project.id]);
	(0, import_react.useEffect)(() => {
		const handleUserEdit = (e) => {
			if (window.__mep_is_restoring) return;
			const target = e.target;
			if (!target) return;
			if (target.closest("aside") || target.closest("header") || target.closest("[data-ignore-persist]")) return;
			try {
				if (project?.id) savePageInputs(project.id, pathname);
			} catch (err) {}
			const calcTitle = getCalculatorTitleFromPath(pathname);
			if (calcTitle) logCalculatorUpdate(calcTitle, `Changes occurred in ${calcTitle}`);
		};
		document.addEventListener("input", handleUserEdit, true);
		document.addEventListener("change", handleUserEdit, true);
		document.addEventListener("keyup", handleUserEdit, true);
		document.addEventListener("click", handleUserEdit, true);
		return () => {
			document.removeEventListener("input", handleUserEdit, true);
			document.removeEventListener("change", handleUserEdit, true);
			document.removeEventListener("keyup", handleUserEdit, true);
			document.removeEventListener("click", handleUserEdit, true);
		};
	}, [pathname, project?.id]);
	const setOnDataReceived = useCollaboration((s) => s.setOnDataReceived);
	(0, import_react.useEffect)(() => {
		setOnDataReceived((moduleName, data) => {
			if (pathname === moduleName) applyLiveData(data);
		});
	}, [pathname, setOnDataReceived]);
	const [sidebarOpen, setSidebarOpen] = (0, import_react.useState)(() => {
		if (typeof window !== "undefined") return localStorage.getItem("mep-sidebar-open") !== "false";
		return true;
	});
	(0, import_react.useEffect)(() => {
		localStorage.setItem("mep-sidebar-open", String(sidebarOpen));
	}, [sidebarOpen]);
	const isLinkActive = (to) => {
		if (!to) return false;
		if (to.includes("?")) {
			const parts = to.split("?");
			const path = parts[0];
			const nameVal = new URLSearchParams(parts[1]).get("name");
			return pathname === path && activeName === nameVal;
		}
		return pathname === to;
	};
	const [hoveredGroup, setHoveredGroup] = (0, import_react.useState)(null);
	const handleGroupClick = (e, item) => {
		e.stopPropagation();
		if (hoveredGroup && hoveredGroup.item.label === item.label) setHoveredGroup(null);
		else setHoveredGroup({
			item,
			top: e.currentTarget.getBoundingClientRect().top
		});
	};
	(0, import_react.useEffect)(() => {
		if (!hoveredGroup) return;
		const handleOutsideClick = (e) => {
			const target = e.target;
			if (!target.closest(".fixed") && !target.closest(".nav-group-btn")) setHoveredGroup(null);
		};
		document.addEventListener("mousedown", handleOutsideClick);
		return () => document.removeEventListener("mousedown", handleOutsideClick);
	}, [hoveredGroup]);
	const [unitModalOpen, setUnitModalOpen] = (0, import_react.useState)(false);
	const [pendingUnitToggle, setPendingUnitToggle] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const handleCaptureClick = (e) => {
			if (window.__mep_bypass_unit_prompt) return;
			const btn = e.target?.closest("button");
			if (!btn) return;
			const text = (btn.textContent || "").trim();
			const isSiToggle = /\bmetric\b|\bsi\b/i.test(text);
			const isIpToggle = /\bimperial\b|\bip\b/i.test(text);
			if (!isSiToggle && !isIpToggle) return;
			const targetSystem = isSiToggle ? "si" : "ip";
			if (btn.classList.contains("bg-white") || btn.classList.contains("bg-[#0A7BC7]") || btn.classList.contains("bg-red-600") || btn.classList.contains("bg-primary") || btn.getAttribute("aria-pressed") === "true" || btn.getAttribute("data-state") === "on") return;
			e.stopPropagation();
			e.preventDefault();
			setPendingUnitToggle({
				button: btn,
				targetSystem
			});
			setUnitModalOpen(true);
		};
		document.addEventListener("click", handleCaptureClick, true);
		return () => {
			document.removeEventListener("click", handleCaptureClick, true);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			if ((navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? e.metaKey : e.ctrlKey) && (e.key === "s" || e.key === "S")) {
				e.preventDefault();
				if (isReadOnly || isLockedByOther) {
					toast.error("Cannot save. Workspace is in Read-Only mode.");
					return;
				}
				if (project?.id) {
					savePageInputs(project.id, pathname);
					triggerSave();
					forceSaveToCloud();
					const calcTitle = getCalculatorTitleFromPath(pathname) || "Ventilation";
					logCalculatorUpdate(calcTitle, `Saved changes in ${calcTitle}`);
					toast.success("Calculations synced to cloud successfully!");
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [
		project?.id,
		pathname,
		isReadOnly,
		isLockedByOther
	]);
	(0, import_react.useEffect)(() => {
		const isEffectiveReadOnly = isReadOnly || isLockedByOther;
		window.__mep_is_readonly = isEffectiveReadOnly;
		if (!isEffectiveReadOnly) return;
		const isAllowedInteractive = (target) => {
			if (target.closest(".appshell-header, .appshell-sidebar, header, aside, nav, .no-print, [role='dialog'], [role='alertdialog'], .radix-dialog-content")) return true;
			const btn = target.closest("button, [role='button'], a, [role='tab']");
			if (!btn) return false;
			const role = btn.getAttribute("role");
			if (role === "checkbox" || role === "switch") return false;
			const btnText = (btn.textContent || "").trim().toLowerCase();
			return role === "tab" || btn.classList.contains("tab-btn") || btn.hasAttribute("data-state") || [
				"spaces",
				"zones",
				"equipment",
				"report",
				"schedule",
				"sld",
				"calculator",
				"summary"
			].includes(btnText);
		};
		const handleReadOnlyClick = (e) => {
			const target = e.target;
			if (!target) return;
			const isEditableInput = target.closest("input, select, textarea, [contenteditable='true']");
			const isMutationBtn = target.closest("button, [role='button']");
			if (isEditableInput) {
				e.preventDefault();
				e.stopPropagation();
				toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
				return;
			}
			if (isMutationBtn && !isAllowedInteractive(target)) {
				e.preventDefault();
				e.stopPropagation();
				toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
				return;
			}
		};
		const handleReadOnlyKeyDown = (e) => {
			const target = e.target;
			if (!target) return;
			const isElement = typeof target.closest === "function" && typeof target.tagName === "string";
			if (isElement) {
				if (target.closest(".appshell-header, .appshell-sidebar, header, aside, nav, .no-print, [role='dialog'], [role='alertdialog'], .radix-dialog-content, [role='menu']")) return;
			}
			const tagName = isElement ? target.tagName.toLowerCase() : "";
			const isEditable = target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
			const isCopyCombo = (e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C" || e.key === "a" || e.key === "A");
			const isNavKey = [
				"Tab",
				"Escape",
				"ArrowUp",
				"ArrowDown",
				"ArrowLeft",
				"ArrowRight",
				"PageUp",
				"PageDown",
				"Home",
				"End"
			].includes(e.key);
			if (isEditable && !isCopyCombo && !isNavKey) {
				e.preventDefault();
				e.stopPropagation();
				toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
				return;
			}
			if (["Delete", "Backspace"].includes(e.key)) {
				e.preventDefault();
				e.stopPropagation();
				toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
				return;
			}
			if (e.key === "Enter") {
				if (isElement && isAllowedInteractive(target)) return;
				e.preventDefault();
				e.stopPropagation();
				toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
				return;
			}
		};
		const handleReadOnlyChange = (e) => {
			const target = e.target;
			if (!target) return;
			const tagName = target.tagName.toLowerCase();
			if (tagName === "input" || tagName === "textarea" || tagName === "select") {
				e.preventDefault();
				e.stopPropagation();
				toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
			}
		};
		const handleReadOnlyContextMenu = (e) => {
			const target = e.target;
			if (target && typeof target.closest === "function") {
				if (target.closest("input, select, textarea, [contenteditable='true']")) return;
			}
			e.preventDefault();
			e.stopPropagation();
			toast.info("Workspace is in Read-Only mode. Context menus are disabled.", { id: "readonly-notice" });
		};
		if (isEffectiveReadOnly) {
			document.addEventListener("mousedown", handleReadOnlyClick, true);
			document.addEventListener("keydown", handleReadOnlyKeyDown, true);
			document.addEventListener("contextmenu", handleReadOnlyContextMenu, true);
			document.addEventListener("change", handleReadOnlyChange, true);
		}
		return () => {
			document.removeEventListener("mousedown", handleReadOnlyClick, true);
			document.removeEventListener("keydown", handleReadOnlyKeyDown, true);
			document.removeEventListener("contextmenu", handleReadOnlyContextMenu, true);
			document.removeEventListener("change", handleReadOnlyChange, true);
		};
	}, [isReadOnly, isLockedByOther]);
	const handleKeepValuesAsIs = () => {
		if (!pendingUnitToggle) return;
		window.__mep_keep_values = true;
		window.__mep_bypass_unit_prompt = true;
		pendingUnitToggle.button.click();
		window.__mep_bypass_unit_prompt = false;
		window.__mep_keep_values = false;
		setUnitModalOpen(false);
		setPendingUnitToggle(null);
	};
	const handleConvertUnits = () => {
		if (!pendingUnitToggle) return;
		window.__mep_bypass_unit_prompt = true;
		window.__mep_keep_values = false;
		pendingUnitToggle.button.click();
		window.__mep_bypass_unit_prompt = false;
		setUnitModalOpen(false);
		setPendingUnitToggle(null);
	};
	const filteredNav = (0, import_react.useMemo)(() => {
		const isAdmin = ["SUPER_ADMIN", "ORG_ADMIN"].includes(profile?.role || "");
		const rawNav = [...NAV, ...isAdmin ? [{
			kind: "item",
			label: "Company Hierarchy",
			to: "/company-hierarchy",
			icon: Network
		}, {
			kind: "item",
			label: "Admin Panel",
			to: "/admin",
			icon: ShieldAlert
		}] : []];
		const filterNavItems = (items) => {
			return items.map((item) => {
				if (item.kind === "item") return item;
				else if (item.kind === "group") {
					const filteredChildren = item.children;
					const cleanChildren = [];
					for (let i = 0; i < filteredChildren.length; i++) {
						const current = filteredChildren[i];
						if (current.isHeader) {
							let hasItem = false;
							for (let j = i + 1; j < filteredChildren.length; j++) {
								if (filteredChildren[j].isHeader) break;
								hasItem = true;
								break;
							}
							if (hasItem) cleanChildren.push(current);
						} else cleanChildren.push(current);
					}
					if (cleanChildren.length === 0) return null;
					return {
						...item,
						children: cleanChildren
					};
				}
				return item;
			}).filter(Boolean);
		};
		return filterNavItems(rawNav);
	}, [profile]);
	const logoLetter = "M";
	const brandName = "MEP Calculator";
	const rawExpiry = userData?.subscription_expires || profile?.subscription_expires;
	let computedRemainingDays = licenseInfo?.remainingDays ?? 14;
	let computedStatus = licenseInfo?.status;
	if (rawExpiry) {
		const expDate = new Date(rawExpiry);
		if (!isNaN(expDate.getTime())) {
			const diff = Math.ceil((expDate.getTime() - (/* @__PURE__ */ new Date()).getTime()) / (1e3 * 3600 * 24));
			computedRemainingDays = Math.max(0, diff);
			if (diff <= 0) computedStatus = "EXPIRED_TRIAL";
			else if (computedStatus !== "ACTIVE") computedStatus = "FREE_TRIAL";
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid h-screen grid-cols-[auto_1fr] grid-rows-[80px_1fr] bg-surface dark:bg-[#121212] text-foreground text-[14px] print:block print:h-auto",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "appshell-header col-start-2 row-start-1 flex items-start pt-3.5 px-3.5 h-full bg-surface dark:bg-[#121212] no-print print:hidden transition-all duration-300",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex-1 bg-card dark:bg-[#1a1a1a] border border-border dark:border-[#262626] rounded-full h-[60px] px-2.5 flex items-center shadow-[0_1px_3px_rgba(0,0,0,0.05)]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between w-full gap-2 md:gap-3 min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 shrink-0",
								children: [!sidebarOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setSidebarOpen(true),
									className: "size-10 rounded-full hover:bg-surface-2 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0",
									title: "Expand Sidebar",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelLeftOpen, { className: "size-5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuTrigger, {
										asChild: true,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
											asChild: true,
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												className: "flex items-center gap-2 h-10 px-3.5 bg-surface-2 dark:bg-white/5 border border-border dark:border-[#262626] hover:bg-surface-3 dark:hover:bg-white/10 rounded-full text-[13.5px] cursor-pointer outline-none select-none transition-all duration-150",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Building2, { className: "size-4 text-muted-foreground shrink-0" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-foreground dark:text-white truncate max-w-[140px] sm:max-w-[200px]",
														children: project.name
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-muted-foreground font-mono text-[11px] hidden sm:inline",
														children: project.code
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3.5 text-muted-foreground ml-0.5 shrink-0" })
												]
											})
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuContent, {
										className: "w-40 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
												onSelect: async (e) => {
													e.preventDefault();
													e.stopPropagation();
													const newName = await prompt("Enter new project name:", project.name, { title: "Rename Project" });
													if (newName && newName.trim() !== "" && newName.trim() !== project.name) updateProject({
														...project,
														name: newName.trim()
													});
												},
												className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Rename" })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
												onSelect: (e) => {
													e.preventDefault();
													e.stopPropagation();
													duplicateProject(project.id);
												},
												className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Duplicate" })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
												onSelect: async (e) => {
													e.preventDefault();
													e.stopPropagation();
													const revName = await prompt("Enter revision name (e.g., V1, V2):", "V1", { title: "Save as Version" });
													if (revName && revName.trim() !== "") saveAsRevision(revName.trim());
												},
												className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Save as Version..." })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, { className: "h-px bg-border my-1" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
												onSelect: async (e) => {
													e.preventDefault();
													e.stopPropagation();
													if (projects.length <= 1) {
														await confirm("Cannot delete the only project.", {
															hideCancel: true,
															title: "Cannot Delete"
														});
														return;
													}
													if (await confirm(`Are you sure you want to delete project "${project.name}"?`)) deleteProject(project.id);
												},
												className: "flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 text-destructive rounded cursor-pointer",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Delete" })]
											})
										]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
										align: "start",
										className: "w-64 p-1 bg-popover border border-border rounded-lg shadow-lg font-sans",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuLabel, {
												className: "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-1.5 px-2",
												children: "Switch Project"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "max-h-60 overflow-y-auto",
												children: projects.map((p) => {
													return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuTrigger, {
														asChild: true,
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
															onClick: async () => {
																const isProjectsPage = pathname === "/projects";
																if (dirtyStore.isDirty && !isProjectsPage) {
																	const choice = await confirm("Do you want to save the changes?", {
																		title: "Unsaved Changes",
																		threeButtons: true
																	});
																	if (choice === "cancel") return;
																	if (choice === "save") triggerSave();
																}
																dirtyStore.set(false);
																selectProject(p.id);
															},
															className: `flex flex-col items-start gap-0.5 px-2 py-1.5 rounded cursor-pointer text-[13px] ${p.id === project.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-surface-2 text-foreground"}`,
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-medium",
																children: p.name
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[11px] text-muted-foreground font-mono",
																children: p.code
															})]
														})
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuContent, {
														className: "w-40 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
																onSelect: async (e) => {
																	e.preventDefault();
																	e.stopPropagation();
																	const newName = await prompt("Enter new project name:", p.name, { title: "Rename Project" });
																	if (newName && newName.trim() !== "" && newName.trim() !== p.name) updateProject({
																		...p,
																		name: newName.trim()
																	});
																},
																className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Rename" })]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
																onSelect: (e) => {
																	e.preventDefault();
																	e.stopPropagation();
																	duplicateProject(p.id);
																},
																className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Duplicate" })]
															}),
															isVersionAllowed && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
																onSelect: async (e) => {
																	e.preventDefault();
																	e.stopPropagation();
																	const revName = await prompt("Enter revision name (e.g., V1, V2):", "V1", { title: "Save as Version" });
																	if (revName && revName.trim() !== "") saveAsRevision(revName.trim());
																},
																className: "flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Save as Version..." })]
															}),
															(p.created_by === userId || p.created_by === userData?.id || profile?.id === p.created_by || profile?.role === "SUPER_ADMIN") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuSeparator, { className: "h-px bg-border my-1" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenuItem, {
																onSelect: async (e) => {
																	e.preventDefault();
																	e.stopPropagation();
																	if (projects.length <= 1) {
																		await confirm("Cannot delete the only project.", {
																			hideCancel: true,
																			title: "Cannot Delete"
																		});
																		return;
																	}
																	if (await confirm(`Are you sure you want to delete project "${p.name}"?`)) deleteProject(p.id);
																},
																className: "flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 text-destructive rounded cursor-pointer",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Delete" })]
															})] })
														]
													})] }, p.id);
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
												onSelect: async (e) => {
													const isProjectsPage = pathname === "/projects";
													if (dirtyStore.isDirty && !isProjectsPage) {
														e.preventDefault();
														const choice = await confirm("Do you want to save the changes?", {
															title: "Unsaved Changes",
															threeButtons: true
														});
														if (choice === "cancel") return;
														if (choice === "save") triggerSave();
													}
													dirtyStore.set(false);
													navigate({ to: "/projects" });
												},
												className: "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-[13.5px] text-primary hover:bg-primary/5 font-semibold",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Create New Project"]
											})
										]
									})] }), isVersionAllowed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VersionManager, {
										projectName: project.name,
										calculatorName: pathname.split("/").pop() || "Unknown"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-2 min-w-0",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative w-full",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											placeholder: "Search calculators, projects…",
											className: "h-10 w-full pl-10 pr-10 bg-surface-2 dark:bg-white/5 border border-border dark:border-[#262626] focus:border-border-strong rounded-full text-[13.5px] outline-none transition-all duration-150"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
											className: "hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 text-[9.5px] font-sans font-medium text-muted-foreground bg-background dark:bg-white/5 border border-border dark:border-[#262626] rounded px-1.5 py-0.5 select-none leading-none",
											children: "⌘K"
										})
									]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1.5 shrink-0",
								children: [
									isReadOnly && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 rounded-full text-xs font-bold shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "READ ONLY" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => {
											savePageInputs(project.id, pathname);
											triggerSave();
											forceSaveToCloud();
											const calcTitle = getCalculatorTitleFromPath(pathname) || "Ventilation";
											logCalculatorUpdate(calcTitle, `Saved changes in ${calcTitle}`);
											toast.success("Calculations synced to cloud successfully!");
										},
										className: "size-10 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer border border-transparent",
										title: "Save to Cloud",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-4" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: async () => {
											await syncFromCloud();
											toast.success("Synced latest data from cloud!");
										},
										className: "size-10 rounded-full flex items-center justify-center bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-sm cursor-pointer border border-transparent",
										title: "Sync from Cloud",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-4" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => setReadOnly(!isReadOnly),
										className: `size-10 rounded-full flex items-center justify-center transition-colors border ${isReadOnly ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20" : "bg-surface-2 dark:bg-white/5 text-muted-foreground border-border dark:border-[#262626] hover:bg-surface-3 dark:hover:bg-white/10"}`,
										title: isReadOnly ? "Unlock Editing" : "Lock Read-Only Mode",
										children: isReadOnly ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-4" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setPricingModalOpen(true),
										className: `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all shadow-sm cursor-pointer border ${licenseInfo?.plan === "PRO" || licenseInfo?.plan === "ENTERPRISE" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20" : computedStatus === "EXPIRED_TRIAL" ? "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20 animate-pulse" : "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-500 border-amber-500/40 hover:from-amber-500/30 hover:to-orange-500/30"}`,
										title: "Manage License & Subscription",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: !licenseInfo ? "CHECKING LICENSE..." : licenseInfo.plan === "PRO" ? "PRO ACTIVE" : licenseInfo.plan === "ENTERPRISE" ? "ENTERPRISE" : computedStatus === "EXPIRED_TRIAL" ? "TRIAL EXPIRED - UPGRADE" : `TRIAL: ${computedRemainingDays} DAYS LEFT` })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => {
											dirtyStore.set(false);
											const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
											localStorage.setItem("mep_theme", nextTheme);
											if (nextTheme === "dark") document.documentElement.classList.add("dark");
											else document.documentElement.classList.remove("dark");
											window.dispatchEvent(new Event("mep-theme-change"));
										},
										className: "size-10 rounded-full hover:bg-surface-2 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors",
										title: "Toggle Dark / Light Mode",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "size-5 dark:hidden" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-5 hidden dark:block" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
										asChild: true,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											className: "relative size-10 rounded-full hover:bg-surface-2 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-5" }), myNotifications.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "absolute top-2 right-2 flex size-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "relative inline-flex rounded-full size-3 bg-red-500 text-[8px] text-white font-bold items-center justify-center",
													children: myNotifications.length > 9 ? "9+" : myNotifications.length
												})]
											})]
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
										align: "end",
										className: "w-80 bg-popover border border-border rounded-lg shadow-lg font-sans",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuLabel, {
											className: "font-bold text-sm border-b border-border/50 pb-2 mb-2",
											children: "Notifications"
										}), myNotifications.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "py-6 text-center text-sm text-muted-foreground",
											children: "No new notifications"
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "max-h-72 overflow-y-auto custom-scrollbar",
											children: myNotifications.map((notif, i) => {
												const handleClick = () => {
													if (notif.projectId) selectProject(notif.projectId);
													navigate({
														to: notif.calculatorPath || "/ventilation",
														search: {
															commentTargetId: notif.targetId,
															commentTargetType: notif.targetType?.toLowerCase(),
															commentTargetName: notif.targetName
														}
													});
												};
												return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
													onSelect: handleClick,
													onClick: handleClick,
													className: "flex flex-col items-start p-3 border-b border-border/30 last:border-0 hover:bg-surface-2 dark:hover:bg-white/5 transition-colors cursor-pointer focus:bg-surface-2 dark:focus:bg-white/5 outline-none rounded-md",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex justify-between items-start w-full mb-1",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-xs font-semibold text-foreground/80",
																children: notif.authorName
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[10px] text-muted-foreground",
																children: new Date(notif.timestamp).toLocaleDateString()
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "text-[13px] font-medium leading-tight mb-1.5 text-left",
															children: notif.text
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "text-[10.5px] text-muted-foreground font-semibold flex flex-wrap items-center gap-1.5 w-full",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "px-1.5 py-0.5 bg-primary/10 text-primary rounded-sm uppercase tracking-wider",
																	children: notif.targetType
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "truncate max-w-[120px]",
																	children: notif.targetName
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-muted-foreground/60 text-[9px]",
																	children: "in"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "truncate max-w-[100px] text-primary",
																	title: notif.projectName,
																	children: notif.projectName
																})
															]
														})
													]
												}, i);
											})
										})]
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
										asChild: true,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											className: "size-10 rounded-full bg-surface-3 dark:bg-[#2c2c2e] text-foreground dark:text-white flex items-center justify-center text-[12.5px] font-bold shadow-sm select-none border border-border dark:border-[#262626] cursor-pointer hover:ring-2 ring-primary transition-all overflow-hidden",
											children: userPhoto ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
												src: userPhoto,
												alt: "Profile",
												className: "size-full object-cover"
											}) : userData?.name ? userData.name.substring(0, 2).toUpperCase() : myEmail.substring(0, 2).toUpperCase() !== "UN" ? myEmail.substring(0, 2).toUpperCase() : "ME"
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
										align: "end",
										className: "w-64 bg-popover border border-border rounded-lg shadow-lg font-sans",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "py-2.5 px-3 flex items-center gap-3 w-full",
												children: [userPhoto ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
													src: userPhoto,
													alt: "Profile Avatar",
													className: "size-9 rounded-full object-cover border border-primary/40 shrink-0"
												}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "size-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0",
													children: userData?.name ? userData.name.substring(0, 2).toUpperCase() : "ME"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-col min-w-0 flex-1",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-sm font-semibold text-foreground truncate",
															children: userData?.name || profile?.name || "MEP User"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-xs text-muted-foreground truncate",
															children: userData?.email || myEmail
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-1.5 rounded-full bg-green-500" }), "Verified License Active"]
														})
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
												onSelect: () => navigate({ to: "/settings" }),
												className: "py-2 px-3 cursor-pointer focus:bg-accent/40 font-medium",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-4 mr-2 text-muted-foreground" }), "Profile Settings"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
												className: "py-2 px-3 text-red-500 cursor-pointer focus:bg-red-50 dark:focus:bg-red-950 focus:text-red-600 font-semibold",
												onSelect: async () => {
													await logout();
													navigate({ to: "/login" });
												},
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "size-4 mr-2" }), "Sign Out"]
											})
										]
									})] })
								]
							})
						]
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
				className: `appshell-sidebar col-start-1 row-start-1 row-span-2 bg-surface dark:bg-[#121212] flex flex-col no-print print:hidden select-none transition-all duration-300 ease-in-out ${sidebarOpen ? "w-[280px] p-3.5 opacity-100" : "w-0 p-0 opacity-0 overflow-hidden pointer-events-none"}`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 bg-card dark:bg-[#1a1a1a] border border-border dark:border-[#262626] rounded-3xl flex flex-col overflow-hidden w-[252px] min-w-[252px]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 flex items-center justify-between border-b border-border dark:border-[#262626]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "size-9 rounded-xl bg-foreground text-background dark:bg-white dark:text-black flex items-center justify-center font-bold text-[17px] shrink-0 font-sans shadow-sm",
									children: logoLetter
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-foreground dark:text-white text-[15px] font-sans tracking-tight",
									children: brandName
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setSidebarOpen(false),
								className: "size-8 rounded-lg hover:bg-surface-2 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors",
								title: "Collapse Sidebar",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelLeftClose, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
							className: "flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar",
							children: filteredNav.map((n) => n.kind === "item" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLink, {
								to: n.to,
								icon: n.icon,
								label: n.label,
								active: !!n.to && isLinkActive(n.to)
							}, n.label) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavGroup, {
								item: n,
								pathname,
								activeName,
								sidebarOpen,
								onClick: (e) => handleGroupClick(e, n)
							}, n.label))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-3 border-t border-border dark:border-[#262626] bg-card dark:bg-[#1a1a1a] flex justify-center w-full",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-3 bg-surface-2 dark:bg-[#121212] border border-border dark:border-[#262626] rounded-2xl flex flex-col w-full",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] uppercase font-bold tracking-wider text-muted-foreground dark:text-[#9b9b9b] font-sans",
										children: "Sync"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1.5 rounded-full bg-primary dark:bg-white shrink-0" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[12.5px] text-foreground dark:text-white font-medium mt-1 font-sans",
									children: "All calculations saved"
								})]
							})
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "col-start-2 row-start-2 min-w-0 flex flex-col overflow-hidden bg-surface dark:bg-[#121212] print:block print:h-auto print:overflow-visible transition-all duration-300",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatePresence, { children: announcement && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.div, {
					initial: {
						height: 0,
						opacity: 0
					},
					animate: {
						height: "auto",
						opacity: 1
					},
					exit: {
						height: 0,
						opacity: 0
					},
					className: `w-full overflow-hidden shrink-0 no-print ${announcement.type === "warning" ? "bg-amber-500 text-white" : announcement.type === "error" ? "bg-red-500 text-white" : announcement.type === "success" ? "bg-emerald-500 text-white" : "bg-blue-600 text-white"}`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-4 py-2 flex items-center justify-between text-sm font-medium",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Megaphone, { className: "w-4 h-4" }), announcement.message]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => {
								if (announcement?.id && typeof localStorage !== "undefined") localStorage.setItem(`tarv_dismissed_announcement_${announcement.id}`, "true");
								setAnnouncement(null);
							},
							className: "p-1 hover:bg-white/20 rounded-md transition-colors",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
						})]
					})
				}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col relative custom-scrollbar",
					children: [
						!hideSubHeader && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "shrink-0 flex items-center justify-between px-6 py-3.5 bg-surface-1/90 backdrop-blur-md border-b border-border select-none z-10",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[11px] font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5 mb-1",
									children: breadcrumb
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
										className: "text-[20px] font-extrabold text-foreground tracking-tight flex items-center gap-2",
										children: [title, spaceCount !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-2 text-muted-foreground border border-border",
											children: [spaceCount, " spaces"]
										})]
									}), onIntelClick && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: onIntelClick,
										className: `flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-xs font-medium border cursor-pointer shrink-0 ${intelOpen ? "bg-primary text-primary-foreground border-primary" : "bg-[#E8F2FC] text-[#0A7BC7] dark:bg-[#0C2538] dark:text-[#38BDF8] border-[#BCE0FD] dark:border-[#1E4968] hover:bg-[#D4E8FA] dark:hover:bg-[#10324C]"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }), intelLabel || "Intelligence"]
									})]
								}),
								subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[12px] text-muted-foreground font-medium leading-snug mt-1 block",
									children: subtitle
								})
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center gap-2",
								children: actions
							})]
						}),
						isLockedByOther && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute top-0 left-0 right-0 z-40 bg-red-500/10 border-b border-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 flex items-center justify-center gap-2 shrink-0 shadow-sm backdrop-blur-md",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "w-5 h-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-bold text-sm tracking-wide uppercase",
								children: ["READ-ONLY MODE: This calculator is currently being edited by ", lockOwnerName]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `flex-1 min-h-0 flex flex-col transition-opacity duration-300 ${isLockedByOther ? "opacity-90 mt-10" : ""} ${sidebarOpen ? "pl-0 pr-3.5 pb-3.5" : "pl-3.5 pr-3.5 pb-3.5"}`,
							children: isInitializing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 flex flex-col items-center justify-center p-8 h-full bg-surface dark:bg-[#121212]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-8 h-8 animate-spin text-blue-500 mb-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-slate-500 dark:text-slate-400 font-medium",
									children: "Syncing with workspace..."
								})]
							}) : isFeatureLocked(pathname, profile) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-col items-center justify-center flex-1 text-center p-8 bg-surface dark:bg-[#121212]",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "w-full max-w-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 flex flex-col items-center shadow-sm",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-20 h-20 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-6 shadow-inner text-red-500 dark:text-red-400",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "w-8 h-8" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
											className: "text-2xl font-bold text-red-700 dark:text-red-400 mb-3 tracking-tight",
											children: "Warning"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-red-600/80 dark:text-red-400/80 text-sm leading-relaxed",
											children: "This calculator is currently locked or under development for your account. Please contact your administrator for access."
										})
									]
								})
							}) : children
						})
					]
				})]
			}),
			hoveredGroup && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				onClick: () => setHoveredGroup(null),
				className: "fixed z-[9999] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md border border-border dark:border-[#2d2d30] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.03)] p-4.5 transition-all duration-150 animate-in fade-in slide-in-from-left-3 max-h-[calc(100vh-100px)] overflow-y-auto custom-scrollbar",
				style: {
					left: `${sidebarOpen ? 272 : 72}px`,
					top: `${Math.max(88, hoveredGroup.top - 60)}px`
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2.5 border-b border-border/50 pb-3 mb-3.5 px-1",
					children: [(() => {
						const Icon = hoveredGroup.item.icon;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4.5 text-primary" });
					})(), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-bold text-[14px] text-foreground tracking-tight",
						children: hoveredGroup.item.label
					})]
				}), (() => {
					const sections = getSections(hoveredGroup.item.children);
					const isTwoColGrid = hoveredGroup.item.label === "HVAC" || hoveredGroup.item.label === "Electrical";
					const isMultiCol = isTwoColGrid || !sections[0]?.header && sections[0]?.items.length > 8;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `${isTwoColGrid ? "w-[540px]" : isMultiCol ? "w-[480px]" : "w-[260px]"} ${isTwoColGrid ? "grid grid-cols-2 gap-4" : "flex flex-col gap-3.5"}`,
						children: sections.map((sec, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-1.5",
							children: [sec.header && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[9.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pt-1 px-2 select-none border-b border-border/30 pb-0.5 mb-1.5",
								children: sec.header
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: !sec.header && sec.items.length > 8 ? "grid grid-cols-2 gap-x-4 gap-y-1" : "space-y-0.5",
								children: sec.items.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLink, {
									to: c.to,
									label: c.label,
									active: !!c.to && isLinkActive(c.to),
									showDot: true
								}, c.label))
							})]
						}, idx))
					});
				})()]
			}),
			unitModalOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 font-sans",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "size-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-5 text-red-500" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-[17px] font-bold text-foreground",
								children: "Unit System Transition"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13.5px] text-muted-foreground leading-normal font-medium",
							children: "You are switching between Imperial (IP) and Metric (SI) units. How would you like to handle the entered input values?"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => {
										setUnitModalOpen(false);
										setPendingUnitToggle(null);
									},
									className: "w-full sm:w-auto px-4 py-2 border border-slate-250 dark:border-zinc-800 text-[12.5px] font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 text-foreground cursor-pointer outline-none transition-colors",
									children: "Cancel"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: handleKeepValuesAsIs,
									className: "w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 text-[12.5px] font-bold rounded-xl cursor-pointer outline-none transition-colors",
									children: "Keep Values As-Is"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: handleConvertUnits,
									className: "w-full sm:w-auto px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-[12.5px] font-bold rounded-xl cursor-pointer outline-none transition-colors shadow-sm",
									children: "Convert Values"
								})
							]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PricingModal, {
				isOpen: pricingModalOpen,
				onClose: () => setPricingModalOpen(false),
				onSuccess: refreshLicenseStatus,
				currentStatus: licenseInfo
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WelcomeToTarvModal, {
				isOpen: showPioneerModal,
				onClose: () => {
					setShowPioneerModal(false);
					if (userId) localStorage.setItem(`tarv_pioneer_welcome_shown_${userId}`, "true");
				},
				userName: userData?.name || profile?.name || "Engineer",
				pioneerNumber: userData?.pioneer_number || 1
			})
		]
	});
}
function NavLink({ to, icon: Icon, label, active, indent, showDot }) {
	useNavigate();
	const confirm = useConfirm();
	const router = useRouter();
	const pathname = router.state.location.pathname;
	const cls = `flex items-center gap-2 ${showDot ? "pl-2.5 pr-3" : "px-3"} py-1.5 rounded-xl text-[13px] transition-all duration-150 cursor-pointer ${indent ? "pl-8" : ""} ${active ? "bg-primary/10 text-primary font-semibold dark:bg-primary/20 dark:text-primary-foreground" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground dark:text-[#9b9b9b] dark:hover:bg-white/5 dark:hover:text-white"}`;
	const content = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		Icon && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: `size-4 ${active ? "text-primary" : "text-muted-foreground dark:text-[#9b9b9b]"}` }),
		showDot && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `size-1.5 rounded-full shrink-0 ${active ? "bg-primary" : "bg-slate-350 dark:bg-slate-600"}` }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "flex-1 truncate text-left",
			children: label
		})
	] });
	const handleClick = (0, import_react.useCallback)(async (e) => {
		if (!to) return;
		const isFromProjectsPage = pathname === "/projects";
		const isToProjectsPage = to === "/projects" || to.startsWith("/projects");
		if (dirtyStore.isDirty && !isFromProjectsPage && !isToProjectsPage) {
			e.preventDefault();
			e.stopPropagation();
			const choice = await confirm("Do you want to save the changes?", {
				title: "Unsaved Changes",
				threeButtons: true
			});
			if (choice === "cancel") return;
			if (choice === "save") triggerSave();
		}
		dirtyStore.set(false);
		if (to.startsWith("/")) {
			let path = to;
			let searchObj = void 0;
			if (to.includes("?")) {
				const parts = to.split("?");
				path = parts[0];
				const nameVal = new URLSearchParams(parts[1]).get("name");
				if (nameVal) searchObj = { name: nameVal };
			}
			router.navigate({
				to: path,
				search: searchObj
			});
		}
	}, [
		to,
		confirm,
		router,
		pathname
	]);
	if (to && to.startsWith("/")) {
		let path = to;
		let searchObj = void 0;
		if (to.includes("?")) {
			const parts = to.split("?");
			path = parts[0];
			const nameVal = new URLSearchParams(parts[1]).get("name");
			if (nameVal) searchObj = { name: nameVal };
		}
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: path,
			search: searchObj,
			className: cls,
			onClick: handleClick,
			children: content
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		className: cls,
		onClick: handleClick,
		children: content
	});
}
function NavGroup({ item, pathname, activeName, sidebarOpen, onClick }) {
	const isLinkActive = (to) => {
		if (!to) return false;
		if (to.includes("?")) {
			const parts = to.split("?");
			const path = parts[0];
			const nameVal = new URLSearchParams(parts[1]).get("name");
			return pathname === path && activeName === nameVal;
		}
		return pathname === to;
	};
	const hasActiveChild = item.children.some((c) => c.to && isLinkActive(c.to));
	const Icon = item.icon;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "relative",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			onClick,
			className: `nav-group-btn flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[13.5px] transition-all duration-150 cursor-pointer ${hasActiveChild ? "bg-surface-2 text-foreground font-semibold dark:bg-white/10 dark:text-white" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground dark:text-[#9b9b9b] dark:hover:bg-white/5 dark:hover:text-white"}`,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "flex-1 text-left truncate",
				children: item.label
			})]
		})
	});
}
//#endregion
export { dirtyStore as _, ContextMenuSeparator as a, DropdownMenu as c, DropdownMenuRadioGroup as d, DropdownMenuRadioItem as f, WelcomeToTarvModal as g, PricingModal as h, ContextMenuItem as i, DropdownMenuContent as l, DropdownMenuTrigger as m, ContextMenu as n, ContextMenuShortcut as o, DropdownMenuSeparator as p, ContextMenuContent as r, ContextMenuTrigger as s, AppShell as t, DropdownMenuLabel as u };
