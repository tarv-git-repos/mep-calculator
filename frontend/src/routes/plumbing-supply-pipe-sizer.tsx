import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { FileSpreadsheet, Info, AlertTriangle, Save } from "lucide-react";
import * as XLSX from "xlsx";
import { useConfirm } from "@/hooks/use-confirm";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";

export const Route = createFileRoute("/plumbing-supply-pipe-sizer")({
  head: () => ({
    meta: [
      { title: "Supply Pipe Sizer — MEP Calc" },
      { name: "description", content: "Water supply pipe sizer using ASPE/IPC velocity and friction loss constraints." },
    ],
  }),
  component: SupplyPipeSizerPage,
});

interface PipeSize {
  nps: string;
  dn: string;
  id: number; // inches
}

const PIPE_SIZES: PipeSize[] = [
  { nps: '¾"', dn: '20 mm', id: 0.811 },
  { nps: '1"', dn: '25 mm', id: 1.055 },
  { nps: '1¼"', dn: '32 mm', id: 1.265 },
  { nps: '1½"', dn: '40 mm', id: 1.505 },
  { nps: '2"', dn: '50 mm', id: 2.009 },
  { nps: '2½"', dn: '65 mm', id: 2.495 },
  { nps: '3"', dn: '80 mm', id: 3.035 },
  { nps: '4"', dn: '100 mm', id: 4.009 }
];

