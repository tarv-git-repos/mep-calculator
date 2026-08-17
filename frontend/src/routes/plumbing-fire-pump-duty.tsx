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

export const Route = createFileRoute("/plumbing-fire-pump-duty")({
  head: () => ({
    meta: [
      { title: "Fire Pump Duty Calculator — MEP Calc" },
      { name: "description", content: "Calculate fire pump rated flow, head, churn pressure, and motor sizing." },
    ],
  }),
  component: FirePumpDutyPage,
});

function FirePumpDutyPage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Inputs
  const [fpFlow, setFpFlow] = useState<string>("500");
  const [fpPress, setFpPress] = useState<string>("100");
  const [fpDisch, setFpDisch] = useState<string>("5");
  const [fpSuct, setFpSuct] = useState<string>("0");
  const [fpEff, setFpEff] = useState<string>("70");
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load state from localStorage on project change
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`mep_fire_pump_duty_calc_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.fpFlow !== undefined) setFpFlow(data.fpFlow);
          if (data.fpPress !== undefined) setFpPress(data.fpPress);
          if (data.fpDisch !== undefined) setFpDisch(data.fpDisch);
          if (data.fpSuct !== undefined) setFpSuct(data.fpSuct);
          if (data.fpEff !== undefined) setFpEff(data.fpEff);
        } else {
          // Reset to defaults
          setFpFlow("500");
          setFpPress("100");
          setFpDisch("5");
          setFpSuct("0");
          setFpEff("70");
        }
        setTimeout(() => dirtyStore.set(false), 50);
      } catch (e) {
        console.error("Failed to load fire pump duty calculation", e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = { fpFlow, fpPress, fpDisch, fpSuct, fpEff };
      localStorage.setItem(`mep_fire_pump_duty_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, fpFlow, fpPress, fpDisch, fpSuct, fpEff]);

  const handleSaveCurrent = () => {
    try {
      if (project?.id) {
        const dataToSave = { fpFlow, fpPress, fpDisch, fpSuct, fpEff };
        localStorage.setItem(`mep_fire_pump_duty_calc_${project.id}`, JSON.stringify(dataToSave));
        dirtyStore.set(false);
        if (forceSaveToCloud) forceSaveToCloud();
        toast.success("Fire Pump Duty Calculation saved to project successfully!");
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
    const Q = parseFloat(fpFlow) || 0;
    const P = parseFloat(fpPress) || 0;
    const suct = parseFloat(fpSuct) || 0;
    const disch = parseFloat(fpDisch) || 0;
    const eff = (parseFloat(fpEff) || 70) / 100;

    const suctPsi = suct * 0.4335;
    // Rated Head = System Pressure + Discharge Loss - Suction Pressure + 3 psi (margin)
    const rated = P + disch - suctPsi + 3;
    const churn = rated * 1.40;
    const peakPsi = rated * 0.65;
    const peakQ = Q * 1.50;

    // Power calculation
    // Q in m3/s: GPM * 6.30902e-5
    const qM3s = Q * 6.30902e-5;
    // Head in m: psi * 0.703070
    const hM = rated * 0.703070;
    // kW = (Q * H * 1000 * 9.80665) / efficiency / 1000
    const kw = eff > 0 ? (qM3s * hM * 1000 * 9.80665) / eff / 1000 : 0;
    const hp = kw * 1.34102;

    const showHighChurnWarning = churn > 250;

    return {
      Q, rated, churn, peakQ, peakPsi, kw, hp, showHighChurnWarning
    };
  }, [fpFlow, fpPress, fpDisch, fpSuct, fpEff]);

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Fire Pump Duty");
      
      sheet.columns = [
        { header: "Parameter", key: "param", width: 40 },
        { header: "Value", key: "val", width: 20 },
        { header: "Unit", key: "unit", width: 15 },
      ];
      
      sheet.addRow({ param: "Design Flow", val: fpFlow, unit: "GPM" });
      sheet.addRow({ param: "System Demand Pressure", val: fpPress, unit: "psi" });
      sheet.addRow({ param: "Discharge Piping Friction Loss", val: fpDisch, unit: "psi" });
      sheet.addRow({ param: "Available Suction Head", val: fpSuct, unit: "ft" });
      sheet.addRow({ param: "Pump Efficiency", val: fpEff, unit: "%" });
      sheet.addRow({});
      sheet.addRow({ param: "Rated Flow", val: results.Q.toFixed(0), unit: "GPM" });
      sheet.addRow({ param: "Rated Head", val: results.rated.toFixed(1), unit: "psi" });
      sheet.addRow({ param: "Churn Pressure (140%)", val: results.churn.toFixed(1), unit: "psi" });
      sheet.addRow({ param: "Peak Point Flow (150%)", val: results.peakQ.toFixed(0), unit: "GPM" });
      sheet.addRow({ param: "Peak Point Head (65%)", val: results.peakPsi.toFixed(1), unit: "psi" });
      sheet.addRow({ param: "Motor Power", val: results.hp.toFixed(1), unit: "HP" });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Fire_Pump_Duty_${Date.now()}.xlsx`);
      toast.success("Excel calculation report generated successfully!");
    } catch (e) {
      toast.error("Failed to export Excel report.");
    }
  };

  return (
    <AppShell
      title="Fire Pump Duty"
      subtitle="Determine rated head, churn pressure, and motor sizing"
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
                  📥 Pump Parameters
                </span>
              </div>

              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                  <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                    FLOW & PRESSURE
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      Design Flow (GPM)
                    </label>
                    <input
                      type="number"
                      value={fpFlow}
                      onChange={handleChange(setFpFlow)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      System Demand Pressure (psi)
                    </label>
                    <input
                      type="number"
                      value={fpPress}
                      onChange={handleChange(setFpPress)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      Discharge Piping Loss (psi)
                    </label>
                    <input
                      type="number"
                      value={fpDisch}
                      onChange={handleChange(setFpDisch)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      Available Suction Head (ft)
                    </label>
                    <input
                      type="number"
                      value={fpSuct}
                      onChange={handleChange(setFpSuct)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                    Pump Efficiency (%)
                  </label>
                  <input
                    type="number"
                    value={fpEff}
                    onChange={handleChange(setFpEff)}
                    className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT COLUMN: RESULTS */}
          <div className="lg:col-span-7 space-y-5">
            
            {results.showHighChurnWarning && (
              <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 flex gap-3 items-start">
                <span className="text-red-500 mt-0.5">⚠️</span>
                <div>
                  <h4 className="text-[12.5px] font-bold text-red-900 dark:text-red-100 mb-1">High Churn Pressure</h4>
                  <p className="text-[11.5px] font-medium text-red-800 dark:text-red-200/70">
                    Churn {results.churn.toFixed(0)} psi is high. Verify system PRV and pressure ratings.
                  </p>
                </div>
              </div>
            )}
            
            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex gap-3 items-start">
              <span className="text-amber-500 mt-0.5">ℹ️</span>
              <div>
                <h4 className="text-[12.5px] font-bold text-amber-900 dark:text-amber-100 mb-1">NFPA 20 Requirement</h4>
                <p className="text-[11.5px] font-medium text-amber-800 dark:text-amber-200/70">
                  Pump must deliver ≥150% rated flow at ≥65% rated head. Verify with manufacturer's pump curve.
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-orange-950/20 border border-blue-100 dark:border-orange-900/50">
                  <div className="text-[11px] font-bold text-[#06456F] dark:text-sky-400 uppercase tracking-wider mb-1">
                    Rated Duty Point
                  </div>
                  <div className="text-2xl font-black text-[#06456F] dark:text-sky-400">
                    {results.Q.toFixed(0)} <span className="text-sm font-bold">GPM</span> @ {results.rated.toFixed(1)} <span className="text-sm font-bold">psi</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Motor Power Requirement
                  </div>
                  <div className="text-xl font-extrabold text-foreground">
                    {results.hp.toFixed(1)} <span className="text-sm font-semibold text-muted-foreground">HP</span> / {results.kw.toFixed(1)} <span className="text-sm font-semibold text-muted-foreground">kW</span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-zinc-900 px-4 py-2 border-b border-slate-100 dark:border-zinc-800">
                  <h3 className="text-[11.5px] font-bold text-muted-foreground uppercase tracking-wider">Pump Curve Points</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] font-semibold text-foreground">Churn Pressure (0 GPM)</span>
                    <span className="text-[14px] font-extrabold text-slate-700 dark:text-zinc-300">
                      {results.churn.toFixed(1)} psi <span className="text-[10px] font-medium text-muted-foreground ml-1">(140% rated)</span>
                    </span>
                  </div>
                  <div className="w-full h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] font-semibold text-foreground">Peak Point (150% Flow)</span>
                    <span className="text-[14px] font-extrabold text-slate-700 dark:text-zinc-300">
                      {results.peakQ.toFixed(0)} GPM @ {results.peakPsi.toFixed(1)} psi
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
