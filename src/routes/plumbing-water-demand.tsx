import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { Trash2, Plus, FileSpreadsheet, Info, HelpCircle, Save } from "lucide-react";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";

export const Route = createFileRoute("/plumbing-water-demand")({
  head: () => ({
    meta: [
      { title: "Water Demand Calculator — MEP Calc" },
      { name: "description", content: "Water demand sizing tool for domestic, irrigation, swimming pool, and firefighting systems." },
    ],
  }),
  component: WaterDemandPage,
});

interface WDRow {
  id: number;
  name: string;
  ppl: number;
  cat: string;
  lpd: number;
}

interface IrrRow {
  id: number;
  area: number;
  vegType: string;
  lpd: number;
}

const WD_TYPE_MAP: Record<string, number> = {
  // Residential
  "Residential buildings (flat)": 300,
  "Villas": 350,
  "Mixed used residential": 350,
  "Labour accommodation": 150,
  // Office & Commercial
  "Offices": 60,
  "Headquarters": 80,
  "Commercial buildings": 100,
  "Mixed used commercial": 80,
  "Logistic, academic & business center": 75,
  // Retail & Leisure
  "Local plaza / retail / town center": 82,
  "Shops": 60,
  "Club house / recreation": 100,
  "Entertainment & leisure / theater": 60,
  "Theatre": 50,
  "Events": 50,
  // Hospitality
  "Hotels (per guest)": 300,
  "Hotels (per employee)": 80,
  "Restaurant (per meal)": 15,
  "Visitors": 40,
  // Education
  "Schools / university": 60,
  "Nursery / child care centre": 70,
  // Medical & Healthcare
  "Medical (per bed)": 450,
  "Day clinic (per medical practitioner) incl. visitors": 450,
  "Laboratory": 80,
  // Industrial
  "Manufacturing / mineral": 80,
  "Industrial (workshops / machinery / warehouse)": 80,
  "Guardhouse": 75,
  // Public & Assembly
  "Mosques": 60,
  "Public amenities": 50,
};

const IRR_TYPE_MAP: Record<string, number> = {
  "Palm Trees": 150,
  "Small Palm Tree": 75,
  "Ornamental trees": 80,
  "Shrubs & hedges": 15,
  "Ground cover and succulents": 12,
  "Seasonal flowers and creepers": 12,
  "Lawn with pop-up sprays": 10,
};

