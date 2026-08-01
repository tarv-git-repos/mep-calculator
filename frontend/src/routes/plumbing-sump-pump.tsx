import React, { useState, useEffect } from 'react';
import { Calculator, Save, AlertCircle, Info, Settings, ArrowDown, Droplet, Download } from 'lucide-react';
import { useWorkspace } from '@/lib/workspace-store';
import { dirtyStore } from '@/lib/dirty-store';
import { AppShell } from '@/components/workspace/AppShell';
import { createFileRoute } from '@tanstack/react-router';
import ExcelJS from 'exceljs';
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;

function SumpPumpPage() {
  const { project, forceSaveToCloud } = useWorkspace();

  const [req, setReq] = useState<number>(1000);
  const [time, setTime] = useState<number>(1);
  const [flow, setFlow] = useState<number>(0);

  const [pitFlow, setPitFlow] = useState<number>(5);
  const [pitHold, setPitHold] = useState<number>(5);
  const [longestPipe, setLongestPipe] = useState<number>(15);
  const [propSide, setPropSide] = useState<number>(2);

  const [pipeVert, setPipeVert] = useState<number>(5);
  const [pipeHoriz, setPipeHoriz] = useState<number>(20);
  const [fricFactor, setFricFactor] = useState<number>(0.4);

  const [staticHead, setStaticHead] = useState<number>(5);
  const [presid, setPresid] = useState<number>(1);
  const [suction, setSuction] = useState<number>(0);
  const [sfHead, setSfHead] = useState<number>(10);
  
  const [selectedHead, setSelectedHead] = useState<number>(0);
  const [effMotor, setEffMotor] = useState<number>(85);
  const [effPump, setEffPump] = useState<number>(70);

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // State loading
  useEffect(() => {
    if (project) {
      const saved = localStorage.getItem(`sumpPump_${project.id}`);
      if (saved) {
        const p = JSON.parse(saved);
        setReq(p.req ?? 1000);
        setTime(p.time ?? 1);
        setFlow(p.flow ?? 0);
        setPitFlow(p.pitFlow ?? 5);
        setPitHold(p.pitHold ?? 5);
        setLongestPipe(p.longestPipe ?? 15);
        setPropSide(p.propSide ?? 2);
        setPipeVert(p.pipeVert ?? 5);
        setPipeHoriz(p.pipeHoriz ?? 20);
        setFricFactor(p.fricFactor ?? 0.4);
        setStaticHead(p.staticHead ?? 5);
        setPresid(p.presid ?? 1);
        setSuction(p.suction ?? 0);
        setSfHead(p.sfHead ?? 10);
        setSelectedHead(p.selectedHead ?? 0);
        setEffMotor(p.effMotor ?? 85);
        setEffPump(p.effPump ?? 70);
      }
      if (project?.id) setLoadedProjectId(project.id); else setLoadedProjectId("loaded");
    }
  }, [project]);

  const saveState = () => {
    if (project) {
      localStorage.setItem(`sumpPump_${project.id}`, JSON.stringify({
        req, time, flow, pitFlow, pitHold, longestPipe, propSide, pipeVert, pipeHoriz,
        fricFactor, staticHead, presid, suction, sfHead, selectedHead, effMotor, effPump
      }));
      dirtyStore.set(true);
    }
  };

  
  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = { req, time, flow, pitFlow, pitHold, longestPipe, propSide, pipeVert, pipeHoriz, fricFactor, staticHead, presid, suction, sfHead, selectedHead, effMotor, effPump };
      localStorage.setItem(`sumpPump_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, req, time, flow, pitFlow, pitHold, longestPipe, propSide, pipeVert, pipeHoriz, fricFactor, staticHead, presid, suction, sfHead, selectedHead, effMotor, effPump]);

  const handleSave = () => {
    saveState();
    alert('Calculation saved successfully!');
  };

  // Calcs
  const Q_flow = (req > 0 && time > 0) ? req / (time * 3600) : flow;
  
  const pitVol = (pitFlow * pitHold * 60) / 1000;
  const invertVal = longestPipe > 0 ? (Math.ceil((longestPipe / 90) * 100) / 100) + 0.16 : 0;
  let propDepth = 0;
  if (propSide > 0) {
    const waterDepthRaw = pitVol / (propSide * propSide);
    const waterDepth = waterDepthRaw < 1.0 ? 1.0 : waterDepthRaw;
    propDepth = Math.ceil((waterDepth + invertVal + 0.25) * 100) / 100;
  }

  const L_elbows = (pipeVert + pipeHoriz) * 0.3;
  const L_valves = (pipeVert + pipeHoriz) * 0.3;
  const L_sum = pipeVert + pipeHoriz + L_elbows + L_valves;
  const sf_pipe = 5;
  const L_equiv = Math.ceil((L_sum * (1 + sf_pipe / 100)) / 10) * 10;
  const H_loss = L_equiv * (fricFactor / 100);

  const H_pump_calc = (Math.max(0, (H_loss + staticHead + presid) - suction)) * (1 + sfHead / 100);
  const H_selected = selectedHead > 0 ? selectedHead : H_pump_calc;

  const P_shaft = (Q_flow * H_selected * 100) / (1000 * (effPump/100));
  const P_motor = P_shaft / (effMotor/100);
  const HP = P_motor * 1.34102;

  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sump Pump');

    ws.columns = [
      { header: 'Parameter', key: 'param', width: 30 },
      { header: 'Value', key: 'val', width: 15 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Formula', key: 'form', width: 30 }
    ];

    ws.addRow(['Sump Pump Sizing & Motor Calculation', '', '', '']);
    ws.addRow(['']);
    
    const rows = [
      ['Sump Volumetric Req', req, 'L', ''],
      ['Req Drawdown Time', time, 'Hours', ''],
      ['Calc Flow Rate', Q_flow.toFixed(2), 'L/s', 'Volume / Time'],
      ['Pit Flow', pitFlow, 'L/s', ''],
      ['Pit Hold', pitHold, 'min', ''],
      ['Pit Volume Req', pitVol.toFixed(2), 'm³', ''],
      ['Pipe Invert', invertVal.toFixed(2), 'm', ''],
      ['Pit Depth', propDepth.toFixed(2), 'm', ''],
      ['Total Equiv Length', L_equiv.toFixed(2), 'm', ''],
      ['Friction Loss', H_loss.toFixed(3), 'bar', ''],
      ['TDH Req', H_pump_calc.toFixed(3), 'bar', ''],
      ['Motor Power', P_motor.toFixed(2), 'kW', ''],
      ['Motor HP', HP.toFixed(2), 'HP', '']
    ];

    rows.forEach(r => ws.addRow(r));

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), 'Sump_Pump_Report.xlsx');
  };

  return (
    <AppShell title="Sump Pump Sizing">
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Droplet className="w-6 h-6 text-emerald-500" />
            Sump Pump Sizing
          </h1>
          <p className="text-gray-500 text-sm mt-1">Calculate sump pit volume, flow, head, and motor requirements</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 transition-colors shadow-sm text-sm font-medium border border-emerald-200"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors shadow-sm text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            Save Calculation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Inputs Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-500" />
                Flow & Volume Parameters
              </h2>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Vol Requirement (L)</label>
                <input type="number" value={req} onChange={e => setReq(Number(e.target.value))} className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Drawdown Time (Hrs)</label>
                <input type="number" value={time} onChange={e => setTime(Number(e.target.value))} className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Manual Flow (L/s)</label>
                <input type="number" value={flow} onChange={e => setFlow(Number(e.target.value))} className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50" disabled={req > 0 && time > 0} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <ArrowDown className="w-5 h-5 text-gray-500" />
                Pit Sizing
              </h2>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Flow per Pit (L/s)</label>
                <input type="number" value={pitFlow} onChange={e => setPitFlow(Number(e.target.value))} className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Holding Time (min)</label>
                <input type="number" value={pitHold} onChange={e => setPitHold(Number(e.target.value))} className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Longest Pipe (m)</label>
                <input type="number" value={longestPipe} onChange={e => setLongestPipe(Number(e.target.value))} className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prop. Side (m)</label>
                <input type="number" value={propSide} onChange={e => setPropSide(Number(e.target.value))} className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-500" />
                Piping & Head
              </h2>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vert Pipe (m)</label>
                <input type="number" value={pipeVert} onChange={e => setPipeVert(Number(e.target.value))} className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Horiz Pipe (m)</label>
                <input type="number" value={pipeHoriz} onChange={e => setPipeHoriz(Number(e.target.value))} className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Friction (bar/100m)</label>
                <input type="number" value={fricFactor} onChange={e => setFricFactor(Number(e.target.value))} className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Static Head (bar)</label>
                <input type="number" value={staticHead} onChange={e => setStaticHead(Number(e.target.value))} className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Residual (bar)</label>
                <input type="number" value={presid} onChange={e => setPresid(Number(e.target.value))} className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Suction (bar)</label>
                <input type="number" value={suction} onChange={e => setSuction(Number(e.target.value))} className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Info className="w-5 h-5 text-gray-500" />
                Calculated Results
              </h2>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Design Flow</span>
                <span className="font-semibold text-emerald-700">{Q_flow.toFixed(2)} L/s</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Pit Volume</span>
                <span className="font-semibold text-gray-900">{pitVol.toFixed(2)} m³</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Pipe Invert</span>
                <span className="font-semibold text-gray-900">{invertVal.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Prop Depth</span>
                <span className="font-semibold text-gray-900">{propDepth.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Equiv Pipe Length</span>
                <span className="font-semibold text-gray-900">{L_equiv.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Friction Loss</span>
                <span className="font-semibold text-gray-900">{H_loss.toFixed(3)} bar</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">TDH Calc</span>
                <span className="font-bold text-emerald-700 text-lg">{H_pump_calc.toFixed(3)} bar</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Motor Power</span>
                <span className="font-bold text-emerald-700 text-lg">{P_motor.toFixed(2)} kW / {HP.toFixed(2)} HP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </AppShell>
  );
}


export const Route = createFileRoute("/plumbing-sump-pump")({
  head: () => ({
    meta: [
      { title: "Sump Pump — MEP Calc" },
    ],
  }),
  component: SumpPumpPage,
});
