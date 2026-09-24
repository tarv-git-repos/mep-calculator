import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { kwToTr, trToKw, kwToBtu, btuToKw, mToFt, ftToM } from "@/utils/conversions";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { FileSpreadsheet, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/condensate-drain")({
  head: () => ({
    meta: [
      { title: "Condensate Drain Sizing \u2014 MEP Calc" },
      { name: "description", content: "Condensate Drain pipe sizing, slope, and drop calculator." },
    ],
  }),
  component: CondensateDrainPage,
});

type CondMode = "tr" | "lat";

function CondensateDrainPage() {
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [condMode, setCondMode] = useState<CondMode>("tr");
  const [trLoad, setTrLoad] = useState<number>(35);
  const [latentLoad, setLatentLoad] = useState<number>(3.5);
  const [unitsQty, setUnitsQty] = useState<number>(1);
  const [drainLength, setDrainLength] = useState<number>(3);
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [showDetailedCalcs, setShowDetailedCalcs] = useState<boolean>(false);

  const ip = unitSystem === "ip";

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;
    setUnitSystem(unit);
    if ((window as any).__mep_keep_values) return;
    if (unit === "ip") {
      setTrLoad(Number(kwToTr(trLoad).toFixed(1)));
      setLatentLoad(Number(kwToBtu(latentLoad).toFixed(0)));
      setDrainLength(Number(mToFt(drainLength).toFixed(1)));
    } else {
      setTrLoad(Number(trToKw(trLoad).toFixed(1)));
      setLatentLoad(Number(btuToKw(latentLoad).toFixed(1)));
      setDrainLength(Number(ftToM(drainLength).toFixed(1)));
    }
  };

  const calculatedData = useMemo(() => {
    let trVal = condMode === "tr" ? (ip ? trLoad : kwToTr(trLoad)) : 0;
    let latBTU = 0;
    if (condMode === "tr") {
      latBTU = trVal * 12000 * 0.3;
    } else {
      latBTU = ip ? latentLoad : kwToBtu(latentLoad);
    }

    const galPerHrSingle = latBTU / (1075 * 8.34);
    const galPerHr = galPerHrSingle * unitsQty;
    const lPerMin = galPerHr * 0.063;

    let pipeSize = "";
    let minSlope = "";
    let totalDrop = "";

    if (galPerHr < 5) {
      pipeSize = '3/4" (19mm)';
      minSlope = ip ? '1/4" per ft (2.0%)' : "2.0% (1:50)";
      const d = 0.25 * drainLength;
      totalDrop = ip ? `${d.toFixed(2)} in` : `${(drainLength * 0.02 * 1000).toFixed(0)} mm`;
    } else if (galPerHr < 20) {
      pipeSize = '1" (25mm)';
      minSlope = ip ? '1/4" per ft (2.0%)' : "2.0% (1:50)";
      const d = 0.25 * drainLength;
      totalDrop = ip ? `${d.toFixed(2)} in` : `${(drainLength * 0.02 * 1000).toFixed(0)} mm`;
    } else {
      pipeSize = '1-1/4" (32mm)';
      minSlope = ip ? '1/8" per ft (1.0%)' : "1.0% (1:100)";
      const d = 0.125 * drainLength;
      totalDrop = ip ? `${d.toFixed(2)} in` : `${(drainLength * 0.01 * 1000).toFixed(0)} mm`;
    }

    return {
      trVal,
      latBTU,
      galPerHrSingle,
      galPerHr,
      lPerMin,
      flowRateDisplay: ip ? `${galPerHr.toFixed(2)} gal/hr` : `${lPerMin.toFixed(3)} L/min`,
      pipeSize,
      minSlope,
      totalDrop
    };
  }, [condMode, trLoad, latentLoad, unitsQty, drainLength, ip]);

  const handleCalculate = () => {
    setHasCalculated(true);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headers = ["Parameter", "Value"];
    const exportData = [
      ["Sizing Method", condMode === "tr" ? "From Cooling Capacity" : "From Latent Load"],
      [condMode === "tr" ? `Cooling Capacity (${ip ? "TR" : "kW"})` : `Latent Load (${ip ? "BTU/hr" : "kW"})`, condMode === "tr" ? trLoad : latentLoad],
      ["Number of AC/FCU Units", unitsQty],
      [`Drain Length (${ip ? "ft" : "m"})`, drainLength],
      [],
      ["Sizing Results"],
      ["Condensate Flow Rate", calculatedData.flowRateDisplay],
      ["Recommended Pipe Size", calculatedData.pipeSize],
      ["Minimum Slope", calculatedData.minSlope],
      ["Total Drop Over Run", calculatedData.totalDrop]
    ];
    const ws = XLSX.utils.aoa_to_sheet([["Condensate Drain Sizing"], [], headers, ...exportData]);
    XLSX.utils.book_append_sheet(wb, ws, "Drain Sizing");
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "Condensate_Drain_Sizing.xlsx", "Excel Document", ["xlsx"]);
  };

  return (
    <AppShell title="Condensate Drain Sizing" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          <div className="flex flex-col gap-1 select-none">
            <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Condensate Drain Pipe Sizer</h1>
              <CalculationReviewBar calculatorPath="/condensate-drain" calculatorTitle="Condensate Drain" />
              </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Calculate condensate load and recommended drain pipe sizes with minimum slopes.
            </p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-border/60 self-start select-none">
            <button type="button" onClick={() => handleUnitSystemChange("ip")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Imperial (IP)</button>
            <button type="button" onClick={() => handleUnitSystemChange("si")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Metric (SI)</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Inputs */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Inputs</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Sizing Method</label>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 border border-border/60 select-none">
                      <button type="button" onClick={() => { setCondMode("tr"); setHasCalculated(false); }} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${condMode === "tr" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>From Cooling capacity</button>
                      <button type="button" onClick={() => { setCondMode("lat"); setHasCalculated(false); }} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${condMode === "lat" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>From Latent load</button>
                    </div>
                  </div>

                  {condMode === "tr" ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground">Cooling Capacity ({ip ? "TR" : "kW"})</label>
                      <input type="number" step="any" value={trLoad} onChange={(e) => { setTrLoad(Number(e.target.value)); setHasCalculated(false); }} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]" />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground">Latent Load ({ip ? "BTU/hr" : "kW"})</label>
                      <input type="number" step="any" value={latentLoad} onChange={(e) => { setLatentLoad(Number(e.target.value)); setHasCalculated(false); }} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]" />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Number of AC/FCU Units</label>
                    <input type="number" min="1" step="1" value={unitsQty} onChange={(e) => { setUnitsQty(Number(e.target.value)); setHasCalculated(false); }} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Drain Length ({ip ? "ft" : "m"})</label>
                    <input type="number" step="any" value={drainLength} onChange={(e) => { setDrainLength(Number(e.target.value)); setHasCalculated(false); }} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>
                </div>
              </div>

              <button type="button" onClick={handleCalculate} className="w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs">
                ⚡ Size Condensate Drain
              </button>
            </div>

            {/* Right Results */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {!hasCalculated ? (
                <div className="bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs">
                  <div className="size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none">
                    {"\ud83d\udca7"}
                  </div>
                  <h4 className="text-xs font-bold text-foreground mb-1 uppercase tracking-wider">Ready to Size</h4>
                  <p className="text-[11.5px] text-muted-foreground max-w-xs leading-normal">
                    Enter the cooling parameters and drain run configuration to see pipe recommendations.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5 animate-fade-in">
                  <div className="flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none">
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                      <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Sizing Results</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Condensate Flow Rate</span>
                        <strong className="font-bold text-foreground font-mono">{calculatedData.flowRateDisplay}</strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Recommended Pipe Size</span>
                        <strong className="font-bold text-[#0A7BC7] text-[14px] font-mono">{calculatedData.pipeSize}</strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Minimum Slope</span>
                        <strong className="font-bold text-foreground font-mono">{calculatedData.minSlope}</strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Total Drop Over Run</span>
                        <strong className="font-bold text-foreground font-mono">{calculatedData.totalDrop}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detailed Calculations */}
                  <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
                    <button
                      onClick={() => setShowDetailedCalcs(!showDetailedCalcs)}
                      className="w-full flex items-center justify-between p-5 font-bold text-xs uppercase tracking-wider text-muted-foreground font-sans hover:bg-slate-50 dark:hover:bg-slate-900/40 select-none cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <HelpCircle className="size-4 text-primary" /> Detailed Sizing Steps
                      </span>
                      {showDetailedCalcs ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                    {showDetailedCalcs && (
                      <div className="p-5 pt-0 border-t border-border/40 text-xs font-sans flex flex-col gap-4 max-h-[400px] overflow-y-auto">
                        <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                          <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">1</div>
                          <div className="flex-1">
                            <div className="font-bold text-foreground">Step 1: Latent Sizing Cooling Load</div>
                            {condMode === "tr" ? (
                              <>
                                <div className="font-mono text-primary my-1">
                                  Q_latent = TR_load \u00d7 12,000 \u00d7 0.30 (Latent ratio)
                                </div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">
                                  Q_latent = {calculatedData.trVal.toFixed(2)} TR \u00d7 12,000 \u00d7 0.3 = {Math.round(calculatedData.latBTU).toLocaleString()} BTU/hr
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="font-mono text-primary my-1">
                                  Q_latent = Entered Latent Load (converted to BTU/hr if SI)
                                </div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">
                                  Q_latent = {Math.round(calculatedData.latBTU).toLocaleString()} BTU/hr
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                          <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">2</div>
                          <div className="flex-1">
                            <div className="font-bold text-foreground">Step 2: Condensate Flow per FCU/AC unit</div>
                            <div className="font-mono text-primary my-1">
                              q_single = Q_latent / (Latent Heat of Vaporization \u00d7 Water Density)
                            </div>
                            <div className="font-mono text-[10.5px] text-muted-foreground">
                              q_single = Q_latent / (1,075 BTU/lb \u00d7 8.34 lb/gal)
                            </div>
                            <div className="font-mono text-[10.5px] text-muted-foreground">
                              q_single = {Math.round(calculatedData.latBTU).toLocaleString()} / 8,965.5 = {calculatedData.galPerHrSingle.toFixed(2)} gal/hr
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                          <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">3</div>
                          <div className="flex-1">
                            <div className="font-bold text-foreground">Step 3: Total Condensate Flow Rate</div>
                            <div className="font-mono text-primary my-1">
                              q_total = q_single \u00d7 Qty_Units
                            </div>
                            <div className="font-mono text-[10.5px] text-muted-foreground">
                              q_total = {calculatedData.galPerHrSingle.toFixed(2)} GPH \u00d7 {unitsQty} = {calculatedData.galPerHr.toFixed(2)} gal/hr
                            </div>
                            {!ip && (
                              <div className="font-mono text-[10.5px] text-muted-foreground mt-1">
                                Convert to L/min: {calculatedData.galPerHr.toFixed(2)} \u00d7 0.063 = {calculatedData.lPerMin.toFixed(3)} L/min
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                          <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">4</div>
                          <div className="flex-1">
                            <div className="font-bold text-foreground">Step 4: Recommended Pipe Size Selection</div>
                            <div className="font-mono text-primary my-1">
                              Lookup criteria based on Flow rate (GPH):
                            </div>
                            <ul className="list-disc pl-4 font-mono text-[10px] text-muted-foreground space-y-0.5">
                              <li>Flow &lt; 5 GPH: Sized at 3/4" (19mm)</li>
                              <li>Flow 5 to 20 GPH: Sized at 1" (25mm)</li>
                              <li>Flow &gt; 20 GPH: Sized at 1-1/4" (32mm)</li>
                            </ul>
                            <div className="font-bold text-[11px] text-foreground mt-1">
                              Sized recommended size: {calculatedData.pipeSize}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3 items-start">
                          <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">5</div>
                          <div className="flex-1">
                            <div className="font-bold text-foreground">Step 5: Minimum Slope & Total Drop Drop</div>
                            <div className="font-mono text-primary my-1">
                              Drop = Run_Length \u00d7 Min_Slope
                            </div>
                            <div className="font-mono text-[10.5px] text-muted-foreground">
                              {ip ? (
                                <>Drop = {drainLength} ft \u00d7 Min_Slope = {calculatedData.totalDrop}</>
                              ) : (
                                <>Drop = {drainLength} m \u00d7 Min_Slope = {calculatedData.totalDrop}</>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
                    <p className="font-semibold text-foreground mb-1">Standard Sizing Basis:</p>
                    <ul className="list-disc pl-4 space-y-1.5">
                      <li>Calculated assuming 30% of total capacity is latent cooling load (standard ASHRAE default sizing assumption).</li>
                      <li>Fittings and layout losses are sized according to typical IBC Chapter 3 regulations.</li>
                    </ul>
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

