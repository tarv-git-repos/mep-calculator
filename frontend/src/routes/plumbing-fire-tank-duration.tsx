import React, { useState, useEffect } from 'react';
import { Calculator, AlertTriangle, CheckCircle, Info, Settings, Save, AlertCircle } from 'lucide-react';
import { useWorkspace } from '@/lib/workspace-store';
import { dirtyStore } from '@/lib/dirty-store';
import { AppShell } from '@/components/workspace/AppShell';
import { createFileRoute } from '@tanstack/react-router';

function FireTankDurationPage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const [unit, setUnit] = useState<'ip' | 'si'>('si');
  const [demand, setDemand] = useState<number>(1892.7); // L/min (500 GPM)
  const [durationSel, setDurationSel] = useState<string>('60');
  const [customDur, setCustomDur] = useState<number>(60);
  const [tankCap, setTankCap] = useState<number>(120000); // L
  const [refillRate, setRefillRate] = useState<number>(0); // L/min
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // State loading
  useEffect(() => {
    if (project?.id) {
      try {
        const saved = localStorage.getItem(`fireTankDuration_${project.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setUnit(parsed.unit ?? 'si');
          setDemand(parsed.demand ?? 1892.7);
          setDurationSel(parsed.durationSel ?? '60');
          setCustomDur(parsed.customDur ?? 60);
          setTankCap(parsed.tankCap ?? 120000);
          setRefillRate(parsed.refillRate ?? 0);
        }
      } catch (e) {
        console.error(e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      localStorage.setItem(`fireTankDuration_${project.id}`, JSON.stringify({
        unit, demand, durationSel, customDur, tankCap, refillRate
      }));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, unit, demand, durationSel, customDur, tankCap, refillRate]);

  const saveState = () => {
    if (project?.id) {
      localStorage.setItem(`fireTankDuration_${project.id}`, JSON.stringify({
        unit, demand, durationSel, customDur, tankCap, refillRate
      }));
      dirtyStore.set(true);
      if (forceSaveToCloud) forceSaveToCloud();
    }
  };

  const handleSave = () => {
    saveState();
    alert('Calculation saved successfully!');
  };

  const isIP = unit === 'ip';
  
  // IP Conversions for calculation if needed, but doing directly:
  const duration = durationSel === 'custom' ? customDur : parseFloat(durationSel) || 60;
  
  const reqVol = demand * duration;
  const actualDurMin = demand > 0 ? tankCap / demand : 0;
  const refillMin = refillRate > 0 ? tankCap / refillRate : Infinity;
  const ok = tankCap >= reqVol;
  
  const shortfall = reqVol > tankCap ? reqVol - tankCap : 0;
  
  const formatVol = (v: number) => isIP ? `${(v * 0.264172).toFixed(0)} gal` : `${v.toFixed(0)} L`;
  const formatFlow = (v: number) => isIP ? `${(v * 0.264172).toFixed(1)} GPM` : `${v.toFixed(1)} L/min`;

  return (
    <AppShell title="Fire Tank Duration">
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-[#0A7BC7]" />
            Fire Tank Duration
          </h1>
          <p className="text-gray-500 text-sm mt-1">Verify tank capacity against required fire demand duration</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={unit} 
            onChange={(e) => setUnit(e.target.value as 'ip' | 'si')}
            className="border-gray-300 rounded-md text-sm shadow-sm focus:border-[#0A7BC7] focus:ring-[#0A7BC7]"
          >
            <option value="si">SI (L/min, L)</option>
            <option value="ip">IP (GPM, gal)</option>
          </select>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-[#0A7BC7] text-white rounded-md hover:bg-[#06456F] transition-colors shadow-sm text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            Save Calculation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-500" />
              Design Parameters
            </h2>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total System Demand ({isIP ? 'GPM' : 'L/min'})
              </label>
              <input
                type="number"
                value={isIP ? (demand * 0.264172).toFixed(1) : demand}
                onChange={e => setDemand(isIP ? parseFloat(e.target.value) / 0.264172 : parseFloat(e.target.value))}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-[#0A7BC7] focus:border-[#0A7BC7]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Required Duration
              </label>
              <select
                value={durationSel}
                onChange={e => setDurationSel(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-[#0A7BC7] focus:border-[#0A7BC7]"
              >
                <option value="30">30 minutes (Light Hazard)</option>
                <option value="60">60 minutes (Ordinary Hazard)</option>
                <option value="90">90 minutes (Ordinary/Extra Hazard)</option>
                <option value="120">120 minutes (Extra Hazard)</option>
                <option value="custom">Custom duration</option>
              </select>
            </div>
            {durationSel === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Duration (min)
                </label>
                <input
                  type="number"
                  value={customDur}
                  onChange={e => setCustomDur(parseFloat(e.target.value))}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-[#0A7BC7] focus:border-[#0A7BC7]"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tank Actual Capacity ({isIP ? 'gal' : 'L'})
              </label>
              <input
                type="number"
                value={isIP ? (tankCap * 0.264172).toFixed(0) : tankCap}
                onChange={e => setTankCap(isIP ? parseFloat(e.target.value) / 0.264172 : parseFloat(e.target.value))}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-[#0A7BC7] focus:border-[#0A7BC7]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Refill Supply Rate ({isIP ? 'GPM' : 'L/min'}) <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                value={isIP ? (refillRate * 0.264172).toFixed(1) : refillRate}
                onChange={e => setRefillRate(isIP ? parseFloat(e.target.value) / 0.264172 : parseFloat(e.target.value))}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-[#0A7BC7] focus:border-[#0A7BC7]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Info className="w-5 h-5 text-gray-500" />
                Tank Results
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Required Volume</span>
                <span className="font-semibold text-gray-900">{formatVol(reqVol)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Actual Tank Capacity</span>
                <span className="font-semibold text-gray-900">{formatVol(tankCap)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Target Duration</span>
                <span className="font-semibold text-gray-900">{duration} min</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Actual Duration</span>
                <span className={`font-semibold ${actualDurMin < duration ? 'text-red-600' : 'text-gray-900'}`}>{actualDurMin.toFixed(0)} min</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Tank Refill Time</span>
                <span className="font-semibold text-gray-900">
                  {refillMin === Infinity ? 'No refill supply' : `${refillMin.toFixed(0)} min (${(refillMin/60).toFixed(1)} hrs)`}
                </span>
              </div>

              <div className={`p-4 rounded-lg flex items-center gap-3 ${ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {ok ? <CheckCircle className="w-6 h-6 flex-shrink-0" /> : <AlertTriangle className="w-6 h-6 flex-shrink-0" />}
                <div>
                  <div className="font-bold">{ok ? 'ADEQUATE' : 'UNDERSIZED'}</div>
                  <div className="text-sm mt-0.5 opacity-90">
                    {ok ? 'Tank meets the required duration capacity.' : `Increase tank capacity by ${formatVol(shortfall)}.`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!ok && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-red-800 font-semibold text-sm">Tank Undersized</h3>
                  <p className="text-red-700 text-sm mt-1">
                    Tank {formatVol(tankCap)} is {(((reqVol-tankCap)/reqVol)*100).toFixed(0)}% short of required {formatVol(reqVol)}. Increase tank capacity.
                  </p>
                </div>
              </div>
            </div>
          )}

          {refillMin > 480 && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-amber-800 font-semibold text-sm">Slow Refill</h3>
                  <p className="text-amber-700 text-sm mt-1">
                    Refill time {(refillMin/60).toFixed(1)} hrs - slow. Verify mains supply capacity can restore tank within 24 hrs (AHJ requirement may vary).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </AppShell>
  );
}


export const Route = createFileRoute("/plumbing-fire-tank-duration")({
  head: () => ({
    meta: [
      { title: "Fire Tank Duration — MEP Calc" },
    ],
  }),
  component: FireTankDurationPage,
});
