import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  Download, Upload, Sparkles, AlertTriangle, CheckCircle2,
  Info, Gauge, FileText, Printer, FileSpreadsheet, Bookmark, HelpCircle, Wrench, Plus, Minus
} from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/chw-pump-head")({
  head: () => ({
    meta: [
      { title: "CHW Pump Head — MEP Calc" },
      { name: "description", content: "Chilled water pump head loss sizer based on pipe friction, fittings losses, and static elevation." },
    ],
  }),
  component: ChwPumpHeadPage,
});

function ChwPumpHeadPage() {
  const [projectInfo, setProjectInfo] = useState({
    projectName: "Commercial Tower CHW Pumping Study",
    projectNumber: "MEP-CHW-02",
    client: "Summit Estates Ltd",
    consultant: "Consistent Engineering Consultants",
    date: new Date().toISOString().split("T")[0],
    revision: "Rev 0",
    calcNumber: "CALC-HVAC-PMP02",
    notes: "Chilled water secondary circulation loop pump head and fittings loss calculation report.",
  });

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

  // State matching the calculation variables
  const [sizingParams, setSizingParams] = useState({
    flowUsgpm: "" as number | "",
    flowLps: "" as number | "",
    vertLength: "" as number | "",
    horizLength: "" as number | "",
    frictionFactor: "" as number | "",
    staticHead: "" as number | "",
    residualPressure: "" as number | "",
    suctionPressure: "" as number | "",
    safetyFactorHead: 5, // %
    selectedHead: "" as number | "", // bar or psi (override)
    effMotor: 85, // %
    effPump: 70, // %
  });

  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [showFormulaPanel, setShowFormulaPanel] = useState(false);

  // Load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("chw_pump_sizer_v2_params");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sizingParams) setSizingParams(parsed.sizingParams);
        if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const saveParams = (params: typeof sizingParams, unit: "si" | "ip", proj: typeof projectInfo) => {
    setSizingParams(params);
    setUnitSystem(unit);
    if ((window as any).__mep_keep_values) return;
    setProjectInfo(proj);
    try {
      localStorage.setItem("chw_pump_sizer_v2_params", JSON.stringify({ sizingParams: params, unitSystem: unit, projectInfo: proj }));
    } catch (e) {
      console.error(e);
    }
  };

  // Convert values when unit system changes
  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;

    const nextParams = { ...sizingParams };

    if (unit === "ip") {
      // SI -> IP
      nextParams.vertLength = Number((sizingParams.vertLength * 3.28084).toFixed(1));
      nextParams.horizLength = Number((sizingParams.horizLength * 3.28084).toFixed(1));
      nextParams.frictionFactor = Number((sizingParams.frictionFactor * 4.4207).toFixed(3));
      nextParams.staticHead = Number((sizingParams.staticHead * 14.50377).toFixed(2));
      nextParams.residualPressure = Number((sizingParams.residualPressure * 14.50377).toFixed(2));
      nextParams.suctionPressure = Number((sizingParams.suctionPressure * 14.50377).toFixed(2));
      if (sizingParams.selectedHead > 0) {
        nextParams.selectedHead = Number((sizingParams.selectedHead * 14.50377).toFixed(2));
      }
    } else {
      // IP -> SI
      nextParams.vertLength = Number((sizingParams.vertLength / 3.28084).toFixed(1));
      nextParams.horizLength = Number((sizingParams.horizLength / 3.28084).toFixed(1));
      nextParams.frictionFactor = Number((sizingParams.frictionFactor / 4.4207).toFixed(3));
      nextParams.staticHead = Number((sizingParams.staticHead / 14.50377).toFixed(2));
      nextParams.residualPressure = Number((sizingParams.residualPressure / 14.50377).toFixed(2));
      nextParams.suctionPressure = Number((sizingParams.suctionPressure / 14.50377).toFixed(2));
      if (sizingParams.selectedHead > 0) {
        nextParams.selectedHead = Number((sizingParams.selectedHead / 14.50377).toFixed(2));
      }
    }

    saveParams(nextParams, unit, projectInfo);
  };

  // Calculations matching original exact website calcFpump logic
  const calculatedData = useMemo(() => {
    const ip = unitSystem === "ip";
    
    const flowGpm = sizingParams.flowUsgpm !== "" ? Number(sizingParams.flowUsgpm) : (ip ? 500 : 500);
    const vertL = sizingParams.vertLength !== "" ? Number(sizingParams.vertLength) : (ip ? 100 : 30);
    const horizL = sizingParams.horizLength !== "" ? Number(sizingParams.horizLength) : (ip ? 400 : 120);
    const ff = sizingParams.frictionFactor !== "" ? Number(sizingParams.frictionFactor) : (ip ? 1.77 : 0.4);
    const statH = sizingParams.staticHead !== "" ? Number(sizingParams.staticHead) : (ip ? 43.5 : 3.0);
    const resP = sizingParams.residualPressure !== "" ? Number(sizingParams.residualPressure) : (ip ? 29 : 2.0);
    const sucP = sizingParams.suctionPressure !== "" ? Number(sizingParams.suctionPressure) : 0.0;

    // Normalized internal calculation values in Metric base (m, bar, L/s)
    const L_vert_m = ip ? vertL / 3.28084 : vertL;
    const L_horiz_m = ip ? horizL / 3.28084 : horizL;
    const Q_flow = (flowGpm * 3.78) / 60; // L/s

    // Elbows & Reducers and Isolation Valves calculated dynamically: (vertical + horizontal) * 0.3
    const L_elbows_m = (L_vert_m + L_horiz_m) * 0.3;
    const L_valves_m = (L_vert_m + L_horiz_m) * 0.3;

    // Safety factor for equivalent length is 5%
    const L_sum_m = L_vert_m + L_horiz_m + L_elbows_m + L_valves_m;
    const L_equiv_m = Math.ceil((L_sum_m * 1.05) / 10) * 10;

    const ff_metric = ip ? ff / 4.4207 : ff;
    const H_loss_bar = L_equiv_m * (ff_metric / 100);

    const H_static_bar = ip ? statH / 14.50377 : statH;
    const H_outlet_bar = ip ? resP / 14.50377 : resP;
    const H_suction_bar = ip ? sucP / 14.50377 : sucP;

    const H_pump_calc_bar = Math.max(0, (H_loss_bar + H_static_bar + H_outlet_bar) - H_suction_bar) * (1 + sizingParams.safetyFactorHead / 100);

    // Selected Head
    const rawSelected = Number(sizingParams.selectedHead) || 0;
    const H_selected_bar = rawSelected > 0 
      ? (ip ? rawSelected / 14.50377 : rawSelected) 
      : H_pump_calc_bar;

    const F_flow = Q_flow; // kg/s (assuming water density = 1)
    const L_lift_kpa = H_selected_bar * 100; // kPa

    const eff_pump = sizingParams.effPump / 100;
    const eff_motor = sizingParams.effMotor / 100;

    // Shaft Power = (Flow * Head Lift) / (1000 * Pump Efficiency)
    const P_shaft_kw = (F_flow * L_lift_kpa) / (1000 * eff_pump);
    const P_motor_kw = P_shaft_kw / eff_motor;
    const HP = P_motor_kw * 1.34102;

    // Convert display outputs based on unit system
    const displayLengthUnit = ip ? "ft" : "m";
    const displayHeadUnit = ip ? "psi" : "bar";
    const displayFlowUnit = ip ? "GPM" : "L/s";

    const toDisplayLength = (m: number) => ip ? m * 3.28084 : m;
    const toDisplayHead = (bar: number) => ip ? bar * 14.50377 : bar;
    const toDisplayFlow = (lps: number) => ip ? lps * 15.8503 : lps;

    return {
      flowRate: Q_flow,
      flowRateDisplay: ip ? sizingParams.flowUsgpm : toDisplayFlow(Q_flow),
      sumLengthsDisplay: toDisplayLength(L_sum_m),
      equivLengthDisplay: toDisplayLength(L_equiv_m),
      elbowsLengthDisplay: toDisplayLength(L_elbows_m),
      valvesLengthDisplay: toDisplayLength(L_valves_m),
      vertLengthDisplay: toDisplayLength(L_vert_m),
      horizLengthDisplay: toDisplayLength(L_horiz_m),
      frictionLossDisplay: toDisplayHead(H_loss_bar),
      staticHeadDisplay: toDisplayHead(H_static_bar),
      residualPressureDisplay: toDisplayHead(H_outlet_bar),
      outletHeadDisplay: toDisplayHead(H_outlet_bar),
      suctionPressureDisplay: toDisplayHead(H_suction_bar),
      suctionHeadDisplay: toDisplayHead(H_suction_bar),
      pumpHeadCalcDisplay: toDisplayHead(H_pump_calc_bar),
      pumpHeadSelectedDisplay: toDisplayHead(H_selected_bar),
      selectedHeadDisplay: toDisplayHead(H_selected_bar),
      massFlow: F_flow,
      liftKpa: L_lift_kpa,
      shaftPowerKw: P_shaft_kw,
      motorPowerKw: P_motor_kw,
      motorPowerHp: HP,
      lengthUnit: displayLengthUnit,
      headUnit: displayHeadUnit,
      flowUnit: displayFlowUnit,
    };
  }, [sizingParams, unitSystem]);

  // Actions
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ projectInfo, sizingParams, unitSystem }));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${projectInfo.projectName.replace(/\s+/g, "_")}_chw_pump_head.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
        if (parsed.sizingParams) setSizingParams(parsed.sizingParams);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Pump Head");

    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 10;
    sheet.getColumn(4).width = 30;
    sheet.getColumn(5).width = 45;

    sheet.mergeCells("A1:E1");
    const cellA1 = sheet.getCell("A1");
    cellA1.value = "CHW PUMP HEAD REPORT";
    cellA1.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFF" } };
    cellA1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EF4444" } }; // Crimson Red for Fire/Pump Head
    cellA1.alignment = { horizontal: "center" };

    sheet.addRow([]);
    sheet.addRow(["Project Information"]);
    sheet.getCell("A3").font = { name: "Segoe UI", size: 12, bold: true };
    sheet.addRow(["Project Name", projectInfo.projectName]);
    sheet.addRow(["Project Number", projectInfo.projectNumber]);
    sheet.addRow(["Consultant", projectInfo.consultant]);
    sheet.addRow(["Client", projectInfo.client]);

    sheet.addRow([]);
    sheet.addRow(["Sizing parameters"]);
    sheet.getCell("A9").font = { name: "Segoe UI", size: 12, bold: true };
    sheet.addRow(["Flow Rate", `${calculatedData.flowRateDisplay.toFixed(2)} ${calculatedData.flowUnit}`]);
    sheet.addRow(["Vertical Length", `${calculatedData.vertLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`]);
    sheet.addRow(["Horizontal Length", `${calculatedData.horizLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`]);
    sheet.addRow(["Friction Factor", `${sizingParams.frictionFactor} ${unitSystem === "ip" ? "psi/100ft" : "bar/100m"}`]);

    sheet.addRow([]);
    sheet.addRow(["Sizing Results"]);
    sheet.getCell("A15").font = { name: "Segoe UI", size: 12, bold: true };
    sheet.addRow(["Sum of component lengths", `${calculatedData.sumLengthsDisplay.toFixed(1)} ${calculatedData.lengthUnit}`]);
    sheet.addRow(["Total equivalent length", `${calculatedData.equivLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`]);
    sheet.addRow(["Major + Minor Friction Losses", `${calculatedData.frictionLossDisplay.toFixed(3)} ${calculatedData.headUnit}`]);
    sheet.addRow(["Static lift", `${calculatedData.staticHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`]);
    sheet.addRow(["Residual Outlet Pressure", `${calculatedData.outletHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`]);
    sheet.addRow(["Suction pressure deducted", `${calculatedData.suctionHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`]);
    sheet.addRow(["Total calculated head", `${calculatedData.pumpHeadCalcDisplay.toFixed(3)} ${calculatedData.headUnit}`]);
    sheet.addRow(["Motor Power Requirement", `${calculatedData.motorPowerKw.toFixed(2)} kW / ${calculatedData.motorPowerHp.toFixed(2)} HP`]);

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${projectInfo.projectName.replace(/\s+/g, "_")}_pump_head_report.xlsx`);
  };

  const handlePrintPDF = () => {
    const doc = new jsPDF("p", "pt", "a4");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("PUMP HEAD CALCULATION REPORT", 40, 50);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated on: ${projectInfo.date} | Calculation Code: ${projectInfo.calcNumber}`, 40, 68);

    doc.setDrawColor(200);
    doc.line(40, 75, 550, 75);

    // Project details
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("1. Project Details", 40, 95);

    const projectData = [
      ["Project Name", projectInfo.projectName, "Project Number", projectInfo.projectNumber],
      ["Consultant", projectInfo.consultant, "Client", projectInfo.client],
      ["Revision", projectInfo.revision, "Calculation Ref", projectInfo.calcNumber],
    ];

    autoTable(doc, {
      startY: 105,
      head: [],
      body: projectData,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 90 },
        1: { cellWidth: 170 },
        2: { fontStyle: "bold", cellWidth: 90 },
        3: { cellWidth: 170 },
      },
    });

    // Inputs & Parameters
    doc.setFont("helvetica", "bold");
    doc.text("2. Design Sizing Parameters", 40, (doc as any).lastAutoTable.finalY + 20);

    const paramData = [
      ["Design Flow Rate", `${calculatedData.flowRateDisplay.toFixed(2)} ${calculatedData.flowUnit}`, "Vertical Pipe Length", `${calculatedData.vertLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`],
      ["Horizontal Pipe Length", `${calculatedData.horizLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`, "Design Friction Factor", `${sizingParams.frictionFactor} ${unitSystem === "ip" ? "psi/100ft" : "bar/100m"}`],
      ["Static Elevation Head", `${calculatedData.staticHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`, "Residual Pressure at Outlet", `${calculatedData.outletHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
      ["Suction Pressure (Available)", `${calculatedData.suctionHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`, "Safety Margin applied", `${sizingParams.safetyFactorHead}%`],
    ];

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 30,
      head: [],
      body: paramData,
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 3.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 130 },
        1: { cellWidth: 120 },
        2: { fontStyle: "bold", cellWidth: 130 },
        3: { cellWidth: 120 },
      },
    });

    // Results summary
    doc.setFont("helvetica", "bold");
    doc.text("3. Friction and Equivalent Length Breakdown", 40, (doc as any).lastAutoTable.finalY + 20);

    const breakdownData = [
      ["Vertical + Horizontal length sum", `${calculatedData.vertLengthDisplay.toFixed(1)} + ${calculatedData.horizLengthDisplay.toFixed(1)} = ${(calculatedData.vertLengthDisplay + calculatedData.horizLengthDisplay).toFixed(1)} ${calculatedData.lengthUnit}`],
      ["Fittings equivalent allowance", `Elbows: ${calculatedData.elbowsLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit} | Valves: ${calculatedData.valvesLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`],
      ["Total design equivalent length", `${calculatedData.equivLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`],
      ["Major + Minor Friction losses", `${calculatedData.frictionLossDisplay.toFixed(3)} ${calculatedData.headUnit}`],
    ];

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 30,
      head: [],
      body: breakdownData,
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: 3.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 180 },
        1: { cellWidth: 320 },
      },
    });

    doc.setFont("helvetica", "bold");
    doc.text("4. Head & Motor Selection Sizing Results", 40, (doc as any).lastAutoTable.finalY + 20);

    const resultsData = [
      ["Piping Friction Loss head", `${calculatedData.frictionLossDisplay.toFixed(3)} ${calculatedData.headUnit}`],
      ["Static Elevation Head lift", `${calculatedData.staticHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
      ["Residual pressure required", `${calculatedData.outletHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
      ["Suction pressure deducted", `-${calculatedData.suctionHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
      ["Total dynamic Head (TDH)", `${calculatedData.pumpHeadCalcDisplay.toFixed(3)} ${calculatedData.headUnit}`],
      ["Estimated motor power required", `${calculatedData.motorPowerKw.toFixed(2)} kW (${calculatedData.motorPowerHp.toFixed(2)} HP)`],
    ];

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 30,
      head: [],
      body: resultsData,
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 3.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 180 },
        1: { cellWidth: 320 },
      },
    });

    const pdfBuffer = doc.output("arraybuffer");
    downloadFile(new Uint8Array(pdfBuffer), `${projectInfo.projectName.replace(/\s+/g, "_")}_report.pdf`, "PDF Document", ["pdf"]);
  };

  return (
    <AppShell title="CHW Pump Head" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print px-6">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; CHW PUMP HEAD</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground font-sans">Pump Head</h1>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Determine volumetric water requirements, dynamic piping losses, safety margin, and total dynamic head to size the pump motor.
              </p>
            </div>
          </div>

          {/* Core Layout Card */}
          <div className="mx-6 mb-6 bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden">
            
            {/* Tab selection row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/60">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  onClick={() => setActiveTab("calculator")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "calculator"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sizing Calculator
                </button>
                <button
                  onClick={() => setActiveTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "report"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Printable Report
                </button>
              </div>

              {/* Sizing Unit system toggle */}
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  onClick={() => handleUnitSystemChange("ip")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    unitSystem === "ip"
                      ? "bg-background text-primary shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Imperial (IP)
                </button>
                <button
                  onClick={() => handleUnitSystemChange("si")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    unitSystem === "si"
                      ? "bg-background text-primary shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Metric (SI)
                </button>
              </div>
            </div>

            {/* Content view */}
            <div className="flex-1 min-h-0 animate-fade-in flex flex-col">
              {activeTab === "calculator" ? (
                <div className="flex-1 min-h-0 flex flex-col relative">
                  
                  {/* Action row */}
                  <div className="relative flex items-center justify-between gap-4 px-6 h-12 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">File Actions:</span>
                      <TBtn onClick={handleExportExcel} className="h-8.5 text-xs"><FileSpreadsheet className="size-3.5" /> Export Excel</TBtn>
                      <TBtn onClick={handleExportJSON} className="h-8.5 text-xs"><Download className="size-3.5" /> Export JSON</TBtn>
                      <label className="flex items-center gap-1.5 h-8.5 px-3 border border-border/80 hover:bg-surface-2 rounded-lg text-xs cursor-pointer font-semibold text-foreground select-none transition-all">
                        <Upload className="size-3.5" /> Import JSON
                        <input type="file" onChange={handleImportJSON} accept=".json" className="hidden" />
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <TBtn onClick={() => setShowFormulaPanel(!showFormulaPanel)} className="h-8.5 text-xs">
                        <HelpCircle className="size-3.5 text-primary" /> Formula Reference
                      </TBtn>
                      <TBtn onClick={handlePrintPDF} primary className="h-8.5 text-xs"><Printer className="size-3.5" /> Generate PDF Report</TBtn>
                    </div>
                  </div>

                  {/* Main Work Area */}
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-950/20 flex flex-col gap-6">
                    
                    {/* Formula reference area */}
                    {showFormulaPanel && (
                      <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm animate-slide-in flex flex-col gap-5">
                        {/* Features List */}
                        <div>
                          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-2.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-3.5 bg-primary rounded-sm"></span>
                            Features: CHW Pump Head Calculator
                          </h3>
                          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                            <li><strong>All Keyboard shortcuts</strong>: Core navigation & hotkeys.</li>
                            <li><strong>Dynamic Equivalent Length</strong>: Dynamic 30% additions for elbows and valves.</li>
                            <li><strong>Static & Residual Head</strong>: Dynamic elevation lift, outlet pressure, and suction head subtraction.</li>
                            <li><strong>Selected Operating Head</strong>: Custom target head (defaults to calculated head if left blank).</li>
                            <li><strong>Pump Motor Sizing</strong>: Safety factor, pump/motor efficiency metrics for kW/HP sizing.</li>
                            <li><strong>SI / IP Dual Unit System</strong>: Dynamic Metric and Imperial unit conversion.</li>
                          </ul>
                        </div>

                        <div className="border-t border-border/40 pt-4">
                          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
                            <HelpCircle className="size-4 text-primary" /> Pump Head Formulas Reference
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans">
                            <div className="border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10">
                              <span className="font-semibold block mb-1">Design Flowrate (L/s):</span>
                              <code className="text-primary block font-bold mb-1 font-mono text-[11px]">Q = (Flow_GPM × 3.78) ÷ 60</code>
                              <span className="text-[10px] text-muted-foreground">Volumetric discharge flow converted to metric base.</span>
                            </div>
                            <div className="border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10">
                              <span className="font-semibold block mb-1">Piping Equivalent length (m):</span>
                              <code className="text-primary block font-bold mb-1 font-mono text-[11px]">Leq = (L_vert + L_horiz) × 1.6</code>
                              <span className="text-[10px] text-muted-foreground">Fittings and valves dynamically added at 30% each.</span>
                            </div>
                            <div className="border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10">
                              <span className="font-semibold block mb-1">Piping friction losses (bar):</span>
                              <code className="text-primary block font-bold mb-1 font-mono text-[11px]">H_loss = L_equiv × (ff / 100)</code>
                              <span className="text-[10px] text-muted-foreground">Applies friction factor loss rate per 100m of pipe.</span>
                            </div>
                            <div className="border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10">
                              <span className="font-semibold block mb-1">Total dynamic Head (TDH):</span>
                              <code className="text-primary block font-bold mb-1 font-mono text-[11px]">TDH = (H_loss + H_st + H_out − H_suc) × (1 + SF/100)</code>
                              <span className="text-[10px] text-muted-foreground">Head required including static lift, outlet, and safety margin.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Split layout: inputs vs results */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      
                      {/* Left: Inputs Panel (5 cols) */}
                      <div className="lg:col-span-5 flex flex-col gap-6">
                        

                        {/* FLOW DEMAND PARAMETERS */}
                        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 border-b border-border/40 pb-2">
                            <span className="w-1.5 h-3.5 bg-[#0A7BC7] rounded-sm"></span>
                            Flow Demand Parameters
                          </h3>
                          <div className="grid grid-cols-2 gap-4 items-center font-sans">
                            <div>
                              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                                Flow Rate ({unitSystem === "ip" ? "GPM" : "L/s"})
                              </label>
                              <input
                                type="number"
                                value={sizingParams.flowUsgpm}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : Number(e.target.value);
                                  saveParams({ ...sizingParams, flowUsgpm: val, flowLps: val !== "" ? Number((Number(val) * 3.78 / 60).toFixed(2)) : "" }, unitSystem, projectInfo);
                                }}
                                placeholder={unitSystem === "ip" ? "500" : "31.5"}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
                              />
                            </div>
                            <div>
                              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Design Flow Rate</div>
                              <div className="text-sm font-bold mt-1.5 text-slate-800 dark:text-slate-100">
                                {calculatedData.flowRate.toFixed(2)} L/s
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* MAJOR & MINOR HEAD LOSS (PIPING RUN) */}
                        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                          <div className="flex justify-between items-center border-b border-border/40 pb-2">
                            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                              <span className="w-1.5 h-3.5 bg-[#0A7BC7] rounded-sm"></span>
                              Major & Minor Head Loss (Piping Run)
                            </h3>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 select-none">
                              <span>Friction Factor:</span>
                              <div className="bg-[#0A7BC7]/10 dark:bg-[#0A7BC7]/20 text-[#06456F] px-2 py-0.5 rounded flex items-center gap-0.5 font-bold">
                                <input
                                  type="number"
                                  step="0.05"
                                  value={sizingParams.frictionFactor}
                                  onChange={(e) => saveParams({ ...sizingParams, frictionFactor: e.target.value === "" ? "" : Number(e.target.value) }, unitSystem, projectInfo)}
                                  placeholder={unitSystem === "ip" ? "1.77" : "0.4"}
                                  className="w-9 bg-transparent text-[#06456F] text-center outline-none border-none p-0 focus:ring-0 font-bold font-mono placeholder:text-muted-foreground/45"
                                />
                              </div>
                              <span className="text-[10px] font-semibold">{unitSystem === "ip" ? "psi/100ft" : "bar/100m length"}</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                                Vertical Pipe Length ({calculatedData.lengthUnit})
                              </label>
                              <input
                                type="number"
                                value={sizingParams.vertLength}
                                onChange={(e) => saveParams({ ...sizingParams, vertLength: e.target.value === "" ? "" : Number(e.target.value) }, unitSystem, projectInfo)}
                                placeholder={unitSystem === "ip" ? "100" : "30"}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                                Horizontal Pipe Length ({calculatedData.lengthUnit})
                              </label>
                              <input
                                type="number"
                                value={sizingParams.horizLength}
                                onChange={(e) => saveParams({ ...sizingParams, horizLength: e.target.value === "" ? "" : Number(e.target.value) }, unitSystem, projectInfo)}
                                placeholder={unitSystem === "ip" ? "400" : "120"}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-border/40 text-left select-none">
                            <div>
                              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Elbows Equiv.</div>
                              <div className="text-sm font-bold mt-1 text-slate-800 dark:text-slate-100">
                                {calculatedData.elbowsLengthDisplay.toFixed(2)} {calculatedData.lengthUnit}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Valves Equiv.</div>
                              <div className="text-sm font-bold mt-1 text-slate-800 dark:text-slate-100">
                                {calculatedData.valvesLengthDisplay.toFixed(2)} {calculatedData.lengthUnit}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Equiv Length</div>
                              <div className="text-sm font-bold mt-1 text-[#0A7BC7] dark:text-sky-400">
                                {calculatedData.equivLengthDisplay.toFixed(1)} {calculatedData.lengthUnit}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* PUMP HEAD REQUIREMENT */}
                        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 border-b border-border/40 pb-2">
                            <span className="w-1.5 h-3.5 bg-[#0A7BC7] rounded-sm"></span>
                            Pump Head Requirement
                          </h3>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Pressure Drop in the Piping</div>
                              <div className="text-sm font-bold mt-1 text-slate-800 dark:text-slate-100">
                                {calculatedData.frictionLossDisplay.toFixed(3)} {calculatedData.headUnit}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                                Static Head ({calculatedData.headUnit})
                              </label>
                              <input
                                type="number"
                                value={sizingParams.staticHead}
                                step="0.1"
                                onChange={(e) => saveParams({ ...sizingParams, staticHead: e.target.value === "" ? "" : Number(e.target.value) }, unitSystem, projectInfo)}
                                placeholder={unitSystem === "ip" ? "43.5" : "3.0"}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                                Residual Pressure at Outlet ({calculatedData.headUnit})
                              </label>
                              <input
                                type="number"
                                value={sizingParams.residualPressure}
                                step="0.1"
                                onChange={(e) => saveParams({ ...sizingParams, residualPressure: e.target.value === "" ? "" : Number(e.target.value) }, unitSystem, projectInfo)}
                                placeholder={unitSystem === "ip" ? "29.0" : "2.0"}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                                Suction Pressure (Available) ({calculatedData.headUnit})
                              </label>
                              <input
                                type="number"
                                value={sizingParams.suctionPressure}
                                step="0.1"
                                onChange={(e) => saveParams({ ...sizingParams, suctionPressure: e.target.value === "" ? "" : Number(e.target.value) }, unitSystem, projectInfo)}
                                placeholder="0.0"
                                className="w-full bg-blue-50/40/50 dark:bg-orange-950/20 text-[#06456F] border border-blue-100 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                                Considering safety margin (%)
                              </label>
                              <input
                                type="number"
                                value={sizingParams.safetyFactorHead}
                                onChange={(e) => saveParams({ ...sizingParams, safetyFactorHead: e.target.value === "" ? "" : Number(e.target.value) }, unitSystem, projectInfo)}
                                placeholder="5"
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                                Selected Operating Head ({calculatedData.headUnit})
                              </label>
                              <input
                                type="number"
                                value={sizingParams.selectedHead}
                                placeholder="Same as calculated head if left blank"
                                onChange={(e) => saveParams({ ...sizingParams, selectedHead: e.target.value === "" ? "" : Number(e.target.value) }, unitSystem, projectInfo)}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:border-primary outline-none placeholder:text-muted-foreground/45 placeholder:font-normal"
                              />
                            </div>
                          </div>

                          <div className="mt-2 pt-3 border-t border-border/40 select-none">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Calculated Pump Head</div>
                            <div className="text-base font-extrabold mt-1 text-[#0A7BC7]">
                              {calculatedData.pumpHeadCalcDisplay.toFixed(3)} {calculatedData.headUnit}
                            </div>
                          </div>
                        </div>

                        {/* MOTOR & PUMP EFFICIENCY */}
                        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 border-b border-border/40 pb-2">
                            <span className="w-1.5 h-3.5 bg-[#0A7BC7] rounded-sm"></span>
                            Motor & Pump Efficiencies
                          </h3>
                          <div className="grid grid-cols-2 gap-3.5 text-xs font-sans">
                            <div>
                              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Pump Efficiency (%)</label>
                              <input
                                type="number"
                                value={sizingParams.effPump}
                                onChange={(e) => saveParams({ ...sizingParams, effPump: Number(e.target.value) }, unitSystem, projectInfo)}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 text-xs outline-none font-bold focus:border-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Motor Efficiency (%)</label>
                              <input
                                type="number"
                                value={sizingParams.effMotor}
                                onChange={(e) => saveParams({ ...sizingParams, effMotor: Number(e.target.value) }, unitSystem, projectInfo)}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 text-xs outline-none font-bold focus:border-primary"
                              />
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Right: Results Panel (7 cols) */}
                      <div className="lg:col-span-7 flex flex-col gap-6">
                        
                        {/* PUMP HEAD DUTY HIGHLIGHT CARD */}
                        <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl p-6 shadow-md text-white select-none">
                          <span className="text-[10.5px] font-bold uppercase tracking-widest text-orange-100 block mb-2">Pump Head Duty</span>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-[11px] font-semibold text-orange-200 block mb-0.5">Flow Rate</span>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-3xl font-extrabold font-sans leading-none">{calculatedData.flowRateDisplay.toFixed(2)}</span>
                                <span className="text-sm font-semibold">{calculatedData.flowUnit}</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-[11px] font-semibold text-orange-200 block mb-0.5">Required Head</span>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-3xl font-extrabold font-sans leading-none">{calculatedData.pumpHeadCalcDisplay.toFixed(2)}</span>
                                <span className="text-sm font-semibold">{calculatedData.headUnit}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Breakdown block 1: Equivalent length */}
                        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm">
                          <h3 className="text-[11.5px] font-black text-slate-800 dark:text-slate-100 tracking-wider uppercase mb-3 flex items-center gap-2">
                            <span className="text-primary font-bold">1.</span>
                            Friction and Equivalent Length Breakdown
                          </h3>
                          <div className="divide-y divide-border/40 text-xs">
                            <div className="flex justify-between items-center py-2.5">
                              <span className="text-muted-foreground font-sans">Sum of Component Lengths</span>
                              <strong className="text-slate-950 dark:text-slate-50 font-mono">
                                {calculatedData.sumLengthsDisplay.toFixed(1)} {calculatedData.lengthUnit}
                              </strong>
                            </div>
                            <div className="flex justify-between items-center py-2.5">
                              <span className="text-muted-foreground font-sans">Total Equivalent Length (with Safety)</span>
                              <strong className="text-slate-950 dark:text-slate-50 font-mono">
                                {calculatedData.equivLengthDisplay.toFixed(1)} {calculatedData.lengthUnit}
                              </strong>
                            </div>
                            <div className="flex justify-between items-center py-2.5">
                              <span className="text-muted-foreground font-sans">Major + Minor Friction Losses</span>
                              <strong className="text-slate-950 dark:text-slate-50 font-mono">
                                {calculatedData.frictionLossDisplay.toFixed(3)} {calculatedData.headUnit}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Breakdown block 2: Sizing head requirements */}
                        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm">
                          <h3 className="text-[11.5px] font-black text-slate-800 dark:text-slate-100 tracking-wider uppercase mb-3 flex items-center gap-2">
                            <span className="text-primary font-bold">2.</span>
                            Sizing Head Requirements
                          </h3>
                          <div className="divide-y divide-border/40 text-xs">
                            <div className="flex justify-between items-center py-2.5">
                              <span className="text-muted-foreground font-sans">Piping Friction Losses</span>
                              <strong className="text-slate-950 dark:text-slate-50 font-mono">
                                {calculatedData.frictionLossDisplay.toFixed(3)} {calculatedData.headUnit}
                              </strong>
                            </div>
                            <div className="flex justify-between items-center py-2.5">
                              <span className="text-muted-foreground font-sans">Static Elevation Lift</span>
                              <strong className="text-slate-950 dark:text-slate-50 font-mono">
                                {calculatedData.staticHeadDisplay.toFixed(2)} {calculatedData.headUnit}
                              </strong>
                            </div>
                            <div className="flex justify-between items-center py-2.5">
                              <span className="text-muted-foreground font-sans">Residual Head at Outlet</span>
                              <strong className="text-slate-950 dark:text-slate-50 font-mono">
                                {calculatedData.outletHeadDisplay.toFixed(2)} {calculatedData.headUnit}
                              </strong>
                            </div>
                            <div className="flex justify-between items-center py-2.5 text-[#06456F] dark:text-sky-400">
                              <span className="font-sans">Suction Pressure (Deducted)</span>
                              <strong className="font-mono">
                                -{calculatedData.suctionHeadDisplay.toFixed(2)} {calculatedData.headUnit}
                              </strong>
                            </div>
                            <div className="flex justify-between items-center py-2.5 text-[#06456F] dark:text-sky-400 font-bold border-t border-border/80">
                              <span className="font-sans">Total Calculated Pump Head</span>
                              <strong className="font-mono text-[13px]">
                                {calculatedData.pumpHeadCalcDisplay.toFixed(3)} {calculatedData.headUnit}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Breakdown block 3: Calculations for motor selection */}
                        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm">
                          <h3 className="text-[11.5px] font-black text-slate-800 dark:text-slate-100 tracking-wider uppercase mb-3 flex items-center gap-2">
                            <span className="text-primary font-bold">3.</span>
                            Calculations for Motor Selection
                          </h3>
                          <div className="divide-y divide-border/40 text-xs">
                            <div className="flex justify-between items-center py-2.5">
                              <span className="text-muted-foreground font-sans">Selected Head for the Pump</span>
                              <strong className="text-slate-950 dark:text-slate-50 font-mono">
                                {calculatedData.selectedHeadDisplay.toFixed(3)} {calculatedData.headUnit}
                              </strong>
                            </div>
                            <div className="flex justify-between items-center py-2.5">
                              <span className="text-muted-foreground font-sans">Pump Flow Rate</span>
                              <strong className="text-slate-950 dark:text-slate-50 font-mono">
                                {calculatedData.massFlow.toFixed(3)} kg/s
                              </strong>
                            </div>
                            <div className="flex justify-between items-center py-2.5">
                              <span className="text-muted-foreground font-sans">Pressure Lift Requirement</span>
                              <strong className="text-slate-950 dark:text-slate-50 font-mono">
                                {calculatedData.liftKpa.toFixed(1)} kPa
                              </strong>
                            </div>
                            <div className="flex justify-between items-center py-2.5">
                              <span className="text-muted-foreground font-sans">Shaft Power Requirement</span>
                              <strong className="text-slate-950 dark:text-slate-50 font-mono">
                                {calculatedData.shaftPowerKw.toFixed(2)} kW
                              </strong>
                            </div>
                            <div className="flex justify-between items-center py-3 px-3.5 bg-[#0A7BC7]/5 border border-[#0A7BC7]/10 rounded-xl mt-2 font-bold text-[#06456F] dark:text-sky-400">
                              <span className="font-sans">Estimated Motor Power</span>
                              <strong className="font-mono text-[13.5px]">
                                {calculatedData.motorPowerKw.toFixed(2)} kW / {calculatedData.motorPowerHp.toFixed(2)} HP
                              </strong>
                            </div>
                          </div>
                        </div>

                      </div>

                    </div>

                  </div>

                </div>
              ) : (
                /* Report View */
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Toolbar */}
                  <div className="relative flex items-center justify-end gap-3 px-6 h-12 bg-background border-b border-border/60 shrink-0 no-print select-none">
                    <TBtn onClick={handlePrintPDF} primary><Printer className="size-3.5" /> Print / Export PDF</TBtn>
                    <TBtn onClick={handleExportExcel}><FileSpreadsheet className="size-3.5" /> Export to Excel</TBtn>
                  </div>
                  
                  {/* Report Sheet */}
                  <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 dark:bg-slate-950/20 font-sans print:p-0">
                    <div className="border border-slate-300 dark:border-slate-800 rounded-xl p-8 max-w-4xl mx-auto shadow-sm bg-card print:border-none print:shadow-none print:p-0">
                      
                      {/* Report Header */}
                      <div className="border-b-2 border-slate-800 pb-5 mb-6 flex justify-between items-start">
                        <div>
                          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-sans">PUMP HEAD SIZING REPORT</h1>
                          <p className="text-[12px] text-muted-foreground font-mono mt-1">Chilled Water Secondary Circulation Pump Head and Fittings Loss Report</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[13px] font-bold text-primary font-mono block">MEP CALCULATION SUITE</span>
                          <span className="text-[11px] text-muted-foreground block mt-0.5">Date: {projectInfo.date}</span>
                        </div>
                      </div>

                      {/* 1. Project details */}
                      <div className="mb-6">
                        <h3 className="font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 pb-1 mb-3">1. Project Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground block">Project Name:</span>
                            <span className="font-semibold">{projectInfo.projectName}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Project Number:</span>
                            <span className="font-semibold">{projectInfo.projectNumber}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Consultant / Engineer:</span>
                            <span className="font-semibold">{projectInfo.consultant}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Client Name:</span>
                            <span className="font-semibold">{projectInfo.client}</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Sizing Parameters */}
                      <div className="mb-6">
                        <h3 className="font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 pb-1 mb-3">2. Design Parameters</h3>
                        <div className="grid grid-cols-3 gap-y-3.5 gap-x-4 text-xs font-mono">
                          <div>
                            <span className="text-muted-foreground font-sans block">Design Flow Rate:</span>
                            <strong>{calculatedData.flowRateDisplay.toFixed(2)} {calculatedData.flowUnit}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground font-sans block">Vertical Pipe Length:</span>
                            <strong>{calculatedData.vertLengthDisplay.toFixed(1)} {calculatedData.lengthUnit}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground font-sans block">Horizontal Pipe Length:</span>
                            <strong>{calculatedData.horizLengthDisplay.toFixed(1)} {calculatedData.lengthUnit}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground font-sans block">Friction Factor Loss Rate:</span>
                            <strong>{sizingParams.frictionFactor} {unitSystem === "ip" ? "psi/100ft" : "bar/100m"}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground font-sans block">Design Equivalent Length:</span>
                            <strong>{calculatedData.equivLengthDisplay.toFixed(1)} {calculatedData.lengthUnit}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground font-sans block">Safety Margin applied:</span>
                            <strong>{sizingParams.safetyFactorHead}%</strong>
                          </div>
                        </div>
                      </div>

                      {/* 3. Results tables */}
                      <div className="mb-6">
                        <h3 className="font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 pb-1 mb-3">3. Head Loss Sizing Summary</h3>
                        
                        <table className="w-full text-left text-[11px] border border-collapse border-slate-200 font-sans mb-4">
                          <thead>
                            <tr className="bg-slate-100 font-bold text-slate-800 border-b border-slate-200">
                              <th className="p-2 border-r border-slate-200">Loss Component</th>
                              <th className="p-2 text-right">Pressure / Head Loss</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-mono">
                            <tr>
                              <td className="p-2 border-r border-slate-200 font-sans">Piping Friction Losses</td>
                              <td className="p-2 text-right">{calculatedData.frictionLossDisplay.toFixed(3)} {calculatedData.headUnit}</td>
                            </tr>
                            <tr>
                              <td className="p-2 border-r border-slate-200 font-sans">Static elevation Lift</td>
                              <td className="p-2 text-right">{calculatedData.staticHeadDisplay.toFixed(2)} {calculatedData.headUnit}</td>
                            </tr>
                            <tr>
                              <td className="p-2 border-r border-slate-200 font-sans">Residual Outlet Pressure required</td>
                              <td className="p-2 text-right">{calculatedData.outletHeadDisplay.toFixed(2)} {calculatedData.headUnit}</td>
                            </tr>
                            <tr className="text-[#06456F] font-bold">
                              <td className="p-2 border-r border-slate-200 font-sans">Suction pressure (Deducted)</td>
                              <td className="p-2 text-right">-{calculatedData.suctionHeadDisplay.toFixed(2)} {calculatedData.headUnit}</td>
                            </tr>
                            <tr className="bg-blue-50/40 font-extrabold text-orange-950">
                              <td className="p-2 border-r border-slate-200 font-sans">TOTAL RECOMMENDED PUMP HEAD</td>
                              <td className="p-2 text-right">{calculatedData.pumpHeadCalcDisplay.toFixed(3)} {calculatedData.headUnit}</td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-800/10 text-xs">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
                            <div>
                              <span className="text-muted-foreground font-sans">Selected Sized Head:</span>
                              <strong className="block text-[13px] mt-0.5 text-primary">{calculatedData.selectedHeadDisplay.toFixed(3)} {calculatedData.headUnit}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground font-sans">Fluid Mass Flow Rate:</span>
                              <strong className="block text-[13px] mt-0.5">{calculatedData.massFlow.toFixed(3)} kg/s</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground font-sans">Required Shaft Power:</span>
                              <strong className="block text-[13px] mt-0.5">{calculatedData.shaftPowerKw.toFixed(2)} kW</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground font-sans">Estimated Motor Power:</span>
                              <strong className="block text-[13px] mt-0.5 text-emerald-600 dark:text-emerald-400">{calculatedData.motorPowerKw.toFixed(2)} kW ({calculatedData.motorPowerHp.toFixed(2)} HP)</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sign off */}
                      <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-[11px] text-muted-foreground">
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-slate-800 mb-6">Prepared By:</p>
                          <div className="border-b border-slate-300 w-48 mb-1"></div>
                          <p>Consulting HVAC Engineer</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold uppercase tracking-wider text-slate-800 mb-6">Reviewed & Approved By:</p>
                          <div className="border-b border-slate-300 w-48 ml-auto mb-1"></div>
                          <p>Lead MEP Principal Engineer</p>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </AppShell>
  );
}
