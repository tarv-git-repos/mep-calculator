import { createFileRoute } from "@tanstack/react-router";
import { cToF, fToC, lpsToCfm, cfmToLps, lpsToGpm } from "@/utils/conversions";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/condensate-drain-calc")({
  head: () => ({
    meta: [
      { title: "Coil Condensate Calculator \u2014 MEP Calc" },
      { name: "description", content: "AC cooling coil condensation schedule sizer and total moisture calculator." },
    ],
  }),
  component: CondensateDrainCalcPage,
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



interface CoilRow {
  id: string;
  name: string;
  dbIn: number;
  wbIn: number;
  dbOut: number;
  wbOut: number;
  flow: number;
}

function CondensateDrainCalcPage() {
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [rows, setRows] = useState<CoilRow[]>([
    { id: "coil-1", name: "AHU-01", dbIn: 24.0, wbIn: 18.0, dbOut: 13.0, wbOut: 12.0, flow: 1500 },
    { id: "coil-2", name: "FCU-01", dbIn: 24.0, wbIn: 17.0, dbOut: 14.0, wbOut: 13.0, flow: 400 }
  ]);

  const [newCoil, setNewCoil] = useState({
    name: "",
    dbIn: 24.0,
    wbIn: 17.0,
    dbOut: 14.0,
    wbOut: 13.0,
    flow: 500
  });

  const ip = unitSystem === "ip";

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;
    setUnitSystem(unit);
    if ((window as any).__mep_keep_values) return;
    const convT = (t: number) => unit === "ip" ? cToF(t) : fToC(t);
    const convF = (f: number) => unit === "ip" ? lpsToCfm(f) : cfmToLps(f);

    setRows(rows.map(r => ({
      ...r,
      dbIn: Number(convT(r.dbIn).toFixed(1)),
      wbIn: Number(convT(r.wbIn).toFixed(1)),
      dbOut: Number(convT(r.dbOut).toFixed(1)),
      wbOut: Number(convT(r.wbOut).toFixed(1)),
      flow: Number(convF(r.flow).toFixed(0))
    })));

    setNewCoil(prev => ({
      ...prev,
      dbIn: Number(convT(prev.dbIn).toFixed(1)),
      wbIn: Number(convT(prev.wbIn).toFixed(1)),
      dbOut: Number(convT(prev.dbOut).toFixed(1)),
      wbOut: Number(convT(prev.wbOut).toFixed(1)),
      flow: Number(convF(prev.flow).toFixed(0))
    }));
  };

  const calculatedRows = useMemo(() => {
    const pAtm = 101325;
    return rows.map(r => {
      const dbInC = ip ? fToC(r.dbIn) : r.dbIn;
      const wbInC = ip ? fToC(r.wbIn) : r.wbIn;
      const dbOutC = ip ? fToC(r.dbOut) : r.dbOut;
      const wbOutC = ip ? fToC(r.wbOut) : r.wbOut;

      let wIn = 0, wOut = 0;
      try { wIn = wFromWB(dbInC, wbInC, pAtm); } catch (e) {}
      try { wOut = wFromWB(dbOutC, wbOutC, pAtm); } catch (e) {}

      const dw = Math.max(0, wIn - wOut);
      // Flow conversion
      const flowLps = ip ? cfmToLps(r.flow) : r.flow;
      const massAirFlow = (flowLps / 1000) * 1.2;
      const condFlow = massAirFlow * dw; // L/s

      return {
        ...r,
        wIn,
        wOut,
        condFlow
      };
    });
  }, [rows, ip]);

  const totals = useMemo(() => {
    const totalFlow = rows.reduce((a, b) => a + b.flow, 0);
    const totalCond = calculatedRows.reduce((a, b) => a + b.condFlow, 0);
    return {
      totalFlow,
      totalCond
    };
  }, [calculatedRows, rows]);

  const handleAddCoil = () => {
    if (!newCoil.name) return;
    const id = "coil-" + Date.now();
    setRows([...rows, { ...newCoil, id }]);
    setNewCoil(prev => ({
      ...prev,
      name: "",
      flow: prev.flow
    }));
  };

  const handleDeleteCoil = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const uTemp = ip ? "\u00b0F" : "\u00b0C";
    const uFlow = ip ? "CFM" : "L/s";
    
    const headers = [
      "Unit Ref",
      `On-Coil DB (${uTemp})`,
      `On-Coil WB (${uTemp})`,
      `Off-Coil DB (${uTemp})`,
      `Off-Coil WB (${uTemp})`,
      `Air Flow Rate (${uFlow})`,
      "On-Coil Humidity Ratio (kg/kg)",
      "Off-Coil Humidity Ratio (kg/kg)",
      ip ? "Condensate Flow (GPM)" : "Condensate Flow (L/s)"
    ];

    const exportData = calculatedRows.map(r => [
      r.name,
      r.dbIn,
      r.wbIn,
      r.dbOut,
      r.wbOut,
      r.flow,
      r.wIn.toFixed(6),
      r.wOut.toFixed(6),
      ip ? lpsToGpm(r.condFlow).toFixed(6) : r.condFlow.toFixed(6)
    ]);
    const ws = XLSX.utils.aoa_to_sheet([["Moisture Extraction Coil Schedule"], [], headers, ...exportData]);
    XLSX.utils.book_append_sheet(wb, ws, "Coils Schedule");
    XLSX.writeFile(wb, "Condensate_Drain_Calculation.xlsx");
  };

  const uTemp = ip ? "\u00b0F" : "\u00b0C";
  const uFlow = ip ? "CFM" : "L/s";

  return (
    <AppShell title="Condensate Drain Calc" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6">
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; CONDENSATE CALCULATION</span>
            <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Coil Condensate Calculator</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Input entering and leaving air conditions for multiple cooling coils to formulate aggregate condensate drainage loads.
            </p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-border/60 self-start select-none">
            <button type="button" onClick={() => handleUnitSystemChange("ip")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Imperial (IP)</button>
            <button type="button" onClick={() => handleUnitSystemChange("si")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Metric (SI)</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left - Schedule Table & Input Card */}
            <div className="lg:col-span-8 flex flex-col gap-5">
              <div className="bg-card border border-border rounded-2xl shadow-xs p-5 flex flex-col gap-5">
                <div className="flex justify-between items-center pb-2 border-b border-border/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Moisture Extraction Schedule</h3>
                  <TBtn onClick={handleExportExcel} className="h-8 text-xs"><FileSpreadsheet className="size-3.5" /> Export Excel</TBtn>
                </div>

                {/* Add Coil Form - Placed ABOVE the table as in the EXE */}
                <div className="bg-slate-50 dark:bg-slate-950/20 p-4 border border-border/80 rounded-xl flex gap-3 flex-wrap items-end text-xs">
                  <div className="flex-1 min-w-[150px] flex flex-col gap-1">
                    <label className="font-semibold text-muted-foreground font-sans">Unit Ref</label>
                    <input type="text" placeholder="e.g. AHU-2" value={newCoil.name} onChange={e => setNewCoil({ ...newCoil, name: e.target.value })} className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  <div className="w-20 flex flex-col gap-1">
                    <label className="font-semibold text-muted-foreground font-sans">On DB ({uTemp})</label>
                    <input type="number" value={newCoil.dbIn} onChange={e => setNewCoil({ ...newCoil, dbIn: Number(e.target.value) })} className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  <div className="w-20 flex flex-col gap-1">
                    <label className="font-semibold text-muted-foreground font-sans">On WB ({uTemp})</label>
                    <input type="number" value={newCoil.wbIn} onChange={e => setNewCoil({ ...newCoil, wbIn: Number(e.target.value) })} className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  <div className="w-20 flex flex-col gap-1">
                    <label className="font-semibold text-muted-foreground font-sans">Off DB ({uTemp})</label>
                    <input type="number" value={newCoil.dbOut} onChange={e => setNewCoil({ ...newCoil, dbOut: Number(e.target.value) })} className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  <div className="w-20 flex flex-col gap-1">
                    <label className="font-semibold text-muted-foreground font-sans">Off WB ({uTemp})</label>
                    <input type="number" value={newCoil.wbOut} onChange={e => setNewCoil({ ...newCoil, wbOut: Number(e.target.value) })} className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  <div className="w-24 flex flex-col gap-1">
                    <label className="font-semibold text-muted-foreground font-sans">Airflow</label>
                    <input type="number" value={newCoil.flow} onChange={e => setNewCoil({ ...newCoil, flow: Number(e.target.value) })} className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#f78f22]" />
                  </div>
                  <button onClick={handleAddCoil} className="bg-[#f78f22] text-white px-4 py-2 font-bold rounded-lg hover:bg-[#cf6610] cursor-pointer flex items-center gap-1"><Plus className="size-3.5" /> Add</button>
                </div>

                {/* Coils Table - Placed BELOW the add form as in the EXE */}
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/70 text-muted-foreground font-semibold">
                        <th className="py-2.5">Unit Ref</th>
                        <th className="py-2.5">Entering DB/WB</th>
                        <th className="py-2.5">Leaving DB/WB</th>
                        <th className="py-2.5">Air Flow</th>
                        <th className="py-2.5">W_in (kg/kg)</th>
                        <th className="py-2.5">W_out (kg/kg)</th>
                        <th className="py-2.5 text-primary">Condensate ({ip ? "GPM" : "L/s"})</th>
                        <th className="py-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {calculatedRows.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="py-2.5 font-sans font-semibold text-[13px]">{r.name}</td>
                          <td className="py-2.5 text-[13px]">{r.dbIn}/{r.wbIn} {uTemp}</td>
                          <td className="py-2.5 text-[13px]">{r.dbOut}/{r.wbOut} {uTemp}</td>
                          <td className="py-2.5 text-[13px]">{r.flow.toLocaleString()} {uFlow}</td>
                          <td className="py-2.5 text-[13px]">{r.wIn.toFixed(6)}</td>
                          <td className="py-2.5 text-[13px]">{r.wOut.toFixed(6)}</td>
                          <td className="py-2.5 text-[13px] font-bold text-primary">{ip ? lpsToGpm(r.condFlow).toFixed(5) : r.condFlow.toFixed(5)} {ip ? "GPM" : "L/s"}</td>
                          <td className="py-2.5 text-center">
                            <button onClick={() => handleDeleteCoil(r.id)} className="text-red-500 hover:text-red-700 transition cursor-pointer">
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Summary */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#f78f22] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Totals Summary</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs font-sans">
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Total Sized Airflow</span>
                    <strong className="font-bold text-foreground font-mono">{totals.totalFlow.toLocaleString()} {uFlow}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="font-semibold text-muted-foreground text-primary">Total Condensate Flow</span>
                    <strong className="font-bold text-primary text-[15px] font-mono">{ip ? lpsToGpm(totals.totalCond).toFixed(4) : totals.totalCond.toFixed(4)} {ip ? "GPM" : "L/s"}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

