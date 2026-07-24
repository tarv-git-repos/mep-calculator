import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { Trash2, Plus, FileSpreadsheet, Info, Save } from "lucide-react";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";

export const Route = createFileRoute("/plumbing-loading-unit")({
  head: () => ({
    meta: [
      { title: "Loading Unit Calculator — MEP Calc" },
      { name: "description", content: "Traditional loading unit calculator for plumbing system pipe sizing." },
    ],
  }),
  component: LoadingUnitPage,
});

interface LUSpace {
  id: number;
  desc: string;
  floor: string;
  std: "low" | "med" | "high";
  fixtures: Record<string, number>;
}

const IP_FIXTURE_UNITS: Record<string, Record<string, number>> = {
  wc: { low: 1, med: 2, high: 5 },
  urinal: { low: 1, med: 1, high: 1 },
  basin: { low: 1, med: 2, high: 4 },
  bidet: { low: 1, med: 1, high: 1 },
  handspray: { low: 1, med: 1, high: 1 },
  bath: { low: 4, med: 8, high: 16 },
  shower: { low: 2, med: 3, high: 6 },
  sink: { low: 2, med: 5, high: 10 },
  bibtap: { low: 1, med: 1, high: 1 },
  washingmachine: { low: 2, med: 2, high: 2 },
  dishwasher: { low: 2, med: 2, high: 2 }
};

const LU_FIXTURES_META = [
  { id: 'wc', short: 'WC' },
  { id: 'urinal', short: 'Urinal' },
  { id: 'basin', short: 'Basin' },
  { id: 'bidet', short: 'Bidet' },
  { id: 'handspray', short: 'Spray' },
  { id: 'bath', short: 'Bath' },
  { id: 'shower', short: 'Shower' },
  { id: 'sink', short: 'Sink' },
  { id: 'bibtap', short: 'BibTap' },
  { id: 'washingmachine', short: 'Washer' },
  { id: 'dishwasher', short: 'Dishwasher' }
];

function huntersCurve(fu: number) {
  const t = [[1, 1], [2, 1.5], [3, 2], [5, 3], [6, 3.5], [10, 5.5], [12, 6], [20, 9], [30, 12], [50, 18], [75, 24], [100, 29], [150, 38], [200, 45], [300, 57], [400, 66], [500, 73], [600, 79], [750, 87], [1000, 98], [1500, 114], [2000, 127]];
  if (fu <= 0) return 0;
  for (let i = 0; i < t.length - 1; i++) {
    if (fu >= t[i][0] && fu < t[i+1][0]) {
      return t[i][1] + (t[i+1][1] - t[i][1]) * (fu - t[i][0]) / (t[i+1][0] - t[i][0]);
    }
  }
  return fu >= 2000 ? 127 + (fu - 2000) * 0.03 : 0;
}

function extractFloorFU(name: string) {
  const match = name.match(/^([0-9]|B|G|LG|UG|SF|RF|M|P)[FLfli]?/i);
  return match ? match[0].toUpperCase().replace(/L$/i, 'F') : 'G';
}

