import * as ExcelJSModule from "exceljs";
import * as fileSaver from "file-saver";
import { downloadFile } from "./download";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";
import type { SprinklerDensityExportData, SprinklerDensityProjectMetaData } from "./exportSprinklerDensityPDF";

const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
const saveAs = (fileSaver as any)?.default?.saveAs || (fileSaver as any)?.saveAs || fileSaver;

export const exportSprinklerDensityExcel = async (
  data: SprinklerDensityExportData,
  meta: SprinklerDensityProjectMetaData = {},
  liveReviewState?: any
) => {
  let currentUserName = "System Admin";
  let activeProjectId = "default";
  if (typeof window !== "undefined") {
    try {
      const user = JSON.parse(localStorage.getItem("mep_user") || "{}");
      currentUserName = user.name || "System Admin";
      const ws = JSON.parse(localStorage.getItem("workspace-storage") || "{}");
      activeProjectId = ws.state?.activeProjectId || "default";
    } catch (e) {}
  }

  try {
    const activeProj: any = workspaceStore.getState()?.project || {};

    const workbook = new ExcelJS.Workbook();
    workbook.creator = currentUserName;
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Sprinkler Density & Flow", {
      views: [{ showGridLines: true }]
    });

    const isSI = data.unitSystem === "si";

    const baseFont = { name: "Arial", size: 10, family: 2 };
    const boldFont = { ...baseFont, bold: true };
    const titleFont = { name: "Arial", size: 14, bold: true };

    const grayFill: any = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9D9D9" },
    };

    const blueFill: any = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDAE9F8" },
    };

    const peachFill: any = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFCE4D6" },
    };

    const greenFill: any = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2F0D9" },
    };

    const redFill: any = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEE2E2" },
    };

    const setCellBorder = (
      cell: any,
      topStyle: string = "thin",
      bottomStyle: string = "thin",
      leftStyle: string = "thin",
      rightStyle: string = "thin"
    ) => {
      cell.border = {
        top: { style: topStyle, color: { argb: "FF000000" } },
        bottom: { style: bottomStyle, color: { argb: "FF000000" } },
        left: { style: leftStyle, color: { argb: "FF000000" } },
        right: { style: rightStyle, color: { argb: "FF000000" } },
      };
    };

    // Set Column Widths (8 Columns A to H)
    sheet.getColumn(1).width = 8;   // A: Sr. No.
    sheet.getColumn(2).width = 38;  // B: Parameter Description
    sheet.getColumn(3).width = 28;  // C: Governing Formula / Rule
    sheet.getColumn(4).width = 20;  // D: Calculated Output
    sheet.getColumn(5).width = 14;  // E: Unit
    sheet.getColumn(6).width = 24;  // F: NFPA 13 Status
    sheet.getColumn(7).width = 32;  // G: Standard Guideline
    sheet.getColumn(8).width = 20;  // H: Notes

    // Title Row (Row 2)
    sheet.getRow(2).height = 26;
    sheet.getCell("A2").value = "Sprinkler Density & Flow Calculation";
    sheet.getCell("A2").font = titleFont;

    // Metadata Block (Rows 4 to 6 - Exact Ventilation format)
    const calcNo = meta.calcNo || (activeProj as any)?.calcNo || "TRV-CAL-SDF-001";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj.code || "P000";
    const projectName = meta.projectName || activeProj.name || "Sprinkler Density & Flow Sizing";
    const clientName = meta.client || activeProj.client || "Consistent Engineering Consultants";
    const endUser = meta.endUser || (activeProj as any)?.endUser || activeProj.location || "Main Complex";

    sheet.mergeCells("A4:D4");
    sheet.getCell("A4").value = `Calculation No.:   ${calcNo}`;
    sheet.getCell("A4").font = boldFont;

    sheet.mergeCells("E4:H4");
    sheet.getCell("E4").value = `Date:  ${today}`;
    sheet.getCell("E4").font = boldFont;

    sheet.mergeCells("A5:D5");
    sheet.getCell("A5").value = `Project No.:   ${projectNo}`;
    sheet.getCell("A5").font = boldFont;

    sheet.mergeCells("E5:H5");
    sheet.getCell("E5").value = `Client:   ${clientName}`;
    sheet.getCell("E5").font = boldFont;

    sheet.mergeCells("A6:D6");
    sheet.getCell("A6").value = `Project Name:   ${projectName}`;
    sheet.getCell("A6").font = boldFont;

    sheet.mergeCells("E6:H6");
    sheet.getCell("E6").value = `End User:   ${endUser}`;
    sheet.getCell("E6").font = boldFont;

    for (let r = 4; r <= 6; r++) {
      sheet.getRow(r).height = 22;
      for (let c = 1; c <= 8; c++) {
        const cell = sheet.getCell(r, c);
        const topStyle = r === 4 ? "medium" : "thin";
        const bottomStyle = r === 6 ? "medium" : "thin";
        const leftStyle = c === 1 ? "medium" : "thin";
        const rightStyle = c === 8 ? "medium" : (c === 4 ? "medium" : "thin");
        setCellBorder(cell, topStyle, bottomStyle, leftStyle, rightStyle);
        cell.alignment = { vertical: "middle", indent: (c === 1 || c === 5) ? 1 : 0 };
        if (!cell.font || !cell.font.bold) cell.font = baseFont;
      }
    }

    // Header Rows (Rows 8, 9)
    sheet.getRow(8).height = 24;
    sheet.getRow(9).height = 26;

    sheet.mergeCells("A8:A9");
    sheet.getCell("A8").value = "Sr. No.";
    sheet.mergeCells("B8:B9");
    sheet.getCell("B8").value = "Sprinkler Sizing Parameter";
    sheet.mergeCells("C8:C9");
    sheet.getCell("C8").value = "Governing Formula / Rule";
    sheet.mergeCells("D8:D9");
    sheet.getCell("D8").value = "Calculated Value";
    sheet.mergeCells("E8:E9");
    sheet.getCell("E8").value = "Unit";
    sheet.mergeCells("F8:F9");
    sheet.getCell("F8").value = "NFPA 13 Status";
    sheet.mergeCells("G8:G9");
    sheet.getCell("G8").value = "Design Criteria / Guideline";
    sheet.mergeCells("H8:H9");
    sheet.getCell("H8").value = "Engineering Notes";

    for (let r = 8; r <= 9; r++) {
      for (let c = 1; c <= 8; c++) {
        const cell = sheet.getCell(r, c);
        cell.font = boldFont;
        cell.fill = (c === 4 || c === 6) ? blueFill : grayFill;
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        setCellBorder(cell, r === 8 ? "medium" : "thin", "medium", c === 1 ? "medium" : "thin", c === 8 ? "medium" : "thin");
      }
    }

    // Data rows
    const dataItems = [
      { sr: 1, desc: "Hazard Classification", formula: "NFPA 13 Standard Curve", val: data.hazardLabel, unit: "-", status: "Verified", criteria: "Classified per occupancy hazard type", notes: "Governs density & area" },
      { sr: 2, desc: "Design Density (d)", formula: "d = NFPA 13 Density Curve", val: data.density, unit: data.densityUnit, status: "Verified", criteria: "Minimum discharge rate per unit area", notes: "NFPA 13 density/area curve" },
      { sr: 3, desc: "Design Area of Operation (A_design)", formula: "A_design = NFPA 13 Area Curve", val: data.designArea, unit: data.designAreaUnit, status: "Verified", criteria: "Hydraulically most demanding area", notes: "Standard design area" },
      { sr: 4, desc: "Sprinkler Coverage Area (A_cov)", formula: "Spacing Criterion S × L", val: data.coverage, unit: data.coverageUnit, status: data.isCoverageCompliant ? "Compliant" : "Attention", criteria: "Max 225 ft² (Light), 130 ft² (Ordinary)", notes: data.isCoverageCompliant ? "Within spacing limit" : "Exceeds standard 225 ft²" },
      { sr: 5, desc: "Sprinkler Discharge Coefficient (K)", formula: "K-Factor Orifice Size", val: `K-${data.kFactor.toFixed(1)}`, unit: data.kFactorUnit, status: "Standard", criteria: "Standard nominal K-Factor listing", notes: "Manufacturer listing" },
      { sr: 6, desc: "Minimum Flow per Sprinkler (q)", formula: "q = d × A_cov", val: Number(data.flowPerSprinkler.toFixed(2)), unit: data.flowUnit, status: "Calculated", criteria: "Minimum discharge from remote head", notes: "Direct density/coverage product" },
      { sr: 7, desc: "Minimum Operating Pressure (P)", formula: "P = (q / K)²", val: Number(data.pressureRequired.toFixed(2)), unit: data.pressureUnit, status: data.isPressureCompliant ? "COMPLIANT (≥ 7.0 psi)" : "VIOLATION (< 7.0 psi)", criteria: "Minimum 7.0 psi required per NFPA 13", notes: data.isPressureCompliant ? "Satisfies minimum pressure" : "Pressure below 7.0 psi code limit" },
      { sr: 8, desc: "Number of Operating Sprinklers (N)", formula: "N = ⌈A_design / A_cov⌉", val: data.sprinklersCount, unit: "heads", status: "Calculated", criteria: "Number of sprinklers in design area", notes: "Rounded up to next integer" },
      { sr: 9, desc: "Total Sprinkler Flow Demand (Q_sprinkler)", formula: "Q_sp = d × A_design", val: Number(data.totalSprinklerFlow.toFixed(1)), unit: data.flowUnit, status: "Calculated", criteria: "Total flow for all heads in design area", notes: "Excludes hose stream" },
      { sr: 10, desc: "Inside Hose Stream Allowance (Q_hose)", formula: "NFPA 13 Table Allowance", val: Number(data.hoseAllowance.toFixed(1)), unit: data.flowUnit, status: "NFPA 13 Table", criteria: "Light: 100 gpm, Ord: 250 gpm, Extra: 500 gpm", notes: "Standard hose allowance" },
      { sr: 11, desc: "TOTAL DESIGN WATER DEMAND (Q_total)", formula: "Q_total = Q_sp + Q_hose", val: Number(data.totalSystemDemand.toFixed(1)), unit: data.flowUnit, status: "CRITICAL", criteria: "Total required water supply flow", notes: "Combined sprinkler + hose stream" },
      { sr: 12, desc: "Water Supply Duration", formula: "NFPA 13 Duration Standard", val: data.waterDurationMin, unit: "minutes", status: "NFPA 13 Table", criteria: "Light: 30 min, Ord: 60-90 min, Extra: 90-120 min", notes: "Minimum continuous duration" },
      { sr: 13, desc: "Required Fire Water Storage Capacity", formula: "V = Q_total × Duration", val: isSI ? Number(data.totalStorageM3.toFixed(1)) : Number(data.totalStorageGallons.toFixed(0)), unit: isSI ? "m³" : "gal", status: "Calculated", criteria: "Dedicated fire tank volume", notes: "Net effective water storage" }
    ];

    let startRow = 10;
    dataItems.forEach((item, index) => {
      const rNum = startRow + index;
      const row = sheet.getRow(rNum);
      row.height = 22;

      row.getCell(1).value = item.sr;
      row.getCell(2).value = item.desc;
      row.getCell(3).value = item.formula;
      row.getCell(4).value = item.val;
      row.getCell(5).value = item.unit;
      row.getCell(6).value = item.status;
      row.getCell(7).value = item.criteria;
      row.getCell(8).value = item.notes;

      // Styling
      for (let c = 1; c <= 8; c++) {
        const cell = row.getCell(c);
        cell.font = baseFont;
        setCellBorder(cell, "thin", "thin", c === 1 ? "medium" : "thin", c === 8 ? "medium" : "thin");
        cell.alignment = {
          vertical: "middle",
          horizontal: (c === 1 || c === 5 || c === 6) ? "center" : (c === 4 ? "right" : "left")
        };
      }

      // Highlight Total Demand (Row 11)
      if (item.sr === 11) {
        for (let c = 1; c <= 8; c++) {
          const cell = row.getCell(c);
          cell.font = boldFont;
          cell.fill = redFill;
        }
      } else if (item.sr === 7) {
        // Pressure cell
        const pCell = row.getCell(6);
        pCell.fill = data.isPressureCompliant ? greenFill : redFill;
        pCell.font = boldFont;
      }
    });

    // Summary block border
    const lastDataRow = startRow + dataItems.length - 1;
    for (let c = 1; c <= 8; c++) {
      const cell = sheet.getCell(lastDataRow, c);
      setCellBorder(cell, "thin", "medium", c === 1 ? "medium" : "thin", c === 8 ? "medium" : "thin");
    }

    // Signature Block (Matching exact standard ventilation signature block)
    const sigStartRow = lastDataRow + 3;
    addExcelSignatureBlock(
      sheet,
      sigStartRow,
      currentUserName,
      activeProjectId || activeProj?.id || "default",
      "/plumbing-sprinkler-density",
      liveReviewState
    );

    // Save & Download Excel
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Sprinkler_Density_Flow_${projectNo}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    downloadFile(new Uint8Array(buffer), fileName, "Excel Document", ["xlsx"]);
    toast.success("Sprinkler Density & Flow Excel sheet generated successfully!");
  } catch (error: any) {
    console.error("Failed to export Sprinkler Density Excel:", error);
    toast.error(`Export failed: ${error?.message || "Unknown error"}`);
  }
};
