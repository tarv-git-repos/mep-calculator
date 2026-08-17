import { o as __toESM } from "../_runtime.mjs";
import { n as api } from "./api-BcQvT-mW.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { a as getOccupancyData, d as workspaceStore, t as calculateVentilation, u as useWorkspace } from "./workspace-store-Ct3ePlL1.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Dt as ChevronUp, Kt as PenLine, N as Plus, Ot as ChevronRight, T as Search, Wt as TriangleAlert, an as CircleCheck, b as ShieldCheck, ft as Fan, kt as ChevronDown, n as X, nn as CircleX, w as Send, wt as Clock, z as MessageSquare } from "../_libs/lucide-react.mjs";
import { a as usePrompt } from "./use-confirm-BT3fngjN.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as useAuth } from "./AuthContext-CY5Koh3s.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
import { t as downloadFile } from "./download-BwRlYQM3.mjs";
import { n as require_excel } from "../_libs/exceljs+[...].mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/SharedAssignmentModal-DgVO4wRC.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
var import_excel = /* @__PURE__ */ __toESM(require_excel());
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
var ExcelJS$1 = import_excel.default || import_excel;
import_FileSaver_min?.default?.saveAs || import_FileSaver_min?.saveAs;
var exportVentilationExcel = async (spaces, meta = {}) => {
	const activeProj = workspaceStore.getState()?.project || {};
	const workbook = new ExcelJS$1.Workbook();
	const sheet = workbook.addWorksheet("Ventilation Calculation", { views: [{ showGridLines: true }] });
	const baseFont = {
		name: "Arial",
		size: 10,
		family: 2
	};
	const boldFont = {
		...baseFont,
		bold: true
	};
	const titleFont = {
		name: "Arial",
		size: 14,
		bold: true
	};
	const grayFill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FFD9D9D9" }
	};
	const peachFill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FFFCE4D6" }
	};
	const blueFill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FFDAE9F8" }
	};
	const setCellBorder = (cell, topStyle = "thin", bottomStyle = "thin", leftStyle = "thin", rightStyle = "thin") => {
		cell.border = {
			top: {
				style: topStyle,
				color: { argb: "FF000000" }
			},
			bottom: {
				style: bottomStyle,
				color: { argb: "FF000000" }
			},
			left: {
				style: leftStyle,
				color: { argb: "FF000000" }
			},
			right: {
				style: rightStyle,
				color: { argb: "FF000000" }
			}
		};
	};
	sheet.getColumn(1).width = 8;
	sheet.getColumn(2).width = 12;
	sheet.getColumn(3).width = 24;
	sheet.getColumn(4).width = 22;
	sheet.getColumn(5).width = 28;
	sheet.getColumn(6).width = 12;
	sheet.getColumn(7).width = 14;
	sheet.getColumn(8).width = 14;
	sheet.getColumn(9).width = 14;
	sheet.getColumn(10).width = 14;
	sheet.getColumn(11).width = 14;
	sheet.getColumn(12).width = 16;
	sheet.getColumn(13).width = 14;
	sheet.getColumn(14).width = 16;
	sheet.getColumn(15).width = 16;
	sheet.getRow(2).height = 24;
	sheet.getCell("A2").value = "Ventilation Calculation";
	sheet.getCell("A2").font = titleFont;
	const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-101-R01";
	const today = meta.date || (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB");
	const projectNo = meta.projectNo || activeProj.code || "P000";
	const projectName = meta.projectName || activeProj.name || "";
	const clientName = meta.client || activeProj.client || "";
	const endUser = meta.endUser || activeProj?.endUser || activeProj.location || "";
	sheet.mergeCells("A4:H4");
	sheet.getCell("A4").value = `Calculation No.:   ${calcNo}`;
	sheet.getCell("A4").font = boldFont;
	sheet.mergeCells("I4:O4");
	sheet.getCell("I4").value = `Date:  ${today}`;
	sheet.getCell("I4").font = boldFont;
	sheet.mergeCells("A5:H5");
	sheet.getCell("A5").value = `Project No.:   ${projectNo}`;
	sheet.getCell("A5").font = boldFont;
	sheet.mergeCells("I5:O5");
	sheet.getCell("I5").value = `Client:   ${clientName}`;
	sheet.getCell("I5").font = boldFont;
	sheet.mergeCells("A6:H6");
	sheet.getCell("A6").value = `Project Name:   ${projectName}`;
	sheet.getCell("A6").font = boldFont;
	sheet.mergeCells("I6:O6");
	sheet.getCell("I6").value = `End User:   ${endUser}`;
	sheet.getCell("I6").font = boldFont;
	sheet.getCell("I6").font = boldFont;
	for (let r = 4; r <= 6; r++) {
		sheet.getRow(r).height = 22;
		for (let c = 1; c <= 15; c++) {
			const cell = sheet.getCell(r, c);
			setCellBorder(cell, r === 4 ? "medium" : "thin", r === 6 ? "medium" : "thin", c === 1 ? "medium" : "thin", c === 15 ? "medium" : c === 8 ? "medium" : "thin");
			cell.alignment = {
				vertical: "middle",
				indent: c === 1 || c === 9 ? 1 : 0
			};
			if (!cell.font || !cell.font.bold) cell.font = baseFont;
		}
	}
	sheet.getRow(8).height = 24;
	sheet.getRow(9).height = 32;
	sheet.getRow(10).height = 22;
	sheet.mergeCells("A8:A10");
	sheet.getCell("A8").value = "Sr. No.";
	sheet.mergeCells("B8:G8");
	sheet.getCell("B8").value = "Space Parameters";
	sheet.mergeCells("H8:J8");
	sheet.getCell("H8").value = "Fresh Air";
	sheet.mergeCells("K8:M8");
	sheet.getCell("K8").value = "Extract";
	sheet.mergeCells("N8:O8");
	sheet.getCell("N8").value = "Balancing";
	sheet.mergeCells("B9:B10");
	sheet.getCell("B9").value = "Space Floor";
	sheet.mergeCells("C9:C10");
	sheet.getCell("C9").value = "Space Name";
	sheet.mergeCells("D9:D10");
	sheet.getCell("D9").value = "Zone Name";
	sheet.mergeCells("E9:E10");
	sheet.getCell("E9").value = "Occupancy Category";
	sheet.getCell("F9").value = "Area";
	sheet.getCell("G9").value = "Fixtures/\nOccupancy";
	sheet.mergeCells("H9:I9");
	sheet.getCell("H9").value = "Outdoor Air Rate";
	sheet.getCell("J9").value = "Total Fresh Air";
	sheet.mergeCells("K9:K10");
	sheet.getCell("K9").value = "Extract Air\nNumber";
	sheet.mergeCells("L9:L10");
	sheet.getCell("L9").value = "Extract Air\nStrategy";
	sheet.getCell("M9").value = "Total\nExtract";
	sheet.getCell("N9").value = "Fresh Air\nGiven";
	sheet.getCell("O9").value = "Extract Air\nTaken";
	sheet.getCell("F10").value = "(m²)";
	sheet.getCell("G10").value = "No's";
	sheet.getCell("H10").value = "L/s/m²";
	sheet.getCell("I10").value = "L/s/person";
	sheet.getCell("J10").value = "L/s";
	sheet.getCell("M10").value = "L/s";
	sheet.getCell("N10").value = "L/s";
	sheet.getCell("O10").value = "L/s";
	const isMergedCol = (col) => [
		1,
		2,
		3,
		4,
		5,
		11,
		12
	].includes(col);
	for (let r = 8; r <= 10; r++) for (let c = 1; c <= 15; c++) {
		const cell = sheet.getCell(r, c);
		cell.font = boldFont;
		cell.fill = c === 14 || c === 15 ? blueFill : grayFill;
		cell.alignment = {
			horizontal: "center",
			vertical: "middle",
			wrapText: true
		};
		if (r === 8) setCellBorder(cell, "medium", "medium", [
			1,
			2,
			8,
			11,
			14
		].includes(c) ? "medium" : "thin", [
			1,
			7,
			10,
			13,
			15
		].includes(c) ? "medium" : "thin");
		else if (r === 9) setCellBorder(cell, "medium", isMergedCol(c) ? "medium" : "thin", isMergedCol(c) || [
			6,
			8,
			13,
			14
		].includes(c) ? "medium" : "thin", isMergedCol(c) || [
			7,
			10,
			13,
			15
		].includes(c) ? "medium" : "thin");
		else if (r === 10) setCellBorder(cell, isMergedCol(c) ? "medium" : "thin", "medium", isMergedCol(c) || [
			6,
			8,
			13,
			14
		].includes(c) ? "medium" : "thin", isMergedCol(c) || [
			7,
			10,
			13,
			15
		].includes(c) ? "medium" : "thin");
	}
	let startDataRow = 11;
	let currentRow = startDataRow;
	[...spaces].sort((a, b) => {
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
	}).forEach((s, idx) => {
		const r = currentRow;
		sheet.getRow(r).height = 24;
		const data = getOccupancyData(s.category);
		const effectiveArea = parseFloat(String(s.area || 0)) * (s.multiplier || 1);
		const occCount = typeof s.occupancy === "number" ? s.occupancy : typeof s.fixtures === "number" ? s.fixtures : parseInt(String(s.fixtures || 0)) || 0;
		const oaAreaRate = data ? data.areaOA : .3;
		const oaPeopleRate = data ? data.peopleOA : 2.5;
		const totalFreshCalculated = Math.round(s.minOA ?? effectiveArea * oaAreaRate + occCount * oaPeopleRate);
		const totalExtractCalculated = Math.round(s.minExt ?? 0);
		const freshAirGiven = Math.round(s.freshAir ?? totalFreshCalculated);
		const extractAirTaken = Math.round(s.extractAir ?? totalExtractCalculated);
		const c1 = sheet.getCell(r, 1);
		c1.value = idx + 1;
		c1.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		const c2 = sheet.getCell(r, 2);
		c2.value = s.floor || "GF";
		c2.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		const c3 = sheet.getCell(r, 3);
		c3.value = s.name || `Space ${idx + 1}`;
		c3.alignment = {
			horizontal: "left",
			vertical: "middle"
		};
		const c4 = sheet.getCell(r, 4);
		c4.value = s.zone || "Default";
		c4.alignment = {
			horizontal: "left",
			vertical: "middle"
		};
		const c5 = sheet.getCell(r, 5);
		c5.value = s.category || "-";
		c5.alignment = {
			horizontal: "left",
			vertical: "middle"
		};
		const c6 = sheet.getCell(r, 6);
		c6.value = effectiveArea;
		c6.numFmt = "0.0";
		c6.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		const c7 = sheet.getCell(r, 7);
		c7.value = occCount || 0;
		c7.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		const c8 = sheet.getCell(r, 8);
		c8.value = oaAreaRate;
		c8.numFmt = "0.0";
		c8.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		const c9 = sheet.getCell(r, 9);
		c9.value = oaPeopleRate;
		c9.numFmt = "0.0";
		c9.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		const c10 = sheet.getCell(r, 10);
		c10.value = totalFreshCalculated;
		c10.numFmt = "#,##0";
		c10.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		const c11 = sheet.getCell(r, 11);
		let extNo = s.extractAirNumber ?? (data && data.exhaustPerUnit > 0 ? occCount : "-");
		const c12 = sheet.getCell(r, 12);
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
		c11.value = extNo;
		c11.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		c12.value = extStrat;
		c12.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		const c13 = sheet.getCell(r, 13);
		c13.value = totalExtractCalculated;
		c13.numFmt = "#,##0";
		c13.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		const c14 = sheet.getCell(r, 14);
		c14.value = freshAirGiven;
		c14.numFmt = "#,##0";
		c14.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		const c15 = sheet.getCell(r, 15);
		c15.value = extractAirTaken;
		c15.numFmt = "#,##0";
		c15.alignment = {
			horizontal: "center",
			vertical: "middle"
		};
		for (let c = 1; c <= 15; c++) {
			const cell = sheet.getCell(r, c);
			cell.font = baseFont;
			setCellBorder(cell, "thin", "thin", isMergedCol(c) || [
				6,
				8,
				13,
				14
			].includes(c) ? "medium" : "thin", isMergedCol(c) || [
				7,
				10,
				13,
				15
			].includes(c) ? "medium" : "thin");
		}
		currentRow++;
	});
	const lastDataRow = currentRow - 1;
	sheet.getRow(currentRow).height = 25;
	sheet.mergeCells(`A${currentRow}:M${currentRow}`);
	const totalLabelCell = sheet.getCell(`A${currentRow}`);
	totalLabelCell.value = "Total:";
	totalLabelCell.font = boldFont;
	totalLabelCell.alignment = {
		horizontal: "right",
		vertical: "middle"
	};
	for (let c = 1; c <= 15; c++) {
		const cell = sheet.getCell(currentRow, c);
		cell.fill = c === 14 || c === 15 ? blueFill : grayFill;
		setCellBorder(cell, "medium", "medium", isMergedCol(c) || [
			6,
			8,
			13,
			14
		].includes(c) ? "medium" : "thin", isMergedCol(c) || [
			7,
			10,
			13,
			15
		].includes(c) ? "medium" : "thin");
	}
	const totalFACell = sheet.getCell(currentRow, 14);
	if (lastDataRow >= startDataRow) totalFACell.value = { formula: `=SUM(N${startDataRow}:N${lastDataRow})` };
	else totalFACell.value = 0;
	totalFACell.font = boldFont;
	totalFACell.numFmt = "#,##0";
	totalFACell.alignment = {
		horizontal: "center",
		vertical: "middle"
	};
	const totalEACell = sheet.getCell(currentRow, 15);
	if (lastDataRow >= startDataRow) totalEACell.value = { formula: `=SUM(O${startDataRow}:O${lastDataRow})` };
	else totalEACell.value = 0;
	totalEACell.font = boldFont;
	totalEACell.numFmt = "#,##0";
	totalEACell.alignment = {
		horizontal: "center",
		vertical: "middle"
	};
	currentRow += 3;
	const refStartRow = currentRow;
	sheet.mergeCells(`A${refStartRow}:B${refStartRow}`);
	const refTitleCell = sheet.getCell(`A${refStartRow}`);
	refTitleCell.value = "Reference:";
	refTitleCell.font = {
		...boldFont,
		underline: true
	};
	sheet.mergeCells(`C${refStartRow}:E${refStartRow}`);
	sheet.getCell(`C${refStartRow}`).value = "1. Architectural Drawings:";
	sheet.getCell(`C${refStartRow}`).font = baseFont;
	sheet.mergeCells(`A${refStartRow + 1}:B${refStartRow + 1}`);
	sheet.mergeCells(`C${refStartRow + 1}:E${refStartRow + 1}`);
	sheet.getCell(`C${refStartRow + 1}`).value = "2. ASHRAE 62.1 2026";
	sheet.getCell(`C${refStartRow + 1}`).font = baseFont;
	sheet.mergeCells(`A${refStartRow + 2}:B${refStartRow + 2}`);
	sheet.mergeCells(`C${refStartRow + 2}:E${refStartRow + 2}`);
	sheet.getCell(`C${refStartRow + 2}`).value = "3. ASHRAE 62.2 2026";
	sheet.getCell(`C${refStartRow + 2}`).font = baseFont;
	for (let r = refStartRow; r <= refStartRow + 2; r++) {
		sheet.getRow(r).height = 20;
		for (let c = 1; c <= 5; c++) {
			const cell = sheet.getCell(r, c);
			setCellBorder(cell, r === refStartRow ? "medium" : "thin", r === refStartRow + 2 ? "medium" : "thin", c === 1 ? "medium" : "thin", c === 5 ? "medium" : c === 2 ? "medium" : "thin");
			cell.alignment = {
				vertical: "middle",
				indent: c === 1 ? 1 : 0
			};
		}
	}
	currentRow = refStartRow + 5;
	const sigStartRow = currentRow;
	sheet.getRow(sigStartRow).height = 24;
	sheet.mergeCells(`A${sigStartRow}:C${sigStartRow}`);
	sheet.mergeCells(`D${sigStartRow}:G${sigStartRow}`);
	sheet.getCell(`D${sigStartRow}`).value = "Originated by";
	sheet.getCell(`D${sigStartRow}`).font = boldFont;
	sheet.getCell(`D${sigStartRow}`).alignment = {
		horizontal: "center",
		vertical: "middle"
	};
	sheet.mergeCells(`H${sigStartRow}:K${sigStartRow}`);
	sheet.getCell(`H${sigStartRow}`).value = "Reviewed by";
	sheet.getCell(`H${sigStartRow}`).font = boldFont;
	sheet.getCell(`H${sigStartRow}`).alignment = {
		horizontal: "center",
		vertical: "middle"
	};
	sheet.mergeCells(`L${sigStartRow}:O${sigStartRow}`);
	sheet.getCell(`L${sigStartRow}`).value = "Approved by";
	sheet.getCell(`L${sigStartRow}`).font = boldFont;
	sheet.getCell(`L${sigStartRow}`).alignment = {
		horizontal: "center",
		vertical: "middle"
	};
	for (let c = 1; c <= 15; c++) {
		const cell = sheet.getCell(sigStartRow, c);
		cell.fill = peachFill;
		setCellBorder(cell, "medium", "thin", c === 1 ? "medium" : "thin", c === 3 || c === 7 || c === 11 || c === 15 ? "medium" : "thin");
	}
	let userName = meta.userName || (typeof window !== "undefined" ? window.currentMepUserName : void 0) || "System Admin";
	if (!meta.userName) try {
		const profileStr = localStorage.getItem("mep_calculator_user_data") || localStorage.getItem("mep_profile") || localStorage.getItem("mep_user_data");
		if (profileStr) {
			const profile = JSON.parse(profileStr);
			if (profile.name) userName = profile.name;
			else if (profile.user?.name) userName = profile.user.name;
			else if (profile.userData?.name) userName = profile.userData.name;
		}
	} catch (e) {}
	const nameRow = sigStartRow + 1;
	sheet.getRow(nameRow).height = 24;
	sheet.mergeCells(`A${nameRow}:C${nameRow}`);
	sheet.getCell(`A${nameRow}`).value = "Name:";
	sheet.getCell(`A${nameRow}`).font = boldFont;
	sheet.getCell(`A${nameRow}`).alignment = {
		horizontal: "right",
		vertical: "middle"
	};
	sheet.mergeCells(`D${nameRow}:G${nameRow}`);
	sheet.getCell(`D${nameRow}`).value = userName;
	sheet.getCell(`D${nameRow}`).font = baseFont;
	sheet.getCell(`D${nameRow}`).alignment = {
		horizontal: "center",
		vertical: "middle"
	};
	sheet.mergeCells(`H${nameRow}:K${nameRow}`);
	sheet.mergeCells(`L${nameRow}:O${nameRow}`);
	for (let c = 1; c <= 15; c++) setCellBorder(sheet.getCell(nameRow, c), "thin", "thin", c === 1 ? "medium" : "thin", c === 3 || c === 7 || c === 11 || c === 15 ? "medium" : "thin");
	const sigDateRow = sigStartRow + 2;
	sheet.getRow(sigDateRow).height = 24;
	sheet.mergeCells(`A${sigDateRow}:C${sigDateRow}`);
	sheet.getCell(`A${sigDateRow}`).value = "Date:";
	sheet.getCell(`A${sigDateRow}`).font = boldFont;
	sheet.getCell(`A${sigDateRow}`).alignment = {
		horizontal: "right",
		vertical: "middle"
	};
	sheet.mergeCells(`D${sigDateRow}:G${sigDateRow}`);
	sheet.getCell(`D${sigDateRow}`).value = today;
	sheet.getCell(`D${sigDateRow}`).font = baseFont;
	sheet.getCell(`D${sigDateRow}`).alignment = {
		horizontal: "center",
		vertical: "middle"
	};
	sheet.mergeCells(`H${sigDateRow}:K${sigDateRow}`);
	sheet.mergeCells(`L${sigDateRow}:O${sigDateRow}`);
	for (let c = 1; c <= 15; c++) setCellBorder(sheet.getCell(sigDateRow, c), "thin", "medium", c === 1 ? "medium" : "thin", c === 3 || c === 7 || c === 11 || c === 15 ? "medium" : "thin");
	const buffer = await workbook.xlsx.writeBuffer();
	const filename = `Ventilation_Calculation_${calcNo}.xlsx`;
	await downloadFile(new Uint8Array(buffer), filename, "Excel Document", ["xlsx"]);
};
var exportVentilationPDF = async (spaces, meta = {}) => {
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
		let userName = meta.userName || (typeof window !== "undefined" ? window.currentMepUserName : void 0) || "System Admin";
		if (!meta.userName) try {
			const profileStr = localStorage.getItem("mep_calculator_user_data") || localStorage.getItem("mep_profile") || localStorage.getItem("mep_user_data");
			if (profileStr) {
				const profile = JSON.parse(profileStr);
				if (profile.name) userName = profile.name;
				else if (profile.user?.name) userName = profile.user.name;
				else if (profile.userData?.name) userName = profile.userData.name;
			}
		} catch (e) {}
		callAutoTable(doc, {
			startY: (doc.lastAutoTable?.finalY ?? 150) + 8,
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
					content: userName,
					styles: { halign: "center" }
				},
				{ content: "" },
				{ content: "" }
			], [
				{
					content: "Date:",
					styles: {
						fontStyle: "bold",
						halign: "right"
					}
				},
				{
					content: today,
					styles: { halign: "center" }
				},
				{ content: "" },
				{ content: "" }
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
		const des = (profile?.designation || profile?.role || "").toLowerCase();
		if (des.includes("coordinator") || des.includes("lead") || profile?.role === "SUPER_ADMIN" || profile?.role === "ORG_ADMIN") return "Discipline Coordinator";
		if (des.includes("senior") || des.includes("sr")) return "Sr. Design Engineer";
		return "Jr. / Design Engineer";
	}, [profile?.designation, profile?.role]);
	const storageKey = `mep_calc_review_${projectId || "default"}_${calculatorPath || "ventilation"}`;
	const [reviewState, setReviewState] = (0, import_react.useState)(() => {
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
	}, [storageKey]);
	const updateReviewState = (next) => {
		setReviewState(next);
		if (typeof window !== "undefined") localStorage.setItem(storageKey, JSON.stringify(next));
		if (onReviewStateChange) onReviewStateChange(next);
		if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mep-review-state-updated", { detail: next }));
	};
	const handleSrReviewSubmit = async () => {
		const timestamp = (/* @__PURE__ */ new Date()).toLocaleString();
		updateReviewState({
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
		});
		setShowReviewModal(false);
		if (srComments.trim()) try {
			if (typeof window !== "undefined") {
				const jrNotifRecord = {
					id: `jr-notif-${Date.now()}`,
					reviewerName: currentUserName,
					comments: srComments.trim(),
					calculatorTitle,
					calculatorPath,
					projectId,
					timestamp: (/* @__PURE__ */ new Date()).toISOString()
				};
				const existing = JSON.parse(localStorage.getItem("mep_calc_jr_engineer_notifs") || "[]");
				existing.unshift(jrNotifRecord);
				localStorage.setItem("mep_calc_jr_engineer_notifs", JSON.stringify(existing.slice(0, 20)));
				window.dispatchEvent(new CustomEvent("mep-notification-added"));
				window.dispatchEvent(new CustomEvent("mep-review-state-updated", { detail: {
					status: "SR_REVIEW_SUBMITTED",
					reviewedBy: currentUserName,
					reviewerComments: srComments.trim(),
					calculatorTitle,
					projectId
				} }));
			}
		} catch (e) {}
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
		} catch (e) {}
		toast.success(`Calculation APPROVED! Status updated for all team members.`);
	};
	const handleCoordinatorRejectSubmit = async () => {
		if (!rejectReason.trim()) {
			toast.error("Please enter a description/reason for rejection.");
			return;
		}
		const timestamp = (/* @__PURE__ */ new Date()).toLocaleString();
		updateReviewState({
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
		});
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
				const existing = JSON.parse(localStorage.getItem("mep_calc_rejection_notifs") || "[]");
				existing.unshift(notifRecord);
				localStorage.setItem("mep_calc_rejection_notifs", JSON.stringify(existing.slice(0, 20)));
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
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: reviewState.status === "REVIEWED" ? "Re-submit Review" : "Reviewed" })]
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
			reviewState.status === "REJECTED" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
//#endregion
export { exportVentilationPDF as i, SharedAssignmentModal as n, exportVentilationExcel as r, CalculationReviewBar as t };
