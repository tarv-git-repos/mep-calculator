import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/psychrometric")({
  head: () => ({
    meta: [
      { title: "Psychrometric — MEP Calc" },
      { name: "description", content: "Moist air psychrometric properties calculator utilizing standard Hyland-Wexler equations." },
    ],
  }),
  component: PsychrometricPage,
});

// Moist air property functions from 01-core.js
function satP(tK: number): number {
  if (tK >= 273.15) {
    const c8 = -5.8002206e3;
    const c9 = 1.3914993;
    const c10 = -4.864e-2;
    const c11 = 4.1764768e-5;
    const c12 = -1.4452093e-8;
    const c13 = 6.5459673;
    return Math.exp(c8 / tK + c9 + c10 * tK + c11 * Math.pow(tK, 2) + c12 * Math.pow(tK, 3) + c13 * Math.log(tK));
  }
  const c1 = -5.6745359e3;
  const c2 = 6.3925247;
  const c3 = -9.677843e-3;
  const c4 = 6.2215701e-7;
  const c5 = 2.0747825e-9;
  const c6 = -9.484024e-13;
  const c7 = 4.1635019;
  return Math.exp(c1 / tK + c2 + c3 * tK + c4 * Math.pow(tK, 2) + c5 * Math.pow(tK, 3) + c6 * Math.pow(tK, 4) + c7 * Math.log(tK));
}

function wFromRH(tC: number, rh: number, p: number): number {
  const pws = satP(tC + 273.15);
  return 0.621945 * (rh / 100) * pws / (p - (rh / 100) * pws);
}

function wFromWB(td: number, tw: number, p: number): number {
  const ws = 0.621945 * satP(tw + 273.15) / (p - satP(tw + 273.15));
  return ((2501 - 2.381 * tw) * ws - 1.006 * (td - tw)) / (2501 + 1.805 * td - 4.186 * tw);
}

function wFromDP(dp: number, p: number): number {
  const pws = satP(dp + 273.15);
  return 0.621945 * pws / (p - pws);
}

function dewPt(w: number, p: number): number {
  const pw = w * p / (0.621945 + w);
  let lo = -60, hi = 80;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (satP(m + 273.15) < pw) lo = m;
    else hi = m;
    if (hi - lo < 0.001) break;
  }
  return (lo + hi) / 2;
}

function wetBulb(td: number, w: number, p: number): number {
  let lo = -60, hi = td;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (wFromWB(td, m, p) < w) lo = m;
    else hi = m;
    if (hi - lo < 0.001) break;
  }
  return (lo + hi) / 2;
}

function fToC(f: number): number {
  return (f - 32) * 5 / 9;
}

function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

type SecondParam = "rh" | "wb" | "dp" | "w";

