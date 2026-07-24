import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { Download, Save, Trash2, Plus, Info, Calculator } from "lucide-react";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";

export const Route = createFileRoute("/plumbing-storm-water")({
  head: () => ({
    meta: [
      { title: "Storm Water Sizing — MEP Calc" },
      { name: "description", content: "Calculate storm water runoff flow rate using the Rational Method." },
    ],
  }),
  component: StormWaterPage,
});

interface CatchmentRow {
  id: string;
  name: string;
  area: number;
  surface: string;
  coef: number;
  intensity: number;
}

const SURFACE_COEFS: Record<string, number> = {
  "asphalt": 0.95,
  "brick": 0.85,
  "concrete": 0.95,
  "sandy_soil": 0.20,
  "clay_soil": 0.85,
  "agricultural": 0.30
};

const SURFACE_LABELS: Record<string, string> = {
  "asphalt": "Asphalt (0.95)",
  "brick": "Brick (0.85)",
  "concrete": "Concrete (0.95)",
  "sandy_soil": "Sandy Soil (0.20)",
  "clay_soil": "Clay Soil (0.85)",
  "agricultural": "Agricultural (0.30)"
};

function StormWaterPage() {
  const { project } = useWorkspace();
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  
  // Schedule state
  const [rows, setRows] = useState<CatchmentRow[]>([
    { id: "1", name: "Main Roof Area", area: 1200, surface: "concrete", coef: 0.95, intensity: 50 },
    { id: "2", name: "Pool Deck", area: 450, surface: "brick", coef: 0.85, intensity: 50 }
  ]);

  // Form inputs for new entry
  const [newName, setNewName] = useState("New Catchment");
  const [newArea, setNewArea] = useState("500");
  const [newSurface, setNewSurface] = useState("concrete");
  const [newIntensity, setNewIntensity] = useState("50");

  // Load project state on mount or project switch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`mep_storm_water_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.rows) setRows(data.rows);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
      } else {
        // Defaults
        setRows([
          { id: "1", name: "Main Roof Area", area: 1200, surface: "concrete", coef: 0.95, intensity: 50 },
          { id: "2", name: "Pool Deck", area: 450, surface: "brick", coef: 0.85, intensity: 50 }
        ]);
        setUnitSystem("si");
      }
    } catch (e) {
      console.error(e);
    }
  }, [project.id]);

  const saveState = (updatedRows = rows, updatedUnit = unitSystem) => {
    try {
      localStorage.setItem(`mep_storm_water_calc_${project.id}`, JSON.stringify({
        rows: updatedRows,
        unitSystem: updatedUnit
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = () => {
    saveState();
    dirtyStore.set(false);
    toast.success("Storm water calculation saved successfully!");
  };

  const handleAddRow = () => {
    const areaVal = parseFloat(newArea) || 0;
    const intensityVal = parseFloat(newIntensity) || 0;
    const coef = SURFACE_COEFS[newSurface] || 0.9;
    
    if (areaVal <= 0) {
      toast.error("Please enter a valid area.");
      return;
    }
    if (intensityVal <= 0) {
      toast.error("Please enter a valid rainfall intensity.");
      return;
    }

    const newRow: CatchmentRow = {
      id: Math.random().toString(36).substring(2, 9),
      name: newName,
      area: areaVal,
      surface: newSurface,
      coef: coef,
      intensity: intensityVal
    };

    const updated = [...rows, newRow];
    setRows(updated);
    saveState(updated);
    dirtyStore.set(true);
    toast.success("Catchment area added.");
  };

  const handleDeleteRow = (id: string) => {
    const updated = rows.filter(r => r.id !== id);
    setRows(updated);
    saveState(updated);
    dirtyStore.set(true);
  };

  const handleClearAll = () => {
    setRows([]);
    saveState([]);
    dirtyStore.set(true);
  };

  // Calculations
  const calculatedResults = useMemo(() => {
    const isIp = unitSystem === "ip";
    let totalArea = 0;
    let weightedSumC = 0;
    let totalFlow = 0;

    const items = rows.map(r => {
      // SI equivalents for calculation
      const areaSI = r.area / (isIp ? 10.7639 : 1);
      const intensitySI = r.intensity * (isIp ? 25.4 : 1);
      const flowSI = (r.coef * intensitySI * areaSI) / 3600;
      
      totalArea += r.area;
      weightedSumC += (r.coef * r.area);
      totalFlow += flowSI;

      // Current unit flow
      const flowVal = flowSI * (isIp ? 15.85 : 1);

      return {
        ...r,
        flow: flowVal
      };
    });

    const avgC = totalArea > 0 ? (weightedSumC / totalArea) : 0;
    const finalFlow = totalFlow * (isIp ? 15.85 : 1);

    return {
      items,
      totalArea,
      avgC,
      totalFlow: finalFlow
    };
  }, [rows, unitSystem]);

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Storm Water Calculation");

      worksheet.columns = [
        { header: "No.", key: "index", width: 8 },
        { header: "Catchment / Area Name", key: "name", width: 30 },
        { header: `Area (${unitSystem === "si" ? "m²" : "ft²"})`, key: "area", width: 15 },
        { header: "Surface Type", key: "surface", width: 25 },
        { header: "Runoff Coef (C)", key: "coef", width: 15 },
        { header: `Intensity (${unitSystem === "si" ? "mm/hr" : "in/hr"})`, key: "intensity", width: 15 },
        { header: `Runoff Flow (${unitSystem === "si" ? "L/s" : "GPM"})`, key: "flow", width: 18 }
      ];

      calculatedResults.items.forEach((item, index) => {
        worksheet.addRow({
          index: index + 1,
          name: item.name,
          area: item.area,
          surface: SURFACE_LABELS[item.surface] || item.surface,
          coef: item.coef,
          intensity: item.intensity,
          flow: parseFloat(item.flow.toFixed(2))
        });
      });

      worksheet.addRow({});
      worksheet.addRow({
        name: "Aggregate Totals / Averages",
        area: calculatedResults.totalArea,
        coef: parseFloat(calculatedResults.avgC.toFixed(2)),
        flow: parseFloat(calculatedResults.totalFlow.toFixed(2))
      });

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(worksheet.rowCount).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `Storm_Water_Sizing_${project.name.replace(/\s+/g, "_")}.xlsx`);
      toast.success("Excel report exported successfully!");
    } catch (e) {
      toast.error("Failed to export Excel report.");
    }
  };

  return (
    <AppShell title="Storm Water Runoff Calculation">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="space-y-2 z-10">
            <h1 className="text-3xl font-extrabold flex items-center gap-2">
              <Calculator className="w-8 h-8 text-[#0A7BC7]" />
              Storm Water Runoff Calculation
            </h1>
            <p className="text-slate-300 text-sm">
              Rational Method Sizing: Q = C × i × A / 3600
            </p>
          </div>
          <div className="flex items-center gap-3 z-10">
            <button
              onClick={() => setUnitSystem(unitSystem === "si" ? "ip" : "si")}
              className="px-4 py-2 border border-slate-700 bg-slate-800/80 rounded-xl hover:bg-slate-700 transition text-xs font-bold uppercase cursor-pointer"
            >
              Toggle Unit System ({unitSystem.toUpperCase()})
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-[#06456F] hover:bg-[#0A7BC7] text-white rounded-xl transition text-xs font-bold uppercase cursor-pointer border-0"
            >
              <Save className="w-4 h-4" />
              Save Calculation
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-200">Runoff Schedule</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 rounded-lg hover:bg-green-100 transition text-[12px] font-bold border-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Excel
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 rounded-lg hover:bg-red-100 transition text-[12px] font-bold border-0 cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-400 font-bold">
                    <th className="py-2.5">Name</th>
                    <th className="py-2.5">Area ({unitSystem === "si" ? "m²" : "ft²"})</th>
                    <th className="py-2.5">Surface</th>
                    <th className="py-2.5">C</th>
                    <th className="py-2.5">Intensity ({unitSystem === "si" ? "mm/hr" : "in/hr"})</th>
                    <th className="py-2.5 text-right">Flow ({unitSystem === "si" ? "L/s" : "GPM"})</th>
                    <th className="py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
                  {/* Entry Row */}
                  <tr className="bg-slate-50/50 dark:bg-zinc-800/20">
                    <td className="py-2 px-1">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full h-8 px-2 border border-slate-200 dark:border-zinc-800 rounded bg-background"
                      />
                    </td>
                    <td className="py-2 px-1">
                      <input
                        type="number"
                        value={newArea}
                        onChange={(e) => setNewArea(e.target.value)}
                        className="w-20 h-8 px-2 border border-slate-200 dark:border-zinc-800 rounded bg-background text-right"
                      />
                    </td>
                    <td className="py-2 px-1">
                      <select
                        value={newSurface}
                        onChange={(e) => setNewSurface(e.target.value)}
                        className="w-32 h-8 px-1 border border-slate-200 dark:border-zinc-800 rounded bg-background"
                      >
                        {Object.keys(SURFACE_LABELS).map(k => (
                          <option key={k} value={k}>{SURFACE_LABELS[k]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-1 text-center font-bold text-slate-600 dark:text-zinc-400">
                      {SURFACE_COEFS[newSurface]}
                    </td>
                    <td className="py-2 px-1">
                      <input
                        type="number"
                        value={newIntensity}
                        onChange={(e) => setNewIntensity(e.target.value)}
                        className="w-16 h-8 px-2 border border-slate-200 dark:border-zinc-800 rounded bg-background text-right"
                      />
                    </td>
                    <td className="py-2 px-1 text-right font-bold text-slate-400">
                      -
                    </td>
                    <td className="py-2 px-1 text-center">
                      <button
                        onClick={handleAddRow}
                        className="p-1 px-2.5 bg-[#06456F] hover:bg-[#0A7BC7] text-white rounded text-[11px] font-bold border-0 cursor-pointer"
                      >
                        Add
                      </button>
                    </td>
                  </tr>

                  {calculatedResults.items.map(row => (
                    <tr key={row.id}>
                      <td className="py-3 font-semibold text-slate-800 dark:text-zinc-200">{row.name}</td>
                      <td className="py-3">{row.area.toFixed(1)}</td>
                      <td className="py-3 text-slate-500 dark:text-zinc-400 capitalize">{row.surface.replace('_', ' ')}</td>
                      <td className="py-3 font-bold text-slate-700 dark:text-zinc-300">{row.coef.toFixed(2)}</td>
                      <td className="py-3">{row.intensity.toFixed(1)}</td>
                      <td className="py-3 text-right font-extrabold text-[#06456F] dark:text-sky-400">
                        {row.flow.toFixed(2)}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="text-red-500 hover:text-red-700 bg-transparent border-0 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-200 border-b border-slate-100 dark:border-zinc-800 pb-3">
                Calculated Totals
              </h2>
              <div className="space-y-3.5 text-sm font-medium">
                <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-zinc-800">
                  <span className="text-slate-500 dark:text-zinc-400">Total Catchments</span>
                  <span className="font-extrabold text-slate-800 dark:text-zinc-200">{rows.length}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-zinc-800">
                  <span className="text-slate-500 dark:text-zinc-400">Total Runoff Area</span>
                  <span className="font-extrabold text-slate-800 dark:text-zinc-200">
                    {calculatedResults.totalArea.toFixed(1)} {unitSystem === "si" ? "m²" : "ft²"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-zinc-800">
                  <span className="text-slate-500 dark:text-zinc-400">Weighted Coef (C_avg)</span>
                  <span className="font-extrabold text-slate-800 dark:text-zinc-200">
                    {calculatedResults.avgC.toFixed(2)}
                  </span>
                </div>
                <div className="p-4 bg-blue-50/40 dark:bg-orange-950/20 border border-blue-100 dark:border-blue-900/40 rounded-2xl">
                  <div className="text-[11.5px] font-bold text-[#06456F] dark:text-sky-300 uppercase tracking-wider mb-1">
                    Total Runoff Flow
                  </div>
                  <div className="text-2xl font-extrabold text-[#06456F] dark:text-sky-400">
                    {calculatedResults.totalFlow.toFixed(2)} {unitSystem === "si" ? "L/s" : "GPM"}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 flex items-start gap-3">
              <Info className="w-5 h-5 text-[#0A7BC7] shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-400">
                <div className="font-bold text-slate-700 dark:text-zinc-300">Engineering Standards:</div>
                <div className="leading-relaxed">
                  Based on the **Rational Method** for drainage design. Runoff coefficients range from 0.20 (sandy soil) up to 0.95 (asphalt / concrete surfaces).
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
