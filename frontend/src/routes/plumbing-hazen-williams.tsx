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
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, FileSpreadsheet, X,
  Search, Activity, Droplet, Settings, Grid, Flame
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";

export const Route = createFileRoute("/plumbing-hazen-williams")({
  head: () => ({
    meta: [
      { title: "Hazen-Williams Pressure Drop — MEP Calc" },
      { name: "description", content: "Calculate fire sprinkler piping friction loss, velocity, and pressure drop using the Hazen-Williams equation." },
    ],
  }),
  component: HazenWilliamsPage,
});

function HazenWilliamsPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project } = useWorkspace();

  // Tabs & intelligence
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);

  // Unit system
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("ip");

  // Inputs matching original page-hazen-williams
  const [flow, setFlow] = useState<number | "">(100.0); // hw-flow (GPM)
  const [pipeSize, setPipeSize] = useState(2.469); // hw-pipe (NPS, default selected 2.5" ID 2.469)
  const [cFactor, setCFactor] = useState(120); // hw-c (C-factor, default selected Steel 120)
  const [length, setLength] = useState<number | "">(100.0); // hw-len (ft or m)

  // Math equations matching original calcHazen()
  const results = useMemo(() => {
    const ip = unitSystem === "ip";
    const Q = flow === "" ? 0 : flow;
    const d = pipeSize;
    const C = cFactor;
    // Length: L = ip ? length : length / 0.3048
    const lenVal = length === "" ? 0 : length;
    const L = ip ? lenVal : lenVal / 0.3048;

    // Equations
    const hf = 4.52 * L * Math.pow(Q, 1.85) / (Math.pow(C, 1.85) * Math.pow(d, 4.87));
    const hfp = 4.52 * 100 * Math.pow(Q, 1.85) / (Math.pow(C, 1.85) * Math.pow(d, 4.87));
    const v = Q / (2.448 * d * d);

    // Chart parameters matching setTimeout(()=>{renderHazenChart(ip?Q:Q*0.000063,ip?v:v*0.3048,ip?hfp:hfp*0.3048/100,d,ip);},55);
    const chartVel = ip ? v : v * 0.3048;
    const chartMaxVel = ip ? 8.0 : 2.44;
    const chartHlPer100 = ip ? hfp : hfp * 0.3048 / 100;

    return {
      hf,
      hfp,
      v,
      chartVel,
      chartMaxVel,
      chartHlPer100
    };
  }, [flow, pipeSize, cFactor, length, unitSystem]);

  // Vertical bar chart matching barSVG() from charts.js
  const chartSvg = useMemo(() => {
    const ip = unitSystem === "ip";
    const u = ip ? "fps" : "m/s";
    const pU = ip ? "psi/100ft" : "m/100m";

    const bars = [
      { label: "Velocity", val: results.chartVel, color: results.chartVel > (ip ? 8.0 : 2.44) ? "#0A7BC7" : "#d17914", unit: ` ${u}` },
      { label: `Max Rec (${ip ? "8" : "2.4"})`, val: ip ? 8.0 : 2.44, color: "#94A3B8", unit: ` ${u}` },
      { label: "Head Loss", val: results.chartHlPer100, color: "#7C3AED", unit: ` ${pU}` }
    ];

    const W = 360;
    const H = 200;
    const PL = 40;
    const PR = 16;
    const PT = 30;
    const PB = 44;
    const CW = W - PL - PR;
    const CH = H - PT - PB;

    const maxVal = Math.max(...bars.map(b => b.val)) * 1.15 || 10;
    const bw = CW / bars.length;
    const gap = bw * 0.28;
    const sx = (i: number) => PL + i * bw + gap / 2;
    const bw2 = bw - gap;
    const sy = (v: number) => PT + CH - (v / maxVal) * CH;

    return {
      W, H, PL, PR, PT, PB, CW, CH, bars, maxVal, sx, bw2, sy, u, pU
    };
  }, [results, unitSystem]);

  const flowVal = typeof flow === "number" ? flow : 0;
  const lengthVal = typeof length === "number" ? length : 0;

  // Export handlers
  const exportExcel = () => {
    const data = [
      { Parameter: "Flow Rate (Q) [GPM]", Value: flowVal.toFixed(1) },
      { Parameter: "Pipe Size (NPS)", Value: pipeSize.toFixed(3) },
      { Parameter: "Roughness Coefficient (C-Factor)", Value: cFactor.toString() },
      { Parameter: `Pipe Length [${unitSystem === "ip" ? "ft" : "m"}]`, Value: lengthVal.toFixed(1) },
      { Parameter: "Total Friction Loss [psi]", Value: results.hf.toFixed(3) },
      { Parameter: "Loss per 100 ft [psi/100ft]", Value: results.hfp.toFixed(3) },
      { Parameter: "Flow Velocity [fps]", Value: results.v.toFixed(2) }
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hazen-Williams");
    const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), `Hazen_Williams_Friction_${project.code}.xlsx`, "Excel Document", ["xlsx"]);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(220, 76, 52); // Red accent
    doc.text("Hazen-Williams Friction Loss Sizing Report", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Project: ${project.name} (${project.code})`, 14, 28);
    doc.text(`C-Factor: C-${cFactor}`, 14, 34);

    const tableData = [
      ["Flow Rate (Q)", `${flowVal.toFixed(1)} GPM`],
      ["Pipe Diameter (d)", `${pipeSize.toFixed(3)} inches`],
      ["Pipe Roughness (C)", cFactor.toString()],
      ["Segment Length (L)", `${lengthVal.toFixed(1)} ${unitSystem === "ip" ? "ft" : "m"}`],
      ["Total Friction Loss (hf)", `${results.hf.toFixed(3)} psi`],
      ["Friction Loss per 100 ft", `${results.hfp.toFixed(3)} psi/100ft`],
      ["Flow Velocity (v)", `${results.v.toFixed(2)} fps`]
    ];

    autoTable(doc, {
      startY: 42,
      head: [["Design Parameter", "Value / Sizing Results"]],
      body: tableData,
      theme: "striped",
      styles: { fontSize: 10 },
      headStyles: { fillColor: [220, 76, 52] }
    });

    
    const finalY = (doc as any).lastAutoTable?.finalY || 40;
    addPdfSignatureBlock(doc, finalY, currentUserName, project?.id || "default", "plumbing-hazen-williams");
    const pdfBuffer = doc.output("arraybuffer");
    downloadFile(new Uint8Array(pdfBuffer), `Hazen_Williams_Report_${project.code}.pdf`, "PDF Document", ["pdf"]);
  };

  return (
    <AppShell
      title="Hazen-Williams"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg px-6">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">FIRE FIGHTING &gt; HAZEN-WILLIAMS PRESSURE DROP</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Hazen-Williams Pressure Drop</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">NFPA 13 piping hydraulics sizer</span>
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
                {/* Inputs Area */}
                <div className="flex-1 min-w-0 p-6 flex flex-col gap-6 max-w-3xl">
                  <div className="flex gap-3.5 p-4 bg-background border border-border rounded-3xl shadow-sm">
                    <Info className="size-4.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-[13.5px] font-bold text-foreground">Flow &amp; Pressure - Hazen-Williams</h4>
                      <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
                        Calculate friction loss in fire protection piping using Hazen-Williams equation. Valid for turbulent water flow in clean pipes.
                      </p>
                    </div>
                  </div>

                  {/* Sizing inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Flow Rate (Q)</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={flow}
                          onChange={(e) => setFlow(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                          placeholder="e.g. 100"
                          className="h-10 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[13px] font-mono outline-none"
                        />
                        <span className="text-[11.5px] text-muted-foreground font-mono mt-1.5 w-12 shrink-0">GPM</span>
                      </div>
                    </div>

                    <div className="border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pipe Size (NPS)</label>
                      <select
                        value={pipeSize}
                        onChange={(e) => setPipeSize(parseFloat(e.target.value))}
                        className="w-full h-10 px-3 border border-border focus:border-primary focus:ring-0 rounded-xl bg-background text-[13px] outline-none font-medium cursor-pointer"
                      >
                        <option value="1.049">1" - ID 1.049"</option>
                        <option value="1.380">1¼" - ID 1.380"</option>
                        <option value="1.610">1½" - ID 1.610"</option>
                        <option value="2.067">2" - ID 2.067"</option>
                        <option value="2.469">2½" - ID 2.469"</option>
                        <option value="3.068">3" - ID 3.068"</option>
                        <option value="4.026">4" - ID 4.026"</option>
                        <option value="6.065">6" - ID 6.065"</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pipe Material (C-factor)</label>
                      <select
                        value={cFactor}
                        onChange={(e) => setCFactor(parseInt(e.target.value, 10) || 120)}
                        className="w-full h-10 px-3 border border-border focus:border-primary focus:ring-0 rounded-xl bg-background text-[13px] outline-none font-medium cursor-pointer"
                      >
                        <option value="120">Schedule 40 Steel - C=120</option>
                        <option value="100">Black Steel (aged) - C=100</option>
                        <option value="150">CPVC - C=150</option>
                        <option value="130">Copper - C=130</option>
                      </select>
                    </div>

                    <div className="border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pipe Length ({unitSystem === "ip" ? "ft" : "m"})</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={length}
                          onChange={(e) => setLength(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                          placeholder="e.g. 100"
                          className="h-10 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[13px] font-mono outline-none"
                        />
                        <span className="text-[11.5px] text-muted-foreground font-mono mt-2 w-8 text-center shrink-0">
                          {unitSystem === "ip" ? "ft" : "m"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Outputs Summary */}
                  <div className="border border-border rounded-3xl bg-background shadow-sm overflow-hidden">
                    <div className="px-4 py-2 border-b border-border bg-header-bg">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Friction Loss Result</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-y divide-border">
                      <div className="p-3.5 flex justify-between items-center text-[13px] bg-background">
                        <span className="text-muted-foreground">Loss per 100 ft</span>
                        <span className="font-bold font-mono text-foreground">{results.hfp.toFixed(3)} psi/100ft</span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center text-[13px] bg-background">
                        <span className="text-muted-foreground">Flow Velocity</span>
                        <span className="font-bold font-mono text-foreground">{results.v.toFixed(2)} fps</span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center text-[13px] bg-background col-span-2">
                        <span className="text-muted-foreground font-bold">Total Friction Loss</span>
                        <span className="font-bold font-mono text-red-500 text-[15px]">{results.hf.toFixed(3)} psi</span>
                      </div>
                    </div>
                  </div>

                  {/* Calculation steps toggle */}
                  <div className="border border-border rounded-3xl bg-background shadow-sm overflow-hidden">
                    <div className="px-4 py-2 border-b border-border bg-header-bg">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">∑ Calculation Steps</span>
                    </div>
                    <div className="p-4 flex flex-col gap-4">
                      <div className="flex flex-col gap-1 border-b border-border/50 pb-2">
                        <div className="text-[12px] font-bold text-foreground">1. Hazen-Williams friction loss</div>
                        <div className="text-[11px] font-mono text-muted-foreground">hf = 4.52 × L × Q^1.85 / (C^1.85 × d^4.87)</div>
                        <div className="text-[12.5px] font-mono font-bold text-foreground mt-1">{results.hf.toFixed(3)} psi</div>
                      </div>
                      <div className="flex flex-col gap-1 border-b border-border/50 pb-2">
                        <div className="text-[12px] font-bold text-foreground">2. Loss per 100 ft</div>
                        <div className="text-[11px] font-mono text-muted-foreground">same formula with L=100</div>
                        <div className="text-[12.5px] font-mono font-bold text-foreground mt-1">{results.hfp.toFixed(3)} psi/100ft</div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="text-[12px] font-bold text-foreground">3. Flow velocity</div>
                        <div className="text-[11px] font-mono text-muted-foreground">v = Q / (2.448 × d²)</div>
                        <div className="text-[12.5px] font-mono font-bold text-foreground mt-1">{results.v.toFixed(2)} fps</div>
                      </div>
                    </div>
                  </div>

                  {/* Warning Messages */}
                  <div className="flex flex-col gap-2">
                    {results.v > 20 && (
                      <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-3xl p-3.5 flex gap-2.5 items-start">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5 animate-pulse" />
                        <div>
                          <h4 className="text-[12.5px] font-bold">Velocity Alert</h4>
                          <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-normal">
                            Velocity {results.v.toFixed(1)} fps - Very high. Water hammer risk in fire systems.
                          </p>
                        </div>
                      </div>
                    )}
                    {results.hf > 10 && (
                      <div className="border border-warning/20 bg-warning/5 text-warning rounded-3xl p-3.5 flex gap-2.5 items-start">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-[12.5px] font-bold">Head Loss Alert</h4>
                          <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-normal">
                            High friction loss {results.hf.toFixed(2)} psi - verify system pressure budget.
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
                    <p className="text-[12.5px] font-bold text-foreground">Flow & Hydraulics Summary</p>
                    <div className="w-full relative select-none">
                      <svg viewBox={`0 0 ${chartSvg.W} ${chartSvg.H}`} className="w-full h-auto block font-sans overflow-visible">
                        {/* Title */}
                        <text x={chartSvg.PL} y="18" fontSize="9.5" fontWeight="700" fill="var(--muted)" letterSpacing="0.5">FLOW & HYDRAULICS SUMMARY</text>
                        
                        {/* Y-axis gridlines (3 ticks) */}
                        {[0.25, 0.5, 0.75, 1.0].map(ratio => {
                          const val = ratio * chartSvg.maxVal;
                          const y = chartSvg.sy(val);
                          const lbl = val >= 1000 ? (val / 1000).toFixed(1) + "k" : val.toFixed(val < 10 ? 1 : 0);
                          return (
                            <g key={ratio}>
                              <line x1={chartSvg.PL} y1={y} x2={chartSvg.W - chartSvg.PR} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                              <text x={chartSvg.PL - 5} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="var(--muted)" fontFamily="var(--mono)">{lbl}</text>
                            </g>
                          );
                        })}

                        {/* X and Y axes */}
                        <line x1={chartSvg.PL} y1={chartSvg.PT} x2={chartSvg.PL} y2={chartSvg.PT + chartSvg.CH} stroke="var(--border)" strokeWidth="1" />
                        <line x1={chartSvg.PL} y1={chartSvg.PT + chartSvg.CH} x2={chartSvg.W - chartSvg.PR} y2={chartSvg.PT + chartSvg.CH} stroke="var(--border)" strokeWidth="1" />

                        {/* Bars rendering */}
                        {chartSvg.bars.map((b, idx) => {
                          const h = Math.max(3, (b.val / chartSvg.maxVal) * chartSvg.CH);
                          const x = chartSvg.sx(idx);
                          const y = chartSvg.sy(b.val);
                          const valStr = b.val.toFixed(b.val < 10 ? 2 : 1);
                          const lx = x + chartSvg.bw2 / 2;
                          return (
                            <g key={idx}>
                              <rect x={x} y={y} width={chartSvg.bw2} height={h} fill={b.color} rx="3" opacity="0.88" />
                              <text x={lx} y={y - 5} textAnchor="middle" fontSize="9" fill={b.color} fontWeight="700" fontFamily="var(--mono)">
                                {valStr}{b.unit}
                              </text>
                              <text x={lx} y={chartSvg.PT + chartSvg.CH + 14} textAnchor="middle" fontSize="8.5" fill="var(--muted)">{b.label}</text>
                            </g>
                          );
                        })}
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
                    <h3 className="text-[16px] font-bold text-foreground">Hazen-Williams Friction Report</h3>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5">Summary of black steel/CPVC pipe hydraulics sizing.</p>
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
                      <Settings className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Pipe Diameter</span>
                      <div className="text-[20px] font-extrabold font-mono text-foreground mt-0.5">
                        {pipeSize.toFixed(3)} <span className="text-[11px] font-normal text-muted-foreground">in</span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">Material: C-{cFactor}</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                      <Droplet className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Design Flow</span>
                      <div className="text-[20px] font-extrabold font-mono text-primary mt-0.5">
                        {flowVal.toFixed(1)} <span className="text-[11px] font-normal text-muted-foreground">GPM</span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">System supply rate</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-sky-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <Activity className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Fluid Velocity</span>
                      <div className="text-[20px] font-extrabold font-mono text-primary mt-0.5">
                        {results.v.toFixed(2)} <span className="text-[11px] font-normal text-muted-foreground">fps</span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">Erosion risk above 20 fps</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                      <Flame className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Total Friction Loss</span>
                      <div className="text-[20px] font-extrabold font-mono text-red-500 mt-0.5">
                        {results.hf.toFixed(3)} <span className="text-[11px] font-normal text-muted-foreground">psi</span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">Over {lengthVal.toFixed(1)} {unitSystem === "ip" ? "ft" : "m"}</span>
                    </div>
                  </div>
                </div>

                {/* Two Column Layout: Parameters (left) and Audit Sidebar (right) */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  
                  {/* Left Column: Sizing Parameters table */}
                  <div className="flex-1 min-w-0 w-full border border-border rounded-3xl bg-background shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-surface-2/15 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-foreground">Hydraulic Sizing Summary Preview</span>
                      <span className="text-[11px] text-muted-foreground font-mono">Hazen-Williams</span>
                    </div>
                    <div className="p-4 flex flex-col gap-4 text-[13px] text-foreground">
                      <div className="grid grid-cols-2 gap-y-2 border-b border-border pb-3">
                        <div>Project Code: <span className="font-semibold font-mono">{project.code}</span></div>
                        <div>Project Name: <span className="font-semibold">{project.name}</span></div>
                        <div>Client Name: <span className="font-semibold">{project.client}</span></div>
                        <div>Roughness Coefficient (C): <span className="font-semibold font-mono">{cFactor}</span></div>
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
                            <td className="py-2.5 text-muted-foreground">Design Flow Rate</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{flowVal.toFixed(1)}</td>
                            <td className="py-2.5 text-center text-muted-foreground">GPM</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Internal Diameter</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{pipeSize.toFixed(3)}</td>
                            <td className="py-2.5 text-center text-muted-foreground">inches</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Pipe Segment Length</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{lengthVal.toFixed(1)}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{unitSystem === "ip" ? "ft" : "m"}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Fluid Velocity</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{results.v.toFixed(2)}</td>
                            <td className="py-2.5 text-center text-muted-foreground">fps</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Friction Loss per 100 ft</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{results.hfp.toFixed(3)}</td>
                            <td className="py-2.5 text-center text-muted-foreground">psi/100ft</td>
                          </tr>
                          <tr className="bg-surface/50 border-t border-border font-bold">
                            <td className="py-2.5 text-foreground">Total Friction Loss</td>
                            <td className="py-2.5 text-right font-mono font-bold text-red-500 text-[14.5px]">{results.hf.toFixed(3)}</td>
                            <td className="py-2.5 text-center text-muted-foreground">psi</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Audits & Recommendations */}
                  <div className="w-full lg:w-[350px] shrink-0 flex flex-col gap-4">
                    
                    {/* Compliance Auditor Card */}
                    {(() => {
                      const isHighVelocity = results.v > 20.0;
                      const isWarningVelocity = results.v > 8.0 && results.v <= 20.0;
                      
                      if (isHighVelocity) {
                        return (
                          <div className="border border-destructive/20 bg-destructive/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                            <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5 animate-pulse" />
                            <div>
                              <h4 className="text-[13px] font-bold text-destructive">Severe Velocity Warning</h4>
                              <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                                Fluid velocity of {results.v.toFixed(1)} fps exceeds standard limits, posing serious water hammer and pipe erosion risks. Sizing adjustments required.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      if (isWarningVelocity) {
                        return (
                          <div className="border border-warning/20 bg-warning/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                            <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-[13px] font-bold text-warning">Velocity Limit Warning</h4>
                              <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                                Velocity of {results.v.toFixed(1)} fps exceeds recommended 8.0 fps guideline. Check local codes.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="border border-success/20 bg-success/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                          <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-[13px] font-bold text-success">Velocity Sizing Compliant</h4>
                            <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                              Piping fluid velocity is {results.v.toFixed(2)} fps, which complies with fire protection standard design guidelines.
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Friction Loss Budget Alert */}
                    {results.hf > 10.0 && (
                      <div className="border border-warning/20 bg-warning/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                        <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5 animate-pulse" />
                        <div>
                          <h4 className="text-[13px] font-bold text-warning">High Friction Loss</h4>
                          <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                            High segment friction loss of {results.hf.toFixed(2)} psi detected. Ensure layout operates within your project's overall hydraulic pressure budget.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Recommendation details card */}
                    <div className="border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-3.5">
                      <p className="text-[13px] font-bold text-foreground leading-snug flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-primary" /> Hydraulic Sizing Advice
                      </p>
                      <div className="text-[12px] text-muted-foreground leading-relaxed flex flex-col gap-2.5">
                        {results.v > 20 && (
                          <div className="p-2.5 rounded bg-destructive/5 border border-destructive/10 text-foreground">
                            Increasing pipe internal diameter to next standard nominal size is highly recommended to suppress erosion risks.
                          </div>
                        )}
                        {results.v > 8 && results.v <= 20 && (
                          <div className="p-2.5 rounded bg-muted/65 border border-border text-foreground">
                            Increasing diameter slightly would decrease velocity and lower pump head demand.
                          </div>
                        )}
                        {results.v <= 8 && (
                          <div className="p-2.5 rounded bg-success/5 border border-success/10 text-foreground">
                            Operating parameters are within optimal ranges. Piping friction loss is minimized.
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-1 border-t border-border pt-2 leading-normal">
                          Friction calculations based on Hazen-Williams equation under standard fluid parameters.
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
                  <h4 className="text-[12.5px] font-bold text-foreground">NFPA 13 Velocity Guidelines</h4>
                  <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
                    Hazen-Williams friction loss check:
                  </p>
                  <ul className="text-[11px] text-muted-foreground mt-2 list-disc pl-4 flex flex-col gap-1">
                    <li>Fluid velocity should ideally remain below 20.0 fps (6.0 m/s) to avoid surge pressure/water hammer.</li>
                    <li>Sizing standard Black Steel wet piping utilizes a C-Factor of 120, dry piping utilizes C-100, and CPVC utilizes C-150.</li>
                  </ul>
                </div>

                {/* Optimizations */}
                <div className="border border-border rounded p-3.5 bg-background shadow-xs">
                  <h4 className="text-[12.5px] font-bold text-foreground">AI Sizing Recommendations</h4>
                  <div className="flex flex-col gap-2.5 mt-2">
                    {results.v > 20 && (
                      <div className="text-[11.5px] text-destructive flex gap-1.5 items-start">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5 text-destructive animate-pulse" />
                        <span>Fluid velocity is high ({results.v.toFixed(1)} fps). Increasing pipe diameter to next standard nominal size is highly recommended.</span>
                      </div>
                    )}
                    {results.v > 8 && results.v <= 20 && (
                      <div className="text-[11.5px] text-warning flex gap-1.5 items-start">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5 text-warning" />
                        <span>Velocity ({results.v.toFixed(1)} fps) exceeds standard 8.0 fps guideline. Check local code requirements.</span>
                      </div>
                    )}
                    {results.v <= 8 && (
                      <div className="text-[11.5px] text-success flex gap-1.5 items-start">
                        <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-success" />
                        <span>Pipe sizing is optimal. Flow velocity is well within standard hydraulic parameters.</span>
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