function LoadingUnitPage() {
  const { project } = useWorkspace();
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [iopSpaces, setIopSpaces] = useState<LUSpace[]>([]);

  // Form states
  const [newDesc, setNewDesc] = useState("");
  const [newFixtures, setNewFixtures] = useState<Record<string, number>>({});
  const [globalBuildingType, setGlobalBuildingType] = useState<"low" | "med" | "high">("med");

  // Load state from localStorage on project change
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`mep_loading_unit_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.iopSpaces) setIopSpaces(data.iopSpaces);
        if (data.globalBuildingType) setGlobalBuildingType(data.globalBuildingType);
      } else {
        // Reset to defaults
        setUnitSystem("si");
        setIopSpaces([
          {
            id: 1,
            desc: "Office Washroom A",
            floor: "G",
            std: "med",
            fixtures: { wc: 3, basin: 2, urinal: 2 }
          }
        ]);
        setGlobalBuildingType("med");
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load loading unit calculation", e);
    }
  }, [project.id]);

  const handleSaveCurrent = () => {
    try {
      const dataToSave = {
        unitSystem,
        iopSpaces,
        globalBuildingType
      };
      localStorage.setItem(`mep_loading_unit_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(false);
      toast.success("Loading Unit Calculation saved to project successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  const ip = unitSystem === "ip";

  // Calculations
  const calculations = useMemo(() => {
    let totalLU = 0;
    const spaceTotals: Record<number, number> = {};
    const breakdown: string[] = [];

    iopSpaces.forEach(s => {
      let spaceLU = 0;
      const spaceStd = s.std;

      LU_FIXTURES_META.forEach(f => {
        const qty = s.fixtures[f.id] || 0;
        if (qty > 0) {
          const unitLU = IP_FIXTURE_UNITS[f.id][spaceStd] || 0;
          spaceLU += qty * unitLU;
        }
      });

      spaceTotals[s.id] = spaceLU;
      totalLU += spaceLU;

      if (spaceLU > 0) {
        breakdown.push(`sm${s.desc} [${spaceStd.toUpperCase()}]: ${spaceLU.toFixed(1)} L.U`);
      }
    });

    const flowGPM = huntersCurve(totalLU);
    const flowLPS = flowGPM * 0.06309;

    return {
      totalLU,
      spaceTotals,
      breakdown,
      displayFlow: ip ? `${flowGPM.toFixed(1)} GPM` : `${flowLPS.toFixed(1)} L/s`
    };
  }, [iopSpaces, ip]);

  // Handlers
  const handleAddSpace = () => {
    if (!newDesc.trim()) return;
    const floor = extractFloorFU(newDesc);
    const fixturesCleaned: Record<string, number> = {};
    LU_FIXTURES_META.forEach(f => {
      const q = newFixtures[f.id] || 0;
      if (q > 0) fixturesCleaned[f.id] = q;
    });

    setIopSpaces([...iopSpaces, {
      id: Date.now(),
      desc: newDesc.trim(),
      floor,
      std: globalBuildingType,
      fixtures: fixturesCleaned
    }]);

    setNewDesc("");
    setNewFixtures({});
  };

  const handleFixtureChange = (spaceId: number, fixtureId: string, val: number) => {
    setIopSpaces(iopSpaces.map(s => {
      if (s.id !== spaceId) return s;
      return {
        ...s,
        fixtures: {
          ...s.fixtures,
          [fixtureId]: Math.max(0, val)
        }
      };
    }));
  };

  const handleSpaceDescChange = (spaceId: number, val: string) => {
    setIopSpaces(iopSpaces.map(s => {
      if (s.id !== spaceId) return s;
      return {
        ...s,
        desc: val,
        floor: extractFloorFU(val)
      };
    }));
  };

  const handleBuildingTypeChange = (type: "low" | "med" | "high") => {
    setGlobalBuildingType(type);
    setIopSpaces(iopSpaces.map(s => ({
      ...s,
      std: type
    })));
  };

  // Excel Export
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rowsData = [
      ["Loading Unit Sizing Report"],
      ["S.No", "Description", "Standard", ...LU_FIXTURES_META.map(f => f.short), "Total LU"],
      ...iopSpaces.map((s, idx) => {
        const row = [
          idx + 1,
          s.desc,
          s.std.toUpperCase(),
        ];
        LU_FIXTURES_META.forEach(f => {
          row.push(s.fixtures[f.id] || 0);
        });
        row.push(calculations.spaceTotals[s.id] || 0);
        return row;
      }),
      ["TOTALS", "", "", ...LU_FIXTURES_META.map(() => ""), calculations.totalLU]
    ];

    const summaryData = [
      ["Sizing Summary"],
      ["Total Loading Units (L.U)", calculations.totalLU.toFixed(1)],
      ["Probable Peak Flow", calculations.displayFlow],
      ["Applied Standard", "Standard Loading Unit Method (IOP)"]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    const wsRows = XLSX.utils.aoa_to_sheet(rowsData);
    XLSX.utils.book_append_sheet(wb, wsRows, "Fixture Schedule");

    XLSX.writeFile(wb, "Loading_Unit_Calculation_Report.xlsx");
  };

  // Group by floor for listing
  const floorsGrouped = useMemo(() => {
    const grouped: Record<string, LUSpace[]> = {};
    iopSpaces.forEach(s => {
      const fl = s.floor || "G";
      if (!grouped[fl]) grouped[fl] = [];
      grouped[fl].push(s);
    });
    return grouped;
  }, [iopSpaces]);

  return (
    <AppShell title="Loading Unit Calculator" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6 animate-in fade-in-50 duration-200">
          <div className="flex justify-between items-start select-none">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">PLUMBING &gt; LOADING UNIT SIZER</span>
              <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Loading Unit Calculator</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Specify fixture quantities building-wide using standard frequencies to determine loading units and flow rates.
              </p>
            </div>
            <button
              onClick={handleSaveCurrent}
              className="flex items-center gap-2 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-xl px-4 py-2 text-[12.5px] font-bold transition-all border-0 cursor-pointer shadow-sm mt-3"
            >
              <Save className="size-4" /> Save Calculation
            </button>
          </div>

          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 p-2 border border-border rounded-xl">
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl gap-1 select-none">
              <button type="button" onClick={() => setUnitSystem("si")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Metric (SI)</button>
              <button type="button" onClick={() => setUnitSystem("ip")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Imperial (IP)</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl gap-1 select-none text-xs">
                <button type="button" onClick={() => handleBuildingTypeChange("low")} className={`px-3 py-1 font-bold rounded-md transition-all duration-150 cursor-pointer ${globalBuildingType === "low" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Low</button>
                <button type="button" onClick={() => handleBuildingTypeChange("med")} className={`px-3 py-1 font-bold rounded-md transition-all duration-150 cursor-pointer ${globalBuildingType === "med" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Medium</button>
                <button type="button" onClick={() => handleBuildingTypeChange("high")} className={`px-3 py-1 font-bold rounded-md transition-all duration-150 cursor-pointer ${globalBuildingType === "high" ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>High</button>
              </div>
              <TBtn onClick={handleExportExcel} className="h-8.5 text-xs"><FileSpreadsheet className="size-3.5" /> Export Excel</TBtn>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Fixtures quantities schedule card */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">📋 Fixture Quantities (By Space / Area)</h3>
                  </div>
                  <button type="button" onClick={() => setIopSpaces([])} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-1 rounded transition-colors cursor-pointer border-0 bg-transparent">🗑 Clear All</button>
                </div>

                {/* Table for Adding/Editing spaces */}
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full border-collapse text-[11.5px] font-sans">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-border text-foreground font-semibold">
                        <th rowSpan={2} className="p-2 text-center w-8">#</th>
                        <th rowSpan={2} className="p-2 text-left min-w-[150px]">Description</th>
                        {LU_FIXTURES_META.map(f => (
                          <th key={f.id} className="p-2 text-center w-12">{f.short}</th>
                        ))}
                        <th rowSpan={2} className="p-2 text-center w-24 bg-[#0A7BC7]/5 text-[#0A7BC7] font-bold">TOTAL L.U</th>
                        <th rowSpan={2} className="p-2 text-center w-8"></th>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-border">
                        {LU_FIXTURES_META.map(f => (
                          <th key={f.id} className="p-1 px-2 text-center font-bold text-[#0A7BC7]/90 bg-[#0A7BC7]/5">{IP_FIXTURE_UNITS[f.id][globalBuildingType]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-blue-50/40/30 dark:bg-orange-950/10 border-b border-border/70 border-dashed">
                      {/* Interactive adding row */}
                      <tr className="bg-blue-50/40/30 dark:bg-orange-950/10 border-b border-border/70 border-dashed">
                        <td className="p-2 text-center font-extrabold text-[#0A7BC7] text-[15px]">+</td>
                        <td className="p-1.5">
                          <input type="text" placeholder="e.g. 1F Washroom" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md px-2 py-1 outline-none focus:border-[#0A7BC7]" />
                        </td>
                        {LU_FIXTURES_META.map(f => (
                          <td key={f.id} className="p-1">
                            <input type="number" min="0" placeholder="-" value={newFixtures[f.id] || ""} onChange={e => setNewFixtures({ ...newFixtures, [f.id]: e.target.value !== "" ? Number(e.target.value) : 0 })} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md py-1 text-center outline-none" />
                          </td>
                        ))}
                        <td className="p-2 text-right font-bold text-[#0A7BC7] font-mono">-</td>
                        <td className="p-2 text-center">
                          <button onClick={handleAddSpace} className="bg-[#0A7BC7] hover:bg-[#06456F] text-white px-2 py-1 rounded font-bold transition-all cursor-pointer border-0">Done</button>
                        </td>
                      </tr>
                    </tbody>
                    
                    {/* Sizing Rows */}
                    {iopSpaces.length === 0 ? (
                      <tbody>
                        <tr>
                          <td colSpan={LU_FIXTURES_META.length + 4} className="p-8 text-center text-muted-foreground italic">No spaces added. Add one above.</td>
                        </tr>
                      </tbody>
                    ) : (
                      Object.keys(floorsGrouped).map(floor => (
                        <tbody key={floor}>
                          {/* Floor Header row */}
                          <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-border text-foreground font-bold select-none text-[11px]">
                            <td colSpan={LU_FIXTURES_META.length + 4} className="p-1.5 px-3">📍 Floor: {floor}</td>
                          </tr>
                          {floorsGrouped[floor].map((s, sidx) => (
                            <tr key={s.id} className="border-b border-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                              <td className="p-2 text-center text-muted-foreground font-mono">{sidx + 1}</td>
                              <td className="p-1.5">
                                <input type="text" value={s.desc} onChange={e => handleSpaceDescChange(s.id, e.target.value)} className="w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-bold text-foreground" />
                              </td>
                              {LU_FIXTURES_META.map(f => (
                                <td key={f.id} className="p-1">
                                  <input type="number" min="0" value={s.fixtures[f.id] || ""} onChange={e => handleFixtureChange(s.id, f.id, Number(e.target.value))} className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium" />
                                </td>
                              ))}
                              <td className="p-2 text-center font-mono font-bold text-[#0A7BC7] bg-[#0A7BC7]/5">{(calculations.spaceTotals[s.id] || 0).toFixed(1)}</td>
                              <td className="p-2 text-center">
                                <button onClick={() => setIopSpaces(iopSpaces.filter(x => x.id !== s.id))} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer transition-colors border-0 bg-transparent">
                                  <Trash2 className="size-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      ))
                    )}
                  </table>
                </div>
              </div>

            </div>

            {/* Sizing Results sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs sticky top-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">📊 Sizing Results</h3>
                </div>

                <div className="flex flex-col gap-3 font-sans text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Total Loading Units</span>
                    <strong className="font-bold text-foreground font-mono">{calculations.totalLU.toFixed(1)} LU</strong>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-t border-border/60 mt-1 col-span-2">
                    <span className="font-bold text-foreground uppercase text-[11px] tracking-wide">Probable Peak Flow</span>
                    <strong className="font-extrabold text-[#0A7BC7] text-[16px] font-mono">{calculations.displayFlow}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Applied Standard</span>
                    <span className="font-semibold text-foreground">IOP Sizing Method</span>
                  </div>
                </div>

                {calculations.totalLU > 0 && (
                  <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/30 border border-border rounded-xl p-3.5 font-sans">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Zone-wise breakdown</div>
                    <div className="flex flex-col gap-1 text-[11.5px] font-semibold text-foreground">
                      {iopSpaces.map((s, idx) => (
                        <div key={idx} className="flex justify-between py-1 border-b border-border/20 last:border-0">
                          <span className="truncate max-w-[70%]">{s.desc} ({s.std.toUpperCase()})</span>
                          <span className="font-mono font-bold text-[#0A7BC7]">{(calculations.spaceTotals[s.id] || 0).toFixed(1)} LU</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-[#0A7BC7]/10 border border-[#0A7BC7]/20 text-[#06456F] dark:text-sky-300 rounded-xl p-3.5 flex gap-2.5 text-[11px] font-sans">
                  <Info className="size-4 shrink-0 mt-0.5 text-[#0A7BC7]" />
                  <span>Loading Units are computed in compliance with IOP standards and mapped to equivalent peak flow rates.</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  );
}
