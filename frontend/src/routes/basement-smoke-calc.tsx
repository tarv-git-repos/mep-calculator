import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet, Plus, Trash2,
  ChevronDown, ChevronUp, Edit3, Settings, HelpCircle
} from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/basement-smoke-calc")({
  head: () => ({
    meta: [
      { title: "Basement Smoke Calc — MEP Calc" },
      { name: "description", content: "Basement smoke control ventilation calculator and fan system head sizer." },
    ],
  }),
  component: BasementSmokeCalcPage,
});

interface BasementFloor {
  id: string;
  name: string;
  area: number;
  effArea: number;
  height: number;
}

interface FanSystem {
  id: string;
  name: string;
  floorIds: string[];
  fanType: "Extract" | "Makeup";
  length: number;
  frictionFactor: number;
  louver: number;
  grille: number;
  sa: number;
  collapsed: boolean;
}

function BasementSmokeCalcPage() {
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  
  // Schedule state
  const [floors, setFloors] = useState<BasementFloor[]>([]);
  const [newFloor, setNewFloor] = useState({ name: "", area: 1200, effArea: 1000, height: 3.5 });

  // Fan Systems state
  const [fanSystems, setFanSystems] = useState<FanSystem[]>([]);
  const [totalFans, setTotalFans] = useState<number>(2);

  // Modal state
  const [showFSModal, setShowFSModal] = useState<boolean>(false);
  const [modalFSId, setModalFSId] = useState<string | null>(null);
  const [modalFSName, setModalFSName] = useState<string>("");
  const [modalFSType, setModalFSType] = useState<"Extract" | "Makeup">("Extract");
  const [modalSelectedFloorIds, setModalSelectedFloorIds] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string>("");

  const ip = unitSystem === "ip";

  // Load from local storage
  useEffect(() => {
    try {
      const savedRows = localStorage.getItem("bs_rows");
      if (savedRows) {
        setFloors(JSON.parse(savedRows));
      } else {
        // Initial defaults
        setFloors([
          { id: "floor-1", name: "Basement 1", area: 1500, effArea: 1200, height: 3.5 },
          { id: "floor-2", name: "Basement 2", area: 1500, effArea: 1200, height: 3.5 }
        ]);
      }
      
      const savedFans = localStorage.getItem("bs_fan_systems");
      if (savedFans) {
        setFanSystems(JSON.parse(savedFans));
      } else {
        setFanSystems([
          {
            id: "fs-1",
            name: "Basement Extract System 1",
            floorIds: ["floor-1", "floor-2"],
            fanType: "Extract",
            length: 30,
            frictionFactor: 1.2,
            louver: 40,
            grille: 15,
            sa: 30,
            collapsed: false
          }
        ]);
      }

      const savedTotalFans = localStorage.getItem("bs_total_fans");
      if (savedTotalFans) {
        setTotalFans(Number(savedTotalFans));
      }
    } catch (e) {
      console.error("Failed to load basement smoke calc configurations", e);
    }
  }, []);

  // Save to local storage on changes
  useEffect(() => {
    if (floors.length > 0) {
      localStorage.setItem("bs_rows", JSON.stringify(floors));
    }
  }, [floors]);

  useEffect(() => {
    if (fanSystems.length > 0) {
      localStorage.setItem("bs_fan_systems", JSON.stringify(fanSystems));
    }
  }, [fanSystems]);

  useEffect(() => {
    localStorage.setItem("bs_total_fans", totalFans.toString());
  }, [totalFans]);

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;
    setUnitSystem(unit);
    if ((window as any).__mep_keep_values) return;
    // Convert current floor values
    const conv = unit === "ip" ? 10.7639 : 1 / 10.7639; // m\u00b2 to ft\u00b2
    const convH = unit === "ip" ? 3.28084 : 1 / 3.28084; // m to ft

    setFloors(floors.map(f => ({
      ...f,
      area: Number((f.area * conv).toFixed(0)),
      effArea: Number((f.effArea * conv).toFixed(0)),
      height: Number((f.height * convH).toFixed(1))
    })));

    setNewFloor(prev => ({
      ...prev,
      area: Number((prev.area * conv).toFixed(0)),
      effArea: Number((prev.effArea * conv).toFixed(0)),
      height: Number((prev.height * convH).toFixed(1))
    }));
  };

  const calculatedRows = useMemo(() => {
    return floors.map(f => {
      const vol = f.effArea * f.height;
      let f3 = 0, f6 = 0, f10 = 0;
      if (ip) {
        // CFM
        f3 = Math.ceil(vol * 3 / 60);
        f6 = Math.ceil(vol * 6 / 60);
        f10 = Math.ceil(vol * 10 / 60);
      } else {
        // L/s
        f3 = Math.ceil(vol * 3 / 3.6);
        f6 = Math.ceil(vol * 6 / 3.6);
        f10 = Math.ceil(vol * 10 / 3.6);
      }
      return {
        ...f,
        volume: vol,
        flow3ach: f3,
        flow6ach: f6,
        flow10ach: f10
      };
    });
  }, [floors, ip, unitSystem]);

  const totals = useMemo(() => {
    const total3 = calculatedRows.reduce((a, b) => a + b.flow3ach, 0);
    const total6 = calculatedRows.reduce((a, b) => a + b.flow6ach, 0);
    const max10 = Math.max(...calculatedRows.map(r => r.flow10ach), 0);

    const lowCap = Math.ceil(total3 / (totalFans || 1));
    const highCap = Math.ceil(Math.max(total6, max10) / (totalFans || 1));

    return {
      total3,
      total6,
      max10,
      lowCap,
      highCap
    };
  }, [calculatedRows, totalFans]);

  const handleAddFloor = () => {
    if (!newFloor.name) return;
    const id = "floor-" + Date.now();
    const updatedFloors = [...floors, { ...newFloor, id }];
    setFloors(updatedFloors);
    setNewFloor({ name: "", area: ip ? 12000 : 1200, effArea: ip ? 10000 : 1000, height: ip ? 11.5 : 3.5 });
  };

  const handleDeleteFloor = (id: string) => {
    const updatedFloors = floors.filter(f => f.id !== id);
    setFloors(updatedFloors);
    // Clean floor ID refs from Fan Systems
    setFanSystems(fanSystems.map(fs => ({
      ...fs,
      floorIds: fs.floorIds.filter(fId => fId !== id)
    })));
  };

  // Open Fan System Modal for create
  const handleOpenCreateFS = () => {
    setModalFSId(null);
    setModalFSName("");
    setModalFSType("Extract");
    setModalSelectedFloorIds([]);
    setModalError("");
    setShowFSModal(true);
  };

  // Open Fan System Modal for edit
  const handleOpenEditFS = (fs: FanSystem) => {
    setModalFSId(fs.id);
    setModalFSName(fs.name);
    setModalFSType(fs.fanType);
    setModalSelectedFloorIds(fs.floorIds);
    setModalError("");
    setShowFSModal(true);
  };

  const handleSaveFanSystem = () => {
    if (!modalFSName.trim()) {
      setModalError("Please enter a Fan System Name.");
      return;
    }
    if (modalSelectedFloorIds.length === 0) {
      setModalError("Please select at least one floor to serve.");
      return;
    }

    if (modalFSId) {
      // Edit
      setFanSystems(fanSystems.map(fs => fs.id === modalFSId ? {
        ...fs,
        name: modalFSName.trim(),
        fanType: modalFSType,
        floorIds: modalSelectedFloorIds
      } : fs));
    } else {
      // Create
      const newFS: FanSystem = {
        id: "fs-" + Date.now(),
        name: modalFSName.trim(),
        fanType: modalFSType,
        floorIds: modalSelectedFloorIds,
        length: 20,
        frictionFactor: 1.2,
        louver: 0,
        grille: 0,
        sa: 0,
        collapsed: false
      };
      setFanSystems([...fanSystems, newFS]);
    }
    setShowFSModal(false);
  };

  const calculatedFanSystems = useMemo(() => {
    return fanSystems.map(fs => {
      const fittings = fs.length * 0.6;
      const eqLen = fs.length + fittings;
      const frictionLoss = eqLen * fs.frictionFactor;
      const safety = (frictionLoss + fs.louver + fs.grille + fs.sa) * 0.10;
      const totalStatic = Math.round((frictionLoss + fs.louver + fs.grille + fs.sa + safety) / 10) * 10;

      // Find the associated flowrate
      const servedFloors = calculatedRows.filter(r => fs.floorIds.includes(r.id));
      let flow3 = servedFloors.reduce((a, b) => a + b.flow3ach, 0);
      let flow6 = servedFloors.reduce((a, b) => a + b.flow6ach, 0);
      let flow10Max = Math.max(...servedFloors.map(r => r.flow10ach), 0);

      let lowCap = Math.ceil(flow3 / (totalFans || 1));
      let highCap = Math.ceil(Math.max(flow6, flow10Max) / (totalFans || 1));

      // Scaling for makeup fan
      if (fs.fanType === "Makeup") {
        flow3 = Math.round(flow3 * 0.85);
        flow6 = Math.round(flow6 * 0.85);
        flow10Max = Math.round(flow10Max * 0.85);
        lowCap = Math.round(lowCap * 0.85);
        highCap = Math.round(highCap * 0.85);
      }

      return {
        ...fs,
        fittings,
        eqLen,
        frictionLoss,
        safety,
        totalStatic,
        flow3,
        flow6,
        flow10Max,
        lowCap,
        highCap,
        servedFloors
      };
    });
  }, [fanSystems, calculatedRows, totalFans]);

  // Check if a floor is already assigned to a system of the target type
  const assignedFloorsMap = useMemo(() => {
    const map: Record<string, string> = {};
    fanSystems.forEach(fs => {
      if (fs.id !== modalFSId && fs.fanType === modalFSType) {
        fs.floorIds.forEach(id => {
          map[id] = fs.name;
        });
      }
    });
    return map;
  }, [fanSystems, modalFSId, modalFSType]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const floorData = calculatedRows.map(r => [
      r.name,
      r.area,
      r.effArea,
      r.height,
      r.flow3ach,
      r.flow6ach,
      r.flow10ach
    ]);
    const headers = ["Floor Name", `Gross Area (${ip ? "ft\u00b2" : "m\u00b2"})`, `Effective Area (${ip ? "ft\u00b2" : "m\u00b2"})`, `Height (${ip ? "ft" : "m"})`, `3 ACH Flow (${ip ? "CFM" : "L/s"})`, `6 ACH Flow (${ip ? "CFM" : "L/s"})`, `10 ACH Flow (${ip ? "CFM" : "L/s"})` ];
    const ws = XLSX.utils.aoa_to_sheet([["Basement Ventilation Schedule"], [], headers, ...floorData]);
    XLSX.utils.book_append_sheet(wb, ws, "Basement Schedule");
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "Basement_Smoke_Calculation.xlsx", "Excel Document", ["xlsx"]);
  };

  return (
    <AppShell title="Basement Smoke Calc" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6">
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">SMOKE MANAGEMENT &gt; BASEMENT VENTILATION</span>
            <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Basement Smoke Extract Schedule</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Formulate car park ventilating schedule calculations (3, 6, and 10 ACH) and head losses for extract/makeup fan systems.
            </p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-border/60 self-start select-none">
            <button type="button" onClick={() => handleUnitSystemChange("ip")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Imperial (IP)</button>
            <button type="button" onClick={() => handleUnitSystemChange("si")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Metric (SI)</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left - Schedule Table */}
            <div className="lg:col-span-8 flex flex-col gap-5">
              <div className="bg-card border border-border rounded-2xl shadow-xs p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center pb-2 border-b border-border/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Basement Level Schedule</h3>
                  <TBtn onClick={handleExportExcel} className="h-8 text-xs"><FileSpreadsheet className="size-3.5" /> Export Excel</TBtn>
                </div>

                {/* Add Level Form */}
                <div className="bg-slate-50 dark:bg-slate-950/20 p-4 border border-border/80 rounded-xl flex gap-3 flex-wrap items-end text-xs">
                  <div className="flex-1 min-w-[120px] flex flex-col gap-1">
                    <label className="font-semibold text-muted-foreground">Floor Name</label>
                    <input type="text" placeholder="e.g. B3" value={newFloor.name} onChange={e => setNewFloor({ ...newFloor, name: e.target.value })} className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7]" />
                  </div>
                  <div className="w-24 flex flex-col gap-1">
                    <label className="font-semibold text-muted-foreground">Gross Area</label>
                    <input type="number" value={newFloor.area} onChange={e => setNewFloor({ ...newFloor, area: Number(e.target.value) })} className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7]" />
                  </div>
                  <div className="w-24 flex flex-col gap-1">
                    <label className="font-semibold text-muted-foreground">Eff. Area</label>
                    <input type="number" value={newFloor.effArea} onChange={e => setNewFloor({ ...newFloor, effArea: Number(e.target.value) })} className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7]" />
                  </div>
                  <div className="w-20 flex flex-col gap-1">
                    <label className="font-semibold text-muted-foreground">Height</label>
                    <input type="number" step="0.1" value={newFloor.height} onChange={e => setNewFloor({ ...newFloor, height: Number(e.target.value) })} className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7]" />
                  </div>
                  <button onClick={handleAddFloor} className="bg-[#0A7BC7] text-white px-4 py-2 font-bold rounded-lg hover:bg-[#06456F] cursor-pointer flex items-center gap-1"><Plus className="size-3.5" /> Add</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/70 text-muted-foreground font-semibold">
                        <th className="py-2.5">Level Name</th>
                        <th className="py-2.5">Gross Area</th>
                        <th className="py-2.5">Eff. Area</th>
                        <th className="py-2.5">Height</th>
                        <th className="py-2.5">3 ACH (Normal)</th>
                        <th className="py-2.5">6 ACH (Max Normal)</th>
                        <th className="py-2.5 text-primary">10 ACH (Fire)</th>
                        <th className="py-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {calculatedRows.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="py-2.5 font-sans font-semibold">{r.name}</td>
                          <td className="py-2.5">{r.area} {ip ? "ft\u00b2" : "m\u00b2"}</td>
                          <td className="py-2.5">{r.effArea} {ip ? "ft\u00b2" : "m\u00b2"}</td>
                          <td className="py-2.5">{r.height} {ip ? "ft" : "m"}</td>
                          <td className="py-2.5 font-semibold text-slate-700 dark:text-slate-300">{r.flow3ach.toLocaleString()}</td>
                          <td className="py-2.5">{r.flow6ach.toLocaleString()}</td>
                          <td className="py-2.5 font-bold text-primary">{r.flow10ach.toLocaleString()}</td>
                          <td className="py-2.5 text-center">
                            <button onClick={() => handleDeleteFloor(r.id)} className="text-red-500 hover:text-red-700 transition cursor-pointer">
                              <Trash2 className="size-4 animate-scale" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right - Global Selection */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              {/* Fan selection parameters */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Global Fan Sizing</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Total Fan Qty Sized</label>
                    <input type="number" min="1" step="1" value={totalFans} onChange={e => setTotalFans(Number(e.target.value))} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[#0A7BC7]" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-sans mt-2 pt-2 border-t border-border/60">
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase">Total 3 ACH Flow</span>
                      <strong className="text-sm font-bold text-foreground font-mono">{totals.total3.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-primary block font-bold uppercase">Max 10 ACH Flow</span>
                      <strong className="text-sm font-bold text-primary font-mono">{totals.max10.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-border/40">
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase">Low Speed Capacity / Fan</span>
                      <strong className="text-base font-bold text-foreground font-mono">{totals.lowCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-primary block font-bold uppercase">High Speed Capacity / Fan</span>
                      <strong className="text-base font-bold text-primary font-mono">{totals.highCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fan Systems Head Loss Block */}
            <div className="col-span-12 flex flex-col gap-4">
              <div className="bg-card border border-border rounded-2xl shadow-xs p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Fan Systems Head Loss Calculations</h3>
                  </div>
                  <TBtn onClick={handleOpenCreateFS} className="h-8.5 text-xs">
                    <Plus className="size-3.5" /> Create Fan System
                  </TBtn>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {calculatedFanSystems.map(fs => (
                    <div key={fs.id} className="border border-border/75 rounded-2xl bg-slate-50/30 dark:bg-slate-900/10 flex flex-col overflow-hidden shadow-xs">
                      
                      {/* Card Header with Toggle Collapse */}
                      <div
                        onClick={() => setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, collapsed: !x.collapsed } : x))}
                        className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/40 p-4 border-b border-border/70 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/60 select-none transition"
                      >
                        <div className="flex items-center gap-2 flex-wrap max-w-[80%]">
                          <span className={`text-[10px] text-muted-foreground transition duration-200 block ${fs.collapsed ? "-rotate-90" : ""}`}>▼</span>
                          <strong className="text-xs text-foreground font-sans font-bold">{fs.name}</strong>
                          <span className="text-[9.5px] px-2 py-0.5 bg-primary/10 text-primary font-bold rounded-full uppercase">
                            {fs.fanType} System
                          </span>
                          <div className="flex items-center gap-1.5 ml-2">
                            {fs.servedFloors.map(f => (
                              <span key={f.id} className="text-[10px] bg-slate-200/50 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded-md">
                                {f.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenEditFS(fs); }}
                            className="bg-transparent text-primary hover:bg-primary/10 font-bold px-2 py-1 rounded text-[11px] flex items-center gap-1 transition cursor-pointer"
                          >
                            <Edit3 className="size-3" /> Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setFanSystems(fanSystems.filter(x => x.id !== fs.id)); }}
                            className="bg-transparent text-red-500 hover:bg-red-500/10 font-bold px-2 py-1 rounded text-[11px] flex items-center gap-1 transition cursor-pointer"
                          >
                            <Trash2 className="size-3" /> Delete
                          </button>
                        </div>
                      </div>

                      {!fs.collapsed && (
                        <div className="p-5 flex flex-col gap-4">
                          {/* Flow summary for this system */}
                          <div className="grid grid-cols-5 gap-2 select-none">
                            <div className="bg-slate-100/30 dark:bg-slate-900/30 border border-border/80 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">3 ACH Total</span>
                              <strong className="text-[12px] font-bold text-primary font-mono mt-1 block">{fs.flow3.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                            </div>
                            <div className="bg-slate-100/30 dark:bg-slate-900/30 border border-border/80 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">6 ACH Total</span>
                              <strong className="text-[12px] font-bold text-primary font-mono mt-1 block">{fs.flow6.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                            </div>
                            <div className="bg-slate-100/30 dark:bg-slate-900/30 border border-border/80 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">10 ACH Max</span>
                              <strong className="text-[12px] font-bold text-red-500 font-mono mt-1 block">{fs.flow10Max.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                            </div>
                            <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                              <span className="text-[9px] font-bold text-primary uppercase tracking-wider block">Low Speed</span>
                              <strong className="text-[12px] font-bold text-primary font-mono mt-1 block">{fs.lowCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                            </div>
                            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                              <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider block">High Speed</span>
                              <strong className="text-[12px] font-bold text-red-500 font-mono mt-1 block">{fs.highCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                            </div>
                          </div>

                          {/* Friction configuration row */}
                          <div className="flex justify-between items-center bg-slate-100/30 dark:bg-slate-900/30 border border-border rounded-xl px-4 py-2.5 text-xs select-none">
                            <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Design Friction Rate</span>
                            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                              <span>Friction Factor:</span>
                              <input
                                type="number"
                                step="0.1"
                                value={fs.frictionFactor}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, frictionFactor: val } : x));
                                }}
                                className="w-12 bg-transparent text-primary font-bold text-center border-b border-primary/50 outline-none"
                              />
                              <span>Pa/m of ducting</span>
                            </div>
                          </div>

                          {/* Inputs Split */}
                          <div className="grid grid-cols-2 gap-5">
                            <div className="flex flex-col gap-2.5 text-xs">
                              <div className="font-bold text-[#64748b] border-b border-border pb-1.5 uppercase tracking-wider text-[10px]">Ductwork Inputs</div>
                              <div className="flex flex-col gap-1">
                                <label className="font-semibold text-muted-foreground">Duct Length (m)</label>
                                <input
                                  type="number"
                                  value={fs.length}
                                  onChange={e => {
                                    const val = Number(e.target.value);
                                    setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, length: val } : x));
                                  }}
                                  className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="font-semibold text-muted-foreground">Losses in Louver (Pa)</label>
                                <input
                                  type="number"
                                  value={fs.louver}
                                  onChange={e => {
                                    const val = Number(e.target.value);
                                    setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, louver: val } : x));
                                  }}
                                  className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="font-semibold text-muted-foreground">Losses in Grille (Pa)</label>
                                <input
                                  type="number"
                                  value={fs.grille}
                                  onChange={e => {
                                    const val = Number(e.target.value);
                                    setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, grille: val } : x));
                                  }}
                                  className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="font-semibold text-muted-foreground">Losses in SAs (Pa)</label>
                                <input
                                  type="number"
                                  value={fs.sa}
                                  onChange={e => {
                                    const val = Number(e.target.value);
                                    setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, sa: val } : x));
                                  }}
                                  className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col gap-2.5 text-xs">
                              <div className="font-bold text-[#64748b] border-b border-border pb-1.5 uppercase tracking-wider text-[10px]">Calculated Results</div>
                              <div className="bg-slate-100/20 dark:bg-slate-900/10 border border-border rounded-xl p-3 flex flex-col gap-2 font-sans">
                                <div className="flex justify-between items-center py-1 border-b border-border/40">
                                  <span className="font-semibold text-muted-foreground">Fittings in Ducting</span>
                                  <strong className="font-bold text-foreground font-mono">{fs.fittings.toFixed(1)} m</strong>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-border/40">
                                  <span className="font-semibold text-muted-foreground">Equivalent Length</span>
                                  <strong className="font-bold text-foreground font-mono">{fs.eqLen.toFixed(1)} m</strong>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-border/40">
                                  <span className="font-semibold text-muted-foreground">Frictional Losses</span>
                                  <strong className="font-bold text-foreground font-mono">{fs.frictionLoss.toFixed(2)} Pa</strong>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-border/40">
                                  <span className="font-semibold text-muted-foreground">Safety Overhead (10%)</span>
                                  <strong className="font-bold text-foreground font-mono">{fs.safety.toFixed(2)} Pa</strong>
                                </div>
                                <div className="flex justify-between items-center pt-1 text-[#0A7BC7]">
                                  <span className="font-bold">Total Static Sized</span>
                                  <strong className="font-bold text-sm font-mono">{fs.totalStatic} Pa</strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fan System Modal */}
      {showFSModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-fade-in">
            <h3 className="font-bold text-base text-foreground">
              {modalFSId ? "Edit Fan System" : "Create Fan System"}
            </h3>
            
            {modalError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 rounded-lg p-2.5 text-xs flex items-center gap-2 select-none">
                <AlertTriangle className="size-4 shrink-0 text-red-600" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex flex-col gap-3.5 text-xs font-sans">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">System Name</label>
                <input
                  type="text"
                  value={modalFSName}
                  onChange={e => setModalFSName(e.target.value)}
                  placeholder="e.g. SF-1 Extract"
                  className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">System Type</label>
                <select
                  value={modalFSType}
                  onChange={e => setModalFSType(e.target.value as any)}
                  className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7]"
                >
                  <option value="Extract">Smoke Extract Fan</option>
                  <option value="Makeup">Makeup Air Fan</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Associate Floor Levels</label>
                <div className="border border-border/80 rounded-lg p-1.5 bg-background max-h-36 overflow-y-auto flex flex-col gap-1 select-none">
                  {floors.map(f => {
                    const checked = modalSelectedFloorIds.includes(f.id);
                    const assignedTo = assignedFloorsMap[f.id];
                    const isDisabled = !!assignedTo;
                    return (
                      <label
                        key={f.id}
                        className={`flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold cursor-pointer ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isDisabled}
                          onChange={() => {
                            if (isDisabled) return;
                            const nextIds = checked 
                              ? modalSelectedFloorIds.filter(id => id !== f.id)
                              : [...modalSelectedFloorIds, f.id];
                            setModalSelectedFloorIds(nextIds);
                          }}
                        />
                        <span className="flex-1 text-foreground">{f.name}</span>
                        {assignedTo && (
                          <span className="text-[10px] text-red-500 font-bold">
                            Assigned to {assignedTo}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-2">
              <button
                onClick={() => setShowFSModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFanSystem}
                className="px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer"
              >
                {modalFSId ? "Save Changes" : "Create System"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
