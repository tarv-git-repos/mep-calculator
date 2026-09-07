import { CalculationReviewBar, useCalculationLock } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { exportSprinklerDensityPDF, type SprinklerDensityExportData } from "@/lib/exportSprinklerDensityPDF";
import { exportSprinklerDensityExcel } from "@/lib/exportSprinklerDensityExcel";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, FileSpreadsheet, X, HelpCircle,
  Search, Activity, Droplet, Settings, Grid, Flame, ShieldAlert, Check
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";

export const Route = createFileRoute("/plumbing-sprinkler-density")({
  head: () => ({
    meta: [
      { title: "Sprinkler Density & Flow — MEP Calc" },
      { name: "description", content: "Calculate sprinkler flow rates from design density, design area, and sprinkler K-factor per NFPA 13." },
    ],
  }),
  component: SprinklerDensityPage,
});

type HazardOpt = "0.10,1500" | "0.15,1500" | "0.20,1500" | "0.30,2500" | "0.40,2500" | "custom";

const STANDARD_K_FACTORS = [2.8, 4.2, 5.6, 8.0, 11.2, 14.0, 16.8, 19.6, 22.4, 25.2, 28.0];

function SprinklerDensityPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project } = useWorkspace();
  const isApprovedLocked = useCalculationLock("/plumbing-sprinkler-density", project?.id);
  const [calcReviewState, setCalcReviewState] = useState<any>({ status: "DRAFT" });

  // Tabs
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);

  // Input states
  const [hazard, setHazard] = useState<HazardOpt>("0.15,1500");
  const [customDens, setCustomDens] = useState<number | "">(0.20);
  const [customArea, setCustomArea] = useState<number | "">(1500);
  const [coverage, setCoverage] = useState<number | "">(130);
  const [kFactor, setKFactor] = useState(5.6);
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("ip");

  // Sync state with active project
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!project?.id) return;
    if (loadedProjectId === project.id) return;

    const projData = project.workspace_data?.sprinkler_density_data;
    if (projData) {
      if (projData.hazard) setHazard(projData.hazard);
      if (projData.customDens !== undefined) setCustomDens(projData.customDens);
      if (projData.customArea !== undefined) setCustomArea(projData.customArea);
      if (projData.coverage !== undefined) setCoverage(projData.coverage);
      if (projData.kFactor !== undefined) setKFactor(projData.kFactor);
      if (projData.unitSystem) setUnitSystem(projData.unitSystem);
    } else {
      const saved = localStorage.getItem(`mep_sprinkler_density_${project.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.hazard) setHazard(parsed.hazard);
          if (parsed.customDens !== undefined) setCustomDens(parsed.customDens);
          if (parsed.customArea !== undefined) setCustomArea(parsed.customArea);
          if (parsed.coverage !== undefined) setCoverage(parsed.coverage);
          if (parsed.kFactor !== undefined) setKFactor(parsed.kFactor);
          if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
        } catch (e) {}
      }
    }
    setLoadedProjectId(project.id);
  }, [project?.id, loadedProjectId]);

  // Save changes when modified
  useEffect(() => {
    if (!project?.id || !loadedProjectId || loadedProjectId !== project.id) return;
    const dataToSave = {
      hazard,
      customDens,
      customArea,
      coverage,
      kFactor,
      unitSystem,
    };
    try {
      localStorage.setItem(`mep_sprinkler_density_${project.id}`, JSON.stringify(dataToSave));
    } catch (e) {}
  }, [hazard, customDens, customArea, coverage, kFactor, unitSystem, project?.id, loadedProjectId]);

  // Calculations
  const calcResults = useMemo(() => {
    const customDensVal = customDens === "" ? 0 : customDens;
    const customAreaVal = customArea === "" ? 0 : customArea;
    const coverageVal = coverage === "" ? 0 : coverage;

    let dens = 0.15;
    let designArea = 1500;

    if (hazard === "custom") {
      dens = customDensVal;
      designArea = customAreaVal;
    } else {
      const parts = hazard.split(",");
      dens = parseFloat(parts[0]);
      designArea = parseFloat(parts[1]);
    }

    const ip = unitSystem === "ip";
    // Convert to IP if SI is selected (SI: mm/min and m²)
    // mm/min -> GPM/ft²: divide by 40.74
    // m² -> ft²: multiply by 10.7639
    const densIP = ip ? dens : dens / 40.74;
    const coverFt2 = ip ? coverageVal : coverageVal * 10.7639;
    const designAreaFt2 = ip ? designArea : designArea * 10.7639;

    const flowPerSprink = densIP * coverFt2; // GPM
    const pressReq = Math.pow(flowPerSprink / kFactor, 2); // psi
    const nSprink = coverFt2 > 0 ? Math.ceil(designAreaFt2 / coverFt2) : 0;
    const totalSprinkFlow = densIP * designAreaFt2; // GPM

    // Hose stream allowance: LH=100, OH=250, EH=500 GPM
    const hoseAllow = densIP <= 0.10 ? 100 : densIP <= 0.20 ? 250 : 500;
    const systemTotal = totalSprinkFlow + hoseAllow;

    // Unit conversions for display
    const formatFlow = (gpm: number) => {
      return ip ? `${gpm.toFixed(1)} GPM` : `${(gpm * 0.06309).toFixed(2)} L/s`;
    };

    const formatPressure = (psi: number) => {
      return ip ? `${psi.toFixed(1)} psi` : `${(psi * 0.0689476).toFixed(2)} bar`;
    };

    const formatArea = (ft2: number) => {
      return ip ? `${ft2.toFixed(0)} ft²` : `${(ft2 / 10.7639).toFixed(1)} m²`;
    };

    const formatDens = (gpmft2: number) => {
      return ip ? `${gpmft2.toFixed(3)} GPM/ft²` : `${(gpmft2 * 40.74).toFixed(2)} mm/min`;
    };

    return {
      densIP,
      coverFt2,
      designAreaFt2,
      flowPerSprink,
      pressReq,
      nSprink,
      totalSprinkFlow,
      hoseAllow,
      systemTotal,
      formatFlow,
      formatPressure,
      formatArea,
      formatDens
    };
  }, [hazard, customDens, customArea, coverage, kFactor, unitSystem]);

  // Get hazard display label
  const getHazardLabel = () => {
    switch (hazard) {
      case "0.10,1500": return "Light Hazard (0.10 gpm/ft² / 1,500 ft²)";
      case "0.15,1500": return "Ordinary Hazard Group 1 (0.15 gpm/ft² / 1,500 ft²)";
      case "0.20,1500": return "Ordinary Hazard Group 2 (0.20 gpm/ft² / 1,500 ft²)";
      case "0.30,2500": return "Extra Hazard Group 1 (0.30 gpm/ft² / 2,500 ft²)";
      case "0.40,2500": return "Extra Hazard Group 2 (0.40 gpm/ft² / 2,500 ft²)";
      default: return `Custom Hazard (${calcResults.densIP.toFixed(2)} gpm/ft² / ${calcResults.designAreaFt2} ft²)`;
    }
  };

  const getExportData = (): SprinklerDensityExportData => {
    const isSI = unitSystem === "si";
    const waterDurationMin = hazard.startsWith("0.10") ? 30 : (hazard.startsWith("0.30") || hazard.startsWith("0.40") ? 90 : 60);
    const flowGpm = calcResults.systemTotal;
    const totalStorageGal = flowGpm * waterDurationMin;
    const totalStorageM3 = totalStorageGal * 0.00378541;

    return {
      hazard,
      hazardLabel: getHazardLabel(),
      density: isSI ? calcResults.densIP * 40.7458 : calcResults.densIP,
      densityUnit: isSI ? "mm/min" : "gpm/ft²",
      designArea: isSI ? calcResults.designAreaFt2 * 0.092903 : calcResults.designAreaFt2,
      designAreaUnit: isSI ? "m²" : "ft²",
      coverage: Number(coverage) || (isSI ? 12 : 130),
      coverageUnit: isSI ? "m²" : "ft²",
      kFactor,
      kFactorUnit: isSI ? "L/min/bar^0.5" : "gpm/psi^0.5",
      unitSystem,
      flowPerSprinkler: isSI ? calcResults.flowPerSprink * 3.78541 : calcResults.flowPerSprink,
      pressureRequired: isSI ? calcResults.pressReq * 0.0689476 : calcResults.pressReq,
      pressureUnit: isSI ? "bar" : "psi",
      sprinklersCount: calcResults.nSprink,
      totalSprinklerFlow: isSI ? calcResults.totalSprinkFlow * 3.78541 : calcResults.totalSprinkFlow,
      flowUnit: isSI ? "L/min" : "GPM",
      hoseAllowance: isSI ? calcResults.hoseAllow * 3.78541 : calcResults.hoseAllow,
      totalSystemDemand: isSI ? calcResults.systemTotal * 3.78541 : calcResults.systemTotal,
      waterDurationMin,
      totalStorageGallons: totalStorageGal,
      totalStorageM3,
      isPressureCompliant: calcResults.pressReq >= 7.0,
      isCoverageCompliant: calcResults.coverFt2 <= 225,
    };
  };

  // Export handlers
  const exportExcel = async () => {
    const exportData = getExportData();
    const meta = {
      calcNo: `TRV-CAL-SDF-${project?.code || "001"}`,
      projectNo: project?.code || "CALC-001",
      projectName: project?.name || "Sprinkler Hydraulic Calculation",
      client: project?.client || "Consistent Engineering Consultants",
      endUser: project?.location || project?.name || "Main Complex",
      date: new Date().toLocaleDateString("en-GB"),
      userName: currentUserName,
      unitSystem,
    };
    await exportSprinklerDensityExcel(exportData, meta);
  };

  const exportPdf = async () => {
    const exportData = getExportData();
    const meta = {
      calcNo: `TRV-CAL-SDF-${project?.code || "001"}`,
      projectNo: project?.code || "CALC-001",
      projectName: project?.name || "Sprinkler Hydraulic Calculation",
      client: project?.client || "Consistent Engineering Consultants",
      endUser: project?.location || project?.name || "Main Complex",
      date: new Date().toLocaleDateString("en-GB"),
      userName: currentUserName,
      unitSystem,
    };
    await exportSprinklerDensityPDF(exportData, meta);
  };

  const handleUnitToggle = (newUnit: "si" | "ip") => {
    if (newUnit === unitSystem) return;
    setUnitSystem(newUnit);
    if (newUnit === "si") {
      if (coverage !== "") {
        setCoverage(parseFloat((Number(coverage) / 10.7639).toFixed(1)));
      }
    } else {
      if (coverage !== "") {
        setCoverage(parseFloat((Number(coverage) * 10.7639).toFixed(0)));
      }
    }
  };

  return (
    <AppShell
      title="Sprinkler Density & Flow"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">FIRE FIGHTING &gt; SPRINKLER DENSITY &amp; FLOW</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Sprinkler Density &amp; Flow</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">NFPA 13 density/area</span>
                </div>
                <button 
                  onClick={() => setIntelOpen(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                    intelOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  Intelligence
                </button>
                <CalculationReviewBar
                  projectId={project?.id || "default"}
                  calculatorPath="/plumbing-sprinkler-density"
                  calculatorTitle="Sprinkler Density & Flow"
                  onReviewStateChange={setCalcReviewState}
                />
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Preliminary NFPA 13 sprinkler water density, design area, and water supply sizing schedule.
              </p>
            </div>
            
            {/* Unit Switcher */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex rounded-full border border-border p-0.5 bg-surface-2 shrink-0">
                <button
                  disabled={isApprovedLocked}
                  onClick={() => handleUnitToggle("si")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                    unitSystem === "si" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  SI
                </button>
                <button
                  disabled={isApprovedLocked}
                  onClick={() => handleUnitToggle("ip")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                    unitSystem === "ip" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  IP
                </button>
              </div>
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            isApprovedLocked
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  onClick={() => setTab("solver")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "solver"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Calculator
                </button>
                <button
                  onClick={() => setTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "report"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Report
                </button>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4 w-full">
                  {/* Info Header Banner */}
                  <div className="flex items-center gap-3 p-3 bg-surface-2/50 border border-border rounded-xl shadow-2xs">
                    <Info className="size-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-foreground">NFPA 13 Density/Area Method</span>
                      <span className="text-[11.5px] text-muted-foreground font-medium">
                        Determine water flow and pressure demand from hazard category densities.
                      </span>
                    </div>
                  </div>

                  {/* Sizing inputs grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* Hazard Category */}
                    <div className="border border-border rounded-2xl p-3.5 bg-background shadow-xs flex flex-col gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Hazard Category</label>
                      <select
                        disabled={isApprovedLocked}
                        value={hazard}
                        onChange={(e) => setHazard(e.target.value as HazardOpt)}
                        className="w-full h-9.5 px-3 border border-border focus:border-primary rounded-xl bg-background text-[12.5px] outline-none font-medium cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
                      >
                        <option value="0.10,1500">Light Hazard - 0.10 GPM/ft² / 1500 ft²</option>
                        <option value="0.15,1500">Ordinary Hazard Gp 1 - 0.15 / 1500 ft²</option>
                        <option value="0.20,1500">Ordinary Hazard Gp 2 - 0.20 / 1500 ft²</option>
                        <option value="0.30,2500">Extra Hazard Gp 1 - 0.30 / 2500 ft²</option>
                        <option value="0.40,2500">Extra Hazard Gp 2 - 0.40 / 2500 ft²</option>
                        <option value="custom">Custom Parameters...</option>
                      </select>
                    </div>

                    {/* Coverage Area per Sprinkler */}
                    <div className="border border-border rounded-2xl p-3.5 bg-background shadow-xs flex flex-col gap-2">
                      <div className="flex justify-between items-baseline">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Coverage Area / Head</label>
                        <span className="text-[11px] font-bold text-muted-foreground font-mono">
                          {unitSystem === "ip" ? "ft²" : "m²"}
                        </span>
                      </div>
                      <input
                        disabled={isApprovedLocked}
                        type="number"
                        min={unitSystem === "ip" ? 20 : 2}
                        max={unitSystem === "ip" ? 400 : 40}
                        value={coverage}
                        onChange={(e) => setCoverage(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                        className="h-9.5 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[12.5px] font-mono outline-none disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
                      />
                    </div>

                    {/* Sprinkler K-Factor */}
                    <div className="border border-border rounded-2xl p-3.5 bg-background shadow-xs flex flex-col gap-2">
                      <div className="flex justify-between items-baseline">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sprinkler K-Factor</label>
                        <span className="text-[11px] font-bold text-muted-foreground font-mono">
                          {unitSystem === "ip" ? "GPM/√psi" : "L/min/√bar"}
                        </span>
                      </div>
                      <select
                        disabled={isApprovedLocked}
                        value={kFactor}
                        onChange={(e) => setKFactor(parseFloat(e.target.value))}
                        className="h-9.5 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[12.5px] font-medium outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
                      >
                        {STANDARD_K_FACTORS.map(k => (
                          <option key={k} value={k}>
                            K-{k.toFixed(1)} {unitSystem === "si" ? `(${Math.round(k * 14.28)} SI)` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Custom Hazard Parameters */}
                  {hazard === "custom" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="border border-border rounded-2xl p-3.5 bg-background shadow-xs flex flex-col gap-2">
                        <div className="flex justify-between items-baseline">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Custom Density</label>
                          <span className="text-[11px] font-bold text-muted-foreground font-mono">
                            {unitSystem === "ip" ? "GPM/ft²" : "mm/min"}
                          </span>
                        </div>
                        <input
                          disabled={isApprovedLocked}
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="1.0"
                          value={customDens}
                          onChange={(e) => setCustomDens(e.target.value === "" ? "" : parseFloat(e.target.value) || 0.1)}
                          className="h-9.5 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[12.5px] font-mono outline-none disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
                        />
                      </div>

                      <div className="border border-border rounded-2xl p-3.5 bg-background shadow-xs flex flex-col gap-2">
                        <div className="flex justify-between items-baseline">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Custom Design Area</label>
                          <span className="text-[11px] font-bold text-muted-foreground font-mono">
                            {unitSystem === "ip" ? "ft²" : "m²"}
                          </span>
                        </div>
                        <input
                          disabled={isApprovedLocked}
                          type="number"
                          step="50"
                          min="100"
                          value={customArea}
                          onChange={(e) => setCustomArea(e.target.value === "" ? "" : parseFloat(e.target.value) || 1000)}
                          className="h-9.5 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[12.5px] font-mono outline-none disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Calculated Outputs Summary - Fully visible, responsive grid */}
                  <div className="border border-border rounded-2xl bg-card shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-2.5 border-b border-border/80 bg-surface-2/60 flex items-center justify-between">
                      <span className="text-[11.5px] font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                        <Activity className="size-3.5 text-primary" />
                        Calculated Outputs Summary
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        NFPA 13 Hydraulic Demand
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/80">
                      <div className="p-3.5 flex justify-between items-center bg-card">
                        <span className="text-[13px] text-muted-foreground font-medium">Flow rate per head</span>
                        <span className="font-bold font-mono text-foreground text-[14px]">{calcResults.formatFlow(calcResults.flowPerSprink)}</span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center bg-card">
                        <span className="text-[13px] text-muted-foreground font-medium">Min operating pressure</span>
                        <span className="font-bold font-mono text-foreground text-[14px]">{calcResults.formatPressure(calcResults.pressReq)}</span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center bg-card">
                        <span className="text-[13px] text-muted-foreground font-medium">Sprinkler count in area</span>
                        <span className="font-bold font-mono text-foreground text-[14px]">{calcResults.nSprink} heads</span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center bg-card">
                        <span className="text-[13px] text-muted-foreground font-medium">Sprinklers flow demand</span>
                        <span className="font-bold font-mono text-foreground text-[14px]">{calcResults.formatFlow(calcResults.totalSprinkFlow)}</span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center bg-card">
                        <span className="text-[13px] text-muted-foreground font-medium">Hose stream allowance</span>
                        <span className="font-bold font-mono text-foreground text-[14px]">{calcResults.formatFlow(calcResults.hoseAllow)}</span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center bg-primary/5">
                        <span className="text-[13px] text-foreground font-bold flex items-center gap-1.5">
                          <Flame className="size-3.5 text-red-500" />
                          Total water demand
                        </span>
                        <span className="font-extrabold font-mono text-red-500 dark:text-red-400 text-[15px]">{calcResults.formatFlow(calcResults.systemTotal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Warning Messages */}
                  {(calcResults.pressReq < 7 || calcResults.coverFt2 > 225) && (
                    <div className="flex flex-col gap-2">
                      {calcResults.pressReq < 7 && (
                        <div className="border border-destructive/25 bg-destructive/5 text-destructive rounded-2xl p-3 flex gap-2.5 items-center">
                          <AlertTriangle className="size-4 shrink-0 animate-pulse text-destructive" />
                          <div className="text-[12px] leading-snug">
                            <strong className="font-bold">Low Operating Pressure Violation:</strong> Required pressure ({calcResults.formatPressure(calcResults.pressReq)}) is below the NFPA 13 minimum of {unitSystem === "ip" ? "7.0 psi" : "0.48 bar"}. Sizing is invalid. Increase hazard density or use a smaller K-Factor.
                          </div>
                        </div>
                      )}
                      {calcResults.coverFt2 > 225 && (
                        <div className="border border-warning/25 bg-warning/5 text-warning-foreground rounded-2xl p-3 flex gap-2.5 items-center">
                          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                          <div className="text-[12px] text-amber-800 dark:text-amber-200 leading-snug">
                            <strong className="font-bold">Coverage Spacing Warning:</strong> Sprinkler coverage area ({calcResults.formatArea(calcResults.coverFt2)}) exceeds standard maximum spacing limit of {unitSystem === "ip" ? "225 ft²" : "20.9 m²"} per head. Verify listings for extended coverage heads.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* Sizing Report summary */}
            {tab === "report" && (
              <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6 w-full">
                {/* Toolbar */}
                <div className="flex justify-between items-center pb-4 border-b border-border">
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground">Sprinkler Density & Demand Report</h3>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5">Summary of NFPA 13 preliminary water supply requirements.</p>
                  </div>
                  <div className="flex items-center gap-2 no-print print:hidden">
                    <button
                      onClick={exportPdf}
                      className="inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-full text-[12.5px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs transition-all active:scale-95"
                    >
                      <FileText className="size-3.5 text-white" />
                      <span>Export PDF</span>
                    </button>
                  </div>
                </div>

                {/* Four KPI cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                      <Grid className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Design Area</span>
                      <div className="text-[20px] font-extrabold font-mono text-foreground mt-0.5">
                        {calcResults.formatArea(calcResults.designAreaFt2)}
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">{calcResults.nSprink} heads in area</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                      <Droplet className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Discharge / Head</span>
                      <div className="text-[20px] font-extrabold font-mono text-primary mt-0.5">
                        {calcResults.formatFlow(calcResults.flowPerSprink)}
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">K-{kFactor} coefficient</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-sky-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <Activity className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Pressure Required</span>
                      <div className="text-[20px] font-extrabold font-mono text-primary mt-0.5">
                        {calcResults.pressReq.toFixed(1)} <span className="text-[11px] font-normal text-muted-foreground">psi</span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">At remote sprinkler</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                      <Flame className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Total Water Supply</span>
                      <div className="text-[20px] font-extrabold font-mono text-red-500 mt-0.5">
                        {calcResults.formatFlow(calcResults.systemTotal)}
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">With hose allowance</span>
                    </div>
                  </div>
                </div>

                {/* Two Column Layout: Parameters (left) and Audit Sidebar (right) */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  
                  {/* Left Column: Sizing Parameters table */}
                  <div className="flex-1 min-w-0 w-full border border-border rounded-3xl bg-background shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-surface-2/15 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-foreground">Sprinkler Sizing Parameters Preview</span>
                      <span className="text-[11px] text-muted-foreground font-mono">NFPA 13</span>
                    </div>
                    <div className="p-4 flex flex-col gap-4 text-[13px] text-foreground">
                      <div className="grid grid-cols-2 gap-y-2 border-b border-border pb-3">
                        <div>Project Code: <span className="font-semibold font-mono">{project?.code || "CALC-001"}</span></div>
                        <div>Project Name: <span className="font-semibold">{project?.name || "MEP Project"}</span></div>
                        <div>Client Name: <span className="font-semibold">{project?.client || "Client"}</span></div>
                        <div>Hazard Sized: <span className="font-semibold capitalize">{hazard === "custom" ? "Custom" : hazard}</span></div>
                      </div>

                      <table className="w-full text-left border-collapse text-[12.5px]">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
                            <th className="py-2.5">Sizing Parameter</th>
                            <th className="py-2.5 text-right">Value</th>
                            <th className="py-2.5 text-center">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-medium">
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Design Density</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{calcResults.formatDens(calcResults.densIP).split(" ")[0]}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{calcResults.formatDens(calcResults.densIP).split(" ").slice(1).join(" ")}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Design Area</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{calcResults.formatArea(calcResults.designAreaFt2).split(" ")[0]}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{calcResults.formatArea(calcResults.designAreaFt2).split(" ").slice(1).join(" ")}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Coverage per Sprinkler</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{coverage}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{unitSystem === "ip" ? "ft²" : "m²"}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Sprinkler K-Factor</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{kFactor}</td>
                            <td className="py-2.5 text-center text-muted-foreground">gpm/psi⁰·⁵</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Flow Rate per Sprinkler</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{calcResults.formatFlow(calcResults.flowPerSprink).split(" ")[0]}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{calcResults.formatFlow(calcResults.flowPerSprink).split(" ").slice(1).join(" ")}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Sprinkler Count in Area</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{calcResults.nSprink}</td>
                            <td className="py-2.5 text-center text-muted-foreground">heads</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Sprinkler Flow Demand</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{calcResults.formatFlow(calcResults.totalSprinkFlow).split(" ")[0]}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{calcResults.formatFlow(calcResults.totalSprinkFlow).split(" ").slice(1).join(" ")}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 text-muted-foreground">Hose Allowance (NFPA 13)</td>
                            <td className="py-2.5 text-right font-mono font-bold text-foreground">{calcResults.formatFlow(calcResults.hoseAllow).split(" ")[0]}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{calcResults.formatFlow(calcResults.hoseAllow).split(" ").slice(1).join(" ")}</td>
                          </tr>
                          <tr className="bg-surface/50 border-t border-border font-bold">
                            <td className="py-2.5 text-foreground">Total Water Supply Demand</td>
                            <td className="py-2.5 text-right font-mono font-bold text-red-500 text-[14.5px]">{calcResults.formatFlow(calcResults.systemTotal).split(" ")[0]}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{calcResults.formatFlow(calcResults.systemTotal).split(" ").slice(1).join(" ")}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Audits & Recommendations */}
                  <div className="w-full lg:w-[350px] shrink-0 flex flex-col gap-4">
                    {/* Compliance Auditor Card */}
                    {(() => {
                      const hasLowPressure = calcResults.pressReq < 7.0;
                      const hasOverCoverage = calcResults.coverFt2 > 225;
                      
                      if (hasLowPressure) {
                        return (
                          <div className="border border-destructive/20 bg-destructive/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                            <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5 animate-pulse" />
                            <div>
                              <h4 className="text-[13px] font-bold text-destructive">NFPA 13 Code Warning</h4>
                              <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                                Required sprinkler pressure is {calcResults.pressReq.toFixed(1)} psi, which is below the NFPA 13 code minimum limit of 7.0 psi. System is non-compliant.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      if (hasOverCoverage) {
                        return (
                          <div className="border border-warning/20 bg-warning/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                            <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-[13px] font-bold text-warning">Coverage Area Alert</h4>
                              <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                                Sprinkler coverage area ({calcResults.coverFt2.toFixed(0)} ft²) exceeds the standard maximum limit of 225 ft² per head. Check listings for extended coverage.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="border border-success/20 bg-success/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                          <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-[13px] font-bold text-success">NFPA 13 Sizing Audit</h4>
                            <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                              System meets sizing code guidelines. Pressure and coverage requirements comply with general NFPA 13 design criteria.
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Recommendation details card */}
                    <div className="border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-3.5">
                      <p className="text-[13px] font-bold text-foreground leading-snug flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-primary" /> Sizing Recommendations
                      </p>
                      <div className="text-[12px] text-muted-foreground leading-relaxed flex flex-col gap-2.5">
                        {calcResults.pressReq > 35 && (
                          <div className="p-2.5 rounded bg-muted/65 border border-border text-foreground">
                            Operating pressure is very high ({calcResults.pressReq.toFixed(1)} psi). Changing to a larger sprinkler coefficient (e.g. K-8.0 or K-11.2) is recommended to decrease friction loss.
                          </div>
                        )}
                        {calcResults.pressReq < 7 && (
                          <div className="p-2.5 rounded bg-destructive/5 border border-destructive/10 text-foreground">
                            Decrease sprinkler K-Factor (e.g. K-4.2) or increase design density to raise pressure above 7.0 psi.
                          </div>
                        )}
                        {calcResults.pressReq >= 7 && calcResults.pressReq <= 35 && (
                          <div className="p-2.5 rounded bg-success/5 border border-success/10 text-foreground">
                            Operating pressure is optimal ({calcResults.pressReq.toFixed(1)} psi). No adjustments required.
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-1 border-t border-border pt-2 leading-normal">
                          Always check sprinkler manufacturer datasheets for exact listing criteria and k-factor coefficients.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Intelligence Side Drawer */}
        <div
          className={`shrink-0 bg-background overflow-hidden transition-[width] duration-300 ease-out select-none no-print print:hidden ${
            intelOpen ? "w-[360px] border-l border-border" : "w-0"
          }`}
        >
          {intelOpen && (
            <div className="w-[360px] h-full flex flex-col min-h-0 bg-background font-sans">
              <div className="flex items-center justify-between p-4 border-b border-border bg-header-bg shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4.5 text-primary" />
                  <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">Live Intelligence</h3>
                </div>
                <button 
                  onClick={() => setIntelOpen(false)} 
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-surface-2 cursor-pointer transition-colors"
                  title="Close Live Intelligence"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {/* 1. Live Sizing Compliance Card */}
                <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
                      <Activity className="size-4 text-primary" /> System Compliance Audit
                    </span>
                    {calcResults.pressReq >= 7 && calcResults.coverFt2 <= 225 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-success/15 text-success border border-success/30">
                        <Check className="size-3" /> Compliant
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
                        <AlertTriangle className="size-3" /> Attention
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* Pressure audit item */}
                    <div className={`p-3 rounded-2xl border text-[12px] flex flex-col gap-1.5 ${
                      calcResults.pressReq < 7 
                        ? "border-destructive/20 bg-destructive/5" 
                        : calcResults.pressReq > 35 
                        ? "border-warning/20 bg-warning/5" 
                        : "border-success/20 bg-success/5"
                    }`}>
                      <div className="flex items-start gap-2">
                        {calcResults.pressReq < 7 ? (
                          <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                        ) : calcResults.pressReq > 35 ? (
                          <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground">
                            Operating Pressure: {calcResults.pressReq.toFixed(1)} psi
                          </div>
                          <div className="text-[11.5px] text-muted-foreground mt-0.5 leading-normal">
                            {calcResults.pressReq < 7 ? (
                              "Below NFPA 13 minimum 7.0 psi rule. The system violates code standards."
                            ) : calcResults.pressReq > 35 ? (
                              "Operating pressure is elevated (>35 psi). May require heavier pump duty."
                            ) : (
                              "Optimal operating pressure within standard 7.0 to 35.0 psi range."
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Auto-Fix Actions */}
                      {!isApprovedLocked && calcResults.pressReq < 7 && (
                        <div className="pt-2 border-t border-border/40 flex items-center justify-end gap-2">
                          <button
                            onClick={() => setKFactor(4.2)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg cursor-pointer shadow-xs transition-colors"
                          >
                            Set K-4.2 (Fix Pressure)
                          </button>
                        </div>
                      )}
                      {!isApprovedLocked && calcResults.pressReq > 35 && (
                        <div className="pt-2 border-t border-border/40 flex items-center justify-end gap-2">
                          <button
                            onClick={() => setKFactor(8.0)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg cursor-pointer shadow-xs transition-colors"
                          >
                            Upgrade to K-8.0
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Coverage area audit item */}
                    <div className={`p-3 rounded-2xl border text-[12px] flex flex-col gap-1.5 ${
                      calcResults.coverFt2 > 225 
                        ? "border-warning/20 bg-warning/5" 
                        : "border-success/20 bg-success/5"
                    }`}>
                      <div className="flex items-start gap-2">
                        {calcResults.coverFt2 > 225 ? (
                          <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground">
                            Coverage Area: {calcResults.coverFt2.toFixed(0)} ft²
                          </div>
                          <div className="text-[11.5px] text-muted-foreground mt-0.5 leading-normal">
                            {calcResults.coverFt2 > 225 ? (
                              "Exceeds standard 225 ft² limit. Extended coverage listings required."
                            ) : (
                              "Within NFPA 13 standard maximum spacing limit per head."
                            )}
                          </div>
                        </div>
                      </div>

                      {!isApprovedLocked && calcResults.coverFt2 > 225 && (
                        <div className="pt-2 border-t border-border/40 flex items-center justify-end gap-2">
                          <button
                            onClick={() => setCoverage(unitSystem === "ip" ? 130 : 12.1)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg cursor-pointer shadow-xs transition-colors"
                          >
                            Set Standard 130 ft²
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. NFPA 13 Standard Hazard Reference Matrix */}
                <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex flex-col gap-2.5">
                  <h4 className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5">
                    <Droplet className="size-4 text-primary" /> NFPA 13 Hazard Criteria Table
                  </h4>
                  <div className="text-[11px] text-muted-foreground flex flex-col gap-1.5">
                    <div className="grid grid-cols-3 gap-1 p-1.5 rounded-lg bg-surface-2/60 font-mono text-[10.5px]">
                      <span className="font-bold text-foreground">Hazard</span>
                      <span className="font-bold text-foreground text-center">Density / Area</span>
                      <span className="font-bold text-foreground text-right">Hose Allowance</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1.5 py-1 border-b border-border/40 text-[10.5px]">
                      <span className="font-medium text-foreground">Light</span>
                      <span className="text-center font-mono">0.10 / 1500</span>
                      <span className="text-right font-mono">100 GPM</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1.5 py-1 border-b border-border/40 text-[10.5px]">
                      <span className="font-medium text-foreground">Ord. Gp 1</span>
                      <span className="text-center font-mono">0.15 / 1500</span>
                      <span className="text-right font-mono">250 GPM</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1.5 py-1 border-b border-border/40 text-[10.5px]">
                      <span className="font-medium text-foreground">Ord. Gp 2</span>
                      <span className="text-center font-mono">0.20 / 1500</span>
                      <span className="text-right font-mono">250 GPM</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1.5 py-1 border-b border-border/40 text-[10.5px]">
                      <span className="font-medium text-foreground">Extra Gp 1</span>
                      <span className="text-center font-mono">0.30 / 2500</span>
                      <span className="text-right font-mono">500 GPM</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1.5 py-1 text-[10.5px]">
                      <span className="font-medium text-foreground">Extra Gp 2</span>
                      <span className="text-center font-mono">0.40 / 2500</span>
                      <span className="text-right font-mono">500 GPM</span>
                    </div>
                  </div>
                </div>

                {/* 3. Mathematical Formula Breakdown Card */}
                <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex flex-col gap-2">
                  <h4 className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5">
                    <Flame className="size-4 text-red-500" /> Governing Formulas
                  </h4>
                  <ul className="text-[11px] text-muted-foreground list-disc pl-4 flex flex-col gap-1 font-mono bg-surface-2/40 p-2.5 rounded-xl border border-border/50 leading-normal">
                    <li>Discharge per head: <strong>q = d × A_cov</strong></li>
                    <li>Pressure required: <strong>P = (q / K)²</strong></li>
                    <li>Heads in design area: <strong>N = ⌈A_des / A_cov⌉</strong></li>
                    <li>Sprinkler demand: <strong>Q_sp = d × A_design</strong></li>
                    <li>System total: <strong>Q_tot = Q_sp + Q_hose</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
