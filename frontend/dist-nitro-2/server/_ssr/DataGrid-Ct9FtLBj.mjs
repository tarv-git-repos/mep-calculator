import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Dt as ChevronRight, Ot as ChevronDown } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as ContextMenu, s as ContextMenuTrigger } from "./AppShell-Blf5aT0O.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/DataGrid-Ct9FtLBj.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ROW_H = 30;
var OVERSCAN = 8;
function DataGrid({ rows, columns, selected, onToggle: onToggleProp, onToggleAll: onToggleAllProp, renderContextMenu, groupBy, groupOrder, renderGroupHeader, renderGroupContextMenu, onToggleGroup, onRowDoubleClick, activeRowId, rowClassName, stickyHeaderTop, gridId }) {
	const onToggle = (id, isShift, isCtrl) => {
		if (window.__mep_is_readonly) {
			toast.info("Workspace is in Read-Only mode. Selection is locked.", { id: "readonly-notice" });
			return;
		}
		onToggleProp(id, isShift, isCtrl);
	};
	const onToggleAll = () => {
		if (window.__mep_is_readonly) {
			toast.info("Workspace is in Read-Only mode. Selection is locked.", { id: "readonly-notice" });
			return;
		}
		onToggleAllProp();
	};
	const ref = (0, import_react.useRef)(null);
	const headerRef = (0, import_react.useRef)(null);
	const [scrollTop, setScrollTop] = (0, import_react.useState)(0);
	const [height, setHeight] = (0, import_react.useState)(600);
	const [colRatios, setColRatios] = (0, import_react.useState)({});
	const [collapsedGroups, setCollapsedGroups] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [highlightedRowId, setHighlightedRowId] = (0, import_react.useState)(null);
	const containerWidthRef = (0, import_react.useRef)(1e3);
	(0, import_react.useEffect)(() => {
		const totalDefault = columns.reduce((sum, c) => sum + c.width, 0);
		const initialRatios = {};
		columns.forEach((c) => {
			initialRatios[String(c.key)] = c.width / totalDefault;
		});
		if (gridId) try {
			const saved = localStorage.getItem(`mep_grid_${gridId}`);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (columns.every((c) => typeof parsed[String(c.key)] === "number")) {
					setColRatios(parsed);
					return;
				}
			}
		} catch (e) {}
		setColRatios(initialRatios);
	}, [columns, gridId]);
	const handleMouseDown = (key, e) => {
		e.preventDefault();
		const startX = e.clientX;
		const colIndex = columns.findIndex((c) => String(c.key) === key);
		if (colIndex === -1 || colIndex === columns.length - 1) return;
		const key1 = String(columns[colIndex].key);
		const key2 = String(columns[colIndex + 1].key);
		const totalDefault = columns.reduce((sum, c) => sum + c.width, 0);
		const r1 = colRatios[key1] ?? columns[colIndex].width / totalDefault;
		const r2 = colRatios[key2] ?? columns[colIndex + 1].width / totalDefault;
		const rSum = r1 + r2;
		const availableWidth = containerWidthRef.current - 36;
		const handleMouseMove = (moveEvent) => {
			const deltaRatio = (moveEvent.clientX - startX) / availableWidth;
			let nextR1 = r1 + deltaRatio;
			let nextR2 = r2 - deltaRatio;
			const minW1 = Math.min(columns[colIndex].width, 50);
			const minW2 = Math.min(columns[colIndex + 1].width, 50);
			const minRatio1 = minW1 / availableWidth;
			const minRatio2 = minW2 / availableWidth;
			if (nextR1 < minRatio1) {
				nextR1 = minRatio1;
				nextR2 = rSum - minRatio1;
			} else if (nextR2 < minRatio2) {
				nextR2 = minRatio2;
				nextR1 = rSum - minRatio2;
			}
			setColRatios((prev) => ({
				...prev,
				[key1]: nextR1,
				[key2]: nextR2
			}));
		};
		const handleMouseUp = () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = "";
			document.body.classList.remove("select-none");
			if (gridId) setColRatios((prev) => {
				localStorage.setItem(`mep_grid_${gridId}`, JSON.stringify(prev));
				return prev;
			});
		};
		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
		document.body.style.cursor = "col-resize";
		document.body.classList.add("select-none");
	};
	(0, import_react.useEffect)(() => {
		const el = ref.current;
		if (!el) return;
		let timeoutId;
		const update = () => {
			containerWidthRef.current = el.clientWidth;
			if (timeoutId) return;
			timeoutId = setTimeout(() => {
				setHeight(el.clientHeight);
				timeoutId = null;
			}, 100);
		};
		update();
		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => {
			ro.disconnect();
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, []);
	const items = (0, import_react.useMemo)(() => {
		if (!groupBy) return rows.map((r) => ({
			type: "row",
			id: r.id,
			data: r
		}));
		const groups = {};
		rows.forEach((r) => {
			const val = groupBy(r) || "Unknown";
			if (!groups[val]) groups[val] = [];
			groups[val].push(r);
		});
		const result = [];
		Object.keys(groups).sort((a, b) => {
			if (groupOrder && groupOrder.length > 0) {
				const idxA = groupOrder.indexOf(a);
				const idxB = groupOrder.indexOf(b);
				if (idxA !== -1 && idxB !== -1) return idxA - idxB;
				if (idxA !== -1) return -1;
				if (idxB !== -1) return 1;
			}
			return a.localeCompare(b, void 0, {
				numeric: true,
				sensitivity: "base"
			});
		}).forEach((groupVal) => {
			result.push({
				type: "group",
				id: `group-header-${groupVal}`,
				groupValue: groupVal
			});
			if (!collapsedGroups.has(groupVal)) groups[groupVal].forEach((r) => {
				result.push({
					type: "row",
					id: r.id,
					data: r
				});
			});
		});
		return result;
	}, [
		rows,
		groupBy,
		groupOrder,
		collapsedGroups
	]);
	const isSticky = stickyHeaderTop !== void 0;
	const total = items.length;
	const start = isSticky ? 0 : Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
	const visible = isSticky ? total : Math.ceil(height / ROW_H) + OVERSCAN * 2;
	const end = isSticky ? total : Math.min(total, start + visible);
	const slice = isSticky ? items : items.slice(start, end);
	const itemsRef = (0, import_react.useRef)(items);
	itemsRef.current = items;
	const heightRef = (0, import_react.useRef)(height);
	heightRef.current = height;
	const highlightTimeoutRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const handleScrollToItem = (e) => {
			const customEvent = e;
			if (!customEvent || !customEvent.detail) return;
			const { id: itemId, name: targetName } = customEvent.detail;
			const currentItems = itemsRef.current;
			const currentHeight = heightRef.current;
			const itemIndex = currentItems.findIndex((item) => itemId && (item.id === itemId || item.data && item.data.id === itemId) || targetName && item.data && String(item.data.name).toLowerCase().trim() === String(targetName).toLowerCase().trim());
			if (itemIndex !== -1 && ref.current) {
				const matchedItem = currentItems[itemIndex];
				const actualId = matchedItem.data?.id || matchedItem.id;
				const topOffset = itemIndex * ROW_H;
				ref.current.scrollTop = Math.max(0, topOffset - currentHeight / 2 + ROW_H / 2);
				setHighlightedRowId(actualId);
				if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
				highlightTimeoutRef.current = setTimeout(() => {
					setHighlightedRowId(null);
					highlightTimeoutRef.current = null;
				}, 3e3);
			}
		};
		window.addEventListener("mep-scroll-to-item", handleScrollToItem);
		return () => {
			window.removeEventListener("mep-scroll-to-item", handleScrollToItem);
			if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
		};
	}, []);
	const gridTemplate = `36px ${columns.map((c) => {
		const ratio = colRatios[String(c.key)];
		if (ratio !== void 0) return `minmax(${Math.min(c.width, 50)}px, ${ratio}fr)`;
		return `${c.width}px`;
	}).join(" ")}`;
	const allSelected = (selected?.size ?? 0) === rows.length && rows.length > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `flex flex-col bg-background w-full ${isSticky ? "h-auto" : "h-full overflow-hidden"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: headerRef,
			style: isSticky ? {
				position: "sticky",
				top: stickyHeaderTop,
				zIndex: 25
			} : void 0,
			className: `bg-background dark:bg-[#1a1a1a] border-t border-b border-border-strong overflow-hidden w-full transition-all duration-300 shadow-2xs ${activeRowId ? "blur-[1px] opacity-35 pointer-events-none" : ""}`,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid h-10 items-center text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground w-full",
				style: { gridTemplateColumns: gridTemplate },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "px-2 grid place-items-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: allSelected,
						onChange: onToggleAll,
						className: "size-3 accent-primary"
					})
				}), columns.map((c) => {
					const k = String(c.key);
					const isLast = columns.indexOf(c) === columns.length - 1;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `relative px-2 border-l border-transparent hover:border-border transition-colors duration-150 first:border-l-0 group flex items-center h-full ${c.align === "right" ? "justify-end text-right" : c.align === "center" ? "justify-center text-center" : ""}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "whitespace-pre-line leading-tight",
							children: c.header
						}), !isLast && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							onMouseDown: (e) => handleMouseDown(k, e),
							className: "absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle",
							style: { transform: "translateX(50%)" },
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" })
						})]
					}, k);
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref,
			onScroll: !isSticky ? (e) => {
				const target = e.currentTarget;
				setScrollTop(target.scrollTop);
				if (headerRef.current) headerRef.current.scrollLeft = target.scrollLeft;
			} : void 0,
			className: isSticky ? "w-full relative z-10" : "flex-1 overflow-y-auto overflow-x-hidden w-full relative z-10",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				style: {
					height: total * ROW_H,
					position: "relative"
				},
				className: "w-full",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					style: { transform: `translateY(${start * ROW_H}px)` },
					className: "w-full",
					children: slice.map((item) => {
						if (item.type === "group") {
							const groupVal = item.groupValue;
							const groupRowIds = rows.filter((r) => (groupBy(r) || "Unknown") === groupVal).map((r) => r.id);
							const allSelected = groupRowIds.every((id) => selected.has(id));
							const handleGroupClick = (e) => {
								e.stopPropagation();
								onToggleGroup?.(groupRowIds, !allSelected);
							};
							const isCollapsed = collapsedGroups.has(groupVal);
							const handleToggleCollapse = (e) => {
								e.stopPropagation();
								setCollapsedGroups((prev) => {
									const next = new Set(prev);
									if (next.has(groupVal)) next.delete(groupVal);
									else next.add(groupVal);
									return next;
								});
							};
							const groupContent = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								onClick: handleGroupClick,
								className: `col-span-full h-full bg-primary/5 hover:bg-primary/10 border-b border-border flex items-center border-l-4 border-l-primary pl-1.5 text-[12.5px] font-semibold text-primary select-none cursor-pointer gap-1.5 w-full transition-colors duration-150 ${activeRowId !== void 0 ? "blur-[1px] opacity-30 pointer-events-none scale-[0.99]" : ""}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: handleToggleCollapse,
									className: "p-0.5 rounded hover:bg-primary/10 transition-colors text-primary/70 hover:text-primary flex items-center justify-center cursor-pointer",
									children: isCollapsed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex-1 flex items-center gap-1.5 py-1",
									children: renderGroupHeader ? renderGroupHeader(groupVal) : `Floor: ${groupVal}`
								})]
							});
							if (renderGroupContextMenu) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuTrigger, {
								asChild: true,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "grid h-[30px] w-full",
									style: { gridTemplateColumns: "1fr" },
									children: groupContent
								})
							}), renderGroupContextMenu(groupVal)] }, item.id);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid h-[30px] w-full",
								style: { gridTemplateColumns: "1fr" },
								children: groupContent
							}, item.id);
						}
						const row = item.data;
						const rowIndex = rows.indexOf(row);
						const sel = selected.has(row.id);
						const isActiveRow = activeRowId === row.id;
						const isBlurred = activeRowId !== void 0 && !isActiveRow;
						const blurActiveInput = () => {
							const activeEl = document.activeElement;
							if (!activeEl) return;
							const tagName = activeEl.tagName.toUpperCase();
							if (tagName === "INPUT" && activeEl.type !== "checkbox" && activeEl.type !== "radio" || tagName === "TEXTAREA" || tagName === "SELECT" || activeEl.isContentEditable || activeEl.getAttribute("contenteditable") === "true") activeEl.blur();
						};
						const renderRowContent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "px-2 grid place-items-center",
							onClick: (e) => {
								e.stopPropagation();
								blurActiveInput();
								onToggle(row.id, e.shiftKey, true);
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: sel,
								onChange: () => {},
								className: "size-3 accent-primary cursor-pointer"
							})
						}), columns.map((c) => {
							const isEditable = c.editable;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `px-2 truncate flex items-center ${c.align === "right" ? "justify-end text-right" : c.align === "center" ? "justify-center text-center w-full" : ""} ${c.mono ? "font-mono tabular text-[13.5px]" : ""} ${isEditable ? "group/cell cursor-pointer hover:bg-primary/5 transition-colors" : ""}`,
								title: isEditable ? "Double-click to edit" : void 0,
								children: c.render ? c.render(row) : row[c.key]
							}, String(c.key));
						})] });
						if (renderContextMenu) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ContextMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMenuTrigger, {
							asChild: true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								id: `row-${row.id}`,
								onClick: (e) => {
									const target = e.target;
									if (!(target.tagName === "INPUT" && target.type !== "checkbox" && target.type !== "radio" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable || target.getAttribute("contenteditable") === "true")) {
										blurActiveInput();
										onToggle(row.id, e.shiftKey, e.ctrlKey || e.metaKey);
									} else if (!selected.has(row.id)) onToggle(row.id, false, false);
								},
								onDoubleClick: () => {
									if (!selected.has(row.id)) onToggle(row.id, false, false);
									onRowDoubleClick?.(row);
								},
								onContextMenu: () => {
									if (!selected.has(row.id)) onToggle(row.id, false, false);
								},
								className: `grid items-center text-[13.5px] border-b border-border/60 hover:bg-row-hover cursor-default select-none w-full transition-colors duration-150 ${rowClassName && !sel ? rowClassName(row, rowIndex) : ""} ${sel ? "bg-row-selected" : ""} ${isActiveRow ? "relative z-40 bg-white dark:bg-[#222226] shadow-[0_4px_25px_rgba(0,0,0,0.12)] ring-1 ring-primary/25 scale-[1.015] border-y border-y-primary/40 font-semibold" : ""} ${highlightedRowId === row.id ? "row-highlight-flash" : ""} ${isBlurred ? "blur-[1px] opacity-25 scale-[0.99] pointer-events-none" : ""}`,
								style: {
									gridTemplateColumns: gridTemplate,
									height: ROW_H
								},
								children: renderRowContent()
							})
						}), renderContextMenu(row)] }, row.id);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							id: `row-${row.id}`,
							onClick: (e) => {
								const target = e.target;
								if (!(target.tagName === "INPUT" && target.type !== "checkbox" && target.type !== "radio" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable || target.getAttribute("contenteditable") === "true")) {
									blurActiveInput();
									onToggle(row.id, e.shiftKey, e.ctrlKey || e.metaKey);
								} else if (!selected.has(row.id)) onToggle(row.id, false, false);
							},
							onDoubleClick: () => {
								if (!selected.has(row.id)) onToggle(row.id, false, false);
								onRowDoubleClick?.(row);
							},
							className: `grid items-center text-[13.5px] border-b border-border/60 hover:bg-row-hover cursor-default select-none w-full transition-colors duration-150 ${rowClassName && !sel ? rowClassName(row, rowIndex) : ""} ${sel ? "bg-row-selected" : ""} ${isActiveRow ? "relative z-40 bg-white dark:bg-[#222226] shadow-[0_4px_25px_rgba(0,0,0,0.12)] ring-1 ring-primary/25 scale-[1.015] border-y border-y-primary/40 font-semibold" : ""} ${highlightedRowId === row.id ? "row-highlight-flash" : ""} ${isBlurred ? "blur-[1px] opacity-25 scale-[0.99] pointer-events-none" : ""}`,
							style: {
								gridTemplateColumns: gridTemplate,
								height: ROW_H
							},
							children: renderRowContent()
						}, row.id);
					})
				})
			})
		})]
	});
}
//#endregion
export { DataGrid as t };
