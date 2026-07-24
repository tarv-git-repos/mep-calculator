import React, { useState, useEffect } from 'react';
import { Calculator, Save, AlertCircle, Info, Download, Flame } from 'lucide-react';
import { useWorkspace } from '@/lib/workspace-store';
import { dirtyStore } from '@/lib/dirty-store';
import { AppShell } from '@/components/workspace/AppShell';
import { createFileRoute } from '@tanstack/react-router';
import ExcelJS from 'exceljs';
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;

function GasTankPage() {
  const { project } = useWorkspace();

  // Inputs
  const [gasType, setGasType] = useState<'ng' | 'lpg'>('ng');
  const [resDemandConst, setResDemandConst] = useState<number>(0.19);
  const [resKitchens, setResKitchens] = useState<number>(0);
  const [retDemandConst, setRetDemandConst] = useState<number>(52);
  const [retKitchens, setRetKitchens] = useState<number>(0);
  const [storageCapacity, setStorageCapacity] = useState<number>(30000);

  // Load project state
  useEffect(() => {
    if (project) {
      const saved = localStorage.getItem(`gasTank_${project.id}`);
      if (saved) {
        try {
          const p = JSON.parse(saved);
          setGasType(p.gasType || 'ng');
          setResDemandConst(p.resDemandConst ?? 0.19);
          setResKitchens(p.resKitchens ?? 0);
          setRetDemandConst(p.retDemandConst ?? 52);
          setRetKitchens(p.retKitchens ?? 0);
          setStorageCapacity(p.storageCapacity ?? 30000);
        } catch (e) {
          console.error("Failed to parse saved Gas Tank data:", e);
        }
      }
    }
  }, [project]);

  // Handle changes and mark dirty
  const hc = (setter: React.Dispatch<React.SetStateAction<number>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(parseFloat(e.target.value) || 0);
    dirtyStore.set(true);
  };

  const handleGasType = (type: 'ng' | 'lpg') => {
    setGasType(type);
    dirtyStore.set(true);
  };

  const saveCalc = () => {
    if (!project) {
      alert("No project selected.");
      return;
    }
    const data = { gasType, resDemandConst, resKitchens, retDemandConst, retKitchens, storageCapacity };
    localStorage.setItem(`gasTank_${project.id}`, JSON.stringify(data));
    dirtyStore.set(false);
    alert("Gas Tank calculation saved successfully.");
  };

  // Calculations
  const resConsumption = resKitchens * resDemandConst; // m3/day
  const retConsumption = retKitchens * retDemandConst; // m3/day
  
  const totalDemandNg = (resConsumption + retConsumption) * 1000; // L/day
  const totalDemandLpg = totalDemandNg / 2.67; // L/day
  
  const activeDemand = gasType === 'ng' ? totalDemandNg : totalDemandLpg;
  
  const tankCapacity = activeDemand / 0.7; // L/week (70% Usable Volume)
  const usableGas = tankCapacity * 0.7 * 0.8; // Litres (20% refill reserve)

  const exportToExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Gas Storage Sizing');

    // Title Block
    ws.mergeCells('A1:E1');
    ws.getCell('A1').value = 'GAS STORAGE TANK CAPACITY SIZING REPORT';
    ws.getCell('A1').font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF39632' } };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    ws.addRow([]);
    ws.addRow(['PARAMETER', 'VALUE', 'UNIT', 'FORMULA / REFERENCE', 'DESCRIPTION']);
    const headerRow = ws.getRow(3);
    headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    const data = [
      ['Gas Type Selected', gasType === 'ng' ? 'Natural Gas' : 'LPG Gas', '-', 'User Choice', 'Primary fuel system selection'],
      ['Residential Kitchens', resKitchens, 'Nos.', 'User Input', 'Total number of residential units'],
      ['Consumption per Res. Kitchen', resDemandConst, 'm3/day', 'Engineering Constant', 'Average daily consumption per unit'],
      ['Total Residential Consumption', resConsumption, 'm3/day', 'Kitchens  Constant', 'Daily volumetric demand (Residential)'],
      ['Retail Kitchens (F&B)', retKitchens, 'Nos.', 'User Input', 'Total number of retail food & beverage kitchens'],
      ['Consumption per Retail Kitchen', retDemandConst, 'm3/day', 'Engineering Constant', 'Average daily demand per commercial kitchen'],
      ['Total Retail Consumption', retConsumption, 'm3/day', 'Kitchens  Constant', 'Daily volumetric demand (Retail)'],
      ['Total Gas Demand (Natural Gas)', totalDemandNg.toFixed(1), 'L/day', '(Res + Ret)  1000', 'Combined natural gas volumetric requirement'],
      ['Total Gas Demand (LPG Gas)', totalDemandLpg.toFixed(1), 'L/day', 'NG Demand / 2.67', 'LPG equivalent volumetric daily demand'],
      ['Active Total Gas Demand', activeDemand.toFixed(1), 'L/day', 'Based on Gas Selection', 'Volumetric daily demand of the chosen fuel type'],
      ['Gas Tank Capacity (70% Usable)', tankCapacity.toFixed(1), 'L/week', 'Active Demand / 0.7', 'Recommended weekly storage tank size'],
      ['Installed Storage Capacity', storageCapacity, 'Litres', 'User Input', 'Actual physical volume of the selected tank'],
      ['Usable Gas from Tank', usableGas.toFixed(1), 'Litres', 'Tank Capacity  0.7  0.8', '70% usable volume, 20% refill reserve retained']
    ];

    data.forEach(row => {
      const added = ws.addRow(row);
      added.font = { name: 'Segoe UI', size: 10 };
    });

    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 15;
    ws.getColumn(3).width = 10;
    ws.getColumn(4).width = 30;
    ws.getColumn(5).width = 45;

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), 'Gas_Storage_Tank_Capacity_Calculation_Report.xlsx');
  };

  return (
    <AppShell title="Gas Storage Capacity">
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Flame className="w-6 h-6 text-[#0A7BC7]" />
          Gas Storage Tank Sizing
        </h1>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button onClick={saveCalc} className="flex items-center gap-2 px-4 py-2 bg-[#06456F] text-white rounded-lg hover:bg-orange-700 transition-colors font-medium">
            <Save className="w-4 h-4" />
            Save Calculation
          </button>
        </div>
      </div>

      <div className="bg-blue-50/40 border border-blue-100 rounded-lg p-4 text-[#06456F] text-sm">
        Calculate required gas storage tank capacity and sizing based on residential and retail kitchen average daily demand, with support for Natural Gas and LPG options.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-[#0A7BC7] p-4 border-b border-orange-600 flex items-center gap-2 text-white">
              <Info className="w-5 h-5" />
              <h2 className="font-semibold">Select Gas Type</h2>
            </div>
            <div className="p-5">
              <div className="flex gap-3">
                <button onClick={() => handleGasType('ng')} className={`flex-1 py-2 px-4 rounded-lg border-2 font-semibold transition-all ${gasType === 'ng' ? 'border-[#0A7BC7] bg-blue-50/40 text-orange-700' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-100'}`}>Natural Gas</button>
                <button onClick={() => handleGasType('lpg')} className={`flex-1 py-2 px-4 rounded-lg border-2 font-semibold transition-all ${gasType === 'lpg' ? 'border-[#0A7BC7] bg-blue-50/40 text-orange-700' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-100'}`}>LPG</button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-[#0A7BC7] p-4 border-b border-orange-600 flex items-center gap-2 text-white justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                <h2 className="font-semibold">Consumption (Kitchens)</h2>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Residential Kitchens</span>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    Res. Constant: 
                    <input type="number" step="0.01" className="w-16 px-1 py-0.5 border border-slate-300 rounded text-center outline-none focus:border-orange-400" value={resDemandConst} onChange={hc(setResDemandConst)} />
                    m³/day
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Number of Kitchens (Residential)</label>
                  <input type="number" min="0" className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A7BC7] focus:border-[#0A7BC7] outline-none" value={resKitchens} onChange={hc(setResKitchens)} />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Retail Food &amp; Beverage</span>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    Retail Constant: 
                    <input type="number" className="w-16 px-1 py-0.5 border border-slate-300 rounded text-center outline-none focus:border-orange-400" value={retDemandConst} onChange={hc(setRetDemandConst)} />
                    m³/day
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Number of Kitchens (F&amp;B Retail)</label>
                  <input type="number" min="0" className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A7BC7] focus:border-[#0A7BC7] outline-none" value={retKitchens} onChange={hc(setRetKitchens)} />
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-[#0A7BC7] p-4 border-b border-orange-600 flex items-center gap-2 text-white">
              <Calculator className="w-5 h-5" />
              <h2 className="font-semibold">Storage Settings</h2>
            </div>
            <div className="p-5">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Storage Capacity (Installed Tank) (Litres)</label>
                <input type="number" min="0" className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A7BC7] focus:border-[#0A7BC7] outline-none" value={storageCapacity} onChange={hc(setStorageCapacity)} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
          <div className="bg-[#06456F] p-4 border-b border-orange-700 flex items-center justify-center text-white">
            <h2 className="font-bold text-lg">Project Results Panel</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Res. Gas Consumption</div>
                <div className="text-xl font-black text-[#0A7BC7]">{resConsumption.toFixed(2)}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">m³/day</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Retail Gas Consumption</div>
                <div className="text-xl font-black text-[#0A7BC7]">{retConsumption.toFixed(2)}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">m³/day</div>
              </div>
            </div>
            
            <div className="mt-4 bg-blue-50/40 p-5 rounded-lg border border-blue-100 text-center shadow-inner">
              <div className="text-[10px] font-bold text-orange-700 uppercase tracking-wider mb-2">Total Gas Demand ({gasType === 'ng' ? 'Natural Gas' : 'LPG Gas'})</div>
              <div className="text-3xl font-black text-[#06456F]">{activeDemand.toFixed(1)}</div>
              <div className="text-xs text-orange-700 font-medium mt-2">L/day</div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Gas Tank Capacity</div>
                <div className="text-xl font-black text-slate-800">{tankCapacity.toFixed(1)}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">L/week</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Storage Capacity</div>
                <div className="text-xl font-black text-slate-800">{storageCapacity.toLocaleString()}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">Litres</div>
              </div>
              <div className="col-span-2 bg-sky-50 p-4 rounded-lg border border-sky-100 text-center">
                <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider mb-2">Usable Gas From Tank</div>
                <div className="text-2xl font-black text-sky-600">{usableGas.toFixed(1)}</div>
                <div className="text-[11px] text-sky-600 font-medium mt-1">Litres</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </AppShell>
  );
}


export const Route = createFileRoute("/plumbing-gas-tank")({
  head: () => ({
    meta: [
      { title: "Gas Tank — MEP Calc" },
    ],
  }),
  component: GasTankPage,
});
