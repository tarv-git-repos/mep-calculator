import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/diffuser-selector")({
  head: () => ({
    meta: [
      { title: "Diffuser Selector — MEP Calc" },
      { name: "description", content: "HVAC Diffuser Selector matching neck sizes and throw ranges." },
    ],
  }),
  component: DiffuserSelectorPage,
});

type DiffuserType = "square" | "round" | "slot16" | "slot20" | "slot25";

interface DiffuserSize {
  size: string;
  maxFlow_20?: number;
  maxFlow_25?: number;
  maxFlow?: number;
  throw: number;
  nc: number;
}

const DIFFUSER_DATA: Record<DiffuserType, DiffuserSize[]> = {
  square: [
    { size: "150x150", maxFlow_20: 95, maxFlow_25: 116, throw: 8, nc: 20 },
    { size: "225x225", maxFlow_20: 212, maxFlow_25: 275, throw: 12, nc: 25 },
    { size: "300x300", maxFlow_20: 392, maxFlow_25: 487, throw: 16, nc: 30 },
    { size: "375x375", maxFlow_20: 614, maxFlow_25: 667, throw: 20, nc: 35 },
    { size: "450x450", maxFlow_20: 826, maxFlow_25: 826, throw: 24, nc: 40 },
    { size: "525x525", maxFlow_20: 1038, maxFlow_25: 1038, throw: 28, nc: 45 },
    { size: "600x600", maxFlow_20: 1239, maxFlow_25: 1239, throw: 32, nc: 50 }
  ],
  round: [
    { size: "Ø250", maxFlow_20: 38, maxFlow_25: 47, throw: 8, nc: 20 },
    { size: "Ø307", maxFlow_20: 66, maxFlow_25: 83, throw: 10, nc: 22 },
    { size: "Ø363", maxFlow_20: 104, maxFlow_25: 130, throw: 12, nc: 24 },
    { size: "Ø419", maxFlow_20: 149, maxFlow_25: 186, throw: 14, nc: 26 },
    { size: "Ø478", maxFlow_20: 203, maxFlow_25: 252, throw: 16, nc: 28 },
    { size: "Ø534", maxFlow_20: 264, maxFlow_25: 330, throw: 18, nc: 30 },
    { size: "Ø598", maxFlow_20: 335, maxFlow_25: 418, throw: 20, nc: 32 },
    { size: "Ø653", maxFlow_20: 401, maxFlow_25: 519, throw: 22, nc: 34 },
    { size: "Ø704", maxFlow_20: 479, maxFlow_25: 625, throw: 24, nc: 36 },
    { size: "Ø756", maxFlow_20: 590, maxFlow_25: 741, throw: 26, nc: 38 }
  ],
  slot16: [
    { size: "1 Slot", maxFlow: 45, throw: 6, nc: 20 },
    { size: "2 Slot", maxFlow: 65, throw: 8, nc: 22 },
    { size: "3 Slot", maxFlow: 100, throw: 10, nc: 24 },
    { size: "4 Slot", maxFlow: 125, throw: 12, nc: 26 }
  ],
  slot20: [
    { size: "1 Slot", maxFlow: 50, throw: 6, nc: 20 },
    { size: "2 Slot", maxFlow: 75, throw: 8, nc: 22 },
    { size: "3 Slot", maxFlow: 110, throw: 10, nc: 24 },
    { size: "4 Slot", maxFlow: 130, throw: 12, nc: 26 }
  ],
  slot25: [
    { size: "1 Slot", maxFlow: 55, throw: 6, nc: 20 },
    { size: "2 Slot", maxFlow: 85, throw: 8, nc: 22 },
    { size: "3 Slot", maxFlow: 125, throw: 10, nc: 24 },
    { size: "4 Slot", maxFlow: 150, throw: 12, nc: 26 }
  ]
};

