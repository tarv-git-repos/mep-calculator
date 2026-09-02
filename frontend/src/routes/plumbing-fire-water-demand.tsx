import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
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

export const Route = createFileRoute("/plumbing-fire-water-demand")({
  head: () => ({
    meta: [
      { title: "Fire Water Demand Calculator — MEP Calc" },
      { name: "description", content: "Determine total fire water demand based on sprinklers, hydrants, and hose reels." },
    ],
  }),
  component: FireWaterDemandPage,
});

function FireWaterDemandPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, forceSaveToCloud } = useWorkspace();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Inputs
  const [spFlow, setSpFlow] = useState<string>("500");
  const [spPress, setSpPress] = useState<string>("60");
  const [hyCount, setHyCount] = useState<string>("2");
  const [hyFlow, setHyFlow] = useState<string>("250");
  const [hrCount, setHrCount] = useState<string>("0");
  const [hrFlow, setHrFlow] = useState<string>("50");
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load state from localStorage on project change
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`mep_fire_water_demand_calc_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.spFlow !== undefined) setSpFlow(data.spFlow);
          if (data.spPress !== undefined) setSpPress(data.spPress);
          if (data.hyCount !== undefined) setHyCount(data.hyCount);
          if (data.hyFlow !== undefined) setHyFlow(data.hyFlow);
          if (data.hrCount !== undefined) setHrCount(data.hrCount);
          if (data.hrFlow !== undefined) setHrFlow(data.hrFlow);
        } else {
          // Reset to defaults
          setSpFlow("500");
          setSpPress("60");
          setHyCount("2");
          setHyFlow("250");
          setHrCount("0");
          setHrFlow("50");
        }
        setTimeout(() => dirtyStore.set(false), 50);
      } catch (e) {
        console.error("Failed to load fire water demand calculation", e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        spFlow, spPress, hyCount, hyFlow, hrCount, hrFlow
      };
      localStorage.setItem(`mep_fire_water_demand_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, spFlow, spPress, hyCount, hyFlow, hrCount, hrFlow]);

  const handleSaveCurrent = () => {
    try {
      if (project?.id) {
        const dataToSave = {
          spFlow, spPress, hyCount, hyFlow, hrCount, hrFlow
        };
        localStorage.setItem(`mep_fire_water_demand_calc_${project.id}`, JSON.stringify(dataToSave));
        dirtyStore.set(false);
        if (forceSaveToCloud) forceSaveToCloud();
        toast.success("Fire Water Demand Calculation saved to project successfully!");
      }
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  // Trigger dirty store on change
  const handleChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    dirtyStore.set(true);
  };

  // Calculations
  const results = useMemo(() => {
    const spF = parseFloat(spFlow) || 0;
    const hyC = parseInt(hyCount) || 0;
    const hyF = parseFloat(hyFlow) || 0;
    const hrC = parseInt(hrCount) || 0;
    const hrF = parseFloat(hrFlow) || 0;

    const hyTotal = hyC * hyF;
    const hrTotal = hrC * hrF;
    const totalFlow = spF + hyTotal + hrTotal;
    
    const tank60 = totalFlow * 60;
    const tank90 = totalFlow * 90;

    const showLargeDemandWarning = totalFlow > 2000;

    return {
      spF, hyTotal, hrTotal, totalFlow, tank60, tank90, showLargeDemandWarning
    };
  }, [spFlow, hyCount, hyFlow, hrCount, hrFlow]);

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Fire Water Demand");
      
      sheet.columns = [
        { header: "Parameter", key: "param", width: 40 },
        { header: "Value", key: "val", width: 20 },
        { header: "Unit", key: "unit", width: 15 },
      ];
      
      sheet.addRow({ param: "Sprinkler System Flow", val: spFlow, unit: "GPM" });
      sheet.addRow({ param: "Sprinkler System Pressure", val: spPress, unit: "psi" });
      sheet.addRow({ param: "Hydrants Count", val: hyCount, unit: "ea" });
      sheet.addRow({ param: "Flow per Hydrant", val: hyFlow, unit: "GPM" });
      sheet.addRow({ param: "Hose Reels Count", val: hrCount, unit: "ea" });
      sheet.addRow({ param: "Flow per Hose Reel", val: hrFlow, unit: "GPM" });
      sheet.addRow({});
      sheet.addRow({ param: "Total Hydrant Flow", val: results.hyTotal.toFixed(2), unit: "GPM" });
      sheet.addRow({ param: "Total Hose Reel Flow", val: results.hrTotal.toFixed(2), unit: "GPM" });
      sheet.addRow({ param: "Total Fire Water Demand", val: results.totalFlow.toFixed(2), unit: "GPM" });
      sheet.addRow({ param: "60-min Tank Capacity", val: results.tank60.toFixed(2), unit: "gal" });
      sheet.addRow({ param: "90-min Tank Capacity", val: results.tank90.toFixed(2), unit: "gal" });

      
    const sigRow = worksheet.rowCount ? worksheet.rowCount + 2 : 20;
    addExcelSignatureBlock(worksheet, sigRow, currentUserName, project?.id || "default", "plumbing-fire-water-demand");
    const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Fire_Water_Demand_${Date.now()}.xlsx`);
      toast.success("Excel calculation report generated successfully!");
    } catch (e) {
      toast.error("Failed to export Excel report.");
    }
  };

  return (
    <AppShell
      title="Fire Water Demand"
      subtitle="Determine total flow for sprinklers and hydrants"
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
          <CalculationReviewBar calculatorPath="/plumbing-fire-water-demand" calculatorTitle="Fire Water Demand" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: INPUTS */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  📥 Demand Parameters
                </span>
              </div>

              {/* SECTION: Sprinkler System */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                  <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                    SPRINKLER SYSTEM
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      System Flow (GPM)
                    </label>
                    <input
                      type="number"
                      value={spFlow}
                      onChange={handleChange(setSpFlow)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      Pressure (psi)
                    </label>
                    <input
                      type="number"
                      value={spPress}
                      onChange={handleChange(setSpPress)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: Hydrants & Hose Reels */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                  <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                    ADDITIONAL DEMANDS
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      Hydrant Count
                    </label>
                    <input
                      type="number"
                      value={hyCount}
                      onChange={handleChange(setHyCount)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      Flow per Hydrant (GPM)
                    </label>
                    <input
                      type="number"
                      value={hyFlow}
                      onChange={handleChange(setHyFlow)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      Hose Reel Count
                    </label>
                    <input
                      type="number"
                      value={hrCount}
                      onChange={handleChange(setHrCount)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      Flow per Hose (GPM)
                    </label>
                    <input
                      type="number"
                      value={hrFlow}
                      onChange={handleChange(setHrFlow)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT COLUMN: RESULTS */}
          <div className="lg:col-span-7 space-y-5">
            
            {results.showLargeDemandWarning && (
              <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex gap-3 items-start">
                <span className="text-amber-500 mt-0.5">⚠️</span>
                <div>
                  <h4 className="text-[12.5px] font-bold text-amber-900 dark:text-amber-100 mb-1">Large Demand</h4>
                  <p className="text-[11.5px] font-medium text-amber-800 dark:text-amber-200/70">
                    Total demand ({results.totalFlow.toFixed(0)} GPM) is very large. Verify simultaneous demand assumptions and consider split pump arrangement.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-5 bg-[#0A7BC7] rounded-full"></div>
                <h2 className="text-[15px] font-bold text-foreground tracking-wide">
                  Calculated Results
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Sprinkler Demand
                  </div>
                  <div className="text-xl font-extrabold text-foreground">
                    {results.spF.toFixed(0)} <span className="text-sm font-semibold text-muted-foreground">GPM @ {parseFloat(spPress) || 0} psi</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Hydrants Demand
                  </div>
                  <div className="text-xl font-extrabold text-foreground">
                    {results.hyTotal.toFixed(0)} <span className="text-sm font-semibold text-muted-foreground">GPM</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">({parseInt(hyCount)||0} × {parseFloat(hyFlow)||0} GPM)</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Hose Reels Demand
                  </div>
                  <div className="text-xl font-extrabold text-foreground">
                    {results.hrTotal.toFixed(0)} <span className="text-sm font-semibold text-muted-foreground">GPM</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">({parseInt(hrCount)||0} × {parseFloat(hrFlow)||0} GPM)</div>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-orange-950/20 border border-blue-100 dark:border-orange-900/50">
                  <div className="text-[11px] font-bold text-[#06456F] dark:text-sky-400 uppercase tracking-wider mb-1">
                    Total System Demand
                  </div>
                  <div className="text-2xl font-black text-[#06456F] dark:text-sky-400">
                    {results.totalFlow.toFixed(0)} <span className="text-sm font-bold">GPM</span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-zinc-900 px-4 py-2 border-b border-slate-100 dark:border-zinc-800">
                  <h3 className="text-[11.5px] font-bold text-muted-foreground uppercase tracking-wider">Required Storage Capacity</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] font-semibold text-foreground">For 60 Minutes Duration</span>
                    <span className="text-[14px] font-extrabold text-slate-700 dark:text-zinc-300">
                      {results.tank60.toFixed(0)} gal
                    </span>
                  </div>
                  <div className="w-full h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] font-semibold text-foreground">For 90 Minutes Duration</span>
                    <span className="text-[14px] font-extrabold text-slate-700 dark:text-zinc-300">
                      {results.tank90.toFixed(0)} gal
                    </span>
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
