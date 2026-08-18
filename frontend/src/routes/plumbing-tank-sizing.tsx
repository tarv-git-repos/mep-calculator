import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import React, { useState, useEffect } from 'react';
import { Calculator, Save, AlertCircle, Info, Download, Droplet } from 'lucide-react';
import { useWorkspace } from '@/lib/workspace-store';
import { dirtyStore } from '@/lib/dirty-store';
import { AppShell } from '@/components/workspace/AppShell';
import { createFileRoute } from '@tanstack/react-router';
import ExcelJS from 'exceljs';
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;

function TankSizingPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, forceSaveToCloud } = useWorkspace();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Inputs
  const [daily, setDaily] = useState<number>(5000); // gal
  const [days, setDays] = useState<number>(1); // days
  const [peak, setPeak] = useState<number>(40); // GPM
  const [pump, setPump] = useState<number>(30); // GPM

  // Load project state
  useEffect(() => {
    if (!project?.id) return;
    if (project) {
      const saved = localStorage.getItem(`tankSizing_${project.id}`);
      if (saved) {
        try {
          const p = JSON.parse(saved);
          setDaily(p.daily ?? 5000);
          setDays(p.days ?? 1);
          setPeak(p.peak ?? 40);
          setPump(p.pump ?? 30);
        } catch (e) {
          console.error("Failed to parse saved Tank Sizing data:", e);
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
    const data = { daily, days, peak, pump };
    localStorage.setItem(`tankSizing_${project.id}`, JSON.stringify(data));
    dirtyStore.set(false);
    if (forceSaveToCloud) forceSaveToCloud();

    alert("Tank Sizing calculation saved successfully.");
  };

  // Calculations (Native Gallons and GPM)
  const storage = daily * days; // gal
  const breakTank = peak * 30; // 30 mins peak in gal
  const recommended = Math.max(storage, breakTank); // gal
  const fillTime = pump > 0 ? recommended / pump : 0; // minutes

  const exportToExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Tank Sizing');

    // Title Block
    ws.mergeCells('A1:E1');
    ws.getCell('A1').value = 'TANK SIZING CALCULATION REPORT';
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
      ['Daily Water Demand', daily, 'gal', 'User Input', 'Total estimated daily demand'],
      ['Storage Duration', days, 'days', 'User Input', 'Number of days for storage'],
      ['Peak Flow Rate', peak, 'GPM', 'User Input', 'Peak instantaneous flow rate'],
      ['Pump Fill Rate', pump, 'GPM', 'User Input', 'Rate at which the tank is filled'],
      ['Storage Volume', storage, 'gal', 'Daily  Days', 'Volume needed for steady consumption'],
      ['Break Tank (30-min peak)', breakTank, 'gal', 'Peak  30', 'Volume needed for 30 minutes of peak flow'],
      ['Recommended Capacity', recommended, 'gal', 'Max(Storage, Break)', 'Recommended tank capacity'],
      ['Pump Fill Time', fillTime.toFixed(1), 'min', 'Capacity / Pump Rate', 'Time to fill the tank from empty']
    ];

    data.forEach(row => {
      const added = ws.addRow(row);
      added.font = { name: 'Segoe UI', size: 10 };
    });

    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 15;
    ws.getColumn(3).width = 10;
    ws.getColumn(4).width = 25;
    ws.getColumn(5).width = 45;

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), 'Tank_Sizing.xlsx');
  };

  
  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = { daily, days, peak, pump };
      localStorage.setItem(`tankSizing_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, daily, days, peak, pump]);

  return (
    <AppShell title="Domestic Water Tank Sizing">
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Droplet className="w-6 h-6 text-emerald-500" />
          Tank Sizing
        </h1>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={saveCalc} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium">
            <Save className="w-4 h-4" />
            Save Calculation
          </button>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-800 text-sm">
        Calculate required water storage tank capacity based on daily demand, peak flow, and storage duration. Uses Storage Demand Method.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-emerald-500 p-4 border-b border-emerald-600 flex items-center gap-2 text-white">
            <Info className="w-5 h-5" />
            <h2 className="font-semibold">Inputs</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Daily Water Demand (gal)</label>
              <input type="number" min="0" className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" value={daily} onChange={hc(setDaily)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Storage Duration (days)</label>
              <input type="number" min="0" step="0.5" className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" value={days} onChange={hc(setDays)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Peak Flow Rate (GPM)</label>
              <input type="number" min="0" className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" value={peak} onChange={hc(setPeak)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Pump Fill Rate (GPM)</label>
              <input type="number" min="0" className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" value={pump} onChange={hc(setPump)} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-emerald-600 p-4 border-b border-emerald-700 flex items-center gap-2 text-white">
            <Calculator className="w-5 h-5" />
            <h2 className="font-semibold">Tank Sizing Result</h2>
          </div>
          <div className="p-5 space-y-6">
            <div className="bg-slate-50 p-4 rounded-lg border border-emerald-200 text-center shadow-inner">
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Recommended Capacity</div>
              <div className="text-3xl font-black text-emerald-700">{recommended.toLocaleString()}</div>
              <div className="text-sm text-emerald-600 font-medium mt-1">Gallons</div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Storage Volume</span>
                <span className="font-bold text-slate-800">{storage.toLocaleString()} gal</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Break Tank (30-min peak)</span>
                <span className="font-bold text-slate-800">{breakTank.toLocaleString()} gal</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Pump Fill Time</span>
                <span className="font-bold text-slate-800">{fillTime.toFixed(1)} min</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </AppShell>
  );
}


export const Route = createFileRoute("/plumbing-tank-sizing")({
  head: () => ({
    meta: [
      { title: "Tank Sizing — MEP Calc" },
    ],
  }),
  component: TankSizingPage,
});
