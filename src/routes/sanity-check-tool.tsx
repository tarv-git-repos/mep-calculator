import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { AlertTriangle, Info, CheckCircle2, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/sanity-check-tool")({
  head: () => ({
    meta: [
      { title: "Sanity Check Tool — MEP Calc" },
      { name: "description", content: "Interactive engineering sanity checker for duct, pipe, and energy values." },
    ],
  }),
  component: SanityCheckToolPage,
});

interface CheckResult {
  label: string;
  value: string;
  status: "pass" | "warn";
  range: string;
  desc: string;
}

function SanityCheckToolPage() {
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");
  const [ductVel, setDuctVel] = useState<number>(1500);
  const [ductFr, setDuctFr] = useState<number>(0.08);
  const [esp, setEsp] = useState<number>(0.5);
  const [pipeVel, setPipeVel] = useState<number>(4.0);
  const [pumpHead, setPumpHead] = useState<number>(50);
  const [cfmTr, setCfmTr] = useState<number>(400);
  const [supTemp, setSupTemp] = useState<number>(55);
  const [chwDt, setChwDt] = useState<number>(10);
  const [chillerEff, setChillerEff] = useState<number>(0.65);
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);

  const ip = unitSystem === "ip";

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;
    setUnitSystem(unit);
    if ((window as any).__mep_keep_values) return;
    // Convert inputs
    if (unit === "ip") {
      setDuctVel(Number((ductVel * 196.85).toFixed(0)));
      setDuctFr(Number((ductFr / 8.16828).toFixed(3)));
      setEsp(Number((esp / 248.84).toFixed(2)));
      setPipeVel(Number((pipeVel * 3.28084).toFixed(1)));
      setPumpHead(Number((pumpHead * 0.33455).toFixed(1)));
      setCfmTr(Number((cfmTr * 8.48).toFixed(0)));
      setSupTemp(Number((supTemp * 1.8 + 32).toFixed(1)));
      setChwDt(Number((chwDt * 1.8).toFixed(1)));
      setChillerEff(Number((3.51685 / chillerEff).toFixed(2)));
    } else {
      setDuctVel(Number((ductVel / 196.85).toFixed(2)));
      setDuctFr(Number((ductFr * 8.16828).toFixed(2)));
      setEsp(Number((esp * 248.84).toFixed(0)));
      setPipeVel(Number((pipeVel / 3.28084).toFixed(2)));
      setPumpHead(Number((pumpHead / 0.33455).toFixed(0)));
      setCfmTr(Number((cfmTr / 8.48).toFixed(1)));
      setSupTemp(Number(((supTemp - 32) / 1.8).toFixed(1)));
      setChwDt(Number((chwDt / 1.8).toFixed(1)));
      setChillerEff(Number((3.51685 / chillerEff).toFixed(2)));
    }
  };

  const checks = useMemo((): CheckResult[] => {
    const list: CheckResult[] = [];

    const test = (
      label: string,
      val: number,
      unit: string,
      lo: number,
      hi: number,
      desc: string
    ) => {
      const pass = val >= lo && val <= hi;
      list.push({
        label,
        value: `${val.toFixed(val < 10 ? 3 : 1)} ${unit}`,
        status: pass ? "pass" : "warn",
        range: `${lo} – ${hi} ${unit}`,
        desc
      });
    };

    if (ip) {
      test("Duct Velocity", ductVel, "FPM", 1000, 2500, "Main duct velocity range to balance noise and friction.");
      test("Airflow per TR", cfmTr, "CFM/TR", 350, 450, "Comfort cooling sensible heat ratio airflow index.");
      test("Duct Friction Rate", ductFr, "in w.g./100ft", 0.05, 0.15, "Standard friction design rate for equal friction method.");
      test("Duct External Static", esp, "in w.g.", 0.2, 2.0, "Typical external static pressure for fans.");
      test("Water Pipe Velocity", pipeVel, "fps", 2.0, 8.0, "Pipe fluid velocity limits to prevent erosion and sedimentation.");
      test("Pump Total Head", pumpHead, "ft w.g.", 20, 100, "Typical chilled water circuit head requirement.");
      test("Supply Air Temp", supTemp, "\u00b0F", 50, 60, "Cooling coil supply dew point range for space relative humidity control.");
      test("CHW Temp Delta T", chwDt, "\u00b0F", 8, 14, "Chilled water temperature rise across coil.");
      test("Chiller Efficiency", chillerEff, "kW/TR", 0.5, 0.8, "Centrifugal / water-cooled chiller full-load index.");
    } else {
      test("Duct Velocity", ductVel, "m/s", 5.0, 12.7, "Main duct velocity range to balance noise and friction.");
      test("Airflow per TR", cfmTr, "L/s/kW", 47, 60, "Comfort cooling sensible heat ratio airflow index.");
      test("Duct Friction Rate", ductFr, "Pa/m", 0.4, 1.2, "Standard friction design rate for equal friction method.");
      test("Duct External Static", esp, "Pa", 50, 500, "Typical external static pressure for fans.");
      test("Water Pipe Velocity", pipeVel, "m/s", 0.6, 2.4, "Pipe fluid velocity limits to prevent erosion and sedimentation.");
      test("Pump Total Head", pumpHead, "kPa", 60, 300, "Typical chilled water circuit head requirement.");
      test("Supply Air Temp", supTemp, "\u00b0C", 10, 15, "Cooling coil supply dew point range for space relative humidity control.");
      test("CHW Temp Delta T", chwDt, "\u00b0C", 4.4, 7.7, "Chilled water temperature rise across coil.");
      test("Chiller COP", chillerEff, "COP", 4.4, 7.0, "Centrifugal / water-cooled chiller full-load coefficient of performance.");
    }

    return list;
  }, [ductVel, ductFr, esp, pipeVel, pumpHead, cfmTr, supTemp, chwDt, chillerEff, ip]);

  const handleCalculate = () => {
    setHasCalculated(true);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headers = ["Design Parameter", "Input Value", "Design Status", "Standard Range", "Guideline Detail"];
    const exportData = checks.map(c => [
      c.label,
      c.value,
      c.status === "pass" ? "In Range" : "Check Value",
      c.range,
      c.desc
    ]);
    const ws = XLSX.utils.aoa_to_sheet([["HV\u00b0C Engineering Sanity Check Report"], [], headers, ...exportData]);
    XLSX.utils.book_append_sheet(wb, ws, "Sanity Check");
    XLSX.writeFile(wb, "Engineering_Sanity_Checks.xlsx");
  };

  return (
    <AppShell title="Sanity Check Tool" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6">
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HV\u00b0C &gt; SANITY CHECK</span>
            <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Engineering Sanity Check Tool</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Verify your design numbers against standard ASHRAE, SM\u00b0CNA, and Carrier parameters.
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
                  <div className="w-1 h-3.5 bg-[#f78f22] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Design Values</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {/* Duct velocity */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Duct Velocity ({ip ? "FPM" : "m/s"})</label>
                    <input type="number" step="any" value={ductVel} onChange={(e) => { setDuctVel(Number(e.target.value)); setHasCalculated(false); }} className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  {/* Duct friction */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Duct Friction ({ip ? "in w.g./100ft" : "Pa/m"})</label>
                    <input type="number" step="any" value={ductFr} onChange={(e) => { setDuctFr(Number(e.target.value)); setHasCalculated(false); }} className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  {/* ESP */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">External Static Pressure ({ip ? "in w.g." : "Pa"})</label>
                    <input type="number" step="any" value={esp} onChange={(e) => { setEsp(Number(e.target.value)); setHasCalculated(false); }} className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  {/* Pipe velocity */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Pipe Velocity ({ip ? "fps" : "m/s"})</label>
                    <input type="number" step="any" value={pipeVel} onChange={(e) => { setPipeVel(Number(e.target.value)); setHasCalculated(false); }} className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  {/* Pump head */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Pump Total Head ({ip ? "ft w.g." : "kPa"})</label>
                    <input type="number" step="any" value={pumpHead} onChange={(e) => { setPumpHead(Number(e.target.value)); setHasCalculated(false); }} className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  {/* Airflow/TR */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Airflow per Ton ({ip ? "CFM/TR" : "L/s/kW"})</label>
                    <input type="number" step="any" value={cfmTr} onChange={(e) => { setCfmTr(Number(e.target.value)); setHasCalculated(false); }} className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  {/* Supply air temp */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Supply Air Temp ({ip ? "°F" : "°C"})</label>
                    <input type="number" step="any" value={supTemp} onChange={(e) => { setSupTemp(Number(e.target.value)); setHasCalculated(false); }} className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  {/* CHW DT */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">CHW Delta T ({ip ? "°F" : "°C"})</label>
                    <input type="number" step="any" value={chwDt} onChange={(e) => { setChwDt(Number(e.target.value)); setHasCalculated(false); }} className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  {/* Chiller efficiency */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Chiller Efficiency ({ip ? "kW/TR" : "COP"})</label>
                    <input type="number" step="any" value={chillerEff} onChange={(e) => { setChillerEff(Number(e.target.value)); setHasCalculated(false); }} className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                </div>
              </div>

              <button type="button" onClick={handleCalculate} className="w-full bg-[#f78f22] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#cf6610] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs">
                ⚡ Run Sanity Check
              </button>
            </div>

            {/* Right Results */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {!hasCalculated ? (
                <div className="bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs">
                  <div className="size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none">
                    📐
                  </div>
                  <h4 className="text-xs font-bold text-foreground mb-1 uppercase tracking-wider">Ready to Check</h4>
                  <p className="text-[11.5px] text-muted-foreground max-w-xs leading-normal">
                    Enter your calculated project parameters and run sanity checks to verify they comply with engineering guidelines.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5 animate-fade-in">
                  <div className="flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none">
                    <TBtn onClick={handleExportExcel} className="h-8.5 text-xs"><FileSpreadsheet className="size-3.5" /> Export Excel</TBtn>
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                      <div className="w-1 h-3.5 bg-[#f78f22] rounded-full"></div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Engineering Audit Summary</h3>
                    </div>

                    <div className="flex flex-col gap-3 font-sans text-xs">
                      {checks.map((c, i) => (
                        <div key={i} className="flex flex-col gap-1 py-2.5 border-b border-border/40 last:border-0">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-foreground">{c.label}</span>
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-muted-foreground font-bold">{c.value}</span>
                              {c.status === "pass" ? (
                                <CheckCircle2 className="size-4 text-emerald-500" />
                              ) : (
                                <AlertTriangle className="size-4 text-amber-500 animate-pulse" />
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between text-[10.5px] text-muted-foreground mt-0.5">
                            <span>{c.desc}</span>
                            <span className="font-bold">Std: {c.range}</span>
                          </div>
                        </div>
                      ))}
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
