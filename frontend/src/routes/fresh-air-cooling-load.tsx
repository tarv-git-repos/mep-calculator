import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { calculateFreshAirCoolingLoad, calculateFreshAirWarnings } from "@/lib/calc-fresh-air";
import { useAuth } from "@/contexts/AuthContext";
import { createFileRoute } from "@tanstack/react-router";
import { cToF, fToC, m3sToCfm, cfmToM3s } from "@/utils/conversions";
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  Download, Upload, Sparkles, AlertTriangle, CheckCircle2,
  Info, Gauge, FileText, Printer, FileSpreadsheet, Bookmark, HelpCircle,
  Wrench, MessageSquare, Wind, Droplets, Thermometer, Activity, RefreshCw,
  Copy, X, ChevronDown, Check, Zap, Layers, Compass, BarChart3, ShieldCheck,
  Flame, Sliders, ChevronRight, RotateCcw, Save, BookOpen, Calculator
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { formatDateStr, getSignatureBlockDetails } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { toast } from "sonner";

export const Route = createFileRoute("/fresh-air-cooling-load")({
  head: () => ({
    meta: [
      { title: "Fresh Air Cooling Load — MEP Calculator" },
      { name: "description", content: "Fresh Air Cooling Load calculator for sensible, latent, total loads, psychrometrics, and coil sizing." },
    ],
  }),
  component: FreshAirCoolingLoadPage,
});

type ClimatePresetKey = "custom" | "gulf_extreme" | "ashrae_summer" | "tropical_humid" | "temperate_summer";

interface ClimatePreset {
  name: string;
  dbInSI: number;
  wbInSI: number;
  dbOutSI: number;
  wbOutSI: number;
  description: string;
}

const CLIMATE_PRESETS: Record<ClimatePresetKey, ClimatePreset> = {
  custom: {
    name: "Custom Design Conditions",
    dbInSI: 35.0,
    wbInSI: 26.0,
    dbOutSI: 13.0,
    wbOutSI: 12.0,
    description: "User-defined psychrometric state points",
  },
  gulf_extreme: {
    name: "Gulf / UAE Peak Summer (46°C / 29°C)",
    dbInSI: 46.0,
    wbInSI: 29.0,
    dbOutSI: 12.8,
    wbOutSI: 12.2,
    description: "Extreme outdoor ambient conditions for Middle East / Desert climates",
  },
  ashrae_summer: {
    name: "ASHRAE 0.4% Peak Summer (35°C / 26°C)",
    dbInSI: 35.0,
    wbInSI: 26.0,
    dbOutSI: 13.0,
    wbOutSI: 12.0,
    description: "Standard international design summer outdoor condition",
  },
  tropical_humid: {
    name: "Tropical High Latent Humid (38°C / 31°C)",
    dbInSI: 38.0,
    wbInSI: 31.0,
    dbOutSI: 12.0,
    wbOutSI: 11.5,
    description: "Coastal / Equatorial high moisture dehumidification demand",
  },
  temperate_summer: {
    name: "Temperate Moderate Summer (30°C / 22°C)",
    dbInSI: 30.0,
    wbInSI: 22.0,
    dbOutSI: 14.0,
    wbOutSI: 13.0,
    description: "Mild European / North American summer design condition",
  },
};

export function FreshAirCoolingLoadPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/fresh-air-cooling-load", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/fresh-air-cooling-load", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "Design Engineer";
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Navigation & Drawer States
  const [intelOpen, setIntelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"sizing" | "report">("sizing");
  const [showFormulaPanel, setShowFormulaPanel] = useState(false);

  // Unit System
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const ip = unitSystem === "ip";

  // Climate Preset
  const [selectedPreset, setSelectedPreset] = useState<ClimatePresetKey>("ashrae_summer");

  // Project Info
  const [projectInfo, setProjectInfo] = useState({
    projectName: "Commercial Fresh Air Treatment Plant",
    projectNumber: "MEP-FA-01",
    client: "Al Futtaim Developments",
    consultant: "Consistent Engineering Consultants",
    date: new Date().toISOString().split("T")[0],
    revision: "Rev 0",
    calcNumber: "CALC-HVAC-FA01",
    notes: "Outdoor fresh air conditioning coil sensible, latent, and total heat load sizing study per ASHRAE Fundamentals.",
    endUser: "Commercial Facility",
  });

  // Core Sizing Parameters (Stored in SI: °C and m³/s or IP: °F and CFM)
  const [dbIn, setDbIn] = useState<number | "">(35);
  const [wbIn, setWbIn] = useState<number | "">(26);
  const [dbOut, setDbOut] = useState<number | "">(13);
  const [wbOut, setWbOut] = useState<number | "">(12);
  const [flowRate, setFlowRate] = useState<number | "">(0.472); // m3/s in SI, CFM in IP
  const [safetyFactor, setSafetyFactor] = useState<number>(5); // %

  // Comments / Collaboration State
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);

  // Persistence: Load saved calculation from localStorage on mount or project change
  useEffect(() => {
    if (!project?.id && !activeProjectId) return;
    const targetId = activeProjectId || project?.id || "default";
    try {
      const stored = localStorage.getItem(`mep_fresh_air_calc_${targetId}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.projectInfo) setProjectInfo(data.projectInfo);
        if (data.selectedPreset) setSelectedPreset(data.selectedPreset);
        if (data.dbIn !== undefined) setDbIn(data.dbIn);
        if (data.wbIn !== undefined) setWbIn(data.wbIn);
        if (data.dbOut !== undefined) setDbOut(data.dbOut);
        if (data.wbOut !== undefined) setWbOut(data.wbOut);
        if (data.flowRate !== undefined) setFlowRate(data.flowRate);
        if (data.safetyFactor !== undefined) setSafetyFactor(data.safetyFactor);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load fresh air calculation", e);
    }
  }, [project?.id, activeProjectId]);

  // Save handler
  const handleSaveCalculation = useCallback(() => {
    try {
      const targetId = activeProjectId || project?.id || "default";
      const payload = {
        projectInfo,
        selectedPreset,
        dbIn,
        wbIn,
        dbOut,
        wbOut,
        flowRate,
        safetyFactor,
        unitSystem,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(`mep_fresh_air_calc_${targetId}`, JSON.stringify(payload));
      dirtyStore.set(false);
      if (typeof forceSaveToCloud === "function") forceSaveToCloud();
      toast.success("Fresh Air Cooling Load calculation saved successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  }, [activeProjectId, project?.id, projectInfo, selectedPreset, dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, unitSystem, forceSaveToCloud]);

  // Global save listener (Ctrl+S / Sidebar Save)
  useEffect(() => {
    const handleTriggerSave = (e: any) => {
      if (e.detail) e.detail.handled = true;
      handleSaveCalculation();
    };
    window.addEventListener("mep-trigger-save", handleTriggerSave);
    return () => window.removeEventListener("mep-trigger-save", handleTriggerSave);
  }, [handleSaveCalculation]);

  // Load comments
  const loadComments = useCallback(() => {
    const pId = activeProjectId || project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/fresh-air-cooling-load`;
    try {
      const stored = localStorage.getItem(storageKey) || localStorage.getItem(`mep_calc_comments_${pId}_fresh-air-cooling-load`);
      if (stored) {
        setCommentsList(JSON.parse(stored));
      } else {
        setCommentsList([]);
      }
    } catch {
      setCommentsList([]);
    }
  }, [activeProjectId, project?.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const saveComments = (newComments: any[]) => {
    setCommentsList(newComments);
    const pId = activeProjectId || project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/fresh-air-cooling-load`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(newComments));
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
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

  // Unit toggle converter
  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean = true) => {
    if (targetUnit === unitSystem) return;

    if (shouldConvert) {
      if (targetUnit === "ip") {
        if (dbIn !== "") setDbIn(Number(cToF(Number(dbIn)).toFixed(1)));
        if (wbIn !== "") setWbIn(Number(cToF(Number(wbIn)).toFixed(1)));
        if (dbOut !== "") setDbOut(Number(cToF(Number(dbOut)).toFixed(1)));
        if (wbOut !== "") setWbOut(Number(cToF(Number(wbOut)).toFixed(1)));
        if (flowRate !== "") setFlowRate(Number(m3sToCfm(Number(flowRate)).toFixed(0)));
      } else {
        if (dbIn !== "") setDbIn(Number(fToC(Number(dbIn)).toFixed(1)));
        if (wbIn !== "") setWbIn(Number(fToC(Number(wbIn)).toFixed(1)));
        if (dbOut !== "") setDbOut(Number(fToC(Number(dbOut)).toFixed(1)));
        if (wbOut !== "") setWbOut(Number(fToC(Number(wbOut)).toFixed(1)));
        if (flowRate !== "") setFlowRate(Number(cfmToM3s(Number(flowRate)).toFixed(3)));
      }
    }

    setUnitSystem(targetUnit);
    dirtyStore.set(true);
  };

  // Apply climate preset
  const applyClimatePreset = (presetKey: ClimatePresetKey) => {
    setSelectedPreset(presetKey);
    const p = CLIMATE_PRESETS[presetKey];
    if (!p) return;

    if (presetKey !== "custom") {
      if (ip) {
        setDbIn(Number(cToF(p.dbInSI).toFixed(1)));
        setWbIn(Number(cToF(p.wbInSI).toFixed(1)));
        setDbOut(Number(cToF(p.dbOutSI).toFixed(1)));
        setWbOut(Number(cToF(p.wbOutSI).toFixed(1)));
      } else {
        setDbIn(p.dbInSI);
        setWbIn(p.wbInSI);
        setDbOut(p.dbOutSI);
        setWbOut(p.wbOutSI);
      }
      dirtyStore.set(true);
      toast.success(`Applied climate preset: ${p.name}`);
    }
  };

  // Calculation computation
  const calc = useMemo(() => {
    return calculateFreshAirCoolingLoad(dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, ip);
  }, [dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, ip]);

  // Psychrometric warnings
  const warnings = useMemo(() => {
    return calculateFreshAirWarnings(dbIn, wbIn, dbOut, wbOut, calc.shr, ip);
  }, [dbIn, wbIn, dbOut, wbOut, calc.shr, ip]);

  // Unit strings
  const uT = ip ? "°F" : "°C";
  const uW = ip ? "gr/lb" : "kg/kg";
  const uL = ip ? "BTU/h" : "kW";
  const uFlow = ip ? "CFM" : "m³/s";

  // PDF Export matching Preliminary standard format
  const handlePrintPDF = async () => {
    try {
      const activeProj: any = project || {};
      const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
      // A4 Portrait Mode (210mm x 297mm) matching Preliminary Cooling Load & Ventilation standard
      const doc = new JsPDFClass("portrait", "mm", "a4");

      const callAutoTable = (pdfDoc: any, options: any) => {
        if (typeof autoTable === "function") {
          autoTable(pdfDoc, options);
        } else if (typeof (autoTable as any)?.default === "function") {
          (autoTable as any).default(pdfDoc, options);
        } else if (typeof pdfDoc.autoTable === "function") {
          pdfDoc.autoTable(options);
        } else {
          console.error("autoTable function not available");
        }
      };

      const calcNo = projectInfo.calcNumber || activeProj?.calcNo || "TRV-CAL-FAC-001";
      const today = projectInfo.date || new Date().toLocaleDateString("en-GB");
      const projectNo = projectInfo.projectNumber || activeProj?.code || activeProj?.projectNo || "P000";
      const projectName = projectInfo.projectName || activeProj?.name || activeProj?.projectName || "Fresh Air Cooling Load Calculation";
      const clientName = projectInfo.client || activeProj?.client || "";
      const endUser = (activeProj as any)?.endUser || (activeProj as any)?.location || "";

      // 1. Header Title (Calculation title without 'Report' keyword)
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Fresh Air Cooling Load Calculation", 14, 14);

      // 2. Metadata Block (Exact Preliminary 2-column x 3-row format)
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      doc.rect(14, 18, 182, 18); // Outer box (182mm width)

      // Vertical line
      doc.line(105, 18, 105, 36);

      // Horizontal lines
      doc.line(14, 24, 196, 24);
      doc.line(14, 30, 196, 30);

      doc.setFont("helvetica", "bold");
      doc.text("Calculation No.:", 16, 22);
      doc.setFont("helvetica", "normal");
      doc.text(calcNo, 45, 22);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", 107, 22);
      doc.setFont("helvetica", "normal");
      doc.text(today, 120, 22);

      doc.setFont("helvetica", "bold");
      doc.text("Project No.:", 16, 28);
      doc.setFont("helvetica", "normal");
      doc.text(projectNo, 40, 28);

      doc.setFont("helvetica", "bold");
      doc.text("Client:", 107, 28);
      doc.setFont("helvetica", "normal");
      doc.text(clientName, 120, 28);

      doc.setFont("helvetica", "bold");
      doc.text("Project Name:", 16, 34);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, 42, 34);

      doc.setFont("helvetica", "bold");
      doc.text("End User:", 107, 34);
      doc.setFont("helvetica", "normal");
      doc.text(endUser, 125, 34);

      const primaryFill = [217, 217, 217] as [number, number, number]; // Clean gray matching Ventilation & Preliminary

      // 3. Table 1: Design Psychrometric Input Conditions
      callAutoTable(doc, {
        startY: 42,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 },
          minCellHeight: 6.5,
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 },
        },
        head: [
          [
            { content: "State Parameter", styles: { halign: "left" } },
            { content: "Entering Air (OA)" },
            { content: "Leaving Air (SA)" },
            { content: "Net Difference / Design Factor" },
          ],
        ],
        body: [
          ["Dry Bulb Temperature", `${dbIn} ${uT}`, `${dbOut} ${uT}`, `${(Number(dbIn) - Number(dbOut)).toFixed(1)} ${uT}`],
          ["Wet Bulb Temperature", `${wbIn} ${uT}`, `${wbOut} ${uT}`, `${(Number(wbIn) - Number(wbOut)).toFixed(1)} ${uT}`],
          ["Relative Humidity (RH)", `${calc.rhIn.toFixed(1)} %`, `${calc.rhOut.toFixed(1)} %`, `+${(calc.rhOut - calc.rhIn).toFixed(1)} %`],
          ["Humidity Ratio (W)", `${calc.wIn.toFixed(ip ? 2 : 5)} ${uW}`, `${calc.wOut.toFixed(ip ? 2 : 5)} ${uW}`, `-${(calc.wIn - calc.wOut).toFixed(ip ? 2 : 5)} ${uW}`],
          ["Airflow Design Rate", `${flowRate} ${ip ? "CFM" : "m3/s"}`, `${calc.flowLps.toFixed(1)} L/s`, `Mass Flow: ${calc.mDot.toFixed(2)} kg/s`],
          ["Safety Factor Margin", `+${safetyFactor} %`, "Applied to Sizing", `Factored in Output`],
        ],
        columnStyles: {
          0: { halign: "left", cellWidth: 52 },
          1: { cellWidth: 43 },
          2: { cellWidth: 43 },
          3: { cellWidth: 44 },
        },
      });

      // 4. Table 2: Cooling Coil Duty Sizing Results (with non-redundant engineering units & clean bold totals)
      const finalY1 = (doc as any).lastAutoTable?.finalY ?? 95;

      const sensEquiv = ip
        ? `${calc.sensKw.toFixed(2)} kW`
        : `${(calc.sensKw * 3412.142).toFixed(0)} BTU/h (${(calc.sensKw / 3.517).toFixed(2)} TR)`;

      const latEquiv = ip
        ? `${calc.latKw.toFixed(2)} kW`
        : `${(calc.latKw * 3412.142).toFixed(0)} BTU/h (${(calc.latKw / 3.517).toFixed(2)} TR)`;

      const totEquiv = ip
        ? `${calc.totKw.toFixed(2)} kW`
        : `${(calc.totKw * 3412.142).toFixed(0)} BTU/h (${calc.capacityTons.toFixed(2)} TR)`;

      const trEquiv = ip
        ? `${calc.totKw.toFixed(2)} kW`
        : `${calc.totKw.toFixed(2)} kW (${(calc.capacityTons * 12000).toFixed(0)} BTU/h)`;

      callAutoTable(doc, {
        startY: finalY1 + 6,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 },
          minCellHeight: 6.5,
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 },
        },
        head: [
          [
            { content: "Thermal Output Parameter", styles: { halign: "left" } },
            { content: `Factored Value (${uL})` },
            { content: ip ? "Metric Equivalent (kW)" : "Imperial Equivalent" },
            { content: "Engineering Impact & Application", styles: { halign: "left" } },
          ],
        ],
        body: [
          ["Sensible Heat Load (Q_sens)", `${calc.sensLoad.toFixed(2)} ${uL}`, sensEquiv, "Direct dry-bulb temperature drop duty"],
          ["Latent Heat Load (Q_lat)", `${calc.latLoad.toFixed(2)} ${uL}`, latEquiv, "Moisture condensation & dehumidification duty"],
          ["Total Fresh Air Heat Load (Q_tot)", `${calc.totLoad.toFixed(2)} ${uL}`, totEquiv, "Required Cooling Coil Thermal Duty"],
          ["Required Coil Sizing Capacity (TR)", `${calc.capacityTons.toFixed(2)} TR`, trEquiv, "Nominal Refrigeration Plant Duty"],
          ["Sensible Heat Ratio (SHR)", `${(calc.shr || 0).toFixed(2)}`, `${((calc.shr || 0) * 100).toFixed(1)}% Sensible / ${(100 - (calc.shr || 0) * 100).toFixed(1)}% Latent`, "Coil geometry & row depth selection factor"],
          ["Condensate Drainage Sizing", `${(calc.condensateKgH || 0).toFixed(2)} L/h`, `${(calc.condensateGph || 0).toFixed(2)} GPH (${((calc.condensateGpm ?? (calc.condensateGph / 60)) || 0).toFixed(3)} GPM)`, "Condensate drain pipe design sizing"],
        ],
        columnStyles: {
          0: { halign: "left", cellWidth: 52 },
          1: { cellWidth: 43 },
          2: { cellWidth: 43 },
          3: { halign: "left", cellWidth: 44 },
        },
        didParseCell: function(data: any) {
          if (data.section === "body") {
            if (data.row.index === 2 || data.row.index === 3) {
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
      });

      // 5. 3-Tier Signature Sign-Off Block (Exact #FFE6CC peach header from Preliminary standard)
      const finalY2 = (doc as any).lastAutoTable?.finalY ?? 160;
      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate
      } = getSignatureBlockDetails(activeProj?.id || "default", "/fresh-air-cooling-load", currentUserName, calcReviewState);

      callAutoTable(doc, {
        startY: finalY2 + 8,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 8,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2, bottom: 2, left: 1, right: 1 }
        },
        headStyles: { fillColor: [255, 230, 204], textColor: 0, fontStyle: "bold" },
        head: [
          [
            { content: "" },
            { content: "Originator" },
            { content: "Reviewer" },
            { content: "Approver" }
          ]
        ],
        body: [
          [
            { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedName || currentUserName || "System User", styles: { halign: "center" } },
            { content: reviewerName || "", styles: { halign: "center" } },
            { content: approverName || "", styles: { halign: "center" } }
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate || formatDateStr(new Date().toISOString()), styles: { halign: "center" } },
            { content: reviewerDate || "", styles: { halign: "center" } },
            { content: approverDate || "", styles: { halign: "center" } }
          ]
        ],
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 50 }
        }
      });

      const pdfBuffer = doc.output("arraybuffer");
      await downloadFile(
        new Uint8Array(pdfBuffer),
        `Fresh_Air_Cooling_Load_Calculation_${activeProj?.code || "P000"}.pdf`,
        "PDF Document",
        ["pdf"]
      );
      toast.success("Fresh Air Cooling Load Calculation PDF exported successfully!");
    } catch (e: any) {
      console.error("PDF Export error:", e);
      toast.error(`Failed to export PDF: ${e?.message || String(e)}`);
    }
  };

  // JSON Export / Import
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      projectInfo, selectedPreset, dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, unitSystem
    }, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${projectInfo.projectName.replace(/\s+/g, "_")}_fresh_air_load.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("JSON data exported.");
  };

  const handleImportJSONFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.projectInfo) setProjectInfo(data.projectInfo);
        if (data.selectedPreset) setSelectedPreset(data.selectedPreset);
        if (data.dbIn !== undefined) setDbIn(data.dbIn);
        if (data.wbIn !== undefined) setWbIn(data.wbIn);
        if (data.dbOut !== undefined) setDbOut(data.dbOut);
        if (data.wbOut !== undefined) setWbOut(data.wbOut);
        if (data.flowRate !== undefined) setFlowRate(data.flowRate);
        if (data.safetyFactor !== undefined) setSafetyFactor(data.safetyFactor);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        dirtyStore.set(true);
        toast.success("Calculation data imported successfully!");
      } catch (err) {
        toast.error("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Exact inputClass format matching pump sizing
  const inputClass = "w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono focus:outline-none focus:border-primary disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";

  return (
    <AppShell
      title="Fresh Air Cooling Load"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-2 gap-4 overflow-y-auto h-full">
          {/* Page Header matching ventilation exactly */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Fresh Air Cooling Load</h1>
              </div>
              
              {/* Intelligence Button */}
              <button
                onClick={() => setIntelOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${intelOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
                title="Toggle Psychrometric & ASHRAE 62.1 Intelligence Panel"
              >
                <Sparkles className="size-3.5" />
                Intelligence
                {warnings.length > 0 && (
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse ml-0.5" />
                )}
              </button>

              <CalculationReviewBar
                projectId={activeProjectId || project?.id}
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

          {/* White / Dark Card container for Parameters & Results Grid (Matching pump sizing) */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"}`}>

            {/* Sub-header Bar: Pill Tabs & Actions matching pump sizing and ventilation */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50 gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Main Tab Switcher matching Preliminary format */}
                <div className="flex bg-slate-100 dark:bg-zinc-800/70 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    type="button"
                    onClick={() => setActiveTab("sizing")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      activeTab === "sizing"
                        ? "bg-background text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sizing Calculator
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      activeTab === "report"
                        ? "bg-background text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Report
                  </button>
                </div>

                {/* Climate Presets Dropdown matching Ventilation Dropdown style */}
                {activeTab === "sizing" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium border border-border/80 bg-surface-2 hover:bg-surface-3 text-foreground transition-colors cursor-pointer select-none"
                        title="Select ASHRAE Climate Design Preset"
                      >
                        <Compass className="size-3.5 text-primary shrink-0" />
                        <span className="font-semibold text-foreground max-w-[200px] truncate">
                          {CLIMATE_PRESETS[selectedPreset]?.name.split("(")[0].trim() || "Climate Preset"}
                        </span>
                        <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72 bg-popover border border-border rounded-xl shadow-lg p-1 text-xs text-popover-foreground z-50">
                      <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-1 px-2">
                        ASHRAE Climate Design Presets
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="h-px bg-border my-1" />
                      {Object.entries(CLIMATE_PRESETS).map(([k, p]) => {
                        const active = selectedPreset === k;
                        return (
                          <DropdownMenuItem
                            key={k}
                            onClick={() => applyClimatePreset(k as ClimatePresetKey)}
                            className={`flex items-start justify-between gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                              active ? "bg-primary/10 text-primary font-bold" : "hover:bg-accent hover:text-accent-foreground"
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold">{p.name}</span>
                              <span className="text-[10px] text-muted-foreground font-normal mt-0.5">{p.description}</span>
                            </div>
                            {active && <Check className="size-3.5 text-primary shrink-0 mt-0.5" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Formula Breakdown Button */}
                <TBtn
                  onClick={() => setShowFormulaPanel(true)}
                  title="View Step-by-Step Formula Breakdown"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Action button on the right matching Preliminary standard */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn
                  onClick={handlePrintPDF}
                  title="Export Calculation PDF"
                >
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Sizing Parameters Grid or Report View */}
            {activeTab === "sizing" ? (
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20"
              >
                {/* Sizing Parameters Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) matching pump sizing */}
                  <div className="lg:col-span-5 space-y-5">
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          📥 Sizing Parameters
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
                            <div className="flex items-center justify-between mb-2.5">
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
                                  onChange={(e) => {
                                    setDbIn(e.target.value === "" ? "" : Number(e.target.value));
                                    dirtyStore.set(true);
                                  }}
                                  className={inputClass}
                                  placeholder="35.0"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-500">Wet Bulb ({uT})</label>
                                <input
                                  type="number" step="any"
                                  disabled={isEffectiveReadOnly}
                                  value={wbIn}
                                  onChange={(e) => {
                                    setWbIn(e.target.value === "" ? "" : Number(e.target.value));
                                    dirtyStore.set(true);
                                  }}
                                  className={inputClass}
                                  placeholder="26.0"
                                />
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("card-entering-air", "Entering Coil Air")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => {
                              setDbIn(ip ? 95 : 35);
                              setWbIn(ip ? 78 : 26);
                              dirtyStore.set(true);
                              toast.success("Entering air reset to standard 35°C / 26°C");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset Entering Air</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => applyClimatePreset("gulf_extreme")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Flame className="size-3.5 text-amber-500" />
                            <span>Apply Gulf Peak (46/29°C)</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => applyClimatePreset("tropical_humid")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Droplets className="size-3.5 text-blue-500" />
                            <span>Apply Tropical (38/31°C)</span>
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
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                  Leaving Coil Air (Off-Coil / SA)
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
                                  onChange={(e) => {
                                    setDbOut(e.target.value === "" ? "" : Number(e.target.value));
                                    dirtyStore.set(true);
                                  }}
                                  className={inputClass}
                                  placeholder="13.0"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-500">Wet Bulb ({uT})</label>
                                <input
                                  type="number" step="any"
                                  disabled={isEffectiveReadOnly}
                                  value={wbOut}
                                  onChange={(e) => {
                                    setWbOut(e.target.value === "" ? "" : Number(e.target.value));
                                    dirtyStore.set(true);
                                  }}
                                  className={inputClass}
                                  placeholder="12.0"
                                />
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("card-leaving-air", "Leaving Coil Air")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => {
                              setDbOut(ip ? 55.4 : 13);
                              setWbOut(ip ? 53.6 : 12);
                              dirtyStore.set(true);
                              toast.success("Leaving air reset to standard (13°C / 12°C)");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset Leaving Air</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => {
                              setDbOut(ip ? 50 : 10);
                              setWbOut(ip ? 49.1 : 9.5);
                              dirtyStore.set(true);
                              toast.success("Set deep dehumidification off-coil (10°C / 9.5°C)");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Thermometer className="size-3.5 text-indigo-500" />
                            <span>Deep Dehumid (10/9.5°C)</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* AIRFLOW AND SAFETY MARGIN */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div 
                            id="field-card-airflow" 
                            data-field-id="card-airflow" 
                            data-comment-target="card-airflow"
                            className={`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("card-airflow", "Airflow & Safety")}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                  Airflow &amp; Safety Margin
                                </span>
                                {renderCommentBadge("card-airflow", "Airflow & Safety Factor")}
                              </div>
                              <span className="text-[10px] text-slate-500 font-semibold">
                                Mass Flow: <strong className="text-foreground font-mono">{calc.mDot.toFixed(2)} kg/s</strong>
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-[11px] text-slate-500">Airflow Rate ({uFlow})</label>
                                <input
                                  type="number" step="any"
                                  disabled={isEffectiveReadOnly}
                                  value={flowRate}
                                  onChange={(e) => {
                                    setFlowRate(e.target.value === "" ? "" : Number(e.target.value));
                                    dirtyStore.set(true);
                                  }}
                                  className={inputClass}
                                  placeholder={ip ? "1000" : "0.472"}
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-500">Safety Factor (%)</label>
                                <input
                                  type="number" step="1" min="0" max="30"
                                  disabled={isEffectiveReadOnly}
                                  value={safetyFactor}
                                  onChange={(e) => {
                                    setSafetyFactor(Number(e.target.value) || 0);
                                    dirtyStore.set(true);
                                  }}
                                  className={inputClass}
                                  placeholder="5"
                                />
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("card-airflow", "Airflow & Safety Factor")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => {
                              setFlowRate(ip ? 1000 : 0.472);
                              setSafetyFactor(5);
                              dirtyStore.set(true);
                              toast.success("Airflow & Safety Margin reset to default");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset Airflow & Margin</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => {
                              setFlowRate(ip ? 2118 : 1.0);
                              dirtyStore.set(true);
                              toast.success("Set airflow to 1,000 L/s (1.0 m³/s / 2,118 CFM)");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Wind className="size-3.5 text-primary" />
                            <span>Set 1,000 L/s (2,118 CFM)</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => {
                              setFlowRate(ip ? 5300 : 2.5);
                              dirtyStore.set(true);
                              toast.success("Set airflow to 2,500 L/s (2.5 m³/s / 5,300 CFM)");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Wind className="size-3.5 text-primary" />
                            <span>Set 2,500 L/s (5,300 CFM)</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                    </div>
                  </div>

                  {/* RIGHT COLUMN: CALCULATION RESULTS (lg:col-span-7) STICKY matching pump sizing */}
                  <div className="lg:col-span-7 space-y-5 lg:sticky lg:top-0 self-start">
                    
                    {/* Warnings Banner */}
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

                    {/* PRIMARY RESULTS CARD (matching pump sizing Sizing Results Summary) */}
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
                                ⚡ Sizing Results Summary
                              </span>
                              {renderCommentBadge("card-hero-results", "Sizing Results Summary")}
                            </div>
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                              +{safetyFactor}% Margin
                            </span>
                          </div>

                          {/* DISPLAY STAT CARDS (4-card grid format matching pump sizing) */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5">
                              <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Coil Capacity</div>
                              <div className="text-xl font-bold font-mono text-foreground mt-1">
                                {calc.capacityTons.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">TR</span>
                              </div>
                            </div>

                            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5">
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Total Load</div>
                              <div className="text-xl font-bold font-mono text-foreground mt-1">
                                {calc.totKw.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">{uL}</span>
                              </div>
                            </div>

                            <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5">
                              <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Condensate</div>
                              <div className="text-xl font-bold font-mono text-foreground mt-1">
                                {calc.condensateKgH.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">{ip ? "GPH" : "L/h"}</span>
                              </div>
                            </div>

                            <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5">
                              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Sensible Ratio</div>
                              <div className="text-xl font-bold font-mono text-foreground mt-1">
                                {calc.shr.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">SHR</span>
                              </div>
                            </div>
                          </div>

                          {/* DETAILED METRICS TABLE (matching pump sizing layout) */}
                          <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Total Sensible Heat Load:</span>
                              <span className="font-mono font-bold text-foreground">
                                {calc.sensKw.toFixed(2)} kW <span className="text-muted-foreground ml-1 font-normal">({calc.sensLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL})</span>
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Total Latent Heat Load:</span>
                              <span className="font-mono font-bold text-foreground">
                                {calc.latKw.toFixed(2)} kW <span className="text-muted-foreground ml-1 font-normal">({calc.latLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL})</span>
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Sensible Heat Ratio (SHR):</span>
                              <span className="font-mono font-bold text-foreground">
                                {calc.shr.toFixed(2)} <span className="text-muted-foreground font-normal ml-1">({(calc.shr * 100).toFixed(0)}% Sensible / {(100 - calc.shr * 100).toFixed(0)}% Latent)</span>
                              </span>
                            </div>
                            <div className="flex justify-between py-1 font-bold text-foreground">
                              <span>Total Coil Duty Thermal Load:</span>
                              <span className="font-mono text-[#0A7BC7]">{calc.totKw.toFixed(2)} kW ({calc.totLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL})</span>
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
                          <span>Add Comment</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => setShowFormulaPanel(true)}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                        >
                          <Info className="size-3.5 text-primary" />
                          <span>Formula Breakdown</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            const summary = `Fresh Air Cooling Load: ${calc.capacityTons.toFixed(2)} TR (${calc.totKw.toFixed(2)} kW) | Sensible: ${calc.sensKw.toFixed(2)} kW | Latent: ${calc.latKw.toFixed(2)} kW | SHR: ${calc.shr.toFixed(2)} | Condensate: ${calc.condensateKgH.toFixed(2)} L/h`;
                            navigator.clipboard.writeText(summary);
                            toast.success("Thermal sizing summary copied to clipboard!");
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span>Copy Thermal Summary</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={handlePrintPDF}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <FileText className="size-3.5 text-muted-foreground" />
                          <span>Export PDF Report</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* PSYCHROMETRIC STATE POINTS TABLE */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          id="field-card-psychrometric-table"
                          data-field-id="card-psychrometric-table"
                          data-comment-target="card-psychrometric-table"
                          className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-3 transition-colors ${isFieldHighlighted("card-psychrometric-table", "Psychrometric State Matrix")}`}
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                            <div className="flex items-center">
                              <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                <BarChart3 className="size-4 text-indigo-500" /> Psychrometric State Points Comparison
                              </span>
                              {renderCommentBadge("card-psychrometric-table", "Psychrometric State Matrix")}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-semibold">Standard Atmospheric (101.325 kPa)</span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                                  <th className="py-2">Parameter</th>
                                  <th className="py-2">Entering (OA)</th>
                                  <th className="py-2">Leaving (SA)</th>
                                  <th className="py-2">Coil Delta (Δ)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/40 font-mono">
                                <tr>
                                  <td className="py-2 font-sans font-medium text-foreground">Dry Bulb ({uT})</td>
                                  <td className="py-2 text-foreground">{dbIn}</td>
                                  <td className="py-2 text-foreground">{dbOut}</td>
                                  <td className="py-2 text-primary font-bold">{(Number(dbIn) - Number(dbOut)).toFixed(1)}</td>
                                </tr>
                                <tr>
                                  <td className="py-2 font-sans font-medium text-foreground">Wet Bulb ({uT})</td>
                                  <td className="py-2 text-foreground">{wbIn}</td>
                                  <td className="py-2 text-foreground">{wbOut}</td>
                                  <td className="py-2 text-primary font-bold">{(Number(wbIn) - Number(wbOut)).toFixed(1)}</td>
                                </tr>
                                <tr>
                                  <td className="py-2 font-sans font-medium text-foreground">Relative Humidity (RH)</td>
                                  <td className="py-2 text-foreground">{calc.rhIn.toFixed(1)}%</td>
                                  <td className="py-2 text-foreground">{calc.rhOut.toFixed(1)}%</td>
                                  <td className="py-2 text-purple-600 dark:text-purple-400 font-bold">+{(calc.rhOut - calc.rhIn).toFixed(1)}%</td>
                                </tr>
                                <tr>
                                  <td className="py-2 font-sans font-medium text-foreground">Humidity Ratio ({uW})</td>
                                  <td className="py-2 text-foreground">{calc.wIn.toFixed(ip ? 2 : 5)}</td>
                                  <td className="py-2 text-foreground">{calc.wOut.toFixed(ip ? 2 : 5)}</td>
                                  <td className="py-2 text-emerald-600 dark:text-emerald-400 font-bold">-{(calc.wIn - calc.wOut).toFixed(ip ? 2 : 5)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          onClick={() => handleOpenComment("card-psychrometric-table", "Psychrometric State Matrix")}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => {
                            const matrix = `Psychrometric State Points:
- Dry Bulb: Entering ${dbIn}${uT} | Leaving ${dbOut}${uT} (Δ ${(Number(dbIn) - Number(dbOut)).toFixed(1)}${uT})
- Wet Bulb: Entering ${wbIn}${uT} | Leaving ${wbOut}${uT} (Δ ${(Number(wbIn) - Number(wbOut)).toFixed(1)}${uT})
- Relative Humidity: Entering ${calc.rhIn.toFixed(1)}% | Leaving ${calc.rhOut.toFixed(1)}% (Δ +${(calc.rhOut - calc.rhIn).toFixed(1)}%)
- Humidity Ratio: Entering ${calc.wIn.toFixed(ip ? 2 : 5)} ${uW} | Leaving ${calc.wOut.toFixed(ip ? 2 : 5)} ${uW}`;
                            navigator.clipboard.writeText(matrix);
                            toast.success("Psychrometric state matrix copied to clipboard!");
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span>Copy State Matrix</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                  </div>
                </div>
              </div>
            ) : (
              /* Printable Report tab view matching exact Preliminary standard layout */
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">
                  
                  {/* 1. Title (Calculation Name, with "Calculation" instead of "Report") */}
                  <div className="pb-1">
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                      Fresh Air Cooling Load Calculation
                    </h2>
                  </div>

                  {/* 2. Project Metadata Header Box (Exact 2-column x 3-row format matching Preliminary) */}
                  <div className="border border-border rounded-xl overflow-hidden text-xs">
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr className="border-b border-border divide-x divide-border">
                          <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                          <td className="p-2.5 font-mono text-foreground font-medium">{projectInfo.calcNumber || "CALC-HVAC-FAC01"}</td>
                          <td className="p-2.5 font-bold w-28 bg-muted/20">Date:</td>
                          <td className="p-2.5 font-mono font-medium">{projectInfo.date || new Date().toISOString().split("T")[0]}</td>
                        </tr>
                        <tr className="border-b border-border divide-x divide-border">
                          <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                          <td className="p-2.5 font-mono">{projectInfo.projectNumber || (project as any)?.code || "MEP-FAC-2026"}</td>
                          <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                          <td className="p-2.5">{projectInfo.client || (project as any)?.client || "Prestige Group"}</td>
                        </tr>
                        <tr className="divide-x divide-border">
                          <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                          <td className="p-2.5">{projectInfo.projectName || (project as any)?.name || "Fresh Air Cooling Load Calculation"}</td>
                          <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                          <td className="p-2.5">{(project as any)?.endUser || (project as any)?.location || "General Facility"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 3. Design Psychrometric Input Conditions Table */}
                  <div className="border border-border rounded-xl overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                          <th colSpan={4} className="p-2.5 text-center uppercase tracking-wider text-[11px]">
                            Design Psychrometric Input Conditions (Standard Atmospheric 101.325 kPa)
                          </th>
                        </tr>
                        <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                          <th className="p-2.5 border-r border-border">State Parameter</th>
                          <th className="p-2.5 border-r border-border text-center">Entering Air (OA)</th>
                          <th className="p-2.5 border-r border-border text-center">Leaving Air (SA)</th>
                          <th className="p-2.5 text-center">Net Difference / Design Factor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border font-medium">Dry Bulb Temperature ({uT})</td>
                          <td className="p-2.5 border-r border-border text-center font-mono">{dbIn} {uT}</td>
                          <td className="p-2.5 border-r border-border text-center font-mono">{dbOut} {uT}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-primary">{(Number(dbIn) - Number(dbOut)).toFixed(1)} {uT}</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border font-medium">Wet Bulb Temperature ({uT})</td>
                          <td className="p-2.5 border-r border-border text-center font-mono">{wbIn} {uT}</td>
                          <td className="p-2.5 border-r border-border text-center font-mono">{wbOut} {uT}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-primary">{(Number(wbIn) - Number(wbOut)).toFixed(1)} {uT}</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border font-medium">Relative Humidity (RH)</td>
                          <td className="p-2.5 border-r border-border text-center font-mono">{calc.rhIn.toFixed(1)}%</td>
                          <td className="p-2.5 border-r border-border text-center font-mono">{calc.rhOut.toFixed(1)}%</td>
                          <td className="p-2.5 text-center font-mono font-bold text-purple-600 dark:text-purple-400">+{(calc.rhOut - calc.rhIn).toFixed(1)}%</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border font-medium">Humidity Ratio (W)</td>
                          <td className="p-2.5 border-r border-border text-center font-mono">{calc.wIn.toFixed(ip ? 2 : 5)} {uW}</td>
                          <td className="p-2.5 border-r border-border text-center font-mono">{calc.wOut.toFixed(ip ? 2 : 5)} {uW}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">-{(calc.wIn - calc.wOut).toFixed(ip ? 2 : 5)} {uW}</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border font-medium">Airflow Design Rate</td>
                          <td colSpan={2} className="p-2.5 border-r border-border text-center font-mono font-bold text-foreground">{flowRate} {uFlow} ({calc.flowLps.toFixed(1)} L/s)</td>
                          <td className="p-2.5 text-center font-mono text-muted-foreground">Mass Flow: {calc.mDot.toFixed(2)} kg/s</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border font-medium">Safety Factor Margin</td>
                          <td colSpan={3} className="p-2.5 text-center font-mono font-bold text-primary">+{safetyFactor}% Added to Thermal Load</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 4. Cooling Coil Duty Sizing Results Table (with highlighted key data) */}
                  <div className="border border-border rounded-xl overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                          <th colSpan={4} className="p-2.5 text-center uppercase tracking-wider text-[11px]">
                            Cooling Coil Duty Sizing Results (Factored with +{safetyFactor}% Margin)
                          </th>
                        </tr>
                        <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                          <th className="p-2.5 border-r border-border">Thermal Output Parameter</th>
                          <th className="p-2.5 border-r border-border text-center">Factored Duty ({uL})</th>
                          <th className="p-2.5 border-r border-border text-center">{ip ? "Metric Equivalent (kW)" : "Imperial Equivalent"}</th>
                          <th className="p-2.5">Engineering Impact &amp; Application</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border font-medium text-foreground">Sensible Heat Load (Q_sens)</td>
                          <td className="p-2.5 border-r border-border text-center font-mono font-bold text-primary">{calc.sensLoad.toFixed(2)} {uL}</td>
                          <td className="p-2.5 border-r border-border text-center font-mono text-muted-foreground">
                            {ip
                              ? `${calc.sensKw.toFixed(2)} kW`
                              : `${(calc.sensKw * 3412.142).toFixed(0)} BTU/h (${(calc.sensKw / 3.517).toFixed(2)} TR)`}
                          </td>
                          <td className="p-2.5 text-muted-foreground">Direct dry-bulb temperature drop duty</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border font-medium text-foreground">Latent Heat Load (Q_lat)</td>
                          <td className="p-2.5 border-r border-border text-center font-mono font-bold text-purple-600 dark:text-purple-400">{calc.latLoad.toFixed(2)} {uL}</td>
                          <td className="p-2.5 border-r border-border text-center font-mono text-muted-foreground">
                            {ip
                              ? `${calc.latKw.toFixed(2)} kW`
                              : `${(calc.latKw * 3412.142).toFixed(0)} BTU/h (${(calc.latKw / 3.517).toFixed(2)} TR)`}
                          </td>
                          <td className="p-2.5 text-muted-foreground">Moisture condensation &amp; dehumidification duty</td>
                        </tr>
                        <tr className="bg-primary/5 hover:bg-primary/10 font-bold border-t border-b border-border">
                          <td className="p-2.5 border-r border-border font-bold text-foreground">Total Fresh Air Heat Load (Q_tot)</td>
                          <td className="p-2.5 border-r border-border text-center font-mono font-bold text-primary text-sm">{calc.totLoad.toFixed(2)} {uL}</td>
                          <td className="p-2.5 border-r border-border text-center font-mono font-bold text-foreground text-sm">
                            {ip
                              ? `${calc.totKw.toFixed(2)} kW`
                              : `${(calc.totKw * 3412.142).toFixed(0)} BTU/h (${calc.capacityTons.toFixed(2)} TR)`}
                          </td>
                          <td className="p-2.5 font-bold text-foreground">Required Cooling Coil Thermal Duty</td>
                        </tr>
                        <tr className="bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50 font-bold border-b border-border">
                          <td className="p-2.5 border-r border-border font-bold text-emerald-700 dark:text-emerald-300">Required Coil Sizing Capacity (TR)</td>
                          <td className="p-2.5 border-r border-border text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">{calc.capacityTons.toFixed(2)} TR</td>
                          <td className="p-2.5 border-r border-border text-center font-mono font-bold text-foreground text-sm">
                            {calc.totKw.toFixed(2)} kW ({(calc.capacityTons * 12000).toFixed(0)} BTU/h)
                          </td>
                          <td className="p-2.5 font-bold text-emerald-700 dark:text-emerald-300">Nominal Refrigeration Plant Duty</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border font-medium text-foreground">Sensible Heat Ratio (SHR)</td>
                          <td className="p-2.5 border-r border-border text-center font-mono font-bold text-foreground">{(calc.shr || 0).toFixed(2)}</td>
                          <td className="p-2.5 border-r border-border text-center font-mono text-muted-foreground">{((calc.shr || 0) * 100).toFixed(1)}% Sensible / {(100 - (calc.shr || 0) * 100).toFixed(1)}% Latent</td>
                          <td className="p-2.5 text-muted-foreground">Coil geometry &amp; row depth selection factor</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border font-medium text-foreground">Condensate Drainage Removal</td>
                          <td className="p-2.5 border-r border-border text-center font-mono font-bold text-foreground">{(calc.condensateKgH || 0).toFixed(2)} L/h</td>
                          <td className="p-2.5 border-r border-border text-center font-mono text-muted-foreground">{(calc.condensateGph || 0).toFixed(2)} GPH ({((calc.condensateGpm ?? ((calc.condensateGph || 0) / 60)) || 0).toFixed(3)} GPM)</td>
                          <td className="p-2.5 text-muted-foreground">Condensate drain pipe design sizing</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 5. 3-Tier Signature Sign-Off Block (Exact Preliminary #FFE6CC Header) */}
                  {(() => {
                    const sig = getSignatureBlockDetails(
                      project?.id || "default",
                      "/fresh-air-cooling-load",
                      currentUserName,
                      calcReviewState
                    );
                    return (
                      <div className="pt-2">
                        <div className="border border-border rounded-xl overflow-hidden text-xs">
                          <table className="w-full border-collapse">
                            <thead className="bg-[#FFE6CC] dark:bg-amber-950/40 text-foreground font-bold border-b border-border">
                              <tr className="divide-x divide-border">
                                <th className="p-2.5 w-28 text-center"></th>
                                <th className="p-2.5 text-center w-1/3">Originator</th>
                                <th className="p-2.5 text-center w-1/3">Reviewer</th>
                                <th className="p-2.5 text-center w-1/3">Approver</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              <tr className="divide-x divide-border">
                                <td className="p-2.5 font-bold text-center bg-muted/10">Name:</td>
                                <td className="p-2.5 text-center font-medium">
                                  {sig.originatedName || currentUserName || "System User"}
                                </td>
                                <td className="p-2.5 text-center font-medium">
                                  {sig.reviewerName || ""}
                                </td>
                                <td className="p-2.5 text-center font-medium">
                                  {sig.approverName || ""}
                                </td>
                              </tr>
                              <tr className="divide-x divide-border">
                                <td className="p-2.5 font-bold text-center bg-muted/10">Date:</td>
                                <td className="p-2.5 text-center font-mono">
                                  {sig.originatedDate || formatDateStr(new Date().toISOString())}
                                </td>
                                <td className="p-2.5 text-center font-mono">
                                  {sig.reviewerDate || ""}
                                </td>
                                <td className="p-2.5 text-center font-mono">
                                  {sig.approverDate || ""}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>
            )}
          </div>
        </div>

        {/* Intelligence Drawer matching Ventilation exactly */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${intelOpen ? "w-[360px] mt-2 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
            }`}
        >
          {intelOpen && (
            <FreshAirIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calc={calc}
              safetyFactor={safetyFactor}
              ip={ip}
              uT={uT}
              uW={uW}
              uL={uL}
              uFlow={uFlow}
              warnings={warnings}
              onApplyPreset={applyClimatePreset}
              activePreset={selectedPreset}
            />
          )}
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

      {/* Step-by-Step Mathematical & Psychrometric Formula Breakdown Modal */}
      <FreshAirFormulaBreakdownModal
        isOpen={showFormulaPanel}
        onClose={() => setShowFormulaPanel(false)}
        calc={calc}
        dbIn={dbIn}
        wbIn={wbIn}
        dbOut={dbOut}
        wbOut={wbOut}
        flowRate={flowRate}
        safetyFactor={safetyFactor}
        unitSystem={unitSystem}
        ip={ip}
        uT={uT}
        uW={uW}
        uL={uL}
        uFlow={uFlow}
      />
    </AppShell>
  );
}

// Compact Step-by-Step Formula Breakdown & Thermodynamic Derivation Modal (matching Ventilation double-click modal size)
function FreshAirFormulaBreakdownModal({
  isOpen,
  onClose,
  calc,
  dbIn,
  wbIn,
  dbOut,
  wbOut,
  flowRate,
  safetyFactor,
  unitSystem,
  ip,
  uT,
  uW,
  uL,
  uFlow,
}: {
  isOpen: boolean;
  onClose: () => void;
  calc: any;
  dbIn: number | "";
  wbIn: number | "";
  dbOut: number | "";
  wbOut: number | "";
  flowRate: number | "";
  safetyFactor: number;
  unitSystem: "si" | "ip";
  ip: boolean;
  uT: string;
  uW: string;
  uL: string;
  uFlow: string;
}) {
  const [activeTab, setActiveTab] = useState<"trace" | "formulas" | "variables">("trace");
  const [copied, setCopied] = useState(false);

  // Esc key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const deltaT = Math.abs(Number(calc.dbInC) - Number(calc.dbOutC));
  const deltaWKg = Math.max(0, calc.wInKg - calc.wOutKg);
  const deltaWGr = deltaWKg * 7000;
  const sensBaseKw = calc.mDot * 1.006 * deltaT;
  const latBaseKw = calc.mDot * deltaWKg * 2501;

  const handleCopySummary = () => {
    const text = `=== FRESH AIR COOLING LOAD CALCULATION BREAKDOWN ===
Governing Design Standards: ASHRAE Fundamentals (Psychrometrics Ch. 1) & Standard 62.1
Unit System: ${ip ? "IP (Imperial)" : "SI (Metric)"}

--- STATE PARAMETERS ---
• Entering (OA): ${dbIn}°/${wbIn}° ${uT} | RH: ${calc.rhIn.toFixed(1)}% | W: ${calc.wIn.toFixed(ip ? 2 : 5)} ${uW}
• Leaving (SA): ${dbOut}°/${wbOut}° ${uT} | RH: ${calc.rhOut.toFixed(1)}% | W: ${calc.wOut.toFixed(ip ? 2 : 5)} ${uW}
• Airflow Rate: ${flowRate} ${uFlow} (${calc.flowLps.toFixed(1)} L/s | ${calc.flowCfm.toFixed(0)} CFM) | ṁ: ${calc.mDot.toFixed(3)} kg/s
• Design Safety Margin: +${safetyFactor}%

--- CALCULATION STEPS ---
[1] Moist Air Mass Flow: ṁ = ρ_air × V = 1.204 kg/m³ × ${calc.flowM3s.toFixed(3)} m³/s = ${calc.mDot.toFixed(3)} kg/s
[2] Moisture Extraction: ΔW = W_in - W_out = ${deltaWKg.toFixed(5)} kg/kg (${deltaWGr.toFixed(1)} gr/lb)
[3] Sensible Heat Load: Q_sens = ṁ · c_p · ΔT = ${calc.sensKw.toFixed(2)} kW (${calc.sensLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${uL})
[4] Latent Heat Load: Q_lat = ṁ · ΔW · h_fg = ${calc.latKw.toFixed(2)} kW (${calc.latLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${uL})
[5] Total Coil Thermal Duty: Q_tot = (Q_sens + Q_lat) × (1 + SF) = ${calc.totKw.toFixed(2)} kW (${calc.totLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${uL})
[6] Plant Sizing Capacity: TR = Q_tot / 3.51685 = ${calc.capacityTons.toFixed(2)} TR
[7] Sensible Heat Ratio & Drain: SHR = ${calc.shr.toFixed(2)} | Condensate Drain = ${calc.condensateKgH.toFixed(2)} L/h (${calc.condensateGph.toFixed(2)} GPH)
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Calculation breakdown summary copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150 font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-xl w-full max-h-[86vh] flex flex-col overflow-hidden text-xs animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Ventilation Double-Click Modal */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Calculator className="size-3.5" />
            </div>
            <div className="truncate">
              <h2 className="text-[13px] font-bold text-foreground truncate">
                Psychrometric Formula Breakdown
              </h2>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-semibold shrink-0">
              ASHRAE 62.1
            </span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border text-[10px] font-mono font-medium shrink-0">
              {ip ? "IP" : "SI"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Close modal (Esc)"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-muted/10 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setActiveTab("trace")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === "trace"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Activity className="size-3" />
            <span>Calculation Steps</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("formulas")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === "formulas"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <BookOpen className="size-3" />
            <span>Master Formulas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("variables")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === "variables"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Layers className="size-3" />
            <span>Variables Reference</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {/* TAB 1: CALCULATION TRACE */}
          {activeTab === "trace" && (
            <div className="space-y-2.5">
              {/* Compact Active Sizing Conditions */}
              <div className="p-2.5 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider pb-1.5 mb-1.5 border-b border-border/60">
                  <span className="flex items-center gap-1 text-foreground">
                    <Sliders className="size-3 text-primary" /> Active State Points
                  </span>
                  <span className="font-mono text-primary normal-case font-bold">
                    {flowRate} {uFlow} ({calc.flowLps.toFixed(0)} L/s | {calc.flowCfm.toFixed(0)} CFM)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Entering Air (OA)</span>
                    <span className="font-mono font-bold text-foreground">{dbIn}° / {wbIn}° {uT}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">({calc.rhIn.toFixed(0)}% RH)</span>
                  </div>
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Leaving Air (SA)</span>
                    <span className="font-mono font-bold text-foreground">{dbOut}° / {wbOut}° {uT}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">({calc.rhOut.toFixed(0)}% RH)</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: MOIST AIR MASS FLOW RATE */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Moist Air Mass Flow Rate (ṁ)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {calc.mDot.toFixed(2)} kg/s
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: ṁ = ρ_air × V_airflow</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">1.204 kg/m³ × {calc.flowM3s.toFixed(3)} m³/s</span>
                    <span className="text-primary font-bold">= {calc.mDot.toFixed(2)} kg/s</span>
                  </div>
                </div>
              </div>

              {/* STEP 2: HUMIDITY RATIO & MOISTURE DELTA */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Moisture Extraction (ΔW)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {deltaWKg.toFixed(5)} kg/kg
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: ΔW = W_in - W_out</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{calc.wInKg.toFixed(5)} - {calc.wOutKg.toFixed(5)} kg/kg</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">= {deltaWKg.toFixed(5)} kg/kg ({deltaWGr.toFixed(1)} gr/lb)</span>
                  </div>
                </div>
              </div>

              {/* STEP 3: SENSIBLE HEAT LOAD */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Sensible Heat Load (Q_sens)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {calc.sensKw.toFixed(2)} kW
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_sens = ṁ · c_p · (DB_in - DB_out)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{calc.mDot.toFixed(2)} kg/s × 1.006 × ({Number(calc.dbInC).toFixed(1)} - {Number(calc.dbOutC).toFixed(1)})°C</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">= {calc.sensKw.toFixed(2)} kW</span>
                  </div>
                </div>
              </div>

              {/* STEP 4: LATENT HEAT LOAD */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      4
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Latent Heat Load (Q_lat)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                    {calc.latKw.toFixed(2)} kW
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_lat = ṁ · ΔW · h_fg (h_fg = 2501 kJ/kg)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{calc.mDot.toFixed(2)} kg/s × {deltaWKg.toFixed(5)} × 2501</span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold">= {calc.latKw.toFixed(2)} kW</span>
                  </div>
                </div>
              </div>

              {/* STEP 5: REQUIRED COIL CAPACITY */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      5
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Required Coil Capacity (TR)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {calc.capacityTons.toFixed(2)} TR
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Capacity (TR) = [Q_total(kW) × (1 + Safety%)] / 3.51685</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">({calc.totKw.toFixed(2)} kW with +{safetyFactor}%) / 3.51685</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">= {calc.capacityTons.toFixed(2)} TR</span>
                  </div>
                </div>
              </div>

              {/* STEP 6: SHR & DRAINAGE */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      6
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Sensible Ratio &amp; Condensate Rate
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                    SHR = {calc.shr.toFixed(2)}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="flex justify-between text-foreground">
                    <span className="text-muted-foreground">SHR (Q_sens / Q_tot):</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{calc.shr.toFixed(2)} ({(calc.shr * 100).toFixed(0)}% Sensible)</span>
                  </div>
                  <div className="flex justify-between text-foreground pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">Condensate Removal Flow:</span>
                    <span className="font-bold text-foreground">{calc.condensateKgH.toFixed(2)} L/h ({calc.condensateGph.toFixed(2)} GPH)</span>
                  </div>
                </div>
              </div>

              {/* Sizing Outcome Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[9.5px] uppercase font-bold text-muted-foreground">Total Coil Duty</div>
                  <div className="text-[11.5px] font-bold text-foreground mt-0.5">{calc.totKw.toFixed(2)} kW ({calc.totLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL})</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold font-mono text-primary leading-tight">{calc.capacityTons.toFixed(2)} <span className="text-xs font-normal">TR</span></div>
                  <div className="text-[9.5px] text-muted-foreground font-mono">+{safetyFactor}% Margin</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MASTER FORMULAS */}
          {activeTab === "formulas" && (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Sensible Heat Transfer Rate
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>SI: Q_sens = ṁ · c_p · (DB_in - DB_out)</div>
                  <div>IP: Q_sens = 1.08 × CFM × (DB_in - DB_out) [BTU/h]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  c_p = 1.006 kJ/kg·K (0.240 BTU/lb·°F). Constant 1.08 = 60 × 0.075 × 0.240.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-purple-500" /> Latent Dehumidification Rate
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>SI: Q_lat = ṁ · (W_in - W_out) · h_fg</div>
                  <div>IP: Q_lat = 4840 × CFM × ΔW_lb = 0.68 × CFM × ΔW_gr [BTU/h]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  h_fg = 2501 kJ/kg (1076 BTU/lb). Constant 4840 = 60 × 0.075 × 1076.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-cyan-500" /> Total Moist Air Enthalpy Change
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>SI: Q_tot = ṁ · (h_in - h_out)</div>
                  <div>IP: Q_tot = 4.5 × CFM × (h_in - h_out) [BTU/h]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  where h = 1.006 · DB + W · (2501 + 1.86 · DB) kJ/kg. Constant 4.5 = 60 × 0.075.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-500" /> Plant Capacity &amp; SHR
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>Capacity (TR) = Q_tot(kW) / 3.51685 = Q_tot(BTU/h) / 12,000</div>
                  <div>SHR = Q_sens / Q_tot  |  ṁ_cond (L/h) = ṁ · ΔW · 3600</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VARIABLES & CONSTANTS */}
          {activeTab === "variables" && (
            <div className="space-y-2.5">
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <table className="w-full text-left text-[10.5px]">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border font-bold text-foreground">
                      <th className="py-1.5 px-2">Symbol</th>
                      <th className="py-1.5 px-2">Parameter</th>
                      <th className="py-1.5 px-2">SI Standard</th>
                      <th className="py-1.5 px-2">IP Standard</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ṁ</td>
                      <td className="py-1.5 px-2 text-foreground">Air Mass Flow Rate</td>
                      <td className="py-1.5 px-2 font-mono">kg/s</td>
                      <td className="py-1.5 px-2 font-mono">lb/hr</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ρ_air</td>
                      <td className="py-1.5 px-2 text-foreground">Standard Air Density</td>
                      <td className="py-1.5 px-2 font-mono">1.204 kg/m³</td>
                      <td className="py-1.5 px-2 font-mono">0.075 lb/ft³</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">c_p</td>
                      <td className="py-1.5 px-2 text-foreground">Specific Heat</td>
                      <td className="py-1.5 px-2 font-mono">1.006 kJ/kg·K</td>
                      <td className="py-1.5 px-2 font-mono">0.240 BTU/lb·°F</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">h_fg</td>
                      <td className="py-1.5 px-2 text-foreground">Latent Heat of Vapor</td>
                      <td className="py-1.5 px-2 font-mono">2501 kJ/kg</td>
                      <td className="py-1.5 px-2 font-mono">1076 BTU/lb</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">P_atm</td>
                      <td className="py-1.5 px-2 text-foreground">Atmospheric Pressure</td>
                      <td className="py-1.5 px-2 font-mono">101.325 kPa</td>
                      <td className="py-1.5 px-2 font-mono">14.696 psia</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">W</td>
                      <td className="py-1.5 px-2 text-foreground">Humidity Ratio</td>
                      <td className="py-1.5 px-2 font-mono">kg_w / kg_da</td>
                      <td className="py-1.5 px-2 font-mono">gr/lb</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">TR</td>
                      <td className="py-1.5 px-2 text-foreground">Ton of Refrigeration</td>
                      <td className="py-1.5 px-2 font-mono">3.51685 kW</td>
                      <td className="py-1.5 px-2 font-mono">12,000 BTU/h</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-muted border border-border/70 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-primary text-primary-foreground text-[11.5px] font-semibold px-4 py-1.5 rounded-lg hover:bg-primary/90 transition shadow-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper Section container inside Intelligence Drawer (matches Ventilation & Pump Sizing IntelSection design)
function IntelSection({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: any;
  title: string;
  tone: "success" | "warning" | "primary" | "muted" | "purple";
  children: React.ReactNode;
}) {
  const color =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "warning" ? "text-amber-600 dark:text-amber-400" :
    tone === "primary" ? "text-primary" :
    tone === "purple" ? "text-purple-600 dark:text-purple-400" :
    "text-muted-foreground";

  return (
    <section className="px-3.5 py-3 border-b border-border/70 last:border-b-0">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`size-3.5 ${color}`} />
        <h4 className="text-[11px] uppercase tracking-wider font-bold text-foreground/90">{title}</h4>
      </div>
      {children}
    </section>
  );
}

// Helper Key-Value row
function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[11.5px] py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono tabular font-medium text-foreground">{v}</span>
    </div>
  );
}

// Slide-out Intelligence Drawer Component tailored for Fresh Air Cooling Load
function FreshAirIntelligenceDrawer({
  onClose,
  calc,
  safetyFactor,
  ip,
  uT,
  uW,
  uL,
  uFlow,
  warnings,
  onApplyPreset,
  activePreset,
}: {
  onClose: () => void;
  calc: any;
  safetyFactor: number;
  ip: boolean;
  uT: string;
  uW: string;
  uL: string;
  uFlow: string;
  warnings: string[];
  onApplyPreset: (key: ClimatePresetKey) => void;
  activePreset: ClimatePresetKey;
}) {
  // Sizing estimations
  const faceArea = ip ? (calc.flowCfm / 500) : (calc.flowM3s / 2.5); // sq ft or m2 at 500 fpm / 2.5 m/s
  const deltaT = Math.abs(Number(calc.dbInC) - Number(calc.dbOutC));
  const deltaW = Math.max(0, calc.wInKg - calc.wOutKg) * 1000; // g/kg
  const recommendedRows = deltaT > 25 || deltaW > 12 ? "8 Rows (Deep Dehumidification)" : deltaT > 16 || deltaW > 6 ? "6 Rows (Standard FAHU)" : "4 Rows (Temperate Coil)";
  
  // Condensate pipe recommendation
  const condensateLps = (calc.condensateKgH || 0) / 3600;
  const drainSize = condensateLps > 0.05 ? "DN 32 (1¼\")" : "DN 25 (1\")";

  // ERV Potential (Heat wheel recovery)
  const isHighAmbient = ip ? calc.dbInVal > 90 : calc.dbInC > 32;
  const ervSavedKw = (calc.totKw * 0.70); // 70% typical enthalpy wheel effectiveness
  const ervSavedTR = ervSavedKw / 3.51685;

  const compliancePct = warnings.length === 0 ? 100 : Math.max(50, 100 - warnings.length * 25);

  return (
    <div className="h-full w-[360px] flex flex-col font-sans select-none animate-in fade-in duration-200">
      {/* Header */}
      <header className="h-11 px-3.5 flex items-center justify-between border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-bold tracking-tight text-foreground">Fresh Air Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground transition cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* SECTION 1: COMPLIANCE STATUS & SCORE */}
        <IntelSection
          icon={CheckCircle2}
          tone={warnings.length === 0 ? "success" : "warning"}
          title="Psychrometric Audit"
        >
          <div className="text-[11.5px] text-muted-foreground leading-relaxed">
            {warnings.length === 0
              ? "ASHRAE 62.1 moist air thermodynamic state points fully validated."
              : `${warnings.length} psychrometric design warning(s) detected.`}
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  warnings.length === 0 ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${compliancePct}%` }}
              />
            </div>
            <span className="font-mono tabular text-[11px] font-bold text-foreground">{compliancePct}%</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-surface-2 dark:bg-zinc-800/60 p-2 rounded-lg border border-border/50">
              <span className="text-[10px] text-muted-foreground block font-semibold">Total Sizing Duty</span>
              <span className="font-mono font-bold text-xs text-primary">{calc.capacityTons.toFixed(2)} TR</span>
            </div>
            <div className="bg-surface-2 dark:bg-zinc-800/60 p-2 rounded-lg border border-border/50">
              <span className="text-[10px] text-muted-foreground block font-semibold">Sensible Ratio</span>
              <span className="font-mono font-bold text-xs text-foreground">{(calc.shr * 100).toFixed(0)}% SHR</span>
            </div>
          </div>
        </IntelSection>

        {/* SECTION 2: THERMAL LOAD SPLIT */}
        <IntelSection icon={Gauge} tone="primary" title="Thermal Load Diagnostics">
          <KV k="Sensible Cooling Load" v={`${calc.sensKw.toFixed(2)} kW`} />
          <KV k="Latent Moisture Load" v={`${calc.latKw.toFixed(2)} kW`} />
          <KV k="Condensate Drainage" v={`${calc.condensateKgH.toFixed(2)} L/h`} />
          <KV k="Safety Margin Applied" v={`+${safetyFactor}%`} />

          {/* SHR visual split bar */}
          <div className="mt-2.5 pt-2 border-t border-border/40 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
              <span className="text-blue-600 dark:text-blue-400">Sensible: {(calc.shr * 100).toFixed(0)}%</span>
              <span className="text-purple-600 dark:text-purple-400">Latent: {(100 - calc.shr * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full bg-purple-500/30 rounded-full overflow-hidden flex">
              <div className="bg-blue-500 h-full transition-all" style={{ width: `${calc.shr * 100}%` }} />
            </div>
          </div>
        </IntelSection>

        {/* SECTION 3: AHU / FAHU COIL RECOMMENDATIONS */}
        <IntelSection icon={Layers} tone="purple" title="Coil Sizing Recommendations">
          <KV k="Estimated Coil Face Area" v={`${faceArea.toFixed(2)} ${ip ? "sq ft" : "m²"}`} />
          <KV k="Target Face Velocity" v={ip ? "500 FPM (2.54 m/s)" : "2.5 m/s"} />
          <KV k="Recommended Coil Depth" v={recommendedRows} />
          <KV k="Fin Spacing Guidance" v="8 to 12 FPI" />
          <KV k="Min. Drain Pipe Diameter" v={drainSize} />
        </IntelSection>

        {/* SECTION 4: ENERGY RECOVERY (ERV) */}
        <IntelSection icon={Zap} tone={isHighAmbient ? "warning" : "muted"} title="Energy Recovery Potential (ERV)">
          {isHighAmbient ? (
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 rounded-xl space-y-1.5 text-xs text-amber-900 dark:text-amber-300">
              <strong className="block font-bold flex items-center gap-1.5">
                <Flame className="size-3.5 text-amber-600" /> High Enthalpy Wheel Benefit
              </strong>
              <p className="text-[11px] leading-relaxed">
                With Entering DB &gt; {ip ? "90°F" : "32°C"}, deploying an Enthalpy Rotary Wheel can recover up to <strong>70%</strong> of the fresh air load:
              </p>
              <div className="pt-1 flex justify-between font-mono font-bold text-xs">
                <span>Recoverable Power:</span>
                <span>~{ervSavedKw.toFixed(1)} kW ({ervSavedTR.toFixed(1)} TR)</span>
              </div>
            </div>
          ) : (
            <div className="text-[11.5px] text-muted-foreground leading-relaxed">
              Standard temperate load envelope. Maintain proper coil trap depth (min. 75mm water seal) to prevent condensate backflow.
            </div>
          )}
        </IntelSection>

        {/* SECTION 5: QUICK CLIMATE SCENARIO APPPLIERS */}
        <IntelSection icon={Sparkles} tone="primary" title="Quick Climate Scenarios">
          <div className="space-y-1.5 pt-1">
            {Object.entries(CLIMATE_PRESETS).filter(([k]) => k !== "custom").map(([k, p]) => (
              <button
                key={k}
                onClick={() => onApplyPreset(k as ClimatePresetKey)}
                className={`w-full text-left p-2 rounded-lg border text-xs flex items-center justify-between transition-all cursor-pointer ${
                  activePreset === k
                    ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                    : "bg-surface-2 dark:bg-zinc-800/40 border-border/60 hover:border-border text-foreground hover:bg-surface-3"
                }`}
              >
                <div>
                  <span className="block text-[11px] font-semibold">{p.name}</span>
                  <span className="block text-[9.5px] text-muted-foreground mt-0.5">{p.description}</span>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground shrink-0 ml-1" />
              </button>
            ))}
          </div>
        </IntelSection>

        {/* SECTION 6: ENGINEERING NOTES & STANDARDS */}
        <IntelSection icon={Info} tone="muted" title="Engineering Standards">
          <div className="text-[11.5px] text-muted-foreground space-y-1 leading-relaxed">
            <p>• <strong>ASHRAE 62.1</strong>: Minimum outdoor air rate &amp; air quality.</p>
            <p>• <strong>ASHRAE 90.1</strong>: Energy efficiency &amp; heat recovery mandates.</p>
            <p>• <strong>ASHRAE Fundamentals</strong>: Two-equation saturation formulation.</p>
          </div>
        </IntelSection>
      </div>
    </div>
  );
}
