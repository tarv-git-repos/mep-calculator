import { createFileRoute } from "@tanstack/react-router";
import { cToF, fToC, m3sToCfm, cfmToM3s } from "@/utils/conversions";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { AlertTriangle, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/fresh-air-cooling-load")({
  head: () => ({
    meta: [
      { title: "Fresh Air Cooling Load \u2014 MEP Calc" },
      { name: "description", content: "Fresh Air Cooling Load calculator for sensible, latent, and total loads." },
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
  const ws = 0.621945 * satP(wb + 273.15) / (p - satP(wb + 273.15));
  return ((2501 - 2.381 * wb) * ws - 1.006 * (db - wb)) / (2501 + 1.805 * db - 4.186 * wb);
}



function FreshAirCoolingLoadPage() {
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");
  const [dbIn, setDbIn] = useState(95);
  const [wbIn, setWbIn] = useState(78);
  const [dbOut, setDbOut] = useState(55);
  const [wbOut, setWbOut] = useState(54);
  const [flowRate, setFlowRate] = useState(1000);
  const [hasCalculated, setHasCalculated] = useState(false);

  const ip = unitSystem === "ip";

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;
    setUnitSystem(unit);
    if ((window as any).__mep_keep_values) return;
    const convT = (t: number) => unit === "ip" ? cToF(t) : fToC(t);
    const convF = (f: number) => unit === "ip" ? m3sToCfm(f) : cfmToM3s(f);
    setDbIn(Number(convT(dbIn).toFixed(1)));
    setWbIn(Number(convT(wbIn).toFixed(1)));
    setDbOut(Number(convT(dbOut).toFixed(1)));
    setWbOut(Number(convT(wbOut).toFixed(1)));
    setFlowRate(Number(convF(flowRate).toFixed(unit === "ip" ? 0 : 3)));
  };

  const calc = useMemo(() => {
    const P = 101000;
    const dbInC = ip ? fToC(dbIn) : dbIn;
    const wbInC = ip ? fToC(wbIn) : wbIn;
    const dbOutC = ip ? fToC(dbOut) : dbOut;
    const wbOutC = ip ? fToC(wbOut) : wbOut;

    let wIn = 0, wOut = 0;
    try { wIn = wFromWB(dbInC, wbInC, P); } catch {}
    try { wOut = wFromWB(dbOutC, wbOutC, P); } catch {}
    if (wIn < 0) wIn = 0;
    if (wOut < 0) wOut = 0;

    const wInD = ip ? wIn * 7000 : wIn;
    const wOutD = ip ? wOut * 7000 : wOut;

    let sensLoad = ip
      ? 1.08 * flowRate * (dbIn - dbOut)
      : 1.23 * flowRate * (dbIn - dbOut);
    let latLoad = ip
      ? 0.68 * flowRate * (wInD - wOutD)
      : 3010 * flowRate * (wIn - wOut);

    if (sensLoad < 0) sensLoad = 0;
    if (latLoad < 0) latLoad = 0;
    const totLoad = sensLoad + latLoad;
    const capacityTons = Math.max(0, totLoad / (ip ? 12000 : 3.517));

    return { wIn: wInD, wOut: wOutD, sensLoad, latLoad, totLoad, capacityTons };
  }, [dbIn, wbIn, dbOut, wbOut, flowRate, ip]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (wbIn > dbIn) w.push("Entering Wet Bulb cannot be higher than Entering Dry Bulb temperature.");
    if (wbOut > dbOut) w.push("Leaving Wet Bulb cannot be higher than Leaving Dry Bulb temperature.");
    if (dbOut > dbIn) w.push("Leaving Dry Bulb temperature is greater than Entering Dry Bulb temperature (Coil is heating instead of cooling).");
    if (wbOut > wbIn) w.push("Leaving Wet Bulb temperature is greater than Entering Wet Bulb temperature.");
    return w;
  }, [dbIn, wbIn, dbOut, wbOut]);

  const handleExportExcel = () => {
    const wb2 = XLSX.utils.book_new();
    const uT = ip ? "F" : "C", uL = ip ? "BTU/h" : "kW", uW = ip ? "gr/lb" : "kg/kg";
    const data = [
      ["Fresh Air Cooling Load Sizing"], [],
      ["Entering Air DB", `${dbIn} ${uT}`],
      ["Entering Air WB", `${wbIn} ${uT}`],
      ["Leaving Air DB", `${dbOut} ${uT}`],
      ["Leaving Air WB", `${wbOut} ${uT}`],
      ["Fresh Air Flowrate", `${flowRate} ${ip ? "CFM" : "m3/s"}`], [],
      ["Results Summary"],
      ["Sensible Load", `${calc.sensLoad.toFixed(2)} ${uL}`],
      ["Latent Load", `${calc.latLoad.toFixed(2)} ${uL}`],
      ["Total Fresh Air Load", `${calc.totLoad.toFixed(2)} ${uL}`],
      ["Coil Capacity Sized", `${calc.capacityTons.toFixed(2)} TR`],
      ["Entering Humidity Ratio (W)", `${calc.wIn.toFixed(5)} ${uW}`],
      ["Leaving Humidity Ratio (W)", `${calc.wOut.toFixed(5)} ${uW}`],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb2, ws2, "Fresh Air Sizing");
    XLSX.writeFile(wb2, "Fresh_Air_Cooling_Load.xlsx");
  };

  const uT = ip ? "F" : "C";
  const uW = ip ? "gr/lb" : "kg/kg";
  const uL = ip ? "BTU/h" : "kW";

  return (
    <AppShell title="Fresh Air Cooling Load" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6">
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; FRESH AIR COOLING LOAD</span>
            <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Fresh Air Cooling Load</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Calculate sensible, latent, and total loads introduced by untreated outdoor makeup fresh air systems.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Inputs */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              {/* Unit toggle */}
              <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-border/60 self-start select-none">
                <button type="button" onClick={() => handleUnitSystemChange("ip")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  Imperial (IP)
                </button>
                <button type="button" onClick={() => handleUnitSystemChange("si")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  Metric (SI)
                </button>
              </div>

              {/* Entering Coil */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#f78f22] rounded-full" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Entering Coil Air Properties</h3>
                </div>
                <div className="flex flex-col gap-3.5 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground flex justify-between">
                      <span>Dry Bulb Temperature</span>
                      <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">{uT}</span>
                    </label>
                    <input type="number" step="any" value={dbIn}
                      onChange={e => { setDbIn(Number(e.target.value)); setHasCalculated(false); }}
                      className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground flex justify-between">
                      <span>Wet Bulb Temperature</span>
                      <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">{uT}</span>
                    </label>
                    <input type="number" step="any" value={wbIn}
                      onChange={e => { setWbIn(Number(e.target.value)); setHasCalculated(false); }}
                      className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  <div className="text-[11.5px] text-muted-foreground font-semibold py-1">
                    Calculated Entering Hum. Ratio:{" "}
                    <strong className="text-[#f78f22] font-mono">{calc.wIn.toFixed(ip ? 3 : 5)} {uW}</strong>
                  </div>
                </div>
              </div>

              {/* Leaving Coil */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#f78f22] rounded-full" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Leaving Coil Air Properties</h3>
                </div>
                <div className="flex flex-col gap-3.5 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground flex justify-between">
                      <span>Dry Bulb Temperature</span>
                      <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">{uT}</span>
                    </label>
                    <input type="number" step="any" value={dbOut}
                      onChange={e => { setDbOut(Number(e.target.value)); setHasCalculated(false); }}
                      className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground flex justify-between">
                      <span>Wet Bulb Temperature</span>
                      <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">{uT}</span>
                    </label>
                    <input type="number" step="any" value={wbOut}
                      onChange={e => { setWbOut(Number(e.target.value)); setHasCalculated(false); }}
                      className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  <div className="text-[11.5px] text-muted-foreground font-semibold py-1">
                    Calculated Leaving Hum. Ratio:{" "}
                    <strong className="text-[#f78f22] font-mono">{calc.wOut.toFixed(ip ? 3 : 5)} {uW}</strong>
                  </div>
                </div>
              </div>

              {/* Airflow */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#f78f22] rounded-full" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Airflow Rate</h3>
                </div>
                <div className="flex flex-col gap-1.5 text-xs">
                  <label className="font-semibold text-foreground flex justify-between">
                    <span>Total Fresh Air Flow Rate</span>
                    <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">{ip ? "CFM" : "m3/s"}</span>
                  </label>
                  <input type="number" step="any" value={flowRate}
                    onChange={e => { setFlowRate(Number(e.target.value)); setHasCalculated(false); }}
                    className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#f78f22]" />
                </div>
              </div>

              <button type="button" onClick={() => setHasCalculated(true)}
                className="w-full bg-[#f78f22] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#cf6610] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs">
                ⚡ Calculate Cooling Load
              </button>
            </div>

            {/* Right: Results */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {!hasCalculated ? (
                <div className="bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs">
                  <div className="size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-xl mb-4 border border-border/40 select-none">{"\ud83d\udca8"}</div>
                  <h4 className="text-xs font-bold text-foreground mb-1 uppercase tracking-wider">Ready to Solve</h4>
                  <p className="text-[11.5px] text-muted-foreground max-w-xs leading-normal">
                    Enter the entering and leaving air conditions along with system airflow rate to compute cooling coil load divisions.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5 animate-fade-in">
                  {/* Toolbar */}
                  <div className="flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none">
                    <TBtn onClick={handleExportExcel} className="h-8.5 text-xs">
                      <FileSpreadsheet className="size-3.5" /> Export Excel
                    </TBtn>
                  </div>

                  {/* Warnings */}
                  {warnings.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 rounded-xl p-3.5 flex flex-col gap-2 text-[11.5px] select-none">
                      {warnings.map((w, i) => (
                        <div key={i} className="flex gap-2.5 items-start">
                          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-red-600" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Results */}
                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                      <div className="w-1 h-3.5 bg-[#f78f22] rounded-full" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Results</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40 col-span-2">
                        <span className="font-semibold text-primary">Required Coil Sized Capacity</span>
                        <strong className="font-bold text-primary text-[15px] font-mono">{calc.capacityTons.toFixed(2)} TR</strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Sensible Heat Load</span>
                        <strong className="font-bold text-foreground font-mono">{calc.sensLoad.toFixed(0)} {uL}</strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Latent Heat Load</span>
                        <strong className="font-bold text-foreground font-mono">{calc.latLoad.toFixed(0)} {uL}</strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Entering Moisture (W_in)</span>
                        <strong className="font-bold text-foreground font-mono">{calc.wIn.toFixed(ip ? 2 : 5)} {uW}</strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Leaving Moisture (W_out)</span>
                        <strong className="font-bold text-foreground font-mono">{calc.wOut.toFixed(ip ? 2 : 5)} {uW}</strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 col-span-2">
                        <span className="font-bold text-muted-foreground">Total Fresh Air Heat Load</span>
                        <strong className="font-bold text-[#f78f22] text-[14px] font-mono">{calc.totLoad.toFixed(0)} {uL}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Bar chart */}
                  {(() => {
                    const bars = [
                      { label: "Sensible Load", value: calc.sensLoad, color: "#f78f22", display: calc.sensLoad.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " " + uL },
                      { label: "Latent Load",   value: calc.latLoad,  color: "#7C3AED", display: calc.latLoad.toLocaleString(undefined,  { maximumFractionDigits: 2 }) + " " + uL },
                    ];
                    const maxVal = Math.max(...bars.map(b => b.value)) * 1.2 || 1;
                    return (
                      <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/40 p-4 border border-border rounded-2xl select-none">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/50">Cooling Load Breakdown</h4>
                        <svg viewBox="0 0 500 120" className="w-full h-auto block overflow-visible mt-2">
                          {bars.map((b, i) => {
                            const bw = 80 / bars.length;
                            const bh = bw * 0.6;
                            const y = 20 + i * bw + (bw - bh) / 2;
                            const bWidth = (b.value / maxVal) * 370;
                            return (
                              <g key={i}>
                                <text x={102} y={y + bh / 2 + 3.5} textAnchor="end" fontSize="9" fontWeight="700" fill="var(--text)" className="font-sans">{b.label}</text>
                                <rect x={110} y={y} width={Math.max(2, bWidth)} height={bh} fill={b.color} rx="2" />
                                <text x={110 + bWidth + 6} y={y + bh / 2 + 3.5} textAnchor="start" fontSize="9" fontWeight="800" fill={b.color} className="font-mono">{b.display}</text>
                              </g>
                            );
                          })}
                          <line x1={110} y1={20} x2={110} y2={100} stroke="var(--border)" strokeWidth="1" />
                        </svg>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

