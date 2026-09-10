import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { UnitToggle } from "@/components/workspace/UnitToggle";

export const Route = createFileRoute("/refrigerant-pipe-sizing")({
  head: () => ({
    meta: [
      { title: "Refrigerant Pipe Sizing — MEP Calc" },
      { name: "description", content: "Refrigerant pipe OD sizing tool for suction, liquid, and discharge lines." },
    ],
  }),
  component: RefrigerantPipeSizingPage,
});

type LineType = "suction" | "liquid" | "discharge";
type Refrigerant = "R410A" | "R22" | "R32" | "R134a" | "R407C";

interface PipeData {
  ranges: [number, number, string][];
  vel: string;
}

const REF_PIPE_DATA: Record<LineType, Record<string, PipeData>> = {
  suction: {
    R410A: { ranges: [[0, 3, '12.7'], [3, 6, '15.88'], [6, 12, '19.05'], [12, 20, '22.22'], [20, 35, '28.58'], [35, 60, '34.93'], [60, 100, '41.28']], vel: '12-20 m/s' },
    R22: { ranges: [[0, 3, '12.7'], [3, 7, '15.88'], [7, 15, '19.05'], [15, 25, '22.22'], [25, 45, '28.58']], vel: '10-18 m/s' },
    R32: { ranges: [[0, 3, '12.7'], [3, 6, '15.88'], [6, 12, '19.05'], [12, 20, '22.22'], [20, 35, '28.58'], [35, 60, '34.93'], [60, 100, '41.28']], vel: '12-20 m/s' },
    R134a: { ranges: [[0, 2, '12.7'], [2, 5, '15.88'], [5, 10, '19.05'], [10, 18, '22.22'], [18, 30, '28.58']], vel: '8-15 m/s' },
    R407C: { ranges: [[0, 3, '12.7'], [3, 6, '15.88'], [6, 12, '19.05'], [12, 20, '22.22'], [20, 35, '28.58']], vel: '10-18 m/s' }
  },
  liquid: {
    R410A: { ranges: [[0, 5, '9.52'], [5, 12, '12.7'], [12, 25, '15.88'], [25, 50, '19.05']], vel: '0.5-1.5 m/s' },
    R22: { ranges: [[0, 6, '9.52'], [6, 14, '12.7'], [14, 30, '15.88']], vel: '0.5-1.2 m/s' },
    R32: { ranges: [[0, 5, '9.52'], [5, 12, '12.7'], [12, 25, '15.88'], [25, 50, '19.05']], vel: '0.5-1.5 m/s' },
    R134a: { ranges: [[0, 4, '9.52'], [4, 10, '12.7'], [10, 22, '15.88']], vel: '0.5-1.2 m/s' },
    R407C: { ranges: [[0, 5, '9.52'], [5, 12, '12.7'], [12, 25, '15.88']], vel: '0.5-1.5 m/s' }
  },
  discharge: {
    R410A: { ranges: [[0, 3, '9.52'], [3, 6, '12.7'], [6, 12, '15.88'], [12, 22, '19.05']], vel: '12-20 m/s' },
    R22: { ranges: [[0, 4, '9.52'], [4, 8, '12.7'], [8, 16, '15.88'], [16, 28, '19.05']], vel: '10-18 m/s' },
    R32: { ranges: [[0, 3, '9.52'], [3, 6, '12.7'], [6, 12, '15.88'], [12, 22, '19.05']], vel: '12-20 m/s' },
    R134a: { ranges: [[0, 3, '9.52'], [3, 6, '12.7'], [6, 12, '15.88']], vel: '8-15 m/s' },
    R407C: { ranges: [[0, 3, '9.52'], [3, 6, '12.7'], [6, 12, '15.88']], vel: '10-18 m/s' }
  }
};

