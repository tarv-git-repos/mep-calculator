import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { toast } from "sonner";

export interface FirePumpPDFParams {
  fpFlow: number | string;
  fpPress: number | string;
  fpDisch: number | string;
  fpSuct: number | string;
  fpEff: number | string;
  fpSafetyMargin: number | string;
  driverType: "electric" | "diesel";
  jockeyFlowPct: number | string;
  jockeyPressureMargin: number | string;
}

export interface FirePumpPDFResults {
  Q_req: number;
  nearestStandardSize: number;
  P_req: number;
  dischLoss: number;
  suctHeadFt: number;
  suctPsi: number;
  eff: number;
  margin: number;
  ratedHeadPsi: number;
  ratedHeadBar: number;
  ratedHeadM: number;
  churnPsi: number;
  churnBar: number;
  peakFlowGpm: number;
  peakFlowLps: number;
  peakHeadPsi: number;
  peakHeadBar: number;
  whp: number;
  brakeHp: number;
  brakeKw: number;
  peakBrakeHp: number;
  selectedMotorHp: number;
  selectedMotorKw: number;
  motorFullLoadAmps: number;
  motorStartingAmpsDOL: number;
  motorStartingAmpsStarDelta: number;
  jockeyFlowGpm: number;
  jockeyFlowLps: number;
  jockeyCutOutPsi: number;
  jockeyCutInPsi: number;
  mainFirePumpCutInPsi: number;
  pipeSizes: {
    suctionIn: number;
    dischargeIn: number;
    reliefIn: number;
    flowMeterIn: number;
    testHeaderIn: number;
  };
  isHighChurn: boolean;
  isCavitationRisk: boolean;
  isHighSystemDemand: boolean;
}

export interface ProjectMetaData {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
  reviewState?: any;
}