function DiffuserSelectorPage() {
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");
  const [roomAirflow, setRoomAirflow] = useState<number>(400);
  const [diffuserCount, setDiffuserCount] = useState<number>(2);
  const [designVelocity, setDesignVelocity] = useState<number>(2.0); // m/s
  const [diffuserType, setDiffuserType] = useState<DiffuserType>("square");
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);

  const ip = unitSystem === "ip";

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;
    setUnitSystem(unit);
    if ((window as any).__mep_keep_values) return;
    if (unit === "ip") {
      setRoomAirflow(Number((roomAirflow * 2.1189).toFixed(0)));
    } else {
      setRoomAirflow(Number((roomAirflow / 2.1189).toFixed(0)));
    }
  };

  const calculatedData = useMemo(() => {
    const flowPerDiff = roomAirflow / diffuserCount;
    const flowKey = designVelocity === 2.5 ? "maxFlow_25" : "maxFlow_20";
    const options = DIFFUSER_DATA[diffuserType];

    let selected: DiffuserSize | null = null;

    for (let i = 0; i < options.length; i++) {
      let maxFlow = 0;
      if (diffuserType === "square" || diffuserType === "round") {
        maxFlow = options[i][flowKey] || 0;
      } else {
        maxFlow = options[i].maxFlow || 0;
      }

      if (flowPerDiff <= maxFlow) {
        selected = options[i];
        break;
      }
    }

    if (!selected) {
      if (diffuserType === "slot16" || diffuserType === "slot20" || diffuserType === "slot25") {
        return {
          flowPerDiff,
          neckSize: "-",
          velocityFpm: designVelocity * 196.85,
          throwVal: "-",
          nc: "-",
          adpi: "Flow exceeds slot capacity"
        };
      }
      selected = options[options.length - 1];
    }

    const velocityFpm = designVelocity * 196.85;
    let adpi = "Good Selection";
    if (velocityFpm > 600) adpi = "High velocity - draft risk";
    else if (velocityFpm < 300) adpi = "Low velocity - poor air spread";

    const throwDisplay = ip ? `${selected.throw.toFixed(1)} ft` : `${(selected.throw * 0.3048).toFixed(1)} m`;

    return {
      flowPerDiff,
      neckSize: selected.size,
      velocityFpm,
      throwVal: throwDisplay,
      nc: `NC-${selected.nc}`,
      adpi
    };
  }, [roomAirflow, diffuserCount, designVelocity, diffuserType, ip]);

  const handleCalculate = () => {
    setHasCalculated(true);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ["Diffuser Quick Selection Report"],
      [],
      ["Diffuser Type", diffuserType],
      ["Diffusers Qty", diffuserCount],
      ["Flow per Diffuser", ip ? `${calculatedData.flowPerDiff.toFixed(0)} CFM` : `${calculatedData.flowPerDiff.toFixed(0)} L/s`],
      ["Recommended Size", calculatedData.neckSize],
      ["Face Velocity", `${calculatedData.velocityFpm.toFixed(0)} FPM (${designVelocity.toFixed(2)} m/s)`],
      ["Estimated Throw (T50)", calculatedData.throwVal],
      ["Estimated Noise level", calculatedData.nc],
      ["ADPI Rating", calculatedData.adpi],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Diffuser Selector");
    XLSX.writeFile(wb, "Diffuser_Selection.xlsx");
  };

  return (
    <AppShell title="Diffuser Selector" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6">
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; DIFFUSER SELECTOR</span>
            <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Diffuser Quick Selector</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Select diffuser types and estimate neck sizes, throws, and noise ratings for room airflow distributions.
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
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inputs</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {/* Airflow */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Room Airflow ({ip ? "CFM" : "L/s"})</label>
                    <input type="number" step="any" value={roomAirflow} onChange={(e) => { setRoomAirflow(Number(e.target.value)); setHasCalculated(false); }} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>

                  {/* Count */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Number of Diffusers</label>
                    <input type="number" min="1" step="1" value={diffuserCount} onChange={(e) => { setDiffuserCount(Number(e.target.value)); setHasCalculated(false); }} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>

                  {/* Velocity */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Design Velocity</label>
                    <select value={designVelocity} onChange={(e) => { setDesignVelocity(Number(e.target.value)); setHasCalculated(false); }} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]">
                      <option value="2.0">2.0 m/s (350 FPM)</option>
                      <option value="2.5">2.5 m/s (500 FPM)</option>
                    </select>
                  </div>

                  {/* Diffuser Type */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Diffuser Type</label>
                    <select value={diffuserType} onChange={(e) => { setDiffuserType(e.target.value as any); setHasCalculated(false); }} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]">
                      <option value="square">Square</option>
                      <option value="round">Round</option>
                      <option value="slot16">Linear Slot 16mm</option>
                      <option value="slot20">Linear Slot 20mm</option>
                      <option value="slot25">Linear Slot 25mm</option>
                    </select>
                  </div>
                </div>
              </div>

              <button type="button" onClick={handleCalculate} className="w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs">
                ⚡ Select Diffuser
              </button>
            </div>

            {/* Right Results */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {!hasCalculated ? (
                <div className="bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs">
                  <div className="size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none">
                    📐
                  </div>
                  <h4 className="text-xs font-bold text-foreground mb-1 uppercase tracking-wider">Ready to Size</h4>
                  <p className="text-[11.5px] text-muted-foreground max-w-xs leading-normal">
                    Enter the airflow details and diffuser configuration to see selection sizing.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5 animate-fade-in">
                  <div className="flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none">
                    <TBtn onClick={handleExportExcel} className="h-8.5 text-xs"><FileSpreadsheet className="size-3.5" /> Export Excel</TBtn>
                  </div>

                  <div className="bg-sky-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl p-3.5 flex gap-2.5 text-[11.5px] select-none">
                    <Info className="size-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>Selection is based on typical lookup data. Always verify specific layouts with manufacturer selection software.</span>
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                      <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Solved Parameters</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Flow per Diffuser</span>
                        <strong className="font-bold text-foreground font-mono">
                          {ip ? `${calculatedData.flowPerDiff.toFixed(0)} CFM` : `${calculatedData.flowPerDiff.toFixed(0)} L/s`}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Neck Size Sized</span>
                        <strong className="font-bold text-[#0A7BC7] text-[13px] font-mono">
                          {calculatedData.neckSize}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Face Velocity</span>
                        <strong className="font-bold text-foreground font-mono">
                          {calculatedData.velocityFpm.toFixed(0)} FPM ({designVelocity.toFixed(2)} m/s)
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Estimated Throw (T50)</span>
                        <strong className="font-bold text-foreground font-mono">
                          {calculatedData.throwVal}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="font-semibold text-muted-foreground">Noise Rating</span>
                        <strong className="font-bold text-foreground font-mono">
                          {calculatedData.nc}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 col-span-2">
                        <span className="font-semibold text-muted-foreground">ADPI Selection Suitability</span>
                        <strong className="font-bold text-[#0A7BC7] font-mono">
                          {calculatedData.adpi}
                        </strong>
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
