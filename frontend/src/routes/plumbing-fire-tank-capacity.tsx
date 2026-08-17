import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { Download, Save } from "lucide-react";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";

export const Route = createFileRoute("/plumbing-fire-tank-capacity")({
  head: () => ({
    meta: [
      { title: "Fire Tank Capacity Calculator — MEP Calc" },
      { name: "description", content: "Calculate fire water storage tank capacity based on NFPA 22 guidelines." },
    ],
  }),
  component: FireTankCapacityPage,
});

function FireTankCapacityPage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Inputs
  const [systemType, setSystemType] = useState<"combined" | "standpipe" | "sprinkler">("combined");
  
  const [sprinklerFlow, setSprinklerFlow] = useState<string>("500");
  const [sprinklerDur, setSprinklerDur] = useState<string>("60");
  
  const [standpipeFlow, setStandpipeFlow] = useState<string>("500");
  const [standpipeDur, setStandpipeDur] = useState<string>("60");
  
  const [hoseFlow, setHoseFlow] = useState<string>("250");
  const [hoseDur, setHoseDur] = useState<string>("60");
  
  const [makeupFlow, setMakeupFlow] = useState<string>("0");
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load state from localStorage on project change
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`mep_fire_tank_capacity_calc_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.systemType !== undefined) setSystemType(data.systemType);
          if (data.sprinklerFlow !== undefined) setSprinklerFlow(data.sprinklerFlow);
          if (data.sprinklerDur !== undefined) setSprinklerDur(data.sprinklerDur);
          if (data.standpipeFlow !== undefined) setStandpipeFlow(data.standpipeFlow);
          if (data.standpipeDur !== undefined) setStandpipeDur(data.standpipeDur);
          if (data.hoseFlow !== undefined) setHoseFlow(data.hoseFlow);
          if (data.hoseDur !== undefined) setHoseDur(data.hoseDur);
          if (data.makeupFlow !== undefined) setMakeupFlow(data.makeupFlow);
        } else {
          // Reset to defaults
          setSystemType("combined");
          setSprinklerFlow("500");
          setSprinklerDur("60");
          setStandpipeFlow("500");
          setStandpipeDur("60");
          setHoseFlow("250");
          setHoseDur("60");
          setMakeupFlow("0");
        }
        setTimeout(() => dirtyStore.set(false), 50);
      } catch (e) {
        console.error("Failed to load fire tank capacity calculation", e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        systemType, sprinklerFlow, sprinklerDur, standpipeFlow, standpipeDur, hoseFlow, hoseDur, makeupFlow
      };
      localStorage.setItem(`mep_fire_tank_capacity_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, systemType, sprinklerFlow, sprinklerDur, standpipeFlow, standpipeDur, hoseFlow, hoseDur, makeupFlow]);

  const handleSaveCurrent = () => {
    try {
      if (project?.id) {
        const dataToSave = {
          systemType, sprinklerFlow, sprinklerDur, standpipeFlow, standpipeDur, hoseFlow, hoseDur, makeupFlow
        };
        localStorage.setItem(`mep_fire_tank_capacity_calc_${project.id}`, JSON.stringify(dataToSave));
        dirtyStore.set(false);
        if (forceSaveToCloud) forceSaveToCloud();
        toast.success("Fire Tank Capacity Calculation saved to project successfully!");
      }
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  const handleChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    dirtyStore.set(true);
  };

  // Calculations
  const results = useMemo(() => {
    const spQ = systemType === "standpipe" ? 0 : (parseFloat(sprinklerFlow) || 0);
    const spD = systemType === "standpipe" ? 0 : (parseFloat(sprinklerDur) || 0);
    
    const stQ = systemType === "sprinkler" ? 0 : (parseFloat(standpipeFlow) || 0);
    const stD = systemType === "sprinkler" ? 0 : (parseFloat(standpipeDur) || 0);
    
    const hsQ = parseFloat(hoseFlow) || 0;
    const hsD = parseFloat(hoseDur) || 0;
    
    const mu = parseFloat(makeupFlow) || 0;

    const maxDur = Math.max(spD, stD, hsD);
    
    const spV = spQ * spD;
    const stV = stQ * stD;
    const hsV = hsQ * hsD;
    
    const makeupCredit = mu * maxDur;
    const totalGal = Math.max(0, spV + stV + hsV - makeupCredit);
    const totalL = totalGal * 3.78541;

    return {
      spV, stV, hsV, maxDur, makeupCredit, totalGal, totalL
    };
  }, [systemType, sprinklerFlow, sprinklerDur, standpipeFlow, standpipeDur, hoseFlow, hoseDur, makeupFlow]);

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Fire Tank Capacity");
      
      sheet.columns = [
        { header: "Parameter", key: "param", width: 40 },
        { header: "Value", key: "val", width: 20 },
        { header: "Unit", key: "unit", width: 15 },
      ];
      
      sheet.addRow({ param: "System Type", val: systemType.toUpperCase(), unit: "-" });
      if (systemType !== "standpipe") {
        sheet.addRow({ param: "Sprinkler Flow", val: sprinklerFlow, unit: "GPM" });
        sheet.addRow({ param: "Sprinkler Duration", val: sprinklerDur, unit: "min" });
      }
      if (systemType !== "sprinkler") {
        sheet.addRow({ param: "Standpipe Flow", val: standpipeFlow, unit: "GPM" });
        sheet.addRow({ param: "Standpipe Duration", val: standpipeDur, unit: "min" });
      }
      sheet.addRow({ param: "Hose Stream Flow", val: hoseFlow, unit: "GPM" });
      sheet.addRow({ param: "Hose Stream Duration", val: hoseDur, unit: "min" });
      sheet.addRow({ param: "Makeup Water Flow", val: makeupFlow, unit: "GPM" });
      sheet.addRow({});
      sheet.addRow({ param: "Sprinkler Volume", val: results.spV.toFixed(0), unit: "gal" });
      sheet.addRow({ param: "Standpipe Volume", val: results.stV.toFixed(0), unit: "gal" });
      sheet.addRow({ param: "Hose Stream Volume", val: results.hsV.toFixed(0), unit: "gal" });
      sheet.addRow({ param: "Makeup Water Credit", val: results.makeupCredit.toFixed(0), unit: "gal" });
      sheet.addRow({});
      sheet.addRow({ param: "Total Required Capacity", val: results.totalGal.toFixed(0), unit: "gal" });
      sheet.addRow({ param: "Total Required Capacity (Liters)", val: results.totalL.toFixed(0), unit: "L" });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Fire_Tank_Capacity_${Date.now()}.xlsx`);
      toast.success("Excel calculation report generated successfully!");
    } catch (e) {
      toast.error("Failed to export Excel report.");
    }
  };

  return (
    <AppShell
      title="Fire Tank Capacity"
      subtitle="Calculate water storage required for fire protection"
      actions={
        <button
          onClick={handleSaveCurrent}
          className="flex items-center gap-1.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all border-0 cursor-pointer shadow-xs"
        >
          <Save className="size-3.5" /> Save Calculation
        </button>
      }
    >
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: INPUTS */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  📥 Tank Parameters
                </span>
              </div>

              {/* SYSTEM TYPE */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-slate-50/30 dark:bg-zinc-900/30 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                  <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                    SYSTEM TYPE
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setSystemType("combined"); dirtyStore.set(true); }}
                    className={`px-4 py-2 rounded-xl text-[12.5px] font-bold cursor-pointer transition-all border ${
                      systemType === "combined"
                        ? "bg-sky-500/10 text-[#06456F] border-[#0A7BC7] dark:bg-amber-950/40 dark:text-sky-400"
                        : "bg-background text-muted-foreground border-border hover:bg-slate-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Combined
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSystemType("sprinkler"); dirtyStore.set(true); }}
                    className={`px-4 py-2 rounded-xl text-[12.5px] font-bold cursor-pointer transition-all border ${
                      systemType === "sprinkler"
                        ? "bg-sky-500/10 text-[#06456F] border-[#0A7BC7] dark:bg-amber-950/40 dark:text-sky-400"
                        : "bg-background text-muted-foreground border-border hover:bg-slate-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Sprinkler Only
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSystemType("standpipe"); dirtyStore.set(true); }}
                    className={`px-4 py-2 rounded-xl text-[12.5px] font-bold cursor-pointer transition-all border ${
                      systemType === "standpipe"
                        ? "bg-sky-500/10 text-[#06456F] border-[#0A7BC7] dark:bg-amber-950/40 dark:text-sky-400"
                        : "bg-background text-muted-foreground border-border hover:bg-slate-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Standpipe Only
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4">
                
                {systemType !== "standpipe" && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                      <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                        SPRINKLER DEMAND
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                          Flow (GPM)
                        </label>
                        <input
                          type="number"
                          value={sprinklerFlow}
                          onChange={handleChange(setSprinklerFlow)}
                          className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                          Duration (min)
                        </label>
                        <input
                          type="number"
                          value={sprinklerDur}
                          onChange={handleChange(setSprinklerDur)}
                          className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                        />
                      </div>
                    </div>
                  </>
                )}

                {systemType !== "sprinkler" && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                      <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                        STANDPIPE DEMAND
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                          Flow (GPM)
                        </label>
                        <input
                          type="number"
                          value={standpipeFlow}
                          onChange={handleChange(setStandpipeFlow)}
                          className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                          Duration (min)
                        </label>
                        <input
                          type="number"
                          value={standpipeDur}
                          onChange={handleChange(setStandpipeDur)}
                          className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                  <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                    HOSE STREAM / HYDRANT
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      Flow (GPM)
                    </label>
                    <input
                      type="number"
                      value={hoseFlow}
                      onChange={handleChange(setHoseFlow)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      value={hoseDur}
                      onChange={handleChange(setHoseDur)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2 mt-4">
                  <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                  <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                    MAKEUP WATER CREDIT
                  </span>
                </div>
                <div>
                  <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                    Makeup Flow (GPM)
                  </label>
                  <input
                    type="number"
                    value={makeupFlow}
                    onChange={handleChange(setMakeupFlow)}
                    className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                  />
                </div>

              </div>

            </div>
          </div>

          {/* RIGHT COLUMN: RESULTS */}
          <div className="lg:col-span-7 space-y-5">
            
            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex gap-3 items-start">
              <span className="text-amber-500 mt-0.5">ℹ️</span>
              <div>
                <h4 className="text-[12.5px] font-bold text-amber-900 dark:text-amber-100 mb-1">NFPA 22 Note</h4>
                <p className="text-[11.5px] font-medium text-amber-800 dark:text-amber-200/70">
                  Tank capacity per NFPA 22. Verify local AHJ requirements - some do not allow makeup supply credit.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-5 bg-[#0A7BC7] rounded-full"></div>
                <h2 className="text-[15px] font-bold text-foreground tracking-wide">
                  Calculated Results
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {systemType !== "standpipe" && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Sprinkler Vol.
                    </div>
                    <div className="text-xl font-extrabold text-foreground">
                      {results.spV.toFixed(0)} <span className="text-sm font-semibold text-muted-foreground">gal</span>
                    </div>
                  </div>
                )}
                {systemType !== "sprinkler" && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Standpipe Vol.
                    </div>
                    <div className="text-xl font-extrabold text-foreground">
                      {results.stV.toFixed(0)} <span className="text-sm font-semibold text-muted-foreground">gal</span>
                    </div>
                  </div>
                )}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Hose Stream Vol.
                  </div>
                  <div className="text-xl font-extrabold text-foreground">
                    {results.hsV.toFixed(0)} <span className="text-sm font-semibold text-muted-foreground">gal</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-orange-950/20 border border-blue-100 dark:border-orange-900/50 mb-6 flex flex-col items-center text-center">
                <div className="text-[11.5px] font-bold text-[#06456F] dark:text-sky-400 uppercase tracking-wider mb-1">
                  Required Minimum Tank Capacity
                </div>
                <div className="text-3xl font-black text-[#06456F] dark:text-sky-400 mt-1">
                  {results.totalGal.toFixed(0)} <span className="text-lg font-bold">gal</span>
                </div>
                <div className="text-sm font-bold text-[#0A7BC7]/80 dark:text-sky-400/80 mt-1">
                  {results.totalL.toFixed(0)} L
                </div>
              </div>

              {parseFloat(makeupFlow) > 0 && (
                <div className="border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 dark:bg-zinc-900 px-4 py-2 border-b border-slate-100 dark:border-zinc-800">
                    <h3 className="text-[11.5px] font-bold text-muted-foreground uppercase tracking-wider">Makeup Water Credit</h3>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-semibold text-foreground">Deducted from Total</span>
                      <span className="text-[14px] font-extrabold text-green-600 dark:text-green-400">
                        -{results.makeupCredit.toFixed(0)} gal
                      </span>
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
