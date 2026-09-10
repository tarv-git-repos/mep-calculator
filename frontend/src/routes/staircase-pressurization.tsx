import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle,
  Save, FolderOpen, ChevronDown, ChevronUp, Trash2
} from "lucide-react";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";

export const Route = createFileRoute("/staircase-pressurization")({
  head: () => ({
    meta: [
      { title: "Staircase Pressurization — MEP Calc" },
      { name: "description", content: "Staircase Pressurization calculator for sizing smoke containment air volume flowrates." },
    ],
  }),
  component: StaircasePressurizationPage,
});

interface SavedCalculation {
  id: string;
  type: string;
  name: string;
  savedAt: string;
  values: Record<string, any>;
}

function StaircasePressurizationPage() {
  const [doorWidth, setDoorWidth] = useState<number | "">("");
  const [doorHeight, setDoorHeight] = useState<number | "">("");
  const [leakageRate, setLeakageRate] = useState<number | "">(""); // m³/s
  const [closedDoors, setClosedDoors] = useState<number | "">("");
  const [hasCalculated, setHasCalculated] = useState<boolean>(true); // default true for live calculations

  const [showDetailedCalcs, setShowDetailedCalcs] = useState<boolean>(true);

  // Custom Load/Save dialogs
  const [saves, setSaves] = useState<SavedCalculation[]>([]);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [showLoadModal, setShowLoadModal] = useState<boolean>(false);
  const [saveName, setSaveName] = useState<string>("");

  const { project, forceSaveToCloud } = useWorkspace();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`staircase_press_state_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.doorWidth !== undefined) setDoorWidth(data.doorWidth);
          if (data.doorHeight !== undefined) setDoorHeight(data.doorHeight);
          if (data.leakageRate !== undefined) setLeakageRate(data.leakageRate);
          if (data.closedDoors !== undefined) setClosedDoors(data.closedDoors);
        }
      } catch (e) {
        console.error(e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = { doorWidth, doorHeight, leakageRate, closedDoors };
      localStorage.setItem(`staircase_press_state_${project.id}`, JSON.stringify(dataToSave));
    }
  }, [project?.id, loadedProjectId, doorWidth, doorHeight, leakageRate, closedDoors]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mep_custom_calculator_saves");
      if (stored) {
        setSaves(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load custom saves", e);
    }
  }, []);

  const saveToLocalStorage = (newSaves: SavedCalculation[]) => {
    setSaves(newSaves);
    localStorage.setItem("mep_custom_calculator_saves", JSON.stringify(newSaves));
  };

  const handleSaveCurrent = () => {
    if (!saveName.trim()) return;
    const newSave: SavedCalculation = {
      id: Date.now().toString(),
      type: "Staircase Pressurization",
      name: saveName.trim(),
      savedAt: new Date().toLocaleDateString(),
      values: {
        "sp-door-width": doorWidth,
        "sp-door-height": doorHeight,
        "sp-air-leakage": leakageRate,
        "sp-closed-doors": closedDoors,
      }
    };
    const updated = [newSave, ...saves];
    saveToLocalStorage(updated);
    setSaveName("");
    setShowSaveModal(false);
    forceSaveToCloud();
  };

  const handleLoadSave = (id: string) => {
    const target = saves.find(s => s.id === id);
    if (!target) return;
    const v = target.values;
    if (v["sp-door-width"] !== undefined) setDoorWidth(Number(v["sp-door-width"]));
    if (v["sp-door-height"] !== undefined) setDoorHeight(Number(v["sp-door-height"]));
    if (v["sp-air-leakage"] !== undefined) setLeakageRate(Number(v["sp-air-leakage"]));
    if (v["sp-closed-doors"] !== undefined) setClosedDoors(Number(v["sp-closed-doors"]));
    setShowLoadModal(false);
  };

  const handleDeleteSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = saves.filter(s => s.id !== id);
    saveToLocalStorage(updated);
  };

  const calculatedData = useMemo(() => {
    const wVal = doorWidth !== "" ? Number(doorWidth) : 1.0;
    const hVal = doorHeight !== "" ? Number(doorHeight) : 2.1;
    const leakVal = leakageRate !== "" ? Number(leakageRate) : 0.03;
    const closedVal = closedDoors !== "" ? Number(closedDoors) : 19;

    const doorArea = wVal * hVal;
    const openDoors = 2;
    const egressVelocity = 1; // m/s
    const safetyFactor = 0.15; // 15%

    const openFlow = doorArea * egressVelocity * openDoors;
    const closedFlow = leakVal * closedVal;
    const safetyFlow = closedFlow * safetyFactor;
    const totalVol = openFlow + closedFlow + safetyFlow;

    return {
      doorArea,
      openFlow,
      closedFlow,
      safetyFlow,
      totalVol
    };
  }, [doorWidth, doorHeight, leakageRate, closedDoors]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ["Staircase Pressurization Report"],
      [],
      ["Design Parameters"],
      ["Door Width", `${doorWidth} m`],
      ["Door Height", `${doorHeight} m`],
      ["Door Area", `${calculatedData.doorArea.toFixed(4)} m²`],
      ["Air Leakage per Closed Door", `${(Number(leakageRate) || 0.03).toFixed(4)} m³/s`],
      ["Number of Closed Doors", closedDoors],
      [],
      ["Calculation Results"],
      ["Open Door Flow Rate (2 doors @ 1.0 m/s)", `${calculatedData.openFlow.toFixed(4)} m³/s`],
      ["Closed Door Flow Rate", `${calculatedData.closedFlow.toFixed(4)} m³/s`],
      ["Safety Margin Flow (15%)", `${calculatedData.safetyFlow.toFixed(4)} m³/s`],
      ["Total Pressurisation Volume Required", `${calculatedData.totalVol.toFixed(4)} m³/s`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Staircase Pressurization");
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "Staircase_Pressurization.xlsx", "Excel Document", ["xlsx"]);
  };

  return (
    <AppShell title="Staircase Pressurization" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">SMOKE MANAGEMENT &gt; STAIRCASE PRESSURIZATION</span>
            <div className="flex flex-wrap items-center justify-between gap-4 mt-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Staircase Pressurization Calculator</h1>
              <CalculationReviewBar calculatorPath="/staircase-pressurization" calculatorTitle="Staircase Pressurization" />
              </div>
              
              {/* Calculation Persistence Bar */}
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-border/80 text-xs">
                <span className="font-semibold text-muted-foreground px-2">💾 Calculation Files:</span>
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="bg-primary text-primary-foreground font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition hover:bg-primary/90 cursor-pointer"
                >
                  <Save className="size-3.5" /> Save Current
                </button>
                <button
                  onClick={() => setShowLoadModal(true)}
                  className="bg-primary/10 hover:bg-primary/20 text-primary font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  <FolderOpen className="size-3.5" /> Load Saved
                </button>
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Calculate the required air supply volume for staircase containment systems to resist smoke ingress during fire evacuations.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Inputs Card */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Design Parameters</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Door Width (m)</label>
                    <input type="number" step="any" value={doorWidth} onChange={(e) => setDoorWidth(e.target.value === "" ? "" : Number(e.target.value))} placeholder="1.0" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Door Height (m)</label>
                    <input type="number" step="any" value={doorHeight} onChange={(e) => setDoorHeight(e.target.value === "" ? "" : Number(e.target.value))} placeholder="2.1" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Air Leakage rate at 12.5 Pa (m³/s)</label>
                    <input type="number" step="any" value={leakageRate} onChange={(e) => setLeakageRate(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0.03" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Number of Closed Doors</label>
                    <input type="number" min="1" step="1" value={closedDoors} onChange={(e) => setClosedDoors(e.target.value === "" ? "" : Number(e.target.value))} placeholder="19" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                </div>
              </div>
            </div>

            {/* Results Card */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              <div className="flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none">
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Calculation Results</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Door Area</span>
                    <strong className="font-bold text-foreground font-mono">{calculatedData.doorArea.toFixed(4)} m²</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Open Door Flow</span>
                    <strong className="font-bold text-foreground font-mono">{calculatedData.openFlow.toFixed(4)} m³/s</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Closed Door Flow</span>
                    <strong className="font-bold text-foreground font-mono">{calculatedData.closedFlow.toFixed(4)} m³/s</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Safety Flow (15%)</span>
                    <strong className="font-bold text-foreground font-mono">{calculatedData.safetyFlow.toFixed(4)} m³/s</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 col-span-2">
                    <span className="font-semibold text-muted-foreground">Total Air Volume Required</span>
                    <strong className="font-bold text-[#0A7BC7] text-[15px] font-mono">{calculatedData.totalVol.toFixed(4)} m³/s</strong>
                  </div>
                </div>
              </div>

              {/* Detailed Calculations Steps */}
              <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
                <button
                  onClick={() => setShowDetailedCalcs(!showDetailedCalcs)}
                  className="w-full flex items-center justify-between p-5 font-bold text-xs uppercase tracking-wider text-muted-foreground font-sans hover:bg-slate-50 dark:hover:bg-slate-900/40 select-none cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="size-4 text-primary" /> Σ Detailed Calculations Steps
                  </span>
                  {showDetailedCalcs ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {showDetailedCalcs && (
                  <div className="p-5 pt-0 border-t border-border/40 text-xs font-sans flex flex-col gap-4 max-h-[350px] overflow-y-auto">
                    <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">1</div>
                      <div>
                        <div className="font-bold text-foreground">Step 1: Door Area</div>
                        <div className="font-mono text-primary my-1">Door Area = Door Width × Door Height</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">Door Area = {doorWidth} m × {doorHeight} m</div>
                        <div className="font-bold text-[11px] text-foreground mt-0.5">{calculatedData.doorArea.toFixed(4)} m²</div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">2</div>
                      <div>
                        <div className="font-bold text-foreground">Step 2: Open Door Flow</div>
                        <div className="font-mono text-primary my-1">Open Door Flow = Door Area × Egress Velocity × Number of Open Doors</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">Open Door Flow = {calculatedData.doorArea.toFixed(4)} m² × 1 m/s × 2</div>
                        <div className="font-bold text-[11px] text-foreground mt-0.5">{calculatedData.openFlow.toFixed(4)} m³/s</div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">3</div>
                      <div>
                        <div className="font-bold text-foreground">Step 3: Closed Door Flow</div>
                        <div className="font-mono text-primary my-1">Closed Door Flow = Air Leakage × Number of Closed Doors</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">Closed Door Flow = {(Number(leakageRate) || 0.03).toFixed(4)} m³/s × {closedDoors || 19}</div>
                        <div className="font-bold text-[11px] text-foreground mt-0.5">{calculatedData.closedFlow.toFixed(4)} m³/s</div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">4</div>
                      <div>
                        <div className="font-bold text-foreground">Step 4: Safety Flow</div>
                        <div className="font-mono text-primary my-1">Safety Flow = Closed Door Flow × Safety Factor (15%)</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">Safety Flow = {calculatedData.closedFlow.toFixed(4)} m³/s × 0.15</div>
                        <div className="font-bold text-[11px] text-foreground mt-0.5">{calculatedData.safetyFlow.toFixed(4)} m³/s</div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">5</div>
                      <div>
                        <div className="font-bold text-foreground">Step 5: Total Air Volume</div>
                        <div className="font-mono text-primary my-1">Total Air Volume = Open Door Flow + Closed Door Flow + Safety Flow</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">Total = {calculatedData.openFlow.toFixed(4)} + {calculatedData.closedFlow.toFixed(4)} + {calculatedData.safetyFlow.toFixed(4)}</div>
                        <div className="font-bold text-[11px] text-[#0A7BC7] mt-0.5">{calculatedData.totalVol.toFixed(4)} m³/s</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground mb-1">Standard Reference & Assumptions:</p>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>Complies with NFPA 92 / BS EN 12101-6 standard design rules.</li>
                  <li>Assumes an egress velocity through open doors of exactly 1.0 m/s.</li>
                  <li>Assumes 2 open doors during active occupant escape.</li>
                  <li>A 15% safety factor is applied to closed door leakage calculations to account for construction leakage tolerances.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl">
            <h3 className="font-bold text-base text-foreground">Save Current Staircase Pressurization</h3>
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-muted-foreground">Calculation Name</label>
              <input
                type="text"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="e.g. West Staircase Main"
                className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
              />
            </div>
            <div className="flex justify-end gap-2.5 mt-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCurrent}
                className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg text-xs transition hover:bg-primary/95 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 flex flex-col gap-4 shadow-2xl">
            <h3 className="font-bold text-base text-foreground">Load Saved Calculations</h3>
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
              {saves.filter(s => s.type === "stair-press").length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  📭 No saved calculations found.
                </div>
              ) : (
                saves
                  .filter(s => s.type === "stair-press")
                  .map(s => (
                    <div
                      key={s.id}
                      onClick={() => handleLoadSave(s.id)}
                      className="border border-border/70 rounded-xl p-3.5 hover:border-primary/50 transition cursor-pointer bg-slate-50/20 dark:bg-slate-900/10 flex justify-between items-center gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-xs text-foreground block truncate">{s.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                          Doors Closed: {s.values["sp-closed-doors"]} · Door Size: {s.values["sp-door-width"]}m × {s.values["sp-door-height"]}m
                        </span>
                        <span className="text-[9.5px] text-muted-foreground/80 mt-1 block">
                          Saved: {new Date(s.savedAt).toLocaleString()}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSave(s.id, e)}
                        className="text-muted-foreground hover:text-red-500 transition p-2 cursor-pointer"
                        title="Delete Save"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))
              )}
            </div>
            <div className="flex justify-end mt-2">
              <button
                onClick={() => setShowLoadModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
