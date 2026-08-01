import React, { useState, useEffect } from 'react';
import { Calculator, Save, AlertCircle, Info, Settings, List, Plus, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/lib/workspace-store';
import { dirtyStore } from '@/lib/dirty-store';
import { AppShell } from '@/components/workspace/AppShell';
import { createFileRoute } from '@tanstack/react-router';

const drainFxDef = [
  { name: 'WC', dfu: 4, val: 0 },
  { name: 'Lavatory', dfu: 1, val: 2 },
  { name: 'Bathtub/Shower', dfu: 2, val: 2 },
  { name: 'Kitchen Sink', dfu: 2, val: 1 },
  { name: 'Dishwasher', dfu: 2, val: 0 },
  { name: 'Clothes Washer', dfu: 3, val: 0 },
  { name: 'Floor Drain (2")', dfu: 2, val: 0 },
  { name: 'Urinal', dfu: 4, val: 0 }
];

function DrainagePage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const [fixtures, setFixtures] = useState(drainFxDef);
  const [drainType, setDrainType] = useState<'branch' | 'stack' | 'building'>('branch');
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // State loading
  useEffect(() => {
    if (project?.id) {
      try {
        const saved = localStorage.getItem(`drainage_${project.id}`);
        if (saved) {
          const p = JSON.parse(saved);
          setFixtures(p.fixtures ?? drainFxDef);
          setDrainType(p.drainType ?? 'branch');
        }
      } catch (e) {
        console.error(e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      localStorage.setItem(`drainage_${project.id}`, JSON.stringify({
        fixtures, drainType
      }));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, fixtures, drainType]);

  const saveState = () => {
    if (project?.id) {
      localStorage.setItem(`drainage_${project.id}`, JSON.stringify({
        fixtures, drainType
      }));
      dirtyStore.set(true);
      if (forceSaveToCloud) forceSaveToCloud();
    }
  };

  const handleSave = () => {
    saveState();
    alert('Calculation saved successfully!');
  };

  const adjFx = (index: number, d: number) => {
    const newFx = [...fixtures];
    newFx[index].val = Math.max(0, newFx[index].val + d);
    setFixtures(newFx);
  };

  const branchSize = (dfu: number) => {
    if(dfu<=1) return 2;
    if(dfu<=3) return 3;
    if(dfu<=12) return 4;
    if(dfu<=160) return 6;
    if(dfu<=360) return 8;
    return 10;
  };

  const stackSize = (dfu: number) => {
    if(dfu<=2) return 2;
    if(dfu<=8) return 3;
    if(dfu<=50) return 4;
    if(dfu<=256) return 6;
    if(dfu<=600) return 8;
    if(dfu<=1380) return 10;
    return 12;
  };

  const total = fixtures.reduce((acc, f) => acc + (f.dfu * f.val), 0);
  
  let size;
  if(drainType === 'branch') size = branchSize(total);
  else if(drainType === 'stack') size = stackSize(total);
  else { size = stackSize(total); if(size < 4) size = 4; }

  const slope = drainType === 'branch' ? (size < 3 ? '20.8 mm/m (¼"/ft)' : '10.4 mm/m (⅛"/ft)') : 'N/A (vertical)';

  return (
    <AppShell title="Drainage Pipe Sizing">
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <List className="w-6 h-6 text-blue-500" />
            Drainage Pipe Sizing
          </h1>
          <p className="text-gray-500 text-sm mt-1">Determine branch and stack sizes based on Fixture Units (DFU)</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium"
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
              Pipe Type & Fixtures
            </h2>
          </div>
          <div className="p-5 space-y-5">
            <div className="flex gap-3">
              {(['branch', 'stack', 'building'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setDrainType(t)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                    drainType === t 
                    ? 'bg-blue-50 border-blue-500 text-blue-700' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'building' ? 'Drain' : ''}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {fixtures.map((f, i) => (
                <div key={i} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors bg-white">
                  <div>
                    <div className="font-semibold text-sm text-gray-800">{f.name}</div>
                    <div className="text-xs text-gray-500">DFU: {f.dfu} each</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => adjFx(i, -1)} className="w-8 h-8 flex items-center justify-center rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 text-lg font-medium">−</button>
                    <span className="w-6 text-center font-bold text-gray-800">{f.val}</span>
                    <button onClick={() => adjFx(i, 1)} className="w-8 h-8 flex items-center justify-center rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 text-lg font-medium">+</button>
                  </div>
                </div>
              ))}
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
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Total DFU</span>
                <span className="font-semibold text-gray-900">{total} DFU</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Required Minimum Size</span>
                <span className="font-bold text-blue-700 text-lg">{size}" NPS ({(size*25.4).toFixed(0)} mm)</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Required Slope</span>
                <span className="font-semibold text-gray-900">{slope}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </AppShell>
  );
}


export const Route = createFileRoute("/plumbing-drainage")({
  head: () => ({
    meta: [
      { title: "Drainage — MEP Calc" },
    ],
  }),
  component: DrainagePage,
});
