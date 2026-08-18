import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, FileSpreadsheet, X, HelpCircle,
  Search, Activity, Droplet, Settings, Grid, Flame
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";

export const Route = createFileRoute("/plumbing-sprinkler-density")({
  head: () => ({
    meta: [
      { title: "Sprinkler Density & Flow — MEP Calc" },
      { name: "description", content: "Calculate sprinkler flow rates from design density, design area, and sprinkler K-factor per NFPA 13." },
    ],
  }),
  component: SprinklerDensityPage,
});

type HazardOpt = "0.10,1500" | "0.15,1500" | "0.20,1500" | "0.30,2500" | "0.40,2500" | "custom";

const STANDARD_K_FACTORS = [2.8, 4.2, 5.6, 8.0, 11.2, 14.0, 16.8, 19.6, 22.4, 25.2, 28.0];

function SprinklerDensityPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project } = useWorkspace();

  // Tabs
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);

  // Input states
  const [hazard, setHazard] = useState<HazardOpt>("0.15,1500");
  const [customDens, setCustomDens] = useState<number | "">(0.20);
  const [customArea, setCustomArea] = useState<number | "">(1500);
  const [coverage, setCoverage] = useState<number | "">(130);
  const [kFactor, setKFactor] = useState(5.6);
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("ip");

  // Calculations
  const calcResults = useMemo(() => {
    const customDensVal = customDens === "" ? 0 : customDens;
    const customAreaVal = customArea === "" ? 0 : customArea;
    const coverageVal = coverage === "" ? 0 : coverage;

    let dens = 0.15;
    let designArea = 1500;

    if (hazard === "custom") {
      dens = customDensVal;
      designArea = customAreaVal;
    } else {
      const parts = hazard.split(",");
      dens = parseFloat(parts[0]);
      designArea = parseFloat(parts[1]);
    }

    const ip = unitSystem === "ip";
    // Convert to IP if SI is selected (SI: mm/min and m²)
    // mm/min -> GPM/ft²: divide by 40.74
    // m² -> ft²: multiply by 10.7639
    const densIP = ip ? dens : dens / 40.74;
    const coverFt2 = ip ? coverageVal : coverageVal * 10.7639;
    const designAreaFt2 = ip ? designArea : designArea * 10.7639;

    const flowPerSprink = densIP * coverFt2; // GPM
    const pressReq = Math.pow(flowPerSprink / kFactor, 2); // psi
    const nSprink = Math.ceil(designAreaFt2 / coverFt2);
    const totalSprinkFlow = densIP * designAreaFt2; // GPM

    // Hose stream allowance: LH=100, OH=250, EH=500 GPM
    const hoseAllow = densIP <= 0.10 ? 100 : densIP <= 0.20 ? 250 : 500;
    const systemTotal = totalSprinkFlow + hoseAllow;

    // Unit conversions for display
    const formatFlow = (gpm: number) => {
      return ip ? `${gpm.toFixed(1)} GPM` : `${(gpm * 0.06309).toFixed(2)} L/s`;
    };

    const formatArea = (ft2: number) => {
      return ip ? `${ft2.toFixed(0)} ft²` : `${(ft2 / 10.7639).toFixed(0)} m²`;
    };

    const formatDens = (gpmft2: number) => {
      return ip ? `${gpmft2.toFixed(3)} GPM/ft²` : `${(gpmft2 * 40.74).toFixed(2)} mm/min`;
    };

    return {
      densIP,
      coverFt2,
      designAreaFt2,
      flowPerSprink,
      pressReq,
      nSprink,
      totalSprinkFlow,
      hoseAllow,
      systemTotal,
      formatFlow,
      formatArea,
      formatDens
    };
  }, [hazard, customDens, customArea, coverage, kFactor, unitSystem]);

  // SVG Chart data
  const chartData = useMemo(() => {
    const W = 400;
    const H = 220;
    const PL = 60;
    const PR = 20;
    const PT = 30;
    const PB = 40;
    const CW = W - PL - PR;
    const CH = H - PT - PB;

    // Scale bars:
    // Density (GPM/ft² * 100): e.g. 0.15 -> 15. Max around 50.
    // Coverage area (ft²): e.g. 130. Max 250.
    // Design Area (ft²/10): e.g. 1500 -> 150. Max 300.
    // Pressure (psi): e.g. 15. Max 50.
    const items = [
      { label: "Density x100", val: calcResults.densIP * 100, color: "#d17914", unit: "" },
      { label: "Cover/head", val: calcResults.coverFt2, color: "#06456F", unit: " ft²" },
      { label: "Design Area / 10", val: calcResults.designAreaFt2 / 10, color: "#7C3AED", unit: " ft²" },
      { label: "Min Pressure", val: calcResults.pressReq, color: "#D97706", unit: " psi" }
    ];

    const maxVal = Math.max(...items.map(i => i.val)) * 1.15 || 100;
    const sx = (v: number) => PL + (v / maxVal) * CW;

    return {
      W, H, PL, PR, PT, PB, CW, CH, items, maxVal, sx
    };
  }, [calcResults]);

  // Export handlers
  const exportExcel = () => {
    const data = [
      { Parameter: "Hazard Classification", Value: hazard === "custom" ? "Custom" : hazard },
      { Parameter: "Design Density", Value: calcResults.formatDens(calcResults.densIP) },
      { Parameter: "Design Area", Value: calcResults.formatArea(calcResults.designAreaFt2) },
      { Parameter: "Coverage Area per Sprinkler", Value: `${coverage} ${unitSystem === "ip" ? "ft²" : "m²"}` },
      { Parameter: "Sprinkler K-Factor", Value: kFactor.toString() },
      { Parameter: "Flow per Sprinkler", Value: calcResults.formatFlow(calcResults.flowPerSprink) },
      { Parameter: "Required Pressure", Value: `${calcResults.pressReq.toFixed(1)} psi` },
      { Parameter: "Sprinkler Count in Design Area", Value: `${calcResults.nSprink} heads` },
      { Parameter: "Total Sprinkler Demand", Value: calcResults.formatFlow(calcResults.totalSprinkFlow) },
      { Parameter: "Hose Allowance (NFPA 13)", Value: calcResults.formatFlow(calcResults.hoseAllow) },
      { Parameter: "Total System Demand", Value: calcResults.formatFlow(calcResults.systemTotal) }
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Density & Flow");
    const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), `Sprinkler_Density_Flow_Report_${project.code}.xlsx`, "Excel Document", ["xlsx"]);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(220, 76, 52); // Red accent
    doc.text("NFPA 13 Sprinkler Density & Flow Report", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Project Name: ${project.name}`, 14, 28);
    doc.text(`Project Code: ${project.code}`, 14, 34);

    const tableData = [
      ["Design Density", calcResults.formatDens(calcResults.densIP)],
      ["Design Area", calcResults.formatArea(calcResults.designAreaFt2)],
      ["Coverage per Sprinkler", `${coverage} ${unitSystem === "ip" ? "ft²" : "m²"}`],
      ["Sprinkler K-Factor", `K-${kFactor.toFixed(1)}`],
      ["Flow per Sprinkler", calcResults.formatFlow(calcResults.flowPerSprink)],
      ["Operating Pressure", `${calcResults.pressReq.toFixed(1)} psi`],
      ["Sprinkler Count (Heads)", `${calcResults.nSprink} heads`],
      ["Total Sprinkler Flow", calcResults.formatFlow(calcResults.totalSprinkFlow)],
      ["NFPA 13 Hose Allowance", calcResults.formatFlow(calcResults.hoseAllow)],
      ["Total Design Water Demand", calcResults.formatFlow(calcResults.systemTotal)]
    ];

    autoTable(doc, {
      startY: 42,
      head: [["Sizing Parameters", "Value / Output"]],
      body: tableData,
      theme: "striped",
      styles: { fontSize: 10 },
      headStyles: { fillColor: [220, 76, 52] }
    });

    
    const sigFinalY = (doc as any).lastAutoTable?.finalY || 40;
    addPdfSignatureBlock(doc, sigFinalY, currentUserName, project?.id || "default", "plumbing-sprinkler-density");
    const pdfBuffer = doc.output("arraybuffer");
    downloadFile(new Uint8Array(pdfBuffer), `Sprinkler_Density_Flow_Report_${project.code}.pdf`, "PDF Document", ["pdf"]);
  };

  return (
    <AppShell
      title="Sprinkler Density & Flow"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg px-6">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">FIRE FIGHTING &gt; SPRINKLER DENSITY &amp; FLOW</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Sprinkler Density &amp; Flow</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">NFPA 13 density/area calculations</span>
                </div>
                <button 
                  onClick={() => setIntelOpen(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                    intelOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  Intelligence
                </button>
              </div>
            </div>
            
            {/* Actions / Export buttons on the right */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex rounded-full border border-border p-0.5 bg-surface-2 shrink-0">
                <button
                  onClick={() => setUnitSystem("si")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    unitSystem === "si" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  SI
                </button>
                <button
                  onClick={() => setUnitSystem("ip")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    unitSystem === "ip" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  IP
                </button>
              </div>
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className="bg-card border border-border rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden mx-6 mb-6">
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  onClick={() => setTab("solver")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "solver"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Calculator
                </button>
                <button
                  onClick={() => setTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "report"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Report Summary
                </button>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" && (
                <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
                {/* Inputs area */}
                <div className="flex-1 min-w-0 p-6 flex flex-col gap-6 max-w-3xl">
                  <div className="flex gap-3.5 p-4 bg-background border border-border rounded-3xl shadow-sm">
                    <Info className="size-4.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-[13.5px] font-bold text-foreground">NFPA 13 Density/Area Method</h4>
                      <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
                        Determine the minimum sprinkler water flow rate and operating pressure based on standard NFPA 13 hazard category densities. Sizing is preliminary and excludes complex hydraulic balancing.
                      </p>
                    </div>
                  </div>

                  {/* Sizing inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-2.5 col-span-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Hazard Category</label>
                      <select
                        value={hazard}
                        onChange={(e) => setHazard(e.target.value as HazardOpt)}
                        className="w-full h-10 px-3 border border-border focus:border-primary focus:ring-0 rounded-xl bg-background text-[13px] outline-none font-medium cursor-pointer"
                      >
                        <option value="0.10,1500">Light Hazard - 0.10 GPM/ft² / 1500 ft²</option>
                        <option value="0.15,1500">Ordinary Hazard Gp 1 - 0.15 / 1500 ft²</option>
                        <option value="0.20,1500">Ordinary Hazard Gp 2 - 0.20 / 1500 ft²</option>
                        <option value="0.30,2500">Extra Hazard Gp 1 - 0.30 / 2500 ft²</option>
                        <option value="0.40,2500">Extra Hazard Gp 2 - 0.40 / 2500 ft²</option>
                        <option value="custom">Custom Parameters...</option>
                      </select>
                    </div>
                  </div>

                  {/* Custom Hazard Parameters */}
                  {hazard === "custom" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-baseline">
                          <label className="text-[13px] font-bold text-foreground">Custom Density</label>
                          <span className="text-[11.5px] text-muted-foreground font-mono">
                            {unitSystem === "ip" ? "GPM/ft²" : "mm/min"}
                          </span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0.05"
                          max="1.0"
                          value={customDens}
                          onChange={(e) => setCustomDens(e.target.value === "" ? "" : parseFloat(e.target.value) || 0.1)}
                          className="h-10 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[13px] font-mono outline-none"
                        />
                      </div>

                      <div className="border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-baseline">
                          <label className="text-[13px] font-bold text-foreground">Custom Design Area</label>
                          <span className="text-[11.5px] text-muted-foreground font-mono">
                            {unitSystem === "ip" ? "ft²" : "m²"}
                          </span>
                        </div>
                        <input
                          type="number"
                          step="50"
                          min="500"
                          value={customArea}
                          onChange={(e) => setCustomArea(e.target.value === "" ? "" : parseFloat(e.target.value) || 1000)}
                          className="h-10 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[13px] font-mono outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Spacing & Sprinkler Options */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-baseline">
                        <label className="text-[13px] font-bold text-foreground">Coverage Area per Sprinkler</label>
                        <span className="text-[11.5px] text-muted-foreground font-mono">
                          {unitSystem === "ip" ? "ft²" : "m²"}
                        </span>
                      </div>
                      <input
                        type="number"
                        min="20"
                        max="400"
                        value={coverage}
                        onChange={(e) => setCoverage(e.target.value === "" ? "" : parseFloat(e.target.value) || 130)}
                        className="h-10 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[13px] font-mono outline-none"
                      />
                    </div>

                    <div className="border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-baseline">
                        <label className="text-[13px] font-bold text-foreground">Sprinkler K-Factor</label>
                        <span className="text-[11.5px] text-muted-foreground font-mono">GPM/√psi</span>
                      </div>
                      <select
                        value={kFactor}
                        onChange={(e) => setKFactor(parseFloat(e.target.value))}
                        className="h-10 w-full px-3 border border-border focus:border-primary focus:ring-0 rounded-xl bg-background text-[13px] font-medium outline-none cursor-pointer"
                      >
                        {STANDARD_K_FACTORS.map(k => (
                          <option key={k} value={k}>K-{k.toFixed(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Sizing Outputs list */}
                  <div className="border border-border rounded-3xl bg-background shadow-sm overflow-hidden">
                    <div className="px-4 py-2 border-b border-border bg-header-bg">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Calculated Outputs Summary</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-y divide-border">
                      <div className="p-3.5 flex justify-between items-center text-[13px] bg-background">
                        <span className="text-muted-foreground">Flow rate per head</span>
                        <span className="font-bold font-mono text-foreground">{calcResults.formatFlow(calcResults.flowPerSprink)}</span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center text-[13px] bg-background">
                        <span className="text-muted-foreground">Min operating pressure</span>
                        <span className="font-bold font-mono text-foreground">{calcResults.pressReq.toFixed(1)} psi</span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center text-[13px] bg-background">
                        <span className="text-muted-foreground">Sprinkler count in area</span>
                        <span className="font-bold font-mono text-foreground">{calcResults.nSprink} heads</span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center text-[13px] bg-background">
                        <span className="text-muted-foreground">Sprinklers flow demand</span>
                        <span className="font-bold font-mono text-foreground">{calcResults.formatFlow(calcResults.totalSprinkFlow)}</span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center text-[13px] bg-background">
                        <span className="text-muted-foreground">Hose stream allowance</span>
                        <span className="font-bold font-mono text-foreground">{calcResults.formatFlow(calcResults.hoseAllow)}</span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center text-[13px] bg-background col-span-2">
                        <span className="text-muted-foreground font-bold">Total water demand</span>
                        <span className="font-bold font-mono text-red-500 text-[15px]">{calcResults.formatFlow(calcResults.systemTotal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Warning Messages */}
                  <div className="flex flex-col gap-2">
                    {calcResults.pressReq < 7 && (
                      <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-3xl p-3.5 flex gap-2.5 items-start">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5 animate-pulse" />
                        <div>
                          <h4 className="text-[12.5px] font-bold">Low Operating Pressure Violation</h4>
                          <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-normal">
                            Required pressure ({calcResults.pressReq.toFixed(1)} psi) is below the NFPA 13 minimum of 7.0 psi. Sizing is invalid. Increase hazard design density or use a sprinkler with a smaller K-Factor.
                          </p>
                        </div>
                      </div>
                    )}
                    {calcResults.coverFt2 > 225 && (
                      <div className="border border-warning/20 bg-warning/5 text-warning rounded-3xl p-3.5 flex gap-2.5 items-start">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-[12.5px] font-bold">Coverage Spacing Warning</h4>
                          <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-normal">
                            Sprinkler coverage area ({calcResults.coverFt2.toFixed(0)} ft²) exceeds standard maximum spacing limit of 225 ft² per sprinkler. Verify listings for extended coverage heads.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SVG Visual Chart */}
                <div className="w-[360px] shrink-0 p-6 bg-surface/10 flex flex-col gap-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Parameters Distribution</span>
                  <div className="border border-border-strong rounded-3xl bg-background p-4 shadow-sm flex flex-col gap-2">
                    <p className="text-[12.5px] font-bold text-foreground">Sprinkler Design Parameters</p>
                    <div className="w-full relative select-none">
                      <svg viewBox={`0 0 ${chartData.W} ${chartData.H}`} className="w-full h-auto block font-sans">
                        <text x={chartData.PL + chartData.CW / 2} y="15" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--muted)">NFPA 13 PARAMETERS CHART</text>
                        {chartData.items.map((item, idx) => {
                          const barH = 22;
                          const spacing = 14;
                          const y = chartData.PT + idx * (barH + spacing);
                          const w = Math.max(5, (item.val / chartData.maxVal) * chartData.CW);
                          return (
                            <g key={idx}>
                              <text x={chartData.PL - 8} y={y + barH / 2 + 3} textAnchor="end" fontSize="9" fontWeight="bold" fill="var(--muted)">{item.label}</text>
                              <rect x={chartData.PL} y={y} width={chartData.CW} height={barH} fill="var(--border)" rx="3" opacity="0.2" />
                              <rect x={chartData.PL} y={y} width={w} height={barH} fill={item.color} rx="3" opacity="0.85" />
                              <text x={chartData.PL + w + 5} y={y + barH / 2 + 3.5} textAnchor="start" fontSize="9.5" fontWeight="700" fill={item.color} fontFamily="var(--mono)">
                                {item.val.toFixed(1)}{item.unit}
                              </text>
                            </g>
                          );
                        })}
                        {/* Vertical line axis */}
                        <line x1={chartData.PL} y1={chartData.PT - 5} x2={chartData.PL} y2={chartData.H - chartData.PB + 10} stroke="var(--border-strong)" strokeWidth="1" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Sizing Report summary */}
            {tab === "report" && (
              <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6 w-full">
                {/* Toolbar */}
                <div className="flex justify-between items-center pb-4 border-b border-border">
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground">Sprinkler Density & Demand Report</h3>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5">Summary of NFPA 13 preliminary water supply requirements.</p>
                  </div>
                  <div className="flex items-center gap-2 no-print print:hidden">
                    <button
                      onClick={exportPdf}
                      className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl text-[12.5px] font-semibold border border-border bg-background hover:bg-surface-2 text-foreground cursor-pointer"
                    >
                      <FileText className="size-3.5 text-destructive" /> Export PDF
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl text-[12.5px] font-semibold border border-border bg-background hover:bg-surface-2 text-foreground cursor-pointer"
                    >
                      <Printer className="size-3.5 text-muted-foreground" /> Print Report
                    </button>
                  </div>
                </div>

                {/* Four KPI cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                      <Grid className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Design Area</span>
                      <div className="text-[20px] font-extrabold font-mono text-foreground mt-0.5">
                        {calcResults.formatArea(calcResults.designAreaFt2)}
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">{calcResults.nSprink} heads in area</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                      <Droplet className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Discharge / Head</span>
                      <div className="text-[20px] font-extrabold font-mono text-primary mt-0.5">
                        {calcResults.formatFlow(calcResults.flowPerSprink)}
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">K-{kFactor} coefficient</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-sky-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <Activity className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Pressure Required</span>
                      <div className="text-[20px] font-extrabold font-mono text-primary mt-0.5">
                        {calcResults.pressReq.toFixed(1)} <span className="text-[11px] font-normal text-muted-foreground">psi</span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">At remote sprinkler</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                      <Flame className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Total Water Supply</span>
                      <div className="text-[20px] font-extrabold font-mono text-red-500 mt-0.5">
                        {calcResults.formatFlow(calcResults.systemTotal)}
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">With hose allowance</span>
                    </div>
                  </div>
                </div>

                {/* Two Column Layout: Parameters (left) and Audit Sidebar (right) */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  
                  {/* Left Column: Sizing Parameters table */}
                  <div className="flex-1 min-w-0 w-full border border-border rounded-3xl bg-background shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-surface-2/15 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-foreground">Sprinkler Sizing Parameters Preview</span>
                      <span className="text-[11px] text-muted-foreground font-mono">NFPA 13</span>
                    </div>
                    <div className="p-4 flex flex-col gap-4 text-[13px] text-foreground">
                      <div className="grid grid-cols-2 gap-y-2 border-b border-border pb-3">
                        <div>Project Code: <span className="font-semibold font-mono">{project.code}</span></div>
                        <div>Project Name: <span className="font-semibold">{project.name}</span></div>
                        <div>Client Name: <span className="font-semibold">{project.client}</span></div>
                        <div>Hazard Sized: <span className="font-semibold capitalize">{hazard === "custom" ? "Custom" : hazard}</span></div>
                      </div>

                      <table className="w-full text-left border-collapse text-[12.5px]">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
                            <th className="py-2.5">Sizing Parameter</th>
                            <th className="py-2.5 text-right">Value</th>
                            <th className="py-2.5 text-center">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-medium">
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Design Density</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{calcResults.formatDens(calcResults.densIP).split(" ")[0]}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{calcResults.formatDens(calcResults.densIP).split(" ").slice(1).join(" ")}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Design Area</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{calcResults.formatArea(calcResults.designAreaFt2).split(" ")[0]}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{calcResults.formatArea(calcResults.designAreaFt2).split(" ").slice(1).join(" ")}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Coverage per Sprinkler</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{coverage}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{unitSystem === "ip" ? "ft²" : "m²"}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Sprinkler K-Factor</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{kFactor}</td>
                            <td className="py-2.5 text-center text-muted-foreground">gpm/psi⁰·⁵</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Flow Rate per Sprinkler</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{calcResults.formatFlow(calcResults.flowPerSprink).split(" ")[0]}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{calcResults.formatFlow(calcResults.flowPerSprink).split(" ").slice(1).join(" ")}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Sprinkler Count in Area</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{calcResults.nSprink}</td>
                            <td className="py-2.5 text-center text-muted-foreground">heads</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Sprinkler Flow Demand</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{calcResults.formatFlow(calcResults.totalSprinkFlow).split(" ")[0]}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{calcResults.formatFlow(calcResults.totalSprinkFlow).split(" ").slice(1).join(" ")}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Hose Allowance (NFPA 13)</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{calcResults.formatFlow(calcResults.hoseAllow).split(" ")[0]}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{calcResults.formatFlow(calcResults.hoseAllow).split(" ").slice(1).join(" ")}</td>
                          </tr>
                          <tr className="bg-surface/50 border-t border-border font-bold">
                            <td className="py-2.5 text-foreground">Total Water Supply Demand</td>
                            <td className="py-2.5 text-right font-mono font-bold text-red-500 text-[14.5px]">{calcResults.formatFlow(calcResults.systemTotal).split(" ")[0]}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{calcResults.formatFlow(calcResults.systemTotal).split(" ").slice(1).join(" ")}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Audits & Recommendations */}
                  <div className="w-full lg:w-[350px] shrink-0 flex flex-col gap-4">
                    {/* Compliance Auditor Card */}
                    {(() => {
                      const hasLowPressure = calcResults.pressReq < 7.0;
                      const hasOverCoverage = calcResults.coverFt2 > 225;
                      
                      if (hasLowPressure) {
                        return (
                          <div className="border border-destructive/20 bg-destructive/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                            <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5 animate-pulse" />
                            <div>
                              <h4 className="text-[13px] font-bold text-destructive">NFPA 13 Code Warning</h4>
                              <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                                Required sprinkler pressure is {calcResults.pressReq.toFixed(1)} psi, which is below the NFPA 13 code minimum limit of 7.0 psi. System is non-compliant.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      if (hasOverCoverage) {
                        return (
                          <div className="border border-warning/20 bg-warning/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                            <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-[13px] font-bold text-warning">Coverage Area Alert</h4>
                              <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                                Sprinkler coverage area ({calcResults.coverFt2.toFixed(0)} ft²) exceeds the standard maximum limit of 225 ft² per head. Check listings for extended coverage.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="border border-success/20 bg-success/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                          <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-[13px] font-bold text-success">NFPA 13 Sizing Audit</h4>
                            <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                              System meets sizing code guidelines. Pressure and coverage requirements comply with general NFPA 13 design criteria.
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Recommendation details card */}
                    <div className="border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-3.5">
                      <p className="text-[13px] font-bold text-foreground leading-snug flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-primary" /> Sizing Recommendations
                      </p>
                      <div className="text-[12px] text-muted-foreground leading-relaxed flex flex-col gap-2.5">
                        {calcResults.pressReq > 35 && (
                          <div className="p-2.5 rounded bg-muted/65 border border-border text-foreground">
                            Operating pressure is very high ({calcResults.pressReq.toFixed(1)} psi). Changing to a larger sprinkler coefficient (e.g. K-8.0 or K-11.2) is recommended to decrease friction loss.
                          </div>
                        )}
                        {calcResults.pressReq < 7 && (
                          <div className="p-2.5 rounded bg-destructive/5 border border-destructive/10 text-foreground">
                            Decrease sprinkler K-Factor (e.g. K-4.2) or increase design density to raise pressure above 7.0 psi.
                          </div>
                        )}
                        {calcResults.pressReq >= 7 && calcResults.pressReq <= 35 && (
                          <div className="p-2.5 rounded bg-success/5 border border-success/10 text-foreground">
                            Operating pressure is optimal ({calcResults.pressReq.toFixed(1)} psi). No adjustments required.
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-1 border-t border-border pt-2 leading-normal">
                          Always check sprinkler manufacturer datasheets for exact listing criteria and k-factor coefficients.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Intelligence Side Drawer */}
        <div
          className={`shrink-0 bg-background overflow-hidden transition-[width] duration-300 ease-out select-none no-print print:hidden ${
            intelOpen ? "w-[360px] border-l border-border" : "w-0"
          }`}
        >
          {intelOpen && (
            <div className="w-[360px] h-full flex flex-col min-h-0 bg-background font-sans">
              <div className="flex items-center justify-between p-4 border-b border-border bg-header-bg shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4.5 text-primary" />
                  <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">Live Intelligence</h3>
                </div>
                <button onClick={() => setIntelOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {/* Guidelines */}
                <div className="border border-border rounded p-3.5 bg-background shadow-xs">
                  <h4 className="text-[12.5px] font-bold text-foreground">NFPA 13 Rules Guidance</h4>
                  <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
                    Preliminary sizing based on density/area curves. Minimum pressure check is required.
                  </p>
                  <ul className="text-[11px] text-muted-foreground mt-2 list-disc pl-4 flex flex-col gap-1">
                    <li>Minimum nozzle operating pressure is 7.0 psi.</li>
                    <li>Standard maximum spacing is 225 ft² for Light, 130 ft² for Ordinary hazards.</li>
                  </ul>
                </div>

                {/* Optimizations */}
                <div className="border border-border rounded p-3.5 bg-background shadow-xs">
                  <h4 className="text-[12.5px] font-bold text-foreground">Design Recommendations</h4>
                  <div className="flex flex-col gap-2.5 mt-2">
                    {calcResults.pressReq > 35 && (
                      <div className="text-[11.5px] text-warning flex gap-1.5 items-start">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5 text-warning" />
                        <span>Operating pressure is very high ({calcResults.pressReq.toFixed(1)} psi). Changing K-{kFactor} to a larger size (e.g. K-8.0 or K-11.2) is recommended to decrease required pressure and pump size.</span>
                      </div>
                    )}
                    {calcResults.pressReq < 7 && (
                      <div className="text-[11.5px] text-destructive flex gap-1.5 items-start">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5 text-destructive" />
                        <span>Required pressure ({calcResults.pressReq.toFixed(1)} psi) is below 7.0 psi. System violates code. Decrease sprinkler K-Factor (e.g., K-4.2) or increase design density to raise pressure.</span>
                      </div>
                    )}
                    {calcResults.pressReq >= 7 && calcResults.pressReq <= 35 && (
                      <div className="text-[11.5px] text-success flex gap-1.5 items-start">
                        <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-success" />
                        <span>Sizing meets code requirements. Operating pressure is optimal ({calcResults.pressReq.toFixed(1)} psi).</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