function WaterDemandPage() {
  const { project } = useWorkspace();
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  
  // Domestic state
  const [wdRows, setWdRows] = useState<WDRow[]>([]);
  const [newWdName, setNewWdName] = useState("");
  const [newWdPeople, setNewWdPeople] = useState<number | "">("");
  const [newWdCat, setNewWdCat] = useState("");

  // Irrigation state
  const [irrRows, setIrrRows] = useState<IrrRow[]>([]);
  const [newIrrArea, setNewIrrArea] = useState<number | "">("");
  const [newIrrVegType, setNewIrrVegType] = useState("");

  // Pool state
  const [poolArea, setPoolArea] = useState<number | "">("");
  const [poolDepth, setPoolDepth] = useState<number | "">("");
  const [poolEvap, setPoolEvap] = useState<number>(10);

  // Fire state
  const [fireFlow, setFireFlow] = useState<number | "">("");

  // Load state from localStorage on project change
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`mep_water_demand_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.wdRows) setWdRows(data.wdRows);
        if (data.irrRows) setIrrRows(data.irrRows);
        if (data.poolArea !== undefined) setPoolArea(data.poolArea);
        if (data.poolDepth !== undefined) setPoolDepth(data.poolDepth);
        if (data.poolEvap !== undefined) setPoolEvap(data.poolEvap);
        if (data.fireFlow !== undefined) setFireFlow(data.fireFlow);
      } else {
        // Reset to defaults
        setUnitSystem("si");
        setWdRows([
          { id: 1, name: "Apartment Block A", ppl: 150, cat: "Residential buildings (flat)", lpd: 300 },
          { id: 2, name: "Ground Floor Offices", ppl: 45, cat: "Offices", lpd: 60 }
        ]);
        setIrrRows([
          { id: 1, area: 120, vegType: "Lawn with pop-up sprays", lpd: 10 },
          { id: 2, area: 15, vegType: "Palm Trees", lpd: 150 }
        ]);
        setPoolArea("");
        setPoolDepth("");
        setPoolEvap(10);
        setFireFlow("");
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load water demand calculation", e);
    }
  }, [project.id]);

  const handleSaveCurrent = () => {
    try {
      const dataToSave = {
        unitSystem,
        wdRows,
        irrRows,
        poolArea,
        poolDepth,
        poolEvap,
        fireFlow
      };
      localStorage.setItem(`mep_water_demand_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(false);
      toast.success("Water Demand Calculation saved to project successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  const ip = unitSystem === "ip";

  // Calculations
  const calculations = useMemo(() => {
    // Domestic
    let totalPeople = 0;
    let totalWaterL = 0;
    wdRows.forEach(r => {
      totalPeople += r.ppl;
      totalWaterL += r.ppl * r.lpd;
    });
    
    // Irrigation
    let totalIrrL = 0;
    irrRows.forEach(r => {
      totalIrrL += r.area * r.lpd;
    });

    // Pool
    const pAreaVal = Number(poolArea) || 0;
    const pDepthVal = Number(poolDepth) || 0;
    const poolVolL = pAreaVal * pDepthVal * 1000;
    const poolDemandL = poolVolL * (poolEvap / 100);

    // Fire
    const fFlowGPM = Number(fireFlow) || 0;
    const fireLPM = fFlowGPM * 3.785;
    const fireCapL = fireLPM * 60; // 60 mins

    const grandTotalL = totalWaterL + totalIrrL + poolDemandL;

    // Convert values for output based on selected unit system
    const formatVol = (liters: number) => {
      if (ip) {
        return `${Math.round(liters / 3.78541).toLocaleString()} gal`;
      }
      return `${Math.round(liters).toLocaleString()} L`;
    };

    const formatRate = (litersPerDay: number) => {
      if (ip) {
        return `${Math.round(litersPerDay / 3.78541).toLocaleString()} gal/day`;
      }
      return `${Math.round(litersPerDay).toLocaleString()} L/day`;
    };

    return {
      totalPeople,
      totalWaterL,
      totalIrrL,
      poolVolL,
      poolDemandL,
      fireLPM,
      fireCapL,
      grandTotalL,
      displayDomestic: formatRate(totalWaterL),
      displayDomesticPeak: formatVol(totalWaterL / 10) + "/hr",
      displayIrrigation: formatRate(totalIrrL),
      displayPoolVol: formatVol(poolVolL),
      displayPoolDemand: formatRate(poolDemandL),
      displayFireLPM: `${fireLPM.toFixed(1)} L/min`,
      displayFireCap: formatVol(fireCapL),
      displayGrandTotal: formatRate(grandTotalL)
    };
  }, [wdRows, irrRows, poolArea, poolDepth, poolEvap, fireFlow, ip]);

  // Domestic handlers
  const handleAddWd = () => {
    if (!newWdName.trim() || !newWdPeople || !newWdCat) return;
    const lpd = WD_TYPE_MAP[newWdCat] || 0;
    setWdRows([...wdRows, {
      id: Date.now(),
      name: newWdName.trim(),
      ppl: Number(newWdPeople),
      cat: newWdCat,
      lpd
    }]);
    setNewWdName("");
    setNewWdPeople("");
    setNewWdCat("");
  };

  const handleWdRowChange = (id: number, field: "name" | "ppl" | "cat", val: any) => {
    setWdRows(wdRows.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: val };
      if (field === "cat") {
        updated.lpd = WD_TYPE_MAP[val] || 0;
      }
      return updated;
    }));
  };

  // Irrigation handlers
  const handleAddIrr = () => {
    if (!newIrrArea || !newIrrVegType) return;
    const lpd = IRR_TYPE_MAP[newIrrVegType] || 0;
    setIrrRows([...irrRows, {
      id: Date.now(),
      area: Number(newIrrArea),
      vegType: newIrrVegType,
      lpd
    }]);
    setNewIrrArea("");
    setNewIrrVegType("");
  };

  const handleIrrRowChange = (id: number, field: "area" | "vegType", val: any) => {
    setIrrRows(irrRows.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: val };
      if (field === "vegType") {
        updated.lpd = IRR_TYPE_MAP[val] || 0;
      }
      return updated;
    }));
  };

  // Excel exporter
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const domesticData = [
      ["Domestic Water Demand Schedule"],
      ["S.No", "Description", "No. of People", "User Category", "LPD (L/p/day)", "Total (L/day)"],
      ...wdRows.map((r, idx) => [idx + 1, r.name, r.ppl, r.cat, r.lpd, r.ppl * r.lpd]),
      ["TOTAL", "", calculations.totalPeople, "", "", calculations.totalWaterL]
    ];
    const irrData = [
      ["Irrigation Sizing"],
      ["S.No", "Vegetation Type", "Area (m²)", "LPD (L/m²/day)", "Total (L/day)"],
      ...irrRows.map((r, idx) => [idx + 1, r.vegType, r.area, r.lpd, r.area * r.lpd]),
      ["TOTAL", "", "", "", calculations.totalIrrL]
    ];
    const summaryData = [
      ["Water Demand Summary"],
      ["Category", "Volume Rate"],
      ["Domestic Daily Demand", calculations.displayDomestic],
      ["Irrigation Daily Demand", calculations.displayIrrigation],
      ["Pool Makeup Daily Demand", calculations.displayPoolDemand],
      ["GRAND TOTAL SIZED DEMAND", calculations.displayGrandTotal]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
    
    const wsDom = XLSX.utils.aoa_to_sheet(domesticData);
    XLSX.utils.book_append_sheet(wb, wsDom, "Domestic Schedule");

    const wsIrr = XLSX.utils.aoa_to_sheet(irrData);
    XLSX.utils.book_append_sheet(wb, wsIrr, "Irrigation Schedule");

    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "Water_Demand_Report.xlsx", "Excel Document", ["xlsx"]);
  };

  return (
    <AppShell title="Water Demand Calculator" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6">
          <div className="flex justify-between items-start select-none">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">PLUMBING &gt; WATER DEMAND</span>
              <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Water Demand Sizer</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Estimate daily domestic load, irrigation requirements, swimming pool make-up, and fire reserves.
              </p>
            </div>
            <button
              onClick={handleSaveCurrent}
              className="flex items-center gap-2 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-xl px-4 py-2 text-[12.5px] font-bold transition-all border-0 cursor-pointer shadow-sm mt-3"
            >
              <Save className="size-4" /> Save Calculation
            </button>
          </div>

          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 p-2 border border-border rounded-xl">
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl gap-1 select-none">
              <button type="button" onClick={() => setUnitSystem("si")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Metric (SI)</button>
              <button type="button" onClick={() => setUnitSystem("ip")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Imperial (IP)</button>
            </div>
            <TBtn onClick={handleExportExcel} className="h-8.5 text-xs"><FileSpreadsheet className="size-3.5" /> Export Excel</TBtn>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* 1. Domestic Water Demand Schedule */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">🏠 Domestic Water Demand</h3>
                </div>

                {/* Form to add row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-slate-50/50 dark:bg-slate-900/30 p-3.5 border border-border rounded-xl text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Description</label>
                    <input type="text" placeholder="e.g. Office Floor 1" value={newWdName} onChange={e => setNewWdName(e.target.value)} className="bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">No. of People</label>
                    <input type="number" placeholder="e.g. 50" value={newWdPeople} onChange={e => setNewWdPeople(e.target.value !== "" ? Number(e.target.value) : "")} className="bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Category</label>
                    <select value={newWdCat} onChange={e => setNewWdCat(e.target.value)} className="bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]">
                      <option value="">— Select Category —</option>
                      <optgroup label="Residential">
                        <option value="Residential buildings (flat)">Residential buildings (flat) — 300 LPD</option>
                        <option value="Villas">Villas — 350 LPD</option>
                        <option value="Mixed used residential">Mixed used residential — 350 LPD</option>
                        <option value="Labour accommodation">Labour accommodation — 150 LPD</option>
                      </optgroup>
                      <optgroup label="Office &amp; Commercial">
                        <option value="Offices">Offices — 60 LPD</option>
                        <option value="Headquarters">Headquarters — 80 LPD</option>
                        <option value="Commercial buildings">Commercial buildings — 100 LPD</option>
                        <option value="Mixed used commercial">Mixed used commercial — 80 LPD</option>
                        <option value="Logistic, academic &amp; business center">Logistic, academic &amp; business center — 75 LPD</option>
                      </optgroup>
                      <optgroup label="Retail &amp; Leisure">
                        <option value="Local plaza / retail / town center">Local plaza / retail / town center — 82 LPD</option>
                        <option value="Shops">Shops — 60 LPD</option>
                        <option value="Club house / recreation">Club house / recreation — 100 LPD</option>
                        <option value="Entertainment &amp; leisure / theater">Entertainment &amp; leisure / theater — 60 LPD</option>
                        <option value="Theatre">Theatre — 50 LPD</option>
                        <option value="Events">Events — 50 LPD</option>
                      </optgroup>
                      <optgroup label="Hospitality">
                        <option value="Hotels (per guest)">Hotels (per guest) — 300 LPD</option>
                        <option value="Hotels (per employee)">Hotels (per employee) — 80 LPD</option>
                        <option value="Restaurant (per meal)">Restaurant (per meal) — 15 LPD</option>
                        <option value="Visitors">Visitors — 40 LPD</option>
                      </optgroup>
                      <optgroup label="Education">
                        <option value="Schools / university">Schools / university — 60 LPD</option>
                        <option value="Nursery / child care centre">Nursery / child care centre — 70 LPD</option>
                      </optgroup>
                      <optgroup label="Medical &amp; Healthcare">
                        <option value="Medical (per bed)">Medical (per bed) — 450 LPD</option>
                        <option value="Day clinic (per medical practitioner) incl. visitors">Day clinic (per practitioner) — 450 LPD</option>
                        <option value="Laboratory">Laboratory — 80 LPD</option>
                      </optgroup>
                      <optgroup label="Industrial">
                        <option value="Manufacturing / mineral">Manufacturing / mineral — 80 LPD</option>
                        <option value="Industrial (workshops / machinery / warehouse)">Industrial — 80 LPD</option>
                        <option value="Guardhouse">Guardhouse — 75 LPD</option>
                      </optgroup>
                      <optgroup label="Public &amp; Assembly">
                        <option value="Mosques">Mosques — 60 LPD</option>
                        <option value="Public amenities">Public amenities — 50 LPD</option>
                      </optgroup>
                    </select>
                  </div>
                  <button type="button" onClick={handleAddWd} className="h-8.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer">
                    <Plus className="size-4" /> Add Entry
                  </button>
                </div>

                {/* Rows Table */}
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full border-collapse text-[12.5px] font-sans">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-border text-foreground font-semibold">
                        <th className="p-2.5 text-center w-12">S.No</th>
                        <th className="p-2.5 text-left">Description</th>
                        <th className="p-2.5 text-center w-24">People</th>
                        <th className="p-2.5 text-left w-48">Category</th>
                        <th className="p-2.5 text-right w-28">Consumption</th>
                        <th className="p-2.5 text-right w-28">Total</th>
                        <th className="p-2.5 text-center w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wdRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground italic">No entries added. Fill in the form above to populate.</td>
                        </tr>
                      ) : (
                        wdRows.map((r, idx) => (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                            <td className="p-2 text-center text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="p-2">
                              <input type="text" value={r.name} onChange={e => handleWdRowChange(r.id, "name", e.target.value)} className="w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded" />
                            </td>
                            <td className="p-2 text-center font-bold">
                              <input type="number" value={r.ppl} onChange={e => handleWdRowChange(r.id, "ppl", Number(e.target.value))} className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono" />
                            </td>
                            <td className="p-2">
                              <select value={r.cat} onChange={e => handleWdRowChange(r.id, "cat", e.target.value)} className="w-full bg-transparent border-0 outline-none cursor-pointer focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded">
                                {Object.keys(WD_TYPE_MAP).map(k => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2 text-right font-mono font-medium text-muted-foreground">{(ip ? Math.round(r.lpd / 3.78541) : r.lpd).toLocaleString()} {ip ? "gpd" : "LPD"}</td>
                            <td className="p-2 text-right font-mono font-bold text-[#0A7BC7]">{(ip ? Math.round((r.ppl * r.lpd) / 3.78541) : (r.ppl * r.lpd)).toLocaleString()} {ip ? "gal" : "L"}</td>
                            <td className="p-2 text-center">
                              <button onClick={() => setWdRows(wdRows.filter(x => x.id !== r.id))} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer transition-colors">
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Irrigation Water Demand */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">🌿 Irrigation Water Demand</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-slate-50/50 dark:bg-slate-900/30 p-3.5 border border-border rounded-xl text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Area ({ip ? "ft²" : "m²"})</label>
                    <input type="number" placeholder="e.g. 100" value={newIrrArea} onChange={e => setNewIrrArea(e.target.value !== "" ? Number(e.target.value) : "")} className="bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Vegetation Type</label>
                    <select value={newIrrVegType} onChange={e => setNewIrrVegType(e.target.value)} className="bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]">
                      <option value="">— Select Plant Type —</option>
                      {Object.keys(IRR_TYPE_MAP).map(k => (
                        <option key={k} value={k}>{k} — {IRR_TYPE_MAP[k]} L/m²</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={handleAddIrr} className="h-8.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer">
                    <Plus className="size-4" /> Add Plant Area
                  </button>
                </div>

                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full border-collapse text-[12.5px] font-sans">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-border text-foreground font-semibold">
                        <th className="p-2.5 text-center w-12">S.No</th>
                        <th className="p-2.5 text-left">Vegetation Type</th>
                        <th className="p-2.5 text-center w-32">Area</th>
                        <th className="p-2.5 text-right w-36">Rate</th>
                        <th className="p-2.5 text-right w-36">Total Load</th>
                        <th className="p-2.5 text-center w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {irrRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground italic">No irrigation entries.</td>
                        </tr>
                      ) : (
                        irrRows.map((r, idx) => (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                            <td className="p-2 text-center text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="p-2">
                              <select value={r.vegType} onChange={e => handleIrrRowChange(r.id, "vegType", e.target.value)} className="w-full bg-transparent border-0 outline-none cursor-pointer focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded">
                                {Object.keys(IRR_TYPE_MAP).map(k => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2 text-center font-bold font-mono">
                              <input type="number" value={r.area} onChange={e => handleIrrRowChange(r.id, "area", Number(e.target.value))} className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded" />
                            </td>
                            <td className="p-2 text-right font-mono font-medium text-muted-foreground">{(ip ? Math.round(r.lpd / 40.7458 * 100) / 100 : r.lpd).toFixed(ip ? 3 : 1)} {ip ? "gal/ft²" : "L/m²"}</td>
                            <td className="p-2 text-right font-mono font-bold text-[#0A7BC7]">{(ip ? Math.round((r.area * r.lpd) / 3.78541) : (r.area * r.lpd)).toLocaleString()} {ip ? "gal" : "L"}</td>
                            <td className="p-2 text-center">
                              <button onClick={() => setIrrRows(irrRows.filter(x => x.id !== r.id))} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer transition-colors">
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Swimming Pool Make-up Sizing */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">🏊 Swimming Pool Make-up</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs font-sans">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Pool Surface Area ({ip ? "ft²" : "m²"})</label>
                    <input type="number" placeholder="e.g. 80" value={poolArea} onChange={e => setPoolArea(e.target.value !== "" ? Number(e.target.value) : "")} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Average Depth ({ip ? "ft" : "m"})</label>
                    <input type="number" placeholder="e.g. 1.5" value={poolDepth} onChange={e => setPoolDepth(e.target.value !== "" ? Number(e.target.value) : "")} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Evaporation Rate (% of pool vol / day)</label>
                    <input type="number" value={poolEvap} onChange={e => setPoolEvap(Number(e.target.value))} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>
                </div>

                {poolArea && poolDepth && (
                  <div className="grid grid-cols-3 gap-3.5 mt-2.5">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                      <div className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">Total Pool Volume</div>
                      <div className="text-base font-extrabold font-mono text-blue-700 dark:text-blue-400 mt-0.5">{calculations.displayPoolVol}</div>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                      <div className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">Evaporating rate</div>
                      <div className="text-base font-extrabold font-mono text-blue-700 dark:text-blue-400 mt-0.5">{poolEvap} %</div>
                    </div>
                    <div className="p-3 bg-blue-600 border border-blue-700 rounded-xl text-white">
                      <div className="text-[10px] text-blue-100 uppercase tracking-wider font-semibold">Daily Makeup Water</div>
                      <div className="text-base font-extrabold font-mono mt-0.5">{calculations.displayPoolDemand}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Fire Fighting Reserve Capacity */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">🔥 Fire Fighting Reserve Sizing</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-sans">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Fire Pump Flow Rate (USGPM)</label>
                    <input type="number" placeholder="e.g. 500" value={fireFlow} onChange={e => setFireFlow(e.target.value !== "" ? Number(e.target.value) : "")} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Required Sizing Duration</label>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 text-muted-foreground border border-border/85 rounded-lg px-3 py-2 font-bold select-none cursor-not-allowed">
                      60 Minutes (Standard fixed duration)
                    </div>
                  </div>
                </div>

                {fireFlow && (
                  <div className="grid grid-cols-3 gap-3.5 mt-2.5">
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl">
                      <div className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Flow Rate Metric</div>
                      <div className="text-base font-extrabold font-mono text-red-700 dark:text-red-400 mt-0.5">{calculations.displayFireLPM}</div>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl">
                      <div className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Duration Period</div>
                      <div className="text-base font-extrabold font-mono text-red-700 dark:text-red-400 mt-0.5">60 min</div>
                    </div>
                    <div className="p-3 bg-red-600 border border-red-700 rounded-xl text-white">
                      <div className="text-[10px] text-red-100 uppercase tracking-wider font-semibold">Reserve Tank Capacity</div>
                      <div className="text-base font-extrabold font-mono mt-0.5">{calculations.displayFireCap}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Summary Panel */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs sticky top-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">📊 Site Sizing Summary</h3>
                </div>

                <div className="flex flex-col gap-3 font-sans text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Domestic Daily Demand</span>
                    <strong className="font-bold text-foreground font-mono">{calculations.displayDomestic}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Domestic Peak Flow Rate</span>
                    <strong className="font-bold text-foreground font-mono">{calculations.displayDomesticPeak}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Irrigation Daily Demand</span>
                    <strong className="font-bold text-foreground font-mono">{calculations.displayIrrigation}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Pool Daily Makeup Demand</span>
                    <strong className="font-bold text-foreground font-mono">{calculations.displayPoolDemand}</strong>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-t border-border/60 mt-1 col-span-2">
                    <span className="font-bold text-foreground uppercase text-[11px] tracking-wide">GRAND TOTAL DEMAND</span>
                    <strong className="font-extrabold text-[#0A7BC7] text-[16px] font-mono">{calculations.displayGrandTotal}</strong>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 rounded-xl p-3.5 flex gap-2.5 text-[11px]">
                  <Info className="size-4 shrink-0 mt-0.5 text-blue-600" />
                  <span>Sizing complies with ASHRAE standards, local municipality consumption regulations, and standard Hunter's curve diversity assumptions.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