function SupplyPipeSizerPage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  
  // Inputs state
  const [flow, setFlow] = useState<number | "">("");
  const [pAvail, setPAvail] = useState<number | "">("");
  const [pResid, setPResid] = useState<number | "">("");
  const [length, setLength] = useState<number | "">("");
  const [fittingAllowance, setFittingAllowance] = useState<number>(20);
  const [elevation, setElevation] = useState<number | "">("");
  const [pipeMaterial, setPipeMaterial] = useState<string>("150"); // default Copper/CPVC C=150

  // Load state from localStorage on project change
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_supply_pipe_sizer_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.flow !== undefined) setFlow(data.flow);
        if (data.pAvail !== undefined) setPAvail(data.pAvail);
        if (data.pResid !== undefined) setPResid(data.pResid);
        if (data.length !== undefined) setLength(data.length);
        if (data.fittingAllowance !== undefined) setFittingAllowance(data.fittingAllowance);
        if (data.elevation !== undefined) setElevation(data.elevation);
        if (data.pipeMaterial !== undefined) setPipeMaterial(data.pipeMaterial);
      } else {
        // Reset to defaults
        setUnitSystem("si");
        setFlow("");
        setPAvail("");
        setPResid("");
        setLength("");
        setFittingAllowance(20);
        setElevation("");
        setPipeMaterial("150");
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load supply pipe sizer calculation", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  const handleSaveCurrent = () => {
    try {
      const dataToSave = {
        unitSystem,
        flow,
        pAvail,
        pResid,
        length,
        fittingAllowance,
        elevation,
        pipeMaterial
      };
      localStorage.setItem(`mep_supply_pipe_sizer_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(false);
    if (forceSaveToCloud) forceSaveToCloud();

      toast.success("Supply Pipe Sizer Calculation saved to project successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  const ip = unitSystem === "ip";

  const handleUnitSystemChange = (targetUnit: "si" | "ip") => {
    if (targetUnit === unitSystem) return;

    const toIP = targetUnit === "ip";
    
    // Read the user decision set by the global AppShell unit modal handler
    const keepValues = (window as any).__mep_keep_values;

    if (!keepValues) {
      // Convert current values
      setFlow(prev => {
        if (prev === "") return "";
        const val = toIP ? prev * 15.8503 : prev / 15.8503;
        return Number(val.toFixed(2));
      });

      setPAvail(prev => {
        if (prev === "") return "";
        const val = toIP ? prev / 6.89476 : prev * 6.89476;
        return Number(val.toFixed(1));
      });

      setPResid(prev => {
        if (prev === "") return "";
        const val = toIP ? prev / 6.89476 : prev * 6.89476;
        return Number(val.toFixed(1));
      });

      setLength(prev => {
        if (prev === "") return "";
        const val = toIP ? prev * 3.28084 : prev / 3.28084;
        return Number(val.toFixed(1));
      });

      setElevation(prev => {
        if (prev === "") return "";
        const val = toIP ? prev * 3.28084 : prev / 3.28084;
        return Number(val.toFixed(1));
      });
    }

    setUnitSystem(targetUnit);
  };

  // Sizing Calculations
  const calculations = useMemo(() => {
    if (!flow || !pAvail || !pResid || !length) {
      return null;
    }

    // Convert inputs to Imperial (IP) for standardized formulas
    // Flow Rate: L/s to GPM
    const Q_gpm = ip ? Number(flow) : Number(flow) * 15.8503;
    // Available Pressure: kPa to psi
    const pAvail_psi = ip ? Number(pAvail) : Number(pAvail) / 6.89476;
    // Required Residual: kPa to psi
    const pResid_psi = ip ? Number(pResid) : Number(pResid) / 6.89476;
    // Total Pipe Length: m to ft
    const L_ft = ip ? Number(length) : Number(length) * 3.28084;
    // Elevation: m to ft
    const elev_ft = ip ? (Number(elevation) || 0) : (Number(elevation) || 0) * 3.28084;

    const C = Number(pipeMaterial);
    const fitPct = fittingAllowance / 100;
    const Leff = L_ft * (1 + fitPct);
    const elevLoss_psi = elev_ft / 2.31;
    const elevLoss_kpa = elevLoss_psi * 6.89476;

    const rows = PIPE_SIZES.map(s => {
      // Hazen-Williams Friction Loss (psi)
      const hf_psi = 4.52 * Leff * Math.pow(Q_gpm, 1.85) / (Math.pow(C, 1.85) * Math.pow(s.id, 4.87));
      const hf_kpa = hf_psi * 6.89476;

      // Area (ft²)
      const A = Math.PI * Math.pow(s.id / 12, 2) / 4;
      // Velocity (fps)
      const v_fps = (Q_gpm / 448.8) / A;
      const v_ms = v_fps * 0.3048;

      // Residual Pressure at remote fixture (psi/kPa)
      const resid_psi = pAvail_psi - hf_psi - elevLoss_psi;
      const resid_kpa = resid_psi * 6.89476;

      // IPC limit checks: Velocity 1-8 fps (0.3-2.4 m/s) and Residual Pressure >= Required
      const isPressureOk = resid_psi >= pResid_psi;
      const isVelocityOk = v_fps >= 1 && v_fps <= 8;
      const ok = isPressureOk && isVelocityOk;

      return {
        ...s,
        hf_psi,
        hf_kpa,
        v_fps,
        v_ms,
        resid_psi,
        resid_kpa,
        ok,
        isPressureOk,
        isVelocityOk
      };
    });

    // Recommended = smallest size that complies with ASPE/IPC limits (ok === true)
    const rec = rows.find(r => r.ok);

    return {
      rows,
      rec,
      elevLoss_psi,
      elevLoss_kpa
    };
  }, [flow, pAvail, pResid, length, fittingAllowance, elevation, pipeMaterial, ip]);

  // Excel Export
  const handleExportExcel = () => {
    if (!calculations) return;
    const wb = XLSX.utils.book_new();
    const rowsData = [
      ["Water Supply Pipe Sizing Report"],
      ["System Parameters"],
      ["Flow Rate", `${flow} ${ip ? "GPM" : "L/s"}`],
      ["Available Pressure", `${pAvail} ${ip ? "psi" : "kPa"}`],
      ["Required Residual", `${pResid} ${ip ? "psi" : "kPa"}`],
      ["Pipe Length", `${length} ${ip ? "ft" : "m"}`],
      ["Fitting Allowance", `${fittingAllowance} %`],
      ["Elevation Rise", `${elevation || 0} ${ip ? "ft" : "m"}`],
      [""],
      ["Size Sizing Schedule"],
      ["Size (NPS)", "Size (DN)", "Velocity", "Friction Loss", "Elev Loss", "Residual Press", "Status"],
      ...calculations.rows.map(r => [
        r.nps,
        r.dn,
        `${(ip ? r.v_fps : r.v_ms).toFixed(2)} ${ip ? "fps" : "m/s"}`,
        `${(ip ? r.hf_psi : r.hf_kpa).toFixed(2)} ${ip ? "psi" : "kPa"}`,
        `${(ip ? calculations.elevLoss_psi : calculations.elevLoss_kpa).toFixed(2)} ${ip ? "psi" : "kPa"}`,
        `${(ip ? r.resid_psi : r.resid_kpa).toFixed(1)} ${ip ? "psi" : "kPa"}`,
        r.ok ? "PASS" : "FAIL"
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(rowsData);
    XLSX.utils.book_append_sheet(wb, ws, "Sizing Report");
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "Water_Supply_Pipe_Sizer_Report.xlsx", "Excel Document", ["xlsx"]);
  };

  
  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = { unitSystem, flow, pAvail, pResid, length, fittingAllowance, elevation, pipeMaterial };
      localStorage.setItem(`mep_supply_pipe_sizer_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, unitSystem, flow, pAvail, pResid, length, fittingAllowance, elevation, pipeMaterial]);

  return (
    <AppShell title="Water Supply Pipe Sizer" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6 animate-in fade-in-50 duration-200">
          <div className="flex justify-between items-start select-none">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">PLUMBING &gt; SUPPLY PIPE SIZER</span>
              <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Water Supply Pipe Sizer</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Size domestic water supply distribution pipes and calculate residual fixture pressure using the Hazen-Williams equation.
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
              <button type="button" onClick={() => handleUnitSystemChange("si")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Metric (SI)</button>
              <button type="button" onClick={() => handleUnitSystemChange("ip")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Imperial (IP)</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Inputs panel */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">⚙ System Inputs</h3>
                </div>

                <div className="flex flex-col gap-4 text-xs font-sans">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground flex justify-between">
                      <span>Design Flow Rate</span>
                      <span className="text-muted-foreground font-bold font-mono">{ip ? "GPM" : "L/s"}</span>
                    </label>
                    <input type="number" placeholder="e.g. 25" value={flow} onChange={e => setFlow(e.target.value !== "" ? Number(e.target.value) : "")} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground flex justify-between">
                      <span>Available Supply Pressure</span>
                      <span className="text-muted-foreground font-bold font-mono">{ip ? "psi" : "kPa"}</span>
                    </label>
                    <input type="number" placeholder="e.g. 60" value={pAvail} onChange={e => setPAvail(e.target.value !== "" ? Number(e.target.value) : "")} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground flex justify-between">
                      <span>Required Residual at Fixture</span>
                      <span className="text-muted-foreground font-bold font-mono">{ip ? "psi" : "kPa"}</span>
                    </label>
                    <input type="number" placeholder="e.g. 20" value={pResid} onChange={e => setPResid(e.target.value !== "" ? Number(e.target.value) : "")} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground flex justify-between">
                      <span>Total Pipe Length</span>
                      <span className="text-muted-foreground font-bold font-mono">{ip ? "ft" : "m"}</span>
                    </label>
                    <input type="number" placeholder="e.g. 120" value={length} onChange={e => setLength(e.target.value !== "" ? Number(e.target.value) : "")} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground flex justify-between">
                      <span>Fitting Allowance</span>
                      <span className="text-muted-foreground font-bold font-mono">% of pipe length</span>
                    </label>
                    <input type="number" placeholder="e.g. 20" value={fittingAllowance} onChange={e => setFittingAllowance(Number(e.target.value))} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground flex justify-between">
                      <span>Elevation Rise (supply to fixture)</span>
                      <span className="text-muted-foreground font-bold font-mono">{ip ? "ft" : "m"}</span>
                    </label>
                    <input type="number" placeholder="e.g. 20" value={elevation} onChange={e => setElevation(e.target.value !== "" ? Number(e.target.value) : "")} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Pipe Material</label>
                    <select value={pipeMaterial} onChange={e => setPipeMaterial(e.target.value)} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]">
                      <option value="150">Copper Type L (C=150)</option>
                      <option value="150">CPVC (C=150)</option>
                      <option value="120">Galvanized Steel (C=120)</option>
                      <option value="130">PEX (C=130)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sizing Results panel */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {!calculations ? (
                <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground italic flex flex-col gap-2 items-center justify-center">
                  <Info className="size-8 text-[#0A7BC7]/70" />
                  <span>Enter all system parameters on the left to calculate recommended pipe sizing.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                  {/* Warning message if recommended size is not found */}
                  {!calculations.rec && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 text-xs text-red-700 dark:text-red-400 font-sans">
                      <AlertTriangle className="size-5 shrink-0 text-red-500" />
                      <div>
                        <div className="font-bold">Pressure Insufficient</div>
                        <div className="mt-0.5">No standard pipe size satisfies both velocity (1-8 fps) and residual pressure requirements. Consider boosting available supply pressure or reducing pipe elevation/run.</div>
                      </div>
                    </div>
                  )}

                  {/* All sizes schedule list */}
                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                      <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">📋 Sizing Schedule (All Pipe Sizes)</h3>
                    </div>

                    <div className="overflow-x-auto border border-border rounded-xl">
                      <table className="w-full border-collapse text-[12.5px] font-sans">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-border text-foreground font-semibold">
                            <th className="p-2.5 text-center">NPS</th>
                            <th className="p-2.5 text-center">DN Size</th>
                            <th className="p-2.5 text-right">Velocity</th>
                            <th className="p-2.5 text-right">Friction Loss</th>
                            <th className="p-2.5 text-right">Elevation Loss</th>
                            <th className="p-2.5 text-right">Residual Pressure</th>
                            <th className="p-2.5 text-center w-24">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calculations.rows.map(r => {
                            const showVel = ip ? r.v_fps : r.v_ms;
                            const showFric = ip ? r.hf_psi : r.hf_kpa;
                            const showElev = ip ? calculations.elevLoss_psi : calculations.elevLoss_kpa;
                            const showResid = ip ? r.resid_psi : r.resid_kpa;
                            
                            const isVelWarning = r.v_fps < 1 || r.v_fps > 8;
                            const isPressWarning = r.resid_psi < (ip ? Number(pResid) : Number(pResid) / 6.89476);

                            return (
                              <tr key={r.nps} className={`border-b border-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 ${r.ok ? "bg-emerald-500/5" : ""}`}>
                                <td className="p-2.5 text-center font-bold text-foreground">{r.nps}</td>
                                <td className="p-2.5 text-center font-medium text-muted-foreground">{r.dn}</td>
                                <td className={`p-2.5 text-right font-mono font-medium ${isVelWarning ? "text-amber-500 font-bold" : "text-foreground"}`}>
                                  {showVel.toFixed(2)} {ip ? "fps" : "m/s"}
                                </td>
                                <td className="p-2.5 text-right font-mono font-medium text-muted-foreground">{showFric.toFixed(2)} {ip ? "psi" : "kPa"}</td>
                                <td className="p-2.5 text-right font-mono font-medium text-muted-foreground">{showElev.toFixed(2)} {ip ? "psi" : "kPa"}</td>
                                <td className={`p-2.5 text-right font-mono font-bold ${isPressWarning ? "text-red-500" : "text-emerald-500"}`}>
                                  {showResid.toFixed(1)} {ip ? "psi" : "kPa"}
                                </td>
                                <td className="p-2.5 text-center">
                                  {r.ok ? (
                                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded text-[10.5px]">✓ PASS</span>
                                  ) : (
                                    <span className="text-muted-foreground/60 font-semibold">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recommended sizing result block */}
                  {calculations.rec && (
                    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                      <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                        <div className="w-1 h-3.5 bg-emerald-500 rounded-full"></div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">✅ Recommended Sizing Selection</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans text-xs">
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex justify-between items-center md:col-span-2">
                          <span className="font-bold text-foreground">Recommended Pipe Size</span>
                          <strong className="text-[17px] font-extrabold text-emerald-500 font-mono">{calculations.rec.nps} NPS ({calculations.rec.dn})</strong>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/30">
                          <span className="font-semibold text-muted-foreground">Velocity</span>
                          <span className="font-mono font-bold text-foreground">{(ip ? calculations.rec.v_fps : calculations.rec.v_ms).toFixed(2)} {ip ? "fps" : "m/s"}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/30">
                          <span className="font-semibold text-muted-foreground">Friction Loss</span>
                          <span className="font-mono font-bold text-foreground">{(ip ? calculations.rec.hf_psi : calculations.rec.hf_kpa).toFixed(2)} {ip ? "psi" : "kPa"}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/30">
                          <span className="font-semibold text-muted-foreground">Elevation pressure loss</span>
                          <span className="font-mono font-bold text-foreground">{(ip ? calculations.elevLoss_psi : calculations.elevLoss_kpa).toFixed(2)} {ip ? "psi" : "kPa"}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/30">
                          <span className="font-semibold text-muted-foreground">Residual at remote fixture</span>
                          <span className="font-mono font-bold text-emerald-500 text-sm">{(ip ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1)} {ip ? "psi" : "kPa"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
