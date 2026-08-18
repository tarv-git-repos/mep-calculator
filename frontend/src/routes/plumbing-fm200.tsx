import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, FileSpreadsheet, X, HelpCircle
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";

export const Route = createFileRoute("/plumbing-fm200")({
  head: () => ({
    meta: [
      { title: "FM-200 Clean Agent Sizer — MEP Calc" },
      { name: "description", content: "Calculate FM-200 (HFC-227ea) required agent weight for total flooding clean agent suppression per NFPA 2001." },
    ],
  }),
  component: FM200SizerPage,
});

type PresetOption = "class_a" | "class_b" | "class_c" | "custom";

function FM200SizerPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project } = useWorkspace();

  // Tabs & intelligence panel state
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);

  // Unit system
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si"); // Default SI matching source (Sq Mtr, Mtr, kg)

  // Inputs
  const [area, setArea] = useState<number | "">(100);
  const [height, setHeight] = useState<number | "">(3);
  const [preset, setPreset] = useState<PresetOption>("class_a");
  const [customConc, setCustomConc] = useState<number | "">(7.0);
  const [temp, setTemp] = useState<number | "">(20); // Celsius for SI, Fahrenheit for IP
  const [useStandardS, setUseStandardS] = useState<boolean>(true); // Override S to standard 0.1473 (SI)
  const [safetyFactor, setSafetyFactor] = useState<number | "">(1.0);

  // Synchronize design temperature default when unit system changes
  const handleUnitSystemChange = (system: "si" | "ip") => {
    setUnitSystem(system);
    if (system === "si") {
      setTemp(20);
      // Area & Height conversion approximations for convenience
      setArea((prev) => {
        const numericPrev = prev === "" ? 0 : prev;
        return Math.round(numericPrev / 10.7639 * 10) / 10 || 100;
      });
      setHeight((prev) => {
        const numericPrev = prev === "" ? 0 : prev;
        return Math.round(numericPrev / 3.28084 * 10) / 10 || 3;
      });
    } else {
      setTemp(68);
      setArea((prev) => {
        const numericPrev = prev === "" ? 0 : prev;
        return Math.round(numericPrev * 10.7639 * 10) / 10 || 1000;
      });
      setHeight((prev) => {
        const numericPrev = prev === "" ? 0 : prev;
        return Math.round(numericPrev * 3.28084 * 10) / 10 || 10;
      });
    }
  };

  // Sizer math calculation
  const calcResults = useMemo(() => {
    const isSI = unitSystem === "si";
    const areaVal = area === "" ? 0 : area;
    const heightVal = height === "" ? 0 : height;
    const customConcVal = customConc === "" ? 0 : customConc;
    const tempVal = temp === "" ? 0 : temp;
    const safetyFactorVal = safetyFactor === "" ? 1.0 : safetyFactor;

    // Enclosure Volume
    const volume = areaVal * heightVal;

    // Concentration (C)
    let C = 6.857; // Default Class A
    if (preset === "class_b") {
      C = 8.7;
    } else if (preset === "class_c") {
      C = 7.0;
    } else if (preset === "custom") {
      C = customConcVal;
    }

    // Specific Volume (S)
    let S = 0.1473;
    if (useStandardS) {
      // Standard constant
      if (isSI) {
        S = 0.1473; // m³/kg
      } else {
        // IP equivalent of 0.1473 m³/kg is approx 2.3595 ft³/lb
        S = 2.3595; // ft³/lb
      }
    } else {
      // Temperature-dependent Specific Volume per NFPA 2001 formula
      if (isSI) {
        // T is in Celsius
        S = 0.1269 + 0.000513 * tempVal;
      } else {
        // T is in Fahrenheit
        S = 1.885 + 0.0046 * tempVal;
      }
    }

    // Agent Weight calculation (W)
    // W = (V / S) * (C / (100 - C)) * SafetyFactor
    let weight = 0;
    if (S > 0 && 100 - C > 0) {
      weight = (volume / S) * (C / (100 - C)) * safetyFactorVal;
    }

    // Warnings and limits based on NFPA 2001 guidelines
    const warnings: string[] = [];
    if (C > 9.0) {
      warnings.push("Design concentration exceeds the human exposure NOAEL limit of 9.0%. For occupied spaces, limit exposure time per NFPA 2001.");
    }
    if (C > 10.5) {
      warnings.push("Design concentration exceeds the human exposure LOAEL limit of 10.5%. Strictly restrict occupancy or ensure rapid evacuation.");
    }
    if (C < 5.8) {
      warnings.push("Design concentration is below the minimum UL/FM listing concentration of 5.8% for HFC-227ea systems.");
    }
    if (areaVal <= 0 || heightVal <= 0) {
      warnings.push("Area and height must be positive, non-zero values.");
    }

    return {
      volume,
      C,
      S,
      weight,
      warnings
    };
  }, [area, height, preset, customConc, temp, useStandardS, safetyFactor, unitSystem]);

  const areaVal = typeof area === "number" ? area : 0;
  const heightVal = typeof height === "number" ? height : 0;
  const safetyFactorVal = typeof safetyFactor === "number" ? safetyFactor : 1.0;

  // Export to Excel handler
  const exportExcel = () => {
    const isSI = unitSystem === "si";
    const data = [
      { Parameter: `Enclosure Area [${isSI ? "m²" : "ft²"}]`, Value: areaVal.toFixed(2) },
      { Parameter: `Enclosure Height [${isSI ? "m" : "ft"}]`, Value: heightVal.toFixed(2) },
      { Parameter: `Enclosure Volume [${isSI ? "m³" : "ft³"}]`, Value: calcResults.volume.toFixed(2) },
      { Parameter: "Design Concentration (%)", Value: calcResults.C.toFixed(3) },
      { Parameter: `Specific Volume S [${isSI ? "m³/kg" : "ft³/lb"}]`, Value: calcResults.S.toFixed(4) },
      { Parameter: "Safety Multiplier Factor", Value: safetyFactorVal.toFixed(2) },
      { Parameter: `Required FM-200 Weight [${isSI ? "kg" : "lb"}]`, Value: calcResults.weight.toFixed(2) }
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "FM-200 Calculation");
    const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), `FM200_Flooding_Sizer_${project.code}.xlsx`, "Excel Document", ["xlsx"]);
  };

  // Export to PDF handler
  const exportPdf = () => {
    const isSI = unitSystem === "si";
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(220, 76, 52); // Red accent for Fire Fighting
    doc.text("FM-200 Gas Suppression Sizing Report", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Project: ${project.name} (${project.code})`, 14, 28);
    doc.text(`Standard: NFPA 2001 Standard on Clean Agent Fire Extinguishing Systems`, 14, 34);

    const tableData = [
      ["Enclosure Area", areaVal.toFixed(2), isSI ? "m²" : "ft²"],
      ["Enclosure Height", heightVal.toFixed(2), isSI ? "m" : "ft"],
      ["Enclosure Volume", calcResults.volume.toFixed(2), isSI ? "m³" : "ft³"],
      ["Hazard Classification", preset.replace("_", " ").toUpperCase(), ""],
      ["Design Concentration (C)", calcResults.C.toFixed(3), "%"],
      ["Design Temp (T)", temp.toString(), isSI ? "°C" : "°F"],
      ["Specific Volume (S)", calcResults.S.toFixed(4), isSI ? "m³/kg" : "ft³/lb"],
      ["Safety Margin Factor", safetyFactorVal.toFixed(2), ""],
      ["Required FM-200 Agent Weight", calcResults.weight.toFixed(2), isSI ? "kg" : "lb"]
    ];

    autoTable(doc, {
      startY: 42,
      head: [["Design Parameter", "Calculated Value", "Unit"]],
      body: tableData,
      theme: "striped",
      styles: { fontSize: 10 },
      headStyles: { fillColor: [220, 76, 52] } // Match fire theme
    });

    // Add hold time and safety guidelines disclaimer
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("System Design Warnings / Notes:", 14, finalY);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("- Enclosure leakage testing (Door Fan Test) is required to ensure 10-minute agent retention holding time.", 14, finalY + 5);
    doc.text("- Max discharge time target: 10 seconds per NFPA 2001 to prevent high concentration of decomposition products.", 14, finalY + 9);
    if (calcResults.C > 9.0) {
      doc.text("- WARNING: Design concentration exceeds human exposure limits for occupied zones.", 14, finalY + 13);
    }

    
    const sigFinalY = (doc as any).lastAutoTable?.finalY || 40;
    addPdfSignatureBlock(doc, sigFinalY, currentUserName, project?.id || "default", "plumbing-fm200");
    const pdfBuffer = doc.output("arraybuffer");
    downloadFile(new Uint8Array(pdfBuffer), `FM200_Sizing_Report_${project.code}.pdf`, "PDF Document", ["pdf"]);
  };

  return (
    <AppShell
      title="FM-200 Calculation"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
      intelLabel="Reference & Guide"
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg px-6">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">FIRE FIGHTING &gt; FM-200 CLEAN AGENT SIZER</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">FM-200 Gas Sizing</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">Total flooding clean agent sizer (NFPA 2001)</span>
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
                  Reference & Guide
                </button>
              </div>
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className="bg-card border border-border rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden mx-6 mb-6">
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
                  Sizing Calculator
                </button>
                <button
                  onClick={() => setTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "report"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Printable Report
                </button>
              </div>

              {/* Sizing Unit system toggle */}
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/85">
                <button
                  onClick={() => handleUnitSystemChange("ip")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    unitSystem === "ip"
                      ? "bg-background text-primary shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Imperial (IP)
                </button>
                <button
                  onClick={() => handleUnitSystemChange("si")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    unitSystem === "si"
                      ? "bg-background text-primary shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Metric (SI)
                </button>
              </div>
            </div>
        {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" && (
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
                {/* Inputs Section */}
                <div className="flex-1 min-w-0 p-6 flex flex-col gap-6 max-w-3xl">

                    {/* Room Enclosure Dimensions Card */}
                    <div className="border border-border rounded-3xl bg-background shadow-sm overflow-hidden">
                      <div className="bg-surface px-4 py-2 border-b border-border flex items-center justify-between">
                        <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-foreground">Enclosure Layout</h3>
                        <span className="text-[11px] font-mono text-muted-foreground">Dimensions</span>
                      </div>
                      <div className="p-4 grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Floor Area ({unitSystem === "si" ? "m²" : "ft²"})
                          </label>
                          <input
                            type="number"
                            value={area}
                            onChange={(e) => setArea(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                            className="h-10 rounded-xl border border-border px-3 text-[12.5px] bg-background text-foreground focus:border-primary focus:outline-none"
                            placeholder="e.g. 100"
                            step="any"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Enclosure Height ({unitSystem === "si" ? "m" : "ft"})
                          </label>
                          <input
                            type="number"
                            value={height}
                            onChange={(e) => setHeight(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                            className="h-10 rounded-xl border border-border px-3 text-[12.5px] bg-background text-foreground focus:border-primary focus:outline-none"
                            placeholder="e.g. 3"
                            step="any"
                          />
                        </div>
                      </div>
                    </div>

                    {/* NFPA 2001 Design Presets Card */}
                    <div className="border border-border rounded-3xl bg-background shadow-sm overflow-hidden">
                      <div className="bg-surface px-4 py-2 border-b border-border flex items-center justify-between">
                        <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-foreground">Design Parameters</h3>
                        <span className="text-[11px] font-mono text-muted-foreground">NFPA 2001</span>
                      </div>
                      <div className="p-4 flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Presets */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              Hazard Classification
                            </label>
                            <select
                              value={preset}
                              onChange={(e) => setPreset(e.target.value as PresetOption)}
                              className="h-10 rounded-xl border border-border px-3 text-[12.5px] bg-background text-foreground focus:border-primary focus:outline-none"
                            >
                              <option value="class_a">Class A - Surface Fire (6.857%)</option>
                              <option value="class_c">Class C - Electrical Hazards (7.00%)</option>
                              <option value="class_b">Class B - Flammable Liquid (8.70%)</option>
                              <option value="custom">Custom Concentration %</option>
                            </select>
                          </div>

                          {/* Custom Concentration (if custom) */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              Design Concentration (C %)
                            </label>
                            <input
                              type="number"
                              disabled={preset !== "custom"}
                              value={preset === "custom" ? customConc : calcResults.C}
                              onChange={(e) => setCustomConc(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                              className="h-10 rounded-xl border border-border px-3 text-[12.5px] bg-background text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2 disabled:text-muted-foreground"
                              placeholder="e.g. 7.0"
                              step="0.01"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                          {/* Minimum Temperature */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              Minimum Temperature ({unitSystem === "si" ? "°C" : "°F"})
                            </label>
                            <input
                              type="number"
                              value={temp}
                              onChange={(e) => setTemp(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                              className="h-10 rounded-xl border border-border px-3 text-[12.5px] bg-background text-foreground focus:border-primary focus:outline-none"
                              placeholder="e.g. 20"
                              step="any"
                            />
                          </div>

                          {/* Safety Factor */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              Safety Factor Multiplier
                            </label>
                            <input
                              type="number"
                              value={safetyFactor}
                              onChange={(e) => setSafetyFactor(e.target.value === "" ? "" : parseFloat(e.target.value) || 1.0)}
                              className="h-10 rounded-xl border border-border px-3 text-[12.5px] bg-background text-foreground focus:border-primary focus:outline-none"
                              placeholder="e.g. 1.0"
                              step="0.05"
                            />
                          </div>
                        </div>

                        {/* Specific Volume Switcher */}
                        <div className="flex items-center justify-between border-t border-border pt-4">
                          <div className="flex flex-col">
                            <span className="text-[12.5px] font-medium text-foreground">Lock S Value to Standard Default</span>
                            <span className="text-[11px] text-muted-foreground">
                              Forces $S$ to {unitSystem === "si" ? "0.1473 m³/kg" : "2.3595 ft³/lb"} (Baseline reference temperature)
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={useStandardS}
                            onChange={(e) => setUseStandardS(e.target.checked)}
                            className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Step-by-Step Calculations Explanation */}
                    {(area !== "" && height !== "") && (
                      <div className="border border-border rounded-3xl bg-background p-4 shadow-sm flex flex-col gap-3">
                        <div className="flex items-center gap-2 border-b border-border pb-2">
                          <FileText className="size-4 text-primary" />
                          <h4 className="text-[13px] font-bold uppercase tracking-wider text-foreground">NFPA 2001 Formula Breakdown</h4>
                        </div>
                        <div className="text-[12.5px] text-foreground space-y-2.5">
                          <p>
                            The clean agent flooding weight is calculated according to NFPA 2001 Clause 5.5.1:
                          </p>
                          <div className="bg-surface-2 p-3 rounded-2xl font-mono text-[11.5px] text-center border border-border">
                            W = (V / S) × (C / (100 - C)) × SafetyFactor
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between border-b border-border/40 py-1">
                              <span className="font-semibold">V (Volume):</span>
                              <span>
                                {areaVal.toFixed(2)} × {heightVal.toFixed(2)} = {calcResults.volume.toFixed(2)} {unitSystem === "si" ? "m³" : "ft³"}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-border/40 py-1">
                              <span className="font-semibold">S (Specific Volume):</span>
                              <span>
                                {useStandardS 
                                  ? `${calcResults.S.toFixed(4)} (Locked baseline)`
                                  : unitSystem === "si"
                                    ? `0.1269 + (0.000513 × ${temp}°C) = ${calcResults.S.toFixed(4)} m³/kg`
                                    : `1.885 + (0.0046 × ${temp}°F) = ${calcResults.S.toFixed(4)} ft³/lb`}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-border/40 py-1">
                              <span className="font-semibold">C (Design Concentration):</span>
                              <span>{calcResults.C.toFixed(3)} %</span>
                            </div>
                            <div className="flex justify-between border-b border-border/40 py-1">
                              <span className="font-semibold">Safety Multiplier:</span>
                              <span>{safetyFactorVal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-1 text-primary font-semibold">
                              <span>Total Weight (W):</span>
                              <span>
                                ({calcResults.volume.toFixed(2)} / {calcResults.S.toFixed(4)}) × ({calcResults.C.toFixed(3)} / {(100 - calcResults.C).toFixed(3)}) × {safetyFactorVal.toFixed(2)} = {calcResults.weight.toFixed(2)} {unitSystem === "si" ? "kg" : "lb"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Results Panel */}
                  <div className="w-full md:w-80 shrink-0 bg-surface/50 p-6 flex flex-col gap-6">
                    <div>
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">Calculation Results</h3>
                      <p className="text-[11.5px] text-muted-foreground">Flooding weight outputs</p>
                    </div>

                    <div className="flex flex-col gap-4">
                      {/* Enclosure Volume result card */}
                      <div className="border border-border rounded-3xl bg-background p-4 flex flex-col gap-1 shadow-sm">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Flooded Enclosure Volume</span>
                        <div className="text-[20px] font-bold tracking-tight font-mono text-primary">
                          {calcResults.volume.toFixed(2)} <span className="text-[13px] font-normal">{unitSystem === "si" ? "m³" : "ft³"}</span>
                        </div>
                      </div>

                      {/* Required Gas Weight result card */}
                      <div className="border border-border rounded-3xl bg-background p-4 flex flex-col gap-1 shadow-sm border-l-4 border-l-primary">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Required FM-200 Agent Weight</span>
                        <div className="text-[24px] font-bold tracking-tight font-mono text-primary">
                          {calcResults.weight.toFixed(2)} <span className="text-[14px] font-normal">{unitSystem === "si" ? "kg" : "lb"}</span>
                        </div>
                        <span className="text-[10.5px] text-muted-foreground mt-1">Design Concentration: {calcResults.C.toFixed(2)}%</span>
                      </div>

                      {/* Warning alerts block */}
                      {calcResults.warnings.length > 0 && (
                        <div className="border border-warning/20 bg-warning/5 rounded-3xl p-3 text-[12px] flex flex-col gap-1.5 text-foreground">
                          <div className="flex items-center gap-1.5 text-warning font-semibold">
                            <AlertTriangle className="size-4 shrink-0" />
                            <span>NFPA 2001 Compliance Warning</span>
                          </div>
                          <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[11px]">
                            {calcResults.warnings.map((warn, i) => (
                              <li key={i}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Schematic Visual Representation SVG */}
                      <div className="border border-border rounded-3xl bg-background p-3 shadow-sm flex flex-col gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Agent Sizing Chart</span>
                        <div className="bg-surface/50 rounded-2xl flex justify-center py-2 border border-border/50">
                          <svg width="220" height="150" className="overflow-visible">
                            {/* Room Enclosure Box */}
                            <rect x="20" y="20" width="180" height="90" rx="12" fill="none" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="3 3" />
                            
                            {/* Gas flooding overlay */}
                            <rect 
                              x="21" 
                              y="21" 
                              width="178" 
                              height="88" 
                              rx="11" 
                              fill="#0A7BC7" 
                              fillOpacity={calcResults.weight > 0 ? 0.15 : 0.02} 
                            />
                            
                            {/* Nozzles and system representation */}
                            <circle cx="65" cy="20" r="3" fill="#ef4444" />
                            <circle cx="155" cy="20" r="3" fill="#ef4444" />
                            <line x1="65" y1="20" x2="65" y2="35" stroke="#ef4444" strokeWidth="1.5" />
                            <line x1="155" y1="20" x2="155" y2="35" stroke="#ef4444" strokeWidth="1.5" />
                            
                            {/* Gas spray arcs */}
                            <path d="M 60 38 Q 65 33 70 38" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.8" />
                            <path d="M 57 41 Q 65 31 73 41" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.6" />
                            <path d="M 150 38 Q 155 33 160 38" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.8" />
                            <path d="M 147 41 Q 155 31 163 41" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.6" />

                            {/* Center Room Label */}
                            <text x="110" y="65" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#334155">
                              {calcResults.volume.toFixed(1)} {unitSystem === "si" ? "m³" : "ft³"}
                            </text>
                            
                            {/* Specific Volume and Agent label */}
                            <text x="110" y="82" textAnchor="middle" fontSize="9" fill="#64748B">
                              FM-200 Flooding Room
                            </text>

                            {/* Weight Tag at bottom */}
                            <rect x="50" y="120" width="120" height="22" rx="11" fill="#ef4444" fillOpacity="0.1" stroke="#ef4444" strokeWidth="1" />
                            <text x="110" y="134" textAnchor="middle" fontSize="10.5" fontWeight="bold" fill="#ef4444">
                              Weight: {calcResults.weight.toFixed(1)} {unitSystem === "si" ? "kg" : "lb"}
                            </text>
                          </svg>
                        </div>
                      </div>

                      {/* Export buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={exportPdf}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-xl border border-border text-[12px] font-semibold bg-background hover:bg-surface-2 text-foreground transition-colors cursor-pointer"
                        >
                          <FileText className="size-3.5 text-danger" /> PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Design Summary */}
            {tab === "report" && (
              <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-surface/30">
                <div className="max-w-3xl mx-auto flex flex-col gap-6">
                  <div className="border border-border rounded-3xl bg-background p-6 flex flex-col gap-5 shadow-sm">
                    <div className="flex justify-between items-start border-b border-border pb-4">
                      <div>
                        <h2 className="text-[16px] font-bold text-foreground">Clean Agent Design Sizing Sheet</h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5">Calculated parameters for room fire flooding protection</p>
                      </div>
                      <button
                        onClick={exportPdf}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/95 transition-colors cursor-pointer shadow-sm"
                      >
                        <Printer className="size-3.5" /> Print Report
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px] border-b border-border pb-5">
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-muted-foreground">Project Name</span>
                        <span className="font-semibold text-foreground">{project.name}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-muted-foreground">Project Code</span>
                        <span className="font-semibold font-mono text-foreground">{project.code}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-muted-foreground">Design Volume</span>
                        <span className="font-semibold text-foreground">
                          {calcResults.volume.toFixed(2)} {unitSystem === "si" ? "m³" : "ft³"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-muted-foreground">FM-200 Weight Required</span>
                        <span className="font-semibold text-primary">
                          {calcResults.weight.toFixed(2)} {unitSystem === "si" ? "kg" : "lb"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-muted-foreground">Concentration (C)</span>
                        <span className="font-semibold text-foreground">{calcResults.C.toFixed(3)} %</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-muted-foreground">Specific Volume (S)</span>
                        <span className="font-semibold text-foreground">
                          {calcResults.S.toFixed(4)} {unitSystem === "si" ? "m³/kg" : "ft³/lb"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-muted-foreground">Design Temp</span>
                        <span className="font-semibold text-foreground">
                          {temp} {unitSystem === "si" ? "°C" : "°F"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-muted-foreground">Safety Multiplier Factor</span>
                        <span className="font-semibold text-foreground">{safetyFactorVal.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="text-[12.5px] text-muted-foreground flex flex-col gap-2.5">
                      <div className="font-semibold text-foreground">Standard Notes:</div>
                      <p>
                        This report qualifies agent calculations per the **NFPA 2001 (Standard on Clean Agent Fire Extinguishing Systems)** equations.
                        Calculations are validated based on standard superheated vapor specific volumes of HFC-227ea.
                      </p>
                      <p>
                        Actual installation requires hydraulic pipe routing verification using manufacturer-specific software to check flow balancing, pipe size schedules, nozzle orifice diameters, and split-tee flow distributions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Intelligence Side Drawer */}
        {intelOpen && (
          <div className="w-80 border-l border-border bg-background shrink-0 flex flex-col h-full overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface">
              <div className="flex items-center gap-2">
                <Info className="size-4.5 text-primary" />
                <span className="font-bold text-[13px] uppercase tracking-wider text-foreground">NFPA 2001 Guidelines</span>
              </div>
              <button
                onClick={() => setIntelOpen(false)}
                className="size-6 rounded hover:bg-surface-2 grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-[12.5px] leading-relaxed text-foreground">
              <div>
                <h4 className="font-bold text-primary mb-1">What is FM-200?</h4>
                <p className="text-muted-foreground text-[12px]">
                  FM-200 (chemically HFC-227ea / heptafluoropropane) is a zero ozone-depleting clean agent chemical replacement for Halon 1301. It extinguishes fires by a combination of thermal absorbency and chemical disruption of the flame.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-primary mb-1">Hold Time Target</h4>
                <p className="text-muted-foreground text-[12px]">
                  Per NFPA 2001, the room enclosure must retain the minimum design concentration for at least **10 minutes** (Hold Time) or until emergency responders arrive, to prevent hot surfaces from triggering re-ignition.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-primary mb-1">Enclosure Integrity Testing</h4>
                <p className="text-muted-foreground text-[12px]">
                  Hold time is verified using a door fan room pressurization integrity test. Leakage at floor level and top ceilings can cause the heavy gas to drain quickly out of the space.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-primary mb-1">Discharge Time Requirement</h4>
                <p className="text-muted-foreground text-[12px]">
                  The entire calculated agent weight must be discharged into the protected enclosure within **10 seconds** to establish extinguishing concentration rapidly and minimize decomposition products (HF acid vapor).
                </p>
              </div>

              <div className="border-t border-border pt-3">
                <h4 className="font-bold text-primary mb-1">Human Exposure Limits</h4>
                <div className="space-y-1 mt-1 text-[11.5px] text-muted-foreground">
                  <div className="flex justify-between border-b border-border/40 pb-0.5">
                    <span>NOAEL Limit</span>
                    <span className="font-bold text-foreground">9.0 %</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-0.5">
                    <span>LOAEL Limit</span>
                    <span className="font-bold text-foreground">10.5 %</span>
                  </div>
                </div>
                <p className="text-muted-foreground text-[11px] mt-1.5 italic">
                  Note: If design concentration exceeds 9.0%, restricted egress times and self-contained breathing apparatus must be assessed.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
