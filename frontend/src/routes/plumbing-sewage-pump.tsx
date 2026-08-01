import React, { useState, useEffect } from 'react';
import { Calculator, Save, AlertCircle, Info, Download } from 'lucide-react';
import { useWorkspace } from '@/lib/workspace-store';
import { dirtyStore } from '@/lib/dirty-store';
import { AppShell } from '@/components/workspace/AppShell';
import { createFileRoute } from '@tanstack/react-router';
import ExcelJS from 'exceljs';
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;

function SewagePumpPage() {
  const { project, forceSaveToCloud } = useWorkspace();

  // Inputs
  const [inflow, setInflow] = useState<number>(30); // GPM
  const [cycle, setCycle] = useState<number>(5); // minutes
  const [starts, setStarts] = useState<number>(6); // max starts per hour
  const [lift, setLift] = useState<number>(15); // ft
  const [hf, setHf] = useState<number>(5); // ft
  const [sf, setSf] = useState<number>(20); // safety factor %

  // Load project state
  useEffect(() => {
    if (project) {
      const saved = localStorage.getItem(`sewagePump_${project.id}`);
      if (saved) {
        try {
          const p = JSON.parse(saved);
          setInflow(p.inflow ?? 30);
          setCycle(p.cycle ?? 5);
          setStarts(p.starts ?? 6);
          setLift(p.lift ?? 15);
          setHf(p.hf ?? 5);
          setSf(p.sf ?? 20);
        } catch (e) {
          console.error("Failed to parse saved Sewage Pump data:", e);
        }
      }
      if (project?.id) setLoadedProjectId(project.id); else setLoadedProjectId("loaded");
    }
  }, [project]);

  // Handle changes and mark dirty
  const hc = (setter: React.Dispatch<React.SetStateAction<number>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(parseFloat(e.target.value) || 0);
    dirtyStore.set(true);
  };

  const saveCalc = () => {
    if (!project) {
      alert("No project selected.");
      return;
    }
    const data = { inflow, cycle, starts, lift, hf, sf };
    localStorage.setItem(`sewagePump_${project.id}`, JSON.stringify(data));
    dirtyStore.set(false);
    if (forceSaveToCloud) forceSaveToCloud();

    alert("Sewage Pump calculation saved successfully.");
  };

  // Calculations
  // Pump Duty Flow (Q_pump >= 2 * Q_avg to ensure wet well drawdown)
  const pumpGpm = inflow * 2;
  // Total Dynamic Head = (Static Lift + Friction Head) * (1 + Safety Factor / 100)
  const baseHead = lift + hf;
  const tdh = baseHead * (1 + sf / 100);
  // Wet Well Active Volume = Q_avg * t_cycle / 4 (min 10 min cycle time technically, but we use the input cycle)
  const activeVolume = (pumpGpm * cycle) / 4;
  // Motor Power (kW) = Q * H / 3960 * 0.7457 / 0.55 (efficiency assumed 55%)
  const powerKW = (pumpGpm * tdh * 0.7457) / (3960 * 0.55);

  const exportToExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sewage Pump Sizing');

    // Title Block
    ws.mergeCells('A1:E1');
    ws.getCell('A1').value = 'SEWAGE PUMP SIZING CALCULATION REPORT';
    ws.getCell('A1').font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    ws.addRow([]);
    ws.addRow(['PARAMETER', 'VALUE', 'UNIT', 'FORMULA', 'DESCRIPTION']);
    const headerRow = ws.getRow(3);
    headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    const data = [
      ['Peak Sewage Inflow', inflow, 'GPM', 'User Input', 'Average inflow rate'],
      ['Cycle Time', cycle, 'min', 'User Input', 'Desired pump cycle time'],
      ['Pump Duty Capacity', pumpGpm.toFixed(1), 'GPM', 'Q_inflow  2', 'Required pump flow rate to draw down well'],
      ['Static Lift', lift, 'ft', 'User Input', 'Invert to discharge elevation difference'],
      ['Friction Head', hf, 'ft', 'User Input', 'Friction losses in piping'],
      ['Safety Factor', sf, '%', 'User Input', 'Additional margin for head'],
      ['Total Dynamic Head (TDH)', tdh.toFixed(1), 'ft', '(Lift + Hf)  (1 + SF/100)', 'Total calculated head for pump'],
      ['Wet Well Active Volume', activeVolume.toFixed(1), 'Gal', '(Q_pump  Cycle) / 4', 'Required active storage volume'],
      ['Motor Power', powerKW.toFixed(2), 'kW', 'Q  H  0.7457 / (3960  )', 'Estimated electrical power (55% eff)']
    ];

    data.forEach(row => {
      const added = ws.addRow(row);
      added.font = { name: 'Segoe UI', size: 10 };
    });

    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 15;
    ws.getColumn(3).width = 10;
    ws.getColumn(4).width = 30;
    ws.getColumn(5).width = 40;

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), 'Sewage_Pump_Sizing.xlsx');
  };

  
  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = { inflow, cycle, starts, lift, hf, sf };
      localStorage.setItem(`sewagePump_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, inflow, cycle, starts, lift, hf, sf]);

  return (
    <AppShell title="Sewage Pump Sizing">
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Calculator className="w-6 h-6 text-emerald-500" />
          Sewage Pump Sizing
        </h1>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button onClick={saveCalc} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium">
            <Save className="w-4 h-4" />
            Save Calculation
          </button>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-800 text-sm">
        Size sewage ejector or submersible sump pump for basement or low-level drainage. Calculates required pump capacity, sump volume, and cycle time.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-emerald-500 p-4 border-b border-emerald-600 flex items-center gap-2 text-white">
            <Info className="w-5 h-5" />
            <h2 className="font-semibold">Flow &amp; Sump Inputs</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Peak sewage inflow rate (GPM)</label>
              <input type="number" min="0" className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" value={inflow} onChange={hc(setInflow)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Desired pump cycle time (minutes)</label>
              <input type="number" min="0" step="0.5" className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" value={cycle} onChange={hc(setCycle)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Minimum starts per hour (max)</label>
              <input type="number" min="1" max="20" className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" value={starts} onChange={hc(setStarts)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Static lift (invert to discharge) (ft)</label>
              <input type="number" min="0" className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" value={lift} onChange={hc(setLift)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Friction head in discharge pipe (ft)</label>
              <input type="number" min="0" className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" value={hf} onChange={hc(setHf)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Safety factor (%)</label>
              <input type="number" min="0" className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" value={sf} onChange={hc(setSf)} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-emerald-600 p-4 border-b border-emerald-700 flex items-center gap-2 text-white">
            <Calculator className="w-5 h-5" />
            <h2 className="font-semibold">Pump Duty &amp; Results</h2>
          </div>
          <div className="p-5 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Capacity</div>
                <div className="text-2xl font-black text-emerald-600">{pumpGpm.toFixed(1)}</div>
                <div className="text-xs text-slate-500 font-medium">GPM</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Head</div>
                <div className="text-2xl font-black text-emerald-600">{tdh.toFixed(1)}</div>
                <div className="text-xs text-slate-500 font-medium">ft w.g.</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Wet Well Active Vol.</span>
                <span className="font-bold text-slate-800">{activeVolume.toFixed(1)} Gal</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Motor Power</span>
                <span className="font-bold text-slate-800">{powerKW.toFixed(2)} kW</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </AppShell>
  );
}


export const Route = createFileRoute("/plumbing-sewage-pump")({
  head: () => ({
    meta: [
      { title: "Sewage Pump — MEP Calc" },
    ],
  }),
  component: SewagePumpPage,
});
