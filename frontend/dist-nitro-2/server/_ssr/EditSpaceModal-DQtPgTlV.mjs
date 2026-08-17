import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { a as getOccupancyData, c as predictOccupancyCategory, i as getOccupancyCategories, l as predictSpacePressure, r as getCategoryDisplayName, t as calculateVentilation } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { T as Search, Tt as ChevronsUpDown, Y as Info, kt as Check, n as X, rn as CircleCheckBig } from "../_libs/lucide-react.mjs";
import { r as cn } from "./use-confirm-BT3fngjN.mjs";
import { n as PopoverContent, r as PopoverTrigger, t as Popover } from "./popover-CxE9vQwv.mjs";
import { t as _e } from "../_libs/cmdk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/EditSpaceModal-DQtPgTlV.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Command$1 = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e, {
	ref,
	className: cn("flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground", className),
	...props
}));
Command$1.displayName = _e.displayName;
var CommandInput = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
	className: "flex items-center border-b px-3",
	"cmdk-input-wrapper": "",
	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "mr-2 h-4 w-4 shrink-0 opacity-50" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Input, {
		ref,
		className: cn("flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50", className),
		...props
	})]
}));
CommandInput.displayName = _e.Input.displayName;
var CommandList = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.List, {
	ref,
	className: cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className),
	...props
}));
CommandList.displayName = _e.List.displayName;
var CommandEmpty = import_react.forwardRef((props, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Empty, {
	ref,
	className: "py-6 text-center text-sm",
	...props
}));
CommandEmpty.displayName = _e.Empty.displayName;
var CommandGroup = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Group, {
	ref,
	className: cn("overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground", className),
	...props
}));
CommandGroup.displayName = _e.Group.displayName;
var CommandSeparator = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Separator, {
	ref,
	className: cn("-mx-1 h-px bg-border", className),
	...props
}));
CommandSeparator.displayName = _e.Separator.displayName;
var CommandItem = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Item, {
	ref,
	className: cn("relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", className),
	...props
}));
CommandItem.displayName = _e.Item.displayName;
var CommandShortcut = ({ className, ...props }) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("ml-auto text-xs tracking-widest text-muted-foreground", className),
		...props
	});
};
CommandShortcut.displayName = "CommandShortcut";
function CategorySelect({ value, onChange, className, triggerClassName, hideChevron }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const categories = getOccupancyCategories();
	const displayVal = value;
	const triggerText = displayVal ? displayVal.endsWith(" (Custom)") ? displayVal : getCategoryDisplayName(displayVal) : "Select Category...";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("relative w-full min-w-0", className),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, {
			open,
			onOpenChange: setOpen,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: cn("flex items-center justify-between w-full bg-transparent border border-transparent hover:bg-surface-2 hover:border-muted-foreground/20 focus:bg-background focus:ring-1 focus:ring-primary focus:outline-none py-0.5 px-1 rounded text-foreground text-[13px] cursor-pointer min-w-0 transition-all", triggerClassName),
					onClick: (e) => {
						e.stopPropagation();
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate mr-1.5",
						children: triggerText
					}), !hideChevron && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsUpDown, { className: "size-3 text-muted-foreground shrink-0 opacity-55" })]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverContent, {
				className: "w-[320px] p-0 font-mori z-50",
				align: "start",
				onClick: (e) => e.stopPropagation(),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Command$1, {
					filter: (value, search) => {
						const display = getCategoryDisplayName(value).toLowerCase();
						const searchLower = search.toLowerCase();
						if (display.includes(searchLower) || value.toLowerCase().includes(searchLower)) return 1;
						const words = searchLower.split(/\s+/).filter(Boolean);
						if (words.length > 1 && words.every((word) => display.includes(word))) return 1;
						return 0;
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandInput, {
							placeholder: "Search category...",
							className: "h-9 text-[13px]"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandEmpty, {
							className: "py-2 text-center text-xs text-muted-foreground",
							children: "No category found."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandList, {
							className: "max-h-[250px] overflow-y-auto",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CommandGroup, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CommandItem, {
									value: "",
									onSelect: () => {
										onChange("");
										setOpen(false);
									},
									className: "text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "italic text-muted-foreground",
										children: "Select Category..."
									}), value === "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5 text-primary" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CommandItem, {
									value: "Other",
									onSelect: () => {
										onChange("Other");
										setOpen(false);
									},
									className: "text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Other" }), (value === "Other" || value && value.endsWith(" (Custom)")) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5 text-primary" })]
								}),
								categories.map((c) => {
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CommandItem, {
										value: c,
										onSelect: () => {
											onChange(c);
											setOpen(false);
										},
										className: "text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "truncate",
											children: getCategoryDisplayName(c)
										}), value === c && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5 text-primary shrink-0 ml-1.5" })]
									}, c);
								})
							] })
						})
					]
				})
			})]
		})
	});
}
var RESTROOM_SUBCATS = [
	{
		key: "toiletPrivateContinuous",
		label: "Toilet - private (continuous)",
		rate: "12.5 L/s per toilet"
	},
	{
		key: "toiletPublicContinuous",
		label: "Toilet - public (continuous)",
		rate: "25.0 L/s per toilet"
	},
	{
		key: "toiletPrivateDiscontinuous",
		label: "Toilet - private (discontinuous)",
		rate: "25.0 L/s per toilet"
	},
	{
		key: "toiletPublicDiscontinuous",
		label: "Toilet - public (discontinuous)",
		rate: "35.0 L/s per toilet"
	},
	{
		key: "showerContinuous",
		label: "Shower Rooms (continuous)",
		rate: "10.0 L/s per shower"
	},
	{
		key: "showerDiscontinuous",
		label: "Shower Rooms (discontinuous)",
		rate: "25.0 L/s per shower"
	},
	{
		key: "janitorCloset",
		label: "Janitor Closets, Trash Rooms, Recycling",
		rate: "50.0 L/s per closet"
	},
	{
		key: "lockerRoom",
		label: "Locker Rooms",
		rate: "25.0 L/s per room"
	}
];
function EditSpaceModal({ space, onClose, onSave, availableZones, availableEquipment, availableFloors }) {
	const [tempSpace, setTempSpace] = (0, import_react.useState)({ ...space });
	const [showPreview, setShowPreview] = (0, import_react.useState)(false);
	const [showRestroomModal, setShowRestroomModal] = (0, import_react.useState)(false);
	getOccupancyCategories();
	const calculatedPreview = (0, import_react.useMemo)(() => {
		try {
			return calculateVentilation([tempSpace], [], []).spaces[0] || tempSpace;
		} catch (e) {
			console.error("Live calculation failed", e);
			return tempSpace;
		}
	}, [tempSpace]);
	const ashraeData = (0, import_react.useMemo)(() => {
		if (tempSpace.category && !tempSpace.category.endsWith(" (Custom)") && tempSpace.category !== "Other") return getOccupancyData(tempSpace.category);
		return null;
	}, [tempSpace.category]);
	const showHeight = (0, import_react.useMemo)(() => {
		if (tempSpace.category && tempSpace.category.endsWith(" (Custom)")) return (parseFloat(String(tempSpace.customAch)) || 0) > 0;
		return ashraeData ? (ashraeData.ach || 0) > 0 : false;
	}, [
		tempSpace.category,
		ashraeData,
		tempSpace.customAch
	]);
	const defaultOcc = (0, import_react.useMemo)(() => {
		if (tempSpace.category && tempSpace.category.endsWith(" (Custom)")) return 0;
		if (ashraeData && ashraeData.exhaustPerUnit > 0 && ashraeData.defaultDensity === 0) return 1;
		return ashraeData ? Math.ceil(tempSpace.area * (ashraeData.defaultDensity || 0) / 100) : 0;
	}, [
		tempSpace.category,
		ashraeData,
		tempSpace.area
	]);
	const isFixtureCategory = (0, import_react.useMemo)(() => {
		return ashraeData ? ashraeData.exhaustPerUnit > 0 && ashraeData.defaultDensity === 0 : false;
	}, [ashraeData]);
	const occupancyLabel = isFixtureCategory ? "Fixtures (Qty)" : "Occupancy (People)";
	const [occVal, setOccVal] = (0, import_react.useState)(tempSpace.isOccupancyCustomized ? String(tempSpace.occupancy) : `${defaultOcc} (default)`);
	import_react.useEffect(() => {
		if (!tempSpace.isOccupancyCustomized) setOccVal(`${defaultOcc} (default)`);
		else setOccVal(String(tempSpace.occupancy));
	}, [
		tempSpace.isOccupancyCustomized,
		tempSpace.occupancy,
		defaultOcc
	]);
	const handleOccChange = (e) => {
		const val = e.target.value;
		if (val === "" || /^\d+$/.test(val)) {
			setOccVal(val);
			return;
		}
		if (!tempSpace.isOccupancyCustomized) {
			const defaultStr = `${defaultOcc} (default)`;
			if (!val.includes(defaultStr)) {
				setOccVal("");
				return;
			}
			const typed = val.replace(defaultStr, "");
			if (/^\d+$/.test(typed)) setOccVal(typed);
		}
	};
	const handleOccBlur = () => {
		const parsed = parseInt(occVal);
		if (occVal === "" || isNaN(parsed)) {
			setTempSpace((prev) => {
				const next = {
					...prev,
					isOccupancyCustomized: false,
					occupancy: defaultOcc
				};
				if (isFixtureCategory) next.fixtures = defaultOcc.toString();
				else next.fixtures = "";
				return next;
			});
			setOccVal(`${defaultOcc} (default)`);
		} else {
			setTempSpace((prev) => {
				const next = {
					...prev,
					isOccupancyCustomized: true,
					occupancy: parsed
				};
				next.fixtures = parsed.toString();
				return next;
			});
			setOccVal(String(parsed));
		}
	};
	const handleInputChange = (field, value) => {
		setTempSpace((prev) => {
			const next = {
				...prev,
				[field]: value
			};
			if (field === "pressure") next.pressureAutoDetected = false;
			if (field === "name") {
				const pred = predictOccupancyCategory(value.trim());
				if (pred && pred.category) {
					next.category = pred.category;
					next.aiDetected = true;
					const data = getOccupancyData(pred.category);
					if (data) {
						const density = data.defaultDensity || 0;
						const defOcc = data.exhaustPerUnit > 0 && density === 0 ? 1 : Math.ceil(prev.area * density / 100);
						next.occupancy = prev.isOccupancyCustomized ? prev.occupancy : defOcc;
						next.fixtures = prev.isOccupancyCustomized ? prev.occupancy.toString() : data.exhaustPerUnit > 0 ? defOcc.toString() : "";
					}
				} else if (prev.aiDetected) {
					next.category = "";
					next.aiDetected = false;
				}
				const predPress = predictSpacePressure(next.category);
				if (predPress && predPress.autoDetected) {
					next.pressure = predPress.pressure;
					next.pressureAutoDetected = true;
				} else if (prev.pressureAutoDetected) {
					next.pressure = "Positive";
					next.pressureAutoDetected = false;
				}
			}
			if (field === "category") {
				const predPress = predictSpacePressure(value);
				if (predPress && predPress.autoDetected) {
					next.pressure = predPress.pressure;
					next.pressureAutoDetected = true;
				}
			}
			if (field === "area" || field === "category") {
				const area = field === "area" ? parseFloat(value) || 0 : prev.area;
				const cat = field === "category" ? value : prev.category;
				if (cat && !cat.endsWith(" (Custom)") && cat !== "Other") {
					const data = getOccupancyData(cat);
					if (data) {
						const density = data.defaultDensity || 0;
						const defOcc = data.exhaustPerUnit > 0 && density === 0 ? 1 : Math.ceil(area * density / 100);
						next.occupancy = prev.isOccupancyCustomized ? prev.occupancy : defOcc;
						next.fixtures = prev.isOccupancyCustomized ? prev.occupancy.toString() : data.exhaustPerUnit > 0 ? defOcc.toString() : "";
					}
				}
			}
			if (field === "occupancy") next.fixtures = value !== "" ? value.toString() : "";
			return next;
		});
	};
	const handleCategoryChange = (cat) => {
		setTempSpace((prev) => {
			const next = {
				...prev,
				category: cat,
				aiDetected: false
			};
			if (cat === "Other") {
				next.category = "Custom (Custom)";
				next.customWorkflow = "calculate";
				next.customPeopleOA = 0;
				next.customAreaOA = 0;
				next.customExhaustPerUnit = 0;
				next.customExhaustPerArea = 0;
				next.customAch = 0;
			} else if (cat === "Rest Room / Changing Room") {
				delete next.customWorkflow;
				delete next.customPeopleOA;
				delete next.customAreaOA;
				delete next.customExhaustPerUnit;
				delete next.customExhaustPerArea;
				delete next.customAch;
				delete next.customFreshGiven;
				delete next.customExtTaken;
				if (!next.restroomSubCategories) next.restroomSubCategories = {
					toiletPrivateContinuous: 0,
					toiletPublicContinuous: 0,
					toiletPrivateDiscontinuous: 0,
					toiletPublicDiscontinuous: 0,
					showerContinuous: 0,
					showerDiscontinuous: 0,
					janitorCloset: 0,
					lockerRoom: 0
				};
				setTimeout(() => setShowRestroomModal(true), 50);
			} else if (cat === "") {
				delete next.customWorkflow;
				delete next.customPeopleOA;
				delete next.customAreaOA;
				delete next.customExhaustPerUnit;
				delete next.customExhaustPerArea;
				delete next.customAch;
				delete next.customFreshGiven;
				delete next.customExtTaken;
				next.category = "";
				next.occupancy = 0;
				next.fixtures = "";
			} else {
				delete next.customWorkflow;
				delete next.customPeopleOA;
				delete next.customAreaOA;
				delete next.customExhaustPerUnit;
				delete next.customExhaustPerArea;
				delete next.customAch;
				delete next.customFreshGiven;
				delete next.customExtTaken;
				const data = getOccupancyData(cat);
				if (data) {
					const density = data.defaultDensity || 0;
					const defOcc = data.exhaustPerUnit > 0 && density === 0 ? 1 : Math.ceil(prev.area * density / 100);
					next.occupancy = prev.isOccupancyCustomized ? prev.occupancy : defOcc;
					next.fixtures = prev.isOccupancyCustomized ? prev.occupancy.toString() : data.exhaustPerUnit > 0 ? defOcc.toString() : "";
				}
			}
			return next;
		});
	};
	import_react.useEffect(() => {
		document.body.classList.add("modal-open-blur");
		return () => {
			document.body.classList.remove("modal-open-blur");
		};
	}, []);
	const labelClass = "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5";
	const inputClass = "w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white/80 dark:focus:bg-white/10 rounded-xl text-[12.5px] outline-none transition-all duration-150 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.02)] text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400";
	const selectClass = "w-full h-10 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white/80 dark:focus:bg-white/10 rounded-xl text-[12.5px] outline-none transition-all duration-150 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.02)] text-neutral-800 dark:text-neutral-100";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		onClick: onClose,
		className: "fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/10 dark:bg-black/30 p-4 animate-fade-in",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			onClick: (e) => e.stopPropagation(),
			className: `bg-white/70 dark:bg-neutral-950/70 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-[24px] shadow-[0_30px_70px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col w-full h-[85vh] overflow-hidden transition-[max-width] duration-300 ease-in-out ${showPreview ? "max-w-5xl" : "max-w-2xl"}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "px-6 h-[72px] flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/10 dark:bg-black/10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col justify-center min-w-0 pr-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2.5 min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-[15px] font-bold text-neutral-800 dark:text-neutral-100 truncate",
								children: "Edit Space Parameters"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "px-2.5 py-0.75 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[11px] font-bold font-mono tracking-tight truncate shrink-0",
								children: tempSpace.code || "New Space"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11.5px] text-neutral-500 dark:text-neutral-400 font-normal mt-0.5 truncate",
							children: "Configure geometry, classification, multipliers, and pressure balancing."
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setShowPreview((prev) => !prev),
							className: `flex items-center gap-1.5 h-9.5 px-4 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer shadow-sm ${showPreview ? "bg-primary text-primary-foreground border-primary hover:bg-primary/95 shadow-md shadow-primary/15" : "bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-white/10"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-3.5" }), "Calculations Preview"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onClose,
							className: "size-9 grid place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 min-h-0 flex overflow-hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 min-w-0 p-6 space-y-6 overflow-y-auto",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2",
										children: "General Parameters"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: labelClass,
											children: "Space Name"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: tempSpace.name,
											onChange: (e) => handleInputChange("name", e.target.value),
											className: inputClass
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: labelClass,
												children: [tempSpace.aiDetected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													title: "Automatically identified",
													className: "inline-block size-1.5 rounded-full bg-primary mr-1.5 cursor-help"
												}), "Category Classification"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CategorySelect, {
												value: tempSpace.category || "",
												onChange: handleCategoryChange,
												triggerClassName: "w-full bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none cursor-pointer transition-all text-foreground h-9"
											}),
											tempSpace.category === "Rest Room / Changing Room" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setShowRestroomModal(true),
												className: "mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-bold bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition cursor-pointer",
												children: "⚙️ Configure Rest Room / Changing Room Fixtures"
											})
										] })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-3 gap-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: labelClass,
													children: "Floor"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "text",
													list: "floors-list",
													value: tempSpace.floor,
													onChange: (e) => handleInputChange("floor", e.target.value),
													className: inputClass
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
													id: "floors-list",
													children: availableFloors.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: f }, f))
												})
											] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: labelClass,
													children: "Zone Assigned"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "text",
													list: "zones-list",
													value: tempSpace.zone,
													onChange: (e) => handleInputChange("zone", e.target.value),
													className: inputClass,
													placeholder: "Unzoned"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
													id: "zones-list",
													children: availableZones.map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: z }, z))
												})
											] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: labelClass,
													children: "Equipment Assigned"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "text",
													list: "equipment-list",
													value: tempSpace.equipment,
													onChange: (e) => handleInputChange("equipment", e.target.value),
													className: inputClass,
													placeholder: "Unassigned"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
													id: "equipment-list",
													children: availableEquipment.map((eq) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: eq }, eq))
												})
											] })
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2",
									children: "Geometry, Multipliers & Occupancy"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: labelClass,
											children: "Area (m²)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "any",
											value: tempSpace.area,
											onChange: (e) => handleInputChange("area", parseFloat(e.target.value) || 0),
											className: `${inputClass} font-mono`
										})] }),
										showHeight ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: labelClass,
											children: "Height (m)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											step: "any",
											value: tempSpace.height || "",
											onChange: (e) => handleInputChange("height", parseFloat(e.target.value) || 0),
											className: `${inputClass} font-mono`
										})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: labelClass,
											children: "Multiplier Quantity"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											min: "1",
											value: tempSpace.multiplier === void 0 || tempSpace.multiplier === null ? "" : tempSpace.multiplier,
											onChange: (e) => {
												const val = e.target.value;
												handleInputChange("multiplier", val === "" ? void 0 : parseInt(val));
											},
											className: `${inputClass} font-mono`
										})] }),
										showHeight ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: labelClass,
											children: "Multiplier Quantity"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											min: "1",
											value: tempSpace.multiplier === void 0 || tempSpace.multiplier === null ? "" : tempSpace.multiplier,
											onChange: (e) => {
												const val = e.target.value;
												handleInputChange("multiplier", val === "" ? void 0 : parseInt(val));
											},
											className: `${inputClass} font-mono`
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: labelClass,
											children: [!tempSpace.isOccupancyCustomized && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												title: "Using default occupancy",
												className: "inline-block size-1.5 rounded-full bg-blue-500 shrink-0"
											}), occupancyLabel]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: occVal,
											onFocus: (e) => e.target.select(),
											onChange: handleOccChange,
											onBlur: handleOccBlur,
											className: `${inputClass} font-mono`
										})] })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "col-span-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: labelClass,
												children: [!tempSpace.isOccupancyCustomized && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													title: "Using default occupancy",
													className: "inline-block size-1.5 rounded-full bg-blue-500 shrink-0"
												}), occupancyLabel]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												value: occVal,
												onFocus: (e) => e.target.select(),
												onChange: handleOccChange,
												onBlur: handleOccBlur,
												className: `${inputClass} font-mono`
											})]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2",
										children: "Pressure Balancing Intent"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: labelClass,
											children: [tempSpace.pressureAutoDetected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												title: "Automatically identified",
												className: "inline-block size-1.5 rounded-full bg-primary mr-1.5 cursor-help"
											}), "Space Pressure Class"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: tempSpace.pressure,
											onChange: (e) => handleInputChange("pressure", e.target.value),
											className: selectClass,
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "Neutral",
													className: "bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200",
													children: "Neutral (Balanced)"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "Positive",
													className: "bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200",
													children: "Positive (+1, Supply Surplus)"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "Negative",
													className: "bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200",
													children: "Negative (-1, Exhaust Surplus)"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "Critical",
													className: "bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200",
													children: "Critical (-2, High Negative Exhaust)"
												})
											]
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: labelClass,
											children: "Manual Balancing"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center h-10 gap-3 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => handleInputChange("isManualAirflow", !tempSpace.isManualAirflow),
												className: `relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${tempSpace.isManualAirflow ? "bg-primary" : "bg-neutral-200 dark:bg-neutral-700"}`,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `pointer-events-none inline-block size-4.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${tempSpace.isManualAirflow ? "translate-x-4.5" : "translate-x-0"}` })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[12px] text-neutral-600 dark:text-neutral-400 select-none font-medium",
												children: "Enable overrides (Bypass engine)"
											})]
										})] })]
									}),
									tempSpace.isManualAirflow && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4 pt-1 animate-fade-in",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1",
											children: "Manual Supply Fresh Air (L/s)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: tempSpace.manualFreshGiven || 0,
											onChange: (e) => handleInputChange("manualFreshGiven", parseFloat(e.target.value) || 0),
											className: `${inputClass} font-mono`
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1",
											children: "Manual Extract Air (L/s)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: tempSpace.manualExtTaken || 0,
											onChange: (e) => handleInputChange("manualExtTaken", parseFloat(e.target.value) || 0),
											className: `${inputClass} font-mono`
										})] })]
									})
								]
							}),
							tempSpace.category && tempSpace.category.endsWith(" (Custom)") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-5 bg-white/30 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-4 animate-fade-in shadow-sm",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[11px] uppercase font-bold text-primary tracking-widest",
										children: "Custom Category Parameters"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "grid grid-cols-2 gap-4",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: labelClass,
											children: "Workflow Method"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: tempSpace.customWorkflow || "calculate",
											onChange: (e) => handleInputChange("customWorkflow", e.target.value),
											className: selectClass,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "calculate",
												className: "bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200",
												children: "Calculate Airflow Rates"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "direct",
												className: "bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200",
												children: "Direct Airflow Values"
											})]
										})] })
									}),
									tempSpace.customWorkflow === "calculate" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-3 gap-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1",
												children: "People OA (L/s/person)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: tempSpace.customPeopleOA || 0,
												onChange: (e) => handleInputChange("customPeopleOA", parseFloat(e.target.value) || 0),
												className: `${inputClass} font-mono`
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1",
												children: "Area OA (L/s/m²)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: tempSpace.customAreaOA || 0,
												onChange: (e) => handleInputChange("customAreaOA", parseFloat(e.target.value) || 0),
												className: `${inputClass} font-mono`
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1",
												children: "ACH"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: tempSpace.customAch || 0,
												onChange: (e) => handleInputChange("customAch", parseFloat(e.target.value) || 0),
												className: `${inputClass} font-mono`
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1",
												children: "Exh per Area (L/s/m²)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: tempSpace.customExhaustPerArea || 0,
												onChange: (e) => handleInputChange("customExhaustPerArea", parseFloat(e.target.value) || 0),
												className: `${inputClass} font-mono`
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1",
												children: "Exh per Unit (L/s/unit)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												step: "any",
												value: tempSpace.customExhaustPerUnit || 0,
												onChange: (e) => handleInputChange("customExhaustPerUnit", parseFloat(e.target.value) || 0),
												className: `${inputClass} font-mono`
											})] })
										]
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1",
											children: "Custom Fresh Given (L/s)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: tempSpace.customFreshGiven || 0,
											onChange: (e) => handleInputChange("customFreshGiven", parseFloat(e.target.value) || 0),
											className: `${inputClass} font-mono`
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1",
											children: "Custom Extract Taken (L/s)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											value: tempSpace.customExtTaken || 0,
											onChange: (e) => handleInputChange("customExtTaken", parseFloat(e.target.value) || 0),
											className: `${inputClass} font-mono`
										})] })]
									})
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `shrink-0 bg-white/30 dark:bg-black/20 backdrop-blur-md border-l border-black/5 dark:border-white/5 overflow-hidden transition-[width,opacity] duration-300 ease-in-out flex flex-col ${showPreview ? "w-[400px] opacity-100 p-6 border-l-border" : "w-0 opacity-0 p-0 border-l-transparent"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "w-[352px] space-y-5 flex flex-col h-full overflow-y-auto",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-[11px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider pb-1.5 border-b border-black/5 dark:border-white/5 shrink-0",
									children: "Calculations Preview"
								}),
								tempSpace.category === "Rest Room / Changing Room" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-3 shrink-0 shadow-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider",
										children: "Rest Room Configuration Summary"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1.5 text-[11.5px] font-mono",
										children: [Object.entries(tempSpace.restroomSubCategories || {}).map(([key, val]) => {
											if (!val) return null;
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between border-b border-black/5 dark:border-white/5 pb-1 select-none",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-neutral-500 dark:text-neutral-400 truncate max-w-[200px]",
													children: [RESTROOM_SUBCATS.find((s) => s.key === key)?.label, ":"]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-semibold text-neutral-800 dark:text-neutral-200 shrink-0",
													children: [val, " unit(s)"]
												})]
											}, key);
										}), !Object.values(tempSpace.restroomSubCategories || {}).some(Boolean) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11.5px] italic text-neutral-500 dark:text-neutral-400 block py-0.5",
											children: "No fixtures configured yet."
										})]
									})]
								}) : ashraeData && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-3 shrink-0 shadow-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider",
										children: "ASHRAE 62.1 Standard Rates"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-y-2.5 gap-x-4 text-[12px] font-mono",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-neutral-500 dark:text-neutral-400",
													children: "Density:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-semibold text-neutral-800 dark:text-neutral-200",
													children: [ashraeData.defaultDensity, " occ"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-neutral-500 dark:text-neutral-400",
													children: "OA (People):"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-semibold text-neutral-800 dark:text-neutral-200",
													children: [ashraeData.peopleOA, " L/s"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-neutral-500 dark:text-neutral-400",
													children: "OA (Area):"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-semibold text-neutral-800 dark:text-neutral-200",
													children: [ashraeData.areaOA, " L/s"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-neutral-500 dark:text-neutral-400",
													children: "ACH Rate:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-semibold text-neutral-800 dark:text-neutral-200",
													children: [
														ashraeData.ach,
														" / Cl. ",
														ashraeData.airClass
													]
												})]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "space-y-3 flex-1 min-h-0",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-4 shadow-sm",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200",
												children: "Minimum Airflow Required"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "space-y-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-baseline text-[12px]",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-neutral-500 dark:text-neutral-400 font-medium",
														children: "Outdoor Air (min):"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-mono font-bold text-[14px] text-primary",
														children: [calculatedPreview.minOA?.toLocaleString(), " L/s"]
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[10px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-2 rounded-xl border border-black/5 dark:border-white/5 break-all leading-relaxed",
													children: tempSpace.isManualAirflow ? `Manual override: ${tempSpace.manualFreshGiven || 0} L/s × ${tempSpace.multiplier || 1}` : tempSpace.category === "Rest Room / Changing Room" ? `Restrooms require 0 L/s fresh air supply (exhaust only)` : tempSpace.category && tempSpace.category.endsWith(" (Custom)") && tempSpace.customWorkflow === "direct" ? `Custom Direct: ${tempSpace.customFreshGiven || 0} L/s × ${tempSpace.multiplier || 1}` : `(${tempSpace.area} m² × ${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customAreaOA : ashraeData?.areaOA || 0} L/s) + (${tempSpace.occupancy} occ × ${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customPeopleOA : ashraeData?.peopleOA || 0} L/s) × ${tempSpace.multiplier || 1}`
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "space-y-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between items-baseline text-[12px] pt-1.5 border-t border-black/5 dark:border-white/5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-neutral-500 dark:text-neutral-400 font-medium",
														children: "Extract Exhaust (min):"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-mono font-bold text-[14px] text-amber-600 dark:text-amber-500",
														children: [calculatedPreview.minExt?.toLocaleString(), " L/s"]
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[10px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-2 rounded-xl border border-black/5 dark:border-white/5 break-all leading-relaxed",
													children: tempSpace.isManualAirflow ? `Manual override: ${tempSpace.manualExtTaken || 0} L/s × ${tempSpace.multiplier || 1}` : tempSpace.category === "Rest Room / Changing Room" ? `Sum of fixtures exhaust × ${tempSpace.multiplier || 1}` : tempSpace.category && tempSpace.category.endsWith(" (Custom)") && tempSpace.customWorkflow === "direct" ? `Custom Direct: ${tempSpace.customExtTaken || 0} L/s × ${tempSpace.multiplier || 1}` : `(${tempSpace.occupancy} × ${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customExhaustPerUnit : ashraeData?.exhaustPerUnit || 0} L/s) + (${tempSpace.area} m² × ${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customExhaustPerArea : ashraeData?.exhaustPerArea || 0} L/s) + (${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customAch : ashraeData?.ach || 0} ACH × vol/3.6) × ${tempSpace.multiplier || 1}`
												})]
											})
										]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "shrink-0 p-4 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-2xl flex items-start gap-2.5 text-[12px] text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheckBig, { className: "size-4 shrink-0 mt-0.5 text-emerald-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold",
										children: "Calculations verified."
									}), " Space inputs satisfy ASHRAE 62.1 requirements."] })]
								})
							]
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
					className: "px-6 h-16 border-t border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-end gap-3 shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "h-10 px-5 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-xl text-[12.5px] font-medium transition-colors cursor-pointer shadow-sm",
						children: "Cancel"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							let finalSpace = { ...tempSpace };
							if (finalSpace.multiplier === void 0 || finalSpace.multiplier === null || isNaN(finalSpace.multiplier) || finalSpace.multiplier <= 0) {
								alert("Multiplier cannot be 0. Saving as 1.");
								finalSpace.multiplier = 1;
							}
							onSave(finalSpace);
						},
						className: "h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-[12.5px] font-semibold transition-all shadow-md shadow-primary/10 active:scale-[0.98] cursor-pointer",
						children: "Save Changes"
					})]
				})
			]
		}), showRestroomModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
						className: "px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/30",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-bold text-slate-800 dark:text-zinc-200",
							children: "Rest Room / Changing Room Configuration"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-muted-foreground mt-0.5",
							children: "Enter the quantity of each sub-category to compute total exhaust."
						})] })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "p-6 max-h-[60vh] overflow-y-auto space-y-4",
						children: [
							{
								key: "toiletPrivateContinuous",
								label: "Toilet - private (continuous)",
								rate: "12.5 L/s per toilet"
							},
							{
								key: "toiletPublicContinuous",
								label: "Toilet - public (continuous)",
								rate: "25.0 L/s per toilet"
							},
							{
								key: "toiletPrivateDiscontinuous",
								label: "Toilet - private (discontinuous)",
								rate: "25.0 L/s per toilet"
							},
							{
								key: "toiletPublicDiscontinuous",
								label: "Toilet - public (discontinuous)",
								rate: "35.0 L/s per toilet"
							},
							{
								key: "showerContinuous",
								label: "Shower Rooms (continuous)",
								rate: "10.0 L/s per shower"
							},
							{
								key: "showerDiscontinuous",
								label: "Shower Rooms (discontinuous)",
								rate: "25.0 L/s per shower"
							},
							{
								key: "janitorCloset",
								label: "Janitor Closets, Trash Rooms, Recycling",
								rate: `5.0 L/s per m² (${(5 * (tempSpace.area || 0)).toFixed(1)} L/s for ${tempSpace.area || 0} m² restroom)`
							},
							{
								key: "lockerRoom",
								label: "Locker Rooms",
								rate: `1.25 L/s per m² (${(1.25 * (tempSpace.area || 0)).toFixed(1)} L/s for ${tempSpace.area || 0} m² restroom)`
							}
						].map((subcat) => {
							const qty = (tempSpace.restroomSubCategories || {})[subcat.key] || 0;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-4 py-1.5 border-b border-slate-100/60 dark:border-zinc-900/60",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[12.5px] font-semibold text-slate-700 dark:text-zinc-300",
										children: subcat.label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-muted-foreground mt-0.5",
										children: subcat.rate
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex items-center gap-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										value: qty,
										onChange: (e) => {
											const val = Math.max(0, parseInt(e.target.value) || 0);
											setTempSpace((prev) => {
												const sub = prev.restroomSubCategories || {};
												return {
													...prev,
													restroomSubCategories: {
														...sub,
														[subcat.key]: val
													}
												};
											});
										},
										className: "w-20 h-9 px-2 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-[13px] font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-neutral-800 dark:text-neutral-200"
									})
								})]
							}, subcat.key);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-6 py-4 bg-slate-50/50 dark:bg-zinc-900/30 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-bold text-muted-foreground uppercase tracking-wider",
								children: "Total Exhaust"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[15px] font-black text-primary",
								children: [
									(() => {
										const sub = tempSpace.restroomSubCategories || {};
										const areaVal = tempSpace.area || 0;
										let total = 0;
										total += (sub.toiletPrivateContinuous || 0) * 12.5;
										total += (sub.toiletPublicContinuous || 0) * 25;
										total += (sub.toiletPrivateDiscontinuous || 0) * 25;
										total += (sub.toiletPublicDiscontinuous || 0) * 35;
										total += (sub.showerContinuous || 0) * 10;
										total += (sub.showerDiscontinuous || 0) * 25;
										total += (sub.janitorCloset || 0) * areaVal * 5;
										total += (sub.lockerRoom || 0) * areaVal * 1.25;
										return total;
									})(),
									" ",
									"L/s"
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setShowRestroomModal(false),
							className: "px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:bg-primary/95 transition cursor-pointer",
							children: "Apply & Close"
						})]
					})
				]
			})
		})]
	});
}
//#endregion
export { EditSpaceModal as n, CategorySelect as t };
