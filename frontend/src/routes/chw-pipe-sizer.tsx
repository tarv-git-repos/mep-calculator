import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  Download, Upload, Sparkles, AlertTriangle, CheckCircle2,
  Info, Gauge, FileText, Printer, FileSpreadsheet, Bookmark, HelpCircle, Wrench
} from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";

export const Route = createFileRoute("/chw-pipe-sizer")({
  head: () => ({
    meta: [
      { title: "CHW Pipe Sizer — MEP Calc" },
      { name: "description", content: "Chilled water and condenser water pipe sizer based on flowrate, fluid type, and target pressure drop." },
    ],
  }),
  component: ChwPipeSizerPage,
});

const pipeTable: Record<string, number> = {
  0.5: 15.80, 0.75: 20.93, 1.0: 26.64, 1.25: 35.05, 1.5: 40.89,
  2.0: 52.50, 2.5: 62.71, 3.0: 77.93, 3.5: 90.12, 4.0: 102.26,
  5.0: 128.19, 6.0: 154.05, 8.0: 202.72, 10.0: 254.46, 12.0: 303.23
};

const GLYCOL_VISC: Record<string, number> = { chw: 1, cw: 1, g25: 1.8, g40: 2.6 };
const GLYCOL_DENS: Record<string, number> = { chw: 1, cw: 1, g25: 1.03, g40: 1.05 };

function colebrook(Re: number, relR: number): number {
  if (Re <= 0) return 0.1;
  if (Re < 2300) return 64 / Re;
  let f = 0.25 / Math.pow(Math.log(relR / 3.7 + 5.74 / Math.pow(Re, 0.9)) / Math.LN10, 2);
  for (let i = 0; i < 80; i++) {
    const r = -2 * Math.log((relR / 3.7) + (2.51 / (Re * Math.sqrt(f)))) / Math.LN10;
    const fn = 1 / (r * r);
    if (Math.abs(fn - f) < 1e-10) {
      f = fn;
      break;
    }
    f = fn;
  }
  return f;
}

function waterDens(tC: number): number {
  return 999.842594 + 6.793952e-2 * tC - 9.09529e-3 * Math.pow(tC, 2) + 1.001685e-4 * Math.pow(tC, 3) - 1.120083e-6 * Math.pow(tC, 4) + 6.536332e-9 * Math.pow(tC, 5);
}

function waterVisc(tC: number): number {
  return 2.414e-5 * Math.pow(10, 247.8 / (tC + 406.15));
}

function fToC(f: number): number {
  return (f - 32) * 5 / 9;
}

function ChwPipeSizerPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, forceSaveToCloud } = useWorkspace();
  // State matching the original defaults for IP mode
  const [projectInfo, setProjectInfo] = useState({
    projectName: "Commercial Tower CHW Sizing",
    projectNumber: "MEP-CHW-02",
    client: "Summit Estates Ltd",
    consultant: "Consistent Engineering Consultants",
    date: new Date().toISOString().split("T")[0],
    revision: "Rev 0",
    calcNumber: "CALC-HVAC-CHW02",
    notes: "Chilled water distribution pipe sizing study to identify optimal NPS sizes and pressure drops.",
  });

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");

  const [sizingParams, setSizingParams] = useState({
    flowRate: "" as number | "",
    fluidType: "chw" as "chw" | "cw" | "g25" | "g40",
    temperature: "" as number | "",
    materialRoughness: 0.000046, // Carbon Steel in meters
    targetDp: "" as number | "",
  });

  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [showFormulaPanel, setShowFormulaPanel] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("chw_pipe_sizer_params");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sizingParams) {
          let loadedParams = { ...parsed.sizingParams };
          // Migrate old mm roughness values (>= 0.001) to meters
          if (loadedParams.materialRoughness >= 0.001) {
            loadedParams.materialRoughness = loadedParams.materialRoughness / 1000;
          }
          setSizingParams(loadedParams);
        }
        if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
        setHasCalculated(true); // Automatically show results if we have loaded parameters
      }
    } catch (e) {
      console.error(e);
      if (project?.id) setLoadedProjectId(project.id); else setLoadedProjectId("loaded");
    }
  }, []);

  const saveParams = (params: typeof sizingParams, unit: "si" | "ip", proj: typeof projectInfo) => {
    setSizingParams(params);
    setUnitSystem(unit);
    if ((window as any).__mep_keep_values) return;
    setProjectInfo(proj);
  };

  useEffect(() => {
    try {
      localStorage.setItem("chw_pipe_sizer_params", JSON.stringify({ sizingParams, unitSystem, projectInfo }));
      dirtyStore.set(true);
    } catch (e) {
      console.error(e);
    }
  }, [sizingParams, unitSystem, projectInfo]);

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;

    let nextFlow = sizingParams.flowRate;
    let nextDp = sizingParams.targetDp;
    let nextTemp = sizingParams.temperature;

    if (unit === "ip") {
      // SI -> IP
      nextFlow = sizingParams.flowRate !== "" ? Number((Number(sizingParams.flowRate) * 15.8503).toFixed(1)) : "";
      nextDp = sizingParams.targetDp !== "" ? Number((Number(sizingParams.targetDp) / 22.62).toFixed(2)) : "";
      nextTemp = sizingParams.temperature !== "" ? Number((Number(sizingParams.temperature) * 1.8 + 32).toFixed(1)) : "";
    } else {
      // IP -> SI
      nextFlow = sizingParams.flowRate !== "" ? Number((Number(sizingParams.flowRate) / 15.8503).toFixed(2)) : "";
      nextDp = sizingParams.targetDp !== "" ? Number((Number(sizingParams.targetDp) * 22.62).toFixed(0)) : "";
      nextTemp = sizingParams.temperature !== "" ? Number(((Number(sizingParams.temperature) - 32) / 1.8).toFixed(1)) : "";
    }

    const updatedParams = {
      ...sizingParams,
      flowRate: nextFlow,
      targetDp: nextDp,
      temperature: nextTemp
    };
    
    saveParams(updatedParams, unit, projectInfo);
  };

  // Calculations
  const calculatedData = useMemo(() => {
    const ip = unitSystem === "ip";
    const flowVal = sizingParams.flowRate !== "" ? Number(sizingParams.flowRate) : (ip ? 80 : 5.0);
    const Q = ip ? flowVal * 6.30902e-5 : flowVal * 1e-3;
    const tRaw = sizingParams.temperature !== "" ? Number(sizingParams.temperature) : (ip ? 44 : 6.7);
    const tC = ip ? fToC(tRaw) : tRaw;
    const eps = Number(sizingParams.materialRoughness) || 0.000046;
    
    const dpRaw = sizingParams.targetDp !== "" ? Number(sizingParams.targetDp) : (ip ? 4.0 : 40);
    const targetDpPaM = ip ? dpRaw * 22.62 : dpRaw;

    const rho = waterDens(tC) * GLYCOL_DENS[sizingParams.fluidType];
    const mu = waterVisc(tC) * GLYCOL_VISC[sizingParams.fluidType];

    let chosen: any = null;
    const allPipes: any[] = [];

    // Exact sizing logic from original calcHvacPipe (02-hvac-calcs.js):
    for (const [nps, idMm] of Object.entries(pipeTable)) {
      const D = idMm / 1000;
      const A = (Math.PI * D * D) / 4;
      const v = Q / A;
      const Re = (rho * v * D) / mu;
      const f = colebrook(Re, eps / D);
      const dp = (f * rho * v * v) / (2 * D);
      const dpFt = dp / 22.62;
      const vFps = v / 0.3048;
      const isCompliant = dp <= targetDpPaM * 1.05;

      const item = { nps, idMm, D, v, vFps, Re, f, dp, dpFt, isCompliant };
      allPipes.push(item);

      if (isCompliant) {
        chosen = item;
        break;
      }
    }

    if (!chosen) {
      const last = Object.entries(pipeTable).pop()!;
      const D = last[1] / 1000;
      const A = (Math.PI * D * D) / 4;
      const v = Q / A;
      const Re = (rho * v * D) / mu;
      const f = colebrook(Re, eps / D);
      const dp = (f * rho * v * v) / (2 * D);
      chosen = { nps: last[0], idMm: last[1], D, v, vFps: v / 0.3048, Re, f, dp, dpFt: dp / 22.62 };
    }

    const regime = chosen.Re < 2300 ? "Laminar" : chosen.Re < 4000 ? "Transitional" : "Turbulent";

    return {
      nps: chosen.nps,
      DN: (chosen.D * 1000).toFixed(0),
      innerDiameterMm: chosen.D * 1000,
      velocity: chosen.v,
      velocityFps: chosen.vFps,
      pressureDropPaM: chosen.dp,
      pressureDropFt100ft: chosen.dpFt,
      reynoldsNumber: chosen.Re,
      frictionFactor: chosen.f,
      regime,
      rho,
      mu,
      allPipes
    };
  }, [sizingParams, unitSystem]);

  const handleSizePipe = () => {
    if (!sizingParams.flowRate || !sizingParams.temperature || !sizingParams.targetDp) {
      setInputError("Please fill in all required fields before calculating.");
      return;
    }
    setInputError(null);
    setHasCalculated(true);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ projectInfo, sizingParams, unitSystem }));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${projectInfo.projectName.replace(/\s+/g, "_")}_chw_pipe_sizer.json`);
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
        if (parsed.sizingParams) {
          let loadedParams = { ...parsed.sizingParams };
          if (loadedParams.materialRoughness >= 0.001) {
            loadedParams.materialRoughness = loadedParams.materialRoughness / 1000;
          }
          setSizingParams(loadedParams);
        }
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
        setHasCalculated(true);
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Pipe Sizer");

    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 25;
    sheet.getColumn(3).width = 20;
    sheet.getColumn(4).width = 20;

    sheet.mergeCells("A1:D1");
    const cellA1 = sheet.getCell("A1");
    cellA1.value = "CHW PIPE SIZING REPORT";
    cellA1.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFF" } };
    cellA1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E28743" } }; // theme accent orange
    cellA1.alignment = { horizontal: "center" };

    sheet.addRow([]);
    sheet.addRow(["Project Information"]);
    sheet.getCell("A3").font = { name: "Segoe UI", size: 13, bold: true };
    sheet.addRow(["Project Name", projectInfo.projectName]);
    sheet.addRow(["Project Number", projectInfo.projectNumber]);
    sheet.addRow(["Consultant", projectInfo.consultant]);

    sheet.addRow([]);
    sheet.addRow(["Sizing parameters"]);
    sheet.getCell("A8").font = { name: "Segoe UI", size: 13, bold: true };
    sheet.addRow(["Fluid Type", sizingParams.fluidType === "chw" ? "Chilled Water" : sizingParams.fluidType === "cw" ? "Condenser Water" : sizingParams.fluidType === "g25" ? "25% Glycol" : "40% Glycol"]);
    sheet.addRow(["Flow Rate", `${sizingParams.flowRate} ${unitSystem === "ip" ? "GPM" : "L/s"}`]);
    sheet.addRow(["Operating Temp", `${sizingParams.temperature} ${unitSystem === "ip" ? "°F" : "°C"}`]);
    sheet.addRow(["Pipe Material Roughness", `${(sizingParams.materialRoughness * 1000).toFixed(4)} mm`]);
    sheet.addRow(["Target Pressure Drop Limit", `${sizingParams.targetDp} ${unitSystem === "ip" ? "ft w.g./100ft" : "Pa/m"}`]);

    sheet.addRow([]);
    sheet.addRow(["Sizing Results"]);
    sheet.getCell("A15").font = { name: "Segoe UI", size: 13, bold: true };
    sheet.addRow(["Recommended Pipe Size", `NPS ${calculatedData.nps}" / DN ${calculatedData.DN} mm`]);
    sheet.addRow(["Internal Diameter", unitSystem === "ip" ? `${(calculatedData.innerDiameterMm / 25.4).toFixed(3)} in` : `${calculatedData.innerDiameterMm.toFixed(1)} mm`]);
    sheet.addRow(["Fluid Velocity", unitSystem === "ip" ? `${calculatedData.velocityFps.toFixed(2)} fps` : `${calculatedData.velocity.toFixed(3)} m/s`]);
    sheet.addRow(["Actual Pressure Drop", unitSystem === "ip" ? `${calculatedData.pressureDropFt100ft.toFixed(2)} ft/100ft` : `${calculatedData.pressureDropPaM.toFixed(1)} Pa/m`]);
    sheet.addRow(["Reynolds Number", Math.round(calculatedData.reynoldsNumber).toLocaleString()]);
    sheet.addRow(["Flow Regime", calculatedData.regime]);

    
    const sigRow = worksheet.rowCount ? worksheet.rowCount + 2 : 20;
    addExcelSignatureBlock(worksheet, sigRow, currentUserName, project?.id || "default", "chw-pipe-sizer");
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${projectInfo.projectName.replace(/\s+/g, "_")}_pipe_sizer_report.xlsx`);
  };

  const handlePrintPDF = () => {
    const doc = new jsPDF("p", "pt", "a4");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("CHW PIPE SIZING REPORT", 40, 50);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated on: ${projectInfo.date} | Calculation Code: ${projectInfo.calcNumber} | Standard: ASHRAE`, 40, 68);

    doc.setDrawColor(200);
    doc.line(40, 75, 550, 75);

    // Project details
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
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
      styles: { fontSize: 9.5, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 90 },
        1: { cellWidth: 170 },
        2: { fontStyle: "bold", cellWidth: 90 },
        3: { cellWidth: 170 },
      },
    });

    // Sizing Parameters
    doc.setFont("helvetica", "bold");
    doc.text("2. Design & Fluid Parameters", 40, (doc as any).lastAutoTable.finalY + 25);

    const fluidTypeName = sizingParams.fluidType === "chw" ? "Chilled Water" : sizingParams.fluidType === "cw" ? "Condenser Water" : sizingParams.fluidType === "g25" ? "25% Glycol" : "40% Glycol";
    const paramData = [
      ["Fluid Type Sized", fluidTypeName, "Fluid Flow Rate", `${sizingParams.flowRate} ${unitSystem === "ip" ? "GPM" : "L/s"}`],
      ["Operating Temp", `${sizingParams.temperature} ${unitSystem === "ip" ? "°F" : "°C"}`, "Material Roughness", `${(sizingParams.materialRoughness * 1000).toFixed(4)} mm`],
      ["Target Pressure Drop Limit", `${sizingParams.targetDp} ${unitSystem === "ip" ? "ft w.g./100ft" : "Pa/m"}`, "Calculated Density", `${calculatedData.rho.toFixed(1)} kg/m³`],
    ];

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 35,
      head: [],
      body: paramData,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 130 },
        1: { cellWidth: 120 },
        2: { fontStyle: "bold", cellWidth: 130 },
        3: { cellWidth: 120 },
      },
    });

    // Sizing Results
    doc.setFont("helvetica", "bold");
    doc.text("3. Pipe Sizing Summary", 40, (doc as any).lastAutoTable.finalY + 25);

    const summaryData = [
      ["Recommended Pipe Size", `NPS ${calculatedData.nps}" / DN ${calculatedData.DN} mm`],
      ["Inner Diameter (Actual)", unitSystem === "ip" ? `${(calculatedData.innerDiameterMm / 25.4).toFixed(3)} in` : `${calculatedData.innerDiameterMm.toFixed(1)} mm`],
      ["Fluid Velocity Sized", unitSystem === "ip" ? `${calculatedData.velocityFps.toFixed(2)} fps` : `${calculatedData.velocity.toFixed(3)} m/s`],
      ["Calculated Friction Loss", unitSystem === "ip" ? `${calculatedData.pressureDropFt100ft.toFixed(2)} ft/100ft` : `${calculatedData.pressureDropPaM.toFixed(1)} Pa/m`],
      ["Reynolds Number", `${Math.round(calculatedData.reynoldsNumber).toLocaleString()}`],
      ["Friction Factor (Colebrook)", `${calculatedData.frictionFactor.toFixed(5)}`],
      ["Flow Regime Class", `${calculatedData.regime}`],
    ];

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 35,
      head: [],
      body: summaryData,
      theme: "striped",
      styles: { fontSize: 9.5, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 220 },
        1: { cellWidth: 280 },
      },
    });

    
    const sigFinalY = (doc as any).lastAutoTable?.finalY || 40;
    addPdfSignatureBlock(doc, sigFinalY, currentUserName, project?.id || "default", "chw-pipe-sizer");
    const pdfBuffer = doc.output("arraybuffer");
    downloadFile(new Uint8Array(pdfBuffer), `${projectInfo.projectName.replace(/\s+/g, "_")}_report.pdf`, "PDF Document", ["pdf"]);
  };

  const renderSvgChart = () => {
    const ip = unitSystem === "ip";
    const vel = ip ? calculatedData.velocityFps : calculatedData.velocity;
    const vMax = ip ? 8.0 : 2.4;
    const flow = Number(sizingParams.flowRate);
    const u = ip ? "fps" : "m/s";
    const flowU = ip ? "GPM" : "L/s";

    const bars = [
      { label: 'Velocity', value: vel, color: vel > vMax ? '#0A7BC7' : '#d17914', unit: ' ' + u },
      { label: 'Max Allow', value: vMax, color: '#64748B', unit: ' ' + u },
      { label: 'Flow Rate', value: flow, color: '#06456F', unit: ' ' + flowU }
    ];

    const W = 540;
    const H = 160;
    const PL = 42;
    const PR = 16;
    const PT = 32;
    const PB = 44;
    const CW = W - PL - PR;
    const CH = H - PT - PB;
    
    const maxV = Math.max(...bars.map(b => Math.abs(b.value || 0))) * 1.18 || 1;
    const bw = CW / bars.length;
    const gap = bw * 0.28;
    const bw2 = bw - gap;
    
    const sx = (i: number) => PL + i * bw + gap / 2;
    const sy = (v: number) => PT + CH - (Math.max(0, v) / maxV) * CH;

    const ticks = [0.25, 0.5, 0.75, 1.0];

    return (
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-auto block overflow-visible font-sans">
        <text x={PL} y="18" fontSize="9.5" fontWeight="700" fill="var(--muted)" letterSpacing="0.5">PIPE VELOCITY & SIZING</text>
        
        {/* Gridlines */}
        {ticks.map(t => {
          const v = maxV * t;
          const y = sy(v);
          const lbl = v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(v < 10 ? 1 : 0);
          return (
            <g key={t}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={PL - 5} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="var(--muted)" className="font-mono">{lbl}</text>
            </g>
          );
        })}

        {/* Axes */}
        <line x1={PL} y1={PT} x2={PL} y2={PT + CH} stroke="var(--border)" strokeWidth="1" />
        <line x1={PL} y1={PT + CH} x2={W - PR} y2={PT + CH} stroke="var(--border)" strokeWidth="1" />

        {/* Bars */}
        {bars.map((b, i) => {
          const h = Math.max(3, (Math.abs(b.value || 0) / maxV) * CH);
          const x = sx(i);
          const y = sy(Math.abs(b.value || 0));
          const valStr = typeof b.value === 'number' 
            ? (Math.abs(b.value) >= 1000 
               ? (b.value / 1000).toFixed(1) + 'k' 
               : b.value.toFixed(b.value < 10 ? 2 : 1))
            : '-';
          
          const words = b.label.split(' ');
          const lx = x + bw2 / 2;

          return (
            <g key={i}>
              <rect x={x} y={y} width={bw2} height={h} fill={b.color} rx="3" opacity="0.88" />
              <text x={lx} y={y - 5} textAnchor="middle" fontSize="9" fill={b.color} fontWeight="700" className="font-mono">
                {valStr}{b.unit}
              </text>
              {words.length > 1 ? (
                <>
                  <text x={lx} y={PT + CH + 16} textAnchor="middle" fontSize="8.5" fill="var(--muted)">{words[0]}</text>
                  <text x={lx} y={PT + CH + 27} textAnchor="middle" fontSize="8.5" fill="var(--muted)">{words.slice(1).join(' ')}</text>
                </>
              ) : (
                <text x={lx} y={PT + CH + 16} textAnchor="middle" fontSize="8.5" fill="var(--muted)">{b.label}</text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <AppShell title="CHW Pipe Sizer" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print px-6">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; CHW PIPE SIZER</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Pipe Sizer - CHW / CW</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">ASHRAE / SMACNA - Velocity &amp; Pressure Drop Method</span>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Size chilled water or condenser water pipes. Iterates through Sch 40 sizes to find the smallest meeting target ΔP. Glycol viscosity correction included.
              </p>
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className="mx-6 mb-6 bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden">
            {/* Tabs Selector row */}
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
                  type="button"
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
                  type="button"
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

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 animate-fade-in flex flex-col">
              {activeTab === "calculator" ? (
                <div className="flex-1 min-h-0 flex flex-col relative">
                  
                  {/* Top Actions Block matching Ventilation */}
                  <div className="relative flex items-center justify-between gap-4 px-6 h-12 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">File Actions:</span>
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

                  {/* Scrollable calculator content */}
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-950/20 flex flex-col gap-6">
                    
                    {/* Expandable Formula Reference */}
                    {showFormulaPanel && (
                      <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm animate-slide-in flex flex-col gap-5">
                        {/* Features List */}
                        <div>
                          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-2.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-3.5 bg-primary rounded-sm"></span>
                            Features: CHW Pipe Sizer Calculator
                          </h3>
                          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                            <li><strong>All Keyboard shortcuts</strong>: Core navigation & hotkeys.</li>
                            <li><strong>Velocity or Pressure Drop Method</strong>: Sizing based on maximum velocity or maximum friction head loss rate.</li>
                            <li><strong>Glycol Mixture Correction</strong>: Dynamically adjusts density & viscosity for glycol mixtures (0% to 50%).</li>
                            <li><strong>Interactive Pipe Schedule Table</strong>: Add, remove, and size pipes dynamically; customize recommended and selected nominal pipe sizes.</li>
                            <li><strong>Reynolds Number & Colebrook Friction Solver</strong>: Calculates regime type and iteratively solves Colebrook-White friction factors.</li>
                            <li><strong>SI / IP Dual Unit System</strong>: Dynamic Metric and Imperial unit conversion.</li>
                          </ul>
                        </div>

                        <div className="border-t border-border/40 pt-4">
                          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
                            <HelpCircle className="size-4 text-primary" /> CHW Pipe Sizer Formulas Reference
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans">
                            <div className="border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10">
                              <span className="font-semibold block mb-1">Darcy-Weisbach Equation:</span>
                              <code className="text-primary block font-bold mb-1 font-mono text-[11px]">hf = f × (L/D) × (v²/2g)</code>
                              <span className="text-[10px] text-muted-foreground">Friction loss head in meters of water column.</span>
                            </div>
                            <div className="border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10">
                              <span className="font-semibold block mb-1">Colebrook Friction Factor:</span>
                              <code className="text-primary block font-bold mb-1 font-mono text-[11px]">1/√f = -2log(ε/3.7D + 2.51/Re√f)</code>
                              <span className="text-[10px] text-muted-foreground">Solved iteratively using Colebrook-White algorithm.</span>
                            </div>
                            <div className="border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10">
                              <span className="font-semibold block mb-1">Reynolds Number:</span>
                              <code className="text-primary block font-bold mb-1 font-mono text-[11px]">Re = ρ × v × D / μ</code>
                              <span className="text-[10px] text-muted-foreground">Differentiates Laminar, Transitional, and Turbulent flow.</span>
                            </div>
                            <div className="border border-border/50 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/10">
                              <span className="font-semibold block mb-1">Fluid Properties:</span>
                              <code className="text-primary block font-bold mb-1 font-mono text-[11px]">Density (ρ) & Viscosity (μ)</code>
                              <span className="text-[10px] text-muted-foreground">Calculated dynamically based on temperature and glycol%.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Split layout: inputs vs parameters */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      
                      {/* Left Column - Inputs (spans 5 columns) */}
                      <div className="lg:col-span-5 flex flex-col gap-6">
                        

                        {/* Inputs Card */}
                        <div className="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5 flex flex-col gap-4 relative">
                          <div className="flex items-center gap-2 pb-2.5 border-b border-border/60">
                            <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inputs</h3>
                          </div>

                          {inputError && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl p-3 text-xs flex gap-2 items-center">
                              <AlertTriangle className="size-4 shrink-0 text-red-600" />
                              <span>{inputError}</span>
                            </div>
                          )}

                          <div className="flex flex-col gap-3.5 text-xs font-sans">
                            {/* Flow Rate */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold text-foreground">Flow Rate</label>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-muted-foreground rounded uppercase font-mono">
                                  {unitSystem === "ip" ? "GPM" : "L/s"}
                                </span>
                              </div>
                              <input
                                type="number"
                                step="any"
                                value={sizingParams.flowRate}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : Number(e.target.value);
                                  saveParams({ ...sizingParams, flowRate: val }, unitSystem, projectInfo);
                                }}
                                placeholder={unitSystem === "ip" ? "80" : "5.0"}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
                              />
                            </div>

                            {/* Fluid Type */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-foreground flex justify-between items-center">
                                <span>Fluid Type</span>
                              </label>
                              <select
                                value={sizingParams.fluidType}
                                onChange={(e) => saveParams({ ...sizingParams, fluidType: e.target.value as any }, unitSystem, projectInfo)}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]"
                              >
                                <option value="chw">Chilled Water</option>
                                <option value="cw">Condenser Water</option>
                                <option value="g25">25% Glycol</option>
                                <option value="g40">40% Glycol</option>
                              </select>
                            </div>

                            {/* Fluid Temperature */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold text-foreground">Fluid Temperature</label>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-muted-foreground rounded uppercase font-mono">
                                  {unitSystem === "ip" ? "°F" : "°C"}
                                </span>
                              </div>
                              <input
                                type="number"
                                step="any"
                                value={sizingParams.temperature}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : Number(e.target.value);
                                  saveParams({ ...sizingParams, temperature: val }, unitSystem, projectInfo);
                                }}
                                placeholder={unitSystem === "ip" ? "44" : "6.7"}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
                              />
                            </div>

                            {/* Pipe Material */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-foreground">Pipe Material</label>
                              <select
                                value={sizingParams.materialRoughness}
                                onChange={(e) => saveParams({ ...sizingParams, materialRoughness: Number(e.target.value) }, unitSystem, projectInfo)}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]"
                              >
                                <option value="0.000046">Carbon Steel</option>
                                <option value="0.0000015">Copper</option>
                                <option value="0.000150">Galvanized Steel</option>
                              </select>
                              <span className="text-[10.5px] text-muted-foreground mt-0.5 block">
                                Roughness: {(sizingParams.materialRoughness * 1000).toFixed(4)} mm
                              </span>
                            </div>

                            {/* Target DP */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold text-foreground">Target ΔP</label>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-muted-foreground rounded uppercase font-mono">
                                  {unitSystem === "ip" ? "ft w.g./100ft" : "Pa/m"}
                                </span>
                              </div>
                              <input
                                type="number"
                                step="any"
                                value={sizingParams.targetDp}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : Number(e.target.value);
                                  saveParams({ ...sizingParams, targetDp: val }, unitSystem, projectInfo);
                                }}
                                placeholder={unitSystem === "ip" ? "4.0" : "40"}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Size Pipe Button */}
                        <button
                          type="button"
                          onClick={handleSizePipe}
                          className="w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer text-xs"
                        >
                          ⚡ Size Pipe
                        </button>
                      </div>

                      {/* Right Column - Results (spans 7 columns) */}
                      <div className="lg:col-span-7 flex flex-col gap-6">
                        {!hasCalculated ? (
                          <div className="bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs">
                            <div className="size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none">
                              ❄️
                            </div>
                            <h4 className="text-xs font-bold text-foreground mb-1 uppercase tracking-wider">Ready for Sizing</h4>
                            <p className="text-[11.5px] text-muted-foreground max-w-xs leading-normal">
                              Fill in the design inputs on the left and click <strong>Size Pipe</strong> to compute optimal pipe sizes and view velocity profiles.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Warnings Display */}
                            {(calculatedData.velocityFps < 2 || calculatedData.velocityFps > 8) && (
                              <div className="flex flex-col gap-3">
                                {calculatedData.velocityFps < 2 && (
                                  <div className="bg-sky-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl p-3.5 flex gap-2.5 text-[11.5px] items-start">
                                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                                    <div>
                                      <strong className="font-bold">Velocity Alert</strong>
                                      <p className="mt-0.5 text-muted-foreground leading-normal">
                                        Velocity {calculatedData.velocityFps.toFixed(2)} fps - Below 2 fps. Air pocket/sedimentation risk.
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {calculatedData.velocityFps > 8 && (
                                  <div className="bg-sky-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl p-3.5 flex gap-2.5 text-[11.5px] items-start">
                                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                                    <div>
                                      <strong className="font-bold">Velocity Alert</strong>
                                      <p className="mt-0.5 text-muted-foreground leading-normal">
                                        Velocity {calculatedData.velocityFps.toFixed(2)} fps - Exceeds 8 fps. Erosion risk at fittings.
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Pipe Selection Card */}
                            <div className="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5 flex flex-col gap-4 relative">
                              <div className="flex items-center gap-2 pb-2.5 border-b border-border/60">
                                <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pipe Selection</h3>
                              </div>

                              <div className="flex flex-col gap-3 font-sans text-xs">
                                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                                  <span className="font-semibold text-muted-foreground">Selected Pipe Size</span>
                                  <strong className="font-bold text-[#0A7BC7] text-[13px] font-mono">
                                    NPS {calculatedData.nps}" / DN {calculatedData.DN} mm
                                  </strong>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                                  <span className="font-semibold text-muted-foreground">Internal Diameter</span>
                                  <strong className="font-bold text-foreground font-mono">
                                    {unitSystem === "ip" 
                                      ? `${(calculatedData.innerDiameterMm / 25.4).toFixed(3)} in` 
                                      : `${calculatedData.innerDiameterMm.toFixed(1)} mm`}
                                  </strong>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                                  <span className="font-semibold text-muted-foreground">Velocity</span>
                                  <strong className="font-bold text-[#0A7BC7] font-mono">
                                    {unitSystem === "ip" 
                                      ? `${calculatedData.velocityFps.toFixed(2)} fps` 
                                      : `${calculatedData.velocity.toFixed(3)} m/s`}
                                  </strong>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                                  <span className="font-semibold text-muted-foreground">Pressure Drop</span>
                                  <strong className="font-bold text-foreground font-mono">
                                    {unitSystem === "ip" 
                                      ? `${calculatedData.pressureDropFt100ft.toFixed(2)} ft/100ft` 
                                      : `${calculatedData.pressureDropPaM.toFixed(1)} Pa/m`}
                                  </strong>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                                  <span className="font-semibold text-muted-foreground">Reynolds Number</span>
                                  <strong className="font-bold text-foreground font-mono">
                                    {Math.round(calculatedData.reynoldsNumber).toLocaleString()}
                                  </strong>
                                </div>
                                <div className="flex justify-between items-center py-1.5">
                                  <span className="font-semibold text-muted-foreground">Flow Regime</span>
                                  <strong className="font-bold text-foreground font-mono">
                                    {calculatedData.regime}
                                  </strong>
                                </div>
                              </div>
                            </div>

                            {/* Chart Card */}
                            <div className="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5 flex flex-col gap-4 relative">
                              <div className="w-full relative select-none">
                                {renderSvgChart()}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                    </div>
                  </div>
                </div>
              ) : (
                /* Printable Report tab view */
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Fixed Toolbar at the top */}
                  <div className="relative flex items-center justify-end gap-3 px-6 h-12 bg-background border-b border-border/60 shrink-0 no-print select-none">
                    <TBtn onClick={handlePrintPDF} primary><Printer className="size-3.5" /> Print / Export PDF</TBtn>
                  </div>
                  
                  {/* Scrollable Report Content */}
                  <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 dark:bg-slate-950/20 font-sans print:p-0">

                  {/* Results Dashboard Grid */}
                  <div className="no-print max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10 border border-blue-100/60 dark:border-orange-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                      <div className="absolute right-4 top-4 bg-[#0A7BC7]/10 text-[#06456F] rounded-full p-2">
                        <Sparkles className="size-4" />
                      </div>
                      <span className="text-[10px] font-bold text-[#06456F] dark:text-sky-400 uppercase tracking-widest block mb-1">Recommended size</span>
                      <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">NPS {calculatedData.nps}"</strong>
                      <span className="text-[11px] text-muted-foreground mt-2 block">Inner Diameter: {calculatedData.innerDiameterMm.toFixed(1)} mm (DN {calculatedData.DN})</span>
                    </div>

                    <div className="bg-gradient-to-br from-pink-50 to-pink-100/50 dark:from-pink-950/20 dark:to-pink-900/10 border border-pink-200/60 dark:border-pink-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                      <div className="absolute right-4 top-4 bg-pink-500/10 text-pink-600 rounded-full p-2">
                        <Gauge className="size-4" />
                      </div>
                      <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-widest block mb-1">Fluid Velocity</span>
                      <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">
                        {unitSystem === "ip" ? `${calculatedData.velocityFps.toFixed(2)} fps` : `${calculatedData.velocity.toFixed(3)} m/s`}
                      </strong>
                      <span className="text-[11px] text-muted-foreground mt-2 block">Flow Type: {sizingParams.fluidType === "chw" ? "Chilled Water" : "Condenser Water"}</span>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                      <div className="absolute right-4 top-4 bg-emerald-500/10 text-emerald-600 rounded-full p-2">
                        <CheckCircle2 className="size-4" />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1">Pressure Drop</span>
                      <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">
                        {unitSystem === "ip" ? `${calculatedData.pressureDropFt100ft.toFixed(2)} ft/100ft` : `${calculatedData.pressureDropPaM.toFixed(1)} Pa/m`}
                      </strong>
                      <span className="text-[11px] text-muted-foreground mt-2 block">Target limit: {sizingParams.targetDp} {unitSystem === "ip" ? "ft/100ft" : "Pa/m"}</span>
                    </div>

                    <div className={`bg-gradient-to-br border rounded-2xl p-5 shadow-xs relative overflow-hidden ${
                      calculatedData.velocityFps > 8 
                        ? "from-rose-50 to-rose-100/50 dark:from-rose-950/20 dark:to-rose-900/10 border-rose-200/60 dark:border-rose-800/50" 
                        : calculatedData.velocityFps < 2 
                          ? "from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200/60 dark:border-amber-800/50"
                          : "from-teal-50 to-teal-100/50 dark:from-teal-950/20 dark:to-teal-900/10 border-teal-200/60 dark:border-teal-800/50"
                    }`}>
                      <div className="absolute right-4 top-4 text-muted-foreground rounded-full p-2">
                        <AlertTriangle className="size-4" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">Flow Velocity Status</span>
                      <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">
                        {calculatedData.velocityFps > 8 ? "High" : calculatedData.velocityFps < 2 ? "Low" : "Optimal"}
                      </strong>
                      <span className="text-[11px] text-muted-foreground mt-2 block">
                        {calculatedData.velocityFps > 8 ? "Erosion & noise hazard" : calculatedData.velocityFps < 2 ? "Air pocket & settling hazard" : "Sizing parameters in range"}
                      </span>
                    </div>

                  </div>


                  <div className="border border-slate-300 dark:border-slate-800 rounded-xl p-8 max-w-4xl mx-auto shadow-sm print:border-none print:shadow-none print:p-0 bg-white">
                    
                    {/* Report Header */}
                    <div className="border-b-2 border-slate-800 pb-5 mb-6 flex justify-between items-start">
                      <div>
                        <h1 className="text-xl font-extrabold text-slate-900 uppercase tracking-wider">CHW PIPE SIZING REPORT</h1>
                        <p className="text-[12px] text-muted-foreground font-mono mt-1">Chilled Water Pipe Sizing compliant with ASHRAE / Colebrook equation</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[13px] font-bold text-[#0A7BC7] font-mono block">MEP CALCULATION SUITE</span>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">Date: {projectInfo.date}</span>
                      </div>
                    </div>

                    {/* 1. Project Info */}
                    <div className="mb-6">
                      <h3 className="font-bold text-[13px] text-slate-900 border-b border-slate-200 pb-1 mb-3">1. Project Details</h3>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground block">Project Name:</span>
                          <span className="font-semibold text-slate-900">{projectInfo.projectName}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Project Number:</span>
                          <span className="font-semibold text-slate-900">{projectInfo.projectNumber}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Consultant / Engineer:</span>
                          <span className="font-semibold text-slate-900">{projectInfo.consultant}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Client Name:</span>
                          <span className="font-semibold text-slate-900">{projectInfo.client}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground block">Calculation Notes:</span>
                          <span className="italic text-muted-foreground block mt-0.5">{projectInfo.notes}</span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Fluid Parameters */}
                    <div className="mb-6">
                      <h3 className="font-bold text-[13px] text-slate-900 border-b border-slate-200 pb-1 mb-3">2. Fluid Sizing Parameters</h3>
                      <div className="grid grid-cols-3 gap-y-3.5 gap-x-4 text-xs">
                        <div>
                          <span className="text-muted-foreground block">Fluid Type:</span>
                          <strong className="font-mono text-slate-900 font-bold">
                            {sizingParams.fluidType === "chw" ? "Chilled Water" : sizingParams.fluidType === "cw" ? "Condenser Water" : sizingParams.fluidType === "g25" ? "25% Glycol" : "40% Glycol"}
                          </strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Operating Flow Rate:</span>
                          <strong className="font-mono text-slate-900 font-bold">{sizingParams.flowRate} {unitSystem === "ip" ? "GPM" : "L/s"}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Operating Temperature:</span>
                          <strong className="font-mono text-slate-900 font-bold">{sizingParams.temperature} {unitSystem === "ip" ? "°F" : "°C"}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Material Roughness:</span>
                          <strong className="font-mono text-slate-900 font-bold">{(sizingParams.materialRoughness * 1000).toFixed(4)} mm</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Target Friction Loss Limit:</span>
                          <strong className="font-mono text-slate-900 font-bold">{sizingParams.targetDp} {unitSystem === "ip" ? "ft w.g./100ft" : "Pa/m"}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Calculated Density:</span>
                          <strong className="font-mono text-slate-900 font-bold">{calculatedData.rho.toFixed(1)} kg/m³</strong>
                        </div>
                      </div>
                    </div>

                    {/* 3. Sizing results */}
                    <div className="mb-6">
                      <h3 className="font-bold text-[13px] text-slate-900 border-b border-slate-200 pb-1 mb-3">3. Sizing Summary Results</h3>
                      <div className="border border-slate-200 rounded-lg p-4 flex flex-col gap-3 bg-slate-50 text-xs">
                        
                        <div className="grid grid-cols-2 gap-4 pb-2 border-b border-slate-200">
                          <div>
                            <span className="text-muted-foreground">Recommended Diameter:</span>
                            <strong className="block text-[13px] font-mono mt-0.5 text-[#0A7BC7]">NPS {calculatedData.nps}" / DN {calculatedData.DN} mm</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Actual Inner Diameter:</span>
                            <strong className="block text-[13px] font-mono mt-0.5 text-slate-900">
                              {unitSystem === "ip" 
                                ? `${(calculatedData.innerDiameterMm / 25.4).toFixed(3)} in` 
                                : `${calculatedData.innerDiameterMm.toFixed(1)} mm`}
                            </strong>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 pt-1">
                          <div>
                            <span className="text-muted-foreground">Fluid Velocity:</span>
                            <strong className="block font-mono mt-0.5 text-slate-900">
                              {unitSystem === "ip" 
                                ? `${calculatedData.velocityFps.toFixed(2)} fps` 
                                : `${calculatedData.velocity.toFixed(3)} m/s`}
                            </strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Actual Friction Loss:</span>
                            <strong className="block text-[13px] text-[#06456F] font-mono mt-0.5">
                              {unitSystem === "ip" 
                                ? `${calculatedData.pressureDropFt100ft.toFixed(2)} ft/100ft` 
                                : `${calculatedData.pressureDropPaM.toFixed(1)} Pa/m`}
                            </strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Friction Factor (f):</span>
                            <strong className="block font-mono mt-0.5 text-slate-900">{calculatedData.frictionFactor.toFixed(5)}</strong>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Engineering sign off footer */}
                    <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-[11px] text-muted-foreground">
                      <div>
                        <p className="font-semibold uppercase tracking-wider text-slate-800 mb-6 font-bold">Prepared By:</p>
                        <div className="border-b border-slate-300 w-48 mb-1"></div>
                        <p>Consulting HVAC Engineer</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold uppercase tracking-wider text-slate-800 mb-6 font-bold">Reviewed & Approved By:</p>
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