export const exportFirePumpDutyPDF = async (
  params: FirePumpPDFParams,
  results: FirePumpPDFResults,
  unitSystem: "ip" | "si" = "ip",
  meta: ProjectMetaData = {}
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

    const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
    // A4 Portrait Mode matching Ventilation PDF
    const doc = new JsPDFClass("portrait", "mm", "a4");

    const callAutoTable = (pdfDoc: any, options: any) => {
      if (typeof autoTable === "function") {
        autoTable(pdfDoc, options);
      } else if (typeof (autoTable as any)?.default === "function") {
        (autoTable as any).default(pdfDoc, options);
      } else if (typeof pdfDoc.autoTable === "function") {
        pdfDoc.autoTable(options);
      } else {
        console.error("autoTable function not available");
      }
    };

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-FPD-R01";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "";
    const clientName = meta.client || activeProj?.client || "";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "";

    // 1. Header & Standard Metadata Box (Central Org Branding)
    const startY = addPdfHeader(doc, "Fire Pump Duty Calculation Report", {
      calcNo,
      date: today,
      projectNo,
      projectName,
      client: clientName,
      endUser
    });

    const primaryFill = [217, 217, 217] as [number, number, number]; // Standard header grey
    const blueFill = [218, 233, 248] as [number, number, number]; // Highlight soft blue

    const isSI = unitSystem === "si";

    // Table 1: Design Parameters & Operating Inputs
    const paramsBody = [
      [
        "1",
        "Design Required Flow Rate",
        isSI
          ? `${(results.Q_req * 0.06309).toFixed(1)} L/s (${(results.Q_req * 3.78541).toFixed(0)} L/min)`
          : `${results.Q_req} GPM`,
        "Hydraulic Demand Calculation",
        "NFPA 13 / 14",
      ],
      [
        "2",
        "NFPA Standard Rated Pump Size",
        isSI
          ? `${(results.nearestStandardSize * 0.06309).toFixed(1)} L/s (${(results.nearestStandardSize * 3.78541).toFixed(0)} L/min)`
          : `${results.nearestStandardSize} GPM`,
        "Nearest NFPA 20 Table 4.8.2 Rating",
        "NFPA 20 Clause 4.8.2",
      ],
      [
        "3",
        "System Demand Pressure",
        isSI ? `${(results.P_req * 0.0689476).toFixed(2)} bar (${(results.P_req * 6.89476).toFixed(0)} kPa)` : `${results.P_req} psi`,
        "Most Remote System Demand Pressure",
        "NFPA 13 / 14",
      ],
      [
        "4",
        "Discharge Piping Loss",
        isSI ? `${(results.dischLoss * 0.0689476).toFixed(2)} bar` : `${results.dischLoss} psi`,
        "Valves, fittings & backflow friction loss",
        "NFPA 20",
      ],
      [
        "5",
        "Available Suction Static Head",
        isSI ? `${(results.suctHeadFt * 0.3048).toFixed(2)} m (${(results.suctPsi * 0.0689476).toFixed(2)} bar)` : `${results.suctHeadFt} ft (${results.suctPsi.toFixed(1)} psi)`,
        "Suction tank water level above pump CL",
        "NFPA 20 Clause 4.14",
      ],
      [
        "6",
        "Head Safety Margin",
        isSI ? `${(results.margin * 0.0689476).toFixed(2)} bar` : `${results.margin} psi`,
        "Design contingency head allowance",
        "Engineering Practice",
      ],
      [
        "7",
        "Pump Efficiency (%)",
        `${(results.eff * 100).toFixed(0)}%`,
        "Rated operating point pump efficiency",
        "Manufacturer Data",
      ],
      [
        "8",
        "Driver Type",
        params.driverType === "electric" ? "Electric Motor Driven" : "Diesel Engine Driven",
        params.driverType === "electric" ? "3-Phase Electric Induction Motor" : "Stationary Diesel Engine Driver",
        params.driverType === "electric" ? "NFPA 20 Chapter 9" : "NFPA 20 Chapter 11",
      ],
    ];

    callAutoTable(doc, {
      startY: startY + 2,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 1.8, bottom: 1.8, left: 1, right: 1 },
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
      },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 52, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 42, fontStyle: "bold" },
        3: { cellWidth: 48, halign: "left" },
        4: { cellWidth: 32 },
      },
      head: [
        [
          { content: "Sr." },
          { content: "Input Parameter" },
          { content: "Design Value" },
          { content: "Design Note" },
          { content: "Standard / Code" },
        ],
      ],
      body: paramsBody,
    });

    const finalY1 = (doc as any).lastAutoTable?.finalY ?? 95;

    // Table 2: Calculated Pump Duty & Driver Sizing Results
    const resultsBody = [
      [
        "1",
        "Rated Duty Point (100% Flow)",
        isSI
          ? `${(results.nearestStandardSize * 0.06309).toFixed(1)} L/s @ ${results.ratedHeadBar.toFixed(2)} bar (${results.ratedHeadM.toFixed(1)} m)`
          : `${results.nearestStandardSize} GPM @ ${results.ratedHeadPsi.toFixed(1)} psi`,
        "Primary Rated Operating Condition",
        "NFPA 20 Standard Rating",
      ],
      [
        "2",
        "Churn Pressure (0% Flow / Shutoff)",
        isSI ? `${results.churnBar.toFixed(2)} bar` : `${results.churnPsi.toFixed(1)} psi`,
        "140% of Rated Head (Max Allowable)",
        results.isHighChurn ? "Warning: >250 psi (PRV Required)" : "Compliant (< 140%)",
      ],
      [
        "3",
        "Peak Flow Point (150% Flow)",
        isSI
          ? `${(results.peakFlowGpm * 0.06309).toFixed(1)} L/s @ ${results.peakHeadBar.toFixed(2)} bar`
          : `${results.peakFlowGpm.toFixed(0)} GPM @ ${results.peakHeadPsi.toFixed(1)} psi`,
        "Min 65% of Rated Head Capability",
        "NFPA 20 Clause 4.7.6",
      ],
      [
        "4",
        "Hydraulic Power (WHP)",
        `${results.whp.toFixed(1)} WHP (${(results.whp * 0.7457).toFixed(1)} kW)`,
        "Theoretical Water Horsepower",
        "WHP = (Q × H) / 1714",
      ],
      [
        "5",
        "Brake Horsepower @ Rated Duty (BHP)",
        `${results.brakeHp.toFixed(1)} BHP (${results.brakeKw.toFixed(1)} kW)`,
        "Shaft Power Demand at 100% Flow",
        "BHP = WHP / Efficiency",
      ],
      [
        "6",
        "Peak Brake Horsepower @ 150% Curve",
        `${results.peakBrakeHp.toFixed(1)} BHP (${(results.peakBrakeHp * 0.7457).toFixed(1)} kW)`,
        "Maximum Non-Overloading Curve Power",
        "NFPA 20 Driver Sizing",
      ],
      [
        "7",
        "Selected Motor / Driver Rating",
        `${results.selectedMotorHp} HP (${results.selectedMotorKw.toFixed(1)} kW)`,
        "Standard Selected Driver Frame Size",
        "Non-Overloading Compliant",
      ],
      [
        "8",
        "Electrical Rating (400V 3-Ph)",
        `FLA: ${results.motorFullLoadAmps.toFixed(1)} A | DOL Start: ${results.motorStartingAmpsDOL.toFixed(0)} A`,
        `Star-Delta Start: ${results.motorStartingAmpsStarDelta.toFixed(0)} A`,
        "NFPA 20 Electric Controller",
      ],
      [
        "9",
        "Recommended Pipe Diameters",
        `Suction: ${results.pipeSizes.suctionIn}" | Discharge: ${results.pipeSizes.dischargeIn}"`,
        `Relief Line: ${results.pipeSizes.reliefIn}" | Meter: ${(results.pipeSizes as any).meterIn || results.pipeSizes.reliefIn}"`,
        "NFPA 20 Table 4.27",
      ],
    ];

    callAutoTable(doc, {
      startY: finalY1 + 4,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 1.8, bottom: 1.8, left: 1, right: 1 },
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
      },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 52, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 52, fontStyle: "bold" },
        3: { cellWidth: 42, halign: "left" },
        4: { cellWidth: 28 },
      },
      head: [
        [
          { content: "Sr." },
          { content: "Performance Output" },
          { content: "Calculated Value" },
          { content: "Engineering Note" },
          { content: "Compliance" },
        ],
      ],
      body: resultsBody,
      didParseCell: function (data: any) {
        if (data.section === "body") {
          // Soft blue highlight on key Rated Duty Point (row 0) and Selected Motor (row 6)
          if (data.row.index === 0 || data.row.index === 6) {
            if (data.column.index === 2) {
              data.cell.styles.fillColor = blueFill;
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      },
    });

    const finalY2 = (doc as any).lastAutoTable?.finalY ?? 170;

    // Table 3: Jockey Pump & Pressure Switch Settings Ladder
    const ladderBody = [
      [
        "1",
        "Jockey Pump Flow Capacity",
        isSI
          ? `${(results.jockeyFlowGpm * 0.06309).toFixed(2)} L/s (${(results.jockeyFlowGpm * 3.78541).toFixed(1)} L/min)`
          : `${results.jockeyFlowGpm.toFixed(1)} GPM`,
        `${params.jockeyFlowPct}% of main pump rated flow`,
        "NFPA 20 Chapter 5",
      ],
      [
        "2",
        "Jockey Pump Stop (Cut-Out)",
        isSI ? `${(results.jockeyCutOutPsi * 0.0689476).toFixed(2)} bar` : `${results.jockeyCutOutPsi.toFixed(0)} psi`,
        "Churn Pressure + Available Suction Pressure",
        "Top of Pressure Ladder",
      ],
      [
        "3",
        "Jockey Pump Start (Cut-In)",
        isSI ? `${(results.jockeyCutInPsi * 0.0689476).toFixed(2)} bar` : `${results.jockeyCutInPsi.toFixed(0)} psi`,
        "Rated Head + Suction Pressure - Margin",
        "System Pressure Maintenance",
      ],
      [
        "4",
        "Main Fire Pump Start (Cut-In)",
        isSI ? `${(results.mainFirePumpCutInPsi * 0.0689476).toFixed(2)} bar` : `${results.mainFirePumpCutInPsi.toFixed(0)} psi`,
        "Jockey Start - 10 psi margin (Automatic Start)",
        "NFPA 20 Clause 10.5.2.1",
      ],
    ];

    callAutoTable(doc, {
      startY: finalY2 + 4,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 1.8, bottom: 1.8, left: 1, right: 1 },
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
      },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 52, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 42, fontStyle: "bold" },
        3: { cellWidth: 48, halign: "left" },
        4: { cellWidth: 32 },
      },
      head: [
        [
          { content: "Sr." },
          { content: "Pressure Switch Ladder Setting" },
          { content: "Set Point" },
          { content: "Ladder Logic" },
          { content: "NFPA 20 Reference" },
        ],
      ],
      body: ladderBody,
    });

    const finalY3 = (doc as any).lastAutoTable?.finalY ?? 220;

    // Engineering 3-Tier Signature Block matching Ventilation PDF standard
    let userName =
      meta.userName ||
      (typeof window !== "undefined" ? (window as any).currentMepUserName : undefined) ||
      currentUserName;

    const {
      originatedName,
      originatedDate,
      reviewerName,
      reviewerDate,
      approverName,
      approverDate,
    } = getSignatureBlockDetails(
      activeProj?.id || "default",
      "/plumbing-fire-pump-duty",
      userName,
      meta.reviewState
    );

    // Engineering 3-Tier Signature Block & Branding
    addPdfSignatureBlock(doc, finalY3 + 6, sigDetails, activeProj?.id || "default", "/plumbing-fire-pump-duty");

    // Add footer and page numbers across all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      addPdfFooter(doc, p, totalPages);
    }

    const pdfBuffer = doc.output("arraybuffer");
    await downloadFile(
      new Uint8Array(pdfBuffer),
      `Fire_Pump_Duty_Report_${projectNo}.pdf`,
      "PDF Document",
      ["pdf"]
    );
    toast.success("Fire Pump Duty PDF exported successfully!");
  } catch (error: any) {
    console.error("exportFirePumpDutyPDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
