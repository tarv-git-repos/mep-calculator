import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Bt as ArrowLeft, H as Mail, J as KeyRound, W as Lock, b as ShieldCheck, bt as Cpu, ft as Eye, in as CircleCheck, k as RefreshCw, o as User, pt as EyeOff, x as ShieldAlert, zt as ArrowRight } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as authService, r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { P as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as AnimatePresence, t as motion } from "../_libs/framer-motion.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-DJ4RWC6L.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Login() {
	const navigate = useNavigate();
	const { isLoggedin, userData, setUserData } = useAuth();
	const confirm = useConfirm();
	const [mode, setMode] = (0, import_react.useState)("Login");
	const [name, setName] = (0, import_react.useState)("");
	const [nameError, setNameError] = (0, import_react.useState)(null);
	const handleNameChange = (val) => {
		setName(val);
		if (!val) {
			setNameError(null);
			return;
		}
		if (!/^[a-zA-Z\s'\-]+$/.test(val.trim())) setNameError("Full Name should only contain letters, spaces, hyphens, or apostrophes (no numbers).");
		else if (val.trim().length < 2) setNameError("Full Name must be at least 2 characters long.");
		else setNameError(null);
	};
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [showPassword, setShowPassword] = (0, import_react.useState)(false);
	const [newPassword, setNewPassword] = (0, import_react.useState)("");
	const [showNewPassword, setShowNewPassword] = (0, import_react.useState)(false);
	const [otpArray, setOtpArray] = (0, import_react.useState)(Array(6).fill(""));
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [resending, setResending] = (0, import_react.useState)(false);
	const [resendTimer, setResendTimer] = (0, import_react.useState)(0);
	const [resetStep, setResetStep] = (0, import_react.useState)(1);
	const otpInputRefs = (0, import_react.useRef)([]);
	const getPasswordErrors = (pass) => {
		const errors = [];
		if (!pass) return errors;
		if (pass.length < 8) errors.push("At least 8 characters");
		if (!/[A-Z]/.test(pass)) errors.push("1 uppercase letter");
		if (!/[a-z]/.test(pass)) errors.push("1 lowercase letter");
		if (!/[0-9]/.test(pass)) errors.push("1 number");
		if (!/[!@#$%^&*(),.?":{}|<>\-_+=\[\]\\\/~`]/.test(pass)) errors.push("1 special character");
		return errors;
	};
	(0, import_react.useEffect)(() => {
		let interval = null;
		if (resendTimer > 0) interval = setInterval(() => {
			setResendTimer((prev) => prev - 1);
		}, 1e3);
		return () => clearInterval(interval);
	}, [resendTimer]);
	(0, import_react.useEffect)(() => {
		if (isLoggedin && userData) if (userData.isAccountVerified !== false) navigate({ to: "/" });
		else {
			setMode("Email Verify");
			if (userData.email) setEmail(userData.email);
		}
	}, [
		isLoggedin,
		userData,
		navigate
	]);
	const handleOtpInput = (val, index) => {
		const cleanVal = val.replace(/\D/g, "").slice(-1);
		const newOtp = [...otpArray];
		newOtp[index] = cleanVal;
		setOtpArray(newOtp);
		if (cleanVal && index < 5) otpInputRefs.current[index + 1]?.focus();
	};
	const handleOtpKeyDown = (e, index) => {
		if (e.key === "Backspace" && !otpArray[index] && index > 0) otpInputRefs.current[index - 1]?.focus();
	};
	const handleOtpPaste = (e) => {
		e.preventDefault();
		const pastedText = e.clipboardData.getData("text").trim().slice(0, 6);
		if (/^\d+$/.test(pastedText)) {
			const digits = pastedText.split("");
			const newOtp = [...otpArray];
			digits.forEach((d, i) => {
				if (i < 6) newOtp[i] = d;
			});
			setOtpArray(newOtp);
			otpInputRefs.current[Math.min(digits.length, 5)]?.focus();
		}
	};
	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			if (mode === "Sign Up") {
				if (!name || !email || !password) {
					toast.error("Please fill in your name, email address, and password.");
					setLoading(false);
					return;
				}
				if (!/^[a-zA-Z\s'\-]+$/.test(name.trim())) {
					toast.error("Full Name should only contain letters, spaces, hyphens, or apostrophes (no numbers).");
					setLoading(false);
					return;
				}
				if (name.trim().length < 2) {
					toast.error("Full Name must be at least 2 characters long.");
					setLoading(false);
					return;
				}
				if (getPasswordErrors(password).length > 0) {
					toast.error("Please ensure your password meets all requirements.");
					setLoading(false);
					return;
				}
				const res = await authService.register(name, email, password);
				if (res.success) {
					if (res.userData) setUserData(res.userData);
					toast.success(res.message || "Account created! Verification OTP sent to your email.");
					setMode("Email Verify");
					setResendTimer(30);
				} else toast.error(res.message || "Registration failed");
			} else if (mode === "Login") {
				if (!email || !password) {
					toast.error("Please enter your email and password.");
					setLoading(false);
					return;
				}
				let res = await authService.login(email, password);
				if (res.requireForceLogout) if (await confirm(res.message + "\n\nDo you want to log out the other device and log in here?", {
					title: "Multiple Sessions Detected",
					confirmText: "Yes, Log In Here",
					cancelText: "Cancel"
				})) res = await authService.login(email, password, true);
				else {
					setLoading(false);
					return;
				}
				if (res.success) {
					if (res.userData) setUserData(res.userData);
					toast.success(res.message || "Logged in successfully");
					navigate({ to: "/" });
				} else toast.error(res.message || "Login failed");
			}
		} catch (err) {
			toast.error(err.message || "An error occurred during request processing.");
		} finally {
			setLoading(false);
		}
	};
	const handleVerifyOtp = async (e) => {
		e.preventDefault();
		const otpCode = otpArray.join("");
		if (otpCode.length < 6) {
			toast.error("Please enter the full 6-digit OTP code.");
			return;
		}
		setLoading(true);
		try {
			const res = await authService.verifyAccount(otpCode, email);
			if (res.success) {
				toast.success(res.message || "Email verified successfully!");
				if (res.userData) setUserData(res.userData);
				else if (userData) setUserData({
					...userData,
					isAccountVerified: true
				});
				navigate({ to: "/" });
			} else toast.error(res.message || "Invalid or expired OTP code.");
		} catch (err) {
			toast.error(err.message || "Verification error");
		} finally {
			setLoading(false);
		}
	};
	const handleResendOtp = async () => {
		if (resendTimer > 0) return;
		setResending(true);
		try {
			const res = await authService.sendVerifyOtp(email);
			if (res.success) {
				toast.success(res.message || "Verification OTP sent to your email.");
				setResendTimer(45);
			} else toast.error(res.message || "Failed to resend OTP.");
		} catch (err) {
			toast.error(err.message || "Resend failed");
		} finally {
			setResending(false);
		}
	};
	const handleForgotOrReset = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			if (resetStep === 1) {
				if (!email) {
					toast.error("Please enter your email address.");
					setLoading(false);
					return;
				}
				const res = await authService.sendResetOtp(email);
				if (res.success) {
					toast.success(res.message || "Reset OTP sent to your email.");
					setResetStep(2);
				} else toast.error(res.message || "Error sending reset code");
			} else {
				const otpCode = otpArray.join("");
				if (otpCode.length < 6 || !newPassword) {
					toast.error("Please enter the 6-digit OTP and your new password.");
					setLoading(false);
					return;
				}
				if (getPasswordErrors(newPassword).length > 0) {
					toast.error("Please ensure your new password meets all requirements.");
					setLoading(false);
					return;
				}
				const res = await authService.resetPassword(email, otpCode, newPassword);
				if (res.success) {
					toast.success(res.message || "Password reset successfully! Please login.");
					setMode("Login");
					setResetStep(1);
					setPassword("");
				} else toast.error(res.message || "Password reset failed");
			}
		} catch (err) {
			toast.error(err.message || "Error processing request");
		} finally {
			setLoading(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans text-slate-800 dark:text-slate-100 selection:bg-blue-600 selection:text-white transition-colors duration-300",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-100/50 dark:bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-slate-200/60 dark:bg-indigo-900/15 rounded-full blur-[120px] pointer-events-none" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
				initial: {
					opacity: 0,
					y: -15
				},
				animate: {
					opacity: 1,
					y: 0
				},
				transition: { duration: .4 },
				className: "sm:mx-auto sm:w-full sm:max-w-md z-10 text-center mb-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200/80 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin-slow" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Universal MEP Engineering Suite" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-2",
						children: "MEP Calculator"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto",
						children: "High-performance HVAC, Electrical & Plumbing calculation platform"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.div, {
				initial: {
					opacity: 0,
					scale: .97
				},
				animate: {
					opacity: 1,
					scale: 1
				},
				transition: { duration: .35 },
				className: "w-full sm:max-w-md z-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-white dark:bg-slate-900/90 py-8 px-6 sm:px-10 shadow-xl dark:shadow-[0_20px_50px_rgba(2,132,199,0.15)] shadow-slate-200/60 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 relative overflow-hidden transition-all",
					children: [(mode === "Login" || mode === "Sign Up") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 p-1 mb-8 rounded-2xl bg-slate-100/90 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 relative",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setMode("Login"),
							className: `py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 z-10 cursor-pointer ${mode === "Login" ? "text-white bg-blue-600 dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600 shadow-md shadow-blue-600/25 dark:shadow-sky-500/20" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"}`,
							children: "Sign In"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setMode("Sign Up"),
							className: `py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 z-10 cursor-pointer ${mode === "Sign Up" ? "text-white bg-blue-600 dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600 shadow-md shadow-blue-600/25 dark:shadow-sky-500/20" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"}`,
							children: "Create Account"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatePresence, {
						mode: "wait",
						children: [
							(mode === "Login" || mode === "Sign Up") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.form, {
								initial: {
									opacity: 0,
									x: mode === "Sign Up" ? 15 : -15
								},
								animate: {
									opacity: 1,
									x: 0
								},
								exit: {
									opacity: 0,
									x: mode === "Sign Up" ? -15 : 15
								},
								transition: { duration: .2 },
								className: "space-y-5",
								onSubmit: handleSubmit,
								children: [
									mode === "Sign Up" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5",
											children: "Full Name / User Name"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "relative rounded-xl shadow-xs",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "h-4 w-4" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												required: true,
												value: name,
												onChange: (e) => handleNameChange(e.target.value),
												className: `block w-full pl-10 pr-4 py-3 bg-slate-50/70 dark:bg-slate-950/90 border text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-slate-950 text-sm placeholder-slate-400 dark:placeholder-slate-500 transition-all font-medium ${nameError ? "border-red-500 focus:ring-red-500/20 focus:border-red-500" : "border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 dark:focus:ring-sky-500/40 focus:border-blue-600 dark:focus:border-sky-500"}`,
												placeholder: "John Doe"
											})]
										}),
										nameError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-red-500 dark:text-red-400 text-xs font-semibold mt-1.5 flex items-center gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1 rounded-full bg-red-500 dark:bg-red-400" }), nameError]
										})
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5",
										children: "Email Address / Login ID"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative rounded-xl shadow-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, { className: "h-4 w-4" })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "email",
											required: true,
											value: email,
											onChange: (e) => setEmail(e.target.value),
											className: "block w-full pl-10 pr-4 py-3 bg-slate-50/70 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-sky-500/40 focus:border-blue-600 dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 text-sm placeholder-slate-400 dark:placeholder-slate-500 transition-all font-medium",
											placeholder: "user@example.com"
										})]
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between mb-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300",
												children: "Password"
											}), mode === "Login" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => {
													setMode("Forgot Password");
													setResetStep(1);
												},
												className: "text-xs font-semibold text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 transition-colors cursor-pointer",
												children: "Forgot password?"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "relative rounded-xl shadow-xs",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "h-4 w-4" })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: showPassword ? "text" : "password",
													required: true,
													value: password,
													onChange: (e) => setPassword(e.target.value),
													className: "block w-full pl-10 pr-10 py-3 bg-slate-50/70 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-sky-500/40 focus:border-blue-600 dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 text-sm placeholder-slate-400 dark:placeholder-slate-500 transition-all font-medium",
													placeholder: "••••••••"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => setShowPassword(!showPassword),
													className: "absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer",
													children: showPassword ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "w-4 h-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "w-4 h-4" })
												})
											]
										}),
										mode === "Sign Up" && password.length > 0 && getPasswordErrors(password).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-2 space-y-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "text-[11px] text-amber-600 dark:text-amber-500 font-semibold flex items-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "w-3 h-3" }), " Missing requirements:"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
												className: "text-[11px] text-amber-600/90 dark:text-amber-400/80 list-disc pl-4 space-y-0.5 font-medium",
												children: getPasswordErrors(password).map((err, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: err }, i))
											})]
										})
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										disabled: loading,
										className: "w-full py-3.5 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-gradient-to-r dark:from-sky-500 dark:via-blue-600 dark:to-indigo-600 dark:hover:from-sky-400 dark:hover:to-indigo-500 shadow-md shadow-blue-600/20 dark:shadow-sky-500/25 transition-all transform active:scale-[0.99] disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer mt-2",
										children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "w-4 h-4 animate-spin" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Processing..." })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: mode === "Login" ? "Sign In to Dashboard" : "Create Free Account" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "w-4 h-4" })] })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-center pt-2",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs text-slate-500 dark:text-slate-400 font-medium",
											children: mode === "Login" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["Don't have an account? ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setMode("Sign Up"),
												className: "font-bold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer",
												children: "Sign up option"
											})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["Already registered? ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setMode("Login"),
												className: "font-bold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer",
												children: "Login here"
											})] })
										})
									})
								]
							}, mode),
							mode === "Email Verify" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.form, {
								initial: {
									opacity: 0,
									scale: .96
								},
								animate: {
									opacity: 1,
									scale: 1
								},
								exit: {
									opacity: 0,
									scale: .96
								},
								transition: { duration: .25 },
								className: "space-y-6 text-center",
								onSubmit: handleVerifyOtp,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-sky-500/10 border border-blue-200 dark:border-sky-500/30 text-blue-600 dark:text-sky-400 shadow-xs",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "w-7 h-7" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "text-xl font-bold text-slate-900 dark:text-white mb-1",
										children: "Verify Email Address"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto",
										children: ["Enter the 6-digit OTP code sent to ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
											className: "text-blue-600 dark:text-sky-400",
											children: email || "your email"
										})]
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3",
										children: "6-Digit Verification Code"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex justify-between gap-2 max-w-xs mx-auto",
										children: Array(6).fill(0).map((_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											inputMode: "numeric",
											maxLength: 1,
											ref: (el) => {
												otpInputRefs.current[index] = el;
											},
											value: otpArray[index] || "",
											onChange: (e) => handleOtpInput(e.target.value, index),
											onKeyDown: (e) => handleOtpKeyDown(e, index),
											onPaste: index === 0 ? handleOtpPaste : void 0,
											className: "w-11 h-14 text-center text-2xl font-black bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-sky-500 focus:border-blue-600 dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 shadow-xs transition-all",
											required: true
										}, index))
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										disabled: loading || otpArray.join("").length < 6,
										className: "w-full py-3.5 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600 dark:hover:from-sky-400 dark:hover:to-blue-500 shadow-md shadow-blue-600/20 dark:shadow-sky-500/25 transition-all active:scale-[0.99] disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer",
										children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "w-4 h-4 animate-spin" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Confirming OTP..." })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-4 h-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Confirm OTP & Login" })] })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between text-xs pt-2 text-slate-500 dark:text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800/80",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => setMode("Login"),
											className: "inline-flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "w-3.5 h-3.5 mr-1" }), " Back to Login"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											disabled: resending || resendTimer > 0,
											onClick: handleResendOtp,
											className: "inline-flex items-center text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 font-bold disabled:opacity-50 transition-colors cursor-pointer",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-3.5 h-3.5 mr-1 ${resending ? "animate-spin" : ""}` }), resending ? "Resending..." : resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"]
										})]
									})
								]
							}, "Email Verify"),
							mode === "Forgot Password" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.form, {
								initial: {
									opacity: 0,
									y: 10
								},
								animate: {
									opacity: 1,
									y: 0
								},
								exit: {
									opacity: 0,
									y: -10
								},
								transition: { duration: .25 },
								className: "space-y-5",
								onSubmit: handleForgotOrReset,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-indigo-500/10 border border-blue-200 dark:border-indigo-500/30 text-blue-600 dark:text-indigo-400 shadow-xs",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { className: "w-7 h-7" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-center",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "text-xl font-bold text-slate-900 dark:text-white mb-1",
											children: resetStep === 1 ? "Reset Your Password" : "Enter OTP & New Password"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto",
											children: resetStep === 1 ? "Enter your registered email to receive a password reset OTP code" : "Check your email for the OTP and set your new password"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5",
										children: "Registered Email Address"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative rounded-xl shadow-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, { className: "h-4 w-4" })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "email",
											required: true,
											value: email,
											disabled: resetStep === 2,
											onChange: (e) => setEmail(e.target.value),
											className: "block w-full pl-10 pr-4 py-3 bg-slate-50/70 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-sky-500/40 focus:border-blue-600 dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 text-sm placeholder-slate-400 dark:placeholder-slate-500 disabled:opacity-60 transition-all font-medium",
											placeholder: "user@example.com"
										})]
									})] }),
									resetStep === 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 text-center",
										children: "6-Digit Reset OTP Code"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex justify-between gap-2 max-w-xs mx-auto mb-4",
										children: Array(6).fill(0).map((_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											inputMode: "numeric",
											maxLength: 1,
											ref: (el) => {
												otpInputRefs.current[index] = el;
											},
											value: otpArray[index] || "",
											onChange: (e) => handleOtpInput(e.target.value, index),
											onKeyDown: (e) => handleOtpKeyDown(e, index),
											onPaste: index === 0 ? handleOtpPaste : void 0,
											className: "w-11 h-13 text-center text-xl font-black bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-sky-500 focus:border-blue-600 dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 text-sm shadow-xs",
											required: true
										}, index))
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5",
											children: "New Password"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "relative rounded-xl shadow-xs",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "h-4 w-4" })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: showNewPassword ? "text" : "password",
													required: true,
													value: newPassword,
													onChange: (e) => setNewPassword(e.target.value),
													className: "block w-full pl-10 pr-10 py-3 bg-slate-50/70 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-sky-500/40 focus:border-blue-600 dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 text-sm placeholder-slate-400 dark:placeholder-slate-500 font-medium",
													placeholder: "New password"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => setShowNewPassword(!showNewPassword),
													className: "absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer",
													children: showNewPassword ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "w-4 h-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "w-4 h-4" })
												})
											]
										}),
										newPassword.length > 0 && getPasswordErrors(newPassword).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-2 space-y-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "text-[11px] text-amber-600 dark:text-amber-500 font-semibold flex items-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "w-3 h-3" }), " Missing requirements:"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
												className: "text-[11px] text-amber-600/90 dark:text-amber-400/80 list-disc pl-4 space-y-0.5 font-medium",
												children: getPasswordErrors(newPassword).map((err, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: err }, i))
											})]
										})
									] })] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										disabled: loading,
										className: "w-full py-3.5 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600 dark:hover:from-sky-400 dark:hover:to-blue-500 shadow-md shadow-blue-600/20 dark:shadow-sky-500/25 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer",
										children: loading ? "Processing..." : resetStep === 1 ? "Send Reset OTP Code" : "Save New Password & Login"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-center pt-2",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => {
												setMode("Login");
												setResetStep(1);
											},
											className: "inline-flex items-center text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors cursor-pointer",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "w-3.5 h-3.5 mr-1" }), " Back to Login"]
										})
									})
								]
							}, "Forgot Password")
						]
					})]
				})
			})
		]
	});
}
//#endregion
export { Login as component };
