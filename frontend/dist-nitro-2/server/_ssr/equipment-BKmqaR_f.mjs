import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Gt as PenLine, N as Plus, gt as Download, m as Trash2, n as X } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/equipment-BKmqaR_f.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function EquipmentPage() {
	const { spaces, zones, equipment, addEquipment, deleteEquipment, assignZoneToEquipment, removeZoneFromEquipment, updateZoneInstances } = useWorkspace();
	const confirm = useConfirm();
	const [newEquipOpen, setNewEquipOpen] = (0, import_react.useState)(false);
	const [editingEquip, setEditingEquip] = (0, import_react.useState)(null);
	const handleAssignInstance = (zoneId, instanceIndex, stream, equipId) => {
		const zone = zones.find((z) => z.id === zoneId);
		if (!zone) return;
		const mult = zone.multiplier || 1;
		const instances = [...zone.instances || []];
		for (let idx = 0; idx < mult; idx++) if (!instances[idx]) instances[idx] = {
			instanceIndex: idx + 1,
			faEquipId: idx === 0 ? zone.faAssignment ?? null : null,
			eaEquipId: idx === 0 ? zone.eaAssignment ?? null : null
		};
		const instIdx = instanceIndex - 1;
		if (stream === "FA") instances[instIdx].faEquipId = equipId;
		else instances[instIdx].eaEquipId = equipId;
		updateZoneInstances(zoneId, instances);
	};
	const [newEquipValues, setNewEquipValues] = (0, import_react.useState)({
		tag: "",
		type: "MAHU",
		mode: "Fresh Air Only",
		capacity: 2500
	});
	const handleNewEquipmentApply = () => {
		if (!newEquipValues.tag.trim()) {
			alert("Please enter an equipment tag!");
			return;
		}
		if (equipment.some((e) => e.tag.toLowerCase() === newEquipValues.tag.trim().toLowerCase())) {
			alert("An equipment with this tag already exists!");
			return;
		}
		addEquipment({
			id: `equip-${Date.now()}`,
			tag: newEquipValues.tag.trim(),
			type: newEquipValues.type,
			zones: 0,
			spaces: 0,
			totalAirflow: 0,
			capacity: newEquipValues.capacity || 2e3,
			utilization: 0,
			status: "design",
			mode: newEquipValues.type === "FAHU" ? newEquipValues.mode : void 0,
			zoneIds: [],
			totalFA: 0,
			totalEA: 0
		});
		setNewEquipOpen(false);
		setNewEquipValues({
			tag: "",
			type: "MAHU",
			mode: "Fresh Air Only",
			capacity: 2500
		});
	};
	const actions = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" }), " Export"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
		primary: true,
		onClick: () => setNewEquipOpen(true),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " New Equipment"]
	})] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Equipment",
		subtitle: `${equipment.length} units`,
		actions,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-full overflow-auto p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "bg-background border border-border rounded-lg overflow-hidden shadow-sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full text-[12.5px] border-collapse",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "bg-header-bg sticky top-0 border-b border-border z-10 font-semibold text-muted-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "text-[10.5px] uppercase tracking-wider text-muted-foreground",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Th, { children: "Tag" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Th, { children: "Type & Mode" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Th, {
										align: "right",
										children: "Zones"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Th, {
										align: "right",
										children: "Spaces"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Th, {
										align: "right",
										children: "Fresh Load (L/s)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Th, {
										align: "right",
										children: "Extract Load (L/s)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Th, {
										align: "right",
										children: "Total Airflow (L/s)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Th, {
										align: "right",
										children: "Capacity (L/s)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Th, { children: "Utilization" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Th, { children: "Status" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Th, {
										align: "center",
										children: "Actions"
									})
								]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
							className: "divide-y divide-border/60",
							children: equipment.map((e) => {
								const fresh = e.totalFA || 0;
								const extract = e.totalEA || 0;
								const totalFlow = e.totalAirflow || 0;
								const assignedZoneNames = zones.filter((z) => z.faAssignment === e.id || z.eaAssignment === e.id).map((z) => z.name).join(", ");
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "hover:bg-row-hover transition-colors",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-2 font-mono font-medium",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-foreground",
													children: e.tag
												}), assignedZoneNames && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[10px] text-muted-foreground truncate max-w-[200px]",
													title: assignedZoneNames,
													children: ["Zones: ", assignedZoneNames]
												})]
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-2 text-muted-foreground",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: e.type }), e.mode && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] text-primary",
													children: e.mode
												})]
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-2 text-right font-mono tabular",
											children: e.zones
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-2 text-right font-mono tabular",
											children: e.spaces
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-2 text-right font-mono tabular text-primary",
											children: fresh.toLocaleString()
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-2 text-right font-mono tabular text-pink-600",
											children: extract.toLocaleString()
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-2 text-right font-mono tabular font-medium",
											children: totalFlow.toLocaleString()
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-2 text-right font-mono tabular text-muted-foreground",
											children: e.capacity.toLocaleString()
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-2 w-[220px]",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: `h-full ${e.utilization > 92 ? "bg-warning" : e.utilization > 70 ? "bg-primary" : "bg-success"}`,
														style: { width: `${e.utilization}%` }
													})
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-mono tabular text-[11.5px] w-9 text-right",
													children: [e.utilization, "%"]
												})]
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: `inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wider ${e.status === "operational" ? "bg-success/10 text-success" : e.status === "warning" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1 rounded-full bg-current" }), e.status]
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-2 text-center",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => setEditingEquip(e),
													className: "hover:text-foreground p-1 rounded hover:bg-surface-2 transition-colors text-muted-foreground",
													title: "Assign zones & edit capacity",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5" })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: async () => {
														if (await confirm(`Are you sure you want to delete ${e.tag}? All zone stream assignments to it will be cleared.`)) deleteEquipment(e.id);
													},
													className: "hover:text-destructive p-1 rounded hover:bg-surface-2 transition-colors text-muted-foreground",
													title: "Delete equipment",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
												})]
											})
										})
									]
								}, e.id);
							})
						})]
					})
				})
			}),
			newEquipOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-lg shadow-lg w-full max-w-sm animate-scale-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-4 py-3 border-b border-border flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-semibold text-[14px]",
								children: "Create Equipment Unit"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setNewEquipOpen(false),
								className: "text-muted-foreground hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 flex flex-col gap-3 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium mb-1",
									children: "Equipment Tag"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									placeholder: "e.g. MAHU-01 or Ecology-02",
									value: newEquipValues.tag,
									onChange: (e) => {
										const tagVal = e.target.value;
										const normalized = tagVal.toUpperCase();
										let detectedType = newEquipValues.type;
										if (normalized.includes("FAHU")) detectedType = "FAHU";
										else if (normalized.includes("EAHU") || normalized.includes("ECOLOGY") || normalized.startsWith("EA")) detectedType = "Ecology";
										else if (normalized.includes("MAHU") || normalized.startsWith("MA")) detectedType = "MAHU";
										setNewEquipValues({
											...newEquipValues,
											tag: tagVal,
											type: detectedType
										});
									},
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium mb-1",
									children: "Equipment Type"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: newEquipValues.type,
									onChange: (e) => setNewEquipValues({
										...newEquipValues,
										type: e.target.value
									}),
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "MAHU",
											children: "MAHU (Fresh Air Only)"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "Ecology",
											children: "Ecology Unit (Extract Air Only)"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "FAHU",
											children: "FAHU (Multi-stream Ventilation)"
										})
									]
								})] }),
								newEquipValues.type === "FAHU" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium mb-1",
									children: "FAHU Ventilation Mode"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: newEquipValues.mode,
									onChange: (e) => setNewEquipValues({
										...newEquipValues,
										mode: e.target.value
									}),
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "Fresh Air Only",
											children: "Fresh Air Only"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "Extract Air Only",
											children: "Extract Air Only"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "Fresh Air + Extract Air",
											children: "Fresh Air + Extract Air"
										})
									]
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-muted-foreground font-medium mb-1",
									children: "Capacity (L/s)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									placeholder: "Capacity L/s",
									value: newEquipValues.capacity,
									onChange: (e) => setNewEquipValues({
										...newEquipValues,
										capacity: parseInt(e.target.value) || 0
									}),
									className: "bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setNewEquipOpen(false),
								className: "border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleNewEquipmentApply,
								className: "bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95",
								children: "Create Equipment"
							})]
						})
					]
				})
			}),
			editingEquip && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditEquipmentModal, {
				equip: editingEquip,
				zones,
				equipment,
				onClose: () => setEditingEquip(null),
				onAssignInstance: handleAssignInstance
			})
		]
	});
}
function EditEquipmentModal({ equip, zones, equipment, onClose, onAssignInstance }) {
	const zoneInstances = (0, import_react.useMemo)(() => {
		const list = [];
		zones.forEach((z) => {
			const mult = z.multiplier || 1;
			for (let i = 1; i <= mult; i++) {
				const inst = z.instances?.find((ins) => ins.instanceIndex === i);
				let faEquipId = null;
				let eaEquipId = null;
				if (z.instances && z.instances.length > 0) {
					faEquipId = inst?.faEquipId ?? null;
					eaEquipId = inst?.eaEquipId ?? null;
				} else if (i === 1) {
					faEquipId = z.faAssignment ?? null;
					eaEquipId = z.eaAssignment ?? null;
				}
				list.push({
					id: z.id,
					name: z.name,
					instanceIndex: i,
					multiplier: mult,
					floor: z.floor || "L01",
					faEquipId,
					eaEquipId
				});
			}
		});
		return list;
	}, [zones]);
	const assignedInstances = (0, import_react.useMemo)(() => {
		return zoneInstances.filter((zi) => zi.faEquipId === equip.id || zi.eaEquipId === equip.id);
	}, [zoneInstances, equip.id]);
	const availableInstances = (0, import_react.useMemo)(() => {
		return zoneInstances.filter((zi) => zi.faEquipId !== equip.id || zi.eaEquipId !== equip.id);
	}, [zoneInstances, equip.id]);
	const canFresh = equip.type === "MAHU" || equip.type === "Air Handling Unit" || equip.type === "FAHU" && (equip.mode === "Fresh Air Only" || equip.mode === "Fresh Air + Extract Air");
	const canExtract = equip.type === "Ecology" || equip.type === "FAHU" && (equip.mode === "Extract Air Only" || equip.mode === "Fresh Air + Extract Air");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "bg-background border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[85vh] flex flex-col animate-scale-in",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "px-4 py-3 border-b border-border flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "font-semibold text-[14px]",
							children: ["Edit Equipment assignments: ", equip.tag]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[10px] text-muted-foreground uppercase bg-surface-2 px-1.5 py-0.5 rounded border border-border font-semibold",
							children: [
								"Type: ",
								equip.type,
								" ",
								equip.mode ? `(${equip.mode})` : ""
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "text-muted-foreground hover:text-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 overflow-y-auto flex-1 grid grid-cols-2 gap-4 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2 min-h-0 border border-border rounded-lg p-3 bg-surface-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
							className: "font-bold text-muted-foreground uppercase text-[10px] tracking-wider mb-1 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Assigned Zone Instances" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "bg-accent text-accent-foreground px-1.5 py-0.2 rounded-full font-mono",
								children: assignedInstances.length
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "overflow-y-auto flex-1 flex flex-col gap-1.5 max-h-[45vh]",
							children: [assignedInstances.map((zi, idx) => {
								const assignedStreams = [];
								if (zi.faEquipId === equip.id) assignedStreams.push("Fresh Air");
								if (zi.eaEquipId === equip.id) assignedStreams.push("Extract Air");
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-background border border-border p-2 rounded flex items-center justify-between hover:bg-surface-2 transition-colors",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-semibold font-mono text-[12px] text-foreground",
										children: [
											zi.name,
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-[10px] text-muted-foreground font-sans",
												children: [
													"(Instance ",
													zi.instanceIndex,
													"/",
													zi.multiplier,
													")"
												]
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[10px] text-muted-foreground mt-0.5",
										children: [
											"Floor: ",
											zi.floor,
											" · Streams: ",
											assignedStreams.join(" + ")
										]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5",
										children: [zi.faEquipId === equip.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => onAssignInstance(zi.id, zi.instanceIndex, "FA", null),
											className: "px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-700 font-medium transition-colors text-[10px]",
											children: "Remove FA"
										}), zi.eaEquipId === equip.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => onAssignInstance(zi.id, zi.instanceIndex, "EA", null),
											className: "px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-700 font-medium transition-colors text-[10px]",
											children: "Remove EA"
										})]
									})]
								}, `${zi.id}-${zi.instanceIndex}-${idx}`);
							}), assignedInstances.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-center text-muted-foreground italic py-10",
								children: "No zone instances assigned to this equipment unit yet."
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2 min-h-0 border border-border rounded-lg p-3 bg-surface-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
							className: "font-bold text-muted-foreground uppercase text-[10px] tracking-wider mb-1",
							children: [
								"Available Zone Instances (",
								availableInstances.length,
								")"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "overflow-y-auto flex-1 flex flex-col gap-1.5 max-h-[45vh]",
							children: [availableInstances.map((zi, idx) => {
								const otherFA = zi.faEquipId ? equipment.find((e) => e.id === zi.faEquipId)?.tag || "Other" : null;
								const otherEA = zi.eaEquipId ? equipment.find((e) => e.id === zi.eaEquipId)?.tag || "Other" : null;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-background border border-border p-2 rounded flex items-center justify-between hover:bg-surface-2 transition-colors",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-semibold font-mono text-[12px] text-foreground",
										children: [
											zi.name,
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-[10px] text-muted-foreground font-sans",
												children: [
													"(Instance ",
													zi.instanceIndex,
													"/",
													zi.multiplier,
													")"
												]
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[10px] text-muted-foreground mt-0.5",
										children: [
											"Floor: ",
											zi.floor,
											otherFA && ` · FA linked (${otherFA})`,
											otherEA && ` · EA linked (${otherEA})`
										]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5",
										children: [canFresh && zi.faEquipId !== equip.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => onAssignInstance(zi.id, zi.instanceIndex, "FA", equip.id),
											className: "px-2 py-0.5 rounded bg-green-100 hover:bg-green-200 text-green-700 font-medium transition-colors text-[10px]",
											children: "Add FA"
										}), canExtract && zi.eaEquipId !== equip.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => onAssignInstance(zi.id, zi.instanceIndex, "EA", equip.id),
											className: "px-2 py-0.5 rounded bg-green-100 hover:bg-green-200 text-green-700 font-medium transition-colors text-[10px]",
											children: "Add EA"
										})]
									})]
								}, `${zi.id}-${zi.instanceIndex}-${idx}`);
							}), availableInstances.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-center text-muted-foreground italic py-10",
								children: "No available zone instances in this project."
							})]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
					className: "px-4 py-3 border-t border-border flex items-center justify-end bg-header-bg",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "bg-primary text-primary-foreground font-semibold px-4 py-1.5 rounded hover:bg-primary/95 transition-colors",
						children: "Done"
					})
				})
			]
		})
	});
}
function Th({ children, align }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
		className: `px-4 py-2 font-semibold ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`,
		children
	});
}
//#endregion
export { EquipmentPage as component };
