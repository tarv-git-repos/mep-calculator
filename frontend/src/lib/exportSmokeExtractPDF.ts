import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { toast } from "sonner";

export interface SmokeExtractPDFData {
  area: number;
  height: number;
  acph: number;
  fanQty: number;
  ductLength: number;
  frictionFactor: number;
  louverLoss: number;
  fanLoss: number;
  effMotor: number;
  effFan: number;
  numFansMotor: number;
  calculatedData: {
    volume: number;
    smokeExtractRate: number;
    flowEachLsRound: number;
    flowEachM3s: number;
    fittingsEqLen: number;
    totalEqLen: number;
    frictionLoss: number;
    totalHead: number;
    headRound: number;
    powerEach: number;
    powerEachRound: number;
    totalMotorPower: number;
  };
}

export const exportSmokeExtractPDF = async (
  data: SmokeExtractPDFData,
  unitSystem: "si" | "ip" = "si"
) => {
  let currentUserName = "Abubakar Chanda";
  let activeProjectId = "default";

  if (typeof window !== "undefined") {
    try {
      const user = JSON.parse(localStorage.getItem("mep_user") || "{}");
      currentUserName = user.name || "Abubakar Chanda";
      const ws = JSON.parse(localStorage.getItem("workspace-storage") || "{}");
      activeProjectId = ws.state?.activeProjectId || "default";
    } catch (e) {}
  }

  try {
    const activeProj: any = workspaceStore.getState()?.project || {};

    const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
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

    const calcNo = activeProj?.calcNo || "TRV-CALC-SEF-01";
    const today = formatDateStr(new Date().toISOString());
    const projectNo = activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = activeProj?.name || "Corridor Smoke Extract Fan Sizing";
    const clientName = activeProj?.client || "-";
    const endUser = activeProj?.endUser || activeProj?.location || "-";

    const isSI = unitSystem === "si";
    const primaryFill: [number, number, number] = [229, 231, 235]; // #E5E7EB
    const blueFill: [number, number, number] = [218, 233, 248];    // #DAE9F8

    // 1. Header Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Corridor Smoke Extract Fan Calculation", 14, 14);

    // 2. Metadata Block (182mm width)
    doc.setFontSize(9);
    doc.setLineWidth(0.3);
    doc.setDrawColor(100, 100, 100);
    doc.rect(14, 18, 182, 18);

    doc.line(105, 18, 105, 36);
    doc.line(14, 24, 196, 24);
    doc.line(14, 30, 196, 30);

    doc.setFont("helvetica", "bold");
    doc.text("Calculation No.:", 16, 22);
    doc.setFont("helvetica", "normal");
    doc.text(calcNo, 45, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", 107, 22);
    doc.setFont("helvetica", "normal");
    doc.text(today, 120, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Project No.:", 16, 28);
    doc.setFont("helvetica", "normal");
    doc.text(projectNo, 40, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Client:", 107, 28);
    doc.setFont("helvetica", "normal");
    doc.text(clientName, 120, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Project Name:", 16, 34);
    doc.setFont("helvetica", "normal");
    doc.text(projectName, 42, 34);

    doc.setFont("helvetica", "bold");
    doc.text("End User:", 107, 34);
    doc.setFont("helvetica", "normal");
    doc.text(endUser, 125, 34);

    const c = data.calculatedData;

    // Table 1: Design Input Parameters
    const inputRows = [
      [
        { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Design Parameter", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Engineering Basis / Remarks", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "Area of Corridor", `${data.area}`, isSI ? "m²" : "ft²", "Corridor floor footprint"],
      ["2", "Height of Corridor", `${data.height}`, isSI ? "m" : "ft", "Floor-to-ceiling clear smoke zone height"],
      ["3", "Air Changes per Hour (ACPH)", `${data.acph}`, "ACPH", "Per NFPA 92 / BS EN 12101 standards"],
      ["4", "Quantity of Operating Fans", `${data.fanQty}`, "No.", "Operating smoke extract fan count"],
      ["5", "Ducting Equivalent Route Length", `${data.ductLength}`, isSI ? "m" : "ft", "Physical duct run length"],
      ["6", "Duct Friction Gradient Factor", `${data.frictionFactor}`, isSI ? "Pa/m" : "in.wg/100ft", "Duct design friction rate"],
      ["7", "Louver & Grille Pressure Drop", `${data.louverLoss}`, isSI ? "Pa" : "in.wg", "Intake / discharge component head loss"],
      ["8", "Fan Internal & Casing Losses", `${data.fanLoss}`, isSI ? "Pa" : "in.wg", "Internal silencer, dampers & casing losses"],
      ["9", "Motor Efficiency", `${data.effMotor}%`, "%", "Nominal electric motor efficiency"],
      ["10", "Fan Aerodynamic Efficiency", `${data.effFan}%`, "%", "Fan impeller static efficiency"]
    ];

    callAutoTable(doc, {
      startY: 40,
      margin: { left: 14, right: 14 },
      body: inputRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, textColor: [20, 20, 20], lineColor: [200, 200, 200], lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 65, halign: "left" },
        2: { cellWidth: 25, halign: "center" },
        3: { cellWidth: 25, halign: "center" },
        4: { cellWidth: 57, halign: "left" }
      }
    });

    let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 105;

    // Table 2: Aerodynamic Sizing & Motor Power Results
    const flowPerFanStr = isSI ? `${c.flowEachLsRound} L/s (${c.flowEachM3s.toFixed(3)} m³/s)` : `${Math.round(c.flowEachLsRound * 2.11888)} CFM`;
    const totalExtractStr = isSI ? `${c.smokeExtractRate.toFixed(3)} m³/s` : `${Math.round(c.smokeExtractRate * 2118.88)} CFM`;
    const staticHeadStr = isSI ? `${c.headRound} Pa` : `${(c.headRound * 0.00401865).toFixed(3)} in.wg`;
    const motorPowerStr = isSI ? `${c.totalMotorPower.toFixed(2)} kW` : `${(c.totalMotorPower * 1.34102).toFixed(2)} HP (${c.totalMotorPower.toFixed(2)} kW)`;
    const powerEachStr = isSI ? `${c.powerEachRound.toFixed(2)} kW` : `${(c.powerEachRound * 1.34102).toFixed(2)} HP (${c.powerEachRound.toFixed(2)} kW)`;

    const resultRows = [
      [
        { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Calculated Engineering Metric", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Output Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Compliance & Safety Factor", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "Total Corridor Volume", `${c.volume.toFixed(1)}`, isSI ? "m³" : "ft³", "Gross enclosed volume"],
      ["2", "Total Required Smoke Extract", totalExtractStr, isSI ? "m³/s" : "CFM", "Total exhaust airflow capacity"],
      [
        { content: "3", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Sized Airflow per Fan (Operating)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: flowPerFanStr, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: isSI ? "L/s" : "CFM", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Rounded up to standard fan increment (5 L/s)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ],
      ["4", "Fittings Equivalent Length", isSI ? `${c.fittingsEqLen.toFixed(1)} m` : `${(c.fittingsEqLen * 3.28084).toFixed(1)} ft`, isSI ? "m" : "ft", "60% equivalent dynamic loss allowance"],
      ["5", "Total Equivalent Duct Run", isSI ? `${c.totalEqLen.toFixed(1)} m` : `${(c.totalEqLen * 3.28084).toFixed(1)} ft`, isSI ? "m" : "ft", "Straight duct + equivalent fittings"],
      ["6", "Ductwork Friction Pressure Loss", isSI ? `${c.frictionLoss.toFixed(1)} Pa` : `${(c.frictionLoss * 0.00401865).toFixed(3)} in.wg`, isSI ? "Pa" : "in.wg", "Calculated friction drop along route"],
      [
        { content: "7", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Total Fan Static External Head Loss", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: staticHeadStr, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: isSI ? "Pa" : "in.wg", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Includes +10% engineering margin, rounded to 10 Pa", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ],
      ["8", "Calculated Shaft Power per Fan", powerEachStr, isSI ? "kW" : "HP", "Net aerodynamic shaft horsepower"],
      [
        { content: "9", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Recommended Total Motor Rating", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: motorPowerStr, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: isSI ? "kW" : "HP", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Includes +10% electrical safety factor margin", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ]
    ];

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      body: resultRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, textColor: [20, 20, 20], lineColor: [200, 200, 200], lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 65, halign: "left" },
        2: { cellWidth: 35, halign: "center" },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 52, halign: "left" }
      }
    });

    currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 185;

    // Table 3: Detailed Step-by-Step Calculations
    const stepRows = [
      [
        { content: "Step", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Calculation Description & Governing Formula", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Substituted Calculation Values", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Calculated Result", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "Corridor Volume: V = Area × Height", `V = ${data.area} m² × ${data.height} m`, `${c.volume.toFixed(2)} m³`],
      ["2", "Smoke Extract Rate: Q = (V × ACPH) / 3600", `Q = (${c.volume.toFixed(2)} × ${data.acph}) / 3600`, `${c.smokeExtractRate.toFixed(3)} m³/s`],
      ["3", "Airflow per Fan: Q_fan = ceil((Q / N × 1000) / 5) * 5", `Q_fan = ceil((${c.smokeExtractRate.toFixed(3)} / ${data.fanQty} × 1000) / 5) * 5`, `${c.flowEachLsRound} L/s`],
      ["4", "Duct Friction Loss: ΔP = L_eq × FrictionFactor", `ΔP = ${c.totalEqLen.toFixed(1)} m × ${data.frictionFactor} Pa/m`, `${c.frictionLoss.toFixed(2)} Pa`],
      ["5", "Fan Static Head: H = ceil((ΔP + Louver + Fan) × 1.1, 10)", `H = ceil((${c.frictionLoss.toFixed(1)} + ${data.louverLoss} + ${data.fanLoss}) × 1.1)`, `${c.headRound} Pa`],
      ["6", "Fan Shaft Power: P = (Q × H) / (η_m × η_f × 1000)", `P = (${c.flowEachM3s.toFixed(4)} × ${c.headRound}) / (${data.effMotor / 100} × ${data.effFan / 100} × 1000)`, `${c.powerEachRound.toFixed(2)} kW`],
      ["7", "Total Motor Power: P_tot = P_fan × 1.1 × N_fans", `P_tot = ${c.powerEachRound.toFixed(2)} × 1.1 × ${data.numFansMotor}`, `${c.totalMotorPower.toFixed(2)} kW`]
    ];

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      body: stepRows,
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [20, 20, 20], lineColor: [200, 200, 200], lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 70, halign: "left" },
        2: { cellWidth: 72, halign: "left" },
        3: { cellWidth: 30, halign: "center" }
      }
    });

    currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 240;

    // Check page overflow for signature block
    if (currentY + 28 > 280) {
      doc.addPage();
      currentY = 20;
    }

    // 4. Standard 3-tier Signature Block (#FFE6CC header)
    const sig = getSignatureBlockDetails(
      activeProjectId,
      "/smoke-extract-fan",
      currentUserName,
      null
    );

    const sigFill: [number, number, number] = [255, 230, 204]; // #FFE6CC

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: [
        [
          { content: "", styles: { fillColor: sigFill, cellWidth: 32 } },
          { content: "Originator", styles: { halign: "center", fontStyle: "bold", fillColor: sigFill, textColor: [0, 0, 0] } },
          { content: "Reviewer", styles: { halign: "center", fontStyle: "bold", fillColor: sigFill, textColor: [0, 0, 0] } },
          { content: "Approver", styles: { halign: "center", fontStyle: "bold", fillColor: sigFill, textColor: [0, 0, 0] } }
        ]
      ],
      body: [
        [
          { content: "Name:", styles: { fontStyle: "bold", halign: "center", fillColor: [248, 250, 252] } },
          { content: sig.originatedName || currentUserName, styles: { halign: "center" } },
          { content: sig.reviewerName || "", styles: { halign: "center" } },
          { content: sig.approverName || "", styles: { halign: "center" } }
        ],
        [
          { content: "Date:", styles: { fontStyle: "bold", halign: "center", fillColor: [248, 250, 252] } },
          { content: sig.originatedDate || today, styles: { halign: "center" } },
          { content: sig.reviewerDate || "", styles: { halign: "center" } },
          { content: sig.approverDate || "", styles: { halign: "center" } }
        ]
      ],
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2.2, lineColor: [200, 200, 200], lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 50 },
        2: { cellWidth: 50 },
        3: { cellWidth: 50 }
      }
    });

    const safeProjCode = projectNo.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Corridor_Smoke_Extract_Fan_Calculation_${safeProjCode}.pdf`;
    const pdfBlob = doc.output("blob");
    downloadFile(pdfBlob, filename, "application/pdf");
    toast.success(`Exported calculation: ${filename}`);
  } catch (err) {
    console.error("Failed to export smoke extract fan PDF:", err);
    toast.error("Failed to generate PDF calculation.");
  }
};
