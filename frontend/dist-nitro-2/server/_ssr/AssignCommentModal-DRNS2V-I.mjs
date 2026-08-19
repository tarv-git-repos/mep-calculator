import { o as __toESM } from "../_runtime.mjs";
import { n as api } from "./api-TVzaU98L.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { a as getOccupancyData, d as workspaceStore, t as calculateVentilation, u as useWorkspace } from "./workspace-store-RdZrUbAZ.mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Ct as Clock, Dt as ChevronRight, Et as ChevronUp, Gt as PenLine, N as Plus, Ot as ChevronDown, T as Search, Ut as TriangleAlert, b as ShieldCheck, dt as Fan, in as CircleCheck, n as X, o as User, tn as CircleX, w as Send, z as MessageSquare } from "../_libs/lucide-react.mjs";
import { a as usePrompt } from "./use-confirm-BT3fngjN.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { r as useAuth } from "./AuthContext-X7D8ql8h.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
import { n as getSignatureBlockDetails } from "./pdfHelpers-Cqwarpxq.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AssignCommentModal-DRNS2V-I.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
var exportVentilationPDF = async (spaces, meta = {}) => {
	if (typeof window !== "undefined") try {
		JSON.parse(localStorage.getItem("mep_user") || "{}").name;
		JSON.parse(localStorage.getItem("workspace-storage") || "{}").state?.activeProjectId;
	} catch (e) {}
	try {
		const activeProj = workspaceStore.getState()?.project || {};
		const doc = new (typeof import_jspdf_node_min.default === "function" ? import_jspdf_node_min.default : import_jspdf_node_min.default.default)("portrait", "mm", "a4");
		const callAutoTable = (pdfDoc, options) => {
			if (typeof autoTable === "function") autoTable(pdfDoc, options);
			else if (typeof autoTable?.default === "function") autoTable.default(pdfDoc, options);
			else if (typeof pdfDoc.autoTable === "function") pdfDoc.autoTable(options);
			else console.error("autoTable function not available");
		};
		const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-101-R01";
		const today = meta.date || (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB");
		const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
		const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "";
		const clientName = meta.client || activeProj?.client || "";
		const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "";
		doc.setFontSize(14);
		doc.setFont("helvetica", "bold");
		doc.text("Ventilation Calculation Report", 14, 14);
		doc.setFontSize(9);
		doc.setLineWidth(.3);
		doc.rect(14, 18, 182, 18);
		doc.line(105, 18, 105, 36);
		doc.line(14, 24, 196, 24);
		doc.line(14, 30, 196, 30);
		doc.setFont("helvetica", "bold");
		doc.text(`Calculation No.:`, 16, 22);
		doc.setFont("helvetica", "normal");
		doc.text(calcNo, 45, 22);
		doc.setFont("helvetica", "bold");
		doc.text(`Date:`, 107, 22);
		doc.setFont("helvetica", "normal");
		doc.text(today, 120, 22);
		doc.setFont("helvetica", "bold");
		doc.text(`Project No.:`, 16, 28);
		doc.setFont("helvetica", "normal");
		doc.text(projectNo, 40, 28);
		doc.setFont("helvetica", "bold");
		doc.text(`Client:`, 107, 28);
		doc.setFont("helvetica", "normal");
		doc.text(clientName, 120, 28);
		doc.setFont("helvetica", "bold");
		doc.text(`Project Name:`, 16, 34);
		doc.setFont("helvetica", "normal");
		doc.text(projectName, 42, 34);
		doc.setFont("helvetica", "bold");
		doc.text(`End User:`, 107, 34);
		doc.setFont("helvetica", "normal");
		doc.text(endUser, 125, 34);
		const sortedSpaces = [...spaces].sort((a, b) => {
			const floorA = (a.floor || "GF").toLowerCase();
			const floorB = (b.floor || "GF").toLowerCase();
			if (floorA !== floorB) return floorA.localeCompare(floorB);
			const zoneA = a.zone || "Default";
			const zoneB = b.zone || "Default";
			if (zoneA === "Default" && zoneB !== "Default") return 1;
			if (zoneA !== "Default" && zoneB === "Default") return -1;
			if (zoneA.toLowerCase() !== zoneB.toLowerCase()) return zoneA.localeCompare(zoneB);
			const nameA = (a.name || "").toLowerCase();
			const nameB = (b.name || "").toLowerCase();
			return nameA.localeCompare(nameB);
		});
		const spacesByFloor = {};
		const floorOrder = [];
		sortedSpaces.forEach((s) => {
			const fl = s.floor || "GF";
			if (!spacesByFloor[fl]) {
				spacesByFloor[fl] = [];
				floorOrder.push(fl);
			}
			spacesByFloor[fl].push(s);
		});
		const body = [];
		let globalSrNo = 1;
		let grandArea = 0;
		let grandOcc = 0;
		let grandMinOA = 0;
		let grandMinExt = 0;
		let grandFreshGiven = 0;
		let grandExtractTaken = 0;
		floorOrder.forEach((floorName) => {
			const floorSpaces = spacesByFloor[floorName];
			let floorArea = 0;
			let floorOcc = 0;
			let floorMinOA = 0;
			let floorMinExt = 0;
			let floorFreshGiven = 0;
			let floorExtractTaken = 0;
			floorSpaces.forEach((s) => {
				const data = getOccupancyData(s.category);
				const effectiveArea = parseFloat(String(s.area || 0)) * (s.multiplier || 1);
				const occCount = typeof s.occupancy === "number" ? s.occupancy : typeof s.fixtures === "number" ? s.fixtures : parseInt(String(s.fixtures || 0)) || 0;
				const oaAreaRate = data ? data.areaOA : .3;
				const oaPeopleRate = data ? data.peopleOA : 2.5;
				const totalFreshCalculated = Math.round(s.minOA ?? effectiveArea * oaAreaRate + occCount * oaPeopleRate);
				const totalExtractCalculated = Math.round(s.minExt ?? 0);
				const freshAirGiven = Math.round(s.freshAir ?? totalFreshCalculated);
				const extractAirTaken = Math.round(s.extractAir ?? totalExtractCalculated);
				let extNo = s.extractAirNumber ?? (data && data.exhaustPerUnit > 0 ? occCount : "-");
				let extStrat = s.extractAirStrategy ?? (data && data.exhaustPerUnit > 0 ? "L/s/unit" : "L/s/m²");
				const catLower = (s.category || "").toLowerCase();
				if (catLower === "rest room / changing room") {
					const sub = s.restroomSubCategories || {};
					const sumSub = (sub.toiletPrivateContinuous || 0) + (sub.toiletPublicContinuous || 0) + (sub.toiletPrivateDiscontinuous || 0) + (sub.toiletPublicDiscontinuous || 0) + (sub.showerContinuous || 0) + (sub.showerDiscontinuous || 0) + (sub.janitorCloset || 0) + (sub.lockerRoom || 0);
					if (sumSub > 0) {
						const val = totalExtractCalculated / sumSub;
						extNo = val % 1 === 0 ? val.toString() : val.toFixed(1);
						extStrat = "L/s/unit";
					}
				} else if (catLower === "kitchen - commercial" || catLower === "kitchen - residential") {
					extNo = parseFloat(String(s.customAch || (data ? data.ach : 0)));
					extStrat = "ACH";
				} else if (catLower === "ex. parking garages") {
					extNo = data ? parseFloat(String(data.exhaustPerArea)) : 3.7;
					extStrat = "L/s/m²";
				}
				floorArea += effectiveArea;
				floorOcc += occCount;
				floorMinOA += totalFreshCalculated;
				floorMinExt += totalExtractCalculated;
				floorFreshGiven += freshAirGiven;
				floorExtractTaken += extractAirTaken;
				body.push([
					globalSrNo++,
					s.floor || "GF",
					s.name || `Space ${globalSrNo}`,
					s.zone || "Default",
					s.category || "-",
					effectiveArea.toFixed(1),
					occCount,
					oaAreaRate.toFixed(1),
					oaPeopleRate.toFixed(1),
					totalFreshCalculated,
					extNo,
					extStrat,
					totalExtractCalculated,
					freshAirGiven,
					extractAirTaken
				]);
			});
			const floorTotalRow = [
				"",
				floorName,
				`TOTAL (${floorName})`,
				"",
				"",
				floorArea.toFixed(1),
				floorOcc > 0 ? floorOcc : "",
				"",
				"",
				floorMinOA,
				"",
				"",
				floorMinExt,
				floorFreshGiven,
				floorExtractTaken
			];
			floorTotalRow._isFloorTotal = true;
			body.push(floorTotalRow);
			grandArea += floorArea;
			grandOcc += floorOcc;
			grandMinOA += floorMinOA;
			grandMinExt += floorMinExt;
			grandFreshGiven += floorFreshGiven;
			grandExtractTaken += floorExtractTaken;
		});
		if (floorOrder.length > 1) {
			const grandTotalRow = [
				"",
				"ALL",
				"GRAND TOTAL",
				"",
				"",
				grandArea.toFixed(1),
				grandOcc > 0 ? grandOcc : "",
				"",
				"",
				grandMinOA,
				"",
				"",
				grandMinExt,
				grandFreshGiven,
				grandExtractTaken
			];
			grandTotalRow._isGrandTotal = true;
			body.push(grandTotalRow);
		}
		const primaryFill = [
			217,
			217,
			217
		];
		const blueFill = [
			218,
			233,
			248
		];
		callAutoTable(doc, {
			startY: 42,
			margin: {
				left: 14,
				right: 14
			},
			theme: "grid",
			styles: {
				fontSize: 6.5,
				halign: "center",
				valign: "middle",
				lineColor: [
					100,
					100,
					100
				],
				lineWidth: .1,
				cellPadding: {
					top: 2.2,
					bottom: 2.2,
					left: .8,
					right: .8
				},
				minCellHeight: 6.5
			},
			headStyles: {
				fillColor: primaryFill,
				textColor: 0,
				fontStyle: "bold",
				cellPadding: {
					top: 2,
					bottom: 2,
					left: .5,
					right: .5
				}
			},
			columnStyles: {
				0: { cellWidth: 7 },
				1: { cellWidth: 13 },
				2: {
					halign: "left",
					cellWidth: 22
				},
				3: {
					halign: "left",
					cellWidth: 18
				},
				4: {
					halign: "left",
					cellWidth: 22
				},
				5: { cellWidth: 10 },
				6: { cellWidth: 10 },
				7: { cellWidth: 10 },
				8: { cellWidth: 10 },
				9: { cellWidth: 10 },
				10: { cellWidth: 10 },
				11: { cellWidth: 10 },
				12: { cellWidth: 10 },
				13: {
					cellWidth: 10,
					fillColor: [
						240,
						247,
						252
					]
				},
				14: {
					cellWidth: 10,
					fillColor: [
						240,
						247,
						252
					]
				}
			},
			head: [[
				{
					content: "Sr. No.",
					rowSpan: 2,
					styles: { fillColor: primaryFill }
				},
				{
					content: "Space Parameters",
					colSpan: 6,
					styles: { fillColor: primaryFill }
				},
				{
					content: "Fresh Air",
					colSpan: 3,
					styles: { fillColor: primaryFill }
				},
				{
					content: "Extract",
					colSpan: 3,
					styles: { fillColor: primaryFill }
				},
				{
					content: "Balancing",
					colSpan: 2,
					styles: { fillColor: blueFill }
				}
			], [
				{ content: "Space Floor" },
				{ content: "Space Name" },
				{ content: "Zone Name" },
				{ content: "Occupancy Category" },
				{ content: "Area\n(m²)" },
				{ content: "Fixtures/\nOcc." },
				{ content: "OA Rate\n(L/s/m²)" },
				{ content: "OA Rate\n(L/s/p)" },
				{ content: "Total Fresh\n(L/s)" },
				{ content: "Ext. Air\nNumber" },
				{ content: "Ext. Air\nStrategy" },
				{ content: "Total Ext.\n(L/s)" },
				{
					content: "Fresh Air\nGiven (L/s)",
					styles: { fillColor: blueFill }
				},
				{
					content: "Extract Air\nTaken (L/s)",
					styles: { fillColor: blueFill }
				}
			]],
			body,
			didParseCell: function(data) {
				const rawRow = data.row.raw;
				if (data.section === "body") {
					if (rawRow && (rawRow._isFloorTotal || rawRow._isGrandTotal)) {
						data.cell.styles.fontStyle = "bold";
						if (data.column.index === 13 || data.column.index === 14) data.cell.styles.fillColor = primaryFill;
					} else if (data.column.index === 13 || data.column.index === 14) data.cell.styles.fillColor = [
						242,
						248,
						253
					];
				}
			}
		});
		meta.userName || typeof window !== "undefined" && window.currentMepUserName;
		if (!meta.userName) try {
			const profileStr = localStorage.getItem("mep_calculator_user_data") || localStorage.getItem("mep_profile") || localStorage.getItem("mep_user_data");
			if (profileStr) {
				const profile = JSON.parse(profileStr);
				if (profile.name) profile.name;
				else if (profile.user?.name) profile.user.name;
				else if (profile.userData?.name) profile.userData.name;
			}
		} catch (e) {}
		const finalY = doc.lastAutoTable?.finalY ?? 150;
		const { originatedName, originatedDate, reviewerName, reviewerDate, approverName, approverDate } = getSignatureBlockDetails(activeProj?.id || "default", "/ventilation", meta.userName || "");
		callAutoTable(doc, {
			startY: finalY + 8,
			margin: {
				left: 14,
				right: 14
			},
			theme: "grid",
			styles: {
				fontSize: 8,
				halign: "center",
				valign: "middle",
				lineColor: [
					100,
					100,
					100
				],
				lineWidth: .1,
				cellPadding: {
					top: 2,
					bottom: 2,
					left: 1,
					right: 1
				}
			},
			headStyles: {
				fillColor: [
					255,
					230,
					204
				],
				textColor: 0,
				fontStyle: "bold"
			},
			head: [[
				{ content: "" },
				{ content: "Originated by" },
				{ content: "Reviewed by" },
				{ content: "Approved by" }
			]],
			body: [[
				{
					content: "Name:",
					styles: {
						fontStyle: "bold",
						halign: "right"
					}
				},
				{
					content: originatedName,
					styles: { halign: "center" }
				},
				{
					content: reviewerName,
					styles: { halign: "center" }
				},
				{
					content: approverName,
					styles: { halign: "center" }
				}
			], [
				{
					content: "Date:",
					styles: {
						fontStyle: "bold",
						halign: "right"
					}
				},
				{
					content: originatedDate,
					styles: { halign: "center" }
				},
				{
					content: reviewerDate,
					styles: { halign: "center" }
				},
				{
					content: approverDate,
					styles: { halign: "center" }
				}
			]],
			columnStyles: {
				0: { cellWidth: 32 },
				1: { cellWidth: 50 },
				2: { cellWidth: 50 },
				3: { cellWidth: 50 }
			}
		});
		const pdfBuffer = doc.output("arraybuffer");
		await downloadFile(new Uint8Array(pdfBuffer), `Ventilation_Report_${activeProj?.code || "P000"}.pdf`, "PDF Document", ["pdf"]);
		toast.success("Ventilation PDF exported successfully!");
	} catch (error) {
		console.error("exportVentilationPDF error:", error);
		toast.error(`Export PDF failed: ${error?.message || String(error)}`);
	}
};
function CalculationReviewBar({ projectId, calculatorPath, calculatorTitle, onReviewStateChange }) {
	if (!projectId || projectId === "" || projectId === "none" || projectId === "active_project") return null;
	const { profile, userData } = useAuth();
	const currentUserName = userData?.name || profile?.name || "Engineering User";
	userData?.email || profile?.email;
	const userRole = (0, import_react.useMemo)(() => {
		const activeProfile = profile || userData || {};
		const roleVal = String(activeProfile.role || userData?.user_metadata?.role || userData?.role || "").trim();
		const des = String(activeProfile.designation || "").toLowerCase().trim();
		const rawRole = roleVal.toLowerCase();
		if (roleVal === "Jr. Design Engineer" || roleVal === "Junior Design Engineer" || roleVal === "Design Engineer" || roleVal === "jr. Design Engineer" || rawRole.includes("junior") || rawRole.includes("jr.") || des.includes("junior") || des.includes("jr.")) return "Jr. / Design Engineer";
		if (roleVal === "Discipline Coordinator" || rawRole === "discipline coordinator" || rawRole.includes("coordinator") || des.includes("coordinator")) return "Discipline Coordinator";
		if (roleVal === "Sr. Design Engineer" || roleVal === "Senior Design Engineer" || rawRole.includes("senior") || rawRole.includes("sr.") || rawRole === "sr" || des.includes("senior") || des.includes("sr.") || des === "sr") return "Sr. Design Engineer";
		return "Jr. / Design Engineer";
	}, [profile, userData]);
	const storageKey = `mep_calc_review_${projectId || "default"}_${calculatorPath || "ventilation"}`;
	const [reviewState, setReviewState] = (0, import_react.useState)(() => {
		const currentProj = workspaceStore.getState().project;
		if (currentProj && currentProj.id === projectId) {
			const reviewStates = currentProj.workspace_data?.review_states || {};
			if (reviewStates[storageKey]) return reviewStates[storageKey];
		}
		if (typeof window !== "undefined") try {
			const saved = localStorage.getItem(storageKey);
			if (saved) return JSON.parse(saved);
		} catch (e) {}
		return { status: "DRAFT" };
	});
	const [showReviewModal, setShowReviewModal] = (0, import_react.useState)(false);
	const [showRejectModal, setShowRejectModal] = (0, import_react.useState)(false);
	const [showCommentsModal, setShowCommentsModal] = (0, import_react.useState)(false);
	const [srComments, setSrComments] = (0, import_react.useState)("");
	const [rejectReason, setRejectReason] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		const currentProj = workspaceStore.getState().project;
		if (currentProj && currentProj.id === projectId) {
			const reviewStates = currentProj.workspace_data?.review_states || {};
			if (reviewStates[storageKey]) {
				setReviewState(reviewStates[storageKey]);
				if (onReviewStateChange) onReviewStateChange(reviewStates[storageKey]);
				return;
			}
		}
		if (typeof window !== "undefined") try {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				const parsed = JSON.parse(saved);
				setReviewState(parsed);
				if (onReviewStateChange) onReviewStateChange(parsed);
				return;
			}
		} catch (e) {}
		const initialState = { status: "DRAFT" };
		setReviewState(initialState);
		if (onReviewStateChange) onReviewStateChange(initialState);
	}, [storageKey, projectId]);
	const updateReviewState = (next, skipSaveBackend = false) => {
		setReviewState(next);
		if (!skipSaveBackend) {
			const currentProj = workspaceStore.getState().project;
			if (currentProj && currentProj.id === projectId) {
				const currentWdata = currentProj.workspace_data || {};
				const reviewStates = currentWdata.review_states || {};
				const updatedWdata = {
					...currentWdata,
					review_states: {
						...reviewStates,
						[storageKey]: next
					}
				};
				api.saveWorkspace(projectId, updatedWdata).catch(console.error);
				workspaceStore.updateProject({
					...currentProj,
					workspace_data: updatedWdata
				});
			}
		}
		if (typeof window !== "undefined") localStorage.setItem(storageKey, JSON.stringify(next));
		if (onReviewStateChange) onReviewStateChange(next);
		if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mep-review-state-updated", { detail: next }));
	};
	const handleSrReviewSubmit = async () => {
		const timestamp = (/* @__PURE__ */ new Date()).toLocaleString();
		const updated = {
			...reviewState,
			status: "REVIEWED",
			reviewedBy: currentUserName,
			reviewedAt: timestamp,
			reviewerComments: srComments.trim() || void 0,
			history: [...reviewState.history || [], {
				action: "REVIEWED",
				user: currentUserName,
				role: "Sr. Design Engineer",
				timestamp,
				comment: srComments.trim() || "Calculation reviewed and submitted to Discipline Coordinator."
			}]
		};
		updateReviewState(updated, true);
		setShowReviewModal(false);
		try {
			if (typeof window !== "undefined") {
				const coordNotifRecord = {
					id: `coord-notif-${Date.now()}`,
					reviewerName: currentUserName,
					comments: srComments.trim() || "Ready for approval.",
					calculatorTitle,
					calculatorPath,
					projectId,
					timestamp: (/* @__PURE__ */ new Date()).toISOString()
				};
				const currentProj = workspaceStore.getState().project;
				if (currentProj && currentProj.id === projectId) {
					const currentWdata = currentProj.workspace_data || {};
					const existingCoord = Array.isArray(currentWdata.coord_notifs) ? currentWdata.coord_notifs : [];
					const reviewStates = currentWdata.review_states || {};
					const updatedWdata = {
						...currentWdata,
						review_states: {
							...reviewStates,
							[storageKey]: updated
						},
						coord_notifs: [coordNotifRecord, ...existingCoord].slice(0, 20)
					};
					api.saveWorkspace(projectId, updatedWdata).catch(console.error);
					workspaceStore.updateProject({
						...currentProj,
						workspace_data: updatedWdata
					});
				}
				try {
					const existingCoordLS = JSON.parse(localStorage.getItem("mep_calc_coord_notifs") || "[]");
					if (!existingCoordLS.some((n) => n.id === coordNotifRecord.id)) {
						existingCoordLS.unshift(coordNotifRecord);
						localStorage.setItem("mep_calc_coord_notifs", JSON.stringify(existingCoordLS.slice(0, 20)));
					}
				} catch (e) {}
				window.dispatchEvent(new CustomEvent("mep-notification-added"));
				window.dispatchEvent(new CustomEvent("mep-review-state-updated", { detail: {
					status: "SR_REVIEW_SUBMITTED",
					reviewedBy: currentUserName,
					reviewerComments: srComments.trim(),
					calculatorTitle,
					projectId
				} }));
			}
		} catch (e) {
			console.error("Failed to save notification:", e);
		}
		setSrComments("");
		try {
			await api.logActivity("CALCULATION_REVIEWED", {
				calculatorTitle,
				reviewedBy: currentUserName,
				comments: srComments
			});
		} catch (e) {}
		toast.success("Review submitted! Revision instructions sent to Design Engineers.");
	};
	const handleCoordinatorApprove = async () => {
		const timestamp = (/* @__PURE__ */ new Date()).toLocaleString();
		updateReviewState({
			...reviewState,
			status: "APPROVED",
			approvedBy: currentUserName,
			approvedAt: timestamp,
			history: [...reviewState.history || [], {
				action: "APPROVED",
				user: currentUserName,
				role: "Discipline Coordinator",
				timestamp,
				comment: "Calculation Approved"
			}]
		});
		try {
			await api.logActivity("CALCULATION_APPROVED", {
				calculatorTitle,
				approvedBy: currentUserName
			});
			const newRevNumber = (workspaceStore.getState().project?.revisions || []).length + 1;
			const dateStr = (/* @__PURE__ */ new Date()).toLocaleDateString();
			workspaceStore.saveAsRevision(`V_${newRevNumber} - Approved on ${dateStr}`);
		} catch (e) {}
		toast.success(`Calculation APPROVED! Status updated for all team members.`);
	};
	const handleCoordinatorRejectSubmit = async () => {
		if (!rejectReason.trim()) {
			toast.error("Please enter a description/reason for rejection.");
			return;
		}
		const timestamp = (/* @__PURE__ */ new Date()).toLocaleString();
		const updated = {
			...reviewState,
			status: "REJECTED",
			rejectedBy: currentUserName,
			rejectedAt: timestamp,
			rejectionDescription: rejectReason.trim(),
			history: [...reviewState.history || [], {
				action: "REJECTED",
				user: currentUserName,
				role: "Discipline Coordinator",
				timestamp,
				comment: rejectReason.trim()
			}]
		};
		updateReviewState(updated, true);
		setShowRejectModal(false);
		try {
			if (typeof window !== "undefined") {
				const notifRecord = {
					id: `rejection-${Date.now()}`,
					rejectedBy: currentUserName,
					reason: rejectReason.trim(),
					calculatorTitle,
					calculatorPath,
					projectId,
					timestamp: (/* @__PURE__ */ new Date()).toISOString()
				};
				const currentProj = workspaceStore.getState().project;
				if (currentProj && currentProj.id === projectId) {
					const currentWdata = currentProj.workspace_data || {};
					const existing = Array.isArray(currentWdata.rejection_notifs) ? currentWdata.rejection_notifs : [];
					const reviewStates = currentWdata.review_states || {};
					const updatedWdata = {
						...currentWdata,
						review_states: {
							...reviewStates,
							[storageKey]: updated
						},
						rejection_notifs: [notifRecord, ...existing].slice(0, 20)
					};
					api.saveWorkspace(projectId, updatedWdata).catch(console.error);
					workspaceStore.updateProject({
						...currentProj,
						workspace_data: updatedWdata
					});
				} else {
					const existing = JSON.parse(localStorage.getItem("mep_calc_rejection_notifs") || "[]");
					existing.unshift(notifRecord);
					localStorage.setItem("mep_calc_rejection_notifs", JSON.stringify(existing.slice(0, 20)));
				}
				window.dispatchEvent(new CustomEvent("mep-notification-added"));
				window.dispatchEvent(new CustomEvent("mep-review-state-updated", { detail: {
					status: "REJECTED",
					rejectedBy: currentUserName,
					rejectionDescription: rejectReason.trim(),
					calculatorTitle,
					projectId
				} }));
			}
		} catch (e) {}
		setRejectReason("");
		try {
			await api.logActivity("CALCULATION_REJECTED", {
				calculatorTitle,
				rejectedBy: currentUserName,
				reason: rejectReason
			});
		} catch (e) {}
		toast.error("Calculation REJECTED and rejection notification sent to Sr. Design Engineer.");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "no-print select-none inline-flex items-center gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "inline-flex items-center gap-2 shrink-0",
				children: [
					userRole === "Sr. Design Engineer" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setShowReviewModal(true),
						className: "px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: reviewState.status === "REVIEWED" || reviewState.status === "APPROVED" ? "Reviewed" : "Review" })]
					}),
					userRole === "Discipline Coordinator" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "inline-flex items-center gap-2 shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: handleCoordinatorApprove,
							disabled: reviewState.status === "APPROVED",
							className: "px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Approve" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setShowRejectModal(true),
							disabled: reviewState.status === "REJECTED",
							className: "px-3.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Reject" })]
						})]
					}),
					userRole === "Jr. / Design Engineer" && reviewState.reviewerComments && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setShowCommentsModal(true),
						className: "px-3 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-semibold rounded-full transition-colors flex items-center gap-1 cursor-pointer shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-3.5" }), " Reviewer Notes"]
					})
				]
			}),
			reviewState.status === "APPROVED" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 dark:bg-emerald-950/40 dark:border-emerald-700/50 rounded-xl flex items-center gap-2.5 shadow-xs shrink-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "size-6 rounded-md bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-3.5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-extrabold text-[11px] text-emerald-700 dark:text-emerald-300 tracking-wide uppercase",
							children: "CALCULATION APPROVED"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[9.5px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30",
							children: "Official Record"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[11px] text-emerald-800/80 dark:text-emerald-300/80 font-medium border-l border-emerald-500/30 pl-2.5",
						children: [
							"Approved by ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold",
								children: reviewState.approvedBy || "Discipline Coordinator"
							}),
							" on ",
							reviewState.approvedAt || "recently"
						]
					})
				]
			}),
			reviewState.status === "REJECTED" && (userRole === "Sr. Design Engineer" || userRole === "Discipline Coordinator") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-3 py-1.5 bg-red-500/10 border border-red-500/30 dark:bg-red-950/40 dark:border-red-700/50 rounded-xl flex items-center gap-2.5 shadow-xs shrink-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "size-6 rounded-md bg-red-500 text-white flex items-center justify-center font-bold shrink-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "size-3.5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center gap-1.5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-extrabold text-[11px] text-red-600 dark:text-red-400 tracking-wide uppercase",
							children: "CALCULATION REJECTED"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[11px] text-red-700/90 dark:text-red-300/90 font-medium border-l border-red-500/30 pl-2.5",
						children: [
							"Reason from ",
							reviewState.rejectedBy,
							": \"",
							reviewState.rejectionDescription,
							"\""
						]
					})
				]
			}),
			reviewState.status === "REVIEWED" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 dark:bg-amber-950/40 dark:border-amber-700/50 rounded-xl flex items-center gap-2.5 shadow-xs shrink-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "size-6 rounded-md bg-amber-500 text-white flex items-center justify-center font-bold shrink-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-3.5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-extrabold text-[11px] text-amber-700 dark:text-amber-300 tracking-wide uppercase",
						children: "REVIEWED BY SR. DESIGN ENGINEER"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[11px] text-amber-800/80 dark:text-amber-300/80 font-medium border-l border-amber-500/30 pl-2.5",
						children: [
							"Reviewed by ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold",
								children: reviewState.reviewedBy
							}),
							" on ",
							reviewState.reviewedAt
						]
					})
				]
			}),
			showReviewModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "text-base font-bold text-foreground flex items-center gap-2 mb-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "size-5 text-indigo-500" }), "Mark Calculation as Reviewed"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground mb-4",
							children: [
								"You are confirming that you have reviewed the calculation for ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-foreground",
									children: calculatorTitle
								}),
								". You can optionally add notes for the Design Engineers or Discipline Coordinator."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							value: srComments,
							onChange: (e) => setSrComments(e.target.value),
							placeholder: "Add optional reviewer comments or guidelines for Jr. / Design Engineers…",
							rows: 4,
							className: "w-full p-3 bg-surface-2 border border-border rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-foreground resize-none"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-end gap-2 mt-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setShowReviewModal(false),
								className: "px-4 py-2 border border-border text-xs font-semibold rounded-xl hover:bg-surface-2 transition cursor-pointer",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: handleSrReviewSubmit,
								className: "px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-3.5" }), "Submit Reviewed Status"]
							})]
						})
					]
				})
			}),
			showRejectModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "text-base font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-5 text-red-500" }), "Reject Calculation"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground mb-4",
							children: "Please enter the exact reason and description for rejecting the calculation. This description will be sent directly to the Sr. Design Engineer to rectify."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							value: rejectReason,
							onChange: (e) => setRejectReason(e.target.value),
							placeholder: "Enter detailed description of why the calculation is rejected…",
							rows: 4,
							className: "w-full p-3 bg-surface-2 border border-red-300 dark:border-red-900/50 rounded-xl text-xs font-medium outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 text-foreground resize-none"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-end gap-2 mt-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setShowRejectModal(false),
								className: "px-4 py-2 border border-border text-xs font-semibold rounded-xl hover:bg-surface-2 transition cursor-pointer",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: handleCoordinatorRejectSubmit,
								className: "px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "size-3.5" }), "Reject Calculation"]
							})]
						})
					]
				})
			}),
			showCommentsModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "text-base font-bold text-foreground flex items-center gap-2 mb-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-5 text-primary" }), "Reviewer Notes & Feedback"]
						}),
						reviewState.reviewerComments && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[11px] font-bold text-muted-foreground uppercase",
								children: "Sr. Design Engineer Notes:"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-foreground bg-surface-2 p-3 rounded-xl border border-border mt-1",
								children: reviewState.reviewerComments
							})]
						}),
						reviewState.rejectionDescription && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[11px] font-bold text-red-500 uppercase",
								children: "Discipline Coordinator Rejection Description:"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-900/50 mt-1",
								children: reviewState.rejectionDescription
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center justify-end mt-5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setShowCommentsModal(false),
								className: "px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-sm transition cursor-pointer",
								children: "Close"
							})
						})
					]
				})
			})
		]
	});
}
function getEquipVentMode(e) {
	const t = e.mode;
	const n = e.type;
	if (t === "Extract Air Only" || t === "Exhaust Air Only" || n === "Ecology" || n === "EAHU") return "Exhaust Air Only";
	if (t === "Fresh Air + Extract Air" || t === "Fresh + Exhaust" || n === "Air Handling Unit" || n === "MAHU" && t === "Fresh + Exhaust") return "Fresh + Exhaust";
	return "Fresh Air Only";
}
function SharedAssignmentModal({ isOpen, initialEquipmentId, initialZoneId, initialZoneIds, initialShowAddEquip, onClose }) {
	const { spaces, zones, equipment, setWorkspaceState } = useWorkspace();
	const prompt = usePrompt();
	const [selectedEquipId, setSelectedEquipId] = (0, import_react.useState)(null);
	const [selectedInstances, setSelectedInstances] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [searchEquip, setSearchEquip] = (0, import_react.useState)("");
	const [searchZone, setSearchZone] = (0, import_react.useState)("");
	const [expandedZones, setExpandedZones] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [showAddEquip, setShowAddEquip] = (0, import_react.useState)(false);
	const [newTag, setNewTag] = (0, import_react.useState)("");
	const [newType, setNewType] = (0, import_react.useState)("FAHU");
	const [newMode, setNewMode] = (0, import_react.useState)("Fresh Air Only");
	const [newCapacity, setNewCapacity] = (0, import_react.useState)(2500);
	(0, import_react.useEffect)(() => {
		if (isOpen) {
			console.log("SharedAssignmentModal: isOpen=true, initialZoneId=", initialZoneId, "initialZoneIds=", initialZoneIds);
			setShowAddEquip(false);
			if (initialEquipmentId) {
				setSelectedEquipId(initialEquipmentId);
				const eq = equipment.find((e) => e.id === initialEquipmentId);
				if (eq) {
					const mode = getEquipVentMode(eq);
					const instances = /* @__PURE__ */ new Set();
					zones.forEach((z) => {
						const mult = z.multiplier || 1;
						for (let idx = 1; idx <= mult; idx++) {
							const inst = z.instances?.find((i) => i.instanceIndex === idx);
							const faId = inst?.faEquipId ?? (idx === 1 ? z.faAssignment : null);
							const eaId = inst?.eaEquipId ?? (idx === 1 ? z.eaAssignment : null);
							let assigned = false;
							if (mode === "Fresh Air Only" && faId === eq.id) assigned = true;
							if (mode === "Exhaust Air Only" && eaId === eq.id) assigned = true;
							if (mode === "Fresh + Exhaust" && (faId === eq.id || eaId === eq.id)) assigned = true;
							if (assigned) instances.add(`${z.id}_${idx}`);
						}
					});
					setSelectedInstances(instances);
				}
			} else if (initialZoneId || initialZoneIds) {
				setSelectedEquipId(null);
				const targetIds = initialZoneIds && initialZoneIds.length > 0 ? Array.from(initialZoneIds) : initialZoneId ? [initialZoneId] : [];
				console.log("SharedAssignmentModal: targetIds=", targetIds);
				const instances = /* @__PURE__ */ new Set();
				const expanded = /* @__PURE__ */ new Set();
				targetIds.forEach((id) => {
					const z = zones.find((zone) => zone.id === id);
					if (z) {
						const mult = z.multiplier || 1;
						for (let idx = 1; idx <= mult; idx++) instances.add(`${z.id}_${idx}`);
						expanded.add(z.id);
					}
				});
				setSelectedInstances(instances);
				setExpandedZones(expanded);
			} else {
				setSelectedEquipId(null);
				setSelectedInstances(/* @__PURE__ */ new Set());
			}
		}
	}, [
		isOpen,
		initialEquipmentId,
		initialZoneId,
		initialZoneIds,
		initialShowAddEquip,
		zones,
		equipment
	]);
	const handleEquipSelect = (eqId) => {
		setSelectedEquipId(eqId);
		const eq = equipment.find((e) => e.id === eqId);
		if (!eq) return;
		const mode = getEquipVentMode(eq);
		const instances = /* @__PURE__ */ new Set();
		if (!!initialZoneId || !!initialZoneIds && initialZoneIds.length > 0) (initialZoneIds && initialZoneIds.length > 0 ? Array.from(initialZoneIds) : initialZoneId ? [initialZoneId] : []).forEach((id) => {
			const z = zones.find((zone) => zone.id === id);
			if (z) {
				const mult = z.multiplier || 1;
				for (let idx = 1; idx <= mult; idx++) instances.add(`${z.id}_${idx}`);
			}
		});
		else zones.forEach((z) => {
			const mult = z.multiplier || 1;
			for (let idx = 1; idx <= mult; idx++) {
				const inst = z.instances?.find((i) => i.instanceIndex === idx);
				const faId = inst?.faEquipId ?? (idx === 1 ? z.faAssignment : null);
				const eaId = inst?.eaEquipId ?? (idx === 1 ? z.eaAssignment : null);
				let assigned = false;
				if (mode === "Fresh Air Only" && faId === eq.id) assigned = true;
				if (mode === "Exhaust Air Only" && eaId === eq.id) assigned = true;
				if (mode === "Fresh + Exhaust" && (faId === eq.id || eaId === eq.id)) assigned = true;
				if (assigned) instances.add(`${z.id}_${idx}`);
			}
		});
		setSelectedInstances(instances);
	};
	const selectedEquipment = (0, import_react.useMemo)(() => equipment.find((eq) => eq.id === selectedEquipId) || null, [equipment, selectedEquipId]);
	const filteredEquipment = (0, import_react.useMemo)(() => {
		const q = searchEquip.toLowerCase().trim();
		return equipment.filter((eq) => {
			const mode = getEquipVentMode(eq);
			return !q || `${eq.tag} ${eq.type} ${mode}`.toLowerCase().includes(q);
		});
	}, [equipment, searchEquip]);
	const filteredZonesList = (0, import_react.useMemo)(() => {
		const q = searchZone.toLowerCase().trim();
		return zones.filter((z) => !q || `${z.name} ${z.floor || ""}`.toLowerCase().includes(q));
	}, [zones, searchZone]);
	const expandAll = () => {
		setExpandedZones(new Set(zones.map((z) => z.id)));
	};
	const collapseAll = () => {
		setExpandedZones(/* @__PURE__ */ new Set());
	};
	const toggleExpand = (zoneId) => {
		setExpandedZones((prev) => {
			const next = new Set(prev);
			if (next.has(zoneId)) next.delete(zoneId);
			else next.add(zoneId);
			return next;
		});
	};
	const toggleInstance = (zoneId, instanceIndex, checked) => {
		setSelectedInstances((prev) => {
			const next = new Set(prev);
			const key = `${zoneId}_${instanceIndex}`;
			if (checked) next.add(key);
			else next.delete(key);
			return next;
		});
	};
	const toggleZoneAll = (zone, checked) => {
		const mult = zone.multiplier || 1;
		setSelectedInstances((prev) => {
			const next = new Set(prev);
			for (let idx = 1; idx <= mult; idx++) {
				const key = `${zone.id}_${idx}`;
				if (checked) next.add(key);
				else next.delete(key);
			}
			return next;
		});
	};
	const getZoneSelectionState = (zone) => {
		const mult = zone.multiplier || 1;
		let count = 0;
		for (let idx = 1; idx <= mult; idx++) if (selectedInstances.has(`${zone.id}_${idx}`)) count++;
		return {
			allSelected: count === mult,
			noneSelected: count === 0,
			isIndeterminate: count > 0 && count < mult,
			selectedCount: count
		};
	};
	const zonesAffectedCount = (0, import_react.useMemo)(() => {
		const affected = /* @__PURE__ */ new Set();
		selectedInstances.forEach((key) => {
			const [zoneId] = key.split("_");
			affected.add(zoneId);
		});
		return affected.size;
	}, [selectedInstances]);
	const instancesSelectedCount = selectedInstances.size;
	const isDoneDisabled = !selectedEquipId || instancesSelectedCount === 0;
	const handleAddEquipment = () => {
		if (!newTag.trim()) {
			alert("Please enter an equipment tag!");
			return;
		}
		if (equipment.some((e) => e.tag.toLowerCase() === newTag.trim().toLowerCase())) {
			alert("An equipment with this tag already exists!");
			return;
		}
		const newEquip = {
			id: `equip-${Date.now()}`,
			tag: newTag.trim(),
			type: newType === "EAHU" ? "Ecology" : newType,
			zones: 0,
			spaces: 0,
			totalAirflow: 0,
			capacity: newCapacity || 2500,
			utilization: 0,
			status: "design",
			mode: newMode,
			zoneIds: [],
			totalFA: 0,
			totalEA: 0
		};
		const balanced = calculateVentilation(spaces, zones, [...equipment, newEquip]);
		setWorkspaceState({
			spaces: balanced.spaces,
			zones: balanced.zones,
			equipment: balanced.equipment
		});
		setSelectedEquipId(newEquip.id);
		setShowAddEquip(false);
		setNewTag("");
		setNewCapacity(2500);
	};
	const handleSave = () => {
		if (!selectedEquipment) return;
		const mode = getEquipVentMode(selectedEquipment);
		const hasTargetZone = !!initialZoneId || !!initialZoneIds && initialZoneIds.length > 0;
		const targetIds = initialZoneIds && initialZoneIds.length > 0 ? Array.from(initialZoneIds) : initialZoneId ? [initialZoneId] : [];
		const balanced = calculateVentilation(spaces, zones.map((zone) => {
			if (hasTargetZone && !targetIds.includes(zone.id)) return zone;
			const mult = zone.multiplier || 1;
			const instances = [...zone.instances || []];
			let changed = false;
			const nextInstances = [];
			for (let o = 0; o < mult; o++) {
				const instIdx = o + 1;
				const key = `${zone.id}_${instIdx}`;
				let inst = instances.find((e) => e.instanceIndex === instIdx);
				if (!inst) inst = {
					instanceIndex: instIdx,
					faEquipId: instIdx === 1 ? zone.faAssignment ?? null : null,
					eaEquipId: instIdx === 1 ? zone.eaAssignment ?? null : null
				};
				else inst = { ...inst };
				const isSelected = selectedInstances.has(key);
				let faId = inst.faEquipId;
				let eaId = inst.eaEquipId;
				if (isSelected) {
					if (mode === "Fresh Air Only") faId = selectedEquipment.id;
					else if (mode === "Exhaust Air Only") eaId = selectedEquipment.id;
					else if (mode === "Fresh + Exhaust") {
						faId = selectedEquipment.id;
						eaId = selectedEquipment.id;
					}
				} else if (mode === "Fresh Air Only" && inst.faEquipId === selectedEquipment.id) faId = null;
				else if (mode === "Exhaust Air Only" && inst.eaEquipId === selectedEquipment.id) eaId = null;
				else if (mode === "Fresh + Exhaust") {
					if (inst.faEquipId === selectedEquipment.id) faId = null;
					if (inst.eaEquipId === selectedEquipment.id) eaId = null;
				}
				if (faId !== inst.faEquipId || eaId !== inst.eaEquipId) changed = true;
				nextInstances.push({
					instanceIndex: instIdx,
					faEquipId: faId,
					eaEquipId: eaId
				});
			}
			if (!changed && zone.instances) return zone;
			const faAssignments = {};
			const eaAssignments = {};
			nextInstances.forEach((inst) => {
				if (inst.faEquipId) faAssignments[inst.faEquipId] = (faAssignments[inst.faEquipId] || 0) + 1;
				if (inst.eaEquipId) eaAssignments[inst.eaEquipId] = (eaAssignments[inst.eaEquipId] || 0) + 1;
			});
			const firstFa = Object.keys(faAssignments)[0] || null;
			const firstEa = Object.keys(eaAssignments)[0] || null;
			return {
				...zone,
				instances: nextInstances,
				faAssignments,
				eaAssignments,
				faAssignment: firstFa,
				eaAssignment: firstEa,
				faAssignedQty: firstFa ? faAssignments[firstFa] : 1,
				eaAssignedQty: firstEa ? eaAssignments[firstEa] : 1
			};
		}), equipment);
		setWorkspaceState({
			spaces: balanced.spaces,
			zones: balanced.zones,
			equipment: balanced.equipment
		});
		onClose();
	};
	if (!isOpen) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "bg-background border border-border/80 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] max-h-[830px] flex flex-col overflow-hidden animate-scale-in text-xs",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "px-5 py-4 border-b border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-bold text-[16.5px] text-foreground tracking-tight",
							children: "Equipment Assignment Sizer"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11.5px] text-muted-foreground font-medium",
							children: "Select an equipment unit on the left and assign it to zone instances on the right."
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "size-8.5 rounded-full hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4.5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 min-h-0 flex divide-x divide-border/50",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "w-[32%] flex flex-col bg-slate-50/50 dark:bg-zinc-950/20 min-h-0 p-4 gap-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-2.5 flex-1 min-h-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[9.5px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-widest block",
									children: [
										"Equipment (",
										filteredEquipment.length,
										")"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative shrink-0 select-none",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-3.5 top-3 size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										placeholder: "Search Equipment...",
										value: searchEquip,
										onChange: (e) => setSearchEquip(e.target.value),
										className: "w-full bg-background border border-border/70 rounded-xl pl-9 pr-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground transition-all font-sans"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex-1 overflow-y-auto pr-1.5 custom-scrollbar bg-card border border-border/60 rounded-xl divide-y divide-border/50 shadow-xs",
									children: [filteredEquipment.map((eq) => {
										const mode = getEquipVentMode(eq);
										const isSelected = selectedEquipId === eq.id;
										let iconColor = "text-primary";
										if (mode === "Exhaust Air Only") iconColor = "text-pink-600 dark:text-pink-400";
										else if (mode === "Fresh + Exhaust") iconColor = "text-purple-600 dark:text-purple-400";
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											onClick: () => handleEquipSelect(eq.id),
											className: `flex items-center gap-3 px-3 py-2.5 transition-all cursor-pointer select-none ${isSelected ? "bg-primary/5 shadow-inner border-l-2 border-l-primary" : "hover:bg-surface-2/60 border-l-2 border-l-transparent"}`,
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: `size-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${isSelected ? "border-primary bg-primary/10" : "border-muted-foreground/30"}`,
													children: isSelected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-2 rounded-full bg-primary" })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: `p-1.5 rounded-lg bg-surface-2 dark:bg-zinc-800/40 shrink-0 ${iconColor}`,
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fan, { className: "size-4 animate-spin-slow" })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex-1 min-w-0",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-bold font-mono text-[13.5px] text-foreground truncate",
														children: eq.tag
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[10.5px] text-muted-foreground font-medium mt-0.5",
														children: mode
													})]
												})
											]
										}, eq.id);
									}), filteredEquipment.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-center text-muted-foreground italic py-10 text-[12px] font-medium",
										children: "No equipment matched search."
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "pt-3 border-t border-border/50 mt-1 shrink-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										onClick: () => setShowAddEquip(!showAddEquip),
										className: "flex items-center justify-between py-1.5 px-1 select-none font-extrabold text-[9.5px] uppercase tracking-widest text-slate-500 dark:text-zinc-400 cursor-pointer hover:text-slate-700 dark:hover:text-zinc-200 transition-colors",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "flex items-center gap-1.5 text-primary",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add New Equipment"]
										}), showAddEquip ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3.5" })]
									}), showAddEquip && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "border border-border/80 bg-card p-3.5 rounded-xl space-y-3 shrink-0 select-none shadow-[0_1px_3px_rgba(0,0,0,0.02)] mt-1 animate-scale-in",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "space-y-2.5 text-[11px]",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none",
													children: "Equipment Tag"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "text",
													placeholder: "e.g. AHU-02",
													value: newTag,
													onChange: (e) => {
														const val = e.target.value;
														setNewTag(val);
														const upper = val.toUpperCase();
														if (upper.includes("MAHU")) {
															setNewType("MAHU");
															setNewMode("Fresh Air Only");
														} else if (upper.includes("EAHU")) {
															setNewType("EAHU");
															setNewMode("Extract Air Only");
														} else if (upper.includes("FAHU")) setNewType("FAHU");
													},
													className: "w-full bg-background border border-border/70 rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-sans transition-all duration-150"
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none",
													children: "Equipment Type"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
													value: newType,
													onChange: (e) => {
														const val = e.target.value;
														setNewType(val);
														if (val === "MAHU") setNewMode("Fresh Air Only");
														else if (val === "EAHU") setNewMode("Extract Air Only");
													},
													className: "w-full bg-background border border-border/70 rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-semibold transition-all duration-150 cursor-pointer",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "FAHU",
															children: "FAHU (Fresh / Extract)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "MAHU",
															children: "MAHU (Fresh Air Only)"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
															value: "EAHU",
															children: "EAHU (Extract Air Only)"
														})
													]
												})] }),
												newType === "FAHU" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none",
													children: "Ventilation Mode"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
													value: newMode,
													onChange: (e) => setNewMode(e.target.value),
													className: "w-full bg-background border border-border/70 rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-semibold transition-all duration-150 cursor-pointer",
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
												})] })
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-end gap-2 text-[11px] pt-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => {
													setNewTag("");
													setShowAddEquip(false);
												},
												className: "px-4 py-1.5 border border-border/80 hover:bg-surface-2 rounded-lg text-muted-foreground hover:text-foreground text-[11.5px] font-semibold transition-all duration-150 cursor-pointer",
												children: "Cancel"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: handleAddEquipment,
												className: "px-5 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/95 text-[11.5px] transition-all duration-150 cursor-pointer shadow-md shadow-primary/10",
												children: "Add"
											})]
										})]
									})]
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "w-[68%] flex flex-col min-h-0 p-4 bg-background gap-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-2.5 flex-1 min-h-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[9.5px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-widest",
										children: [
											"Zone / Instances (",
											filteredZonesList.length,
											")"
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 select-none",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: expandAll,
												className: "text-[10.5px] font-bold text-primary hover:text-primary/80 transition-colors bg-transparent border-0 cursor-pointer",
												children: "Expand All"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-muted-foreground/30 text-[10px]",
												children: "|"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: collapseAll,
												className: "text-[10.5px] font-bold text-primary hover:text-primary/80 transition-colors bg-transparent border-0 cursor-pointer",
												children: "Collapse All"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative shrink-0 select-none",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-3.5 top-3 size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										placeholder: "Search Zone by name or floor...",
										value: searchZone,
										onChange: (e) => setSearchZone(e.target.value),
										className: "w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl pl-9 pr-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground transition-all font-sans"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex-1 overflow-y-auto pr-1.5 select-none custom-scrollbar bg-card border border-border/60 rounded-xl divide-y divide-border/50 shadow-xs",
									children: [filteredZonesList.map((zone) => {
										const mult = zone.multiplier || 1;
										const isMulti = mult > 1;
										const isExpanded = expandedZones.has(zone.id);
										const { allSelected, noneSelected, isIndeterminate } = getZoneSelectionState(zone);
										const assignedTags = [];
										const instances = zone.instances || [];
										for (let idx = 1; idx <= mult; idx++) {
											const inst = instances.find((i) => i.instanceIndex === idx);
											const faId = inst?.faEquipId ?? (idx === 1 ? zone.faAssignment : null);
											const eaId = inst?.eaEquipId ?? (idx === 1 ? zone.eaAssignment : null);
											if (faId) {
												const eq = equipment.find((e) => e.id === faId);
												if (eq && !assignedTags.includes(eq.tag)) assignedTags.push(eq.tag);
											}
											if (eaId) {
												const eq = equipment.find((e) => e.id === eaId);
												if (eq && !assignedTags.includes(eq.tag)) assignedTags.push(eq.tag);
											}
										}
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "overflow-hidden transition-all hover:bg-surface-2/10",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												onClick: () => toggleZoneAll(zone, !allSelected),
												className: "flex items-center justify-between px-3 py-2.5 hover:bg-surface-2/40 transition-colors cursor-pointer",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-3 flex-1 min-w-0",
													children: [
														isMulti ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: (e) => {
																e.stopPropagation();
																toggleExpand(zone.id);
															},
															className: "p-1 rounded-lg hover:bg-surface-3 text-muted-foreground cursor-pointer shrink-0 transition-colors",
															children: isExpanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-slate-500" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 text-slate-500" })
														}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-6 shrink-0" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "checkbox",
															checked: allSelected,
															ref: (el) => {
																if (el) el.indeterminate = isIndeterminate;
															},
															onChange: (e) => toggleZoneAll(zone, e.target.checked),
															onClick: (e) => e.stopPropagation(),
															className: "size-4 rounded-md border-border/80 text-primary cursor-pointer transition-all"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col min-w-0",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "font-bold text-[13.5px] text-foreground flex items-center gap-2",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: zone.name }),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																		type: "button",
																		onClick: async (e) => {
																			e.stopPropagation();
																			const newName = await prompt(`Rename zone "${zone.name}":`, zone.name, { title: "Rename Zone" });
																			if (newName && newName.trim() !== "" && newName.trim() !== zone.name) {
																				const nextZones = zones.map((z) => z.id === zone.id ? {
																					...z,
																					name: newName.trim()
																				} : z);
																				const balanced = calculateVentilation(spaces.map((s) => s.zone === zone.name ? {
																					...s,
																					zone: newName.trim()
																				} : s), nextZones, equipment);
																				setWorkspaceState({
																					spaces: balanced.spaces,
																					zones: balanced.zones,
																					equipment: balanced.equipment
																				});
																			}
																		},
																		className: "inline-flex p-0.5 rounded hover:bg-surface-3 text-muted-foreground hover:text-foreground cursor-pointer transition-colors",
																		title: "Rename Zone",
																		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3 text-primary" })
																	}),
																	isMulti && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																		className: "text-[9.5px] bg-surface-3 text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
																		children: [mult, " instances"]
																	})
																]
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "text-[10.5px] font-semibold text-muted-foreground mt-0.5",
																children: ["Floor: ", zone.floor || "L01"]
															})]
														})
													]
												}), (!isExpanded || !isMulti) && assignedTags.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2 shrink-0",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10.5px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider",
														children: "Assigned:"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] font-bold font-mono bg-surface-3 px-2 py-0.5 rounded text-foreground",
														children: assignedTags.join(", ")
													})]
												})]
											}), isMulti && isExpanded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border-t border-border/50 bg-slate-50/50 dark:bg-zinc-950/30 divide-y divide-border/40 relative shadow-inner",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute left-6 top-0 bottom-0 w-px bg-border/80" }), Array.from({ length: mult }).map((_, o) => {
													const instIdx = o + 1;
													const instKey = `${zone.id}_${instIdx}`;
													const isInstSelected = selectedInstances.has(instKey);
													const inst = zone.instances?.find((i) => i.instanceIndex === instIdx);
													const faId = inst?.faEquipId ?? (instIdx === 1 ? zone.faAssignment : null);
													const eaId = inst?.eaEquipId ?? (instIdx === 1 ? zone.eaAssignment : null);
													const faEq = equipment.find((e) => e.id === faId);
													const eaEq = equipment.find((e) => e.id === eaId);
													let currentAssignText = "";
													if (selectedEquipment) {
														const mode = getEquipVentMode(selectedEquipment);
														if (mode === "Fresh Air Only" && faEq && faEq.id !== selectedEquipment.id) currentAssignText = `Currently Assigned: ${faEq.tag}`;
														else if (mode === "Exhaust Air Only" && eaEq && eaEq.id !== selectedEquipment.id) currentAssignText = `Currently Assigned: ${eaEq.tag}`;
														else if (mode === "Fresh + Exhaust") {
															const faText = faEq && faEq.id !== selectedEquipment.id ? `FA: ${faEq.tag}` : "";
															const eaText = eaEq && eaEq.id !== selectedEquipment.id ? `EA: ${eaEq.tag}` : "";
															if (faText && eaText) currentAssignText = `Currently Assigned: ${faText} + ${eaText}`;
															else if (faText || eaText) currentAssignText = `Currently Assigned: ${faText || eaText}`;
														}
													}
													return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														onClick: () => toggleInstance(zone.id, instIdx, !isInstSelected),
														className: "relative flex items-center justify-between pl-11 pr-3 py-1.5 hover:bg-surface-2/80 transition-colors cursor-pointer text-[12px]",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute left-6 top-1/2 w-3.5 h-px bg-border/80 -translate-y-1/2" }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex items-center gap-3.5 select-none z-10",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																	type: "checkbox",
																	checked: isInstSelected,
																	onChange: (e) => toggleInstance(zone.id, instIdx, e.target.checked),
																	onClick: (e) => e.stopPropagation(),
																	className: "size-4 rounded border-border/80 text-primary cursor-pointer transition-all"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																	className: "font-semibold text-[12.5px] text-muted-foreground",
																	children: [zone.name, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																		className: "text-foreground",
																		children: ["-", instIdx]
																	})]
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex items-center gap-2",
																children: [
																	currentAssignText && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																		className: "text-[10px] text-muted-foreground mr-2 select-none italic font-medium",
																		children: currentAssignText
																	}),
																	faEq && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																		className: "flex items-center gap-1 text-[9.5px] px-2.5 py-0.5 bg-primary/5 border border-primary/20 text-primary rounded-full font-bold shadow-xs",
																		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fan, { className: "size-2.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["FA: ", faEq.tag] })]
																	}),
																	eaEq && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																		className: "flex items-center gap-1 text-[9.5px] px-2.5 py-0.5 bg-pink-500/5 border border-pink-500/20 text-pink-600 dark:text-pink-400 rounded-full font-bold shadow-xs",
																		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fan, { className: "size-2.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["EA: ", eaEq.tag] })]
																	}),
																	!faEq && !eaEq && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																		className: "text-[10px] text-muted-foreground font-semibold italic bg-surface-2 px-2.5 py-0.5 rounded-full select-none",
																		children: "Unassigned"
																	})
																]
															})
														]
													}, instKey);
												})]
											})]
										}, zone.id);
									}), filteredZonesList.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-center text-muted-foreground italic py-10 text-[12px] font-medium",
										children: "No zones matched search."
									})]
								})
							]
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
					className: "px-5 py-4 border-t border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-6 text-[12.5px] text-foreground font-medium",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground font-medium",
								children: "Selected Equipment: "
							}), selectedEquipment ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold font-mono text-primary bg-primary/10 border border-primary/25 px-2.5 py-0.5 rounded-lg text-[11.5px]",
								children: selectedEquipment.tag
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground italic font-medium",
								children: "None"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-4 w-px bg-border/60" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground font-medium",
								children: "Zones Affected: "
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold font-mono text-foreground",
								children: zonesAffectedCount
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-4 w-px bg-border/60" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground font-medium",
								children: "Instances Selected: "
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold font-mono text-primary",
								children: instancesSelectedCount
							})] })
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onClose,
							className: "border border-border/80 text-xs px-4 py-2 rounded-xl hover:bg-surface-2 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all duration-150",
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: handleSave,
							disabled: isDoneDisabled,
							className: `text-xs font-bold px-6 py-2 rounded-xl transition-all cursor-pointer shadow-sm ${isDoneDisabled ? "bg-surface-3 text-muted-foreground border border-border cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/95 shadow-md shadow-primary/10"}`,
							children: "Done"
						})]
					})]
				})
			]
		})
	});
}
function AssignCommentModal({ isOpen, onClose, targetId, targetName, targetType, onSave }) {
	const { userData, profile } = useAuth();
	const { project } = useWorkspace();
	const [commentText, setCommentText] = (0, import_react.useState)("");
	const [selectedUsers, setSelectedUsers] = (0, import_react.useState)([]);
	const [selectedTeams, setSelectedTeams] = (0, import_react.useState)([]);
	const [availableUsers, setAvailableUsers] = (0, import_react.useState)([]);
	const [availableTeams, setAvailableTeams] = (0, import_react.useState)([]);
	const [isLoading, setIsLoading] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!isOpen) {
			setCommentText("");
			setSelectedUsers([]);
			setSelectedTeams([]);
			return;
		}
		const fetchAssignees = async () => {
			if (availableUsers.length === 0) setIsLoading(true);
			try {
				const [allUsers, allTeams] = await Promise.all([api.getUsers(), api.getTeams()]);
				const projectUsers = project.project_users || [];
				const projectTeams = project.project_teams || [];
				const assignedUserIds = new Set(projectUsers.map((pu) => pu.user_id));
				const assignedTeamIds = new Set(projectTeams.map((pt) => pt.team_id));
				const filteredTeams = allTeams.filter((t) => assignedTeamIds.has(t.id));
				filteredTeams.forEach((t) => {
					if (Array.isArray(t.team_members)) t.team_members.forEach((m) => assignedUserIds.add(m.user_id));
				});
				setAvailableUsers(assignedUserIds.size > 0 ? allUsers.filter((u) => assignedUserIds.has(u.id)) : allUsers);
				setAvailableTeams(filteredTeams);
			} catch (err) {
				console.error("Failed to load assignees", err);
				toast.error("Failed to load project members");
			} finally {
				setIsLoading(false);
			}
		};
		fetchAssignees();
	}, [isOpen, project?.id]);
	if (!isOpen) return null;
	const handleSave = () => {
		if (!commentText.trim() && selectedUsers.length === 0 && selectedTeams.length === 0) {
			toast.error("Please enter a comment description or select an assignee.");
			return;
		}
		const finalDescription = commentText.trim() || "Assigned task for review";
		onSave({
			id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
			text: finalDescription,
			assignedUsers: selectedUsers,
			assignedTeams: selectedTeams,
			authorId: profile?.id || userData?.id || "unknown",
			authorName: userData?.name || profile?.name || "SystemAdmin",
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		});
		onClose();
	};
	const toggleUser = (userId) => {
		setSelectedUsers((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between p-4 border-b border-border/50 bg-surface-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5 text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-1.5 bg-primary/10 rounded-lg",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-4 text-primary" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-[15px] font-bold leading-tight",
							children: "Assign Task / Comment"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[11.5px] text-muted-foreground font-medium",
							children: [
								targetType.toUpperCase(),
								": ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-semibold text-foreground/80",
									children: targetName
								})
							]
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "p-1.5 hover:bg-surface-2 rounded-lg text-muted-foreground transition-colors",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-5 overflow-y-auto flex-1 custom-scrollbar space-y-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "block text-[12.5px] font-bold text-foreground mb-1.5 uppercase tracking-wide",
						children: "Assign To (Project Members)"
					}), isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[12px] text-muted-foreground animate-pulse p-2",
						children: "Loading project members..."
					}) : availableUsers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[12px] text-muted-foreground p-3 bg-surface-2 rounded-lg border border-dashed border-border text-center",
						children: "No users assigned to this project yet."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-2",
						children: availableUsers.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => toggleUser(u.id),
							className: `flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[12px] font-semibold transition-all ${selectedUsers.includes(u.id) ? "bg-primary/10 border-primary text-primary" : "bg-surface-2 border-border/50 text-foreground/80 hover:border-border"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-3.5" }), u.name]
						}, u.id))
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "block text-[12.5px] font-bold text-foreground mb-1.5 uppercase tracking-wide",
						children: "Task Description"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						autoFocus: true,
						value: commentText,
						onChange: (e) => setCommentText(e.target.value),
						placeholder: "Describe the changes or task required...",
						className: "w-full h-28 px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all custom-scrollbar resize-none"
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 border-t border-border/50 bg-surface-1 flex justify-end gap-3 shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "px-4 py-2 rounded-lg text-sm font-medium hover:bg-surface-2 text-muted-foreground transition-colors",
						children: "Cancel"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: handleSave,
						disabled: !commentText.trim() && selectedUsers.length === 0 && selectedTeams.length === 0,
						className: "px-5 py-2 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
						children: "Send Comment"
					})]
				})
			]
		})
	});
}
//#endregion
export { exportVentilationPDF as i, CalculationReviewBar as n, SharedAssignmentModal as r, AssignCommentModal as t };
