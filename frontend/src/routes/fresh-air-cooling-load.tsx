import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { calculateFreshAirCoolingLoad, calculateFreshAirWarnings } from "@/lib/calc-fresh-air";
import { useAuth } from "@/contexts/AuthContext";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { cToF, fToC, m3sToCfm, cfmToM3s } from "@/utils/conversions";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  Download, Upload, Sparkles, AlertTriangle, CheckCircle2,
  Info, Gauge, FileText, Printer, FileSpreadsheet, Bookmark, HelpCircle,
  Wrench, MessageSquare, Wind, Droplets, Thermometer, Activity, RefreshCw,
  Copy, X, ChevronDown
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { api } from "@/services/api";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { toast } from "sonner";

export const Route = createFileRoute("/fresh-air-cooling-load")({
  head: () => ({
    meta: [
      { title: "Fresh Air Cooling Load — MEP Calc" },
      { name: "description", content: "Fresh Air Cooling Load calculator for sensible, latent, total loads, and coil sizing." },
    ],
  }),
  component: FreshAirCoolingLoadPage,
});



function FreshAirCoolingLoadPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/fresh-air-cooling-load", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/fresh-air-cooling-load", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState({
    projectName: "Commercial Fresh Air Treatment Plant",
    projectNumber: "MEP-FA-01",
    client: "Al Futtaim Developments",
    consultant: "Consistent Engineering Consultants",
    date: new Date().toISOString().split("T")[0],
    revision: "Rev 0",
    calcNumber: "CALC-HVAC-FA01",
    notes: "Outdoor fresh air conditioning coil sensible, latent, and total heat load sizing study.",
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [dbIn, setDbIn] = useState<number | "">(35);
  const [wbIn, setWbIn] = useState<number | "">(26);
  const [dbOut, setDbOut] = useState<number | "">(13);
  const [wbOut, setWbOut] = useState<number | "">(12);
  const [flowRate, setFlowRate] = useState<number | "">(0.472);
  const [safetyFactor, setSafetyFactor] = useState<number>(5);
  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [showFormulaPanel, setShowFormulaPanel] = useState(false);
  const [showCalcPreviewModal, setShowCalcPreviewModal] = useState(false);

  // Comment System State
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const isApprovedLocked = calcReviewState?.status === "APPROVED";

  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleScrollTarget = (targetId: string, targetName?: string) => {
    if (!targetId) return;
    const cleanId = (targetId || "").toLowerCase().trim();
    const cleanRaw = cleanId.replace(/^(field-|card-|res-)/, "");
    const cleanName = (targetName || "").toLowerCase().trim();

    const el = document.getElementById(targetId || "") ||
               document.getElementById(`field-${cleanRaw}`) ||
               document.getElementById(`card-${cleanRaw}`) ||
               document.querySelector(`[data-field-id="${cleanRaw}"]`) ||
               document.querySelector(`[data-comment-target="${cleanRaw}"]`);

    setHighlightedTargetId(cleanRaw || cleanId || targetId || null);

    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedTargetId(null);
      highlightTimeoutRef.current = null;
    }, 4500);

    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  

  
  const isFieldHighlighted = (id: string, name?: string) => {
    if (!highlightedTargetId) return false;
    const cleanHigh = highlightedTargetId.toLowerCase().trim();
    const cleanId = id.toLowerCase().trim();
    const cleanName = (name || "").toLowerCase().trim();
    return cleanHigh === cleanId || cleanHigh === cleanName || cleanId.includes(cleanHigh) || cleanName.includes(cleanHigh);
  };

  const renderCommentBadge = (id: string, name: string) => {
    const itemComments = getMergedItemComments(id, name, commentsList.filter(c => c.targetId === id || c.targetName === name || c.spaceId === id || c.itemId === id), "/fresh-air-cooling-load", project?.id);
    if (itemComments.length === 0) return null;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenComment(id, name);
        }}
        title={`${itemComments.length} comment(s)/task(s) on ${name}`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 ml-2 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 dark:hover:bg-blue-900 transition cursor-pointer shadow-xs select-none border border-blue-300/60 dark:border-blue-700/60 shrink-0"
      >
        <MessageSquare className="size-3.5 fill-blue-500/25 text-blue-600 dark:text-blue-400" />
        <span className="text-[10px] font-extrabold">{itemComments.length}</span>
      </button>
    );
  };

  const ip = unitSystem === "ip";

  useEffect(() => {
    try {
      const pId = project?.id || "default";
      const savedComments = localStorage.getItem(`mep_calc_comments_${pId}_/fresh-air-cooling-load`);
      if (savedComments) {
        setCommentsList(JSON.parse(savedComments));
      }
    } catch (e) {
      console.error(e);
    }
  }, [project?.id]);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    try {
      const pId = project?.id || "default";
      localStorage.setItem(`mep_calc_comments_${pId}_/fresh-air-cooling-load`, JSON.stringify(newList));
    } catch (e) {
      console.error(e);
    }
  };

  // Load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`mep_fresh_air_calc_params_${project?.id || "default"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dbIn !== undefined) setDbIn(parsed.dbIn);
        if (parsed.wbIn !== undefined) setWbIn(parsed.wbIn);
        if (parsed.dbOut !== undefined) setDbOut(parsed.dbOut);
        if (parsed.wbOut !== undefined) setWbOut(parsed.wbOut);
        if (parsed.flowRate !== undefined) setFlowRate(parsed.flowRate);
        if (parsed.safetyFactor !== undefined) setSafetyFactor(parsed.safetyFactor);
        if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      }
    } catch (e) {
      console.error(e);
      if (project?.id) setLoadedProjectId(project.id); else setLoadedProjectId("loaded");
    }
  }, [project?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(`mep_fresh_air_calc_params_${project?.id || "default"}`, JSON.stringify({
        dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, unitSystem, projectInfo
      }));
      dirtyStore.set(true);
    } catch (e) {
      console.error(e);
    }
  }, [dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, unitSystem, projectInfo, project?.id]);

  useEffect(() => {
    const handleSaveTrigger = (e: any) => {
      try {
        if (e.detail) e.detail.handled = true;
        forceSaveToCloud?.();
        toast.success("Fresh Air Cooling Load calculation saved successfully!");
      } catch (err) {}
    };
    window.addEventListener("mep-trigger-save", handleSaveTrigger);
    return () => window.removeEventListener("mep-trigger-save", handleSaveTrigger);
  }, [forceSaveToCloud]);

  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (targetUnit === unitSystem) return;
    if (isEffectiveReadOnly) {
      toast.info("Calculation is currently APPROVED and locked. Unlock calculation to edit.", { id: "readonly-notice" });
      return;
    }
    setUnitSystem(targetUnit);

    if (shouldConvert) {
      const convT = (t: number) => targetUnit === "ip" ? cToF(t) : fToC(t);
      const convF = (f: number) => targetUnit === "ip" ? m3sToCfm(f) : cfmToM3s(f);

      setDbIn(dbIn !== "" ? Number(convT(Number(dbIn)).toFixed(1)) : "");
      setWbIn(wbIn !== "" ? Number(convT(Number(wbIn)).toFixed(1)) : "");
      setDbOut(dbOut !== "" ? Number(convT(Number(dbOut)).toFixed(1)) : "");
      setWbOut(wbOut !== "" ? Number(convT(Number(wbOut)).toFixed(1)) : "");
      setFlowRate(flowRate !== "" ? Number(convF(Number(flowRate)).toFixed(targetUnit === "ip" ? 0 : 3)) : "");
    }
    toast.info(`Switched to ${targetUnit === "ip" ? "Imperial (IP)" : "Metric (SI)"} units`);
  };



  // Calculation Engine
  const calc = useMemo(() => calculateFreshAirCoolingLoad(dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, ip), [dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, ip]);
  const warnings = useMemo(() => calculateFreshAirWarnings(dbIn, wbIn, dbOut, wbOut, calc.shr, ip), [dbIn, wbIn, dbOut, wbOut, calc.shr, ip]);

  const handleExportExcel = async () => {
    const exceljsModule = await import('exceljs');
    const ExcelJS = exceljsModule.default || (window as any).ExcelJS;
    const fileSaverModule = await import('file-saver');
    const saveAs = fileSaverModule.saveAs || fileSaverModule.default?.saveAs || fileSaverModule.default || ((window as any).saveAs);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Fresh Air Cooling Load");

    sheet.getColumn(1).width = 28;
    sheet.getColumn(2).width = 24;
    sheet.getColumn(3).width = 12;
    sheet.getColumn(4).width = 30;
    sheet.getColumn(5).width = 40;

    sheet.mergeCells("A1:E1");
    const cellA1 = sheet.getCell("A1");
    cellA1.value = "FRESH AIR COOLING LOAD REPORT";
    cellA1.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFF" } };
    cellA1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0A7BC7" } };
    cellA1.alignment = { horizontal: "center" };

    sheet.addRow([]);
    sheet.addRow(["Project Information"]);
    sheet.getCell("A3").font = { name: "Segoe UI", size: 12, bold: true };
    sheet.addRow(["Project Name", projectInfo.projectName]);
    sheet.addRow(["Project Number", projectInfo.projectNumber]);
    sheet.addRow(["Consultant", projectInfo.consultant]);
    sheet.addRow(["Client", projectInfo.client]);
    sheet.addRow(["Date / Rev", `${projectInfo.date} / ${projectInfo.revision}`]);

    const uT = ip ? "°F" : "°C";
    const uL = ip ? "BTU/h" : "kW";
    const uW = ip ? "gr/lb" : "kg/kg";

    sheet.addRow([]);
    sheet.addRow(["Fresh Air Input Parameters"]);
    sheet.getCell("A10").font = { name: "Segoe UI", size: 12, bold: true };
    sheet.addRow(["Entering Dry Bulb (DB)", `${dbIn} ${uT}`]);
    sheet.addRow(["Entering Wet Bulb (WB)", `${wbIn} ${uT}`]);
    sheet.addRow(["Entering Rel. Humidity", `${calc.rhIn.toFixed(1)} %`]);
    sheet.addRow(["Entering Humidity Ratio", `${calc.wIn.toFixed(ip ? 2 : 5)} ${uW}`]);
    sheet.addRow(["Leaving Dry Bulb (DB)", `${dbOut} ${uT}`]);
    sheet.addRow(["Leaving Wet Bulb (WB)", `${wbOut} ${uT}`]);
    sheet.addRow(["Leaving Rel. Humidity", `${calc.rhOut.toFixed(1)} %`]);
    sheet.addRow(["Leaving Humidity Ratio", `${calc.wOut.toFixed(ip ? 2 : 5)} ${uW}`]);
    sheet.addRow(["Fresh Air Flowrate", `${flowRate} ${ip ? "CFM" : "m³/s"}`]);
    sheet.addRow(["Safety Margin Factor", `${safetyFactor} %`]);

    sheet.addRow([]);
    sheet.addRow(["Cooling Coil Sizing Results"]);
    sheet.getCell("A22").font = { name: "Segoe UI", size: 12, bold: true };
    sheet.addRow(["Sensible Heat Load", `${calc.sensLoad.toFixed(2)} ${uL} (${(calc.sensKw).toFixed(2)} kW)`]);
    sheet.addRow(["Latent Heat Load", `${calc.latLoad.toFixed(2)} ${uL} (${(calc.latKw).toFixed(2)} kW)`]);
    sheet.addRow(["Total Fresh Air Load", `${calc.totLoad.toFixed(2)} ${uL} (${(calc.totKw).toFixed(2)} kW)`]);
    sheet.addRow(["Sensible Heat Ratio (SHR)", `${calc.shr.toFixed(2)}`]);
    sheet.addRow(["Required Coil Capacity", `${calc.capacityTons.toFixed(2)} TR`]);
    sheet.addRow(["Condensate Removal Rate", `${calc.condensateKgH.toFixed(2)} L/h (${calc.condensateGph.toFixed(2)} GPH)`]);

    const sigRow = (sheet as any).rowCount ? (sheet as any).rowCount + 2 : 30;
    const { addExcelSignatureBlock } = await import("@/lib/excelHelpers");
    addExcelSignatureBlock(sheet, sigRow, currentUserName, project?.id || "default", "fresh-air-cooling-load");
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${projectInfo.projectName.replace(/\s+/g, "_")}_fresh_air_cooling_load.xlsx`);
  };

  const handlePrintPDF = async () => {
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF("p", "pt", "a4");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("FRESH AIR COOLING LOAD SIZING REPORT", 40, 50);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated on: ${projectInfo.date} | Calculation Code: ${projectInfo.calcNumber}`, 40, 68);

    doc.setDrawColor(200);
    doc.line(40, 78, 555, 78);

    // Project Info
    autoTable(doc, {
      startY: 90,
      head: [["Project Information", "Details", "Engineering Reference", "Status"]],
      body: [
        ["Project Name", projectInfo.projectName, "Standard", "ASHRAE 62.1 & Psychrometrics"],
        ["Project Number", projectInfo.projectNumber, "Consultant", projectInfo.consultant],
        ["Client", projectInfo.client, "Revision", projectInfo.revision],
      ],
      theme: "grid",
      headStyles: { fillColor: [10, 123, 199], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
    });

    const uT = ip ? "°F" : "°C";
    const uL = ip ? "BTU/h" : "kW";
    const uW = ip ? "gr/lb" : "kg/kg";

    // Inputs Table
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [["State Property", "Entering Air (OA)", "Leaving Coil Air", "Unit"]],
      body: [
        ["Dry Bulb Temperature", `${dbIn} ${uT}`, `${dbOut} ${uT}`, uT],
        ["Wet Bulb Temperature", `${wbIn} ${uT}`, `${wbOut} ${uT}`, uT],
        ["Relative Humidity (RH)", `${calc.rhIn.toFixed(1)} %`, `${calc.rhOut.toFixed(1)} %`, "%"],
        ["Humidity Ratio (W)", `${calc.wIn.toFixed(ip ? 2 : 5)} ${uW}`, `${calc.wOut.toFixed(ip ? 2 : 5)} ${uW}`, uW],
        ["Airflow Design Rate", `${flowRate} ${ip ? "CFM" : "m³/s"}`, `${calc.flowLps.toFixed(1)} L/s`, "Design Vol."],
        ["Safety Margin Added", `${safetyFactor} %`, "Included in Sizing", "%"],
      ],
      theme: "striped",
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
    });

    // Sizing Output Table
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [["Coil Duty Output Item", "Calculated Value", "Equivalent Metric", "Engineering Impact"]],
      body: [
        ["Sensible Heat Load (Q_sens)", `${calc.sensLoad.toFixed(2)} ${uL}`, `${calc.sensKw.toFixed(2)} kW`, "Temperature Drop Power"],
        ["Latent Heat Load (Q_lat)", `${calc.latLoad.toFixed(2)} ${uL}`, `${calc.latKw.toFixed(2)} kW`, "Moisture Dehumidification"],
        ["Total Fresh Air Heat Load (Q_tot)", `${calc.totLoad.toFixed(2)} ${uL}`, `${calc.totKw.toFixed(2)} kW`, "Total Coil Thermal Duty"],
        ["Sensible Heat Ratio (SHR)", `${calc.shr.toFixed(2)}`, `${(calc.shr * 100).toFixed(1)} % Sensible`, "Coil Selection Factor"],
        ["Required Coil Capacity", `${calc.capacityTons.toFixed(2)} TR`, `${calc.totKw.toFixed(2)} kW`, "Nominal Plant Sizing"],
        ["Condensate Drainage Sizing", `${calc.condensateKgH.toFixed(2)} L/h`, `${calc.condensateGph.toFixed(2)} GPH`, "Condensate Drain Pipe"],
      ],
      theme: "grid",
      headStyles: { fillColor: [10, 123, 199], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 5 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 25;
    const { addPdfSignatureBlock } = await import("@/lib/pdfHelpers");
    addPdfSignatureBlock(doc, finalY, currentUserName, project?.id || "default", "fresh-air-cooling-load");
    doc.save(`${projectInfo.projectName.replace(/\s+/g, "_")}_fresh_air_report.pdf`);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      projectInfo, dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, unitSystem
    }));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${projectInfo.projectName.replace(/\s+/g, "_")}_fresh_air_load.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
        if (parsed.dbIn !== undefined) setDbIn(parsed.dbIn);
        if (parsed.wbIn !== undefined) setWbIn(parsed.wbIn);
        if (parsed.dbOut !== undefined) setDbOut(parsed.dbOut);
        if (parsed.wbOut !== undefined) setWbOut(parsed.wbOut);
        if (parsed.flowRate !== undefined) setFlowRate(parsed.flowRate);
        if (parsed.safetyFactor !== undefined) setSafetyFactor(parsed.safetyFactor);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const uT = ip ? "°F" : "°C";
  const uW = ip ? "gr/lb" : "kg/kg";
  const uL = ip ? "BTU/h" : "kW";

  const inputClass = "w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono focus:outline-none focus:border-primary disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";

  return (
    <AppShell
      title="Fresh Air Cooling Load"
      hideSubHeader={true}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header matching Reference exactly */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Fresh Air Cooling Load</h1>
              </div>
              <CalculationReviewBar
                projectId={activeProjectId}
                calculatorPath="/fresh-air-cooling-load"
                calculatorTitle="Fresh Air Cooling Load"
              />
            </div>
            <div className="flex items-center gap-2">
              <UnitToggle 
                unitSystem={unitSystem} 
                onChange={handleUnitSystemChange} 
                inputDescriptions="Entering/Leaving DB, WB, and Airflow" 
                conversionExample={unitSystem === "si" ? "Convert 35°C → 95°F, 0.47 m³/s → 1,000 CFM" : "Convert 95°F → 35°C, 1000 CFM → 0.47 m³/s"} 
              />
            </div>
          </div>

          {/* White / Dark Card container for Parameters & Results Grid */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"}`}>

            {/* Action Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50">
              <div className="flex items-center gap-2.5 flex-wrap">
                <TBtn
                  onClick={() => setShowFormulaPanel(v => !v)}
                  title="View Step-by-Step Formula Breakdown"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
                

              </div>

              {/* Action buttons on the right */}
              <div className="flex items-center gap-2">
                <TBtn
                  onClick={handlePrintPDF}
                  title="Export PDF Report"
                >
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Sizing Parameters Grid and Results */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20">
              
              {showFormulaPanel && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 font-sans animate-fade-in">
                  <div className="bg-card border border-border rounded-2xl w-full max-w-xl p-6 flex flex-col gap-6 shadow-2xl animate-scale-in relative">
                    <button
                      type="button"
                      onClick={() => setShowFormulaPanel(false)}
                      className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="size-5" />
                    </button>
                    
                    <div className="flex items-center gap-3 border-b border-border/60 pb-4">
                      <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                        <Activity className="size-5" />
                      </div>
                      <h3 className="font-bold text-lg text-foreground">
                        Engineering Psychrometric Calculation Principles
                      </h3>
                    </div>

                    <div className="flex flex-col gap-4 text-muted-foreground leading-relaxed text-sm">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border/50 flex flex-col gap-2">
                        <strong className="text-foreground block text-base">1. Sensible Heat Load</strong>
                        <code className="text-xs text-primary font-mono block p-2 bg-primary/5 rounded-lg border border-primary/10">Q_sens = ṁ · c_p · (DB_in - DB_out)</code>
                        <span className="text-xs">Direct temperature drop of incoming outdoor air mass without dehumidification.</span>
                      </div>
                      
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border/50 flex flex-col gap-2">
                        <strong className="text-foreground block text-base">2. Latent Heat Load</strong>
                        <code className="text-xs text-primary font-mono block p-2 bg-primary/5 rounded-lg border border-primary/10">Q_lat = ṁ · (W_in - W_out) · h_fg</code>
                        <span className="text-xs">Moisture extraction via coil condensation using absolute humidity ratio (W).</span>
                      </div>
                      
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border/50 flex flex-col gap-2">
                        <strong className="text-foreground block text-base">3. Coil Capacity (TR)</strong>
                        <code className="text-xs text-primary font-mono block p-2 bg-primary/5 rounded-lg border border-primary/10">Capacity = Q_total(kW) / 3.51685</code>
                        <span className="text-xs">Total cooling duty with user-defined safety margin factored in.</span>
                      </div>
                    </div>
                  </div>
                </div>,
                document.body
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
                <div className="lg:col-span-5 space-y-5">
                  <div 
                    onDoubleClick={() => setShowAdvanced(prev => !prev)}
                    className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5 transition-all hover:border-slate-300 dark:hover:border-zinc-700 cursor-pointer"
                    title="Double click to toggle advanced parameters"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                      <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                        📥 Sizing Parameters
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider italic">
                        {showAdvanced ? "Advanced Visible" : "Double-click for advanced"}
                      </span>
                    </div>

                    {/* ENTERING AIR PARAMS */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          id="field-card-entering-air" 
                          data-field-id="card-entering-air" 
                          data-comment-target="card-entering-air"
                          className={`p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("card-entering-air", "Entering Coil Air")}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Entering Coil Air (OA)
                              </span>
                              {renderCommentBadge("card-entering-air", "Entering Coil Air")}
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              RH: <strong className="text-primary font-mono">{calc.rhIn.toFixed(1)}%</strong> | W: <strong className="text-primary font-mono">{calc.wIn.toFixed(ip ? 2 : 5)} {uW}</strong>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="text-[11px] text-slate-500">Dry Bulb ({uT})</label>
                              <input
                                type="number" step="any"
                                disabled={isEffectiveReadOnly}
                                value={dbIn}
                                onChange={(e) => setDbIn(e.target.value === "" ? "" : Number(e.target.value))}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500">Wet Bulb ({uT})</label>
                              <input
                                type="number" step="any"
                                disabled={isEffectiveReadOnly}
                                value={wbIn}
                                onChange={(e) => setWbIn(e.target.value === "" ? "" : Number(e.target.value))}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem disabled={isEffectiveReadOnly} onClick={() => { setDbIn(ip ? 95 : 35); setWbIn(ip ? 78 : 25.5); dirtyStore.set(true); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer">
                          <RefreshCw className="size-3.5 text-muted-foreground" /> Reset Entering Air
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem onClick={() => handleOpenComment("card-entering-air", "Entering Coil Air")} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium">
                          <MessageSquare className="size-3.5" /> Add Comment / Assign Task
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* LEAVING AIR PARAMS */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          id="field-card-leaving-air" 
                          data-field-id="card-leaving-air" 
                          data-comment-target="card-leaving-air"
                          className={`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("card-leaving-air", "Leaving Coil Air")}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Leaving Coil Air (SA)
                              </span>
                              {renderCommentBadge("card-leaving-air", "Leaving Coil Air")}
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              RH: <strong className="text-primary font-mono">{calc.rhOut.toFixed(1)}%</strong> | W: <strong className="text-primary font-mono">{calc.wOut.toFixed(ip ? 2 : 5)} {uW}</strong>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="text-[11px] text-slate-500">Dry Bulb ({uT})</label>
                              <input
                                type="number" step="any"
                                disabled={isEffectiveReadOnly}
                                value={dbOut}
                                onChange={(e) => setDbOut(e.target.value === "" ? "" : Number(e.target.value))}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500">Wet Bulb ({uT})</label>
                              <input
                                type="number" step="any"
                                disabled={isEffectiveReadOnly}
                                value={wbOut}
                                onChange={(e) => setWbOut(e.target.value === "" ? "" : Number(e.target.value))}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem disabled={isEffectiveReadOnly} onClick={() => { setDbOut(ip ? 55 : 12.8); setWbOut(ip ? 54 : 12.2); dirtyStore.set(true); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer">
                          <RefreshCw className="size-3.5 text-muted-foreground" /> Reset Leaving Air
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem onClick={() => handleOpenComment("card-leaving-air", "Leaving Coil Air")} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium">
                          <MessageSquare className="size-3.5" /> Add Comment / Assign Task
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* AIRFLOW AND SAFETY */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          id="field-card-airflow" 
                          data-field-id="card-airflow" 
                          data-comment-target="card-airflow"
                          className={`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("card-airflow", "Airflow & Safety")}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Flow &amp; Safety
                              </span>
                              {renderCommentBadge("card-airflow", "Airflow & Safety Factor")}
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              Mass Flow: <strong className="text-foreground font-mono">{calc.mDot.toFixed(2)} kg/s</strong>
                            </span>
                          </div>
                          <div className={`grid ${showAdvanced ? "grid-cols-2" : "grid-cols-1"} gap-2 text-xs`}>
                            <div>
                              <label className="text-[11px] text-slate-500">Airflow Rate ({ip ? "CFM" : "m³/s"})</label>
                              <input
                                type="number" step="any"
                                disabled={isEffectiveReadOnly}
                                value={flowRate}
                                onChange={(e) => setFlowRate(e.target.value === "" ? "" : Number(e.target.value))}
                                className={inputClass}
                              />
                            </div>
                            {showAdvanced && (
                              <div className="animate-in fade-in zoom-in-95 duration-200">
                                <label className="text-[11px] text-slate-500 flex justify-between">
                                  Safety Margin (%)
                                  <span className="text-blue-500 text-[10px]">Advanced</span>
                                </label>
                                <input
                                  type="number" step="1" min="0" max="30"
                                  disabled={isEffectiveReadOnly}
                                  value={safetyFactor}
                                  onChange={(e) => setSafetyFactor(Number(e.target.value) || 0)}
                                  className={inputClass}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem disabled={isEffectiveReadOnly} onClick={() => { setFlowRate(ip ? 1000 : 0.472); setSafetyFactor(5); dirtyStore.set(true); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer">
                          <RefreshCw className="size-3.5 text-muted-foreground" /> Reset Flow
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem onClick={() => handleOpenComment("card-airflow", "Airflow & Safety Factor")} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium">
                          <MessageSquare className="size-3.5" /> Add Comment / Assign Task
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                  </div>
                </div>

                {/* RIGHT COLUMN: CALCULATION RESULTS (lg:col-span-7) */}
                <div className="lg:col-span-7 space-y-5">
                  
                  {/* Warnings */}
                  {warnings.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-300 rounded-xl p-3.5 flex flex-col gap-1.5 text-xs select-none">
                      {warnings.map((w, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PRIMARY RESULTS CARD */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div 
                        id="card-hero-results" 
                        data-field-id="card-hero-results" 
                        data-comment-target="card-hero-results"
                        className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6 transition-colors ${isFieldHighlighted("card-hero-results", "Sizing Results Summary")}`}
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                          <div className="flex items-center">
                            <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                              ⚡ Cooling Coil Duty Results
                            </span>
                            {renderCommentBadge("card-hero-results", "Sizing Results Summary")}
                          </div>
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                            +{safetyFactor}% Margin Applied
                          </span>
                        </div>

                        {/* DISPLAY STAT CARDS */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-4 flex flex-col justify-center sm:col-span-1 col-span-2">
                            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Required Capacity</div>
                            <div className="text-3xl font-bold font-mono text-blue-700 dark:text-blue-400 mt-1.5">
                              {calc.capacityTons.toFixed(2)} <span className="text-sm font-bold font-sans text-blue-600/70 dark:text-blue-400/70">TR</span>
                            </div>
                          </div>

                          <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 flex flex-col justify-center">
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Total Coil Load</div>
                            <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                              {calc.totKw.toFixed(1)} <span className="text-xs font-bold font-sans text-emerald-600/70 dark:text-emerald-400/70">kW</span>
                            </div>
                          </div>

                          <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 flex flex-col justify-center">
                            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">Condensate</div>
                            <div className="text-xl font-bold font-mono text-purple-700 dark:text-purple-400 mt-1">
                              {calc.condensateKgH.toFixed(1)} <span className="text-xs font-bold font-sans text-purple-600/70 dark:text-purple-400/70">L/h</span>
                            </div>
                          </div>
                        </div>

                        {/* DETAILED METRICS TABLE */}
                        <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Total Sensible Heat Load:</span>
                            <span className="font-mono font-bold text-foreground">{calc.sensKw.toFixed(2)} kW <span className="text-muted-foreground ml-1 font-normal">({calc.sensLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL})</span></span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Total Latent Heat Load:</span>
                            <span className="font-mono font-bold text-foreground">{calc.latKw.toFixed(2)} kW <span className="text-muted-foreground ml-1 font-normal">({calc.latLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL})</span></span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Sensible Heat Ratio (SHR):</span>
                            <span className="font-mono font-bold text-foreground">{calc.shr.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-1 font-bold text-foreground">
                            <span>Total Coil Duty Load (Q_tot):</span>
                            <span className="font-mono text-[#0A7BC7]">{calc.totKw.toFixed(2)} kW <span className="text-[#0A7BC7]/60 ml-1 font-normal">({calc.totLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL})</span></span>
                          </div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => handleOpenComment("card-hero-results", "Sizing Results Summary")}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Add Comment / Assign Task</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AssignCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        targetId={commentTargetItem?.id || ""}
        targetName={commentTargetItem?.name || ""}
        onSave={(c) => {
          const tId = commentTargetItem?.id || c?.targetId;
          const tName = commentTargetItem?.name || c?.targetName;
          const newC = { ...c, targetId: tId, targetName: tName, spaceId: tId, spaceName: tName, itemId: tId, targetType: "Fresh Air Cooling Load" };
          const u = [newC, ...commentsList];
          saveComments(u);
          notifyCommentAssigned({ ...newC, url: `/fresh-air-cooling-load?targetId=${tId}&targetName=${encodeURIComponent(tName)}` });
          setCommentModalOpen(false);
          toast.success("Comment assigned.");
        }}
        currentUserId={userData?.id || "user-1"}
        currentUserName={currentUserName}
      />
    </AppShell>
  );
}
