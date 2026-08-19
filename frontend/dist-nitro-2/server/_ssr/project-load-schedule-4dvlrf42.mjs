import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { I as Network, N as Plus, ft as Eye, gt as Download, h as Table, m as Trash2, pt as EyeOff, t as Zap, xt as Copy } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { a as useEdgesState, c as Position, i as index, n as Controls, o as useNodesState, r as Handle, s as MarkerType, t as Background } from "../_libs/@xyflow/react+[...].mjs";
import { t as AppShell } from "./AppShell-Blf5aT0O.mjs";
import { n as useElectricalNetworkStore } from "./electrical-network-CfR4u4MX.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/project-load-schedule-4dvlrf42.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var getBoardLevel = (type) => {
	if (type === "MDB" || type === "EMDB") return 1;
	if (type === "SMDB" || type === "ESMDB" || type === "MCC") return 2;
	if (type === "DB" || type === "EDB" || type === "UPS") return 3;
	return 4;
};
var DewaNode = ({ data }) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "font-bold text-sm px-4 py-2 border-2 border-emerald-500 rounded bg-emerald-50 text-emerald-800",
		children: ["DEWA / GRID", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Handle, {
			id: "source",
			type: "source",
			position: Position.Bottom,
			className: "w-4 h-4 bg-emerald-500"
		})]
	});
};
var BoardNode = ({ data }) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "bg-white border-2 border-slate-300 rounded-lg shadow-sm hover:border-blue-500 cursor-pointer min-w-[120px] transition-colors relative",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Handle, {
				id: "target",
				type: "target",
				position: Position.Top,
				className: "w-4 h-4 bg-blue-500"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "font-bold text-xs p-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[10px] text-slate-500 mb-1",
					children: data.type
				}), data.name]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Handle, {
				id: "source",
				type: "source",
				position: Position.Bottom,
				className: "w-4 h-4 bg-blue-500"
			})
		]
	});
};
var nodeTypes = {
	dewaNode: DewaNode,
	boardNode: BoardNode
};
function NetworkSLD({ boards, onNodeClick, onConnectBoard }) {
	const [nodes, setNodes, onNodesChange] = useNodesState([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState([]);
	(0, import_react.useEffect)(() => {
		const newNodes = [];
		const newEdges = [];
		const nodeSpacingX = 180;
		const nodeSpacingY = 120;
		const childrenMap = {};
		boards.forEach((b) => {
			const parentId = b.fedFrom || "DEWA/GRID";
			if (!childrenMap[parentId]) childrenMap[parentId] = [];
			childrenMap[parentId].push(b.id);
		});
		const positions = {};
		const subtreeWidths = {};
		const calculateWidth = (id) => {
			const children = childrenMap[id] || [];
			if (children.length === 0) {
				subtreeWidths[id] = nodeSpacingX;
				return nodeSpacingX;
			}
			const width = children.reduce((sum, childId) => sum + calculateWidth(childId), 0);
			subtreeWidths[id] = Math.max(width, nodeSpacingX);
			return subtreeWidths[id];
		};
		calculateWidth("DEWA/GRID");
		const assignPosition = (id, x, y) => {
			positions[id] = {
				x,
				y
			};
			const children = childrenMap[id] || [];
			if (children.length === 0) return;
			let startX = x - children.reduce((sum, childId) => sum + subtreeWidths[childId], 0) / 2;
			children.forEach((childId) => {
				const childWidth = subtreeWidths[childId];
				assignPosition(childId, startX + childWidth / 2, y + nodeSpacingY);
				startX += childWidth;
			});
		};
		assignPosition("DEWA/GRID", 400, 50);
		let minX = Infinity;
		Object.values(positions).forEach((p) => {
			if (p.x < minX) minX = p.x;
		});
		if (minX < 50) {
			const shiftX = 50 - minX;
			Object.values(positions).forEach((p) => {
				p.x += shiftX;
			});
		}
		newNodes.push({
			id: "DEWA/GRID",
			type: "dewaNode",
			position: positions["DEWA/GRID"],
			data: {},
			style: {
				border: "none",
				background: "transparent",
				cursor: "default",
				transition: "transform 0.5s ease"
			}
		});
		boards.forEach((board) => {
			newNodes.push({
				id: board.id,
				type: "boardNode",
				position: positions[board.id] || {
					x: 400,
					y: 50
				},
				data: {
					name: board.name,
					type: board.type
				},
				style: {
					border: "none",
					background: "transparent",
					transition: "transform 0.5s ease"
				}
			});
			newEdges.push({
				id: `e-${board.fedFrom}-${board.id}`,
				source: board.fedFrom || "DEWA/GRID",
				sourceHandle: "source",
				target: board.id,
				targetHandle: "target",
				type: "default",
				animated: true,
				style: {
					stroke: "#3b82f6",
					strokeWidth: 2
				},
				markerEnd: {
					type: MarkerType.ArrowClosed,
					color: "#3b82f6"
				}
			});
		});
		setNodes(newNodes);
		setEdges(newEdges);
	}, [
		boards,
		setNodes,
		setEdges
	]);
	const handleNodeClick = (0, import_react.useCallback)((_, node) => {
		if (node.id !== "DEWA/GRID" && onNodeClick) onNodeClick(node.id);
	}, [onNodeClick]);
	const onConnect = (0, import_react.useCallback)((connection) => {
		if (!onConnectBoard) return;
		if (connection.target === "DEWA/GRID") {
			toast.error("Cannot modify the DEWA/GRID root connection.");
			return;
		}
		if (connection.source === connection.target) {
			toast.error("A board cannot be fed from itself.");
			return;
		}
		const sourceBoard = boards.find((b) => b.id === connection.source);
		const targetBoard = boards.find((b) => b.id === connection.target);
		if (sourceBoard && targetBoard) {
			if (sourceBoard.type === "DB" || sourceBoard.type === "EDB") {
				toast.error(`Invalid hierarchy: ${sourceBoard.type} is a final distribution board and cannot feed other boards. Change its type to SMDB or MDB first.`);
				return;
			}
			if (getBoardLevel(sourceBoard.type) > getBoardLevel(targetBoard.type)) {
				toast.error(`Invalid hierarchy: ${sourceBoard.type} cannot feed ${targetBoard.type}.`);
				return;
			}
		}
		let currentSourceParent = connection.source;
		while (currentSourceParent && currentSourceParent !== "DEWA/GRID") {
			if (currentSourceParent === connection.target) {
				toast.error("Circular connection detected! A board cannot be fed from its own child.");
				return;
			}
			currentSourceParent = boards.find((b) => b.id === currentSourceParent)?.fedFrom || "DEWA/GRID";
		}
		onConnectBoard(connection.source, connection.target);
		toast.success("Board connection updated successfully!");
	}, [boards, onConnectBoard]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		style: {
			width: "100%",
			height: "100%"
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(index, {
			nodes,
			edges,
			onNodesChange,
			onEdgesChange,
			onNodeClick: handleNodeClick,
			onConnect,
			onEdgeUpdate: (0, import_react.useCallback)((oldEdge, newConnection) => {
				onConnect(newConnection);
			}, [onConnect]),
			onEdgesDelete: (0, import_react.useCallback)((deletedEdges) => {
				if (!onConnectBoard) return;
				deletedEdges.forEach((edge) => {
					onConnectBoard("DEWA/GRID", edge.target);
				});
				toast.success("Board connection removed.");
			}, [onConnectBoard]),
			nodeTypes,
			fitView: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Background, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Controls, {})]
		})
	});
}
var POINT_TYPES = [
	{
		id: "ltg",
		name: "LTG",
		defaultW: 100
	},
	{
		id: "ch",
		name: "CH.",
		defaultW: 1500
	},
	{
		id: "callbell",
		name: "CALL BELL",
		defaultW: 50
	},
	{
		id: "exhood",
		name: "EX Hood",
		defaultW: 150
	},
	{
		id: "s13a",
		name: "13A S/O",
		defaultW: 200
	},
	{
		id: "s13at",
		name: "13A T S/O",
		defaultW: 400
	},
	{
		id: "wh",
		name: "W/H",
		defaultW: 1500
	},
	{
		id: "s15a",
		name: "15A S/O",
		defaultW: 1e3
	},
	{
		id: "f13a",
		name: "13A FLEX O/L",
		defaultW: 500
	},
	{
		id: "sp13a",
		name: "13A SP O/L",
		defaultW: 100
	},
	{
		id: "dp20a",
		name: "20A Outlet + DP SWITCH",
		defaultW: 2e3
	},
	{
		id: "fcu",
		name: "FCU",
		defaultW: 800
	},
	{
		id: "hd",
		name: "H/D",
		defaultW: 150
	},
	{
		id: "isol",
		name: "ISOL",
		defaultW: 1e3
	},
	{
		id: "other",
		name: "OTHER",
		defaultW: 0
	}
];
function createDefaultBoard(id, name) {
	return {
		id,
		name,
		type: "DB",
		phaseType: "3-Phase",
		fedFrom: "DEWA/GRID",
		incomer: {
			rating: "100A",
			sptp: "4P",
			faultKa: "10",
			cableSize: "16",
			eccSize: "16",
			inc1: "1600A",
			inc2: "1600A",
			meterType: "None"
		},
		circuits: []
	};
}
function generateDefaultDBCircuit(id, index) {
	const phaseStr = [
		"R",
		"Y",
		"B"
	][index % 3];
	const cirNo = `${phaseStr}${Math.floor(index / 3) + 1}`;
	const fullPhase = `${phaseStr} Phase`;
	return {
		id,
		elcbGroup: "G1",
		slNo: index + 1,
		cirNo,
		mcb: "10",
		wireEcc: "2.5",
		roomArea: "New Area",
		points: {},
		wPerUnit: "",
		customW: "",
		phase: fullPhase,
		remarks: ""
	};
}
function generateDefaultMDBCircuit(id, index) {
	return {
		id,
		cirNo: index + 1,
		desc: "New Area",
		qty: 1,
		loadW: 0,
		phase: "R Phase",
		df: 1,
		mcb: "10",
		faultKa: "10",
		wire: "2.5",
		type: "XLPE/SWA/PVC",
		ecc: "2.5",
		len: "",
		ph1Mtr: "",
		ph3Mtr: "",
		ctMtr: "",
		remarks: ""
	};
}
function ProjectLoadSchedulePage() {
	const { userData, profile } = useAuth();
	userData?.name || profile?.name;
	const confirm = useConfirm();
	const [view, setView] = (0, import_react.useState)("schedule");
	const tableContainerRef = (0, import_react.useRef)(null);
	const boards = useElectricalNetworkStore((state) => state.boards);
	const setBoards = useElectricalNetworkStore((state) => state.setBoards);
	useElectricalNetworkStore((state) => state.recalculateNetwork);
	const updateBoardGlobal = useElectricalNetworkStore((state) => state.updateBoard);
	const [activeBoardId, setActiveBoardId] = (0, import_react.useState)("board-1");
	const [isCompactView, setIsCompactView] = (0, import_react.useState)(false);
	const activeBoard = boards.find((b) => b.id === activeBoardId);
	const isDB = activeBoard?.type === "DB" || activeBoard?.type === "EDB";
	const updateBoard = (updates) => {
		setBoards(boards.map((b) => b.id === activeBoardId ? {
			...b,
			...updates
		} : b));
	};
	const updateIncomer = (field, val) => {
		updateBoard({ incomer: {
			...activeBoard.incomer,
			[field]: val
		} });
	};
	const updateCircuit = (cid, field, val) => {
		updateBoard({ circuits: activeBoard.circuits.map((c) => c.id === cid ? {
			...c,
			[field]: val
		} : c) });
	};
	const updatePoint = (cid, pid, qty) => {
		updateBoard({ circuits: activeBoard.circuits.map((c) => {
			if (c.id !== cid) return c;
			const newPoints = { ...c.points };
			if (!qty) delete newPoints[pid];
			else newPoints[pid] = parseInt(qty) || 0;
			return {
				...c,
				points: newPoints
			};
		}) });
	};
	const addCircuit = () => {
		const newCirc = isDB ? generateDefaultDBCircuit(`c-${Date.now()}`, activeBoard.circuits.length) : generateDefaultMDBCircuit(`c-${Date.now()}`, activeBoard.circuits.length);
		updateBoard({ circuits: [...activeBoard.circuits, newCirc] });
		setTimeout(() => {
			if (tableContainerRef.current) tableContainerRef.current.scrollTo({
				top: tableContainerRef.current.scrollHeight,
				behavior: "smooth"
			});
		}, 50);
	};
	const copyDown = async (field, value) => {
		if (!await confirm(`Copy this value down to all circuits?`)) return;
		updateBoard({ circuits: activeBoard.circuits.map((c) => ({
			...c,
			[field]: value
		})) });
	};
	const calculateCircuitLoad = (c) => {
		if (activeBoard?.type === "DB" || activeBoard?.type === "EDB") {
			let totalW = 0;
			Object.keys(c.points || {}).forEach((pid) => {
				const pType = POINT_TYPES.find((p) => p.id === pid);
				if (pType) totalW += (c.points[pid] || 0) * pType.defaultW;
			});
			return totalW + (Number(c.customW) || 0);
		} else return (Number(c.qty) || 1) * (Number(c.loadW) || 0);
	};
	const autoSizeAndGroup = () => {
		if (!isDB) return alert("Auto-Size & Group is only available for DB/EDB boards.");
		let totalBoardLoad = 0;
		const lightingTypes = [
			"ltg",
			"ch",
			"callbell"
		];
		const mechTypes = [
			"exhood",
			"fcu",
			"hd",
			"isol",
			"wh",
			"other"
		];
		const sizedCircuits = activeBoard.circuits.map((c) => {
			const load = calculateCircuitLoad(c);
			totalBoardLoad += load;
			const current = load / 230;
			let mcb = "10";
			let wire = "2.5";
			if (load > 0) if (current <= 10) {
				mcb = "10";
				wire = "2.5";
			} else if (current <= 16) {
				mcb = "16";
				wire = "2.5";
			} else if (current <= 20) {
				mcb = "20";
				wire = "4.0";
			} else if (current <= 32) {
				mcb = "32";
				wire = "6.0";
			} else {
				mcb = "40";
				wire = "10.0";
			}
			else if (c.mcb) {
				mcb = c.mcb;
				wire = c.wireEcc || "2.5";
			}
			return {
				...c,
				mcb,
				wireEcc: wire
			};
		});
		let lightingCircuits = [];
		let powerCircuits = [];
		let mechCircuits = [];
		let spareCircuits = [];
		for (const c of sizedCircuits) {
			if (c.isSpare || calculateCircuitLoad(c) === 0) {
				spareCircuits.push(c);
				continue;
			}
			let hasLighting = false;
			let hasMech = false;
			let hasPower = false;
			if (c.points) {
				for (const pid of Object.keys(c.points)) if ((c.points[pid] || 0) > 0) if (lightingTypes.includes(pid)) hasLighting = true;
				else if (mechTypes.includes(pid)) hasMech = true;
				else hasPower = true;
			}
			if (c.customW && c.customW > 0) hasPower = true;
			if (hasPower) powerCircuits.push(c);
			else if (hasLighting) lightingCircuits.push(c);
			else if (hasMech) mechCircuits.push(c);
			else powerCircuits.push(c);
		}
		let newCircuits = [];
		let groupIndex = 1;
		const totalKW = totalBoardLoad / 1e3;
		let iRatingStr = "40A";
		if (totalKW > 50) iRatingStr = "125A";
		else if (totalKW > 30) iRatingStr = "100A";
		else if (totalKW > 15) iRatingStr = "63A";
		const baseAmps = parseInt(iRatingStr.match(/\d+/)?.[0] || "40", 10);
		const processCluster = (circuits, sensitivity, isSparePass = false) => {
			let index = 0;
			while (index < circuits.length) {
				const remaining = circuits.length - index;
				let take = 0;
				let pad = 0;
				if (remaining >= 6) {
					take = 6;
					pad = 0;
				} else if (remaining === 5) {
					take = 5;
					pad = 1;
				} else if (remaining === 4) {
					take = 4;
					pad = 2;
				} else if (remaining === 3) {
					take = 3;
					pad = 0;
				} else if (remaining === 2) {
					take = 2;
					pad = 1;
				} else if (remaining === 1) {
					take = 1;
					pad = 2;
				}
				const elcbGroup = `${baseAmps}A\n${sensitivity}mA 4P\nELCB - ${groupIndex}`;
				for (let i = 0; i < take; i++) newCircuits.push({
					...circuits[index + i],
					elcbGroup
				});
				for (let i = 0; i < pad; i++) {
					let spare = !isSparePass && spareCircuits.length > 0 ? spareCircuits.shift() : {
						id: `spare-${Date.now()}-${groupIndex}-${i}`,
						mcb: "10",
						wireEcc: "2.5",
						roomArea: "Spare",
						points: {},
						customW: 0,
						isSpare: true
					};
					newCircuits.push({
						...spare,
						elcbGroup
					});
				}
				index += take;
				groupIndex++;
			}
		};
		processCluster(lightingCircuits, 100, false);
		processCluster(powerCircuits, 30, false);
		if (spareCircuits.length > 0) {
			processCluster([...spareCircuits], 30, true);
			spareCircuits.length = 0;
		}
		processCluster(mechCircuits, 100, false);
		const phases = [
			"R",
			"Y",
			"B"
		];
		newCircuits = newCircuits.map((c, idx) => {
			const slNo = idx + 1;
			const phaseStr = phases[idx % 3];
			const seq = Math.floor(idx / 3) + 1;
			const cirNo = activeBoard.phaseType === "3-Phase" ? `${phaseStr}${seq}` : `L${idx + 1}`;
			const fullPhase = activeBoard.phaseType === "3-Phase" ? `${phaseStr} Phase` : "1-Phase";
			return {
				...c,
				slNo,
				cirNo,
				phase: fullPhase
			};
		});
		updateBoard({
			circuits: newCircuits,
			incomer: {
				...activeBoard.incomer,
				rating: iRatingStr
			}
		});
	};
	const balanceBoardPhases = (board) => {
		if (board.phaseType !== "3-Phase") return board;
		const circuits = [...board.circuits];
		const calcLoad = (c) => {
			if (board.type === "DB" || board.type === "EDB") {
				let totalW = 0;
				Object.keys(c.points || {}).forEach((pid) => {
					const pType = POINT_TYPES.find((p) => p.id === pid);
					if (pType) totalW += (c.points[pid] || 0) * pType.defaultW;
				});
				return totalW + (Number(c.customW) || 0);
			} else return (Number(c.qty) || 1) * (Number(c.loadW) || 0);
		};
		circuits.sort((a, b) => calcLoad(b) - calcLoad(a));
		const phaseLoads = {
			"R Phase": 0,
			"Y Phase": 0,
			"B Phase": 0
		};
		const newCircuits = circuits.map((c) => {
			let minPhase = "R Phase";
			if (phaseLoads["Y Phase"] < phaseLoads[minPhase]) minPhase = "Y Phase";
			if (phaseLoads["B Phase"] < phaseLoads[minPhase]) minPhase = "B Phase";
			c.phase = minPhase;
			phaseLoads[minPhase] += calcLoad(c);
			return c;
		});
		const finalCircuits = board.circuits.map((original) => newCircuits.find((c) => c.id === original.id));
		return {
			...board,
			circuits: finalCircuits
		};
	};
	const autoBalancePhases = () => {
		if (activeBoard.phaseType !== "3-Phase") return alert("Board must be 3-Phase to balance.");
		updateBoard(balanceBoardPhases(activeBoard));
	};
	const globalNetworkBalance = () => {
		let updatedBoards = [...boards];
		const levels = {};
		const getLevel = (id) => {
			if (id === "DEWA/GRID" || !id) return 0;
			if (levels[id] !== void 0) return levels[id];
			const board = updatedBoards.find((b) => b.id === id);
			if (!board) return 1;
			const level = getLevel(board.fedFrom) + 1;
			levels[id] = level;
			return level;
		};
		updatedBoards.forEach((b) => getLevel(b.id));
		[...updatedBoards].sort((a, b) => (levels[b.id] || 0) - (levels[a.id] || 0)).forEach((parent) => {
			if (parent.type === "DB" || parent.type === "EDB") return;
			const children = updatedBoards.filter((b) => b.fedFrom === parent.id);
			if (children.length === 0) return;
			let newCircuits = [...parent.circuits];
			children.forEach((child) => {
				let childLoad = 0;
				child.circuits.forEach((c) => {
					const load = child.type === "DB" || child.type === "EDB" ? (() => {
						let totalW = 0;
						Object.keys(c.points || {}).forEach((pid) => {
							const pType = POINT_TYPES.find((p) => p.id === pid);
							if (pType) totalW += (c.points[pid] || 0) * pType.defaultW;
						});
						return totalW + (Number(c.customW) || 0);
					})() : (Number(c.qty) || 1) * (Number(c.loadW) || 0);
					childLoad += load * (c.df !== void 0 ? Number(c.df) : 1);
				});
				const existingIdx = newCircuits.findIndex((c) => c.desc === child.name);
				if (existingIdx >= 0) {
					newCircuits[existingIdx].loadW = childLoad;
					newCircuits[existingIdx].qty = 1;
				} else {
					const newCirc = generateDefaultMDBCircuit(`c-${Date.now()}-${Math.random()}`, newCircuits.length);
					newCirc.desc = child.name;
					newCirc.loadW = childLoad;
					newCirc.qty = 1;
					newCircuits.push(newCirc);
				}
			});
			const parentIdx = updatedBoards.findIndex((b) => b.id === parent.id);
			if (parentIdx >= 0) updatedBoards[parentIdx] = {
				...updatedBoards[parentIdx],
				circuits: newCircuits
			};
		});
		updatedBoards = updatedBoards.map((b) => balanceBoardPhases(b));
		setBoards(updatedBoards);
		alert("Global Network Balance Complete! Child loads bubbled up to parent boards, and all 3-Phase boards balanced.");
	};
	const exportSchedule = async () => {
		if (boards.filter((b) => b.fedFrom !== "DEWA/GRID" && !boards.find((p) => p.id === b.fedFrom)).length > 0) {
			if (!await confirm("SOP Warning: Some panels do not trace back to an MDB/LV-PANEL or DEWA/GRID. They may not be accurately reflected in the main load schedule. Continue export anyway?")) return;
		}
		try {
			const ExcelJS = (await import("../_libs/exceljs+[...].mjs").then((n) => /* @__PURE__ */ __toESM(n.t()))).default || window.ExcelJS;
			const fileSaverModule = await import("../_libs/file-saver.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()));
			const saveAs = fileSaverModule.saveAs || fileSaverModule.default?.saveAs || fileSaverModule.default || window.saveAs;
			const wb = new ExcelJS.Workbook();
			const sheetMap = {};
			const crossSheetLinks = [];
			wb.creator = "MEP Calculator";
			wb.created = /* @__PURE__ */ new Date();
			boards.forEach((board) => {
				const ws = wb.addWorksheet(board.name.substring(0, 31));
				const isThisDB = board.type === "DB" || board.type === "EDB";
				const applyGreyHeader = (cell, bold = true, size = 9, align = "center") => {
					cell.font = {
						bold,
						size,
						name: "Cambria",
						color: { argb: "FF000000" }
					};
					cell.fill = {
						type: "pattern",
						pattern: "solid",
						fgColor: { argb: "FFBFBFBF" }
					};
					cell.alignment = {
						horizontal: align,
						vertical: "middle",
						wrapText: true
					};
					cell.border = {
						top: { style: "thin" },
						left: { style: "thin" },
						bottom: { style: "thin" },
						right: { style: "thin" }
					};
				};
				const applyWhiteCell = (cell, bold = false, size = 9, align = "center") => {
					cell.font = {
						bold,
						size,
						name: "Cambria",
						color: { argb: "FF000000" }
					};
					cell.alignment = {
						horizontal: align,
						vertical: "middle",
						wrapText: true
					};
					cell.border = {
						top: { style: "thin" },
						left: { style: "thin" },
						bottom: { style: "thin" },
						right: { style: "thin" }
					};
				};
				if (isThisDB) {
					const ptsCount = POINT_TYPES.length;
					const totalCols = 8 + ptsCount + 5;
					for (let i = 1; i <= 3; i++) {
						ws.addRow(new Array(totalCols).fill(""));
						ws.getRow(i).height = 20;
						for (let c = 1; c <= totalCols; c++) applyGreyHeader(ws.getCell(i, c), true);
					}
					ws.mergeCells(1, 1, 1, 7);
					ws.getCell(1, 1).value = `Project : PLOT NO.`;
					ws.mergeCells(1, 8, 1, 8 + ptsCount);
					ws.getCell(1, 8).value = `Load Distribution Schedule`;
					ws.getCell(1, 8).font = {
						bold: true,
						size: 14,
						name: "Cambria",
						color: { argb: "FF000000" }
					};
					ws.mergeCells(1, 8 + ptsCount + 1, 1, totalCols);
					ws.getCell(1, 8 + ptsCount + 1).value = `Plot No.# : `;
					ws.mergeCells(2, 1, 2, 7);
					ws.getCell(2, 1).value = `DB No.# : ${board.name}`;
					ws.mergeCells(2, 8, 2, 8 + ptsCount);
					ws.mergeCells(2, 8 + ptsCount + 1, 2, totalCols);
					ws.getCell(2, 8 + ptsCount + 1).value = `Location : `;
					ws.mergeCells(3, 1, 3, 7);
					ws.getCell(3, 1).value = `Fed From : ${boards.find((b) => b.id === board.fedFrom)?.name || board.fedFrom}`;
					ws.mergeCells(3, 8, 3, 8 + ptsCount);
					ws.mergeCells(3, 8 + ptsCount + 1, 3, totalCols);
					ws.getCell(3, 8 + ptsCount + 1).value = `SHEET: 1 OF 1`;
					ws.addRow(new Array(totalCols).fill(""));
					ws.addRow(new Array(totalCols).fill(""));
					ws.addRow(new Array(totalCols).fill(""));
					for (let r = 4; r <= 6; r++) for (let c = 1; c <= totalCols; c++) applyGreyHeader(ws.getCell(r, c), true);
					[
						{
							c: 1,
							v: "RATING\nOF\nINCOMER"
						},
						{
							c: 2,
							v: "RATING\nOF\nELCB"
						},
						{
							c: 3,
							v: "SL\nNO"
						},
						{
							c: 4,
							v: "CIRN\no"
						},
						{
							c: 5,
							v: "MCB\nRTG.\nIN\nAMP"
						},
						{
							c: 6,
							v: "CCT\nWIRE\nSIZE\nmm2"
						},
						{
							c: 7,
							v: "ECC\nWIRE\nSIZE\nmm2"
						},
						{
							c: 8,
							v: "ROOM / AREA"
						}
					].forEach((hf) => {
						ws.mergeCells(4, hf.c, 6, hf.c);
						ws.getCell(4, hf.c).value = hf.v;
					});
					ws.mergeCells(4, 9, 4, 8 + ptsCount);
					ws.getCell(4, 9).value = "CONNECTED LOADS/POINTS";
					POINT_TYPES.forEach((pt, i) => {
						const col = 9 + i;
						ws.mergeCells(5, col, 6, col);
						ws.getCell(5, col).value = pt.name.replace("\n", " ");
						ws.getColumn(col).width = 6;
					});
					const wuCol = 9 + ptsCount;
					ws.mergeCells(4, wuCol, 6, wuCol);
					ws.getCell(4, wuCol).value = "WATT\n/\nUNIT";
					const rCol = wuCol + 1;
					const yCol = rCol + 1;
					const bCol = yCol + 1;
					ws.mergeCells(4, rCol, 4, bCol);
					ws.getCell(4, rCol).value = "LOAD PER CIRCUIT W";
					ws.mergeCells(5, rCol, 6, rCol);
					ws.getCell(5, rCol).value = "R";
					ws.mergeCells(5, yCol, 6, yCol);
					ws.getCell(5, yCol).value = "Y";
					ws.mergeCells(5, bCol, 6, bCol);
					ws.getCell(5, bCol).value = "B";
					const remCol = bCol + 1;
					ws.mergeCells(4, remCol, 6, remCol);
					ws.getCell(4, remCol).value = "REMAR\nKS";
					let startDataRow = 7;
					let currentRow = startDataRow;
					let elcbGroups = /* @__PURE__ */ new Map();
					let totalR = 0, totalY = 0, totalB = 0;
					board.circuits.forEach((c) => {
						if (!elcbGroups.has(c.elcbGroup)) elcbGroups.set(c.elcbGroup, {
							start: currentRow,
							count: 0
						});
						elcbGroups.get(c.elcbGroup).count++;
						const load = calculateCircuitLoad(c);
						const isR = c.phase?.includes("R");
						const isY = c.phase?.includes("Y");
						const isB = c.phase?.includes("B");
						const rLoad = isR ? load : "";
						const yLoad = isY ? load : "";
						const bLoad = isB ? load : "";
						if (isR) totalR += load;
						if (isY) totalY += load;
						if (isB) totalB += load;
						const rowData = new Array(totalCols).fill("");
						rowData[0] = board.incomer?.rating ? `${board.incomer.rating} TP ISOLATOR` : "";
						rowData[1] = c.elcbGroup || "";
						rowData[2] = c.slNo || "";
						rowData[3] = c.cirNo || "";
						rowData[4] = c.mcb || "";
						rowData[5] = c.wireEcc || "";
						rowData[6] = c.wireEcc || "2.5";
						rowData[7] = c.roomArea || "";
						POINT_TYPES.forEach((pt, i) => {
							rowData[8 + i] = c.points?.[pt.id] || "";
						});
						rowData[wuCol - 1] = c.customW || "";
						rowData[rCol - 1] = rLoad;
						rowData[yCol - 1] = yLoad;
						rowData[bCol - 1] = bLoad;
						rowData[remCol - 1] = c.remarks || "";
						ws.addRow(rowData).eachCell((cell, colNum) => applyWhiteCell(cell));
						currentRow++;
					});
					if (board.circuits.length > 0) {
						ws.mergeCells(startDataRow, 1, currentRow - 1, 1);
						const incCell = ws.getCell(startDataRow, 1);
						applyGreyHeader(incCell, false);
						incCell.alignment = {
							horizontal: "center",
							vertical: "middle",
							textRotation: 90
						};
					}
					elcbGroups.forEach((data, groupName) => {
						if (data.count > 0) {
							ws.mergeCells(data.start, 2, data.start + data.count - 1, 2);
							const elcbCell = ws.getCell(data.start, 2);
							elcbCell.alignment = {
								horizontal: "center",
								vertical: "middle",
								textRotation: 90,
								wrapText: true
							};
							elcbCell.font = {
								size: 9,
								name: "Cambria",
								color: { argb: "FF000000" }
							};
						}
					});
					const subRow = ws.addRow(new Array(totalCols).fill(""));
					subRow.eachCell((c) => applyGreyHeader(c, true));
					const firstCirc = 7;
					const lastCirc = currentRow - 1;
					if (lastCirc >= firstCirc) {
						subRow.getCell(rCol).value = {
							formula: `SUM(${ws.getCell(firstCirc, rCol).address}:${ws.getCell(lastCirc, rCol).address})`,
							result: totalR
						};
						subRow.getCell(yCol).value = {
							formula: `SUM(${ws.getCell(firstCirc, yCol).address}:${ws.getCell(lastCirc, yCol).address})`,
							result: totalY
						};
						subRow.getCell(bCol).value = {
							formula: `SUM(${ws.getCell(firstCirc, bCol).address}:${ws.getCell(lastCirc, bCol).address})`,
							result: totalB
						};
					} else {
						subRow.getCell(rCol).value = totalR;
						subRow.getCell(yCol).value = totalY;
						subRow.getCell(bCol).value = totalB;
					}
					currentRow++;
					const totalRow = ws.addRow(new Array(totalCols).fill(""));
					totalRow.eachCell((c) => applyGreyHeader(c, true));
					totalRow.getCell(rCol - 1).value = "TOTAL";
					totalRow.getCell(rCol).value = {
						formula: `SUM(${subRow.getCell(rCol).address}:${subRow.getCell(bCol).address})/1000`,
						result: (totalR + totalY + totalB) / 1e3
					};
					totalRow.getCell(rCol + 1).value = "kw";
					sheetMap[board.name] = {
						sheetName: board.name.substring(0, 31),
						rCell: subRow.getCell(rCol).address,
						yCell: subRow.getCell(yCol).address,
						bCell: subRow.getCell(bCol).address,
						kwCell: totalRow.getCell(rCol).address
					};
					currentRow++;
					const cableRow = ws.addRow(new Array(totalCols).fill(""));
					ws.mergeCells(currentRow, 1, currentRow, totalCols);
					cableRow.getCell(1).value = `CABLE SIZE: ${board.incomer?.cableSize || ""} + ${board.incomer?.eccSize || ""}`;
					applyGreyHeader(cableRow.getCell(1), true);
					currentRow++;
					const legendRow = ws.addRow(new Array(totalCols).fill(""));
					ws.mergeCells(currentRow, 1, currentRow, totalCols);
					const legendText = POINT_TYPES.map((p) => `${p.name.replace("\n", "")}=${p.id}`).join(", ");
					legendRow.getCell(1).value = legendText;
					applyGreyHeader(legendRow.getCell(1), true);
					ws.getColumn(1).width = 8;
					ws.getColumn(2).width = 8;
					ws.getColumn(3).width = 5;
					ws.getColumn(4).width = 6;
					ws.getColumn(5).width = 6;
					ws.getColumn(6).width = 6;
					ws.getColumn(7).width = 6;
					ws.getColumn(8).width = 25;
				} else {
					const totalCols = 19;
					for (let i = 1; i <= 4; i++) {
						ws.addRow(new Array(totalCols).fill(""));
						ws.getRow(i).height = 20;
					}
					const makeMetaCell = (r, c, endC, text, bold = true) => {
						ws.mergeCells(r, c, r, endC);
						const cell = ws.getCell(r, c);
						cell.value = text;
						cell.font = {
							bold,
							size: 9,
							name: "Cambria",
							color: { argb: "FF000000" }
						};
						cell.alignment = {
							horizontal: "left",
							vertical: "middle",
							wrapText: true
						};
					};
					makeMetaCell(1, 1, 5, "PROJECT: ARISTA OFFICE BUILDING (3B+G+7+R)");
					ws.mergeCells(1, 6, 1, 14);
					const mTitle = ws.getCell(1, 6);
					mTitle.value = "DETAIL OF CONNECTED LOAD, MAX. DEMAND & kWh METERING";
					mTitle.font = {
						bold: true,
						size: 10,
						name: "Cambria",
						color: { argb: "FF000000" }
					};
					mTitle.alignment = {
						horizontal: "center",
						vertical: "middle"
					};
					makeMetaCell(1, 15, 19, "AREA: AL FURJAN, DUBAI, U.A.E\nPLOT NO. 5911831");
					makeMetaCell(2, 1, 5, "PLANNED COMPLETION DATE:");
					makeMetaCell(2, 15, 19, "PLOT NO. 5911831");
					makeMetaCell(3, 1, 5, `SMDB NO.\t\t${board.name}`);
					makeMetaCell(3, 6, 14, "MAIN CONSULTANT: JOHN R HARRIS");
					makeMetaCell(4, 1, 5, `FED FROM\t\t${boards.find((b) => b.id === board.fedFrom)?.name || board.fedFrom}`);
					makeMetaCell(4, 6, 14, "MEP CONSULTANT: CONSISTENT ENGINEERING CONSULTANTS");
					makeMetaCell(4, 15, 19, "LOCATION: GF F&B");
					for (let r = 1; r <= 4; r++) for (let c = 1; c <= 19; c++) ws.getCell(r, c).border = {
						top: { style: "thin" },
						left: { style: "thin" },
						bottom: { style: "thin" },
						right: { style: "thin" }
					};
					for (let i = 5; i <= 7; i++) {
						ws.addRow(new Array(totalCols).fill(""));
						for (let c = 1; c <= 19; c++) applyWhiteCell(ws.getCell(i, c), true, 8, "center");
					}
					ws.mergeCells(5, 1, 7, 1);
					ws.getCell(5, 1).value = "CIRCUIT/FEEDER\n\nSMDB/\nDB NO.";
					ws.mergeCells(5, 2, 7, 2);
					ws.getCell(5, 2).value = "SP/\nTP";
					ws.mergeCells(5, 3, 7, 3);
					ws.getCell(5, 3).value = "ACB/\nMCCB/\nISOLATOR\n\nRATING\n(AMPS)";
					ws.mergeCells(5, 4, 7, 4);
					ws.getCell(5, 4).value = "FAULT\n\nDUTY\nkA";
					ws.mergeCells(5, 5, 5, 7);
					ws.getCell(5, 5).value = "CABLE SIZE, TYPE\nAND\nNO. OF CORES";
					ws.mergeCells(6, 5, 6, 5);
					ws.getCell(6, 5).value = "NO. OF\nCORES\n1C/\n2C/4C";
					ws.mergeCells(6, 6, 6, 6);
					ws.getCell(6, 6).value = "TYPE\nXLPE/\nPVC/\nSWA";
					ws.mergeCells(6, 7, 6, 7);
					ws.getCell(6, 7).value = "SIZE";
					ws.getCell(7, 5).value = "1x4C";
					ws.getCell(7, 6).value = "XLPE/SWA/PVC/CU";
					ws.getCell(7, 7).value = "95";
					ws.mergeCells(5, 8, 6, 8);
					ws.getCell(5, 8).value = "ECC\nSIZE";
					ws.getCell(7, 8).value = "1C,\nmm2";
					ws.mergeCells(5, 9, 6, 9);
					ws.getCell(5, 9).value = "LENGTH\nOF";
					ws.getCell(7, 9).value = "CABLE\n(Mtrs.)";
					ws.mergeCells(5, 10, 6, 12);
					ws.getCell(5, 10).value = "CONNECTED LOAD\n(KW)";
					ws.getCell(7, 10).value = "R - PH\nKW";
					ws.getCell(7, 11).value = "Y - PH\nKW";
					ws.getCell(7, 12).value = "B - PH\nKW";
					ws.mergeCells(5, 13, 6, 13);
					ws.getCell(5, 13).value = "TOTAL\nCONNECTED/\nINSTALLED\nLOAD";
					ws.getCell(7, 13).value = "(TCL)\n*\nKW";
					ws.mergeCells(5, 14, 6, 14);
					ws.getCell(5, 14).value = "DIVERSITY\nFACTOR\n(DF)";
					ws.getCell(7, 14).value = "";
					ws.mergeCells(5, 15, 6, 15);
					ws.getCell(5, 15).value = "MAX.\nDEMAND/\nOPERATIONAL\nLOAD";
					ws.getCell(7, 15).value = "(MDL)\nKW";
					ws.mergeCells(5, 16, 6, 18);
					ws.getCell(5, 16).value = "PROPOSED TYPE & NO. OF\nkWh METERS";
					ws.getCell(7, 16).value = "1 - PH\n(1)";
					ws.getCell(7, 17).value = "3 - PH\n(2)";
					ws.getCell(7, 18).value = "* LV/\nHV\nCT\n(3)";
					ws.mergeCells(5, 19, 7, 19);
					ws.getCell(5, 19).value = "REMARKS";
					let totalBoardKW = 0;
					let totalR = 0;
					let totalY = 0;
					let totalB = 0;
					board.circuits.forEach((c) => {
						const lKW = (Number(c.qty) || 1) * (Number(c.loadW) || 0) / 1e3;
						totalBoardKW += lKW;
						const isR = c.phase?.includes("R");
						const isY = c.phase?.includes("Y");
						const isB = c.phase?.includes("B");
						if (isR) totalR += lKW;
						if (isY) totalY += lKW;
						if (isB) totalB += lKW;
						if (c.phase?.includes("3-Phase") || !c.phase) {
							totalR += lKW / 3;
							totalY += lKW / 3;
							totalB += lKW / 3;
						}
					});
					const incRow = ws.addRow(new Array(totalCols).fill(""));
					for (let c = 1; c <= 19; c++) applyWhiteCell(incRow.getCell(c), true, 9, "center");
					incRow.getCell(1).alignment = {
						horizontal: "left",
						vertical: "middle"
					};
					incRow.getCell(1).value = "INCOMER";
					incRow.getCell(2).value = "TP";
					incRow.getCell(3).value = board.incomer?.rating || "200";
					incRow.getCell(4).value = "50";
					incRow.getCell(5).value = "1x4C";
					incRow.getCell(6).value = "XLPE/SWA/PVC/CU";
					incRow.getCell(7).value = "95";
					incRow.getCell(8).value = "1x1cx50";
					incRow.getCell(10).value = totalR.toFixed(2);
					incRow.getCell(11).value = totalY.toFixed(2);
					incRow.getCell(12).value = totalB.toFixed(2);
					incRow.getCell(13).value = totalBoardKW.toFixed(2);
					incRow.getCell(14).value = "0";
					incRow.getCell(15).value = "0";
					incRow.getCell(16).value = "0";
					incRow.getCell(17).value = "0";
					incRow.getCell(18).value = "1";
					incRow.getCell(19).value = "200/5A CT METER";
					const outRow = ws.addRow(new Array(totalCols).fill(""));
					for (let c = 1; c <= 19; c++) applyWhiteCell(outRow.getCell(c), false, 9, "center");
					outRow.getCell(1).alignment = {
						horizontal: "left",
						vertical: "middle"
					};
					outRow.getCell(1).value = "OUTGOING:";
					let totalMDL = 0;
					board.circuits.forEach((c) => {
						const r = ws.addRow(new Array(totalCols).fill(""));
						for (let col = 1; col <= 19; col++) applyWhiteCell(r.getCell(col), false, 9, "center");
						r.height = 30;
						const lKW = (Number(c.qty) || 1) * (Number(c.loadW) || 0) / 1e3;
						let rKw = 0;
						let yKw = 0;
						let bKw = 0;
						if (c.rKw !== void 0 && c.yKw !== void 0 && c.bKw !== void 0) {
							rKw = c.rKw / 1e3;
							yKw = c.yKw / 1e3;
							bKw = c.bKw / 1e3;
						} else if (c.phase?.includes("R")) rKw = lKW;
						else if (c.phase?.includes("Y")) yKw = lKW;
						else if (c.phase?.includes("B")) bKw = lKW;
						else {
							rKw = lKW / 3;
							yKw = lKW / 3;
							bKw = lKW / 3;
						}
						const mdl = lKW * (Number(c.df) || 1);
						totalMDL += mdl;
						r.getCell(1).value = c.desc || `DB-${c.id}`;
						r.getCell(2).value = "TP";
						r.getCell(3).value = c.mcb || "63";
						r.getCell(4).value = c.faultKa || "35";
						r.getCell(5).value = "1x4C";
						r.getCell(6).value = "XLPE/SWA/PVC/CU";
						r.getCell(7).value = c.wire || "16";
						r.getCell(8).value = c.ecc || `1x1cx16`;
						r.getCell(9).value = c.len || "";
						r.getCell(10).value = rKw > 0 ? rKw.toFixed(2) : "";
						r.getCell(11).value = yKw > 0 ? yKw.toFixed(2) : "";
						r.getCell(12).value = bKw > 0 ? bKw.toFixed(2) : "";
						r.getCell(13).value = lKW.toFixed(2);
						r.getCell(14).value = "";
						r.getCell(15).value = "";
						r.getCell(19).value = c.remarks || "";
					});
					const totRow = ws.addRow(new Array(totalCols).fill(""));
					for (let col = 1; col <= 19; col++) applyWhiteCell(totRow.getCell(col), true, 9, "center");
					ws.mergeCells(totRow.number, 1, totRow.number, 4);
					const titleCell = totRow.getCell(1);
					titleCell.value = `${board.name} FED FROM ${boards.find((b) => b.id === board.fedFrom)?.name || board.fedFrom}`;
					titleCell.alignment = {
						horizontal: "left",
						vertical: "middle"
					};
					ws.mergeCells(totRow.number, 5, totRow.number, 9);
					totRow.getCell(5).value = "TOTAL CONNECTED LOAD PER\nPHASE:";
					const firstCircRow = outRow.number + 1;
					const lastCircRow = totRow.number - 1;
					if (lastCircRow >= firstCircRow) {
						totRow.getCell(10).value = {
							formula: `SUM(J${firstCircRow}:J${lastCircRow})`,
							result: totalR
						};
						totRow.getCell(11).value = {
							formula: `SUM(K${firstCircRow}:K${lastCircRow})`,
							result: totalY
						};
						totRow.getCell(12).value = {
							formula: `SUM(L${firstCircRow}:L${lastCircRow})`,
							result: totalB
						};
						totRow.getCell(13).value = {
							formula: `SUM(M${firstCircRow}:M${lastCircRow})`,
							result: totalBoardKW
						};
					} else {
						totRow.getCell(10).value = totalR.toFixed(2);
						totRow.getCell(11).value = totalY.toFixed(2);
						totRow.getCell(12).value = totalB.toFixed(2);
						totRow.getCell(13).value = totalBoardKW.toFixed(2);
					}
					incRow.getCell(10).value = {
						formula: `J${totRow.number}`,
						result: totalR
					};
					incRow.getCell(11).value = {
						formula: `K${totRow.number}`,
						result: totalY
					};
					incRow.getCell(12).value = {
						formula: `L${totRow.number}`,
						result: totalB
					};
					incRow.getCell(13).value = {
						formula: `M${totRow.number}`,
						result: totalBoardKW
					};
					sheetMap[board.name] = {
						sheetName: board.name.substring(0, 31),
						rCell: totRow.getCell(10).address,
						yCell: totRow.getCell(11).address,
						bCell: totRow.getCell(12).address,
						kwCell: totRow.getCell(13).address
					};
					totRow.getCell(14).value = "0.00";
					totRow.getCell(15).value = "0.00";
					totRow.getCell(16).value = "0";
					totRow.getCell(17).value = "0";
					totRow.getCell(18).value = "0";
					totRow.getCell(19).value = "TOTAL";
					ws.addRow(new Array(totalCols).fill(""));
					const demandRow = ws.addRow(new Array(totalCols).fill(""));
					for (let col = 1; col <= 19; col++) applyWhiteCell(demandRow.getCell(col), true, 9, "left");
					ws.mergeCells(demandRow.number, 1, demandRow.number, 3);
					demandRow.getCell(1).value = "DEMAND FACTOR :";
					ws.mergeCells(demandRow.number, 4, demandRow.number, 7);
					demandRow.getCell(4).value = "0.00 Max. DEMAND:";
					ws.mergeCells(demandRow.number, 8, demandRow.number, 13);
					demandRow.getCell(8).value = "0.00 kW";
					ws.mergeCells(demandRow.number, 14, demandRow.number, 19);
					demandRow.getCell(14).value = "TOTAL BUILD-UP AREA:";
					ws.getColumn(1).width = 25;
					ws.getColumn(2).width = 6;
					ws.getColumn(3).width = 10;
					ws.getColumn(4).width = 8;
					ws.getColumn(5).width = 8;
					ws.getColumn(6).width = 18;
					ws.getColumn(7).width = 6;
					ws.getColumn(8).width = 10;
					ws.getColumn(9).width = 8;
					ws.getColumn(10).width = 8;
					ws.getColumn(11).width = 8;
					ws.getColumn(12).width = 8;
					ws.getColumn(13).width = 10;
					ws.getColumn(14).width = 8;
					ws.getColumn(15).width = 10;
					ws.getColumn(16).width = 6;
					ws.getColumn(17).width = 6;
					ws.getColumn(18).width = 8;
					ws.getColumn(19).width = 25;
				}
			});
			crossSheetLinks.forEach((link) => {
				const map = sheetMap[link.boardName];
				if (map) {
					link.targetR.value = { formula: `'${map.sheetName}'!${map.rCell}` };
					link.targetY.value = { formula: `'${map.sheetName}'!${map.yCell}` };
					link.targetB.value = { formula: `'${map.sheetName}'!${map.bCell}` };
					link.targetKW.value = { formula: `'${map.sheetName}'!${map.kwCell}` };
				}
			});
			const buffer = await wb.xlsx.writeBuffer();
			saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "Project_Load_Schedule.xlsx");
		} catch (err) {
			console.error("Export failed", err);
			alert("Export failed: " + (err.message || err));
		}
	};
	let totalR = 0, totalY = 0, totalB = 0;
	activeBoard?.circuits.forEach((c) => {
		const load = calculateCircuitLoad(c) * (c.df !== void 0 ? Number(c.df) : 1);
		if (c.phase.includes("R")) totalR += load;
		else if (c.phase.includes("Y")) totalY += load;
		else if (c.phase.includes("B")) totalB += load;
		else if (c.phase.includes("3-Phase")) {
			totalR += load / 3;
			totalY += load / 3;
			totalB += load / 3;
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col h-full bg-slate-50 text-slate-800 font-sans",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm shrink-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
				className: "text-xl font-bold text-slate-900 flex items-center gap-2",
				children: ["Load Schedule ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs font-normal text-slate-500",
					children: "Hierarchical MEP Load Distribution Manager"
				})]
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: globalNetworkBalance,
					className: "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#3178c6] text-white rounded hover:bg-[#2968ad] transition shadow-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-3" }), " Global Network Balance"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex bg-slate-100 p-1 rounded-md border border-slate-200",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setView("schedule"),
						className: `px-3 py-1 text-xs font-medium rounded transition ${view === "schedule" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Table, { className: "size-3 inline mr-1" }), " Table View"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setView("sld"),
						className: `px-3 py-1 text-xs font-medium rounded transition ${view === "sld" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Network, { className: "size-3 inline mr-1" }), " Network SLD"]
					})]
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex-1 flex flex-col overflow-hidden",
			children: [
				view === "sld" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex-1 m-4 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 shadow-inner relative",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NetworkSLD, {
						boards,
						onNodeClick: (id) => {
							setActiveBoardId(id);
							setView("table");
						},
						onConnectBoard: (source, target) => {
							updateBoardGlobal(target, { fedFrom: source });
						}
					})
				}) : activeBoardId === "SUMMARY" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex-1 m-4 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center bg-slate-100",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-slate-500",
						children: "Project Load Summary View"
					})
				}) : activeBoard ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 flex flex-col bg-white overflow-hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-4 p-4 border-b border-slate-200 bg-slate-50 shrink-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 bg-white p-3 rounded border border-slate-200 shadow-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-xs font-semibold text-blue-700 mb-3 flex items-center gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-3" }), " General Configuration"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-slate-500 font-bold mb-1 block",
												children: "Board Name"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "w-full h-8 px-2 border border-slate-300 rounded text-sm",
												value: activeBoard.name,
												onChange: (e) => updateBoard({ name: e.target.value })
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "w-32",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-slate-500 font-bold mb-1 block",
												children: "Phase Type"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												className: "w-full h-8 px-2 border border-slate-300 rounded text-sm bg-white",
												value: activeBoard.phaseType,
												onChange: (e) => updateBoard({ phaseType: e.target.value }),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "3-Phase" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "1-Phase" })]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "w-32",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-slate-500 font-bold mb-1 block",
												children: "Board Type"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												className: "w-full h-8 px-2 border border-slate-300 rounded text-sm bg-white",
												value: activeBoard.type,
												onChange: (e) => {
													updateBoard({
														type: e.target.value,
														circuits: []
													});
												},
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "DB" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "LV-PANEL" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "BUSBAR" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "MDB" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "SMDB" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "ESDB" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "EDB" })
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "w-40",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-slate-500 font-bold mb-1 block",
												children: "Fed From"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												className: "w-full h-8 px-2 border border-slate-300 rounded text-sm bg-white",
												value: activeBoard.fedFrom || "DEWA/GRID",
												onChange: (e) => updateBoard({ fedFrom: e.target.value }),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "DEWA/GRID",
													children: "DEWA/GRID"
												}), boards.filter((b) => b.id !== activeBoard.id).map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: b.id,
													children: b.name
												}, b.id))]
											})]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-[1.5] bg-emerald-50/50 p-3 rounded border border-emerald-200 shadow-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-xs font-semibold text-emerald-700 mb-3 flex items-center gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Network, { className: "size-3" }), " Incomer Specifications"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex gap-2",
									children: isDB ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-emerald-700/70 font-bold mb-1 block",
												children: "Rating"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "w-full h-8 px-2 border border-emerald-200 rounded text-sm bg-white",
												value: activeBoard.incomer.rating,
												onChange: (e) => updateIncomer("rating", e.target.value)
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-emerald-700/70 font-bold mb-1 block",
												children: "SP/TP"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "w-full h-8 px-2 border border-emerald-200 rounded text-sm bg-white",
												value: activeBoard.incomer.sptp,
												onChange: (e) => updateIncomer("sptp", e.target.value)
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-emerald-700/70 font-bold mb-1 block",
												children: "Fault KA"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "w-full h-8 px-2 border border-emerald-200 rounded text-sm bg-white",
												value: activeBoard.incomer.faultKa,
												onChange: (e) => updateIncomer("faultKa", e.target.value)
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-emerald-700/70 font-bold mb-1 block",
												children: "Cable Size"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "w-full h-8 px-2 border border-emerald-200 rounded text-sm bg-white",
												value: activeBoard.incomer.cableSize,
												onChange: (e) => updateIncomer("cableSize", e.target.value)
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-emerald-700/70 font-bold mb-1 block",
												children: "ECC Size"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "w-full h-8 px-2 border border-emerald-200 rounded text-sm bg-white",
												value: activeBoard.incomer.eccSize,
												onChange: (e) => updateIncomer("eccSize", e.target.value)
											})]
										})
									] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-emerald-700/70 font-bold mb-1 block",
												children: "Inc 1 Rating"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												className: "w-full h-8 px-1 border border-emerald-200 rounded text-sm bg-white",
												value: activeBoard.incomer.inc1,
												onChange: (e) => updateIncomer("inc1", e.target.value),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "1600A" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "2500A" })]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-emerald-700/70 font-bold mb-1 block",
												children: "Inc 2 Rating"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												className: "w-full h-8 px-1 border border-emerald-200 rounded text-sm bg-white",
												value: activeBoard.incomer.inc2,
												onChange: (e) => updateIncomer("inc2", e.target.value),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "1600A" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "2500A" })]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-emerald-700/70 font-bold mb-1 block",
												children: "Meter Type"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												className: "w-full h-8 px-1 border border-emerald-200 rounded text-sm bg-white",
												value: activeBoard.incomer.meterType,
												onChange: (e) => updateIncomer("meterType", e.target.value),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "None" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "KWH" })]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-emerald-700/70 font-bold mb-1 block",
												children: "SP/TP"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "w-full h-8 px-2 border border-emerald-200 rounded text-sm bg-white",
												value: activeBoard.incomer.sptp,
												onChange: (e) => updateIncomer("sptp", e.target.value)
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-emerald-700/70 font-bold mb-1 block",
												children: "Fault KA"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "w-full h-8 px-2 border border-emerald-200 rounded text-sm bg-white",
												value: activeBoard.incomer.faultKa,
												onChange: (e) => updateIncomer("faultKa", e.target.value)
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-emerald-700/70 font-bold mb-1 block",
												children: "Cable Size"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "w-full h-8 px-2 border border-emerald-200 rounded text-sm bg-white",
												value: activeBoard.incomer.cableSize,
												onChange: (e) => updateIncomer("cableSize", e.target.value)
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-[10px] uppercase text-emerald-700/70 font-bold mb-1 block",
												children: "ECC Size"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "w-full h-8 px-2 border border-emerald-200 rounded text-sm bg-white",
												value: activeBoard.incomer.eccSize,
												onChange: (e) => updateIncomer("eccSize", e.target.value)
											})]
										})
									] })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2 justify-center shrink-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: autoSizeAndGroup,
										className: "h-8 px-3 text-xs bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50 flex items-center gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Network, { className: "size-3" }), " Auto-Size & Group"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: autoBalancePhases,
										className: "h-8 px-3 text-xs bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50 flex items-center gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-3" }), " Auto Balance Phases"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => setIsCompactView(!isCompactView),
										className: `h-8 px-3 text-xs border border-slate-300 rounded shadow-sm flex items-center gap-1 transition-colors ${isCompactView ? "bg-slate-700 text-white border-white/20 hover:bg-slate-800" : "bg-white hover:bg-slate-50"}`,
										children: [isCompactView ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "size-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-3" }), isCompactView ? "Full View" : "Compact View"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: exportSchedule,
										className: "h-8 px-3 text-xs bg-[#3178c6] text-white rounded shadow-sm hover:bg-[#2968ad] flex items-center gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3" }), " Export Schedule"]
									})
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						ref: tableContainerRef,
						className: "flex-1 overflow-auto bg-white text-slate-800",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-max min-w-full text-xs text-center border-collapse",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
									className: "bg-[#2968ad] text-slate-200 sticky top-0 z-20 shadow-md outline outline-1 outline-slate-700",
									children: isDB ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											rowSpan: 2,
											className: "border border-white/20 p-2 w-16 bg-[#3178c6]",
											children: "CIRNo"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
											rowSpan: 2,
											className: "border border-white/20 p-2 w-16 bg-[#3178c6]",
											children: ["MCB (A) ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
												onClick: () => copyDown("mcb", activeBoard.circuits[0]?.mcb),
												className: "size-3 inline cursor-pointer hover:text-white"
											})]
										}),
										!isCompactView && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
											rowSpan: 2,
											className: "border border-white/20 p-2 w-20 bg-[#3178c6]",
											children: ["WIRE/ECC ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
												onClick: () => copyDown("wireEcc", activeBoard.circuits[0]?.wireEcc),
												className: "size-3 inline cursor-pointer hover:text-white"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
											rowSpan: 2,
											className: "border border-white/20 p-2 w-32 bg-[#3178c6]",
											children: ["ROOM/AREA ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
												onClick: () => copyDown("roomArea", activeBoard.circuits[0]?.roomArea),
												className: "size-3 inline cursor-pointer hover:text-white"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											colSpan: POINT_TYPES.length + 1,
											className: "border border-white/20 p-1 bg-[#2968ad]",
											children: "CONNECTED LOADS / POINTS"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											rowSpan: 2,
											className: "border border-white/20 p-2 w-20 bg-slate-700/50",
											children: "CUSTOM W"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											rowSpan: 2,
											className: "border border-white/20 p-2 w-24 bg-[#3178c6]",
											children: "PHASE"
										}),
										!isCompactView && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											rowSpan: 2,
											className: "border border-white/20 p-2 w-32 bg-[#3178c6]",
											children: "REMARKS"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											rowSpan: 2,
											className: "border border-white/20 p-2 w-16 bg-[#3178c6] text-slate-400 text-center",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3 inline" })
										})
									] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [POINT_TYPES.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
										className: "border border-white/20 p-1 text-[9px] w-12 hover:bg-slate-700",
										title: `${p.defaultW}W`,
										children: [
											p.name,
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-2.5 inline cursor-pointer" })
										]
									}, p.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "border border-white/20 p-1 text-[9px] w-14 bg-slate-700/30",
										children: "W/UNIT"
									})] })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "border border-white/20 p-2 w-16 bg-[#3178c6]",
											children: "CIR NO"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
											className: "border border-white/20 p-2 w-48 bg-[#3178c6]",
											children: ["LOAD DESCRIPTION ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
												onClick: () => copyDown("desc", activeBoard.circuits[0]?.desc),
												className: "size-3 inline cursor-pointer hover:text-white"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
											className: "border border-white/20 p-2 w-16 bg-[#3178c6]",
											children: ["QTY ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
												onClick: () => copyDown("qty", activeBoard.circuits[0]?.qty),
												className: "size-3 inline cursor-pointer hover:text-white"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
											className: "border border-white/20 p-2 w-20 bg-[#3178c6]",
											children: ["LOAD(W) ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
												onClick: () => copyDown("loadW", activeBoard.circuits[0]?.loadW),
												className: "size-3 inline cursor-pointer hover:text-white"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "border border-white/20 p-2 w-24 bg-[#3178c6]",
											children: "PHASE"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "border border-white/20 p-2 w-20 bg-red-950/40 text-red-400",
											children: "R (W)"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "border border-white/20 p-2 w-20 bg-yellow-950/40 text-yellow-400",
											children: "Y (W)"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "border border-white/20 p-2 w-20 bg-blue-950/40 text-blue-400",
											children: "B (W)"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "border border-white/20 p-2 w-16 bg-[#3178c6]",
											children: "DF"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
											className: "border border-white/20 p-2 w-16 bg-[#3178c6]",
											children: ["MCB ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
												onClick: () => copyDown("mcb", activeBoard.circuits[0]?.mcb),
												className: "size-3 inline cursor-pointer hover:text-white"
											})]
										}),
										!isCompactView && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "border border-white/20 p-2 w-20 bg-[#3178c6]",
												children: "FAULT KA"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
												className: "border border-white/20 p-2 w-16 bg-[#3178c6]",
												children: ["WIRE ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
													onClick: () => copyDown("wire", activeBoard.circuits[0]?.wire),
													className: "size-3 inline cursor-pointer hover:text-white"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
												className: "border border-white/20 p-2 w-24 bg-[#3178c6]",
												children: ["TYPE ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
													onClick: () => copyDown("type", activeBoard.circuits[0]?.type),
													className: "size-3 inline cursor-pointer hover:text-white"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
												className: "border border-white/20 p-2 w-16 bg-[#3178c6]",
												children: ["ECC ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
													onClick: () => copyDown("ecc", activeBoard.circuits[0]?.ecc),
													className: "size-3 inline cursor-pointer hover:text-white"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "border border-white/20 p-2 w-20 bg-[#3178c6]",
												children: "LEN(M)"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "border border-white/20 p-2 w-20 bg-[#3178c6]",
												children: "1-PH MTR"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "border border-white/20 p-2 w-20 bg-[#3178c6]",
												children: "3-PH MTR"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "border border-white/20 p-2 w-20 bg-[#3178c6]",
												children: "CT MTR"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "border border-white/20 p-2 w-32 bg-[#3178c6]",
												children: "REMARKS"
											})
										] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "border border-white/20 p-2 w-16 bg-[#3178c6] text-slate-400 text-center",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3 inline" })
										})
									] })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [activeBoard.circuits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									colSpan: 30,
									className: "p-12 text-center text-slate-500",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-8 mx-auto mb-3 opacity-20" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm",
											children: "No circuits added yet"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs",
											children: "Click the Add Circuit button below to start configuring your board's schedule."
										})
									]
								}) }) : activeBoard.circuits.map((c) => {
									const load = calculateCircuitLoad(c);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
										className: "border-b border-slate-300 hover:bg-slate-50",
										children: [isDB ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
													value: c.cirNo,
													onChange: (e) => updateCircuit(c.id, "cirNo", e.target.value)
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
													value: c.mcb,
													onChange: (e) => updateCircuit(c.id, "mcb", e.target.value)
												})
											}),
											!isCompactView && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
													value: c.wireEcc,
													onChange: (e) => updateCircuit(c.id, "wireEcc", e.target.value)
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													className: "w-full h-8 px-2 bg-transparent outline-none focus:bg-slate-100 text-left",
													value: c.roomArea,
													onChange: (e) => updateCircuit(c.id, "roomArea", e.target.value)
												})
											}),
											POINT_TYPES.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													min: "0",
													className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100 text-blue-700 font-medium",
													value: c.points[p.id] || "",
													onChange: (e) => updatePoint(c.id, p.id, e.target.value)
												})
											}, p.id)),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
													value: c.wPerUnit,
													onChange: (e) => updateCircuit(c.id, "wPerUnit", Number(e.target.value))
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300 bg-slate-100",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													className: "w-full h-8 px-2 bg-transparent outline-none focus:bg-slate-100 text-right text-emerald-700",
													value: c.customW,
													onChange: (e) => updateCircuit(c.id, "customW", Number(e.target.value))
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
													className: "w-full h-8 px-1 bg-transparent outline-none focus:bg-slate-100",
													value: c.phase,
													onChange: (e) => updateCircuit(c.id, "phase", e.target.value),
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "R Phase" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Y Phase" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "B Phase" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "3-Phase" })
													]
												})
											}),
											!isCompactView && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													className: "w-full h-8 px-2 bg-transparent outline-none focus:bg-slate-100 text-left",
													value: c.remarks,
													onChange: (e) => updateCircuit(c.id, "remarks", e.target.value)
												})
											})
										] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
													value: c.cirNo,
													onChange: (e) => updateCircuit(c.id, "cirNo", e.target.value)
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													className: `w-full h-8 px-2 bg-transparent outline-none focus:bg-slate-100 text-left ${c.isFeeder ? "text-blue-700 font-medium" : ""}`,
													value: c.desc,
													onChange: (e) => updateCircuit(c.id, "desc", e.target.value),
													disabled: c.isFeeder,
													title: c.isFeeder ? "Feeder name is locked to the connected board name. Rename the board instead." : ""
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
													value: c.qty,
													onChange: (e) => updateCircuit(c.id, "qty", Number(e.target.value))
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													className: "w-full h-8 px-2 bg-transparent text-right outline-none focus:bg-slate-100 text-emerald-700",
													value: c.loadW,
													onChange: (e) => updateCircuit(c.id, "loadW", Number(e.target.value))
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
													className: "w-full h-8 px-1 bg-transparent outline-none focus:bg-slate-100 text-xs",
													value: c.phase,
													onChange: (e) => updateCircuit(c.id, "phase", e.target.value),
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "R Phase" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Y Phase" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "B Phase" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "3-Phase" })
													]
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300 text-right pr-2 text-red-600 font-medium font-mono",
												children: c.rKw !== void 0 ? c.rKw.toFixed(1) : c.phase.includes("R") ? load : c.phase === "3-Phase" ? (load / 3).toFixed(1) : ""
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300 text-right pr-2 text-yellow-600 font-medium font-mono",
												children: c.yKw !== void 0 ? c.yKw.toFixed(1) : c.phase.includes("Y") ? load : c.phase === "3-Phase" ? (load / 3).toFixed(1) : ""
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300 text-right pr-2 text-blue-700 font-medium font-mono",
												children: c.bKw !== void 0 ? c.bKw.toFixed(1) : c.phase.includes("B") ? load : c.phase === "3-Phase" ? (load / 3).toFixed(1) : ""
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													step: "0.1",
													className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
													value: c.df,
													onChange: (e) => updateCircuit(c.id, "df", Number(e.target.value))
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-0 border-r border-slate-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
													value: c.mcb,
													onChange: (e) => updateCircuit(c.id, "mcb", e.target.value)
												})
											}),
											!isCompactView && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "p-0 border-r border-slate-300",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
														value: c.faultKa,
														onChange: (e) => updateCircuit(c.id, "faultKa", e.target.value)
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "p-0 border-r border-slate-300",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
														value: c.wire,
														onChange: (e) => updateCircuit(c.id, "wire", e.target.value)
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "p-0 border-r border-slate-300",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
														className: "w-full h-8 px-1 bg-transparent outline-none focus:bg-slate-100 text-[10px]",
														value: c.type,
														onChange: (e) => updateCircuit(c.id, "type", e.target.value),
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "XLPE/SWA/PVC" }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "PVC/PVC" }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "FP200" })
														]
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "p-0 border-r border-slate-300",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
														value: c.ecc,
														onChange: (e) => updateCircuit(c.id, "ecc", e.target.value)
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "p-0 border-r border-slate-300",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
														value: c.len,
														onChange: (e) => updateCircuit(c.id, "len", e.target.value)
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "p-0 border-r border-slate-300",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
														value: c.ph1Mtr,
														onChange: (e) => updateCircuit(c.id, "ph1Mtr", e.target.value)
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "p-0 border-r border-slate-300",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
														value: c.ph3Mtr,
														onChange: (e) => updateCircuit(c.id, "ph3Mtr", e.target.value)
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "p-0 border-r border-slate-300",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														className: "w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100",
														value: c.ctMtr,
														onChange: (e) => updateCircuit(c.id, "ctMtr", e.target.value)
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "p-0 border-r border-slate-300",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														className: "w-full h-8 px-2 bg-transparent outline-none focus:bg-slate-100 text-left",
														value: c.remarks,
														onChange: (e) => updateCircuit(c.id, "remarks", e.target.value)
													})
												})
											] })
										] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "p-0 text-center",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-center items-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => duplicateCircuit(c),
													className: "p-1 text-slate-500 hover:text-[#3178c6] rounded",
													title: "Duplicate Circuit",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => {
														if (c.isFeeder) {
															alert(`Cannot delete this circuit directly because it is a Feeder for a connected board (${c.desc}).\n\nTo remove this feeder, you must go to the child board and change its 'Fed From' setting to 'None'. The Global Network will then automatically remove this circuit from this board.`);
															return;
														}
														updateBoard({ circuits: activeBoard.circuits.filter((cc) => cc.id !== c.id) });
													},
													className: "p-1 text-slate-500 hover:text-red-400 rounded",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
												})]
											})
										})]
									}, c.id);
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									colSpan: 100,
									className: "p-4 bg-slate-50 border-t border-slate-300",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex justify-center",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: addCircuit,
											className: "px-6 py-2 bg-[#3178c6] hover:bg-[#2968ad] text-white font-medium rounded-full shadow-md flex items-center gap-2 transition-transform hover:scale-105 active:scale-95",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Add Circuit"]
										})
									})
								}) })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tfoot", {
									className: "sticky bottom-0 z-20 bg-[#2968ad] text-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] outline outline-1 outline-slate-700",
									children: isDB ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										colSpan: isCompactView ? 3 : 4,
										className: "border border-white/20 p-2 text-right font-bold text-[10px]",
										children: "TOTALS:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
										colSpan: POINT_TYPES.length + 5,
										className: "border border-white/20 p-2 font-bold text-[11px] text-center bg-[#3178c6]",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-red-400 mr-4",
												children: [
													"R: ",
													totalR.toLocaleString(void 0, { maximumFractionDigits: 0 }),
													" W"
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-yellow-400 mr-4",
												children: [
													"Y: ",
													totalY.toLocaleString(void 0, { maximumFractionDigits: 0 }),
													" W"
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-blue-400 mr-4",
												children: [
													"B: ",
													totalB.toLocaleString(void 0, { maximumFractionDigits: 0 }),
													" W"
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-white",
												children: [
													"TOTAL: ",
													(totalR + totalY + totalB).toLocaleString(void 0, { maximumFractionDigits: 0 }),
													" W"
												]
											})
										]
									})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											colSpan: 5,
											className: "border border-white/20 p-2 text-right font-bold text-slate-300",
											children: "TOTAL:"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "border border-white/20 p-2 font-bold text-red-400 bg-[#3178c6]",
											children: totalR.toLocaleString(void 0, { maximumFractionDigits: 0 })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "border border-white/20 p-2 font-bold text-yellow-400 bg-[#3178c6]",
											children: totalY.toLocaleString(void 0, { maximumFractionDigits: 0 })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "border border-white/20 p-2 font-bold text-blue-400 bg-[#3178c6]",
											children: totalB.toLocaleString(void 0, { maximumFractionDigits: 0 })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
											colSpan: isCompactView ? 3 : 12,
											className: "border border-white/20 p-2 text-left font-bold pl-4 text-slate-300 bg-[#3178c6]",
											children: [
												"TOTAL MDL: ",
												activeBoard.circuits.reduce((sum, c) => sum + (c.loadW || 0) * (c.df || 1), 0).toLocaleString(void 0, { maximumFractionDigits: 0 }),
												" W"
											]
										})
									] })
								})
							]
						})
					})]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between h-12 bg-white border-t border-slate-200 px-4 shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 mr-4 opacity-50",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Table, { className: "size-4" }),
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-bold uppercase tracking-wider",
									children: "Dashboard Totals"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-xs bg-slate-100 px-3 py-1.5 rounded font-bold text-slate-700",
							children: ["TOTAL WATTS: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-mono text-sm ml-1",
								children: [(totalR + totalY + totalB).toLocaleString(void 0, { maximumFractionDigits: 0 }), " W"]
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xs bg-red-50 text-red-700 px-3 py-1.5 rounded font-bold border border-red-100 shadow-sm flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-2 h-2 rounded-full bg-red-500" }),
									" ",
									totalR.toLocaleString(void 0, { maximumFractionDigits: 0 }),
									" W"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xs bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded font-bold border border-yellow-100 shadow-sm flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-2 h-2 rounded-full bg-yellow-400" }),
									" ",
									totalY.toLocaleString(void 0, { maximumFractionDigits: 0 }),
									" W"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded font-bold border border-blue-100 shadow-sm flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-2 h-2 rounded-full bg-blue-500" }),
									" ",
									totalB.toLocaleString(void 0, { maximumFractionDigits: 0 }),
									" W"
								]
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center h-12 bg-slate-100 border-t border-slate-300 select-none overflow-hidden text-xs shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex h-full overflow-x-auto custom-scrollbar flex-1 items-end pl-1 pt-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { dangerouslySetInnerHTML: { __html: `
                .custom-scrollbar::-webkit-scrollbar { height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
              ` } }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setActiveBoardId("SUMMARY"),
								className: `h-[32px] px-4 font-bold border-t border-r border-l rounded-t-md mx-[1px] whitespace-nowrap transition-colors flex items-center shadow-sm relative ${activeBoardId === "SUMMARY" ? "bg-emerald-500 text-white border-emerald-600 z-10 h-[34px] border-b-0 -mb-[1px]" : "bg-emerald-400 text-white border-emerald-500 hover:bg-emerald-500 z-0 opacity-80"}`,
								children: "PLOT LOAD SUMMARY"
							}),
							boards.map((board) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `relative flex group mx-[1px] ${activeBoardId === board.id ? "z-10" : "z-0"}`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setActiveBoardId(board.id),
									className: `h-[32px] pl-4 pr-2 font-bold border-t border-r border-l rounded-t-md whitespace-nowrap transition-colors flex items-center shadow-sm relative ${activeBoardId === board.id ? "bg-white text-slate-800 border-slate-300 h-[34px] border-b-0 -mb-[1px]" : "bg-slate-200 text-slate-600 opacity-80 hover:bg-slate-300 hover:opacity-100"}`,
									children: [board.name, activeBoardId === board.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {
										onClick: async (e) => {
											e.stopPropagation();
											if (await confirm("Delete this board?")) {
												setBoards(boards.filter((b) => b.id !== board.id));
												setActiveBoardId("SUMMARY");
											}
										},
										className: "size-3.5 ml-2 text-slate-400 hover:text-red-500 transition-colors"
									})]
								})
							}, board.id))
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => {
							const newBoard = createDefaultBoard(`board-${Date.now()}`, `New Board ${boards.length + 1}`);
							setBoards([...boards, newBoard]);
							setActiveBoardId(newBoard.id);
						},
						className: "h-full px-4 border-l border-slate-300 hover:bg-slate-200 flex items-center justify-center text-slate-600 shrink-0 font-bold gap-1 bg-white",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " New"]
					})]
				})
			]
		})]
	}) });
}
//#endregion
export { ProjectLoadSchedulePage as component };
