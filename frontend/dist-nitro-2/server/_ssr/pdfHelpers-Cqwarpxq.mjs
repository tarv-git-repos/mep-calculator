import { d as workspaceStore } from "./workspace-store-RdZrUbAZ.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pdfHelpers-Cqwarpxq.js
function formatDateStr(rawDate) {
	if (!rawDate) return "";
	try {
		const d = new Date(rawDate);
		if (!isNaN(d.getTime())) return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
	} catch (e) {}
	const datePart = String(rawDate).split(",")[0].trim();
	if (datePart.includes("/")) {
		const parts = datePart.split("/");
		if (parts.length === 3) return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[2]}`;
	} else if (datePart.includes("-")) {
		const parts = datePart.split("-");
		if (parts.length === 3) {
			if (parts[0].length === 4) return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
		}
	}
	return datePart;
}
function getExporterUserName(metaUserName) {
	if (metaUserName && metaUserName.trim() && metaUserName !== "System Admin") return metaUserName.trim();
	if (typeof window !== "undefined") {
		if (window.currentMepUserName) return window.currentMepUserName;
		try {
			const uStr = localStorage.getItem("mep_user");
			if (uStr) {
				const u = JSON.parse(uStr);
				if (u.name) return u.name;
				if (u.user?.name) return u.user.name;
			}
		} catch (e) {}
		try {
			const storeUser = workspaceStore.getState()?.user;
			if (storeUser?.name) return storeUser.name;
		} catch (e) {}
		try {
			const pStr = localStorage.getItem("mep_user_data") || localStorage.getItem("mep_profile");
			if (pStr) {
				const p = JSON.parse(pStr);
				if (p.name) return p.name;
				if (p.user?.name) return p.user.name;
			}
		} catch (e) {}
	}
	return metaUserName?.trim() || "System Admin";
}
function resolveLatestReviewState(projectId, calculatorPath) {
	const rawPath = calculatorPath || "ventilation";
	const pathWithSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
	const pathNoSlash = rawPath.replace(/^\//, "");
	const currentProj = workspaceStore.getState().project;
	const pId = projectId || currentProj?.id || "default";
	const keysToTry = [
		`mep_calc_review_${pId}_${rawPath}`,
		`mep_calc_review_${pId}_${pathWithSlash}`,
		`mep_calc_review_${pId}_${pathNoSlash}`
	];
	let candidateBackend = null;
	let candidateLocal = null;
	if (currentProj) {
		const reviewStates = currentProj.workspace_data?.review_states || {};
		for (const k of keysToTry) if (reviewStates[k] && (reviewStates[k].status || reviewStates[k].history)) {
			candidateBackend = reviewStates[k];
			break;
		}
	}
	if (typeof window !== "undefined") for (const k of keysToTry) try {
		const saved = localStorage.getItem(k);
		if (saved) {
			const parsed = JSON.parse(saved);
			if (parsed && (parsed.status || parsed.history || parsed.approvedBy || parsed.reviewedBy)) {
				candidateLocal = parsed;
				break;
			}
		}
	} catch (e) {}
	if (candidateBackend && candidateLocal) {
		const bHistLen = Array.isArray(candidateBackend.history) ? candidateBackend.history.length : 0;
		if ((Array.isArray(candidateLocal.history) ? candidateLocal.history.length : 0) >= bHistLen) return candidateLocal;
		return candidateBackend;
	}
	return candidateLocal || candidateBackend || {};
}
function getSignatureBlockDetails(projectId, calculatorPath, exporterName) {
	const reviewState = resolveLatestReviewState(projectId, calculatorPath);
	const currentProj = workspaceStore.getState().project;
	const projectCreationDateRaw = currentProj?.created_at || currentProj?.createdAt || currentProj?.date;
	let projectCreatedDateStr = "";
	if (projectCreationDateRaw) projectCreatedDateStr = formatDateStr(projectCreationDateRaw);
	if (!projectCreatedDateStr) projectCreatedDateStr = formatDateStr((/* @__PURE__ */ new Date()).toISOString());
	const originatedName = getExporterUserName(exporterName);
	const originatedDate = projectCreatedDateStr;
	let reviewerName = "";
	let reviewerDate = "";
	if (reviewState?.history && Array.isArray(reviewState.history) && reviewState.history.length > 0) {
		const revItem = [...reviewState.history].reverse().find((h) => h.action === "REVIEWED");
		if (revItem) {
			reviewerName = revItem.user;
			reviewerDate = formatDateStr(revItem.timestamp);
		}
	}
	if (!reviewerName && reviewState?.reviewedBy) {
		reviewerName = reviewState.reviewedBy;
		reviewerDate = formatDateStr(reviewState.reviewedAt);
	}
	let approverName = "";
	let approverDate = "";
	if (reviewState?.history && Array.isArray(reviewState.history) && reviewState.history.length > 0) {
		const appItem = [...reviewState.history].reverse().find((h) => h.action === "APPROVED");
		if (appItem) {
			approverName = appItem.user;
			approverDate = formatDateStr(appItem.timestamp);
		}
	}
	if (!approverName && reviewState?.status === "APPROVED" && reviewState?.approvedBy) {
		approverName = reviewState.approvedBy;
		approverDate = formatDateStr(reviewState.approvedAt);
	}
	return {
		originatedName,
		originatedDate,
		reviewerName,
		reviewerDate,
		approverName,
		approverDate
	};
}
/**
* Appends the 3-tier signature block to a jsPDF instance.
* @param doc The jsPDF document instance
* @param startY The Y coordinate to start drawing the table
* @param creatorName Name of the originator / exporter
* @param projectId Project ID
* @param calculatorPath Current path to derive storage key
*/
function addPdfSignatureBlock(doc, startY, creatorName, projectId, calculatorPath) {
	const { originatedName, originatedDate, reviewerName, reviewerDate, approverName, approverDate } = getSignatureBlockDetails(projectId, calculatorPath, creatorName);
	const head = [[
		"",
		"Originated by",
		"Reviewed by",
		"Approved by"
	]];
	const body = [[
		"Name:",
		originatedName,
		reviewerName,
		approverName
	], [
		"Date:",
		originatedDate,
		reviewerDate,
		approverDate
	]];
	autoTable(doc, {
		startY: startY + 10,
		head,
		body,
		theme: "grid",
		headStyles: {
			fillColor: [
				253,
				235,
				218
			],
			textColor: [
				0,
				0,
				0
			],
			fontStyle: "bold",
			halign: "center",
			valign: "middle"
		},
		bodyStyles: {
			halign: "center",
			valign: "middle"
		},
		columnStyles: {
			0: {
				fontStyle: "bold",
				halign: "right",
				cellWidth: 30
			},
			1: { cellWidth: 50 },
			2: { cellWidth: 50 },
			3: { cellWidth: 50 }
		},
		styles: {
			fontSize: 10,
			cellPadding: 3
		},
		margin: { left: 14 }
	});
	return doc.lastAutoTable.finalY;
}
//#endregion
export { getSignatureBlockDetails as n, addPdfSignatureBlock as t };
