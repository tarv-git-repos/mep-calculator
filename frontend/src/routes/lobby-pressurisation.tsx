import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle,
  Save, FolderOpen, ChevronDown, ChevronUp, Trash2, Import
} from "lucide-react";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";

export const Route = createFileRoute("/lobby-pressurisation")({
  head: () => ({
    meta: [
      { title: "Lobby Pressurisation — MEP Calc" },
      { name: "description", content: "Lobby Pressurisation calculator for sizing supply airflow rates and static pressures." },
    ],
  }),
  component: LobbyPressurisationPage,
});

interface SavedCalculation {
  id: string;
  type: string;
  name: string;
  savedAt: string;
  values: Record<string, any>;
}

function LobbyPressurisationPage() {
  const [area, setArea] = useState<number | "">("");
  const [height, setHeight] = useState<number | "">("");
  const [acph, setAcph] = useState<number | "">("");
  const [fanQty, setFanQty] = useState<number | "">("");

  const [ductLength, setDuctLength] = useState<number | "">("");
  const [frictionFactor, setFrictionFactor] = useState<number | "">(""); // Pa/m
  const [louverLoss, setLouverLoss] = useState<number | "">(""); // Pa
  const [fanLoss, setFanLoss] = useState<number | "">(""); // Pa

  const [effMotor, setEffMotor] = useState<number | "">(90); // %
  const [effFan, setEffFan] = useState<number | "">(75); // %
  const [numFansMotor, setNumFansMotor] = useState<number | "">("");

  // Expandable sections
  const [showDetailedCalcs, setShowDetailedCalcs] = useState<boolean>(true);
  
  // Custom Load/Save dialogs
  const [saves, setSaves] = useState<SavedCalculation[]>([]);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [showLoadModal, setShowLoadModal] = useState<boolean>(false);
  const [saveName, setSaveName] = useState<string>("");
  const [showImportDropdown, setShowImportDropdown] = useState<boolean>(false);

  const { project, forceSaveToCloud } = useWorkspace();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`lobby_press_state_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.area !== undefined) setArea(data.area);
          if (data.height !== undefined) setHeight(data.height);
          if (data.acph !== undefined) setAcph(data.acph);
          if (data.fanQty !== undefined) setFanQty(data.fanQty);
          if (data.ductLength !== undefined) setDuctLength(data.ductLength);
          if (data.frictionFactor !== undefined) setFrictionFactor(data.frictionFactor);
          if (data.louverLoss !== undefined) setLouverLoss(data.louverLoss);
          if (data.fanLoss !== undefined) setFanLoss(data.fanLoss);
          if (data.effMotor !== undefined) setEffMotor(data.effMotor);
          if (data.effFan !== undefined) setEffFan(data.effFan);
          if (data.numFansMotor !== undefined) setNumFansMotor(data.numFansMotor);
        }
      } catch (e) {
        console.error(e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = { area, height, acph, fanQty, ductLength, frictionFactor, louverLoss, fanLoss, effMotor, effFan, numFansMotor };
      localStorage.setItem(`lobby_press_state_${project.id}`, JSON.stringify(dataToSave));
    }
  }, [project?.id, loadedProjectId, area, height, acph, fanQty, ductLength, frictionFactor, louverLoss, fanLoss, effMotor, effFan, numFansMotor]);

  // Load custom saves on mount
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
      id: "custom_calc_" + Date.now(),
      type: "lobby-press",
      name: saveName.trim(),
      savedAt: new Date().toISOString(),
      values: {
        "lp-area": area,
        "lp-height": height,
        "lp-acph": acph,
        "lp-fan-qty": fanQty,
        "lp-head-duct-len": ductLength,
        "lp-head-friction-factor": frictionFactor,
        "lp-head-louvers": louverLoss,
        "lp-head-fan-losses": fanLoss,
        "lp-motor-eff-motor": effMotor,
        "lp-motor-eff-fan": effFan,
        "lp-motor-fan-qty": numFansMotor
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
    if (v["lp-area"] !== undefined) setArea(Number(v["lp-area"]));
    if (v["lp-height"] !== undefined) setHeight(Number(v["lp-height"]));
    if (v["lp-acph"] !== undefined) setAcph(Number(v["lp-acph"]));
    if (v["lp-fan-qty"] !== undefined) setFanQty(Number(v["lp-fan-qty"]));
    if (v["lp-head-duct-len"] !== undefined) setDuctLength(Number(v["lp-head-duct-len"]));
    if (v["lp-head-friction-factor"] !== undefined) setFrictionFactor(Number(v["lp-head-friction-factor"]));
    if (v["lp-head-louvers"] !== undefined) setLouverLoss(Number(v["lp-head-louvers"]));
    if (v["lp-head-fan-losses"] !== undefined) setFanLoss(Number(v["lp-head-fan-losses"]));
    if (v["lp-motor-eff-motor"] !== undefined) setEffMotor(Number(v["lp-motor-eff-motor"]));
    if (v["lp-motor-eff-fan"] !== undefined) setEffFan(Number(v["lp-motor-eff-fan"]));
    if (v["lp-motor-fan-qty"] !== undefined) setNumFansMotor(Number(v["lp-motor-fan-qty"]));
    setShowLoadModal(false);
  };

  const handleDeleteSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = saves.filter(s => s.id !== id);
    saveToLocalStorage(updated);
  };

  const handleImportSmokeExtract = (target: SavedCalculation) => {
    const v = target.values;
    if (v["se-corridor-area"] !== undefined) setArea(Number(v["se-corridor-area"]));
    if (v["se-corridor-height"] !== undefined) setHeight(Number(v["se-corridor-height"]));
    if (v["se-acph"] !== undefined) setAcph(Number(v["se-acph"]));
    if (v["se-fan-qty"] !== undefined) setFanQty(Number(v["se-fan-qty"]));
    if (v["se-smoke-duct-length"] !== undefined) setDuctLength(Number(v["se-smoke-duct-length"]));
    if (v["se-smoke-duct-friction-factor"] !== undefined) setFrictionFactor(Number(v["se-smoke-duct-friction-factor"]));
    if (v["se-smoke-losses-louvers"] !== undefined) setLouverLoss(Number(v["se-smoke-losses-louvers"]));
    if (v["se-smoke-losses-fan"] !== undefined) setFanLoss(Number(v["se-smoke-losses-fan"]));
    if (v["se-motor-eff-motor"] !== undefined) setEffMotor(Number(v["se-motor-eff-motor"]));
    if (v["se-motor-eff-fan"] !== undefined) setEffFan(Number(v["se-motor-eff-fan"]));
    if (v["se-motor-fan-qty"] !== undefined) setNumFansMotor(Number(v["se-motor-fan-qty"]));
    setShowImportDropdown(false);
  };

  const smokeExtractSaves = useMemo(() => {
    return saves.filter(s => s.type === "smoke-extract");
  }, [saves]);

  const calculatedData = useMemo(() => {
    const areaVal = area !== "" ? Number(area) : 50;
    const heightVal = height !== "" ? Number(height) : 3.0;
    const acphVal = acph !== "" ? Number(acph) : 10;
    const fanQtyVal = fanQty !== "" ? Number(fanQty) : 2;
    const ductLenVal = ductLength !== "" ? Number(ductLength) : 20;
    const ffVal = frictionFactor !== "" ? Number(frictionFactor) : 1.0;
    const louverVal = louverLoss !== "" ? Number(louverLoss) : 50;
    const fanLossVal = fanLoss !== "" ? Number(fanLoss) : 20;
    const effMotorVal = effMotor !== "" ? Number(effMotor) : 90;
    const effFanVal = effFan !== "" ? Number(effFan) : 75;
    const numFansVal = numFansMotor !== "" ? Number(numFansMotor) : (fanQtyVal || 1);

    const volume = areaVal * heightVal;
    const freshAirRate = (volume * acphVal) / 3600; // m³/s
    const flowEachM3s = freshAirRate / (fanQtyVal || 1);
    const flowEachLsRound = Math.ceil((flowEachM3s * 1000) / 5) * 5;

    const fittingsEqLen = ductLenVal * 0.6;
    const totalEqLen = ductLenVal + fittingsEqLen;
    const frictionLoss = ffVal * totalEqLen;
    const baseLosses = frictionLoss + louverVal + fanLossVal;
    const safetyHead = baseLosses * 0.1;
    const totalHead = baseLosses + safetyHead;
    const headRound = Math.round(totalHead / 10) * 10;

    const effM = effMotorVal / 100;
    const effF = effFanVal / 100;

    const powerEach = (flowEachM3s * headRound) / ((effM * effF || 1) * 1000); // kW
    const powerEachRound = Math.ceil(powerEach * 100) / 100; // nearest 0.01 kW
    const totalMotorPower = powerEachRound * 1.1 * numFansVal;

    return {
      volume,
      freshAirRate,
      flowEachM3s,
      flowEachLsRound,
      fittingsEqLen,
      totalEqLen,
      frictionLoss,
      totalHead,
      headRound,
      powerEachRound,
      totalMotorPower
    };
  }, [area, height, acph, fanQty, ductLength, frictionFactor, louverLoss, fanLoss, effMotor, effFan, numFansMotor]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ["Lobby Pressurisation & Fan Calculation"],
      [],
      ["Parameters"],
      ["Lobby Area", `${area} m²`],
      ["Lobby Height", `${height} m`],
      ["Lobby Volume", `${calculatedData.volume.toFixed(2)} m³`],
      ["Air Change per Hour (ACPH)", acph],
      ["Fresh Air Supply Rate", `${calculatedData.freshAirRate.toFixed(3)} m³/s`],
      ["Quantity of Fans", fanQty],
      ["Air Flow Rate per Fan", `${calculatedData.flowEachLsRound} L/s`],
      [],
      ["Static Head Sizing"],
      ["Ducting Length", `${ductLength} m`],
      ["Equivalent Fittings Length", `${calculatedData.fittingsEqLen.toFixed(2)} m`],
      ["Total Equivalent Length", `${calculatedData.totalEqLen.toFixed(2)} m`],
      ["Duct Friction Factor", `${frictionFactor} Pa/m`],
      ["Duct Friction Loss", `${calculatedData.frictionLoss.toFixed(2)} Pa`],
      ["Louver & Grille Drop", `${louverLoss} Pa`],
      ["Internal Fan Drop", `${fanLoss} Pa`],
      ["Fan Total Head", `${calculatedData.headRound} Pa`],
      [],
      ["Motor Selection"],
      ["Motor Efficiency", `${effMotor} %`],
      ["Fan Efficiency", `${effFan} %`],
      ["Power Required per Fan", `${calculatedData.powerEachRound.toFixed(2)} kW`],
      ["Number of Motor Fans", numFansMotor],
      ["Total Motor Power (+10% Safety)", `${calculatedData.totalMotorPower.toFixed(2)} kW`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Lobby Pressurisation");
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "Lobby_Pressurisation.xlsx", "Excel Document", ["xlsx"]);
  };

  return (
    <AppShell title="Lobby Pressurisation" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6">
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; LOBBY PRESSURISATION</span>
            <div className="flex flex-wrap items-center justify-between gap-4 mt-0.5">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">Lobby Pressurisation/Makeup Fan</h1>
              
              {/* Calculation Persistence Bar */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-border/80 text-xs">
                <span className="font-semibold text-muted-foreground px-2">💾 Calculation Files:</span>
                
                {/* Import Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowImportDropdown(!showImportDropdown)}
                    className="bg-primary/10 hover:bg-primary/20 text-primary font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Import className="size-3.5" /> Import <ChevronDown className="size-3" />
                  </button>
                  {showImportDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-xl shadow-xl z-50 p-2 text-left">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider p-2 border-b border-border/60">
                        Select Saved Smoke Extract Zone
                      </div>
                      {smokeExtractSaves.length === 0 ? (
                        <div className="p-3 text-muted-foreground text-center">
                          No saved Smoke Extract calculations found.
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto py-1">
                          {smokeExtractSaves.map(s => (
                            <button
                              key={s.id}
                              onClick={() => handleImportSmokeExtract(s)}
                              className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg text-xs font-semibold flex flex-col gap-0.5 transition cursor-pointer"
                            >
                              <span className="text-foreground truncate">{s.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                Area: {s.values["se-corridor-area"]}m² · Ht: {s.values["se-corridor-height"]}m
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

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
              Calculate lobby air volume supply rates and duct static pressure drops for pressurisation systems.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Inputs Column */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">1. Space Parameters</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Area of Lobby (m²)</label>
                    <input type="number" step="any" value={area} onChange={(e) => setArea(e.target.value === "" ? "" : Number(e.target.value))} placeholder="50" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Height of Lobby (m)</label>
                    <input type="number" step="any" value={height} onChange={(e) => setHeight(e.target.value === "" ? "" : Number(e.target.value))} placeholder="3.0" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Air Changes per Hour (ACPH)</label>
                    <input type="number" step="any" value={acph} onChange={(e) => setAcph(e.target.value === "" ? "" : Number(e.target.value))} placeholder="10" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Quantity of Fans</label>
                    <input type="number" min="1" step="1" value={fanQty} onChange={(e) => { const v = e.target.value === "" ? "" : Number(e.target.value); setFanQty(v); setNumFansMotor(v); }} placeholder="2" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                </div>
              </div>

              {/* Fan Head Sizing */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">2. Duct Static Head Loss</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Ducting Length (m)</label>
                    <input type="number" step="any" value={ductLength} onChange={(e) => setDuctLength(e.target.value === "" ? "" : Number(e.target.value))} placeholder="20" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Frictional Factor (Pa/m)</label>
                    <input type="number" step="any" value={frictionFactor} onChange={(e) => setFrictionFactor(e.target.value === "" ? "" : Number(e.target.value))} placeholder="1.0" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Louver &amp; Grille Pressure Drop (Pa)</label>
                    <input type="number" step="any" value={louverLoss} onChange={(e) => setLouverLoss(e.target.value === "" ? "" : Number(e.target.value))} placeholder="50" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Fan Internal Losses (Pa)</label>
                    <input type="number" step="any" value={fanLoss} onChange={(e) => setFanLoss(e.target.value === "" ? "" : Number(e.target.value))} placeholder="20" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                </div>
              </div>

              {/* Efficiencies */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">3. Fan Motor Sizing</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Motor Efficiency (%)</label>
                    <input type="number" step="any" value={effMotor} onChange={(e) => setEffMotor(e.target.value === "" ? "" : Number(e.target.value))} placeholder="90" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Fan Efficiency (%)</label>
                    <input type="number" step="any" value={effFan} onChange={(e) => setEffFan(e.target.value === "" ? "" : Number(e.target.value))} placeholder="75" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Number of Fans (Motor calculation)</label>
                    <input type="number" min="1" step="1" value={numFansMotor} onChange={(e) => setNumFansMotor(e.target.value === "" ? "" : Number(e.target.value))} placeholder="2" className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal" />
                  </div>
                </div>
              </div>
            </div>

            {/* Results Column */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              <div className="flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 select-none">
              </div>

              {/* Summary card */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Airflow & static head results</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Lobby Volume</span>
                    <strong className="font-bold text-foreground font-mono">{calculatedData.volume.toFixed(1)} m\u00b3</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Fresh Air supply</span>
                    <strong className="font-bold text-foreground font-mono">{calculatedData.freshAirRate.toFixed(3)} m\u00b3/s</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Flow of each fan</span>
                    <strong className="font-bold text-[#0A7BC7] text-[13px] font-mono">{calculatedData.flowEachLsRound} L/s</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Total Equivalent Length</span>
                    <strong className="font-bold text-foreground font-mono">{calculatedData.totalEqLen.toFixed(1)} m</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Equivalent Length of Fittings + Accessories</span>
                    <strong className="font-bold text-foreground font-mono">{calculatedData.fittingsEqLen.toFixed(1)} m</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Head Loss in Ducting</span>
                    <strong className="font-bold text-foreground font-mono">{calculatedData.frictionLoss.toFixed(1)} Pa</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40 col-span-2">
                    <span className="font-semibold text-muted-foreground text-primary">Total Static of the Fan</span>
                    <strong className="font-bold text-[#0A7BC7] text-[14px] font-mono">{calculatedData.headRound} Pa</strong>
                  </div>
                </div>

              </div>

              {/* Motor sizing card */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Motor Sizing Results</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40 col-span-2">
                    <span className="font-semibold text-muted-foreground">Power Required per Fan</span>
                    <strong className="font-bold text-foreground font-mono">{calculatedData.powerEachRound.toFixed(2)} kW</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 col-span-2">
                    <span className="font-semibold text-muted-foreground">Total Motor Power (+10% Safety margin)</span>
                    <strong className="font-bold text-[#0A7BC7] text-[14px] font-mono">{calculatedData.totalMotorPower.toFixed(2)} kW</strong>
                  </div>
                </div>
              </div>

              {/* Expanded Detailed Calculations */}
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
                  <div className="p-5 pt-0 border-t border-border/40 text-xs font-sans flex flex-col gap-4 max-h-[400px] overflow-y-auto">
                    <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">1</div>
                      <div>
                        <div className="font-bold text-foreground">Step 1: Lobby Volume</div>
                        <div className="font-mono text-primary my-1">V = Area × Height</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">V = {area} m² × {height} m</div>
                        <div className="font-bold text-[11px] text-foreground mt-0.5">{calculatedData.volume.toFixed(2)} m³</div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">2</div>
                      <div>
                        <div className="font-bold text-foreground">Step 2: Fresh Air Supply Rate</div>
                        <div className="font-mono text-primary my-1">q = (Volume × ACPH) / 3600</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">q = ({calculatedData.volume.toFixed(2)} m³ × {acph} ACPH) / 3600</div>
                        <div className="font-bold text-[11px] text-foreground mt-0.5">{calculatedData.freshAirRate.toFixed(3)} m³/s</div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">3</div>
                      <div>
                        <div className="font-bold text-foreground">Step 3: Sized Flow Rate per Fan</div>
                        <div className="font-mono text-primary my-1">Q_each = Ceiling( (q / qtyFans * 1000) / 5 ) * 5</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">Q_each = Ceiling( ({calculatedData.freshAirRate.toFixed(3)} / {fanQty} × 1000) / 5 ) * 5</div>
                        <div className="font-bold text-[11px] text-[#0A7BC7] mt-0.5">{calculatedData.flowEachLsRound} L/s</div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">4</div>
                      <div>
                        <div className="font-bold text-foreground">Step 4: Ducting Equivalent Length & Friction Loss</div>
                        <div className="font-mono text-primary my-1">Eq. Length = DuctLength × 1.6 | frictionLoss = Eq. Length × frictionFactor</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">Eq. Length = {calculatedData.totalEqLen.toFixed(1)} m | frictionLoss = {calculatedData.totalEqLen.toFixed(1)} m × {frictionFactor} Pa/m</div>
                        <div className="font-bold text-[11px] text-foreground mt-0.5">{calculatedData.frictionLoss.toFixed(2)} Pa</div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">5</div>
                      <div>
                        <div className="font-bold text-foreground">Step 5: Fan Total Static Head</div>
                        <div className="font-mono text-primary my-1">Total Head = Round( (frictionLoss + LouverDrop + FanDrop) × 1.1 ) to nearest 10</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">Total Head = Round( ({calculatedData.frictionLoss.toFixed(2)} + {louverLoss} + {fanLoss}) × 1.1 ) to nearest 10</div>
                        <div className="font-bold text-[11px] text-[#0A7BC7] mt-0.5">{calculatedData.headRound} Pa</div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">6</div>
                      <div>
                        <div className="font-bold text-foreground">Step 6: Sized Power per Fan</div>
                        <div className="font-mono text-primary my-1">Power = (FlowEachM3s × HeadRound) / (Eff_Motor × Eff_Fan × 1000)</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">Power = ({calculatedData.flowEachM3s.toFixed(4)} m³/s × {calculatedData.headRound} Pa) / ({(Number(effMotor) || 90) / 100} × {(Number(effFan) || 75) / 100} × 1000)</div>
                        <div className="font-bold text-[11px] text-foreground mt-0.5">{calculatedData.powerEachRound.toFixed(2)} kW</div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">7</div>
                      <div>
                        <div className="font-bold text-foreground">Step 7: Sized Total Motor Power</div>
                        <div className="font-mono text-primary my-1">Total Power = PowerEach × 1.1 × qtyFans (Motor calculation)</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">Total Power = {calculatedData.powerEachRound.toFixed(2)} kW × 1.1 × {numFansMotor}</div>
                        <div className="font-bold text-[11px] text-[#0A7BC7] mt-0.5">{calculatedData.totalMotorPower.toFixed(2)} kW</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Assumptions reference block */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground mb-1">Standard Reference & Assumptions:</p>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>Calculates fresh air requirements in accordance with NFPA 92 and BS EN 12101-6.</li>
                  <li>Friction loss calculation uses equivalent length sizers for typical fitting indices ($1.6 \times$ duct length).</li>
                  <li>Fan motor sizing includes a $+10\%$ electrical security factor applied to nominal shaft horsepower outputs.</li>
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
            <h3 className="font-bold text-base text-foreground">Save Current Lobby Pressurisation</h3>
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-muted-foreground">Calculation Name</label>
              <input
                type="text"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="e.g. Zone A Ground Floor"
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
              {saves.filter(s => s.type === "lobby-press").length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  📭 No saved calculations found.
                </div>
              ) : (
                saves
                  .filter(s => s.type === "lobby-press")
                  .map(s => (
                    <div
                      key={s.id}
                      onClick={() => handleLoadSave(s.id)}
                      className="border border-border/70 rounded-xl p-3.5 hover:border-primary/50 transition cursor-pointer bg-slate-50/20 dark:bg-slate-900/10 flex justify-between items-center gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-xs text-foreground block truncate">{s.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                          Area: {s.values["lp-area"]}m² · Ht: {s.values["lp-height"]}m · ACPH: {s.values["lp-acph"]}
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