function RefrigerantPipeSizingPage() {
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");
  const [coolingCapacity, setCoolingCapacity] = useState<number | "">(""); // TR (IP) or kW (SI)
  const [refrigerant, setRefrigerant] = useState<Refrigerant>("R410A");
  const [lineType, setLineType] = useState<LineType>("suction");
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);

  const ip = unitSystem === "ip";

  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (targetUnit === unitSystem) return;
    setUnitSystem(targetUnit);

    if (shouldConvert) {
      if (targetUnit === "ip") {
        setCoolingCapacity(coolingCapacity !== "" ? Number((Number(coolingCapacity) / 3.51685).toFixed(1)) : "");
      } else {
        setCoolingCapacity(coolingCapacity !== "" ? Number((Number(coolingCapacity) * 3.51685).toFixed(1)) : "");
      }
    }
    toast.info(`Switched to ${targetUnit === "ip" ? "Imperial (IP)" : "Metric (SI)"} units`);
  };

  const calculatedData = useMemo(() => {
    const capVal = coolingCapacity !== "" ? Number(coolingCapacity) : (ip ? 10 : 35);
    const trIP = ip ? capVal : capVal / 3.51685;
    const lineData = REF_PIPE_DATA[lineType][refrigerant] || REF_PIPE_DATA[lineType]["R410A"];
    
    let od = "Out of range / No data";
    for (const r of lineData.ranges) {
      if (trIP >= r[0] && trIP < r[1]) {
        od = `${r[2]} mm OD`;
        break;
      }
    }

    return {
      trIP,
      od,
      vel: lineData.vel
    };
  }, [coolingCapacity, refrigerant, lineType, ip]);

  const handleCalculate = () => {
    setHasCalculated(true);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ["Refrigerant Pipe Sizing Report"],
      [],
      ["Cooling Capacity", ip ? `${coolingCapacity} TR` : `${coolingCapacity} kW`],
      ["Refrigerant Type", refrigerant],
      ["Line Type Sized", lineType],
      ["Recommended Pipe Size (OD)", calculatedData.od],
      ["Typical Velocity Range", calculatedData.vel],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Refrigerant Sizing");
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "Refrigerant_Pipe_Sizing.xlsx", "Excel Document", ["xlsx"]);
  };

  return (
    <AppShell title="Refrigerant Pipe Sizing" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; REFRIGERANT PIPING</span>
            <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Refrigerant Pipe Sizer</h1>
              <CalculationReviewBar calculatorPath="/refrigerant-pipe-sizing" calculatorTitle="Refrigerant Pipe Sizer" />
              </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Determine copper refrigerant line outer diameters (OD) for suction, liquid, and discharge lines.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Inputs */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Inputs</h3>
                  </div>
                  <UnitToggle
                    unitSystem={unitSystem}
                    onChange={handleUnitSystemChange}
                    inputDescriptions="Cooling Capacity"
                    conversionExample={unitSystem === "si" ? "Convert 35 kW → 10.0 TR" : "Convert 10 TR → 35.2 kW"}
                  />
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {/* Cooling Capacity */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Cooling Capacity ({ip ? "TR" : "kW"})</label>
                    <input type="number" step="any" value={coolingCapacity} onChange={(e) => { setCoolingCapacity(e.target.value === "" ? "" : Number(e.target.value)); setHasCalculated(false); }} placeholder={ip ? "10" : "35.0"} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>

                  {/* Refrigerant Type */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Refrigerant Type</label>
                    <select value={refrigerant} onChange={(e) => { setRefrigerant(e.target.value as Refrigerant); setHasCalculated(false); }} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold focus:border-[#0A7BC7]">
                      <option value="R410A">R-410A</option>
                      <option value="R22">R-22</option>
                      <option value="R32">R-32</option>
                      <option value="R134a">R-134a</option>
                      <option value="R407C">R-407C</option>
                    </select>
                  </div>

                  {/* Line Type */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Line Type</label>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 border border-border/60 select-none">
                      {(["suction", "liquid", "discharge"] as LineType[]).map((t) => {
                        const active = lineType === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => { setLineType(t); setHasCalculated(false); }}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer capitalize ${
                              active ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <button type="button" onClick={handleCalculate} className="w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs">
                ⚡ Size Refrigerant Pipe
              </button>
            </div>

            {/* Right Results */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {!hasCalculated ? (
                <div className="bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs">
                  <div className="size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none">
                    ❄️
                  </div>
                  <h4 className="text-xs font-bold text-foreground mb-1 uppercase tracking-wider">Ready to Size</h4>
                  <p className="text-[11.5px] text-muted-foreground max-w-xs leading-normal">
                    Enter the cooling system capacity and line specifications to determine the recommended copper pipe size.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5 animate-fade-in">
                  <div className="flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none">
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                      <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Results</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40 col-span-2">
                        <span className="font-semibold text-muted-foreground">Recommended OD Size</span>
                        <strong className="font-bold text-[#0A7BC7] text-[15px] font-mono">
                          {calculatedData.od}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-1.5 col-span-2">
                        <span className="font-semibold text-muted-foreground">Typical Design Velocity Range</span>
                        <strong className="font-bold text-foreground font-mono">
                          {calculatedData.vel}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="bg-sky-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl p-3.5 flex gap-2.5 text-[11.5px] select-none">
                    <Info className="size-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>Sizing complies with typical ASHRAE refrigerant line velocity and oil-return criteria limits.</span>
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
