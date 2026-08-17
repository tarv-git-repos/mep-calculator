import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/duct-sizer")({
  head: () => ({
    meta: [
      { title: "Duct Sizer — MEP Calc" },
      { name: "description", content: "Interactive HVAC duct sizer implementing Equal Friction Method." },
    ],
  }),
  component: DuctSizerPage,
});

// Colebrook friction factor solved iteratively
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

type DuctShape = "round" | "rect";

function DuctSizerPage() {
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");
  const [airflow, setAirflow] = useState<number | "">("");
  const [targetFr, setTargetFr] = useState<number | "">(""); // in w.g./100ft (IP) or Pa/m (SI)
  const [ductShape, setDuctShape] = useState<DuctShape>("round");
  const [aspectRatio, setAspectRatio] = useState<number>(1.5);
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [showFormulaPanel, setShowFormulaPanel] = useState<boolean>(false);

  const ip = unitSystem === "ip";

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;
    setUnitSystem(unit);
    if ((window as any).__mep_keep_values) return;
    // Convert inputs
    if (unit === "ip") {
      // SI -> IP
      setAirflow(airflow !== "" ? Number((Number(airflow) * 2.1189).toFixed(0)) : ""); // L/s to CFM
      setTargetFr(targetFr !== "" ? Number((Number(targetFr) / 8.16828).toFixed(3)) : ""); // Pa/m to in w.g./100ft
    } else {
      // IP -> SI
      setAirflow(airflow !== "" ? Number((Number(airflow) / 2.1189).toFixed(0)) : ""); // CFM to L/s
      setTargetFr(targetFr !== "" ? Number((Number(targetFr) * 8.16828).toFixed(2)) : ""); // in w.g./100ft to Pa/m
    }
  };

  const calculatedData = useMemo(() => {
    // Airflow Q in m³/s
    const airflowVal = airflow !== "" ? Number(airflow) : (ip ? 2500 : 1180);
    const targetFrVal = targetFr !== "" ? Number(targetFr) : (ip ? 0.08 : 0.65);

    const Q = ip ? airflowVal * 4.71947e-4 : airflowVal * 1e-3;
    const frPaM = ip ? targetFrVal * 8.16828 : targetFrVal;
    const rho = 1.204, mu = 1.81e-5, eps = 0.00009;

    // 1. Solve circular equivalent diameter
    let lo = 0.05, hi = 2.0;
    for (let i = 0; i < 100; i++) {
      const D = (lo + hi) / 2;
      const A = Math.PI * D * D / 4;
      const v = Q / A;
      const Re = rho * v * D / mu;
      const f = colebrook(Re, eps / D);
      const dP = f * rho * v * v / (2 * D);
      if (dP > frPaM) lo = D;
      else hi = D;
      if (hi - lo < 0.0001) break;
    }
    const calcD = (lo + hi) / 2;

    if (ductShape === "round") {
      const stdMm = [100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 450, 500, 550, 600, 650, 700, 750, 800, 900, 1000, 1100, 1200];
      const stdMmVal = stdMm.find(d => d / 1000 >= calcD) || 1200;
      const D = stdMmVal / 1000;
      const A = Math.PI * D * D / 4;
      const v = Q / A;
      const Re = rho * v * D / mu;
      const f = colebrook(Re, eps / D);
      const dPM = f * rho * v * v / (2 * D);
      const vFpm = v / 0.00508;

      return {
        calcD,
        sizeDisplay: ip ? `${(stdMmVal / 25.4).toFixed(0)}"` : `${stdMmVal} mm`,
        rectDisplay: null,
        deqDisplay: null,
        velocity: v,
        velocityFpm: vFpm,
        frictionRate: dPM,
        reynolds: Re,
        f,
        regime: Re < 2300 ? "Laminar" : Re < 4000 ? "Transitional" : "Turbulent"
      };
    } else {
      // Rectangular
      // Huebscher equivalent diameter: Deq = 1.30 * (a*b)^0.625 / (a+b)^0.25
      // b = Deq * (AR+1)^0.25 / (1.30 * AR^0.625)
      const AR = aspectRatio;
      const Deq = calcD;
      const b = Deq * Math.pow(AR + 1, 0.25) / (1.30 * Math.pow(AR, 0.625));
      const a = AR * b;

      // Round to 1" or 25mm increments
      const aRound = ip ? Math.ceil(a / 0.0254) * 0.0254 : Math.ceil(a * 1000 / 25) * 0.025;
      const bRound = ip ? Math.ceil(b / 0.0254) * 0.0254 : Math.ceil(b * 1000 / 25) * 0.025;

      const DeqStd = 1.30 * Math.pow(aRound * bRound, 0.625) / Math.pow(aRound + bRound, 0.25);
      const Aduct = aRound * bRound;
      const v = Q / Aduct;
      const Re = rho * v * DeqStd / mu;
      const f = colebrook(Re, eps / DeqStd);
      const dPM = f * rho * v * v / (2 * DeqStd);
      const vFpm = v / 0.00508;

      const toMM = (val: number) => ip ? `${(val / 0.0254).toFixed(0)}"` : `${Math.round(val * 1000)} mm`;
      const aStr = toMM(aRound);
      const bStr = toMM(bRound);

      return {
        calcD,
        sizeDisplay: `${aStr} × ${bStr}`,
        rectDisplay: `${aStr} (W) × ${bStr} (H) - Aspect ratio ${AR.toFixed(1)}:1`,
        deqDisplay: ip ? `${(DeqStd / 0.0254).toFixed(1)} in` : `${Math.round(DeqStd * 1000)} mm`,
        velocity: v,
        velocityFpm: vFpm,
        frictionRate: dPM,
        reynolds: Re,
        f,
        regime: Re < 2300 ? "Laminar" : Re < 4000 ? "Transitional" : "Turbulent"
      };
    }
  }, [airflow, targetFr, ductShape, aspectRatio, ip]);

  const warnings = useMemo(() => {
    const warns: string[] = [];
    if (calculatedData.velocityFpm > 2000) {
      warns.push(`${Math.round(calculatedData.velocityFpm)} FPM - High velocity for main duct. Review pressure class (SMACNA).`);
    } else if (calculatedData.velocityFpm < 300) {
      warns.push(`${Math.round(calculatedData.velocityFpm)} FPM - Low velocity. Settling risk in VAV systems.`);
    }
    if (ductShape === "rect" && aspectRatio > 4) {
      warns.push(`Aspect ratio ${aspectRatio.toFixed(1)}:1 - SMACNA recommends ≤ 4:1 to minimize material cost.`);
    }
    return warns;
  }, [calculatedData, ductShape, aspectRatio]);

  const handleCalculate = () => {
    setHasCalculated(true);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ["Duct Sizing Report"],
      [],
      ["Duct Shape", ductShape === "round" ? "Round" : "Rectangular"],
      ["Recommended Size", calculatedData.sizeDisplay],
      ["Air Velocity", ip ? `${calculatedData.velocityFpm.toFixed(0)} FPM` : `${calculatedData.velocity.toFixed(2)} m/s`],
      ["Actual Friction Rate", ip ? `${(calculatedData.frictionRate / 8.16828).toFixed(4)} in/100ft` : `${calculatedData.frictionRate.toFixed(3)} Pa/m`],
      ["Reynolds Number", Math.round(calculatedData.reynolds).toLocaleString()],
      ["Friction Factor (f)", calculatedData.f.toFixed(5)],
      ["Flow Regime", calculatedData.regime],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Duct Sizer");
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "Duct_Sizing.xlsx", "Excel Document", ["xlsx"]);
  };

  const renderChart = () => {
    const vel = ip ? calculatedData.velocityFpm : calculatedData.velocity;
    const vMax = ip ? 2500 : 12.7;
    const u = ip ? "FPM" : "m/s";

    const bars = [
      { label: `Velocity`, value: vel, color: vel > vMax ? "#0A7BC7" : "#d17914", display: vel.toFixed(0) + " " + u },
      { label: `Recommended Max`, value: vMax, color: "#64748B", display: vMax + " " + u }
    ];

    const W = 500;
    const H = 120;
    const PL = 120;
    const PR = 20;
    const PT = 20;
    const PB = 20;
    const CW = W - PL - PR;
    const CH = H - PT - PB;

    const maxVal = Math.max(...bars.map(b => b.value)) * 1.2 || 1;

    return (
      <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/40 p-4 border border-border rounded-2xl select-none mt-4">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/50">Duct Velocity vs Recommended Limits</h4>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block overflow-visible mt-2">
          {bars.map((b, i) => {
            const bw = CH / bars.length;
            const barH = bw * 0.6;
            const y = PT + i * bw + (bw - barH) / 2;
            const barW = (b.value / maxVal) * CW;
            return (
              <g key={i}>
                <text x={PL - 8} y={y + barH / 2 + 3.5} textAnchor="end" fontSize="9" fontWeight="700" fill="var(--text)" className="font-sans">{b.label}</text>
                <rect x={PL} y={y} width={Math.max(2, barW)} height={barH} fill={b.color} rx="2" />
                <text x={PL + barW + 6} y={y + barH / 2 + 3.5} textAnchor="start" fontSize="9" fontWeight="800" fill={b.color} className="font-mono">{b.display}</text>
              </g>
            );
          })}
          <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="var(--border)" strokeWidth="1" />
        </svg>
      </div>
    );
  };

  return (
    <AppShell title="Duct Sizer" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6">
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; DUCT SIZER</span>
            <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Duct Sizer + Friction Loss</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Size round or rectangular ducts for a target friction rate using the Equal Friction Method (SMACNA).
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left inputs */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-border/60 self-start select-none">
                <button type="button" onClick={() => handleUnitSystemChange("ip")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Imperial (IP)</button>
                <button type="button" onClick={() => handleUnitSystemChange("si")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Metric (SI)</button>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sizing Parameters</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {/* Airflow */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Airflow (Q) ({ip ? "CFM" : "L/s"})</label>
                    <input type="number" step="any" value={airflow} onChange={(e) => { setAirflow(e.target.value === "" ? "" : Number(e.target.value)); setHasCalculated(false); }} placeholder={ip ? "2500" : "1180"} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>

                  {/* Target Friction Rate */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Target Friction Rate ({ip ? "in w.g./100ft" : "Pa/m"})</label>
                    <input type="number" step="any" value={targetFr} onChange={(e) => { setTargetFr(e.target.value === "" ? "" : Number(e.target.value)); setHasCalculated(false); }} placeholder={ip ? "0.08" : "0.65"} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>

                  {/* Shape */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Duct Shape</label>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 border border-border/60 select-none">
                      <button type="button" onClick={() => { setDuctShape("round"); setHasCalculated(false); }} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ductShape === "round" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Round</button>
                      <button type="button" onClick={() => { setDuctShape("rect"); setHasCalculated(false); }} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ductShape === "rect" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Rectangular</button>
                    </div>
                  </div>

                  {/* Aspect Ratio */}
                  {ductShape === "rect" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground">Aspect Ratio (W:H)</label>
                      <select value={aspectRatio} onChange={(e) => { setAspectRatio(Number(e.target.value)); setHasCalculated(false); }} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]">
                        <option value="1.0">1:1 - Square</option>
                        <option value="1.5">1.5:1 - Low profile</option>
                        <option value="2.0">2:1 - Standard</option>
                        <option value="3.0">3:1 - Wide</option>
                        <option value="4.0">4:1 - Very wide</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <button type="button" onClick={handleCalculate} className="w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs">
                ⚡ Calculate Duct Size
              </button>
            </div>

            {/* Right results */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {!hasCalculated ? (
                <div className="bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs">
                  <div className="size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none">
                    📏
                  </div>
                  <h4 className="text-xs font-bold text-foreground mb-1 uppercase tracking-wider">Ready to Size</h4>
                  <p className="text-[11.5px] text-muted-foreground max-w-xs leading-normal">
                    Enter the duct airflow and your target friction rate to calculate recommended sizing.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5 animate-fade-in">
                  <div className="flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none">
                    <TBtn onClick={() => setShowFormulaPanel(!showFormulaPanel)} className="h-8.5 text-xs"><HelpCircle className="size-3.5" /> Formula Reference</TBtn>
                  </div>

                  {showFormulaPanel && (
                    <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-5 shadow-xs text-xs flex flex-col gap-2">
                      <h4 className="font-bold text-foreground mb-1">Duct Sizing Equations</h4>
                      <p className="text-muted-foreground">Solved iteratively using Darcy-Weisbach and Colebrook equations. Aspect ratio equivalents determined using Huebscher's formula.</p>
                    </div>
                  )}

                  {warnings.length > 0 && (
                    <div className="bg-sky-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl p-3.5 flex flex-col gap-2 text-[11.5px]">
                      {warnings.map((w, idx) => (
                        <div key={idx} className="flex gap-2.5 items-start">
                          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                      <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Results</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40 col-span-2">
                        <span className="font-semibold text-muted-foreground">{ductShape === "round" ? "Standard Diameter" : "Recommended Dimensions"}</span>
                        <strong className="font-bold text-[#0A7BC7] text-[15px] font-mono">
                          {calculatedData.sizeDisplay}
                        </strong>
                      </div>
                      {ductShape === "rect" && (
                        <>
                          <div className="flex justify-between items-center py-1.5 border-b border-border/40 col-span-2">
                            <span className="font-semibold text-muted-foreground">Full Dimension</span>
                            <strong className="font-bold text-foreground font-mono">
                              {calculatedData.rectDisplay}
                            </strong>
                          </div>
                          <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                            <span className="font-semibold text-muted-foreground">Equivalent Diameter</span>
                            <strong className="font-bold text-foreground font-mono">
                              {calculatedData.deqDisplay}
                            </strong>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Air Velocity</span>
                        <strong className="font-bold text-foreground font-mono">
                          {ip ? `${calculatedData.velocityFpm.toFixed(0)} FPM` : `${calculatedData.velocity.toFixed(2)} m/s`}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Actual Friction Loss</span>
                        <strong className="font-bold text-foreground font-mono">
                          {ip ? `${(calculatedData.frictionRate / 8.16828).toFixed(4)} in/100ft` : `${calculatedData.frictionRate.toFixed(3)} Pa/m`}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Reynolds Number</span>
                        <strong className="font-bold text-foreground font-mono">
                          {Math.round(calculatedData.reynolds).toLocaleString()}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Friction Factor (f)</span>
                        <strong className="font-bold text-foreground font-mono">
                          {calculatedData.f.toFixed(5)}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 col-span-2">
                        <span className="font-semibold text-muted-foreground">Flow Regime</span>
                        <strong className="font-bold text-foreground font-mono">
                          {calculatedData.regime}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {renderChart()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
