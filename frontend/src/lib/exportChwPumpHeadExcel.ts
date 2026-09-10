import * as ExcelJSModule from "exceljs";
import { downloadFile } from "./download";
import { getSignatureBlockDetails } from "@/lib/pdfHelpers";
import { workspaceStore } from "./workspace-store";

const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;

export interface ChwPumpExportParams {
  projectInfo: {
    calcNumber: string;
    projectName: string;
    projectNumber: string;
    consultant: string;
    client: string;
    revision: string;
    date: string;
    designedBy?: string;
    checkedBy?: string;
    approvedBy?: string;
  };
  sizingParams: {
    flowUsgpm: number | "";
    vertLength: number | "";
    horizLength: number | "";
    frictionFactor: number | "";
    staticHead: number | "";
    residualPressure: number | "";
    suctionPressure: number | "";
    safetyFactorHead: number | "";
    selectedHead: number | "";
    effPump: number | "";
    effMotor: number | "";
  };
  calculatedData: {
    flowRate: number;
    flowRateDisplay: number;
    flowUnit: string;
    massFlow: number;
    vertLengthDisplay: number;
    horizLengthDisplay: number;
    elbowsLengthDisplay: number;
    valvesLengthDisplay: number;
    equivLengthDisplay: number;
    lengthUnit: string;
    frictionLossDisplay: number;
    headUnit: string;
    staticHeadDisplay: number;
    outletHeadDisplay: number;
    suctionHeadDisplay: number;
    sfPercent: number;
    pumpHeadCalcDisplay: number;
    selectedHeadDisplay: number;
    effPumpVal: number;
    effMotorVal: number;
    shaftPowerKw: number;
    motorPowerKw: number;
    motorPowerHp: number;
  };
  unitSystem: "si" | "ip";
}

export interface ChwPumpExcelMetaData {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
}

