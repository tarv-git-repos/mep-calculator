import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { cToF, fToC, m3sToCfm, cfmToM3s } from "@/utils/conversions";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  Download, Upload, Sparkles, AlertTriangle, CheckCircle2,
  Info, Gauge, FileText, Printer, FileSpreadsheet, Bookmark, HelpCircle,
  Wrench, MessageSquare, Wind, Droplets, Thermometer, Activity, RefreshCw
} from "lucide-react";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { api } from "@/services/api";

export const Route = createFileRoute("/fresh-air-cooling-load")({
  head: () => ({
    meta: [
      { title: "Fresh Air Cooling Load — MEP Calc" },
      { name: "description", content: "Fresh Air Cooling Load calculator for sensible, latent, total loads, and coil sizing." },
    ],
  }),
  component: FreshAirCoolingLoadPage,
});

// ASHRAE two-equation saturation pressure model (Pa)
function satP(tK: number): number {
  if (tK >= 273.15) {
    return Math.exp(
      -5800.2206 / tK + 1.3914993 - 0.04864 * tK +
      4.1764768e-5 * tK ** 2 - 1.4452093e-8 * tK ** 3 +
      6.5459673 * Math.log(tK)
    );
  }
  return Math.exp(
    -5674.5359 / tK + 6.3925247 - 0.009677843 * tK +
    6.2215701e-7 * tK ** 2 + 2.0747825e-9 * tK ** 3 -
    9.484024e-19 * tK ** 4 + 4.1635019 * Math.log(tK)
  );
}

function wFromWB(db: number, wb: number, p: number): number {
  const pSatWb = satP(wb + 273.15);
  const ws = 0.621945 * pSatWb / Math.max(1, (p - pSatWb));
  const wVal = ((2501 - 2.381 * wb) * ws - 1.006 * (db - wb)) / (2501 + 1.805 * db - 4.186 * wb);
  return Math.max(0.0001, wVal);
}

// Relative Humidity from DB, WB, and pressure
function rhFromDbWb(db: number, wb: number, p: number): number {
  const w = wFromWB(db, wb, p);
  const pSatDb = satP(db + 273.15);
  const pw = (p * w) / (0.621945 + w);
  return Math.min(100, Math.max(0, (pw / pSatDb) * 100));
}

// Enthalpy of moist air in kJ/kg dry air
function enthalpyMoistAir(db: number, w: number): number {
  return 1.006 * db + w * (2501 + 1.86 * db);
}

function FreshAirCoolingLoadPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, forceSaveToCloud } = useWorkspace();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState({
    projectName: "Commercial Fresh Air Treatment Plant",
    projectNumber: "MEP-FA-01",
    client: "Al Futtaim Developments",
    consultant: "Consistent Engineering Consultants",
    date: new Date().toISOString().split("T")[0],
    revision: "Rev 0",
    calcNumber: "CALC-HVAC-FA01",
    notes: "Outdoor fresh air conditioning coil sensible, latent, and total heat load sizing study.",
  });

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");
  const [dbIn, setDbIn] = useState<number | "">(95);
  const [wbIn, setWbIn] = useState<number | "">(78);
  const [dbOut, setDbOut] = useState<number | "">(55);
  const [wbOut, setWbOut] = useState<number | "">(54);
  const [flowRate, setFlowRate] = useState<number | "">(1000);
  const [safetyFactor, setSafetyFactor] = useState<number>(5);
  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [showFormulaPanel, setShowFormulaPanel] = useState(false);

  // Comment System State
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);

  const ip = unitSystem === "ip";

  useEffect(() => {
    try {
      const pId = project?.id || "default";
      const savedComments = localStorage.getItem(`mep_calc_comments_${pId}_/fresh-air-cooling-load`);
      if (savedComments) {
        setCommentsList(JSON.parse(savedComments));
      }
    } catch (e) {
      console.error(e);
    }
  }, [project?.id]);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    try {
      const pId = project?.id || "default";
      localStorage.setItem(`mep_calc_comments_${pId}_/fresh-air-cooling-load`, JSON.stringify(newList));
    } catch (e) {
      console.error(e);
    }
  };

  // Load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mep_fresh_air_calc_params");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dbIn !== undefined) setDbIn(parsed.dbIn);
        if (parsed.wbIn !== undefined) setWbIn(parsed.wbIn);
        if (parsed.dbOut !== undefined) setDbOut(parsed.dbOut);
        if (parsed.wbOut !== undefined) setWbOut(parsed.wbOut);
        if (parsed.flowRate !== undefined) setFlowRate(parsed.flowRate);
        if (parsed.safetyFactor !== undefined) setSafetyFactor(parsed.safetyFactor);
        if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      }
    } catch (e) {
      console.error(e);
      if (project?.id) setLoadedProjectId(project.id); else setLoadedProjectId("loaded");
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("mep_fresh_air_calc_params", JSON.stringify({
        dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, unitSystem, projectInfo
      }));
      dirtyStore.set(true);
    } catch (e) {
      console.error(e);
    }
  }, [dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, unitSystem, projectInfo]);

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;
    setUnitSystem(unit);
    if ((window as any).__mep_keep_values) return;
    const convT = (t: number) => unit === "ip" ? cToF(t) : fToC(t);
    const convF = (f: number) => unit === "ip" ? m3sToCfm(f) : cfmToM3s(f);

    setDbIn(dbIn !== "" ? Number(convT(Number(dbIn)).toFixed(1)) : "");
    setWbIn(wbIn !== "" ? Number(convT(Number(wbIn)).toFixed(1)) : "");
    setDbOut(dbOut !== "" ? Number(convT(Number(dbOut)).toFixed(1)) : "");
    setWbOut(wbOut !== "" ? Number(convT(Number(wbOut)).toFixed(1)) : "");
    setFlowRate(flowRate !== "" ? Number(convF(Number(flowRate)).toFixed(unit === "ip" ? 0 : 3)) : "");
  };

  const applyPreset = (presetKey: "gulf_summer" | "subtropical" | "moderate" | "desert_peak") => {
    if (presetKey === "gulf_summer") {
      setDbIn(ip ? 115 : 46.1);
      setWbIn(ip ? 86 : 30.0);
      setDbOut(ip ? 55 : 12.8);
      setWbOut(ip ? 54 : 12.2);
    } else if (presetKey === "subtropical") {
      setDbIn(ip ? 95 : 35.0);
      setWbIn(ip ? 80 : 26.7);
      setDbOut(ip ? 54 : 12.2);
      setWbOut(ip ? 53 : 11.7);
    } else if (presetKey === "moderate") {
      setDbIn(ip ? 86 : 30.0);
      setWbIn(ip ? 72 : 22.2);
      setDbOut(ip ? 55 : 12.8);
      setWbOut(ip ? 54 : 12.2);
    } else if (presetKey === "desert_peak") {
      setDbIn(ip ? 122 : 50.0);
      setWbIn(ip ? 77 : 25.0);
      setDbOut(ip ? 57 : 13.9);
      setWbOut(ip ? 55 : 12.8);
    }
  };

  // Calculation Engine
  const calc = useMemo(() => {
    const dbInVal = dbIn !== "" ? Number(dbIn) : (ip ? 95 : 35.0);
    const wbInVal = wbIn !== "" ? Number(wbIn) : (ip ? 78 : 25.5);
    const dbOutVal = dbOut !== "" ? Number(dbOut) : (ip ? 55 : 12.8);
    const wbOutVal = wbOut !== "" ? Number(wbOut) : (ip ? 54 : 12.2);
    const flowVal = flowRate !== "" ? Number(flowRate) : (ip ? 1000 : 0.472);

    const dbInC = ip ? fToC(dbInVal) : dbInVal;
    const wbInC = ip ? fToC(wbInVal) : wbInVal;
    const dbOutC = ip ? fToC(dbOutVal) : dbOutVal;
    const wbOutC = ip ? fToC(wbOutVal) : wbOutVal;
    const flowM3s = ip ? cfmToM3s(flowVal) : flowVal;
    const flowLps = flowM3s * 1000;
    const flowCfm = flowM3s * 2118.88;

    const pAtm = 101325; // standard sea-level Pa
    const wInKg = wFromWB(dbInC, wbInC, pAtm);
    const wOutKg = wFromWB(dbOutC, wbOutC, pAtm);

    const rhIn = rhFromDbWb(dbInC, wbInC, pAtm);
    const rhOut = rhFromDbWb(dbOutC, wbOutC, pAtm);

    const hIn = enthalpyMoistAir(dbInC, wInKg);
    const hOut = enthalpyMoistAir(dbOutC, wOutKg);

    const rho = 1.2; // standard air density kg/m3
    const mDot = flowM3s * rho; // kg/s dry air
    const cp = 1.006; // kJ/kg.K
    const hfg = 2501; // kJ/kg latent heat of vaporization

    const sfMultiplier = 1 + (Number(safetyFactor) || 0) / 100;

    const sensKwBase = mDot * cp * Math.max(0, (dbInC - dbOutC));
    const latKwBase = mDot * Math.max(0, (wInKg - wOutKg)) * hfg;
    const totKwBase = sensKwBase + latKwBase;

    const sensKw = sensKwBase * sfMultiplier;
    const latKw = latKwBase * sfMultiplier;
    const totKw = totKwBase * sfMultiplier;

    const capTons = totKw / 3.51685;
    const shr = totKw > 0 ? (sensKw / totKw) : 1.0;

    // Condensate removal rate in kg/h (or L/h)
    const condensateKgH = mDot * Math.max(0, (wInKg - wOutKg)) * 3600;
    const condensateGph = condensateKgH * 0.264172;

    const sensLoad = ip ? sensKw * 3412.14 : sensKw;
    const latLoad = ip ? latKw * 3412.14 : latKw;
    const totLoad = ip ? totKw * 3412.14 : totKw;
    const wIn = ip ? wInKg * 7000 : wInKg;
    const wOut = ip ? wOutKg * 7000 : wOutKg;

    return {
      dbInC, wbInC, dbOutC, wbOutC,
      flowM3s, flowLps, flowCfm,
      wInKg, wOutKg,
      rhIn, rhOut,
      hIn, hOut,
      sensKw, latKw, totKw,
      sensLoad, latLoad, totLoad,
      capacityTons: capTons,
      wIn, wOut,
      shr,
      condensateKgH,
      condensateGph,
      mDot,
    };
  }, [dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, ip]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    const dbInVal = dbIn !== "" ? Number(dbIn) : (ip ? 95 : 35);
    const wbInVal = wbIn !== "" ? Number(wbIn) : (ip ? 78 : 25.5);
    const dbOutVal = dbOut !== "" ? Number(dbOut) : (ip ? 55 : 12.8);
    const wbOutVal = wbOut !== "" ? Number(wbOut) : (ip ? 54 : 12.2);

    if (wbInVal > dbInVal) w.push("Entering Wet Bulb cannot exceed Entering Dry Bulb temperature.");
    if (wbOutVal > dbOutVal) w.push("Leaving Wet Bulb cannot exceed Leaving Dry Bulb temperature.");
    if (dbOutVal > dbInVal) w.push("Leaving Dry Bulb temperature is higher than Entering Dry Bulb temperature (Heating mode).");
    if (wbOutVal > wbInVal) w.push("Leaving Wet Bulb temperature is higher than Entering Wet Bulb temperature.");
    if (calc.shr < 0.3) w.push("Very high latent moisture load detected (SHR < 0.30). Ensure adequate coil depth & condensate drain sizing.");
    return w;
  }, [dbIn, wbIn, dbOut, wbOut, calc.shr, ip]);

  const handleExportExcel = async () => {
    const exceljsModule = await import('exceljs');
    const ExcelJS = exceljsModule.default || (window as any).ExcelJS;
    const fileSaverModule = await import('file-saver');
    const saveAs = fileSaverModule.saveAs || fileSaverModule.default?.saveAs || fileSaverModule.default || ((window as any).saveAs);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Fresh Air Cooling Load");

    sheet.getColumn(1).width = 28;
    sheet.getColumn(2).width = 24;
    sheet.getColumn(3).width = 12;
    sheet.getColumn(4).width = 30;
    sheet.getColumn(5).width = 40;

    sheet.mergeCells("A1:E1");
    const cellA1 = sheet.getCell("A1");
    cellA1.value = "FRESH AIR COOLING LOAD REPORT";
    cellA1.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFF" } };
    cellA1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0A7BC7" } };
    cellA1.alignment = { horizontal: "center" };

    sheet.addRow([]);
    sheet.addRow(["Project Information"]);
    sheet.getCell("A3").font = { name: "Segoe UI", size: 12, bold: true };
    sheet.addRow(["Project Name", projectInfo.projectName]);
    sheet.addRow(["Project Number", projectInfo.projectNumber]);
    sheet.addRow(["Consultant", projectInfo.consultant]);
    sheet.addRow(["Client", projectInfo.client]);
    sheet.addRow(["Date / Rev", `${projectInfo.date} / ${projectInfo.revision}`]);

    const uT = ip ? "°F" : "°C";
    const uL = ip ? "BTU/h" : "kW";
    const uW = ip ? "gr/lb" : "kg/kg";

    sheet.addRow([]);
    sheet.addRow(["Fresh Air Input Parameters"]);
    sheet.getCell("A10").font = { name: "Segoe UI", size: 12, bold: true };
    sheet.addRow(["Entering Dry Bulb (DB)", `${dbIn} ${uT}`]);
    sheet.addRow(["Entering Wet Bulb (WB)", `${wbIn} ${uT}`]);
    sheet.addRow(["Entering Rel. Humidity", `${calc.rhIn.toFixed(1)} %`]);
    sheet.addRow(["Entering Humidity Ratio", `${calc.wIn.toFixed(ip ? 2 : 5)} ${uW}`]);
    sheet.addRow(["Leaving Dry Bulb (DB)", `${dbOut} ${uT}`]);
    sheet.addRow(["Leaving Wet Bulb (WB)", `${wbOut} ${uT}`]);
    sheet.addRow(["Leaving Rel. Humidity", `${calc.rhOut.toFixed(1)} %`]);
    sheet.addRow(["Leaving Humidity Ratio", `${calc.wOut.toFixed(ip ? 2 : 5)} ${uW}`]);
    sheet.addRow(["Fresh Air Flowrate", `${flowRate} ${ip ? "CFM" : "m³/s"}`]);
    sheet.addRow(["Safety Margin Factor", `${safetyFactor} %`]);

    sheet.addRow([]);
    sheet.addRow(["Cooling Coil Sizing Results"]);
    sheet.getCell("A22").font = { name: "Segoe UI", size: 12, bold: true };
    sheet.addRow(["Sensible Heat Load", `${calc.sensLoad.toFixed(2)} ${uL} (${(calc.sensKw).toFixed(2)} kW)`]);
    sheet.addRow(["Latent Heat Load", `${calc.latLoad.toFixed(2)} ${uL} (${(calc.latKw).toFixed(2)} kW)`]);
    sheet.addRow(["Total Fresh Air Load", `${calc.totLoad.toFixed(2)} ${uL} (${(calc.totKw).toFixed(2)} kW)`]);
    sheet.addRow(["Sensible Heat Ratio (SHR)", `${calc.shr.toFixed(2)}`]);
    sheet.addRow(["Required Coil Capacity", `${calc.capacityTons.toFixed(2)} TR`]);
    sheet.addRow(["Condensate Removal Rate", `${calc.condensateKgH.toFixed(2)} L/h (${calc.condensateGph.toFixed(2)} GPH)`]);

    const sigRow = (sheet as any).rowCount ? (sheet as any).rowCount + 2 : 30;
    addExcelSignatureBlock(sheet, sigRow, currentUserName, project?.id || "default", "fresh-air-cooling-load");
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${projectInfo.projectName.replace(/\s+/g, "_")}_fresh_air_cooling_load.xlsx`);
  };

  const handlePrintPDF = async () => {
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF("p", "pt", "a4");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("FRESH AIR COOLING LOAD SIZING REPORT", 40, 50);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated on: ${projectInfo.date} | Calculation Code: ${projectInfo.calcNumber}`, 40, 68);

    doc.setDrawColor(200);
    doc.line(40, 78, 555, 78);

    // Project Info
    autoTable(doc, {
      startY: 90,
      head: [["Project Information", "Details", "Engineering Reference", "Status"]],
      body: [
        ["Project Name", projectInfo.projectName, "Standard", "ASHRAE 62.1 & Psychrometrics"],
        ["Project Number", projectInfo.projectNumber, "Consultant", projectInfo.consultant],
        ["Client", projectInfo.client, "Revision", projectInfo.revision],
      ],
      theme: "grid",
      headStyles: { fillColor: [10, 123, 199], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
    });

    const uT = ip ? "°F" : "°C";
    const uL = ip ? "BTU/h" : "kW";
    const uW = ip ? "gr/lb" : "kg/kg";

    // Inputs Table
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [["State Property", "Entering Air (OA)", "Leaving Coil Air", "Unit"]],
      body: [
        ["Dry Bulb Temperature", `${dbIn} ${uT}`, `${dbOut} ${uT}`, uT],
        ["Wet Bulb Temperature", `${wbIn} ${uT}`, `${wbOut} ${uT}`, uT],
        ["Relative Humidity (RH)", `${calc.rhIn.toFixed(1)} %`, `${calc.rhOut.toFixed(1)} %`, "%"],
        ["Humidity Ratio (W)", `${calc.wIn.toFixed(ip ? 2 : 5)} ${uW}`, `${calc.wOut.toFixed(ip ? 2 : 5)} ${uW}`, uW],
        ["Airflow Design Rate", `${flowRate} ${ip ? "CFM" : "m³/s"}`, `${calc.flowLps.toFixed(1)} L/s`, "Design Vol."],
        ["Safety Margin Added", `${safetyFactor} %`, "Included in Sizing", "%"],
      ],
      theme: "striped",
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
    });

    // Sizing Output Table
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [["Coil Duty Output Item", "Calculated Value", "Equivalent Metric", "Engineering Impact"]],
      body: [
        ["Sensible Heat Load (Q_sens)", `${calc.sensLoad.toFixed(2)} ${uL}`, `${calc.sensKw.toFixed(2)} kW`, "Temperature Drop Power"],
        ["Latent Heat Load (Q_lat)", `${calc.latLoad.toFixed(2)} ${uL}`, `${calc.latKw.toFixed(2)} kW`, "Moisture Dehumidification"],
        ["Total Fresh Air Heat Load (Q_tot)", `${calc.totLoad.toFixed(2)} ${uL}`, `${calc.totKw.toFixed(2)} kW`, "Total Coil Thermal Duty"],
        ["Sensible Heat Ratio (SHR)", `${calc.shr.toFixed(2)}`, `${(calc.shr * 100).toFixed(1)} % Sensible`, "Coil Selection Factor"],
        ["Required Coil Capacity", `${calc.capacityTons.toFixed(2)} TR`, `${calc.totKw.toFixed(2)} kW`, "Nominal Plant Sizing"],
        ["Condensate Drainage Sizing", `${calc.condensateKgH.toFixed(2)} L/h`, `${calc.condensateGph.toFixed(2)} GPH`, "Condensate Drain Pipe"],
      ],
      theme: "grid",
      headStyles: { fillColor: [10, 123, 199], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 5 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 25;
    addPdfSignatureBlock(doc, finalY, currentUserName, project?.id || "default", "fresh-air-cooling-load");
    doc.save(`${projectInfo.projectName.replace(/\s+/g, "_")}_fresh_air_report.pdf`);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      projectInfo, dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, unitSystem
    }));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${projectInfo.projectName.replace(/\s+/g, "_")}_fresh_air_load.json`);
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
        if (parsed.dbIn !== undefined) setDbIn(parsed.dbIn);
        if (parsed.wbIn !== undefined) setWbIn(parsed.wbIn);
        if (parsed.dbOut !== undefined) setDbOut(parsed.dbOut);
        if (parsed.wbOut !== undefined) setWbOut(parsed.wbOut);
        if (parsed.flowRate !== undefined) setFlowRate(parsed.flowRate);
        if (parsed.safetyFactor !== undefined) setSafetyFactor(parsed.safetyFactor);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const uT = ip ? "°F" : "°C";
  const uW = ip ? "gr/lb" : "kg/kg";
  const uL = ip ? "BTU/h" : "kW";

  return (
    <AppShell title="Fresh Air Cooling Load" hideSubHeader={true}>
      <div className="flex flex-col h-full min-h-0 bg-transparent font-sans">
        {/* Review Lifecycle Status Bar */}
        <CalculationReviewBar
          projectId={project?.id || "default"}
          calculatorPath="/fresh-air-cooling-load"
          calculatorTitle="Fresh Air Cooling Load"
        />

        <div className="flex-1 min-w-0 flex flex-col pt-3 gap-4 overflow-y-auto h-full px-6 pb-8">
          {/* Header & Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 select-none pb-2 border-b border-border/50">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; LOAD &amp; VENTILATION &gt; FRESH AIR COOLING LOAD</span>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Fresh Air Cooling Load</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded-full border border-primary/20">
                  ASHRAE Psychrometric Standard
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Calculate sensible, latent, and total cooling coil loads for untreated outdoor makeup fresh air systems.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-border/60">
                <button
                  type="button"
                  onClick={() => setActiveTab("calculator")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "calculator" ? "bg-white dark:bg-slate-900 text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Calculator
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("report")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "report" ? "bg-white dark:bg-slate-900 text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Report &amp; Summary
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowFormulaPanel(!showFormulaPanel)}
                className={`p-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  showFormulaPanel ? "bg-primary/15 text-primary border-primary/30" : "bg-card border-border hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground"
                }`}
                title="Toggle Psychrometric Formulas Panel"
              >
                <HelpCircle className="size-4" />
                <span className="hidden sm:inline">Formulas</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCommentTargetItem({ id: "fresh-air-coil-duty", name: "Fresh Air Cooling Coil Sizing" });
                  setCommentModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                title="Add Comment or Assign Task"
              >
                <MessageSquare className="size-3.5" />
                <span>Comment / Task</span>
                {commentsList.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-primary text-white text-[10px] font-extrabold rounded-full">
                    {commentsList.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Formula Reference Banner */}
          {showFormulaPanel && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-xs flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-primary/15 pb-2">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <Activity className="size-4" />
                  Engineering Psychrometric Calculation Principles
                </span>
                <button
                  type="button"
                  onClick={() => setShowFormulaPanel(false)}
                  className="text-muted-foreground hover:text-foreground text-[11px]"
                >
                  ✕ Close
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-muted-foreground leading-relaxed">
                <div className="p-2.5 bg-background/60 rounded-xl border border-border/50">
                  <strong className="text-foreground block mb-1">1. Sensible Heat Load:</strong>
                  <code className="text-[11px] text-primary font-mono block">Q_sens = ṁ · c_p · (DB_in - DB_out)</code>
                  <span>Direct temperature drop of incoming outdoor air mass.</span>
                </div>
                <div className="p-2.5 bg-background/60 rounded-xl border border-border/50">
                  <strong className="text-foreground block mb-1">2. Latent Heat Load:</strong>
                  <code className="text-[11px] text-primary font-mono block">Q_lat = ṁ · (W_in - W_out) · h_fg</code>
                  <span>Moisture extraction via coil condensation using humidity ratio \(W\).</span>
                </div>
                <div className="p-2.5 bg-background/60 rounded-xl border border-border/50">
                  <strong className="text-foreground block mb-1">3. Coil Capacity (TR):</strong>
                  <code className="text-[11px] text-primary font-mono block">Capacity (TR) = Q_total (kW) / 3.51685</code>
                  <span>Total cooling duty with user safety margin.</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "calculator" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Inputs */}
              <div className="lg:col-span-5 flex flex-col gap-5">
                {/* Unit & Climate Presets */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-border/60 select-none">
                    <button
                      type="button"
                      onClick={() => handleUnitSystemChange("ip")}
                      className={`px-3.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        ip ? "bg-white dark:bg-slate-900 text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Imperial (IP)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnitSystemChange("si")}
                      className={`px-3.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        !ip ? "bg-white dark:bg-slate-900 text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Metric (SI)
                    </button>
                  </div>

                  {/* Weather Presets Dropdown */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground font-semibold">Preset:</span>
                    <select
                      onChange={(e) => applyPreset(e.target.value as any)}
                      className="bg-card border border-border rounded-lg px-2.5 py-1 text-xs font-semibold outline-none focus:border-primary cursor-pointer text-foreground"
                      defaultValue=""
                    >
                      <option value="" disabled>Select Climate</option>
                      <option value="gulf_summer">Gulf Summer (Hot &amp; Humid)</option>
                      <option value="subtropical">Subtropical Summer</option>
                      <option value="moderate">Moderate / Temperate</option>
                      <option value="desert_peak">Desert Peak (Extreme Dry)</option>
                    </select>
                  </div>
                </div>

                {/* Entering Coil Air Properties */}
                <div className="bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-[#0A7BC7] rounded-full" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Entering Coil Air (Outdoor Air)
                      </h3>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      RH: <strong className="text-primary font-mono">{calc.rhIn.toFixed(1)}%</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground flex justify-between">
                        <span>Dry Bulb (DB)</span>
                        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{uT}</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={dbIn}
                        onChange={(e) => setDbIn(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder={ip ? "95" : "35.0"}
                        className="w-full bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/45"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground flex justify-between">
                        <span>Wet Bulb (WB)</span>
                        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{uT}</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={wbIn}
                        onChange={(e) => setWbIn(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder={ip ? "78" : "25.5"}
                        className="w-full bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/45"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11.5px] bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/40 font-medium">
                    <span className="text-muted-foreground">Entering Moisture Ratio (W_in):</span>
                    <strong className="text-primary font-mono text-xs">{calc.wIn.toFixed(ip ? 2 : 5)} {uW}</strong>
                  </div>
                </div>

                {/* Leaving Coil Air Properties */}
                <div className="bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-[#7C3AED] rounded-full" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Leaving Coil Air (Supply Off-Coil)
                      </h3>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      RH: <strong className="text-purple-600 dark:text-purple-400 font-mono">{calc.rhOut.toFixed(1)}%</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground flex justify-between">
                        <span>Dry Bulb (DB)</span>
                        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{uT}</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={dbOut}
                        onChange={(e) => setDbOut(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder={ip ? "55" : "12.8"}
                        className="w-full bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/45"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground flex justify-between">
                        <span>Wet Bulb (WB)</span>
                        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{uT}</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={wbOut}
                        onChange={(e) => setWbOut(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder={ip ? "54" : "12.2"}
                        className="w-full bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/45"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11.5px] bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/40 font-medium">
                    <span className="text-muted-foreground">Leaving Moisture Ratio (W_out):</span>
                    <strong className="text-purple-600 dark:text-purple-400 font-mono text-xs">{calc.wOut.toFixed(ip ? 2 : 5)} {uW}</strong>
                  </div>
                </div>

                {/* Airflow & Safety Margin */}
                <div className="bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                    <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Airflow &amp; Safety Factor
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground flex justify-between">
                        <span>Airflow Rate</span>
                        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">
                          {ip ? "CFM" : "m³/s"}
                        </span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={flowRate}
                        onChange={(e) => setFlowRate(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder={ip ? "1000" : "0.472"}
                        className="w-full bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/45"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground flex justify-between">
                        <span>Safety Margin</span>
                        <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.2 rounded font-bold">%</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="30"
                        value={safetyFactor}
                        onChange={(e) => setSafetyFactor(Number(e.target.value) || 0)}
                        className="w-full bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-primary text-foreground"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground flex justify-between pt-1">
                    <span>Equivalent Flow: <strong className="text-foreground font-mono">{calc.flowLps.toFixed(1)} L/s</strong></span>
                    <span>Mass Flow (ṁ): <strong className="text-foreground font-mono">{calc.mDot.toFixed(2)} kg/s</strong></span>
                  </div>
                </div>
              </div>

              {/* Right Column: Sizing Results & Visuals */}
              <div className="lg:col-span-7 flex flex-col gap-5">
                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 bg-card border border-border rounded-2xl p-2.5 shadow-2xs select-none">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-foreground text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="size-3.5 text-emerald-600" />
                      <span>Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintPDF}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-foreground text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Printer className="size-3.5 text-red-500" />
                      <span>PDF Report</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleExportJSON}
                      className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground font-medium rounded-lg transition-colors flex items-center gap-1"
                      title="Export JSON scenario"
                    >
                      <Download className="size-3.5" />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                    <label
                      className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      title="Import JSON scenario"
                    >
                      <Upload className="size-3.5" />
                      <span className="hidden sm:inline">Import</span>
                      <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Warnings */}
                {warnings.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 rounded-2xl p-3.5 flex flex-col gap-1.5 text-xs select-none">
                    {warnings.map((w, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Key Sizing Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Total Capacity Card */}
                  <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-4.5 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-primary/15">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Gauge className="size-3.5 text-primary" />
                        Required Coil Sizing
                      </span>
                      <span className="text-[10px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-full">
                        +{safetyFactor}% Margin
                      </span>
                    </div>
                    <div className="my-3 flex items-baseline justify-between">
                      <div className="text-3xl font-extrabold text-primary font-mono tracking-tight">
                        {calc.capacityTons.toFixed(2)} <span className="text-sm font-bold font-sans">TR</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-foreground font-mono">
                          {calc.totKw.toFixed(1)} kW
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {calc.totLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex justify-between border-t border-primary/15 pt-2">
                      <span>Sensible Heat Ratio:</span>
                      <strong className="text-foreground font-mono">{calc.shr.toFixed(2)} ({Math.round(calc.shr * 100)}%)</strong>
                    </div>
                  </div>

                  {/* Condensate Drain Card */}
                  <div className="bg-card border border-border rounded-2xl p-4.5 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Droplets className="size-3.5 text-blue-500" />
                        Condensate Generation
                      </span>
                      <span className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
                        Dehumidification
                      </span>
                    </div>
                    <div className="my-3 flex items-baseline justify-between">
                      <div className="text-3xl font-extrabold text-foreground font-mono tracking-tight">
                        {calc.condensateKgH.toFixed(1)} <span className="text-sm font-bold font-sans">L/h</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-muted-foreground font-mono">
                          {calc.condensateGph.toFixed(2)} GPH
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Drain flow rate
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex justify-between border-t border-border/50 pt-2">
                      <span>Moisture Delta (ΔW):</span>
                      <strong className="text-foreground font-mono">
                        {(Math.max(0, calc.wIn - calc.wOut)).toFixed(ip ? 2 : 5)} {uW}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Detailed Results Grid */}
                <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-2xs">
                  <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-primary rounded-full" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Coil Load Breakdown &amp; Enthalpy Values
                      </h3>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Atmospheric Pressure: <strong className="font-mono text-foreground">101.3 kPa</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                      <span className="font-semibold text-muted-foreground">Sensible Heat Load:</span>
                      <strong className="font-bold text-foreground font-mono">
                        {calc.sensLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL} ({calc.sensKw.toFixed(2)} kW)
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                      <span className="font-semibold text-muted-foreground">Latent Heat Load:</span>
                      <strong className="font-bold text-foreground font-mono">
                        {calc.latLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL} ({calc.latKw.toFixed(2)} kW)
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                      <span className="font-semibold text-muted-foreground">Entering Enthalpy (h_in):</span>
                      <strong className="font-bold text-foreground font-mono">
                        {calc.hIn.toFixed(1)} kJ/kg
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                      <span className="font-semibold text-muted-foreground">Leaving Enthalpy (h_out):</span>
                      <strong className="font-bold text-foreground font-mono">
                        {calc.hOut.toFixed(1)} kJ/kg
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                      <span className="font-semibold text-muted-foreground">Entering Dew Point (estimated):</span>
                      <strong className="font-bold text-foreground font-mono">
                        {(calc.wbInC - (calc.dbInC - calc.wbInC) / 3).toFixed(1)} °C
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                      <span className="font-semibold text-muted-foreground">Enthalpy Difference (Δh):</span>
                      <strong className="font-bold text-primary font-mono">
                        {(calc.hIn - calc.hOut).toFixed(1)} kJ/kg
                      </strong>
                    </div>
                  </div>
                </div>

                {/* SVG Visual Load Breakdown Chart */}
                {(() => {
                  const bars = [
                    { label: "Sensible Load", value: calc.sensLoad, color: "#0A7BC7", display: `${calc.sensLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${uL} (${Math.round(calc.shr * 100)}%)` },
                    { label: "Latent Load",   value: calc.latLoad,  color: "#7C3AED", display: `${calc.latLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${uL} (${Math.round((1 - calc.shr) * 100)}%)` },
                  ];
                  const maxVal = Math.max(...bars.map(b => b.value)) * 1.2 || 1;
                  return (
                    <div className="flex flex-col gap-2 bg-card p-4.5 border border-border rounded-2xl shadow-2xs select-none">
                      <div className="flex items-center justify-between pb-2 border-b border-border/50">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Sensible vs Latent Heat Distribution
                        </h4>
                        <span className="text-[11px] text-muted-foreground font-semibold">
                          Total: <strong className="text-foreground font-mono">{calc.totLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL}</strong>
                        </span>
                      </div>
                      <svg viewBox="0 0 500 95" className="w-full h-auto block overflow-visible mt-1">
                        {bars.map((b, i) => {
                          const bw = 34;
                          const bh = 18;
                          const y = 14 + i * (bw + 2);
                          const bWidth = Math.max(4, (b.value / maxVal) * 330);
                          return (
                            <g key={i}>
                              <text x={110} y={y + bh / 2 + 3.5} textAnchor="end" fontSize="10" fontWeight="700" fill="currentColor" className="fill-muted-foreground font-sans">
                                {b.label}
                              </text>
                              <rect x={118} y={y} width={bWidth} height={bh} fill={b.color} rx="4" />
                              <text x={124 + bWidth} y={y + bh / 2 + 3.5} textAnchor="start" fontSize="10" fontWeight="800" fill={b.color} className="font-mono">
                                {b.display}
                              </text>
                            </g>
                          );
                        })}
                        <line x1={118} y1={10} x2={118} y2={85} stroke="currentColor" strokeWidth="1" className="stroke-border" />
                      </svg>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* Engineering Report Tab */
            <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 shadow-xs max-w-4xl mx-auto w-full">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/70">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Project &amp; Calculation Report Details</h2>
                  <p className="text-xs text-muted-foreground">Configure metadata for official consultant submission and documentation.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-foreground text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="size-3.5 text-emerald-600" />
                    <span>Download Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintPDF}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-full border border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
                  >
                    <FileText className="size-3.5" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-muted-foreground">Project Name</label>
                  <input
                    type="text"
                    value={projectInfo.projectName}
                    onChange={(e) => setProjectInfo({ ...projectInfo, projectName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 font-semibold outline-none focus:border-primary text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-muted-foreground">Project Reference Number</label>
                  <input
                    type="text"
                    value={projectInfo.projectNumber}
                    onChange={(e) => setProjectInfo({ ...projectInfo, projectNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 font-semibold outline-none focus:border-primary text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-muted-foreground">Consultant Name</label>
                  <input
                    type="text"
                    value={projectInfo.consultant}
                    onChange={(e) => setProjectInfo({ ...projectInfo, consultant: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 font-semibold outline-none focus:border-primary text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-muted-foreground">Client Name</label>
                  <input
                    type="text"
                    value={projectInfo.client}
                    onChange={(e) => setProjectInfo({ ...projectInfo, client: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 font-semibold outline-none focus:border-primary text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-muted-foreground">Calculation Number</label>
                  <input
                    type="text"
                    value={projectInfo.calcNumber}
                    onChange={(e) => setProjectInfo({ ...projectInfo, calcNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 font-semibold outline-none focus:border-primary text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-muted-foreground">Revision</label>
                  <input
                    type="text"
                    value={projectInfo.revision}
                    onChange={(e) => setProjectInfo({ ...projectInfo, revision: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 font-semibold outline-none focus:border-primary text-foreground"
                  />
                </div>
              </div>

              {/* Sizing Summary Preview Table */}
              <div className="flex flex-col gap-3 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Executive Sizing Summary</h3>
                <div className="border border-border rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-muted-foreground font-bold">
                      <tr>
                        <th className="p-2.5 border-b border-border">Parameter</th>
                        <th className="p-2.5 border-b border-border">Design Value</th>
                        <th className="p-2.5 border-b border-border">Engineering Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      <tr>
                        <td className="p-2.5 font-semibold text-muted-foreground">Total Fresh Air Coil Capacity</td>
                        <td className="p-2.5 font-bold text-primary font-mono">{calc.capacityTons.toFixed(2)} TR ({calc.totKw.toFixed(2)} kW)</td>
                        <td className="p-2.5 text-muted-foreground">ASHRAE Psychrometric Model (+{safetyFactor}% SF)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold text-muted-foreground">Sensible Heat Duty</td>
                        <td className="p-2.5 font-bold font-mono text-foreground">{calc.sensLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL} ({calc.sensKw.toFixed(2)} kW)</td>
                        <td className="p-2.5 text-muted-foreground">ΔT: {(Math.abs(calc.dbInC - calc.dbOutC)).toFixed(1)} °C</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold text-muted-foreground">Latent Dehumidification Duty</td>
                        <td className="p-2.5 font-bold font-mono text-foreground">{calc.latLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL} ({calc.latKw.toFixed(2)} kW)</td>
                        <td className="p-2.5 text-muted-foreground">ΔW: {(Math.max(0, calc.wIn - calc.wOut)).toFixed(ip ? 2 : 5)} {uW}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold text-muted-foreground">Estimated Condensate Drain Flow</td>
                        <td className="p-2.5 font-bold font-mono text-foreground">{calc.condensateKgH.toFixed(1)} L/h ({calc.condensateGph.toFixed(2)} GPH)</td>
                        <td className="p-2.5 text-muted-foreground">Gravity drain pipe sizing basis</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task & Comment Assignment Modal */}
      <AssignCommentModal
        isOpen={commentModalOpen}
        onClose={() => {
          setCommentModalOpen(false);
          setCommentTargetItem(null);
        }}
        targetId={commentTargetItem?.id || "fresh-air-coil-duty"}
        targetName={commentTargetItem?.name || "Fresh Air Cooling Coil"}
        targetType="equipment"
        onSave={(comment) => {
          const updated = [comment, ...commentsList];
          saveComments(updated);

          // Dispatch notification if assigned
          if (comment.assignedTo && api.sendNotification) {
            api.sendNotification({
              recipientId: comment.assignedTo,
              senderId: userData?.id || profile?.id || "unknown",
              senderName: currentUserName,
              type: "TASK_ASSIGNED",
              title: `Task assigned: ${commentTargetItem?.name || "Fresh Air Cooling Coil"}`,
              message: comment.text,
              link: "/fresh-air-cooling-load",
            }).catch(console.error);
          }
        }}
      />
    </AppShell>
  );
}
