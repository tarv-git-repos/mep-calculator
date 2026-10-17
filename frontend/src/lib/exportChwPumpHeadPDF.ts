import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { workspaceStore } from "@/lib/workspace-store";
import { downloadFile } from "./download";
import { toast } from "sonner";
import {
  formatDateStr,
  getSignatureBlockDetails,
  getExporterUserName,
  addPdfHeader,
  addPdfSignatureBlock,
  addPdfFooter,
} from "@/lib/pdfHelpers";

export interface ChwPumpHeadPdfData {
  unitSystem: "si" | "ip";
  sizingParams: {
    flowRate: number | "";
    vertLength: number | "";
    horizLength: number | "";
    frictionFactor: number | "";
    staticHead: number | "";
    outletHead: number | "";
    suctionHead: number | "";
    effPump: number | "";
    effMotor: number | "";
    safetyMargin: number | "";
  };
  calculatedData: {
    flowRateDisplay: number;
    flowUnit: string;
    m3hFlow?: number;
    gpmFlow?: number;
    vertLengthDisplay: number;
    horizLengthDisplay: number;
    lengthUnit: string;
    elbowsLengthDisplay: number;
    valvesLengthDisplay: number;
    equivLengthDisplay: number;
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
    hydraulicPowerKw?: number;
    shaftPowerKw?: number;
    motorPowerKw: number;
    motorPowerHp: number;
    recMotorKw?: number;
    recMotorHp?: number;
    tdhMwg?: number;
    tdhKpa?: number;
    tdhPsi?: number;
    tdhFtwg?: number;
  };
  projectInfo?: {
    calcNumber?: string;
    projectNumber?: string;
    projectName?: string;
    client?: string;
    endUser?: string;
    date?: string;
  };
  meta?: {
    userName?: string;
  };
}

