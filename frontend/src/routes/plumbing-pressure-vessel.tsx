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

export const Route = createFileRoute("/plumbing-pressure-vessel")({
  head: () => ({
    meta: [
      { title: "Pressure Vessel Sizing — MEP Calc" },
      { name: "description", content: "Calculate the required volume of water supply expansion or bladder pressure vessels." },
    ],
  }),
  component: PressureVesselPage,
});

function PressureVesselPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, forceSaveToCloud } = useWorkspace();
  
  // State variables matching the calculator parameters
  const [importedFlow, setImportedFlow] = useState<string>("0.00");
  const [importedHead, setImportedHead] = useState<string>("0.00");
  const [qLmin, setQLmin] = useState<string>("78.00");
  const [bandFactor, setBandFactor] = useState<string>("0.20");
  const [ppVal, setPpVal] = useState<string>("8.52");
  const [paVal, setPaVal] = useState<string>("5.68");
  const [zmax, setZmax] = useState<string>("60");
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load state from localStorage on project change
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`mep_pressure_vessel_calc_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.importedFlow !== undefined) setImportedFlow(data.importedFlow);
          if (data.importedHead !== undefined) setImportedHead(data.importedHead);
          if (data.qLmin !== undefined) setQLmin(data.qLmin);
          if (data.bandFactor !== undefined) setBandFactor(data.bandFactor);
          if (data.ppVal !== undefined) setPpVal(data.ppVal);
          if (data.paVal !== undefined) setPaVal(data.paVal);
          if (data.zmax !== undefined) setZmax(data.zmax);
        } else {
          // Defaults
          setImportedFlow("0.00");
          setImportedHead("0.00");
          setQLmin("78.00");
          setBandFactor("0.20");
          setPpVal("8.52");
          setPaVal("5.68");
          setZmax("60");
        }
        setTimeout(() => dirtyStore.set(false), 50);
      } catch (e) {
        console.error("Failed to load pressure vessel calculation", e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        importedFlow,
        importedHead,
        qLmin,
        bandFactor,
        ppVal,
        paVal,
        zmax
      };
      localStorage.setItem(`mep_pressure_vessel_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, importedFlow, importedHead, qLmin, bandFactor, ppVal, paVal, zmax]);

  const handleSaveCurrent = () => {
    try {
      if (project?.id) {
        const dataToSave = {
          importedFlow,
          importedHead,
          qLmin,
          bandFactor,
          ppVal,
          paVal,
          zmax
        };
        localStorage.setItem(`mep_pressure_vessel_calc_${project.id}`, JSON.stringify(dataToSave));
        dirtyStore.set(false);
        if (forceSaveToCloud) forceSaveToCloud();
        toast.success("Pressure Vessel Sizing saved to project successfully!");
      }
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  // Auto-update stop (Pp) and start (Pa) absolute pressures if imported head changes
  useEffect(() => {
    const head = parseFloat(importedHead) || 0;
    const factor = parseFloat(bandFactor) || 0;
    if (head > 0) {
      const computedPp = (head * factor) + head;
      const computedPa = head - (head * factor);
      setPpVal(computedPp.toFixed(2));
      setPaVal(computedPa.toFixed(2));
    }
  }, [importedHead, bandFactor]);

  // Auto-update pump discharge flow rate (Q) if imported flow rate changes
  useEffect(() => {
    const flow = parseFloat(importedFlow) || 0;
    if (flow > 0) {
      setQLmin((flow * 60).toFixed(2));
    }
  }, [importedFlow]);

  // Sizing calculations
  const results = useMemo(() => {
    const q = parseFloat(qLmin) || 0;
    const pp = parseFloat(ppVal) || 0;
    const pa = parseFloat(paVal) || 0;
    const pc = pa - 0.2;
    const z = parseFloat(zmax) || 1;
    const constant = 16.5;
    
    let volume = 0;
    if (z > 0 && (pp - pa) > 0 && pc > 0) {
      volume = constant * ((q * pp * pa) / (z * (pp - pa) * pc));
    }
    
    return {
      pc,
      volume
    };
  }, [qLmin, ppVal, paVal, zmax]);

  const handleImport = (importType: "booster" | "transfer") => {
    try {
      const stored = localStorage.getItem(`mep_pump_sizing_calc_${project.id}`);
      if (!stored) {
        toast.error(`No saved Pump Sizing Calculation found for this project. Please save it first.`);
        return;
      }
      const data = JSON.parse(stored);
      
      // Check type compatibility
      if (importType === "booster" && data.pumpType === "transfer") {
        toast.error(`The saved calculation is for a Transfer Pump. Please select "Import from Transfer Pump".`);
        return;
      }
      if (importType === "transfer" && data.pumpType !== "transfer") {
        toast.error(`The saved calculation is for a Booster/Transfer-Booster Pump. Please select "Import from Booster Pump".`);
        return;
      }
      
      // Perform math replicating pump sizing formulas
      const vert = parseFloat(data.pipeVert) || 0;
      const horiz = parseFloat(data.pipeHoriz) || 0;
      const ff = parseFloat(data.fricFactor) || 0.4;
      const elbows = (vert + horiz) * 0.3;
      const valves = (vert + horiz) * 0.3;
      const L_sum = vert + horiz + elbows + valves;
      const equivLen = Math.ceil((L_sum * 1.05) / 10) * 10;
      const frictionLoss = equivLen * (ff / 100);
      
      let filterLoss = 0;
      if (data.pumpType === "transfer") {
        if (data.filtCarbon) filterLoss += 0.8;
        if (data.filtMM) filterLoss += 0.8;
        if (data.filtCuAg) filterLoss += 0.2;
        if (data.filtSoftener) filterLoss += 0.8;
      }
      
      const staticH = parseFloat(data.staticHead) || 0;
      const outletH = parseFloat(data.presidHead) || 0;
      const suctionH = parseFloat(data.suctionHead) || 0;
      const safetyMargin = (parseFloat(data.sfHead) || 0) / 100;
      const rawHead = Math.max(0, (frictionLoss + staticH + outletH) - suctionH) + filterLoss;
      const calcHead = rawHead * (1 + safetyMargin);
      
      let flowLps = parseFloat(data.manualFlow) || 0;
      const wPumps = parseInt(data.workingPumps) || 1;
      
      if (data.pumpType !== "transfer") {
        // Booster sum flow
        flowLps = flowLps * wPumps;
      }
      
      setImportedFlow(flowLps.toFixed(2));
      setImportedHead(calcHead.toFixed(2));
      dirtyStore.set(true);
      toast.success(`Successfully imported from ${importType === "booster" ? "Booster Pump" : "Transfer Pump"}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to import values.");
    }
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Pressure Vessel Sizing");
      
      sheet.columns = [
        { header: "Parameter / Metric", key: "param", width: 45 },
        { header: "Value", key: "val", width: 20 },
        { header: "Unit", key: "unit", width: 15 },
      ];
      
      sheet.addRow({ param: "Imported Flow Rate", val: importedFlow, unit: "L/s" });
      sheet.addRow({ param: "Imported Pump Head", val: importedHead, unit: "bar" });
      sheet.addRow({});
      sheet.addRow({ param: "Discharge Volume of Booster Pump (Q)", val: qLmin, unit: "L/min" });
      sheet.addRow({ param: "On / Off Band Factor", val: bandFactor, unit: "-" });
      sheet.addRow({ param: "Absolute pressure of Pump Stop (Pp)", val: ppVal, unit: "bar" });
      sheet.addRow({ param: "Absolute pressure of Pump Start (Pa)", val: paVal, unit: "bar" });
      sheet.addRow({ param: "Absolute pressure Preload (Pc)", val: results.pc.toFixed(2), unit: "bar" });
      sheet.addRow({ param: "Pump starts per hour (Zmax)", val: zmax, unit: "#" });
      sheet.addRow({});
      sheet.addRow({ param: "Required Pressure Vessel Capacity", val: results.volume.toFixed(2), unit: "Liters" });
      
      
    const sigRow = worksheet.rowCount ? worksheet.rowCount + 2 : 20;
    addExcelSignatureBlock(worksheet, sigRow, currentUserName, project?.id || "default", "plumbing-pressure-vessel");
    const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Pressure_Vessel_Sizing_${Date.now()}.xlsx`);
      toast.success("Excel report generated successfully!");
    } catch (e) {
      toast.error("Failed to export Excel report.");
    }
  };

  const handleFieldChange = (setter: React.Dispatch<React.SetStateAction<string>>, val: string) => {
    setter(val);
    dirtyStore.set(true);
  };

  return (
    <AppShell
      title="Pressure Vessel Sizing"
      subtitle="Expansion & Buffer Tank volume calculator"
      actions={
        <button
          onClick={handleSaveCurrent}
          className="flex items-center gap-1.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all border-0 cursor-pointer shadow-xs animate-in fade-in duration-200"
        >
          <Save className="size-3.5" /> Save Calculation
        </button>
      }
    >
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20">
          <CalculationReviewBar calculatorPath="/plumbing-pressure-vessel" calculatorTitle="Pressure Vessel Sizing" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: PARAMETER INPUTS */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  📥 Input Parameters
                </span>
              </div>

              {/* Data Import Section */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-slate-50/30 dark:bg-zinc-900/30 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                  <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                    Import Sizing Data
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handleImport("booster")}
                    className="py-2.5 bg-background hover:bg-slate-100 dark:hover:bg-zinc-800 text-foreground border border-border dark:border-[#262626] rounded-xl text-[12px] font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Import Booster Pump
                  </button>
                  <button
                    type="button"
                    onClick={() => handleImport("transfer")}
                    className="py-2.5 bg-background hover:bg-slate-100 dark:hover:bg-zinc-800 text-foreground border border-border dark:border-[#262626] rounded-xl text-[12px] font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Import Transfer Pump
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      Imported Flow Rate (L/s)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={importedFlow}
                      className="w-full h-11 px-3 bg-slate-100 dark:bg-zinc-950/80 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                      Imported Head (bar)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={importedHead}
                      className="w-full h-11 px-3 bg-slate-100 dark:bg-zinc-950/80 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* System Parameters Section */}
              <div className="space-y-4 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Discharge Volume of Pump (Q)
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      L/min
                    </span>
                  </div>
                  <input
                    type="number"
                    value={qLmin}
                    onChange={(e) => handleFieldChange(setQLmin, e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-semibold text-muted-foreground mb-1">
                      On / Off Band Factor
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={bandFactor}
                      onChange={(e) => handleFieldChange(setBandFactor, e.target.value)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-muted-foreground mb-1">
                      Pump Starts / Hour (Zmax)
                    </label>
                    <input
                      type="number"
                      value={zmax}
                      onChange={(e) => handleFieldChange(setZmax, e.target.value)}
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-muted-foreground">
                        Pump Stop (Pp)
                      </label>
                      <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1 py-0.5 rounded uppercase">
                        bar
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={ppVal}
                      onChange={(e) => handleFieldChange(setPpVal, e.target.value)}
                      className="w-full h-11 px-2.5 bg-background border border-border dark:border-[#262626] rounded-xl text-[13.5px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-muted-foreground">
                        Pump Start (Pa)
                      </label>
                      <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1 py-0.5 rounded uppercase">
                        bar
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={paVal}
                      onChange={(e) => handleFieldChange(setPaVal, e.target.value)}
                      className="w-full h-11 px-2.5 bg-background border border-border dark:border-[#262626] rounded-xl text-[13.5px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-muted-foreground">
                        Preload (Pc)
                      </label>
                      <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1 py-0.5 rounded uppercase">
                        bar
                      </span>
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={results.pc.toFixed(2)}
                      className="w-full h-11 px-2.5 bg-slate-50 dark:bg-zinc-950/80 border border-border dark:border-[#262626] rounded-xl text-[13.5px] font-semibold text-muted-foreground outline-none cursor-default"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT COLUMN: CALCULATION RESULTS */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="border-b border-slate-100 dark:border-zinc-800/80 px-4 py-3.5 bg-slate-50/50 dark:bg-zinc-900/30 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                  PRESSURE VESSEL VOLUME SUMMARY
                </span>
              </div>
              <div className="p-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide">
                  Required Pressure Vessel Capacity
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[52px] font-black tracking-tight text-[#0A7BC7]">
                    {results.volume.toFixed(1)}
                  </span>
                  <span className="text-lg font-bold text-slate-500">Liters</span>
                </div>
                <p className="text-[13px] text-muted-foreground max-w-md mt-2">
                  The recommended vessel volume is calculated using a constant factor of 16.5 based on motor starts, system pressures, and pump discharge volumes.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="border-b border-slate-100 dark:border-zinc-800/80 px-4 py-3.5 bg-slate-50/50 dark:bg-zinc-900/30 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                  FORMULAS AND ENGINEERING CRITERIA
                </span>
              </div>
              <div className="p-5 space-y-4 text-[13px] leading-relaxed text-muted-foreground">
                <div>
                  <div className="font-bold text-foreground mb-1">Preload Pressure calculation (Pc):</div>
                  <code className="block bg-slate-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-border/80 text-[12px] font-semibold text-slate-700 dark:text-zinc-300">
                    Pc = Pa - 0.2 bar
                  </code>
                </div>
                <div>
                  <div className="font-bold text-foreground mb-1">Vessel Sizing Formula:</div>
                  <code className="block bg-slate-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-border/80 text-[12px] font-semibold text-slate-700 dark:text-zinc-300">
                    Volume = 16.5 × (Q × Pp × Pa) ÷ (Zmax × (Pp - Pa) × Pc)
                  </code>
                  <div className="text-[11.5px] mt-2 space-y-1">
                    <div>• <strong className="text-foreground">Q:</strong> Pump discharge volume (L/min)</div>
                    <div>• <strong className="text-foreground">Pp:</strong> Absolute cut-out stop pressure (bar)</div>
                    <div>• <strong className="text-foreground">Pa:</strong> Absolute cut-in start pressure (bar)</div>
                    <div>• <strong className="text-foreground">Pc:</strong> Absolute gas preload pressure (bar)</div>
                    <div>• <strong className="text-foreground">Zmax:</strong> Maximum allowable pump starts per hour</div>
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