export const exportChwPumpHeadExcel = async (
  params: ChwPumpExportParams,
  meta: ChwPumpExcelMetaData = {}
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

  const activeProj: any = workspaceStore.getState()?.project || {};

  const workbook = new ExcelJS.Workbook();
  workbook.creator = currentUserName;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("CHW Pump Head Calculation", {
    views: [{ showGridLines: true }],
  });

  const baseFont = { name: "Arial", size: 10, family: 2 };
  const boldFont = { ...baseFont, bold: true };
  const titleFont = { name: "Arial", size: 14, bold: true };
  const subHeaderFont = { name: "Arial", size: 11, bold: true };

  const grayFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9D9D9" },
  };

  const peachFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFCE4D6" },
  };

  const blueFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDAE9F8" },
  };

  const highlightFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2EFDA" }, // Soft green
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

  // Set Column Widths (8 columns A to H)
  sheet.getColumn(1).width = 8;    // A: Item / No.
  sheet.getColumn(2).width = 34;   // B: Description / Parameter
  sheet.getColumn(3).width = 16;   // C: Engineering Formula / Basis
  sheet.getColumn(4).width = 16;   // D: Calculated Value
  sheet.getColumn(5).width = 14;   // E: Units
  sheet.getColumn(6).width = 20;   // F: Applied Margin / Factor
  sheet.getColumn(7).width = 16;   // G: Selected / Design Value
  sheet.getColumn(8).width = 16;   // H: Engineering Status

  // Title Row
  sheet.getRow(2).height = 24;
  sheet.getCell("A2").value = "Chilled Water Primary/Secondary Pump Head & Power Sizing Calculation";
  sheet.getCell("A2").font = titleFont;

  // Metadata Block (Rows 4 to 6)
  const calcNo = meta.calcNo || params.projectInfo.calcNumber || (activeProj as any)?.calcNo || "TRV-CHW-PUMP-01";
  const today = meta.date || params.projectInfo.date || new Date().toLocaleDateString("en-GB");
  const projectNo = meta.projectNo || params.projectInfo.projectNumber || activeProj.code || "P000";
  const projectName = meta.projectName || params.projectInfo.projectName || activeProj.name || "";
  const clientName = meta.client || params.projectInfo.client || activeProj.client || "";
  const endUser = meta.endUser || (activeProj as any)?.endUser || activeProj.location || "";

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

  const { calculatedData, sizingParams, unitSystem } = params;
  const isIP = unitSystem === "ip";
  const ffUnit = isIP ? "psi/100ft" : "bar/100m";
  const ffVal = sizingParams.frictionFactor || (isIP ? 1.77 : 0.4);

  let curRow = 8;

  // Helper for Section Header
  const renderSectionHeader = (title: string) => {
    sheet.getRow(curRow).height = 24;
    sheet.mergeCells(`A${curRow}:H${curRow}`);
    sheet.getCell(`A${curRow}`).value = title;
    sheet.getCell(`A${curRow}`).font = subHeaderFont;
    for (let c = 1; c <= 8; c++) {
      const cell = sheet.getCell(curRow, c);
      cell.fill = grayFill;
      setCellBorder(cell, "medium", "medium", c === 1 ? "medium" : "thin", c === 8 ? "medium" : "thin");
      cell.alignment = { vertical: "middle", indent: 1 };
    }
    curRow++;

    // Sub-columns header
    sheet.getRow(curRow).height = 22;
    sheet.getCell(`A${curRow}`).value = "Item";
    sheet.mergeCells(`B${curRow}:C${curRow}`);
    sheet.getCell(`B${curRow}`).value = "Hydronic Parameter";
    sheet.getCell(`D${curRow}`).value = "Calculated Value";
    sheet.getCell(`E${curRow}`).value = "Units";
    sheet.getCell(`F${curRow}`).value = "Design Allowance";
    sheet.getCell(`G${curRow}`).value = "Operating Basis";
    sheet.getCell(`H${curRow}`).value = "Compliance";

    for (let c = 1; c <= 8; c++) {
      const cell = sheet.getCell(curRow, c);
      cell.font = boldFont;
      cell.fill = blueFill;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      setCellBorder(cell, "thin", "thin", c === 1 ? "medium" : "thin", c === 8 ? "medium" : "thin");
    }
    curRow++;
  };

  // Helper for Data Rows
  const renderDataRow = (
    itemNo: string | number,
    paramName: string,
    val: number | string,
    unit: string,
    allowance: string = "-",
    basis: string = "-",
    status: string = "Pass",
    isHighlight: boolean = false,
    numFormat?: string
  ) => {
    sheet.getRow(curRow).height = 22;
    sheet.getCell(`A${curRow}`).value = itemNo;
    sheet.getCell(`A${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells(`B${curRow}:C${curRow}`);
    sheet.getCell(`B${curRow}`).value = paramName;
    sheet.getCell(`B${curRow}`).alignment = { horizontal: "left", vertical: "middle", indent: 1 };

    sheet.getCell(`D${curRow}`).value = typeof val === "number" ? val : val;
    if (numFormat && typeof val === "number") sheet.getCell(`D${curRow}`).numFmt = numFormat;
    sheet.getCell(`D${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`E${curRow}`).value = unit;
    sheet.getCell(`E${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`F${curRow}`).value = allowance;
    sheet.getCell(`F${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`G${curRow}`).value = basis;
    sheet.getCell(`G${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`H${curRow}`).value = status;
    sheet.getCell(`H${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    for (let c = 1; c <= 8; c++) {
      const cell = sheet.getCell(curRow, c);
      cell.font = isHighlight ? boldFont : baseFont;
      if (isHighlight) cell.fill = highlightFill;
      setCellBorder(cell, "thin", "thin", c === 1 ? "medium" : "thin", c === 8 ? "medium" : "thin");
    }
    curRow++;
  };

  // 1. Flow Demand Parameters
  renderSectionHeader("1. CHW FLOW DEMAND & FLUID BASIS");
  renderDataRow("1.1", "Design Flow Rate", calculatedData.flowRateDisplay, calculatedData.flowUnit, "-", "Design Peak Flow", "Design Basis", false, "#,##0.00");
  renderDataRow("1.2", "Metric Mass Flow Rate", Number(calculatedData.massFlow.toFixed(3)), "kg/s", "-", "Water @ 6°C", "Verified", false, "0.000");
  renderDataRow("1.3", "Metric Volumetric Flow Rate", Number(calculatedData.flowRate.toFixed(2)), "L/s", "-", "Q_chw = P_ton / (Cp * ΔT)", "Verified", false, "#,##0.00");

  curRow++; // space

  // 2. Piping Network & Equivalent Length
  renderSectionHeader("2. PIPING NETWORK RUN & EFFECTIVE LENGTH CALCULATION");
  renderDataRow("2.1", "Vertical Straight Pipe Length", calculatedData.vertLengthDisplay, calculatedData.lengthUnit, "-", "Riser Height", "Input", false, "#,##0.0");
  renderDataRow("2.2", "Horizontal Straight Pipe Length", calculatedData.horizLengthDisplay, calculatedData.lengthUnit, "-", "Longest Run Path", "Input", false, "#,##0.0");
  renderDataRow("2.3", "Sum of Straight Pipe Runs", Number((calculatedData.vertLengthDisplay + calculatedData.horizLengthDisplay).toFixed(1)), calculatedData.lengthUnit, "-", "L_vert + L_horiz", "Sum", false, "#,##0.0");
  renderDataRow("2.4", "Elbows, Bends & Reducers Allowance", calculatedData.elbowsLengthDisplay, calculatedData.lengthUnit, "+30% allowance", "Fittings Eq. Length", "Allowance", false, "#,##0.00");
  renderDataRow("2.5", "Valves, Strainers & Accessories Allowance", calculatedData.valvesLengthDisplay, calculatedData.lengthUnit, "+30% allowance", "Valves Eq. Length", "Allowance", false, "#,##0.00");
  renderDataRow("2.6", "Total Effective Equivalent Length (Leff)", calculatedData.equivLengthDisplay, calculatedData.lengthUnit, "+5% safety factor", "Math.ceil(Sum * 1.05 / 10)*10", "Designed", true, "#,##0.0");
  renderDataRow("2.7", "Piping Unit Friction Loss Gradient", Number(Number(ffVal).toFixed(3)), ffUnit, "-", "Darcy / Hazen-Williams", "Design Limit", false, "0.000");
  renderDataRow("2.8", "Piping Network Head Loss", calculatedData.frictionLossDisplay, calculatedData.headUnit, "-", "ΔH_pipe = Leff * (ff / 100)", "Calculated", true, "0.000");

  curRow++; // space

  // 3. Hydronic Head Requirements & TDH
  renderSectionHeader("3. PUMP HEAD REQUIREMENTS & TOTAL DYNAMIC HEAD (TDH)");
  renderDataRow("3.1", "Frictional Pipe Network Loss", calculatedData.frictionLossDisplay, calculatedData.headUnit, "-", "ΔH_friction", "Included", false, "0.000");
  renderDataRow("3.2", "Static Head / Elevation Lift", calculatedData.staticHeadDisplay, calculatedData.headUnit, "-", "H_static", "Included", false, "0.00");
  renderDataRow("3.3", "Residual Pressure at Critical Index Terminal", calculatedData.outletHeadDisplay, calculatedData.headUnit, "-", "H_outlet", "Included", false, "0.00");
  renderDataRow("3.4", "Available Suction Pressure (Deducted)", Number((-calculatedData.suctionHeadDisplay).toFixed(2)), calculatedData.headUnit, "-", "H_suction", "Credit", false, "0.00");
  renderDataRow("3.5", "Dynamic Engineering Safety Margin", calculatedData.sfPercent, "%", `+${calculatedData.sfPercent}% safety`, "Hydraulic Margin", "Applied", false, "0.0");
  renderDataRow("3.6", "Total Calculated Dynamic Head (TDH)", calculatedData.pumpHeadCalcDisplay, calculatedData.headUnit, "-", "(ΔH + H_stat + H_out - H_suc) * (1+SF)", "Calculated", true, "0.000");
  renderDataRow("3.7", "Selected Operating Pump Head", calculatedData.selectedHeadDisplay, calculatedData.headUnit, "-", "Pump Duty Point", "SELECTED", true, "0.000");

  curRow++; // space

  // 4. Motor Power & Electrical Sizing
  renderSectionHeader("4. PUMP SHAFT POWER & MOTOR SIZING");
  renderDataRow("4.1", "Pump Hydraulic Efficiency (η_pump)", calculatedData.effPumpVal, "%", "-", "Centrifugal Impeller", "Design Basis", false, "0.0");
  renderDataRow("4.2", "Electric Motor Efficiency (η_motor)", calculatedData.effMotorVal, "%", "-", "IE3 Premium Efficiency", "Design Basis", false, "0.0");
  renderDataRow("4.3", "Hydraulic Shaft Power (P_shaft)", Number(calculatedData.shaftPowerKw.toFixed(2)), "kW", "-", "P_shaft = (Q * H) / (1000 * η_pump)", "Calculated", true, "#,##0.00");
  renderDataRow("4.4", "Total Estimated Motor Input Power", Number(calculatedData.motorPowerKw.toFixed(2)), "kW", "-", "P_motor = P_shaft / η_motor", "Calculated", true, "#,##0.00");
  renderDataRow("4.5", "Motor Brake Horsepower (HP)", Number(calculatedData.motorPowerHp.toFixed(2)), "HP", "-", "1 kW = 1.34102 HP", "RECOMMENDED", true, "#,##0.00");

  // Gap before Reference Box
  curRow += 3;

  // Reference Block (Left side)
  const refStartRow = curRow;
  sheet.mergeCells(`A${refStartRow}:B${refStartRow}`);
  const refTitleCell = sheet.getCell(`A${refStartRow}`);
  refTitleCell.value = "Reference Standards:";
  refTitleCell.font = { ...boldFont, underline: true };

  sheet.mergeCells(`C${refStartRow}:F${refStartRow}`);
  sheet.getCell(`C${refStartRow}`).value = "1. ASHRAE Handbook - HVAC Systems & Equipment (Centrifugal Pumps & Hydronic Sizing)";
  sheet.getCell(`C${refStartRow}`).font = baseFont;

  sheet.mergeCells(`A${refStartRow + 1}:B${refStartRow + 1}`);
  sheet.mergeCells(`C${refStartRow + 1}:F${refStartRow + 1}`);
  sheet.getCell(`C${refStartRow + 1}`).value = "2. Hydraulic Institute Standards (HI 1.1-1.6 for Centrifugal Pumps)";
  sheet.getCell(`C${refStartRow + 1}`).font = baseFont;

  sheet.mergeCells(`A${refStartRow + 2}:B${refStartRow + 2}`);
  sheet.mergeCells(`C${refStartRow + 2}:F${refStartRow + 2}`);
  sheet.getCell(`C${refStartRow + 2}`).value = "3. CIBSE Guide Code W - Water Distribution Systems";
  sheet.getCell(`C${refStartRow + 2}`).font = baseFont;

  for (let r = refStartRow; r <= refStartRow + 2; r++) {
    sheet.getRow(r).height = 20;
    for (let c = 1; c <= 6; c++) {
      const cell = sheet.getCell(r, c);
      const topStyle = r === refStartRow ? "medium" : "thin";
      const bottomStyle = r === refStartRow + 2 ? "medium" : "thin";
      const leftStyle = c === 1 ? "medium" : "thin";
      const rightStyle = c === 6 ? "medium" : (c === 2 ? "medium" : "thin");
      setCellBorder(cell, topStyle, bottomStyle, leftStyle, rightStyle);
      cell.alignment = { vertical: "middle", indent: c === 1 ? 1 : 0 };
    }
  }

  // Gap before Signatures
  curRow = refStartRow + 5;

  // Signature Block (Columns A to H)
  const sigStartRow = curRow;
  sheet.getRow(sigStartRow).height = 24;

  sheet.mergeCells(`A${sigStartRow}:B${sigStartRow}`);
  sheet.getCell(`A${sigStartRow}`).value = "";

  sheet.mergeCells(`C${sigStartRow}:D${sigStartRow}`);
  sheet.getCell(`C${sigStartRow}`).value = "Originated by";
  sheet.getCell(`C${sigStartRow}`).font = boldFont;
  sheet.getCell(`C${sigStartRow}`).alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(`E${sigStartRow}:F${sigStartRow}`);
  sheet.getCell(`E${sigStartRow}`).value = "Reviewed by";
  sheet.getCell(`E${sigStartRow}`).font = boldFont;
  sheet.getCell(`E${sigStartRow}`).alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(`G${sigStartRow}:H${sigStartRow}`);
  sheet.getCell(`G${sigStartRow}`).value = "Approved by";
  sheet.getCell(`G${sigStartRow}`).font = boldFont;
  sheet.getCell(`G${sigStartRow}`).alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= 8; c++) {
    const cell = sheet.getCell(sigStartRow, c);
    cell.fill = peachFill;
    const leftStyle = c === 1 ? "medium" : "thin";
    const rightStyle = (c === 2 || c === 4 || c === 6 || c === 8) ? "medium" : "thin";
    setCellBorder(cell, "medium", "thin", leftStyle, rightStyle);
  }

  const {
    originatedName,
    originatedDate,
    reviewerName,
    reviewerDate,
    approverName,
    approverDate
  } = getSignatureBlockDetails(activeProj?.id || "default", "/chw-pump-head", meta.userName || "");

  // Name Row
  const nameRow = sigStartRow + 1;
  sheet.getRow(nameRow).height = 24;
  sheet.mergeCells(`A${nameRow}:B${nameRow}`);
  sheet.getCell(`A${nameRow}`).value = "Name:";
  sheet.getCell(`A${nameRow}`).font = boldFont;
  sheet.getCell(`A${nameRow}`).alignment = { horizontal: "right", vertical: "middle" };

  sheet.mergeCells(`C${nameRow}:D${nameRow}`);
  sheet.getCell(`C${nameRow}`).value = originatedName;
  sheet.getCell(`C${nameRow}`).font = baseFont;
  sheet.getCell(`C${nameRow}`).alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(`E${nameRow}:F${nameRow}`);
  sheet.getCell(`E${nameRow}`).value = reviewerName;
  sheet.getCell(`E${nameRow}`).font = baseFont;
  sheet.getCell(`E${nameRow}`).alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(`G${nameRow}:H${nameRow}`);
  sheet.getCell(`G${nameRow}`).value = approverName;
  sheet.getCell(`G${nameRow}`).font = baseFont;
  sheet.getCell(`G${nameRow}`).alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= 8; c++) {
    const cell = sheet.getCell(nameRow, c);
    const leftStyle = c === 1 ? "medium" : "thin";
    const rightStyle = (c === 2 || c === 4 || c === 6 || c === 8) ? "medium" : "thin";
    setCellBorder(cell, "thin", "thin", leftStyle, rightStyle);
  }

  // Date Row
  const dateRow = sigStartRow + 2;
  sheet.getRow(dateRow).height = 24;
  sheet.mergeCells(`A${dateRow}:B${dateRow}`);
  sheet.getCell(`A${dateRow}`).value = "Date:";
  sheet.getCell(`A${dateRow}`).font = boldFont;
  sheet.getCell(`A${dateRow}`).alignment = { horizontal: "right", vertical: "middle" };

  sheet.mergeCells(`C${dateRow}:D${dateRow}`);
  sheet.getCell(`C${dateRow}`).value = originatedDate;
  sheet.getCell(`C${dateRow}`).font = baseFont;
  sheet.getCell(`C${dateRow}`).alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(`E${dateRow}:F${dateRow}`);
  sheet.getCell(`E${dateRow}`).value = reviewerDate;
  sheet.getCell(`E${dateRow}`).font = baseFont;
  sheet.getCell(`E${dateRow}`).alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(`G${dateRow}:H${dateRow}`);
  sheet.getCell(`G${dateRow}`).value = approverDate;
  sheet.getCell(`G${dateRow}`).font = baseFont;
  sheet.getCell(`G${dateRow}`).alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= 8; c++) {
    const cell = sheet.getCell(dateRow, c);
    const leftStyle = c === 1 ? "medium" : "thin";
    const rightStyle = (c === 2 || c === 4 || c === 6 || c === 8) ? "medium" : "thin";
    setCellBorder(cell, "thin", "medium", leftStyle, rightStyle);
  }

  // Generate buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `CHW_Pump_Head_Calculation_${calcNo}.xlsx`;
  await downloadFile(new Uint8Array(buffer), filename, "Excel Document", ["xlsx"]);
};