export const exportChwPumpHeadPDF = async (data: ChwPumpHeadPdfData) => {
  try {
    const doc = new jsPDF("p", "mm", "a4");
    const activeProj: any = workspaceStore.getState()?.project || {};

    const meta = data.meta || {};
    const projInfo = data.projectInfo || {};

    const calcNo = projInfo.calcNumber || activeProj?.calcNo || "CEC-MED-P539-202";
    const today = projInfo.date || formatDateStr(new Date().toISOString());
    const projectNo = projInfo.projectNumber || activeProj?.code || activeProj?.projectNo || "6767";
    const projectName = projInfo.projectName || activeProj?.name || activeProj?.projectName || "Dubai Mall";
    const clientName = projInfo.client || activeProj?.client || "6765";
    const endUser = projInfo.endUser || activeProj?.endUser || activeProj?.location || "hmbvm";

    const isIp = data.unitSystem === "ip";
    const calc = data.calculatedData;
    const params = data.sizingParams;

    const callAutoTable = (docInstance: any, options: any) => {
      if (typeof autoTable === "function") {
        autoTable(docInstance, options);
      } else if (typeof (autoTable as any)?.default === "function") {
        (autoTable as any).default(docInstance, options);
      } else if (typeof docInstance.autoTable === "function") {
        docInstance.autoTable(options);
      }
    };

    // 1. Header & Standard Metadata Box (Central Org Branding)
    const startY = addPdfHeader(doc, "Chilled Water Pump Head Calculation Report", {
      calcNo,
      date: today,
      projectNo,
      projectName,
      client: clientName,
      endUser
    });

    const flowLs = isIp ? (calc.flowRateDisplay * 3.78541) / 60 : calc.flowRateDisplay;
    const flowGpm = isIp ? calc.flowRateDisplay : (calc.flowRateDisplay * 60) / 3.78541;
    const flowM3h = calc.m3hFlow || (flowLs * 3.6);

    const straightPipeLen = calc.vertLengthDisplay + calc.horizLengthDisplay;
    const ff = params.frictionFactor || (isIp ? 1.77 : 0.4);
    const frictionRateStr = `${ff} ${isIp ? "psi/100ft" : "bar/100m"}`;

    const tdhBar = isIp ? calc.pumpHeadCalcDisplay * 0.0689476 : calc.pumpHeadCalcDisplay;
    const tdhMwg = calc.tdhMwg || (tdhBar * 10.1972);
    const tdhKpa = calc.tdhKpa || (tdhBar * 100);
    const tdhPsi = calc.tdhPsi || (tdhBar * 14.5038);

    const hydPower = calc.hydraulicPowerKw || (flowLs * tdhBar * 100) / 1000;
    const shaftPower = calc.shaftPowerKw || (hydPower / (calc.effPumpVal / 100));
    const motorPower = calc.motorPowerKw;
    const motorHp = calc.motorPowerHp;

    // 3. TABLE 1: DESIGN PARAMETERS & PIPING GEOMETRY
    const flowDetails = `${calc.flowRateDisplay.toFixed(2)} ${calc.flowUnit} (${isIp ? `${flowLs.toFixed(2)} L/s` : `${flowGpm.toFixed(1)} GPM`} | ${flowM3h.toFixed(2)} mÂ³/h)`;
    const table1Data = [
      [{ content: "Design Chilled Water Flow Rate (Q)", styles: { fontStyle: "normal" } }, { content: flowDetails, styles: { fontStyle: "bold" } }],
      [{ content: "Vertical Piping Rise / Elevation Length", styles: { fontStyle: "normal" } }, { content: `${calc.vertLengthDisplay.toFixed(1)} ${calc.lengthUnit}`, styles: { fontStyle: "normal" } }],
      [{ content: "Horizontal Piping Run Length", styles: { fontStyle: "normal" } }, { content: `${calc.horizLengthDisplay.toFixed(1)} ${calc.lengthUnit}`, styles: { fontStyle: "normal" } }],
      [{ content: "Total Straight Piping Run", styles: { fontStyle: "normal" } }, { content: `${straightPipeLen.toFixed(1)} ${calc.lengthUnit}`, styles: { fontStyle: "bold" } }],
      [{ content: "Fittings & Valves Allowance (+30% + 30%)", styles: { fontStyle: "normal" } }, { content: `${(calc.elbowsLengthDisplay + calc.valvesLengthDisplay).toFixed(1)} ${calc.lengthUnit} (+60% on straight run)`, styles: { fontStyle: "normal" } }],
      [{ content: "Total Design Equivalent Length (Leff)", styles: { fontStyle: "normal" } }, { content: `${calc.equivLengthDisplay.toFixed(1)} ${calc.lengthUnit} (incl. 5% safety margin)`, styles: { fontStyle: "bold" } }],
      [{ content: "Design Friction Loss Factor (Î”P/100m)", styles: { fontStyle: "normal" } }, { content: frictionRateStr, styles: { fontStyle: "normal" } }],
      [{ content: "Total Piping Dynamic Friction Loss Head", styles: { fontStyle: "normal" } }, { content: `${calc.frictionLossDisplay.toFixed(3)} ${calc.headUnit}`, styles: { fontStyle: "bold" } }]
    ];

    callAutoTable(doc, {
      startY: startY + 2,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
        lineColor: [100, 100, 100],
        lineWidth: 0.15,
        textColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [217, 217, 217],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
        fontSize: 9
      },
      head: [[{ content: "CHILLED WATER PUMP DESIGN PARAMETERS & PIPING GEOMETRY", colSpan: 2 }]],
      body: table1Data,
      columnStyles: {
        0: { cellWidth: 105 },
        1: { cellWidth: 77, halign: "center" }
      }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 5;

    // 4. TABLE 2: TOTAL DYNAMIC HEAD (TDH) & HYDRAULIC SIZING
    const netHeadVal = (calc.frictionLossDisplay + calc.staticHeadDisplay + calc.outletHeadDisplay - calc.suctionHeadDisplay).toFixed(3);
    const tdhDetails = `${calc.pumpHeadCalcDisplay.toFixed(3)} ${calc.headUnit} (${tdhMwg.toFixed(2)} mWG | ${tdhKpa.toFixed(1)} kPa | ${tdhPsi.toFixed(2)} psi)`;
    const table2Data = [
      [{ content: "Piping Friction Loss Head (Major + Minor)", styles: { fontStyle: "normal" } }, { content: `${calc.frictionLossDisplay.toFixed(3)} ${calc.headUnit}`, styles: { fontStyle: "normal" } }],
      [{ content: "Static Elevation Lift Head", styles: { fontStyle: "normal" } }, { content: `${calc.staticHeadDisplay.toFixed(2)} ${calc.headUnit}`, styles: { fontStyle: "normal" } }],
      [{ content: "Required Residual Terminal Pressure Head", styles: { fontStyle: "normal" } }, { content: `${calc.outletHeadDisplay.toFixed(2)} ${calc.headUnit}`, styles: { fontStyle: "normal" } }],
      [{ content: "Available Suction Pressure Head (Credit)", styles: { fontStyle: "normal" } }, { content: `-${calc.suctionHeadDisplay.toFixed(2)} ${calc.headUnit}`, styles: { fontStyle: "normal" } }],
      [{ content: "Calculated Net Hydraulic Sizing Head", styles: { fontStyle: "normal" } }, { content: `${netHeadVal} ${calc.headUnit}`, styles: { fontStyle: "normal" } }],
      [{ content: "Design Engineering Safety Margin", styles: { fontStyle: "normal" } }, { content: `+${calc.sfPercent}%`, styles: { fontStyle: "normal" } }],
      [{ content: "TOTAL DYNAMIC HEAD (TDH)", styles: { fontStyle: "bold" } }, { content: tdhDetails, styles: { fontStyle: "bold" } }]
    ];

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
        lineColor: [100, 100, 100],
        lineWidth: 0.15,
        textColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [217, 217, 217],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
        fontSize: 9
      },
      head: [[{ content: "TOTAL DYNAMIC HEAD (TDH) & HYDRAULIC SIZING BREAKDOWN", colSpan: 2 }]],
      body: table2Data,
      columnStyles: {
        0: { cellWidth: 105 },
        1: { cellWidth: 77, halign: "center" }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;

    // 5. TABLE 3: PUMP EFFICIENCY & MOTOR SIZING
    const table3Data = [
      [{ content: "Hydraulic Water Power (Phyd)", styles: { fontStyle: "normal" } }, { content: `${hydPower.toFixed(2)} kW`, styles: { fontStyle: "normal" } }],
      [{ content: "Pump Hydraulic Efficiency (Î·_pump)", styles: { fontStyle: "normal" } }, { content: `${calc.effPumpVal.toFixed(1)}%`, styles: { fontStyle: "normal" } }],
      [{ content: "Pump Shaft Brake Power (P_shaft)", styles: { fontStyle: "normal" } }, { content: `${shaftPower.toFixed(2)} kW`, styles: { fontStyle: "normal" } }],
      [{ content: "Electric Motor Efficiency (Î·_motor)", styles: { fontStyle: "normal" } }, { content: `${calc.effMotorVal.toFixed(1)}%`, styles: { fontStyle: "normal" } }],
      [{ content: "Calculated Motor Power Required", styles: { fontStyle: "normal" } }, { content: `${motorPower.toFixed(2)} kW (${motorHp.toFixed(2)} HP)`, styles: { fontStyle: "bold" } }]
    ];

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
        lineColor: [100, 100, 100],
        lineWidth: 0.15,
        textColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [217, 217, 217],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
        fontSize: 9
      },
      head: [[{ content: "PUMP EFFICIENCY & ELECTRICAL MOTOR SIZING (ISO / ASHRAE Standards)", colSpan: 2 }]],
      body: table3Data,
      columnStyles: {
        0: { cellWidth: 105 },
        1: { cellWidth: 77, halign: "center" }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    // 6. SELECTED DUTY HIGHLIGHT STRIP
    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
        lineColor: [100, 100, 100],
        lineWidth: 0.2,
        textColor: [0, 0, 0]
      },
      head: [],
      body: [
        [
          {
            content: "Selected CHW Pump Flow Rate (Q) & TDH",
            styles: { fontStyle: "bold", halign: "center", fillColor: [240, 240, 240] }
          },
          {
            content: `${calc.flowRateDisplay.toFixed(2)} ${calc.flowUnit} @ ${calc.pumpHeadCalcDisplay.toFixed(3)} ${calc.headUnit} (${tdhMwg.toFixed(2)} mWG) | Motor: ${motorPower.toFixed(2)} kW`,
            styles: { fontStyle: "bold", halign: "center" }
          }
        ]
      ],
      columnStyles: {
        0: { cellWidth: 95 },
        1: { cellWidth: 87 }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 7;

    // 7. SIGNATURE / APPROVAL BLOCK & Branding
    const currentUserName = getExporterUserName(meta.userName);
    const sigDetails = getSignatureBlockDetails(activeProj?.id || "default", "/chw-pump-head", currentUserName);
    addPdfSignatureBlock(doc, currentY, sigDetails, activeProj?.id || "default", "/chw-pump-head");

    // Add footer and page numbers across all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      addPdfFooter(doc, p, totalPages);
    }

    const pdfBuffer = doc.output("arraybuffer");
    const filename = `CHW_Pump_Head_Calculation_Report_${projectNo || "6767"}.pdf`;
    await downloadFile(new Uint8Array(pdfBuffer), filename, "PDF Document", ["pdf"]);
    toast.success("CHW Pump Head PDF report exported successfully!");
  } catch (error: any) {
    console.error("exportChwPumpHeadPDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
