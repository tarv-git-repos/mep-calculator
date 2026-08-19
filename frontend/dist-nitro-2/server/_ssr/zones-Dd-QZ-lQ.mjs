import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as calculateVentilation, u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Gt as PenLine, N as Plus, T as Search, ct as Flag } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { c as EditSpaceModal } from "./EditSpaceModal-CopS08FD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/zones-Dd-QZ-lQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ZonesPage() {
	const [query, setQuery] = (0, import_react.useState)("");
	const { spaces, zones, addZone, deleteZone, equipment, assignZoneToEquipment, removeZoneFromEquipment, setWorkspaceState } = useWorkspace();
	const confirm = useConfirm();
	const [selectedId, setSelectedId] = (0, import_react.useState)(null);
	const [editingSpace, setEditingSpace] = (0, import_react.useState)(null);
	const [qtyPrompt, setQtyPrompt] = (0, import_react.useState)(null);
	const [hasDefaulted, setHasDefaulted] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!hasDefaulted && zones.length > 0 && !selectedId) {
			setSelectedId(zones[0].id);
			setHasDefaulted(true);
		}
	}, [
		zones,
		selectedId,
		hasDefaulted
	]);
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			const activeEl = document.activeElement;
			if (activeEl && (activeEl.tagName === "INPUT" && activeEl.type !== "checkbox" && activeEl.type !== "radio" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable || activeEl.tagName === "SELECT")) return;
			if (e.key === "Escape") setSelectedId(null);
			else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
				const zoneToDelete = zones.find((z) => z.id === selectedId);
				if (zoneToDelete) {
					e.preventDefault();
					confirm(`Are you sure you want to delete zone "${zoneToDelete.name}"?`).then((ok) => {
						if (ok) {
							deleteZone(selectedId);
							setSelectedId(null);
						}
					});
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		selectedId,
		zones,
		deleteZone
	]);
	const filtered = (0, import_react.useMemo)(() => {
		const q = query.toLowerCase();
		return zones.filter((z) => !q || z.name.toLowerCase().includes(q) || z.building.toLowerCase().includes(q));
	}, [zones, query]);
	const zone = (0, import_react.useMemo)(() => zones.find((z) => z.id === selectedId), [zones, selectedId]);
	const zoneSpaces = (0, import_react.useMemo)(() => zone ? spaces.filter((s) => s.zone === zone.id || s.zone === zone.name) : [], [spaces, zone]);
	const handleNewZone = () => {
		const name = `Z-${String(zones.length + 1).padStart(3, "0")}`;
		const newZone = {
			id: `zone-${Date.now()}`,
			name,
			building: "Tower A",
			floor: "L01",
			spaceCount: 0,
			area: 0,
			freshAir: 0,
			extractAir: 0,
			pressure: 0,
			equipment: [],
			pressureType: "neutral"
		};
		addZone(newZone);
		setSelectedId(newZone.id);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Zones",
		subtitle: `${zones.length} zones`,
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
			primary: true,
			onClick: handleNewZone,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " New Zone"]
		}),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-[360px_1fr] h-full",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-r border-border flex flex-col min-h-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-3 h-10 border-b border-border flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-3.5 text-muted-foreground" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: query,
								onChange: (e) => setQuery(e.target.value),
								placeholder: "Filter zones…",
								className: "flex-1 h-7 bg-transparent text-[12.5px] outline-none"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[11px] text-muted-foreground tabular",
								children: filtered.length
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex-1 overflow-y-auto",
						children: filtered.map((z) => {
							const active = z.id === selectedId;
							const tone = z.pressureType === "positive" ? "text-success" : z.pressureType === "negative" ? "text-destructive" : "text-muted-foreground";
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setSelectedId(z.id),
								className: `w-full text-left px-3 py-2 border-b border-border/60 ${active ? "bg-row-selected border-l-2 border-l-primary" : "hover:bg-row-hover"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-baseline justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-mono font-medium text-[12.5px] flex items-center gap-1.5",
										children: [z.name, !spaces.some((s) => s.zone === z.name && s.pressure === "Positive") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flag, {
											className: "size-3.5 text-warning",
											title: "There is no positive space in this zone (at least 1 positive space is required)."
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: `font-mono text-[11px] tabular ${tone}`,
										children: [
											z.pressure > 0 ? "+" : "",
											z.pressure,
											" L/s"
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: z.building }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [z.spaceCount, " spaces"] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "tabular",
											children: [z.area.toFixed(0), " m²"]
										})
									]
								})]
							}, z.id);
						})
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-col min-h-0",
					children: zone ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "px-5 py-4 border-b border-border",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10.5px] uppercase tracking-wider text-muted-foreground",
										children: "Zone"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
											className: "text-[18px] font-semibold tracking-tight font-mono",
											children: zone.name
										}), !spaces.some((s) => s.zone === zone.name && s.pressure === "Positive") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flag, {
											className: "size-4 text-warning cursor-help",
											title: "There is no positive space in this zone (at least 1 positive space is required)."
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[12px] text-muted-foreground mt-0.5",
										children: [
											zone.building,
											" · ",
											zone.floor
										]
									})
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: `px-2 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wider ${zone.pressureType === "positive" ? "bg-success/10 text-success" : zone.pressureType === "negative" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`,
									children: [zone.pressureType, " pressure"]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-5 gap-px bg-border mt-4 border border-border rounded overflow-hidden",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
										label: "Spaces",
										value: zone.spaceCount
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
										label: "Area",
										value: `${zone.area.toFixed(0)}`,
										unit: "m²"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
										label: "Fresh Air",
										value: zone.freshAir.toLocaleString(),
										unit: "L/s",
										tone: "primary"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
										label: "Extract Air",
										value: zone.extractAir.toLocaleString(),
										unit: "L/s",
										tone: "primary"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
										label: "Balance",
										value: `${zone.pressure > 0 ? "+" : ""}${zone.pressure}`,
										unit: "L/s",
										tone: zone.pressureType === "neutral" ? void 0 : zone.pressureType === "positive" ? "success" : "destructive"
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "px-5 py-3 border-b border-border flex flex-col gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[10.5px] uppercase tracking-wider text-muted-foreground",
								children: "Assigned Equipment"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-4 text-[12.5px]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-muted-foreground text-[11px] font-medium",
										children: "Fresh Air (FA) Unit"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: zone.faAssignment || "",
											onChange: async (e) => {
												const val = e.target.value;
												if (val) {
													if (zone.faAssignment && zone.faAssignment !== val) {
														const otherEq = equipment.find((eq) => eq.id === zone.faAssignment);
														const newEq = equipment.find((eq) => eq.id === val);
														if (!await confirm(`Fresh Air is already assigned to equipment "${otherEq ? otherEq.tag : "another equipment"}". Do you want to reassign it to "${newEq ? newEq.tag : "this equipment"}"?`, {
															title: "Reassign Fresh Air Unit",
															confirmText: "Reassign",
															cancelText: "Cancel"
														})) return;
													}
													const eqObj = equipment.find((item) => item.id === val);
													if (zone.multiplier && zone.multiplier > 1 && eqObj) setQtyPrompt({
														zoneId: zone.id,
														equipId: val,
														stream: "FA",
														max: zone.multiplier,
														equipTag: eqObj.tag
													});
													else assignZoneToEquipment(zone.id, val, "FA", 1);
												} else if (zone.faAssignment) removeZoneFromEquipment(zone.id, zone.faAssignment, "FA");
											},
											className: "bg-surface-2 border border-border rounded px-2 py-1 text-xs outline-none w-48 text-foreground font-medium",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "",
												children: "-- No Assignment --"
											}), equipment.filter((e) => e.type === "MAHU" || e.type === "Air Handling Unit" || e.type === "FAHU" && (e.mode === "Fresh Air Only" || e.mode === "Fresh Air + Extract Air")).map((eq) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
												value: eq.id,
												children: [
													eq.tag,
													" (",
													eq.type,
													")"
												]
											}, eq.id))]
										}), zone.faAssignment && (zone.multiplier || 1) > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1 shrink-0 ml-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] text-muted-foreground",
												children: "Qty:"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: 1,
												max: zone.multiplier || 1,
												value: zone.faAssignedQty || 1,
												onChange: (e) => {
													const val = Math.max(1, Math.min(zone.multiplier || 1, parseInt(e.target.value) || 1));
													setWorkspaceState({
														spaces,
														zones: zones.map((z) => z.id === zone.id ? {
															...z,
															faAssignedQty: val
														} : z),
														equipment
													});
												},
												className: "w-10 bg-background border border-border rounded px-1 py-0.5 text-[11px] text-center outline-none text-foreground font-semibold"
											})]
										})]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-muted-foreground text-[11px] font-medium",
										children: "Extract Air (EA) Unit"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: zone.eaAssignment || "",
											onChange: async (e) => {
												const val = e.target.value;
												if (val) {
													if (zone.eaAssignment && zone.eaAssignment !== val) {
														const otherEq = equipment.find((eq) => eq.id === zone.eaAssignment);
														const newEq = equipment.find((eq) => eq.id === val);
														if (!await confirm(`Extract Air is already assigned to equipment "${otherEq ? otherEq.tag : "another equipment"}". Do you want to reassign it to "${newEq ? newEq.tag : "this equipment"}"?`, {
															title: "Reassign Extract Air Unit",
															confirmText: "Reassign",
															cancelText: "Cancel"
														})) return;
													}
													const eqObj = equipment.find((item) => item.id === val);
													if (zone.multiplier && zone.multiplier > 1 && eqObj) setQtyPrompt({
														zoneId: zone.id,
														equipId: val,
														stream: "EA",
														max: zone.multiplier,
														equipTag: eqObj.tag
													});
													else assignZoneToEquipment(zone.id, val, "EA", 1);
												} else if (zone.eaAssignment) removeZoneFromEquipment(zone.id, zone.eaAssignment, "EA");
											},
											className: "bg-surface-2 border border-border rounded px-2 py-1 text-xs outline-none w-48 text-foreground font-medium",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "",
												children: "-- No Assignment --"
											}), equipment.filter((e) => e.type === "Ecology" || e.type === "FAHU" && (e.mode === "Extract Air Only" || e.mode === "Fresh Air + Extract Air")).map((eq) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
												value: eq.id,
												children: [
													eq.tag,
													" (",
													eq.type,
													")"
												]
											}, eq.id))]
										}), zone.eaAssignment && (zone.multiplier || 1) > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1 shrink-0 ml-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] text-muted-foreground",
												children: "Qty:"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: 1,
												max: zone.multiplier || 1,
												value: zone.eaAssignedQty || 1,
												onChange: (e) => {
													const val = Math.max(1, Math.min(zone.multiplier || 1, parseInt(e.target.value) || 1));
													setWorkspaceState({
														spaces,
														zones: zones.map((z) => z.id === zone.id ? {
															...z,
															eaAssignedQty: val
														} : z),
														equipment
													});
												},
												className: "w-10 bg-background border border-border rounded px-1 py-0.5 text-[11px] text-center outline-none text-foreground font-semibold"
											})]
										})]
									})]
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 min-h-0 flex flex-col",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "px-5 h-9 flex items-center border-b border-border bg-header-bg",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold",
									children: ["Spaces in zone · ", zoneSpaces.length]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex-1 overflow-auto",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
									className: "w-full text-[12.5px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
										className: "bg-header-bg sticky top-0 text-[10.5px] uppercase tracking-wider text-muted-foreground",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "text-left font-semibold px-5 py-2",
												children: "ID"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "text-left font-semibold px-2 py-2",
												children: "Name"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "text-left font-semibold px-2 py-2",
												children: "Category"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "text-right font-semibold px-2 py-2",
												children: "Area"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "text-right font-semibold px-2 py-2",
												children: "Fresh Given"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "text-right font-semibold px-2 py-2",
												children: "Extract Taken"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "text-right font-semibold px-5 py-2",
												children: "ΔP Balance"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "text-center font-semibold px-2 py-2 w-10",
												children: "Edit"
											})
										] })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: zoneSpaces.map((s) => {
										const spaceBalance = (s.freshAir || 0) - (s.extractAir || 0);
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
											onDoubleClick: () => setEditingSpace(s),
											className: "border-b border-border/60 hover:bg-row-hover cursor-pointer select-none",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "px-5 py-1.5 font-mono text-primary/95 font-semibold hover:underline cursor-pointer text-[12px]",
													onClick: (e) => {
														e.stopPropagation();
														setEditingSpace(s);
													},
													children: s.code
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "px-2 py-1.5 font-medium",
													children: s.name
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "px-2 py-1.5 text-muted-foreground text-xs truncate max-w-[150px]",
													title: s.category,
													children: s.category
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "px-2 py-1.5 text-right font-mono tabular",
													children: s.area.toFixed(1)
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
													className: "px-2 py-1.5 text-right font-mono tabular",
													children: [s.freshAir.toLocaleString(), " L/s"]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
													className: "px-2 py-1.5 text-right font-mono tabular",
													children: [s.extractAir.toLocaleString(), " L/s"]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
													className: "px-5 py-1.5 text-right font-mono tabular",
													children: [
														spaceBalance > 0 ? "+" : "",
														spaceBalance.toFixed(0),
														" L/s"
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "px-2 py-1.5 text-center",
													onClick: (e) => e.stopPropagation(),
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
														onClick: () => setEditingSpace(s),
														title: "Edit Space Parameters",
														className: "p-1 rounded hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5" })
													})
												})
											]
										}, s.id);
									}) })]
								})
							})]
						})
					] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid place-items-center h-full text-muted-foreground text-[13px]",
						children: "Select a zone"
					})
				})]
			}),
			qtyPrompt && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-xs z-[60] flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-2xl shadow-lg w-full max-w-sm animate-scale-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
							className: "px-4 py-3 border-b border-border flex items-center justify-between",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-semibold text-[13px] uppercase tracking-wider text-muted-foreground",
								children: "Assign Zone Instances"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 flex flex-col gap-3 text-[12px]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-muted-foreground leading-relaxed",
									children: [
										"How many instances of zone ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: zones.find((z) => z.id === qtyPrompt.zoneId)?.name }),
										" do you want to assign to ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: qtyPrompt.equipTag }),
										"?"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: 1,
									max: qtyPrompt.max,
									defaultValue: qtyPrompt.max,
									id: "qty-prompt-input-zones",
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none text-foreground font-mono text-center font-bold text-[14px]",
									autoFocus: true
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[10px] text-muted-foreground text-center",
									children: ["Available instances: 1 to ", qtyPrompt.max]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg rounded-b-2xl",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setQtyPrompt(null),
								className: "border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2 cursor-pointer",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									const el = document.getElementById("qty-prompt-input-zones");
									const val = Math.max(1, Math.min(qtyPrompt.max, parseInt(el?.value) || 1));
									if (qtyPrompt.stream === "Both") {
										assignZoneToEquipment(qtyPrompt.zoneId, qtyPrompt.equipId, "FA", val);
										assignZoneToEquipment(qtyPrompt.zoneId, qtyPrompt.equipId, "EA", val);
									} else assignZoneToEquipment(qtyPrompt.zoneId, qtyPrompt.equipId, qtyPrompt.stream, val);
									setQtyPrompt(null);
								},
								className: "bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 cursor-pointer",
								children: "Confirm"
							})]
						})
					]
				})
			}),
			editingSpace && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditSpaceModal, {
				space: editingSpace,
				onClose: () => setEditingSpace(null),
				onSave: (updated) => {
					let nextZones = [...zones];
					if (updated.zone && updated.zone !== "") {
						if (!zones.some((z) => z.id.toLowerCase() === updated.zone.toLowerCase() || z.name.toLowerCase() === updated.zone.toLowerCase())) {
							const newZone = {
								id: `zone-${Date.now()}`,
								name: updated.zone,
								building: updated.building || "Tower A",
								floor: updated.floor || "L01",
								spaceCount: 0,
								area: 0,
								freshAir: 0,
								extractAir: 0,
								pressure: 0,
								equipment: [],
								pressureType: "neutral",
								faAssignment: null,
								eaAssignment: null
							};
							nextZones.push(newZone);
						}
					}
					let nextEquipment = [...equipment];
					if (updated.equipment && updated.equipment !== "") {
						if (!equipment.some((eq) => eq.id.toLowerCase() === updated.equipment.toLowerCase() || eq.tag.toLowerCase() === updated.equipment.toLowerCase())) {
							const newEquip = {
								id: `equip-${Date.now()}`,
								tag: updated.equipment,
								type: "Air Handling Unit",
								zones: 0,
								spaces: 0,
								totalAirflow: 0,
								capacity: 2e3,
								utilization: 0,
								status: "design",
								mode: "Fresh Air + Extract Air",
								zoneIds: []
							};
							nextEquipment.push(newEquip);
						}
					}
					let nextSpaces = spaces.map((s) => s.id === updated.id ? updated : s);
					const mult = parseInt(String(updated.multiplier)) || 1;
					if (mult > 1) {
						const originalUpdated = {
							...updated,
							multiplier: 1
						};
						nextSpaces = nextSpaces.map((s) => s.id === updated.id ? originalUpdated : s);
						const clones = [];
						for (let i = 1; i < mult; i++) {
							const nextNum = Math.floor(Math.random() * 1e3);
							clones.push({
								...updated,
								id: `sp-${Date.now()}-${i}-${nextNum}`,
								code: `${updated.code}-${i}`,
								name: `${updated.name}-${i}`,
								multiplier: 1
							});
						}
						nextSpaces.push(...clones);
					}
					const balanced = calculateVentilation(nextSpaces, nextZones, nextEquipment);
					setWorkspaceState({
						spaces: balanced.spaces,
						zones: balanced.zones,
						equipment: balanced.equipment
					});
					setEditingSpace(null);
				},
				availableZones: zones.map((z) => z.name),
				availableEquipment: equipment.map((e) => e.tag),
				availableFloors: Array.from(new Set(spaces.map((s) => s.floor).filter(Boolean)))
			})
		]
	});
}
function Stat({ label, value, unit, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "bg-background px-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10.5px] uppercase tracking-wider text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `mt-0.5 ${tone === "primary" ? "text-foreground" : tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground"}`,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono tabular text-[16px] font-semibold",
				children: value
			}), unit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[11px] text-muted-foreground ml-1",
				children: unit
			})]
		})]
	});
}
//#endregion
export { ZonesPage as component };
