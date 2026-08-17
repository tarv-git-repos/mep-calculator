import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { C as Slot, a as Overlay2, c as Title2, i as Description2, j as require_jsx_runtime, n as Cancel, o as Portal2, r as Content2, s as Root2, t as Action } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { Wt as TriangleAlert } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-confirm-BT3fngjN.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
			destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
			outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
			secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
			ghost: "hover:bg-accent hover:text-accent-foreground",
			link: "text-primary underline-offset-4 hover:underline"
		},
		size: {
			default: "h-9 px-4 py-2",
			sm: "h-8 rounded-md px-3 text-xs",
			lg: "h-10 rounded-md px-8",
			icon: "h-9 w-9"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
var AlertDialog = Root2;
var AlertDialogPortal = Portal2;
var AlertDialogOverlay = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay2, {
	className: cn("fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
	...props,
	ref
}));
AlertDialogOverlay.displayName = Overlay2.displayName;
var AlertDialogContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	className: cn("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg", className),
	...props
})] }));
AlertDialogContent.displayName = Content2.displayName;
var AlertDialogHeader = ({ className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	className: cn("flex flex-col space-y-2 text-center sm:text-left", className),
	...props
});
AlertDialogHeader.displayName = "AlertDialogHeader";
var AlertDialogFooter = ({ className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className),
	...props
});
AlertDialogFooter.displayName = "AlertDialogFooter";
var AlertDialogTitle = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Title2, {
	ref,
	className: cn("text-lg font-semibold", className),
	...props
}));
AlertDialogTitle.displayName = Title2.displayName;
var AlertDialogDescription = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Description2, {
	ref,
	className: cn("text-sm text-muted-foreground", className),
	...props
}));
AlertDialogDescription.displayName = Description2.displayName;
var AlertDialogAction = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Action, {
	ref,
	className: cn(buttonVariants(), className),
	...props
}));
AlertDialogAction.displayName = Action.displayName;
var AlertDialogCancel = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cancel, {
	ref,
	className: cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className),
	...props
}));
AlertDialogCancel.displayName = Cancel.displayName;
var ConfirmContext = typeof window !== "undefined" ? window.__ConfirmContext = window.__ConfirmContext || (0, import_react.createContext)(null) : (0, import_react.createContext)(null);
function ConfirmProvider({ children }) {
	const [state, setState] = (0, import_react.useState)(null);
	const [promptState, setPromptState] = (0, import_react.useState)(null);
	const [promptValue, setPromptValue] = (0, import_react.useState)("");
	const confirm = (0, import_react.useCallback)((messageOrOptions, options) => {
		return new Promise((resolve) => {
			let msg = "";
			let title = options?.title;
			let confirmText = options?.confirmText;
			let cancelText = options?.cancelText;
			let hideCancel = options?.hideCancel;
			let threeButtons = options?.threeButtons;
			let saveText = options?.saveText;
			let unsaveText = options?.unsaveText;
			let variant = options?.variant || "default";
			if (typeof messageOrOptions === "object" && messageOrOptions !== null) {
				msg = messageOrOptions.body || messageOrOptions.message || "";
				title = messageOrOptions.title || title;
				confirmText = messageOrOptions.confirmText || confirmText;
				cancelText = messageOrOptions.cancelText || cancelText;
				hideCancel = messageOrOptions.hideCancel || hideCancel;
				variant = messageOrOptions.variant || variant;
			} else msg = String(messageOrOptions);
			setState({
				isOpen: true,
				message: msg,
				title,
				confirmText,
				cancelText,
				hideCancel,
				threeButtons,
				saveText,
				unsaveText,
				variant,
				resolve
			});
		});
	}, []);
	const prompt = (0, import_react.useCallback)((message, defaultValue = "", options) => {
		return new Promise((resolve) => {
			setPromptValue(defaultValue);
			setPromptState({
				isOpen: true,
				message,
				defaultValue,
				title: options?.title || "Input Required",
				confirmText: options?.confirmText || "OK",
				cancelText: options?.cancelText || "Cancel",
				resolve
			});
		});
	}, []);
	const handleCancel = () => {
		if (state) {
			state.resolve(state.threeButtons ? "cancel" : false);
			setState(null);
		}
	};
	const handleConfirm = () => {
		if (state) {
			state.resolve(state.threeButtons ? "save" : true);
			setState(null);
		}
	};
	const handleUnsave = () => {
		if (state) {
			state.resolve("unsave");
			setState(null);
		}
	};
	const isDeleteAction = state ? state.message.toLowerCase().includes("delete") || state.message.toLowerCase().includes("remove") : false;
	const defaultConfirmText = isDeleteAction ? "Delete" : "Confirm";
	const confirmText = state?.confirmText || defaultConfirmText;
	const cancelText = state?.cancelText || "Cancel";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ConfirmContext.Provider, {
		value: {
			confirm,
			prompt
		},
		children: [
			children,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialog, {
				open: !!state?.isOpen,
				onOpenChange: (open) => {
					if (!open) handleCancel();
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Content2, {
					className: "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[400px] translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl rounded-3xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 flex flex-col focus:outline-none",
					children: [state?.variant === "unit-transition" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-4 items-start pb-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "size-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center text-red-500 shrink-0 select-none",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogTitle, {
								className: "text-[15px] font-bold text-foreground",
								children: state?.title || "Unit System Transition"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogDescription, {
								className: "text-[12px] text-muted-foreground leading-normal font-medium",
								children: state?.message
							})]
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogTitle, {
							className: "text-[14px] font-semibold tracking-tight text-foreground",
							children: state?.title || "Confirm Action"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogDescription, {
							className: "text-[12.5px] text-muted-foreground leading-normal font-normal",
							children: state?.message
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogFooter, {
						className: "flex items-center justify-end gap-2 mt-2 w-full",
						children: state?.threeButtons ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-end gap-2 w-full",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, {
								onClick: handleCancel,
								className: "h-8 px-4 border border-border bg-transparent hover:bg-surface-2 rounded text-[12px] font-medium text-foreground transition-colors mt-0 cursor-pointer",
								children: state.cancelText || "Cancel"
							}), state.variant === "unit-transition" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: handleUnsave,
								className: "h-8 px-4 border-0 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded text-[12px] font-semibold transition-colors cursor-pointer",
								children: state.unsaveText || "Keep Values As-Is"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
								onClick: handleConfirm,
								className: "h-8 px-4 bg-red-600 hover:bg-red-700 text-white rounded text-[12px] font-semibold transition-colors shadow-sm cursor-pointer border-0",
								children: state.saveText || "Convert Values"
							})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: handleUnsave,
								className: "h-8 px-4 border border-destructive/20 bg-destructive/10 hover:bg-destructive hover:text-white rounded text-[12px] font-medium text-destructive transition-colors cursor-pointer",
								children: state.unsaveText || "Unsave"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
								onClick: handleConfirm,
								className: "h-8 px-4 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded text-[12px] font-semibold transition-colors shadow-sm cursor-pointer border-0",
								children: state.saveText || "Save"
							})] })]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [!state?.hideCancel && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, {
							onClick: handleCancel,
							className: "h-8 px-4 border border-border bg-transparent hover:bg-surface-2 rounded text-[12px] font-medium text-foreground transition-colors mt-0 cursor-pointer",
							children: cancelText
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
							onClick: handleConfirm,
							className: `h-8 px-4 rounded text-[12px] font-semibold transition-colors shadow-sm text-white cursor-pointer ${isDeleteAction ? "bg-destructive hover:bg-destructive/90" : "bg-[#0A7BC7] hover:bg-[#06456F]"}`,
							children: confirmText
						})] })
					})]
				})] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialog, {
				open: !!promptState?.isOpen,
				onOpenChange: (open) => {
					if (!open) {
						promptState?.resolve(null);
						setPromptState(null);
					}
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Content2, {
					className: "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[400px] translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl rounded-3xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 flex flex-col focus:outline-none",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogTitle, {
							className: "text-[14px] font-semibold tracking-tight text-foreground",
							children: promptState?.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogDescription, {
							className: "text-[12.5px] text-muted-foreground leading-normal font-normal",
							children: promptState?.message
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: (e) => {
							e.preventDefault();
							if (promptState) {
								promptState.resolve(promptValue);
								setPromptState(null);
							}
						},
						className: "space-y-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							value: promptValue,
							onChange: (e) => setPromptValue(e.target.value),
							className: "w-full bg-background border border-border rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[13px] text-foreground transition-all duration-150 font-sans",
							autoFocus: true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogFooter, {
							className: "flex items-center justify-end gap-2 mt-2 w-full",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, {
								onClick: () => {
									promptState?.resolve(null);
									setPromptState(null);
								},
								className: "h-8 px-4 border border-border bg-transparent hover:bg-surface-2 rounded text-[12px] font-medium text-foreground transition-colors mt-0 cursor-pointer",
								children: promptState?.cancelText || "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
								type: "submit",
								className: "h-8 px-4 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded text-[12px] font-semibold transition-colors shadow-sm cursor-pointer border-0",
								children: promptState?.confirmText || "OK"
							})]
						})]
					})]
				})] })
			})
		]
	});
}
function useConfirm() {
	const context = (0, import_react.useContext)(ConfirmContext);
	if (!context) throw new Error("useConfirm must be used within a ConfirmProvider");
	return context.confirm;
}
function usePrompt() {
	const context = (0, import_react.useContext)(ConfirmContext);
	if (!context) throw new Error("usePrompt must be used within a ConfirmProvider");
	return context.prompt;
}
//#endregion
export { usePrompt as a, useConfirm as i, ConfirmProvider as n, cn as r, Button as t };