function PsychrometricPage() {
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");
  const [dbtInput, setDbtInput] = useState<number>(95);
  const [secondParam, setSecondParam] = useState<SecondParam>("rh");
  const [paramValue, setParamValue] = useState<number>(60);
  const [atmPressure, setAtmPressure] = useState<number>(101.325); // kPa
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [showFormulaPanel, setShowFormulaPanel] = useState<boolean>(false);

  const ip = unitSystem === "ip";

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;
    setUnitSystem(unit);
    if ((window as any).__mep_keep_values) return;
    // Convert temperatures and param values
    if (unit === "ip") {
      // SI -> IP
      setDbtInput(Number((dbtInput * 1.8 + 32).toFixed(1)));
      if (secondParam === "wb" || secondParam === "dp") {
        setParamValue(Number((paramValue * 1.8 + 32).toFixed(1)));
      } else if (secondParam === "w") {
        setParamValue(Number((paramValue * 7).toFixed(2))); // g/kg to gr/lb
      }
    } else {
      // IP -> SI
      setDbtInput(Number(((dbtInput - 32) / 1.8).toFixed(1)));
      if (secondParam === "wb" || secondParam === "dp") {
        setParamValue(Number(((paramValue - 32) / 1.8).toFixed(1)));
      } else if (secondParam === "w") {
        setParamValue(Number((paramValue / 7).toFixed(5))); // gr/lb to g/kg
      }
    }
  };

  const calculatedData = useMemo(() => {
    const pAtm = atmPressure * 1000; // kPa to Pa
    const tC = ip ? fToC(dbtInput) : dbtInput;
    let w = 0;

    const pv = Number(paramValue) || 0;

    if (secondParam === "rh") {
      w = wFromRH(tC, pv, pAtm);
    } else if (secondParam === "wb") {
      const wbC = ip ? fToC(pv) : pv;
      w = wFromWB(tC, wbC, pAtm);
    } else if (secondParam === "dp") {
      const dpC = ip ? fToC(pv) : pv;
      w = wFromDP(dpC, pAtm);
    } else {
      w = ip ? pv / 7000 : pv / 1000;
    }

    if (w < 0) w = 0;

    const pws = satP(tC + 273.15);
    const pw = w * pAtm / (0.621945 + w);
    const rh = Math.min(100, (pw / pws) * 100);
    const dp = dewPt(w, pAtm);
    const wb = wetBulb(tC, w, pAtm);
    const h = 1.006 * tC + w * (2501 + 1.805 * tC); // kJ/kg
    const v = 0.287042 * (tC + 273.15) * (1 + 1.607858 * w) / (pAtm / 1000); // m³/kg

    return {
      dbt: tC,
      wbt: wb,
      dp: dp,
      rh: rh,
      w: w,
      h: h,
      v: v,
      pw: pw
    };
  }, [dbtInput, secondParam, paramValue, atmPressure, ip]);

  const warnings = useMemo(() => {
    const warns: string[] = [];
    if (calculatedData.rh > 90) {
      warns.push(`RH ${calculatedData.rh.toFixed(1)}% - Near saturation. Condensation risk on cold surfaces.`);
    }
    if (calculatedData.rh < 20) {
      warns.push(`RH ${calculatedData.rh.toFixed(1)}% - Very dry air. Check comfort and static electricity concerns.`);
    }
    if (calculatedData.dbt > 40) {
      warns.push(`DBT ${calculatedData.dbt.toFixed(1)}°C - High temperature. Verify application.`);
    }
    return warns;
  }, [calculatedData]);

  const handleCalculate = () => {
    setHasCalculated(true);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ["Psychrometric State Report"],
      [],
      ["Dry Bulb Temperature", ip ? `${cToF(calculatedData.dbt).toFixed(1)} °F` : `${calculatedData.dbt.toFixed(1)} °C`],
      ["Wet Bulb Temperature", ip ? `${cToF(calculatedData.wbt).toFixed(1)} °F` : `${calculatedData.wbt.toFixed(1)} °C`],
      ["Dew Point Temperature", ip ? `${cToF(calculatedData.dp).toFixed(1)} °F` : `${calculatedData.dp.toFixed(1)} °C`],
      ["Relative Humidity", `${calculatedData.rh.toFixed(1)} %`],
      ["Humidity Ratio (W)", ip ? `${(calculatedData.w * 7000).toFixed(2)} gr/lb` : `${(calculatedData.w * 1000).toFixed(2)} g/kg`],
      ["Specific Enthalpy (h)", ip ? `${(calculatedData.h / 2.326).toFixed(2)} BTU/lb` : `${calculatedData.h.toFixed(2)} kJ/kg`],
      ["Specific Volume (v)", ip ? `${(calculatedData.v * 0.062428).toFixed(4)} ft³/lb` : `${calculatedData.v.toFixed(4)} m³/kg`],
      ["Vapor Pressure", ip ? `${(calculatedData.pw / 6894.76).toFixed(4)} psi` : `${(calculatedData.pw / 1000).toFixed(3)} kPa`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Psychrometric");
    XLSX.writeFile(wb, "Psychrometric_Properties.xlsx");
  };

  const renderChart = () => {
    const valDbt = ip ? cToF(calculatedData.dbt) : calculatedData.dbt + 273.15;
    const valDp = ip ? cToF(calculatedData.dp) : calculatedData.dp + 273.15;
    const valH = calculatedData.h;

    const uTemp = ip ? "°F" : "K";
    const uH = ip ? "BTU/lb" : "kJ/kg";

    const bars = [
      { label: `Dry Bulb (${uTemp})`, value: valDbt, color: "#f78f22", display: valDbt.toFixed(1) + " " + uTemp },
      { label: `Dew Point (${uTemp})`, value: valDp, color: "#cf6610", display: valDp.toFixed(1) + " " + uTemp },
      { label: `Enthalpy (${uH})`, value: valH, color: "#7C3AED", display: valH.toFixed(1) + " " + uH }
    ];

    const W = 500;
    const H = 160;
    const PL = 60;
    const PR = 20;
    const PT = 20;
    const PB = 40;
    const CW = W - PL - PR;
    const CH = H - PT - PB;

    const maxVal = Math.max(...bars.map(b => b.value)) * 1.2 || 1;

    return (
      <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/40 p-4 border border-border rounded-2xl select-none">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/50">Moist Air Properties Breakdown</h4>
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
    <AppShell title="Psychrometric Calculator" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6">
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; PSYCHROMETRIC</span>
            <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Psychrometric Calculator</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Calculate complete psychrometric state of moist air from two known properties based on Hyland-Wexler equations.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Inputs Panel */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-border/60 self-start select-none">
                <button type="button" onClick={() => handleUnitSystemChange("ip")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Imperial (IP)</button>
                <button type="button" onClick={() => handleUnitSystemChange("si")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Metric (SI)</button>
              </div>

              <div className="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#f78f22] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Input Conditions</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {/* Dry Bulb */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Dry Bulb Temperature ({ip ? "°F" : "°C"})</label>
                    <input type="number" step="any" value={dbtInput} onChange={(e) => { setDbtInput(Number(e.target.value)); setHasCalculated(false); }} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#f78f22]" />
                  </div>

                  {/* Parameter selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Known Second Parameter</label>
                    <div className="grid grid-cols-2 gap-2 select-none">
                      {(["rh", "wb", "dp", "w"] as SecondParam[]).map((param) => {
                        const active = secondParam === param;
                        const labelMap: Record<SecondParam, string> = { rh: "Rel. Humidity", wb: "Wet Bulb", dp: "Dew Point", w: "Hum. Ratio" };
                        return (
                          <button
                            key={param}
                            type="button"
                            onClick={() => {
                              setSecondParam(param);
                              setHasCalculated(false);
                              if (param === "rh") setParamValue(60);
                              else if (param === "wb" || param === "dp") setParamValue(ip ? 78 : 25);
                              else setParamValue(ip ? 100 : 15);
                            }}
                            className={`py-1.5 px-3 rounded-lg border text-center font-semibold transition-all ${
                              active
                                ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                                : "bg-slate-100/30 border-border/70 hover:bg-slate-100/60 text-muted-foreground"
                            }`}
                          >
                            {labelMap[param]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Parameter Value */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">
                      {secondParam === "rh" ? "Relative Humidity (%)" : secondParam === "wb" ? `Wet Bulb Temperature (${ip ? "°F" : "°C"})` : secondParam === "dp" ? `Dew Point Temperature (${ip ? "°F" : "°C"})` : `Humidity Ratio (${ip ? "gr/lb" : "g/kg"})`}
                    </label>
                    <input type="number" step="any" value={paramValue} onChange={(e) => { setParamValue(Number(e.target.value)); setHasCalculated(false); }} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#f78f22]" />
                  </div>

                  {/* Atmospheric Pressure */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Atmospheric Pressure (kPa)</label>
                    <input type="number" step="any" value={atmPressure} onChange={(e) => { setAtmPressure(Number(e.target.value)); setHasCalculated(false); }} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#f78f22]" />
                  </div>
                </div>
              </div>

              <button type="button" onClick={handleCalculate} className="w-full bg-[#f78f22] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#cf6610] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs">
                ⚡ Calculate Psychrometric State
              </button>
            </div>

            {/* Right Results Panel */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {!hasCalculated ? (
                <div className="bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs">
                  <div className="size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none">
                    📏
                  </div>
                  <h4 className="text-xs font-bold text-foreground mb-1 uppercase tracking-wider">Ready to Solve</h4>
                  <p className="text-[11.5px] text-muted-foreground max-w-xs leading-normal">
                    Enter the known Dry Bulb Temperature and select a second moist air property to solve the full psychrometric state.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5 animate-fade-in">
                  {/* Action row */}
                  <div className="flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none">
                    <TBtn onClick={handleExportExcel} className="h-8.5 text-xs"><FileSpreadsheet className="size-3.5" /> Export Excel</TBtn>
                    <TBtn onClick={() => setShowFormulaPanel(!showFormulaPanel)} className="h-8.5 text-xs"><HelpCircle className="size-3.5" /> Formula Reference</TBtn>
                  </div>

                  {showFormulaPanel && (
                    <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-5 shadow-xs text-xs flex flex-col gap-2">
                      <h4 className="font-bold text-foreground mb-1">Psychrometric Saturation Equations Reference</h4>
                      <p className="text-muted-foreground">Calculations utilize standard Hyland-Wexler equations to determine saturation pressure and humidity ratios.</p>
                      <code className="bg-slate-100 dark:bg-slate-800 p-2 rounded block font-mono text-[10.5px] text-primary">
                        W = 0.621945 × Pw / (P_atm - Pw)
                      </code>
                    </div>
                  )}

                  {/* Warning logs */}
                  {warnings.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl p-3.5 flex flex-col gap-2 text-[11.5px]">
                      {warnings.map((w, idx) => (
                        <div key={idx} className="flex gap-2.5 items-start">
                          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Properties Cards */}
                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                      <div className="w-1 h-3.5 bg-[#f78f22] rounded-full"></div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Solved Air State</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Dry Bulb Temp</span>
                        <strong className="font-bold text-foreground font-mono">
                          {ip ? `${cToF(calculatedData.dbt).toFixed(1)} °F` : `${calculatedData.dbt.toFixed(1)} °C`}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Wet Bulb Temp</span>
                        <strong className="font-bold text-foreground font-mono">
                          {ip ? `${cToF(calculatedData.wbt).toFixed(1)} °F` : `${calculatedData.wbt.toFixed(1)} °C`}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Dew Point Temp</span>
                        <strong className="font-bold text-foreground font-mono">
                          {ip ? `${cToF(calculatedData.dp).toFixed(1)} °F` : `${calculatedData.dp.toFixed(1)} °C`}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Relative Humidity</span>
                        <strong className="font-bold text-foreground font-mono">
                          {calculatedData.rh.toFixed(1)} %
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Humidity Ratio (W)</span>
                        <strong className="font-bold text-foreground font-mono">
                          {ip ? `${(calculatedData.w * 7000).toFixed(2)} gr/lb` : `${(calculatedData.w * 1000).toFixed(2)} g/kg`}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Specific Enthalpy (h)</span>
                        <strong className="font-bold text-[#f78f22] font-mono">
                          {ip ? `${(calculatedData.h / 2.326).toFixed(2)} BTU/lb` : `${calculatedData.h.toFixed(2)} kJ/kg`}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5">
                        <span className="font-semibold text-muted-foreground">Specific Volume (v)</span>
                        <strong className="font-bold text-foreground font-mono">
                          {ip ? `${(calculatedData.v * 0.062428).toFixed(4)} ft³/lb` : `${calculatedData.v.toFixed(4)} m³/kg`}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5">
                        <span className="font-semibold text-muted-foreground">Vapor Pressure</span>
                        <strong className="font-bold text-foreground font-mono">
                          {ip ? `${(calculatedData.pw / 6894.76).toFixed(4)} psi` : `${(calculatedData.pw / 1000).toFixed(3)} kPa`}
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
