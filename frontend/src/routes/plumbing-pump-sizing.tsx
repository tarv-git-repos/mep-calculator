import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { Download, ChevronDown, ChevronRight, Save } from "lucide-react";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { IP_FIXTURE_UNITS, FU_FIXTURES_META } from "./plumbing-fixture-unit";

export const Route = createFileRoute("/plumbing-pump-sizing")({
  head: () => ({
    meta: [
      { title: "Pump Sizing (Transfer/Booster) — MEP Calc" },
      { name: "description", content: "Determine domestic water booster or transfer pump capacity, dynamic head, and motor sizing." },
    ],
  }),
  component: PumpSizingPage,
});

// Hunter's Curve lookup table (WSFU to GPM)
const ipcTable = [
  { wsfu: 0, gpm: 0 }, { wsfu: 1, gpm: 3 }, { wsfu: 2, gpm: 5 }, { wsfu: 3, gpm: 6.5 }, { wsfu: 5, gpm: 9.4 },
  { wsfu: 10, gpm: 14.6 }, { wsfu: 15, gpm: 17.5 }, { wsfu: 20, gpm: 19.6 }, { wsfu: 25, gpm: 21.5 },
  { wsfu: 30, gpm: 23.3 }, { wsfu: 40, gpm: 26.3 }, { wsfu: 50, gpm: 29.1 }, { wsfu: 60, gpm: 32 },
  { wsfu: 70, gpm: 35 }, { wsfu: 80, gpm: 38 }, { wsfu: 90, gpm: 41 }, { wsfu: 100, gpm: 43.5 },
  { wsfu: 120, gpm: 48 }, { wsfu: 140, gpm: 52.5 }, { wsfu: 160, gpm: 57 }, { wsfu: 180, gpm: 61 },
  { wsfu: 200, gpm: 65 }, { wsfu: 225, gpm: 70 }, { wsfu: 250, gpm: 75 }, { wsfu: 275, gpm: 80 },
  { wsfu: 300, gpm: 85 }, { wsfu: 400, gpm: 105 }, { wsfu: 500, gpm: 124 }, { wsfu: 750, gpm: 170 },
  { wsfu: 1000, gpm: 208 }, { wsfu: 1250, gpm: 239 }, { wsfu: 1500, gpm: 269 }, { wsfu: 1750, gpm: 297 },
  { wsfu: 2000, gpm: 325 }, { wsfu: 2500, gpm: 380 }, { wsfu: 3000, gpm: 433 }, { wsfu: 4000, gpm: 525 },
  { wsfu: 5000, gpm: 593 }
];

function wsfuToGPM(wsfu: number): number {
  const clamped = Math.max(0, Math.min(wsfu, 5000));
  const exact = ipcTable.find(row => row.wsfu === clamped);
  if (exact) return exact.gpm;
  for (let i = 0; i < ipcTable.length - 1; i++) {
    const lower = ipcTable[i];
    const upper = ipcTable[i + 1];
    if (clamped > lower.wsfu && clamped < upper.wsfu) {
      const ratio = (clamped - lower.wsfu) / (upper.wsfu - lower.wsfu);
      return lower.gpm + ratio * (upper.gpm - lower.gpm);
    }
  }
  return 0;
}

function wsfuToLPS(wsfu: number): number {
  return wsfuToGPM(wsfu) * 0.06309;
}

function PumpSizingPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, forceSaveToCloud } = useWorkspace();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  // Inputs matching defaults in screenshots
  const [pumpType, setPumpType] = useState<"booster" | "transfer" | "transfer-booster">("booster");
  const [wsfuVal, setWsfuVal] = useState<string>("21.6");
  const [manualFlow, setManualFlow] = useState<string>("1.3");
  
  // Transfer pump specifics
  const [reqVolume, setReqVolume] = useState<string>("5000");
  const [fillTime, setFillTime] = useState<string>("2");
  
  // Pumps count
  const [workingPumps, setWorkingPumps] = useState<string>("1");
  const [standbyPumps, setStandbyPumps] = useState<string>("-");
  
  // Piping
  const [fricFactor, setFricFactor] = useState<string>("0.4");
  const [pipeVert, setPipeVert] = useState<string>("20");
  const [pipeHoriz, setPipeHoriz] = useState<string>("50");
  
  // Filters (Transfer pump only)
  const [filtCarbon, setFiltCarbon] = useState(false);
  const [filtMM, setFiltMM] = useState(false);
  const [filtCuAg, setFiltCuAg] = useState(false);
  const [filtSoftener, setFiltSoftener] = useState(false);
  
  // Sizing head parameters
  const [staticHead, setStaticHead] = useState<string>("5.0");
  const [presidHead, setPresidHead] = useState<string>("1.0");
  const [suctionHead, setSuctionHead] = useState<string>("0");
  const [sfHead, setSfHead] = useState<string>("5");
  
  // Motor parameters
  const [selectedHead, setSelectedHead] = useState<string>("");
  const [effMotor, setEffMotor] = useState<string>("85");
  const [effPump, setEffPump] = useState<string>("70");
  
  // Accordion UI state
  const [expandDetails, setExpandDetails] = useState<boolean>(false);
  const [expandAssumptions, setExpandAssumptions] = useState<boolean>(false);

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load state from localStorage on project change
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_pump_sizing_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.pumpType) setPumpType(data.pumpType);
        if (data.wsfuVal !== undefined) setWsfuVal(data.wsfuVal);
        if (data.manualFlow !== undefined) setManualFlow(data.manualFlow);
        if (data.reqVolume !== undefined) setReqVolume(data.reqVolume);
        if (data.fillTime !== undefined) setFillTime(data.fillTime);
        if (data.workingPumps !== undefined) setWorkingPumps(data.workingPumps);
        if (data.standbyPumps !== undefined) setStandbyPumps(data.standbyPumps);
        if (data.fricFactor !== undefined) setFricFactor(data.fricFactor);
        if (data.pipeVert !== undefined) setPipeVert(data.pipeVert);
        if (data.pipeHoriz !== undefined) setPipeHoriz(data.pipeHoriz);
        if (data.filtCarbon !== undefined) setFiltCarbon(data.filtCarbon);
        if (data.filtMM !== undefined) setFiltMM(data.filtMM);
        if (data.filtCuAg !== undefined) setFiltCuAg(data.filtCuAg);
        if (data.filtSoftener !== undefined) setFiltSoftener(data.filtSoftener);
        if (data.staticHead !== undefined) setStaticHead(data.staticHead);
        if (data.presidHead !== undefined) setPresidHead(data.presidHead);
        if (data.suctionHead !== undefined) setSuctionHead(data.suctionHead);
        if (data.sfHead !== undefined) setSfHead(data.sfHead);
        if (data.selectedHead !== undefined) setSelectedHead(data.selectedHead);
        if (data.effMotor !== undefined) setEffMotor(data.effMotor);
        if (data.effPump !== undefined) setEffPump(data.effPump);
      } else {
        // Reset to defaults
        setPumpType("booster");
        setWsfuVal("21.6");
        setManualFlow("1.3");
        setReqVolume("5000");
        setFillTime("2");
        setWorkingPumps("1");
        setStandbyPumps("-");
        setFricFactor("0.4");
        setPipeVert("20");
        setPipeHoriz("50");
        setFiltCarbon(false);
        setFiltMM(false);
        setFiltCuAg(false);
        setFiltSoftener(false);
        setStaticHead("5.0");
        setPresidHead("1.0");
        setSuctionHead("0");
        setSfHead("5");
        setSelectedHead("");
        setEffMotor("85");
        setEffPump("70");
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load pump sizing calculation", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  const handleSaveCurrent = () => {
    try {
      const dataToSave = {
        pumpType,
        wsfuVal,
        manualFlow,
        reqVolume,
        fillTime,
        workingPumps,
        standbyPumps,
        fricFactor,
        pipeVert,
        pipeHoriz,
        filtCarbon,
        filtMM,
        filtCuAg,
        filtSoftener,
        staticHead,
        presidHead,
        suctionHead,
        sfHead,
        selectedHead,
        effMotor,
        effPump
      };
      localStorage.setItem(`mep_pump_sizing_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(false);
    if (forceSaveToCloud) forceSaveToCloud();

      toast.success("Pump Sizing Calculation saved to project successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  const handleImportWSFU = () => {
    try {
      const stored = localStorage.getItem(`mep_fixture_unit_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.fuSpaces && Array.isArray(data.fuSpaces)) {
          let total = 0;
          data.fuSpaces.forEach((s: any) => {
            const spaceStd = s.std || "ipc-total";
            Object.keys(s.fixtures || {}).forEach(fid => {
              const qty = s.fixtures[fid] || 0;
              const unitFU = IP_FIXTURE_UNITS[fid]?.[spaceStd] || 0;
              total += qty * unitFU;
            });
          });
          
          if (total > 0) {
            setWsfuVal(total.toFixed(1));
            dirtyStore.set(true);
            toast.success(`Imported ${total.toFixed(1)} WSFU from Fixture Unit Calculator!`);
          } else {
            toast.error("No fixture unit calculations found in this project.");
          }
        }
      } else {
        toast.error("No saved Fixture Unit Calculator found for this project.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to import values.");
    }
  };

  // Auto-import WSFU from Fixture Unit sizer on mount if current wsfuVal is empty or "0"
  useEffect(() => {
    if (pumpType !== "transfer" && (wsfuVal === "" || wsfuVal === "0" || wsfuVal === "21.6")) {
      try {
        const stored = localStorage.getItem(`mep_fixture_unit_calc_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.fuSpaces && Array.isArray(data.fuSpaces)) {
            let total = 0;
            data.fuSpaces.forEach((s: any) => {
              const spaceStd = s.std || "ipc-total";
              Object.keys(s.fixtures || {}).forEach(fid => {
                const qty = s.fixtures[fid] || 0;
                const unitFU = IP_FIXTURE_UNITS[fid]?.[spaceStd] || 0;
                total += qty * unitFU;
              });
            });
            if (total > 0) {
              setWsfuVal(total.toFixed(1));
            }
          }
        }
      } catch (e) {
        console.error("Auto-import failed", e);
      }
    }
  }, [project.id, pumpType]);

  // Auto-calculate flow rate from WSFU (Booster/Transfer-Booster)
  useEffect(() => {
    if (pumpType !== "transfer") {
      const parsedWsfu = parseFloat(wsfuVal);
      if (!isNaN(parsedWsfu) && parsedWsfu > 0) {
        const calculatedLps = wsfuToLPS(parsedWsfu);
        const wPumps = parseInt(workingPumps) || 1;
        setManualFlow((calculatedLps / Math.max(1, wPumps)).toFixed(1));
      }
    }
  }, [wsfuVal, pumpType, workingPumps]);

  // Auto-calculate flow rate from volume and time (Transfer)
  useEffect(() => {
    if (pumpType === "transfer") {
      const vol = parseFloat(reqVolume) || 0;
      const hrs = parseFloat(fillTime) || 0;
      if (vol > 0 && hrs > 0) {
        const calculatedLps = vol / (hrs * 3600);
        setManualFlow(calculatedLps.toFixed(1));
      }
    }
  }, [reqVolume, fillTime, pumpType]);

  // Calculations
  const results = useMemo(() => {
    const vert = parseFloat(pipeVert) || 0;
    const horiz = parseFloat(pipeHoriz) || 0;
    const ff = parseFloat(fricFactor) || 0.4;
    
    // Equivalent lengths: elbows = (vert + horiz) * 0.3, valves = (vert + horiz) * 0.3
    const elbows = (vert + horiz) * 0.3;
    const valves = (vert + horiz) * 0.3;
    const totalLen = vert + horiz;
    
    // Sum and round up equivalent length: Math.ceil((L_sum * 1.05) / 10) * 10
    const L_sum = vert + horiz + elbows + valves;
    const equivLen = Math.ceil((L_sum * 1.05) / 10) * 10;
    
    // Major + Minor friction losses (bar)
    const frictionLoss = equivLen * (ff / 100);
    
    // Filter losses (bar) - only for transfer pumps
    let filterLoss = 0;
    if (pumpType === "transfer") {
      if (filtCarbon) filterLoss += 0.8;
      if (filtMM) filterLoss += 0.8;
      if (filtCuAg) filterLoss += 0.2;
      if (filtSoftener) filterLoss += 0.8;
    }
    
    const staticH = parseFloat(staticHead) || 0;
    const outletH = parseFloat(presidHead) || 0;
    const suctionH = parseFloat(suctionHead) || 0;
    const safetyMargin = (parseFloat(sfHead) || 0) / 100;
    
    // Total Calculated Pump Head (bar)
    // Formula: Total Head = [(Friction Loss + Static Head + Outlet Pressure) - Suction Pressure] + Filter Loss
    const rawHead = Math.max(0, (frictionLoss + staticH + outletH) - suctionH) + filterLoss;
    const calcHead = rawHead * (1 + safetyMargin);
    
    // Selected head for motor sizing
    const selHead = parseFloat(selectedHead) || calcHead;
    
    // Flow rate determination (L/s) - holds flow per pump (already divided by workingPumps where applicable)
    const flowLps = parseFloat(manualFlow) || 0;
    
    // Motor Sizing
    const liftKpa = selHead * 100; // 1 bar = 100 kPa
    const pEff = (parseFloat(effPump) || 70) / 100;
    const mEff = (parseFloat(effMotor) || 85) / 100;
    
    // Shaft Power (kW) = (Flow L/s * Lift kPa) / (1000 * Pump Efficiency)
    const shaftPower = pEff > 0 ? (flowLps * liftKpa) / (1000 * pEff) : 0;
    
    // Motor Power (kW) = Shaft Power / Motor Efficiency
    const motorPower = mEff > 0 ? shaftPower / mEff : 0;
    const hp = motorPower * 1.34102;
    
    return {
      elbows,
      valves,
      totalLen: L_sum,
      equivLen,
      frictionLoss,
      filterLoss,
      calcHead,
      selectedHead: selHead,
      flowLps,
      liftKpa,
      shaftPower,
      motorPower,
      hp,
    };
  }, [
    pipeVert, pipeHoriz, fricFactor, pumpType, filtCarbon, filtMM, filtCuAg, filtSoftener,
    staticHead, presidHead, suctionHead, sfHead, selectedHead, manualFlow,
    effPump, effMotor
  ]);

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Pump Sizing Calculation");
      
      sheet.columns = [
        { header: "Parameter / Metric", key: "param", width: 40 },
        { header: "Value", key: "val", width: 20 },
        { header: "Unit", key: "unit", width: 15 },
      ];
      
      sheet.addRow({ param: "Pump Application Type", val: pumpType.toUpperCase(), unit: "-" });
      sheet.addRow({ param: "Total Fixture Units (WSFU)", val: wsfuVal, unit: "WSFU" });
      sheet.addRow({ param: "Working Pumps Count", val: workingPumps, unit: "units" });
      sheet.addRow({ param: "Standby Pumps Count", val: standbyPumps, unit: "units" });
      sheet.addRow({ param: "Design Flow Rate", val: results.flowLps.toFixed(2), unit: "L/s" });
      sheet.addRow({});
      sheet.addRow({ param: "Vertical Pipe Length", val: pipeVert, unit: "m" });
      sheet.addRow({ param: "Horizontal Pipe Length", val: pipeHoriz, unit: "m" });
      sheet.addRow({ param: "Elbows & Reducers Equivalent", val: results.elbows.toFixed(2), unit: "m" });
      sheet.addRow({ param: "Isolation Valves Equivalent", val: results.valves.toFixed(2), unit: "m" });
      sheet.addRow({ param: "Total Equivalent Length", val: results.equivLen.toFixed(2), unit: "m" });
      sheet.addRow({ param: "Major + Minor Losses", val: results.frictionLoss.toFixed(3), unit: "bar" });
      sheet.addRow({});
      sheet.addRow({ param: "Static Head", val: staticHead, unit: "bar" });
      sheet.addRow({ param: "Residual Pressure at Outlet", val: presidHead, unit: "bar" });
      sheet.addRow({ param: "Suction Pressure (Available)", val: suctionHead, unit: "bar" });
      sheet.addRow({ param: "Safety Margin", val: sfHead, unit: "%" });
      sheet.addRow({ param: "Calculated Pump Head", val: results.calcHead.toFixed(3), unit: "bar" });
      sheet.addRow({});
      sheet.addRow({ param: "Selected Head for Motor", val: results.selectedHead.toFixed(3), unit: "bar" });
      sheet.addRow({ param: "Shaft Power Requirement", val: results.shaftPower.toFixed(2), unit: "kW" });
      sheet.addRow({ param: "Estimated Motor Power", val: results.motorPower.toFixed(2), unit: "kW" });
      sheet.addRow({ param: "Motor Power (HP)", val: results.hp.toFixed(2), unit: "HP" });

      
    const sigRow = worksheet.rowCount ? worksheet.rowCount + 2 : 20;
    addExcelSignatureBlock(worksheet, sigRow, currentUserName, project?.id || "default", "plumbing-pump-sizing");
    const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Pump_Sizing_${Date.now()}.xlsx`);
      toast.success("Excel calculation report generated successfully!");
    } catch (e) {
      toast.error("Failed to export Excel report.");
    }
  };

  
  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = { pumpType, wsfuVal, manualFlow, reqVolume, fillTime, workingPumps, standbyPumps, fricFactor, pipeVert, pipeHoriz, filtCarbon, filtMM, filtCuAg, filtSoftener, staticHead, presidHead, suctionHead, sfHead, selectedHead, effMotor, effPump, expandDetails, expandAssumptions };
      localStorage.setItem(`mep_pump_sizing_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, pumpType, wsfuVal, manualFlow, reqVolume, fillTime, workingPumps, standbyPumps, fricFactor, pipeVert, pipeHoriz, filtCarbon, filtMM, filtCuAg, filtSoftener, staticHead, presidHead, suctionHead, sfHead, selectedHead, effMotor, effPump, expandDetails, expandAssumptions]);

  return (
    <AppShell
      title="Pump Sizing Calculator"
      subtitle="Transfer & Booster Pump Duty Sizing"
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
        
        {/* TWO-COLUMN SIDE-BY-SIDE LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  📥 Sizing Parameters
                </span>
              </div>

              {/* SECTION: SELECT PUMP TYPE */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-slate-50/30 dark:bg-zinc-900/30 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                  <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                    SELECT PUMP TYPE
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPumpType("booster")}
                    className={`px-4 py-2 rounded-xl text-[12.5px] font-bold cursor-pointer transition-all border ${
                      pumpType === "booster"
                        ? "bg-sky-500/10 text-[#06456F] border-[#0A7BC7] dark:bg-amber-950/40 dark:text-sky-400"
                        : "bg-background text-muted-foreground border-border hover:bg-slate-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Booster Pump
                  </button>
                  <button
                    type="button"
                    onClick={() => setPumpType("transfer")}
                    className={`px-4 py-2 rounded-xl text-[12.5px] font-bold cursor-pointer transition-all border ${
                      pumpType === "transfer"
                        ? "bg-sky-500/10 text-[#06456F] border-[#0A7BC7] dark:bg-amber-950/40 dark:text-sky-400"
                        : "bg-background text-muted-foreground border-border hover:bg-slate-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Transfer Pump
                  </button>
                  <button
                    type="button"
                    onClick={() => setPumpType("transfer-booster")}
                    className={`px-4 py-2 rounded-xl text-[12.5px] font-bold cursor-pointer transition-all border ${
                      pumpType === "transfer-booster"
                        ? "bg-sky-500/10 text-[#06456F] border-[#0A7BC7] dark:bg-amber-950/40 dark:text-sky-400"
                        : "bg-background text-muted-foreground border-border hover:bg-slate-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Transfer-Booster
                  </button>
                </div>
              </div>

              {/* SECTION: FLOW ESTIMATION MODE */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                  <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                    FLOW ESTIMATION MODE
                  </span>
                </div>

                {pumpType !== "transfer" ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[12px] font-bold text-foreground">
                          Total Fixture Units
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleImportWSFU}
                            className="text-[10.5px] font-extrabold text-[#06456F] dark:text-sky-400 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 px-2 py-0.5 rounded-md uppercase cursor-pointer border-0 transition-colors"
                          >
                            Import from F.U. Calculator
                          </button>
                          <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-2 py-0.5 rounded-md uppercase">
                            WSFU
                          </span>
                        </div>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={wsfuVal}
                        onChange={(e) => setWsfuVal(e.target.value)}
                        placeholder="21.6"
                        className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                          Number of pumps: Working
                        </label>
                        <input
                          type="number"
                          value={workingPumps}
                          onChange={(e) => setWorkingPumps(e.target.value)}
                          className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11.5px] font-bold text-muted-foreground mb-1">
                          Number of pumps: Standby
                        </label>
                        <input
                          type="text"
                          value={standbyPumps}
                          onChange={(e) => setStandbyPumps(e.target.value)}
                          placeholder="-"
                          className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11.5px] font-bold text-muted-foreground uppercase mb-1">
                        Required Capacity (L)
                      </label>
                      <input
                        type="number"
                        value={reqVolume}
                        onChange={(e) => setReqVolume(e.target.value)}
                        placeholder="5000"
                        className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-bold text-muted-foreground uppercase mb-1">
                        Fill Time (Hours)
                      </label>
                      <input
                        type="number"
                        value={fillTime}
                        onChange={(e) => setFillTime(e.target.value)}
                        placeholder="2"
                        className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                      />
                    </div>
                  </div>
                )}

                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl flex items-start gap-2.5 text-[12px] text-amber-900 dark:text-amber-200 font-medium">
                  <span className="text-amber-500 text-sm shrink-0 mt-0.5">💡</span>
                  <span className="leading-snug">
                    {pumpType === "transfer"
                      ? "Flow will be calculated as Tank Capacity divided by Tank Fill Time (converted to L/s)."
                      : "Flow will be calculated using the IPC Hunter Curve table with linear interpolation based on the WSFU."
                    }
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-bold text-foreground">
                      Design Flow Rate
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      L/s
                    </span>
                  </div>
                  <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-3.5 flex items-center justify-between">
                    <input
                      type="number"
                      step="0.01"
                      value={pumpType !== "transfer" && parseFloat(wsfuVal) > 0 ? results.flowLps.toFixed(1) : manualFlow}
                      onChange={(e) => {
                        setManualFlow(e.target.value);
                        if (pumpType !== "transfer") setWsfuVal("0");
                      }}
                      className="w-full bg-transparent text-amber-600 dark:text-amber-400 font-extrabold text-xl outline-none"
                      placeholder="1.3"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: MAJOR & MINOR HEAD LOSS (PIPING RUN) */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                    <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                      MAJOR &amp; MINOR HEAD LOSS (PIPING RUN)
                    </span>
                  </div>
                  <div className="text-[11.5px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    <span>Friction Factor:</span>
                    <span className="text-[#0A7BC7] font-bold">{fricFactor || "0.4"} bar/100m length</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Vertical Pipe Length
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      m
                    </span>
                  </div>
                  <input
                    type="number"
                    value={pipeVert}
                    onChange={(e) => setPipeVert(e.target.value)}
                    placeholder="20"
                    className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Horizontal Pipe Length
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      m
                    </span>
                  </div>
                  <input
                    type="number"
                    value={pipeHoriz}
                    onChange={(e) => setPipeHoriz(e.target.value)}
                    placeholder="50"
                    className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Elbows &amp; Reducers Equiv.
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      m
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={results.elbows.toFixed(2)}
                    className="w-full h-11 px-3 bg-slate-50 dark:bg-zinc-900/60 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-default"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Isolation Valves Equiv.
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      m
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={results.valves.toFixed(2)}
                    className="w-full h-11 px-3 bg-slate-50 dark:bg-zinc-900/60 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-default"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Equivalent Length
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      m
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={results.equivLen.toFixed(2)}
                    className="w-full h-11 px-3 bg-slate-50 dark:bg-zinc-900/60 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-default"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Major + Minor Losses
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      bar
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={results.frictionLoss.toFixed(3)}
                    className="w-full h-11 px-3 bg-slate-50 dark:bg-zinc-900/60 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-default"
                  />
                </div>
              </div>

              {/* SECTION: PUMP HEAD REQUIREMENT */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                  <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                    PUMP HEAD REQUIREMENT
                  </span>
                </div>

                {pumpType === "transfer" && (
                  <div className="flex flex-col gap-2.5 p-4 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-2">
                      <span className="text-[12px] font-bold text-slate-800 dark:text-zinc-200">
                        Water Treatment Filters
                      </span>
                      <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-2 py-0.5 rounded uppercase">
                        Added to Head
                      </span>
                    </div>
                    <div className="flex flex-col gap-2.5 select-none mt-1">
                      <label className="flex items-center gap-2.5 text-[12.5px] cursor-pointer text-slate-700 dark:text-zinc-300 font-semibold">
                        <input
                          type="checkbox"
                          checked={filtCarbon}
                          onChange={(e) => {
                            setFiltCarbon(e.target.checked);
                            dirtyStore.set(true);
                          }}
                          className="rounded text-[#0A7BC7] focus:ring-[#0A7BC7] cursor-pointer"
                        />
                        <span>Carbon Filter (0.8 bar)</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-[12.5px] cursor-pointer text-slate-700 dark:text-zinc-300 font-semibold">
                        <input
                          type="checkbox"
                          checked={filtMM}
                          onChange={(e) => {
                            setFiltMM(e.target.checked);
                            dirtyStore.set(true);
                          }}
                          className="rounded text-[#0A7BC7] focus:ring-[#0A7BC7] cursor-pointer"
                        />
                        <span>Multi-media Filter (0.8 bar)</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-[12.5px] cursor-pointer text-slate-700 dark:text-zinc-300 font-semibold">
                        <input
                          type="checkbox"
                          checked={filtCuAg}
                          onChange={(e) => {
                            setFiltCuAg(e.target.checked);
                            dirtyStore.set(true);
                          }}
                          className="rounded text-[#0A7BC7] focus:ring-[#0A7BC7] cursor-pointer"
                        />
                        <span>Cu-Ag ionization (0.2 bar)</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-[12.5px] cursor-pointer text-slate-700 dark:text-zinc-300 font-semibold">
                        <input
                          type="checkbox"
                          checked={filtSoftener}
                          onChange={(e) => {
                            setFiltSoftener(e.target.checked);
                            dirtyStore.set(true);
                          }}
                          className="rounded text-[#0A7BC7] focus:ring-[#0A7BC7] cursor-pointer"
                        />
                        <span>Softener (0.8 bar)</span>
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Pressure Drop in the Piping
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      bar
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={results.frictionLoss.toFixed(3)}
                    className="w-full h-11 px-3 bg-slate-50 dark:bg-zinc-900/60 border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold text-muted-foreground outline-none cursor-default"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Static Head
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      bar
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={staticHead}
                    onChange={(e) => setStaticHead(e.target.value)}
                    placeholder="5.0"
                    className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Residual Pressure at Outlet
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      bar
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={presidHead}
                    onChange={(e) => setPresidHead(e.target.value)}
                    placeholder="1.0"
                    className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Suction Pressure (Available)
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      bar
                    </span>
                  </div>
                  <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-1">
                    <input
                      type="number"
                      step="0.1"
                      value={suctionHead}
                      onChange={(e) => setSuctionHead(e.target.value)}
                      placeholder="0"
                      className="w-full h-9 px-3 bg-transparent text-amber-700 dark:text-amber-300 font-semibold text-[14px] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Considering safety margin
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      %
                    </span>
                  </div>
                  <input
                    type="number"
                    value={sfHead}
                    onChange={(e) => setSfHead(e.target.value)}
                    placeholder="5"
                    className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Head for the Pump
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      bar
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={results.calcHead.toFixed(3)}
                    className="w-full h-11 px-3 bg-slate-50 dark:bg-zinc-900/60 border border-border dark:border-[#262626] rounded-xl text-[14px] font-bold text-foreground outline-none cursor-default"
                  />
                </div>
              </div>

              {/* SECTION: SELECTED HEAD & EFFICIENCY FOR MOTOR SIZING */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-background space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                  <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                    SELECTED HEAD &amp; EFFICIENCY FOR MOTOR SIZING
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-semibold text-muted-foreground">
                      Selected Head for the Pump
                    </label>
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                      bar
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedHead}
                    onChange={(e) => setSelectedHead(e.target.value)}
                    placeholder="Same as calculated head if blank"
                    className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[13px] font-medium outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/60"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[12px] font-semibold text-muted-foreground">
                        Motor Efficiency
                      </label>
                      <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                        %
                      </span>
                    </div>
                    <input
                      type="number"
                      value={effMotor}
                      onChange={(e) => setEffMotor(e.target.value)}
                      placeholder="85"
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[12px] font-semibold text-muted-foreground">
                        Pump Efficiency
                      </label>
                      <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase">
                        %
                      </span>
                    </div>
                    <input
                      type="number"
                      value={effPump}
                      onChange={(e) => setEffPump(e.target.value)}
                      placeholder="70"
                      className="w-full h-11 px-3 bg-background border border-border dark:border-[#262626] rounded-xl text-[14px] font-semibold outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                </div>
              </div>

              {/* ACTION BUTTON */}
              <button
                type="button"
                onClick={() => {
                  toast.success("Sizing & Motor parameters updated successfully!");
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="w-full py-4 bg-[#0A7BC7] hover:bg-[#06456F] active:bg-[#06456F] text-white font-bold text-[15px] rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>⚡ Calculate Sizing &amp; Motor Sizing</span>
              </button>

            </div>
          </div>

          {/* RIGHT COLUMN: RESULTS & BREAKDOWNS (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* SECTION 1: FRICTION AND EQUIVALENT LENGTH BREAKDOWN */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="border-b border-slate-100 dark:border-zinc-800/80 px-4 py-3.5 bg-slate-50/50 dark:bg-zinc-900/30 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                  1. FRICTION AND EQUIVALENT LENGTH BREAKDOWN
                </span>
              </div>
              <div className="p-4 space-y-3 text-[12.5px]">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60">
                  <span className="text-muted-foreground font-medium">Sum of Component Lengths</span>
                  <span className="font-extrabold text-foreground">{results.totalLen.toFixed(1)} m</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60">
                  <span className="text-muted-foreground font-medium">Total Equivalent Length (with Safety)</span>
                  <span className="font-extrabold text-foreground">{results.equivLen.toFixed(1)} m</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-muted-foreground font-medium">Major + Minor Friction Losses</span>
                  <span className="font-extrabold text-foreground">{results.frictionLoss.toFixed(3)} bar</span>
                </div>
              </div>
            </div>

            {/* SECTION 2: SIZING HEAD REQUIREMENTS */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="border-b border-slate-100 dark:border-zinc-800/80 px-4 py-3.5 bg-slate-50/50 dark:bg-zinc-900/30 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                  2. SIZING HEAD REQUIREMENTS
                </span>
              </div>
              <div className="p-4 space-y-3 text-[12.5px]">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60">
                  <span className="text-muted-foreground font-medium">Piping Friction Losses</span>
                  <span className="font-extrabold text-foreground">{results.frictionLoss.toFixed(3)} bar</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60">
                  <span className="text-muted-foreground font-medium">Static Elevation Lift</span>
                  <span className="font-extrabold text-foreground">{(parseFloat(staticHead) || 0).toFixed(2)} bar</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60">
                  <span className="text-muted-foreground font-medium">Residual Head at Outlet</span>
                  <span className="font-extrabold text-foreground">{(parseFloat(presidHead) || 0).toFixed(2)} bar</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60">
                  <span className="text-muted-foreground font-medium">Suction Pressure (Deducted)</span>
                  <span className="font-extrabold text-amber-600 dark:text-amber-400">
                    -{(parseFloat(suctionHead) || 0).toFixed(2)} bar
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-muted-foreground font-bold text-[13px]">Total Calculated Pump Head</span>
                  <span className="font-black text-[#0A7BC7] text-base">{results.calcHead.toFixed(3)} bar</span>
                </div>
              </div>
            </div>

            {/* SECTION 3: CALCULATIONS FOR MOTOR SELECTION */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="border-b border-slate-100 dark:border-zinc-800/80 px-4 py-3.5 bg-slate-50/50 dark:bg-zinc-900/30 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#0A7BC7] rounded-full"></div>
                <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
                  3. CALCULATIONS FOR MOTOR SELECTION
                </span>
              </div>
              <div className="p-4 space-y-3 text-[12.5px]">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60">
                  <span className="text-muted-foreground font-medium">Selected Head for the Pump</span>
                  <span className="font-extrabold text-foreground">{results.selectedHead.toFixed(3)} bar</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60">
                  <span className="text-muted-foreground font-medium">Pump Flow Rate</span>
                  <span className="font-extrabold text-foreground">{results.flowLps.toFixed(3)} kg/s</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60">
                  <span className="text-muted-foreground font-medium">Pressure Lift Requirement</span>
                  <span className="font-extrabold text-foreground">{results.liftKpa.toFixed(1)} kPa</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800/60">
                  <span className="text-muted-foreground font-medium">Shaft Power Requirement</span>
                  <span className="font-extrabold text-foreground">{results.shaftPower.toFixed(2)} kW</span>
                </div>
              </div>
              {/* Highlighted bottom summary banner */}
              <div className="bg-sky-500/10 dark:bg-amber-950/30 border-t border-amber-500/20 px-4 py-3.5 flex items-center justify-between">
                <span className="font-bold text-amber-700 dark:text-amber-300 text-[13px]">
                  Estimated Motor Power
                </span>
                <span className="font-black text-amber-600 dark:text-amber-400 text-base">
                  {results.motorPower.toFixed(2)} kW / {results.hp.toFixed(2)} HP
                </span>
              </div>
            </div>

            {/* Calculations Breakdown details (Accordion) */}
            <div className="border border-border dark:border-[#262626] rounded-2xl overflow-hidden bg-background">
              <button
                type="button"
                onClick={() => setExpandDetails(!expandDetails)}
                className="w-full px-5 py-3.5 bg-slate-50 dark:bg-zinc-900 border-b border-border dark:border-[#262626] flex items-center justify-between text-[13px] font-bold text-foreground outline-none cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[#06456F] dark:text-sky-400">Σ</span>
                  <span>Detailed Calculations Breakdown</span>
                </div>
                {expandDetails ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
              {expandDetails && (
                <div className="p-5 space-y-4 text-[12.5px] leading-relaxed">
                  <div className="bg-slate-50/50 dark:bg-zinc-900/10 border border-slate-100 dark:border-zinc-800/80 p-3 rounded-xl">
                    <span className="font-bold text-foreground block">1. Piping friction losses:</span>
                    <span className="text-muted-foreground mt-0.5 block font-mono text-[11.5px]">
                      H_loss = L_equiv × (FrictionFactor / 100) = {results.equivLen.toFixed(1)} × ({fricFactor || "0.4"}/100) = <span className="text-[#06456F] dark:text-sky-400 font-bold">{results.frictionLoss.toFixed(3)} bar</span>
                    </span>
                  </div>
                  <div className="bg-slate-50/50 dark:bg-zinc-900/10 border border-slate-100 dark:border-zinc-800/80 p-3 rounded-xl">
                    <span className="font-bold text-foreground block">2. Total Dynamic Head required (TDH):</span>
                    <span className="text-muted-foreground mt-0.5 block font-mono text-[11.5px] leading-normal">
                      TDH = [ (H_loss + H_static + H_outlet − H_suction) + H_filter ] × (1 + SafetyMargin/100) = <span className="text-[#06456F] dark:text-sky-400 font-bold">{results.calcHead.toFixed(3)} bar</span>
                    </span>
                  </div>
                  <div className="bg-slate-50/50 dark:bg-zinc-900/10 border border-slate-100 dark:border-zinc-800/80 p-3 rounded-xl">
                    <span className="font-bold text-foreground block">3. Required shaft and motor power:</span>
                    <span className="text-muted-foreground mt-0.5 block font-mono text-[11.5px]">
                      Power = Flow × Head Lift ÷ (1000 × η) = {results.flowLps.toFixed(2)} × {results.liftKpa.toFixed(0)} ÷ (1000 × {effPump || "70"}%) = <span className="text-[#06456F] dark:text-sky-400 font-bold">{results.motorPower.toFixed(2)} kW ({results.hp.toFixed(2)} HP)</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Assumptions & Basis Accordion */}
            <div className="border border-border dark:border-[#262626] rounded-2xl overflow-hidden bg-background">
              <button
                type="button"
                onClick={() => setExpandAssumptions(!expandAssumptions)}
                className="w-full px-5 py-3.5 bg-slate-50 dark:bg-zinc-900 border-b border-border dark:border-[#262626] flex items-center justify-between text-[13px] font-bold text-foreground outline-none cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[#06456F] dark:text-sky-400 font-bold font-sans">i</span>
                  <span>Assumptions & Basis</span>
                </div>
                {expandAssumptions ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
              {expandAssumptions && (
                <div className="p-5 text-[12.5px] text-muted-foreground space-y-2 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="text-[#0A7BC7] font-bold shrink-0 mt-0.5">•</span>
                    <span>Booster pump adds pressure deficit between suction mains and required fixture pressure.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#0A7BC7] font-bold shrink-0 mt-0.5">•</span>
                    <span>Equivalent pipe length automatically includes a 30% allowance for elbows/fittings and 30% for isolation valves.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#0A7BC7] font-bold shrink-0 mt-0.5">•</span>
                    <span>Mass flow rate calculations assume clean fresh water density of approximately 1,000 kg/m³.</span>
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
