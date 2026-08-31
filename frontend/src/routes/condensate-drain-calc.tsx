import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { cToF, fToC, lpsToCfm, cfmToLps, lpsToGpm, gpmToLps } from "@/utils/conversions";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  Download, Upload, Plus, Trash2, Save, FileSpreadsheet,
  Printer, HelpCircle, MessageSquare, Droplets, Activity,
  Gauge, AlertTriangle, CheckCircle2, ShieldCheck, RefreshCw, Pipe
} from "lucide-react";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { api } from "@/services/api";

export const Route = createFileRoute("/condensate-drain-calc")({
  head: () => ({
    meta: [
      { title: "Coil Condensate Calculator — MEP Calc" },
      { name: "description", content: "AC cooling coil condensation schedule sizer, moisture extraction, and drain pipe calculator." },
    ],
  }),
  component: CondensateDrainCalcPage,
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

// IPC / ASHRAE standard condensate drain pipe sizing lookup based on TR & flow
function getRecommendedPipeSize(totalTr: number, totalGpm: number, unitSystem: "si" | "ip"): { sizeInches: string; sizeMm: number; minSlope: string } {
  if (totalTr <= 20 || totalGpm <= 0.5) return { sizeInches: '1.00" (DN25)', sizeMm: 25, minSlope: "1% (1/8\" per ft)" };
  if (totalTr <= 40 || totalGpm <= 1.0) return { sizeInches: '1.25" (DN32)', sizeMm: 32, minSlope: "1% (1/8\" per ft)" };
  if (totalTr <= 90 || totalGpm <= 2.25) return { sizeInches: '1.50" (DN40)', sizeMm: 40, minSlope: "1% (1/8\" per ft)" };
  if (totalTr <= 125 || totalGpm <= 3.125) return { sizeInches: '2.00" (DN50)', sizeMm: 50, minSlope: "1% (1/8\" per ft)" };
  if (totalTr <= 250 || totalGpm <= 6.25) return { sizeInches: '2.50" (DN65)', sizeMm: 65, minSlope: "1% (1/8\" per ft)" };
  if (totalTr <= 420 || totalGpm <= 10.5) return { sizeInches: '3.00" (DN80)', sizeMm: 80, minSlope: "1% (1/8\" per ft)" };
  if (totalTr <= 1000 || totalGpm <= 25.0) return { sizeInches: '4.00" (DN100)', sizeMm: 100, minSlope: "1% (1/8\" per ft)" };
  return { sizeInches: '6.00" (DN150)', sizeMm: 150, minSlope: "1% (1/8\" per ft)" };
}

interface CoilRow {
  id: string;
  name: string;
  dbIn: number;
  wbIn: number;
  dbOut: number;
  wbOut: number;
  flow: number;
}

function CondensateDrainCalcPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, forceSaveToCloud } = useWorkspace();
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [rows, setRows] = useState<CoilRow[]>([
    { id: "coil-1", name: "AHU-01 (Primary Plant)", dbIn: 26.0, wbIn: 19.5, dbOut: 13.0, wbOut: 12.0, flow: 1500 },
    { id: "coil-2", name: "FCU-01 (Level 01 East)", dbIn: 24.0, wbIn: 17.5, dbOut: 14.0, wbOut: 13.0, flow: 450 },
    { id: "coil-3", name: "FCU-02 (Level 01 West)", dbIn: 24.0, wbIn: 17.5, dbOut: 14.0, wbOut: 13.0, flow: 450 },
    { id: "coil-4", name: "FAHU-01 (Makeup Air)", dbIn: 35.0, wbIn: 25.5, dbOut: 13.0, wbOut: 12.5, flow: 1000 }
  ]);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  const [projectInfo, setProjectInfo] = useState({
    projectName: "Tower Condensate Collection Network",
    projectNumber: "MEP-CD-01",
    client: "Emaar Properties",
    consultant: "Consistent Engineering Consultants",
    date: new Date().toISOString().split("T")[0],
    revision: "Rev 0",
    calcNumber: "CALC-HVAC-CD01",
    notes: "Multi-coil moisture dehumidification extraction schedule and main gravity drain header sizing report.",
  });

  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [showFormulaPanel, setShowFormulaPanel] = useState(false);

  // Comment System State
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);

  const [newCoil, setNewCoil] = useState<{
    name: string;
    dbIn: number | "";
    wbIn: number | "";
    dbOut: number | "";
    wbOut: number | "";
    flow: number | "";
  }>({
    name: "",
    dbIn: "",
    wbIn: "",
    dbOut: "",
    wbOut: "",
    flow: ""
  });

  const ip = unitSystem === "ip";

  useEffect(() => {
    try {
      const pId = project?.id || "default";
      const savedComments = localStorage.getItem(`mep_calc_comments_${pId}_/condensate-drain-calc`);
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
      localStorage.setItem(`mep_calc_comments_${pId}_/condensate-drain-calc`, JSON.stringify(newList));
    } catch (e) {
      console.error(e);
    }
  };

  // Load state on project change
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_condensate_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.rows) setRows(data.rows);
        if (data.projectInfo) setProjectInfo(data.projectInfo);
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load condensate calculation", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        unitSystem,
        rows,
        projectInfo
      };
      localStorage.setItem(`mep_condensate_calc_${project.id}`, JSON.stringify(dataToSave));
    }
  }, [project?.id, loadedProjectId, unitSystem, rows, projectInfo]);

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;
    setUnitSystem(unit);
    dirtyStore.set(true);
    if ((window as any).__mep_keep_values) return;
    const convT = (t: number) => unit === "ip" ? cToF(t) : fToC(t);
    const convF = (f: number) => unit === "ip" ? lpsToCfm(f) : cfmToLps(f);

    setRows(rows.map(r => ({
      ...r,
      dbIn: Number(convT(r.dbIn).toFixed(1)),
      wbIn: Number(convT(r.wbIn).toFixed(1)),
      dbOut: Number(convT(r.dbOut).toFixed(1)),
      wbOut: Number(convT(r.wbOut).toFixed(1)),
      flow: Number(convF(r.flow).toFixed(0))
    })));

    setNewCoil(prev => ({
      ...prev,
      dbIn: prev.dbIn !== "" ? Number(convT(Number(prev.dbIn)).toFixed(1)) : "",
      wbIn: prev.wbIn !== "" ? Number(convT(Number(prev.wbIn)).toFixed(1)) : "",
      dbOut: prev.dbOut !== "" ? Number(convT(Number(prev.dbOut)).toFixed(1)) : "",
      wbOut: prev.wbOut !== "" ? Number(convT(Number(prev.wbOut)).toFixed(1)) : "",
      flow: prev.flow !== "" ? Number(convF(Number(prev.flow)).toFixed(0)) : ""
    }));
  };

  const calculatedRows = useMemo(() => {
    const pAtm = 101325;
    return rows.map(r => {
      const dbInC = ip ? fToC(r.dbIn) : r.dbIn;
      const wbInC = ip ? fToC(r.wbIn) : r.wbIn;
      const dbOutC = ip ? fToC(r.dbOut) : r.dbOut;
      const wbOutC = ip ? fToC(r.wbOut) : r.wbOut;

      let wIn = 0, wOut = 0;
      try { wIn = wFromWB(dbInC, wbInC, pAtm); } catch (e) {}
      try { wOut = wFromWB(dbOutC, wbOutC, pAtm); } catch (e) {}

      const dw = Math.max(0, wIn - wOut);
      // Flow conversion
      const flowLps = ip ? cfmToLps(r.flow) : r.flow;
      const flowM3s = flowLps / 1000;
      const flowCfm = ip ? r.flow : lpsToCfm(r.flow);
      const massAirFlow = flowM3s * 1.2; // kg/s dry air
      
      const condLps = massAirFlow * dw; // L/s condensate (density 1 kg/L)
      const condLph = condLps * 3600; // L/h
      const condGpm = lpsToGpm(condLps); // GPM
      const condGph = condGpm * 60; // GPH

      // Coil Thermal Load approximation
      const cp = 1.006;
      const hfg = 2501;
      const sensKw = massAirFlow * cp * Math.max(0, dbInC - dbOutC);
      const latKw = massAirFlow * dw * hfg;
      const totKw = sensKw + latKw;
      const capTr = totKw / 3.51685;

      return {
        ...r,
        wIn,
        wOut,
        dw,
        flowLps,
        flowCfm,
        massAirFlow,
        condLps,
        condLph,
        condGpm,
        condGph,
        sensKw,
        latKw,
        totKw,
        capTr
      };
    });
  }, [rows, ip]);

  const totals = useMemo(() => {
    const totalFlow = rows.reduce((a, b) => a + b.flow, 0);
    const totalCondLps = calculatedRows.reduce((a, b) => a + b.condLps, 0);
    const totalCondLph = calculatedRows.reduce((a, b) => a + b.condLph, 0);
    const totalCondGpm = calculatedRows.reduce((a, b) => a + b.condGpm, 0);
    const totalCondGph = calculatedRows.reduce((a, b) => a + b.condGph, 0);
    const totalTr = calculatedRows.reduce((a, b) => a + b.capTr, 0);
    const totalKw = calculatedRows.reduce((a, b) => a + b.totKw, 0);

    const recommendedPipe = getRecommendedPipeSize(totalTr, totalCondGpm, unitSystem);

    return {
      totalFlow,
      totalCondLps,
      totalCondLph,
      totalCondGpm,
      totalCondGph,
      totalTr,
      totalKw,
      recommendedPipe
    };
  }, [calculatedRows, rows, unitSystem]);

  const handleAddCoil = () => {
    if (!newCoil.name) {
      toast.error("Please enter a unit reference name.");
      return;
    }
    const id = "coil-" + Date.now();
    const dbIn = newCoil.dbIn !== "" ? Number(newCoil.dbIn) : (ip ? 75.2 : 24.0);
    const wbIn = newCoil.wbIn !== "" ? Number(newCoil.wbIn) : (ip ? 62.6 : 17.0);
    const dbOut = newCoil.dbOut !== "" ? Number(newCoil.dbOut) : (ip ? 57.2 : 14.0);
    const wbOut = newCoil.wbOut !== "" ? Number(newCoil.wbOut) : (ip ? 55.4 : 13.0);
    const flow = newCoil.flow !== "" ? Number(newCoil.flow) : (ip ? 1000 : 500);

    setRows([...rows, { id, name: newCoil.name, dbIn, wbIn, dbOut, wbOut, flow }]);
    dirtyStore.set(true);
    setNewCoil({
      name: "",
      dbIn: "",
      wbIn: "",
      dbOut: "",
      wbOut: "",
      flow: ""
    });
    toast.success(`Added unit ${newCoil.name}`);
  };

  const handleDeleteCoil = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
    dirtyStore.set(true);
  };

  const handleExportExcel = async () => {
    const exceljsModule = await import('exceljs');
    const ExcelJS = exceljsModule.default || (window as any).ExcelJS;
    const fileSaverModule = await import('file-saver');
    const saveAs = fileSaverModule.saveAs || fileSaverModule.default?.saveAs || fileSaverModule.default || ((window as any).saveAs);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Condensate Schedule");

    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(3).width = 18;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 20;
    sheet.getColumn(6).width = 20;
    sheet.getColumn(7).width = 22;

    sheet.mergeCells("A1:G1");
    const cellA1 = sheet.getCell("A1");
    cellA1.value = "COIL CONDENSATE EXTRACTION & DRAIN SIZING REPORT";
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

    const uTemp = ip ? "°F" : "°C";
    const uFlow = ip ? "CFM" : "L/s";

    sheet.addRow([]);
    sheet.addRow(["Moisture Extraction Schedule"]);
    sheet.getCell("A10").font = { name: "Segoe UI", size: 12, bold: true };

    const headerRow = sheet.addRow([
      "Unit Ref",
      `On-Coil DB/WB (${uTemp})`,
      `Off-Coil DB/WB (${uTemp})`,
      `Airflow (${uFlow})`,
      "On-Coil W (kg/kg)",
      "Off-Coil W (kg/kg)",
      ip ? "Condensate Flow (GPH)" : "Condensate Flow (L/h)",
    ]);
    headerRow.font = { name: "Segoe UI", bold: true };

    calculatedRows.forEach(r => {
      sheet.addRow([
        r.name,
        `${r.dbIn} / ${r.wbIn}`,
        `${r.dbOut} / ${r.wbOut}`,
        r.flow,
        Number(r.wIn.toFixed(6)),
        Number(r.wOut.toFixed(6)),
        ip ? Number(r.condGph.toFixed(2)) : Number(r.condLph.toFixed(2))
      ]);
    });

    sheet.addRow([]);
    sheet.addRow(["Network Drainage Totals"]);
    sheet.getCell("A" + (sheet.rowCount)).font = { name: "Segoe UI", size: 12, bold: true };
    sheet.addRow(["Total Airflow", `${totals.totalFlow.toLocaleString()} ${uFlow}`]);
    sheet.addRow(["Total Condensate Flow", `${totals.totalCondLph.toFixed(2)} L/h (${totals.totalCondGpm.toFixed(3)} GPM / ${totals.totalCondGph.toFixed(2)} GPH)`]);
    sheet.addRow(["Total Equivalent Coil Load", `${totals.totalTr.toFixed(2)} TR (${totals.totalKw.toFixed(2)} kW)`]);
    sheet.addRow(["Recommended Main Drain Header", `${totals.recommendedPipe.sizeInches} (Min Slope: ${totals.recommendedPipe.minSlope})`]);

    const sigRow = (sheet as any).rowCount ? (sheet as any).rowCount + 2 : 25;
    addExcelSignatureBlock(sheet, sigRow, currentUserName, project?.id || "default", "condensate-drain-calc");
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${projectInfo.projectName.replace(/\s+/g, "_")}_condensate_drain_report.xlsx`);
  };

  const handlePrintPDF = async () => {
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF("p", "pt", "a4");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("COIL CONDENSATE DRAIN SIZING REPORT", 40, 50);

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
        ["Project Name", projectInfo.projectName, "Standard", "ASHRAE Psychrometrics & IPC 314"],
        ["Project Number", projectInfo.projectNumber, "Consultant", projectInfo.consultant],
        ["Client", projectInfo.client, "Revision", projectInfo.revision],
      ],
      theme: "grid",
      headStyles: { fillColor: [10, 123, 199], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
    });

    const uTemp = ip ? "°F" : "°C";
    const uFlow = ip ? "CFM" : "L/s";

    // Schedule Table
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [["Unit Ref", `Entering DB/WB`, `Leaving DB/WB`, `Air Flow (${uFlow})`, "ΔW (g/kg)", ip ? "Flow (GPH)" : "Flow (L/h)"]],
      body: calculatedRows.map(r => [
        r.name,
        `${r.dbIn} / ${r.wbIn} ${uTemp}`,
        `${r.dbOut} / ${r.wbOut} ${uTemp}`,
        `${r.flow.toLocaleString()}`,
        `${(r.dw * 1000).toFixed(2)}`,
        ip ? `${r.condGph.toFixed(2)} GPH` : `${r.condLph.toFixed(2)} L/h`
      ]),
      theme: "striped",
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 8.5, cellPadding: 4 },
    });

    // Summary & Header Sizing Table
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [["System Metric", "Design Calculated Value", "Engineering Recommendation"]],
      body: [
        ["Total Active Coils", `${calculatedRows.length} Units`, "Multi-branch collection schedule"],
        ["Total Airflow Handled", `${totals.totalFlow.toLocaleString()} ${uFlow}`, "Aggregate system volumetric rate"],
        ["Total Condensate Generation", `${totals.totalCondLph.toFixed(2)} L/h (${totals.totalCondGpm.toFixed(3)} GPM / ${totals.totalCondGph.toFixed(2)} GPH)`, "Peak moisture load extraction"],
        ["Total Thermal Coil Duty", `${totals.totalTr.toFixed(2)} TR (${totals.totalKw.toFixed(2)} kW)`, "Nominal cooling plant equivalence"],
        ["Recommended Gravity Header Size", `${totals.recommendedPipe.sizeInches}`, `IPC / ASHRAE standard min slope: ${totals.recommendedPipe.minSlope}`],
      ],
      theme: "grid",
      headStyles: { fillColor: [10, 123, 199], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 5 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 25;
    addPdfSignatureBlock(doc, finalY, currentUserName, project?.id || "default", "condensate-drain-calc");
    doc.save(`${projectInfo.projectName.replace(/\s+/g, "_")}_condensate_drain_report.pdf`);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      projectInfo, rows, unitSystem
    }));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${projectInfo.projectName.replace(/\s+/g, "_")}_condensate_drain.json`);
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
        if (parsed.rows) setRows(parsed.rows);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
        toast.success("Imported calculation scenario successfully!");
      } catch (err) {
        toast.error("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const uTemp = ip ? "°F" : "°C";
  const uFlow = ip ? "CFM" : "L/s";

  return (
    <AppShell title="Condensate Drain Calc" hideSubHeader={true}>
      <div className="flex flex-col h-full min-h-0 bg-transparent font-sans">
        {/* Review Lifecycle Status Bar */}
        <CalculationReviewBar
          projectId={project?.id || "default"}
          calculatorPath="/condensate-drain-calc"
          calculatorTitle="Coil Condensate Calculator"
        />

        <div className="flex-1 min-w-0 flex flex-col pt-3 gap-4 overflow-y-auto h-full px-6 pb-8">
          {/* Header & Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 select-none pb-2 border-b border-border/50">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                HVAC &gt; LOAD &amp; VENTILATION &gt; CONDENSATE DRAIN CALC
              </span>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Coil Condensate Calculator</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded-full border border-primary/20">
                  IPC 314 &amp; ASHRAE Psychrometric Model
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Input on-coil and off-coil air conditions for multiple cooling units to size aggregate condensate drainage and header pipes.
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
                  Schedule &amp; Sizer
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
                  setCommentTargetItem({ id: "condensate-network-duty", name: "Condensate Drain Header Network" });
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
                  Engineering Condensate &amp; Pipe Sizing Standards
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
                  <strong className="text-foreground block mb-1">1. Moisture Extraction (ṁ_cond):</strong>
                  <code className="text-[11px] text-primary font-mono block">ṁ_cond = ṁ_air · (W_in - W_out)</code>
                  <span>Exact mass balance of condensed water vapor extracted per coil.</span>
                </div>
                <div className="p-2.5 bg-background/60 rounded-xl border border-border/50">
                  <strong className="text-foreground block mb-1">2. Network Total Flow:</strong>
                  <code className="text-[11px] text-primary font-mono block">Q_drain = Σ ṁ_cond (L/h or GPM)</code>
                  <span>Simultaneous collection rate from all branch AC units and AHUs.</span>
                </div>
                <div className="p-2.5 bg-background/60 rounded-xl border border-border/50">
                  <strong className="text-foreground block mb-1">3. IPC 314 Gravity Sizing:</strong>
                  <code className="text-[11px] text-primary font-mono block">1" ≤ 20TR | 1¼" ≤ 40TR | 1½" ≤ 90TR | 2" ≤ 125TR</code>
                  <span>Minimum 1% uniform slope for gravity discharge without backup.</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "calculator" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Schedule & Coils Table */}
              <div className="lg:col-span-8 flex flex-col gap-5">
                {/* Unit toggle & Actions */}
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
                      <span>PDF</span>
                    </button>
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

                {/* Add Coil Input Card */}
                <div className="bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-[#0A7BC7] rounded-full" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Add Cooling Coil Unit
                      </h3>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Enter on-coil/off-coil psychrometric states
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="font-semibold text-muted-foreground">Unit Reference</label>
                      <input
                        type="text"
                        placeholder="e.g. AHU-02"
                        value={newCoil.name}
                        onChange={(e) => setNewCoil({ ...newCoil, name: e.target.value })}
                        className="bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-primary text-foreground"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-muted-foreground">On DB ({uTemp})</label>
                      <input
                        type="number"
                        step="any"
                        placeholder={ip ? "75.2" : "24.0"}
                        value={newCoil.dbIn}
                        onChange={(e) => setNewCoil({ ...newCoil, dbIn: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-primary text-foreground"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-muted-foreground">On WB ({uTemp})</label>
                      <input
                        type="number"
                        step="any"
                        placeholder={ip ? "62.6" : "17.0"}
                        value={newCoil.wbIn}
                        onChange={(e) => setNewCoil({ ...newCoil, wbIn: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-primary text-foreground"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-muted-foreground">Off DB ({uTemp})</label>
                      <input
                        type="number"
                        step="any"
                        placeholder={ip ? "57.2" : "14.0"}
                        value={newCoil.dbOut}
                        onChange={(e) => setNewCoil({ ...newCoil, dbOut: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-primary text-foreground"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-muted-foreground">Off WB ({uTemp})</label>
                      <input
                        type="number"
                        step="any"
                        placeholder={ip ? "55.4" : "13.0"}
                        value={newCoil.wbOut}
                        onChange={(e) => setNewCoil({ ...newCoil, wbOut: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-primary text-foreground"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
                    <div className="flex items-center gap-2 text-xs">
                      <label className="font-semibold text-muted-foreground">Airflow Rate ({uFlow}):</label>
                      <input
                        type="number"
                        step="any"
                        placeholder={ip ? "1000" : "500"}
                        value={newCoil.flow}
                        onChange={(e) => setNewCoil({ ...newCoil, flow: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="w-28 bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-primary text-foreground"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCoil}
                      className="px-4 py-1.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
                    >
                      <Plus className="size-3.5" />
                      <span>Add Coil to Schedule</span>
                    </button>
                  </div>
                </div>

                {/* Coils Table */}
                <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border/60">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Active Moisture Extraction Schedule ({calculatedRows.length} Coils)
                    </h3>
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      Total Condensate: <strong className="text-primary font-mono">{totals.totalCondLph.toFixed(1)} L/h ({totals.totalCondGph.toFixed(1)} GPH)</strong>
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-border text-muted-foreground font-bold">
                          <th className="py-2.5 px-3">Unit Ref</th>
                          <th className="py-2.5 px-3">On DB / WB</th>
                          <th className="py-2.5 px-3">Off DB / WB</th>
                          <th className="py-2.5 px-3">Airflow ({uFlow})</th>
                          <th className="py-2.5 px-3">ΔW (g/kg)</th>
                          <th className="py-2.5 px-3 text-primary">Condensate Flow</th>
                          <th className="py-2.5 px-3">Equiv. Load</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono text-foreground">
                        {calculatedRows.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="py-2.5 px-3 font-sans font-semibold text-xs text-foreground flex items-center gap-1.5">
                              <span>{r.name}</span>
                            </td>
                            <td className="py-2.5 px-3 text-xs">{r.dbIn}/{r.wbIn} {uTemp}</td>
                            <td className="py-2.5 px-3 text-xs">{r.dbOut}/{r.wbOut} {uTemp}</td>
                            <td className="py-2.5 px-3 text-xs font-bold">{r.flow.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-xs font-semibold">{(r.dw * 1000).toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-xs font-bold text-primary">
                              {r.condLph.toFixed(1)} L/h <span className="text-[10px] text-muted-foreground font-normal">({r.condGph.toFixed(2)} GPH)</span>
                            </td>
                            <td className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">
                              {r.capTr.toFixed(1)} TR
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteCoil(r.id)}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Remove Coil"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: Sizing Totals & Recommended Header */}
              <div className="lg:col-span-4 flex flex-col gap-5">
                {/* Main Recommended Pipe Header Card */}
                <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-5 flex flex-col gap-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-primary/15">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Droplets className="size-3.5 text-primary" />
                      Recommended Main Drain Pipe
                    </span>
                    <span className="text-[10px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-full">
                      IPC 314 Sized
                    </span>
                  </div>

                  <div className="my-2 flex flex-col">
                    <div className="text-2xl sm:text-3xl font-extrabold text-primary font-mono tracking-tight">
                      {totals.recommendedPipe.sizeInches}
                    </div>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      Standard Internal Nominal Diameter
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-primary/15 pt-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Required Uniform Slope:</span>
                      <strong className="text-foreground font-mono">{totals.recommendedPipe.minSlope}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Metric Equivalent Size:</span>
                      <strong className="text-foreground font-mono">DN {totals.recommendedPipe.sizeMm} mm</strong>
                    </div>
                  </div>
                </div>

                {/* Sizing Totals Card */}
                <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-primary rounded-full" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Network Aggregate Totals
                      </h3>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                      <span className="font-semibold text-muted-foreground">Total Airflow Handled:</span>
                      <strong className="font-bold text-foreground font-mono">
                        {totals.totalFlow.toLocaleString()} {uFlow}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                      <span className="font-semibold text-muted-foreground">Total Condensate Rate:</span>
                      <strong className="font-bold text-primary text-sm font-mono">
                        {totals.totalCondLph.toFixed(2)} L/h
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                      <span className="font-semibold text-muted-foreground">Imperial Rate (GPM / GPH):</span>
                      <strong className="font-bold text-foreground font-mono">
                        {totals.totalCondGpm.toFixed(3)} GPM ({totals.totalCondGph.toFixed(1)} GPH)
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                      <span className="font-semibold text-muted-foreground">Instantaneous Rate (L/s):</span>
                      <strong className="font-bold text-foreground font-mono">
                        {totals.totalCondLps.toFixed(4)} L/s
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1.5">
                      <span className="font-semibold text-muted-foreground">Total Equivalent Coil Sizing:</span>
                      <strong className="font-bold text-foreground font-mono">
                        {totals.totalTr.toFixed(2)} TR ({totals.totalKw.toFixed(1)} kW)
                      </strong>
                    </div>
                  </div>
                </div>

                {/* IPC 314 Standard Reference Card */}
                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 border border-border rounded-2xl flex flex-col gap-2 text-xs select-none">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/50">
                    IPC 314 Gravity Sizing Rule of Thumb
                  </h4>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground font-mono">
                    <span>Up to 20 TR: 1.00"</span>
                    <span>21 - 40 TR: 1.25"</span>
                    <span>41 - 90 TR: 1.50"</span>
                    <span>91 - 125 TR: 2.00"</span>
                    <span>126 - 250 TR: 2.50"</span>
                    <span>251 - 420 TR: 3.00"</span>
                  </div>
                </div>
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
                    className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="size-3.5" />
                    <span>Print PDF</span>
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
                        <td className="p-2.5 font-semibold text-muted-foreground">Recommended Gravity Header Size</td>
                        <td className="p-2.5 font-bold text-primary font-mono">{totals.recommendedPipe.sizeInches}</td>
                        <td className="p-2.5 text-muted-foreground">IPC 314 &amp; ASHRAE uniform slope standard</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold text-muted-foreground">Total Condensate Extraction</td>
                        <td className="p-2.5 font-bold font-mono text-foreground">{totals.totalCondLph.toFixed(2)} L/h ({totals.totalCondGpm.toFixed(3)} GPM)</td>
                        <td className="p-2.5 text-muted-foreground">Combined rate from all {calculatedRows.length} units</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold text-muted-foreground">Total Airflow Volume</td>
                        <td className="p-2.5 font-bold font-mono text-foreground">{totals.totalFlow.toLocaleString()} {uFlow}</td>
                        <td className="p-2.5 text-muted-foreground">Sum of scheduled fans</td>
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
        targetId={commentTargetItem?.id || "condensate-network-duty"}
        targetName={commentTargetItem?.name || "Condensate Drain Header Network"}
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
              title: `Task assigned: ${commentTargetItem?.name || "Condensate Drain Header Network"}`,
              message: comment.text,
              link: "/condensate-drain-calc",
            }).catch(console.error);
          }
        }}
      />
    </AppShell>
  );
}
