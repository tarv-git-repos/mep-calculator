import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/heating-load")({
  head: () => ({
    meta: [
      { title: "Heating Load \u2014 MEP Calc" },
      { name: "description", content: "Winter envelope heat loss and heating load sizer." },
    ],
  }),
  component: HeatingLoadPage,
});

function HeatingLoadPage() {
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");
  const [area, setArea] = useState<number | "">(""); // ft² or m²
  const [height, setHeight] = useState<number | "">(""); // ft or m
  const [uWall, setUWall] = useState<number | "">(""); // U-value Wall
  const [uGlaz, setUGlaz] = useState<number | "">(""); // U-value Glazing
  const [glazArea, setGlazArea] = useState<number | "">(""); // ft² or m²
  const [oat, setOat] = useState<number | "">(""); // Outdoor design temp
  const [iat, setIat] = useState<number | "">(""); // Indoor setpoint
  const [ach, setAch] = useState<number | "">(""); // Air changes per hour
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);

  const ip = unitSystem === "ip";

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;
    setUnitSystem(unit);
    if ((window as any).__mep_keep_values) return;
    // Convert inputs
    const convArea = (a: number) => unit === "ip" ? a * 10.764 : a / 10.764;
    const convHt = (h: number) => unit === "ip" ? h * 3.28084 : h / 3.28084;
    const convT = (t: number) => unit === "ip" ? t * 1.8 + 32 : (t - 32) / 1.8;
    const convU = (u: number) => unit === "ip" ? u / 5.678 : u * 5.678; // W/m²K to BTU/hr·ft²·°F

    setArea(area !== "" ? Number(convArea(Number(area)).toFixed(0)) : "");
    setHeight(height !== "" ? Number(convHt(Number(height)).toFixed(1)) : "");
    setUWall(uWall !== "" ? Number(convU(Number(uWall)).toFixed(3)) : "");
    setUGlaz(uGlaz !== "" ? Number(convU(Number(uGlaz)).toFixed(3)) : "");
    setGlazArea(glazArea !== "" ? Number(convArea(Number(glazArea)).toFixed(0)) : "");
    setOat(oat !== "" ? Number(convT(Number(oat)).toFixed(1)) : "");
    setIat(iat !== "" ? Number(convT(Number(iat)).toFixed(1)) : "");
  };

  const calculatedData = useMemo(() => {
    const areaVal = area !== "" ? Number(area) : (ip ? 2000 : 185);
    const htVal = height !== "" ? Number(height) : (ip ? 10 : 3.0);
    const uWallVal = uWall !== "" ? Number(uWall) : (ip ? 0.05 : 0.28);
    const uGlazVal = uGlaz !== "" ? Number(uGlaz) : (ip ? 0.45 : 2.55);
    const glazAreaVal = glazArea !== "" ? Number(glazArea) : (ip ? 150 : 14);
    const oatVal = oat !== "" ? Number(oat) : (ip ? 32 : 0);
    const iatVal = iat !== "" ? Number(iat) : (ip ? 70 : 21);
    const achVal = ach !== "" ? Number(ach) : 0.5;

    const areaFt2 = ip ? areaVal : areaVal * 10.764;
    const htFt = ip ? htVal : htVal * 3.281;
    const glazFt2 = ip ? glazAreaVal : glazAreaVal * 10.764;
    const oatF = ip ? oatVal : oatVal * 1.8 + 32;
    const iatF = ip ? iatVal : iatVal * 1.8 + 32;
    const dT = iatF - oatF;

    const sqrtA = Math.sqrt(areaFt2);
    const wallArea = sqrtA * 4 * htFt - glazFt2 + areaFt2;
    const qCond = uWallVal * wallArea * dT;
    const qGlaz = uGlazVal * glazFt2 * dT;
    const volFt3 = areaFt2 * htFt;
    const qInfil = 0.018 * achVal * volFt3 * dT;
    const qTotal = qCond + qGlaz + qInfil;

    const kwTotal = qTotal * 0.293071 / 1000;

    return {
      dT,
      qCond,
      qGlaz,
      qInfil,
      qTotal,
      kwTotal
    };
  }, [area, height, uWall, uGlaz, glazArea, oat, iat, ach, ip]);

  const warnings = useMemo(() => {
    const warns: string[] = [];
    if (calculatedData.dT < 0) {
      warns.push("Outdoor temp is higher than indoor setpoint - use Cooling Load calculator instead.");
    }
    if (calculatedData.dT > 80) {
      warns.push(`Temperature difference ${calculatedData.dT.toFixed(0)}°F is very large. Verify outdoor design temperature.`);
    }
    return warns;
  }, [calculatedData]);

  const handleCalculate = () => {
    setHasCalculated(true);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const uTemp = ip ? "°F" : "°C";
    const uLoad = ip ? "BTU/hr" : "kW";
    const uVal = ip ? "BTU/h·ft\u00b2·°F" : "W/m\u00b2K";

    const data = [
      ["Winter Heating Load Report"],
      [],
      ["Floor Area", `${area} ${ip ? "ft\u00b2" : "m\u00b2"}`],
      ["Ceiling Height", `${height} ${ip ? "ft" : "m"}`],
      ["Wall U-Value", `${uWall} ${uVal}`],
      ["Glazing U-Value", `${uGlaz} ${uVal}`],
      ["Glazing Area", `${glazArea} ${ip ? "ft\u00b2" : "m\u00b2"}`],
      ["Outdoor Design Temp", `${oat} ${uTemp}`],
      ["Indoor Setpoint", `${iat} ${uTemp}`],
      ["Infiltration Rate", `${ach} ACH`],
      [],
      ["Heat Loss Summary"],
      ["Conduction Wall/Roof Loss", ip ? `${calculatedData.qCond.toFixed(0)} BTU/h` : `${(calculatedData.qCond * 0.293 / 1000).toFixed(2)} kW`],
      ["Conduction Glazing Loss", ip ? `${calculatedData.qGlaz.toFixed(0)} BTU/h` : `${(calculatedData.qGlaz * 0.293 / 1000).toFixed(2)} kW`],
      ["Infiltration Ventilation Loss", ip ? `${calculatedData.qInfil.toFixed(0)} BTU/h` : `${(calculatedData.qInfil * 0.293 / 1000).toFixed(2)} kW`],
      ["Total Sized Heating Load", `${calculatedData.kwTotal.toFixed(1)} kW (${Math.round(calculatedData.qTotal).toLocaleString()} BTU/h)`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Heating Sizing");
    XLSX.writeFile(wb, "Heating_Load_Calculation.xlsx");
  };

  const renderChart = () => {
    const u = ip ? "k BTU/h" : "kW";
    const mult = ip ? 0.001 : 0.000293071;

    const bars = [
      { label: "Walls/Roof", value: calculatedData.qCond * mult, color: "#F59E0B", display: (calculatedData.qCond * mult).toFixed(1) + " " + u },
      { label: "Glazing", value: calculatedData.qGlaz * mult, color: "#0066CC", display: (calculatedData.qGlaz * mult).toFixed(1) + " " + u },
      { label: "Infiltration", value: calculatedData.qInfil * mult, color: "#7C3AED", display: (calculatedData.qInfil * mult).toFixed(1) + " " + u }
    ];

    const W = 500;
    const H = 140;
    const PL = 110;
    const PR = 20;
    const PT = 20;
    const PB = 20;
    const CW = W - PL - PR;
    const CH = H - PT - PB;

    const maxVal = Math.max(...bars.map(b => b.value)) * 1.2 || 1;

    return (
      <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/40 p-4 border border-border rounded-2xl select-none mt-4">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/50">Heating Load Losses Breakdown</h4>
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
    <AppShell title="Heating Load" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6">
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; HEATING LOAD</span>
            <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Winter Heating Load</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Calculate building envelope winter heat losses and estimate heating element/boiler capacities.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Inputs */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-border/60 self-start select-none">
                <button type="button" onClick={() => handleUnitSystemChange("ip")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Imperial (IP)</button>
                <button type="button" onClick={() => handleUnitSystemChange("si")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Metric (SI)</button>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Envelope parameters</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-foreground">Floor Area ({ip ? "ft²" : "m²"})</label>
                      <input type="number" step="any" value={area} onChange={(e) => { setArea(e.target.value === "" ? "" : Number(e.target.value)); setHasCalculated(false); }} placeholder={ip ? "2000" : "185"} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-foreground">Ceiling Height ({ip ? "ft" : "m"})</label>
                      <input type="number" step="any" value={height} onChange={(e) => { setHeight(e.target.value === "" ? "" : Number(e.target.value)); setHasCalculated(false); }} placeholder={ip ? "10" : "3.0"} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-foreground">Wall U-Value ({ip ? "BTU/h·ft²·°F" : "W/m²K"})</label>
                      <input type="number" step="any" value={uWall} onChange={(e) => { setUWall(e.target.value === "" ? "" : Number(e.target.value)); setHasCalculated(false); }} placeholder={ip ? "0.05" : "0.28"} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-foreground">Glazing U-Value ({ip ? "BTU/h·ft²·°F" : "W/m²K"})</label>
                      <input type="number" step="any" value={uGlaz} onChange={(e) => { setUGlaz(e.target.value === "" ? "" : Number(e.target.value)); setHasCalculated(false); }} placeholder={ip ? "0.45" : "2.55"} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-foreground">Glazing Area ({ip ? "ft²" : "m²"})</label>
                      <input type="number" step="any" value={glazArea} onChange={(e) => { setGlazArea(e.target.value === "" ? "" : Number(e.target.value)); setHasCalculated(false); }} placeholder={ip ? "150" : "14"} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-foreground">Infiltration Rate (ACH)</label>
                      <input type="number" step="any" value={ach} onChange={(e) => { setAch(e.target.value === "" ? "" : Number(e.target.value)); setHasCalculated(false); }} placeholder="0.5" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-foreground">Outdoor Temp ({ip ? "°F" : "°C"})</label>
                      <input type="number" step="any" value={oat} onChange={(e) => { setOat(e.target.value === "" ? "" : Number(e.target.value)); setHasCalculated(false); }} placeholder={ip ? "32" : "0"} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-foreground">Indoor Temp ({ip ? "°F" : "°C"})</label>
                      <input type="number" step="any" value={iat} onChange={(e) => { setIat(e.target.value === "" ? "" : Number(e.target.value)); setHasCalculated(false); }} placeholder={ip ? "70" : "21"} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal" />
                    </div>
                  </div>
                </div>
              </div>

              <button type="button" onClick={handleCalculate} className="w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs">
                ⚡ Calculate Heating Load
              </button>
            </div>

            {/* Right Results */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {!hasCalculated ? (
                <div className="bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs">
                  <div className="size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none">
                    🔥
                  </div>
                  <h4 className="text-xs font-bold text-foreground mb-1 uppercase tracking-wider">Ready to Solve</h4>
                  <p className="text-[11.5px] text-muted-foreground max-w-xs leading-normal">
                    Enter the space geometries, boundary U-values, and winter temperatures to compute heat losses.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5 animate-fade-in">
                  <div className="flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none">
                    <TBtn onClick={handleExportExcel} className="h-8.5 text-xs"><FileSpreadsheet className="size-3.5" /> Export Excel</TBtn>
                  </div>

                  {warnings.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 rounded-xl p-3.5 flex flex-col gap-2 text-[11.5px] select-none">
                      {warnings.map((w, idx) => (
                        <div key={idx} className="flex gap-2.5 items-start">
                          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-red-600" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                      <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Results</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40 col-span-2">
                        <span className="font-semibold text-muted-foreground text-primary">Required Boiler / Heater capacity</span>
                        <strong className="font-bold text-primary text-[15px] font-mono">{calculatedData.kwTotal.toFixed(1)} kW ({Math.round(calculatedData.qTotal).toLocaleString()} BTU/hr)</strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Walls/Roof Loss</span>
                        <strong className="font-bold text-foreground font-mono">
                          {ip ? `${calculatedData.qCond.toFixed(0)} BTU/hr` : `${(calculatedData.qCond * 0.293 / 1000).toFixed(2)} kW`}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Glazing Loss</span>
                        <strong className="font-bold text-foreground font-mono">
                          {ip ? `${calculatedData.qGlaz.toFixed(0)} BTU/hr` : `${(calculatedData.qGlaz * 0.293 / 1000).toFixed(2)} kW`}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40 col-span-2">
                        <span className="font-semibold text-muted-foreground">Infiltration Air Loss</span>
                        <strong className="font-bold text-foreground font-mono">
                          {ip ? `${calculatedData.qInfil.toFixed(0)} BTU/hr` : `${(calculatedData.qInfil * 0.293 / 1000).toFixed(2)} kW`}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 col-span-2">
                        <span className="font-semibold text-muted-foreground">Load Density Index</span>
                        <strong className="font-bold text-foreground font-mono">
                          {ip ? `${(calculatedData.qTotal / (Number(area) || 2000)).toFixed(1)} BTU/hr/ft²` : `${((calculatedData.kwTotal / (Number(area) || 185)) * 1000).toFixed(1)} W/m²`}
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
