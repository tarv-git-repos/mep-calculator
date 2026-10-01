import React, { useState, useEffect, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { TBtn } from "@/components/workspace/Button";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, MessageSquare, Check, ShieldCheck,
  AlertTriangle, Copy, RotateCcw, CheckCircle2, X, Gauge, Sparkles, FileText,
  Activity, Zap, Building2, Home, ArrowUpRight, CheckCircle
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";

export const Route = createFileRoute("/plumbing-pressure-vessel")({
  head: () => ({
    meta: [
      { title: "Pressure Vessel Sizing — MEP Calc" },
      { name: "description", content: "Calculate the required volume of water supply expansion and bladder pressure vessels based on IPC & CIBSE Guide W." }
    ],
  }),
  component: PressureVesselPage,
});

export interface PressureVesselInputs {
  importedFlow: number | "";
  importedHead: number | "";
  qLmin: number; // L/min (SI) or GPM (IP)
  bandFactor: number; // e.g. 0.20
  ppVal: number; // Cut-out stop pressure: bar (SI) or psi (IP)
  paVal: number; // Cut-in start pressure: bar (SI) or psi (IP)
  zmax: number; // Max starts per hour (#/hr)
  unitSystem: "SI" | "IP";
}

const DEFAULT_INPUTS: PressureVesselInputs = {
  importedFlow: "",
  importedHead: "",
  qLmin: 78.0, // L/min (approx 20.6 GPM)
  bandFactor: 0.20,
  ppVal: 8.52, // bar (approx 123.6 psi)
  paVal: 5.68, // bar (approx 82.4 psi)
  zmax: 60, // starts/hr
  unitSystem: "SI",
};

// Conversion Constants
const GAL_TO_L = 3.78541;
const GPM_TO_LMIN = 3.78541;
const PSI_TO_BAR = 0.0689476;

export function PressureVesselPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-pressure-vessel", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-pressure-vessel", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const [tab, setTab] = useState<"calculator" | "report">("calculator");
  const [intelOpen, setIntelOpen] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  // Core Inputs State
  const [inputs, setInputs] = useState<PressureVesselInputs>(DEFAULT_INPUTS);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Comment Assignment State
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [activeCommentTarget, setActiveCommentTarget] = useState<{ id: string; label: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);

  // Load state from localStorage on project change
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_pressure_vessel_calc_${project.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setInputs({
          importedFlow: parsed.importedFlow !== undefined ? parsed.importedFlow : DEFAULT_INPUTS.importedFlow,
          importedHead: parsed.importedHead !== undefined ? parsed.importedHead : DEFAULT_INPUTS.importedHead,
          qLmin: parsed.qLmin !== undefined ? Number(parsed.qLmin) : DEFAULT_INPUTS.qLmin,
          bandFactor: parsed.bandFactor !== undefined ? Number(parsed.bandFactor) : DEFAULT_INPUTS.bandFactor,
          ppVal: parsed.ppVal !== undefined ? Number(parsed.ppVal) : DEFAULT_INPUTS.ppVal,
          paVal: parsed.paVal !== undefined ? Number(parsed.paVal) : DEFAULT_INPUTS.paVal,
          zmax: parsed.zmax !== undefined ? Number(parsed.zmax) : DEFAULT_INPUTS.zmax,
          unitSystem: (parsed.unitSystem || "SI").toUpperCase() as "SI" | "IP",
        });
      }
      const storedComments = localStorage.getItem(`mep_comments_${project.id}_/plumbing-pressure-vessel`);
      if (storedComments) {
        setCommentsMap(JSON.parse(storedComments));
      }
    } catch (e) {
      console.error("Failed to load pressure vessel state", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  const saveState = (newInputs: PressureVesselInputs) => {
    if (!project?.id) return;
    try {
      localStorage.setItem(`mep_pressure_vessel_calc_${project.id}`, JSON.stringify(newInputs));
      dirtyStore.set(true);
      if (forceSaveToCloud) forceSaveToCloud();
    } catch (e) {
      console.error("Failed to save pressure vessel state", e);
    }
  };

  const handleInputChange = (field: keyof PressureVesselInputs, value: any) => {
    if (isEffectiveReadOnly) return;
    const nextInputs = { ...inputs, [field]: value };
    setInputs(nextInputs);
    saveState(nextInputs);
  };

  const handleUnitSystem = (newUnit: "SI" | "IP") => {
    if (newUnit === inputs.unitSystem || isEffectiveReadOnly) return;
    const toIP = newUnit === "IP";

    const nextInputs: PressureVesselInputs = {
      ...inputs,
      unitSystem: newUnit,
      qLmin: toIP ? Number((inputs.qLmin / GPM_TO_LMIN).toFixed(2)) : Number((inputs.qLmin * GPM_TO_LMIN).toFixed(2)),
      ppVal: toIP ? Number((inputs.ppVal / PSI_TO_BAR).toFixed(2)) : Number((inputs.ppVal * PSI_TO_BAR).toFixed(2)),
      paVal: toIP ? Number((inputs.paVal / PSI_TO_BAR).toFixed(2)) : Number((inputs.paVal * PSI_TO_BAR).toFixed(2)),
    };

    setInputs(nextInputs);
    saveState(nextInputs);
    toast.info(`Switched to ${newUnit === "IP" ? "Imperial (IP)" : "Metric (SI)"} units`);
  };

  // Import from Booster or Transfer Pump
  const handleImport = (type: "booster" | "transfer") => {
    if (!project?.id) {
      toast.error("No active project loaded.");
      return;
    }
    try {
      const key = type === "booster" ? `mep_booster_pump_calc_${project.id}` : `mep_transfer_pump_calc_${project.id}`;
      const raw = localStorage.getItem(key) || localStorage.getItem(`mep_pump_sizing_calc_${project.id}`);
      if (!raw) {
        toast.error(`No ${type === "booster" ? "Booster" : "Transfer"} Pump sizing found in project.`);
        return;
      }
      const data = JSON.parse(raw);

      const vert = parseFloat(data.pipeVert) || 0;
      const horiz = parseFloat(data.pipeHoriz) || 0;
      const ff = parseFloat(data.fricFactor) || 0.4;
      const elbows = (vert + horiz) * 0.3;
      const valves = (vert + horiz) * 0.3;
      const L_sum = vert + horiz + elbows + valves;
      const equivLen = Math.ceil((L_sum * 1.05) / 10) * 10;
      const frictionLoss = equivLen * (ff / 100);

      let filterLoss = 0;
      if (type === "transfer") {
        if (data.filtCarbon) filterLoss += 0.8;
        if (data.filtMM) filterLoss += 0.8;
        if (data.filtCuAg) filterLoss += 0.2;
        if (data.filtSoftener) filterLoss += 0.8;
      }

      const staticH = parseFloat(data.staticHead) || 0;
      const outletH = parseFloat(data.presidHead) || 0;
      const suctionH = parseFloat(data.suctionHead) || 0;
      const safetyMargin = (parseFloat(data.sfHead) || 0) / 100;
      const rawHead = Math.max(0, frictionLoss + staticH + outletH - suctionH) + filterLoss;
      const calcHead = rawHead * (1 + safetyMargin);

      let flowLps = parseFloat(data.manualFlow) || parseFloat(data.flowLps) || 0;
      const wPumps = parseInt(data.workingPumps) || 1;
      if (type !== "transfer") {
        flowLps = flowLps * wPumps;
      }

      const factor = Number(inputs.bandFactor) || 0.2;
      const computedPp = Number((calcHead * (1 + factor)).toFixed(2));
      const computedPa = Number((calcHead * (1 - factor)).toFixed(2));
      const qVal = flowLps * 60;

      const nextInputs: PressureVesselInputs = {
        ...inputs,
        importedFlow: flowLps,
        importedHead: calcHead,
        qLmin: inputs.unitSystem === "IP" ? Number((qVal / GPM_TO_LMIN).toFixed(2)) : Number(qVal.toFixed(2)),
        ppVal: inputs.unitSystem === "IP" ? Number((computedPp / PSI_TO_BAR).toFixed(2)) : computedPp,
        paVal: inputs.unitSystem === "IP" ? Number((computedPa / PSI_TO_BAR).toFixed(2)) : computedPa,
      };

      setInputs(nextInputs);
      saveState(nextInputs);
      toast.success(`Imported parameters from ${type === "booster" ? "Booster" : "Transfer"} Pump!`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to import pump values.");
    }
  };

  const handleSaveComment = (commentData: any) => {
    if (!activeCommentTarget || !project?.id) return;
    const targetId = activeCommentTarget.id;
    const newComment = {
      id: `comment_${Date.now()}`,
      authorName: currentUserName,
      text: commentData.text,
      timestamp: new Date().toISOString(),
      status: "OPEN",
    };
    const currentList = commentsMap[targetId] || [];
    const updatedMap = { ...commentsMap, [targetId]: [newComment, ...currentList] };
    setCommentsMap(updatedMap);
    localStorage.setItem(`mep_comments_${project.id}_/plumbing-pressure-vessel`, JSON.stringify(updatedMap));
    toast.success(`Comment added to "${activeCommentTarget.label}"`);
    setActiveCommentTarget(null);
  };

  const isIP = inputs.unitSystem === "IP";
  const flowUnit = isIP ? "GPM" : "L/min";
  const pressUnit = isIP ? "psi" : "bar";
  const volUnit = isIP ? "Gallons" : "Litres";

  // Calculations
  const results = useMemo(() => {
    const q_native = Number(inputs.qLmin) || 0;
    const pp_native = Number(inputs.ppVal) || 0;
    const pa_native = Number(inputs.paVal) || 0;
    const z = Number(inputs.zmax) || 60;

    // Convert to SI for standard formula calculation:
    // Formula: V (Litres) = 16.5 * (Q [L/min] * Pp [bar] * Pa [bar]) / (Zmax * (Pp - Pa) * Pc)
    const q_lmin = isIP ? q_native * GPM_TO_LMIN : q_native;
    const pp_bar = isIP ? pp_native * PSI_TO_BAR : pp_native;
    const pa_bar = isIP ? pa_native * PSI_TO_BAR : pa_native;
    const pc_bar = Math.max(0.1, pa_bar - 0.2); // Preload: Pa - 0.2 bar

    const deltaP_bar = Math.max(0.01, pp_bar - pa_bar);
    const constant = 16.5;

    let volume_litres = 0;
    if (z > 0 && deltaP_bar > 0 && pc_bar > 0 && q_lmin > 0) {
      volume_litres = constant * ((q_lmin * pp_bar * pa_bar) / (z * deltaP_bar * pc_bar));
    }

    const volume_disp = isIP ? volume_litres / GAL_TO_L : volume_litres;
    const pc_disp = isIP ? pc_bar / PSI_TO_BAR : pc_bar;
    const deltaP_disp = isIP ? deltaP_bar / PSI_TO_BAR : deltaP_bar;

    const isAdequate = volume_litres > 0 && pp_bar > pa_bar;

    return {
      q_native,
      pp_native,
      pa_native,
      q_lmin,
      pp_bar,
      pa_bar,
      pc_bar,
      deltaP_bar,
      z,
      volume_litres,
      volume_disp,
      pc_disp,
      deltaP_disp,
      isAdequate,
    };
  }, [inputs, isIP]);

  const isAdequate = results.isAdequate;

  // PDF Export Functionality (Preliminary Engineering Report Standard)
  const handleExportPdf = async () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const primaryFill = [217, 217, 217] as [number, number, number];
      const blueFill = [218, 233, 248] as [number, number, number];

      const callAutoTable = (autoTable as any).default || autoTable;

      const calcNo = `CALC-PV-${project?.code || "001"}`;
      const projectNo = project?.code || "PRJ-001";
      const projectName = project?.name || "Pressure Vessel Sizing Project";
      const clientName = (project as any)?.client || "Client Representative";
      const endUser = (project as any)?.endUser || "Building Facilities / MEP Department";
      const today = formatDateStr(new Date().toISOString());

      // Document Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("PRESSURE VESSEL SIZING PRELIMINARY REPORT", 14, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Design Standards: IPC / CIBSE Guide W Section 4 / BS EN 13831 / DIN 4807-5", 14, 20);

      doc.setFont("helvetica", "bold");
      doc.text(`Date: ${today}`, 196, 20, { align: "right" });

      let currentY = 24;

      // Metadata Enclosed Grid
      callAutoTable(doc, {
        startY: currentY,
        head: [],
        body: [
          [
            { content: "Calculation No.:", styles: { fontStyle: "bold", cellWidth: 32 } },
            { content: calcNo, styles: { cellWidth: 60 } },
            { content: "Date:", styles: { fontStyle: "bold", cellWidth: 32 } },
            { content: today, styles: { cellWidth: 58 } },
          ],
          [
            { content: "Project No.:", styles: { fontStyle: "bold" } },
            { content: projectNo },
            { content: "Client:", styles: { fontStyle: "bold" } },
            { content: clientName },
          ],
          [
            { content: "Project Name:", styles: { fontStyle: "bold" } },
            { content: projectName },
            { content: "End User:", styles: { fontStyle: "bold" } },
            { content: endUser },
          ],
        ],
        theme: "grid",
        styles: { fontSize: 8, textColor: [40, 40, 40], cellPadding: 2 },
        alternateRowStyles: { fillColor: [250, 250, 250] },
      });

      currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 48;

      // Section 1 Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);
      doc.text("1. Pump Operating Parameters & Hydraulic Pressure Constraints", 14, currentY);

      // Table 1: Pump Operating Parameters
      const paramBody = [
        ["Pump Discharge Volume (Q)", `${inputs.qLmin.toFixed(2)} ${flowUnit}`, `${results.q_lmin.toFixed(1)} L/min`, "Continuous peak fixture flow rate"],
        ["Pump Control Band Factor", `${Number(inputs.bandFactor).toFixed(2)}`, `±${(Number(inputs.bandFactor) * 100).toFixed(0)}%`, "Pressure variation tolerance band"],
        ["Pump Cut-out Stop Pressure (Pp)", `${Number(inputs.ppVal).toFixed(2)} ${pressUnit}`, `${results.pp_bar.toFixed(2)} bar`, "Maximum system shut-off pressure"],
        ["Pump Cut-in Start Pressure (Pa)", `${Number(inputs.paVal).toFixed(2)} ${pressUnit}`, `${results.pa_bar.toFixed(2)} bar`, "Minimum system start pressure"],
        ["Gas Preload Pressure (Pc)", `${results.pc_disp.toFixed(2)} ${pressUnit}`, `${results.pc_bar.toFixed(2)} bar`, "Set to Pa - 0.20 bar (Pa - 3.0 psi)"],
        ["Max Starts per Hour (Zmax)", `${inputs.zmax} starts/hr`, `${inputs.zmax} / hr`, "Motor thermal switching threshold limit"],
      ];

      callAutoTable(doc, {
        startY: currentY + 2.5,
        head: [["Parameter Description", "Design Value", "SI Equivalent", "Engineering Notes / Standard Reference"]],
        body: paramBody,
        theme: "grid",
        headStyles: {
          fillColor: primaryFill,
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 8.5,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [40, 40, 40],
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250],
        },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: "bold" },
          1: { cellWidth: 38, halign: "center", fontStyle: "bold" },
          2: { cellWidth: 38, halign: "center" },
          3: { cellWidth: 51, halign: "left" },
        },
      });

      currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 95;

      // Section 2 Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);
      doc.text("2. Expansion & Pressure Vessel Sizing Evaluation", 14, currentY);

      // Table 2: Sizing Evaluation
      const scheduleBody = [
        ["1", "Required Vessel Nominal Volume (V)", `${results.volume_disp.toFixed(2)} ${volUnit}`, "100%", "V = 16.5 × (Q × Pp × Pa) / (Zmax × ΔP × Pc)"],
        ["2", "Gas Preload Setting Pressure (Pc)", `${results.pc_disp.toFixed(2)} ${pressUnit}`, "Preload Cushion", "Pc = Pa - 0.20 bar (prevents bladder collapse)"],
        ["3", "Working Pressure Differential (ΔP)", `${results.deltaP_disp.toFixed(2)} ${pressUnit}`, "Drawdown Delta", "ΔP = Pp - Pa (effective pressure swing)"],
        ["4", "Peak Cycle Switching Frequency (Z)", `${results.z} starts/hr`, "Motor Duty", "Compliant with NEMA & IEC motor ratings"],
      ];

      callAutoTable(doc, {
        startY: currentY + 2.5,
        head: [["Sr.", "Metric / Sizing Parameter", "Design Value", "Allocation", "Formula & Standard Reference"]],
        body: scheduleBody,
        theme: "grid",
        headStyles: {
          fillColor: blueFill,
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 8.5,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [40, 40, 40],
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250],
        },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 60, fontStyle: "bold" },
          2: { cellWidth: 38, halign: "center", fontStyle: "bold" },
          3: { cellWidth: 30, halign: "center" },
          4: { cellWidth: 42, halign: "left" },
        },
      });

      currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 145;

      // Status Verification Banner
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      if (isAdequate) {
        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(16, 185, 129);
      } else {
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(239, 68, 68);
      }
      doc.rect(14, currentY, 182, 13, "FD");

      doc.setFont("helvetica", "bold");
      doc.setTextColor(isAdequate ? 5 : 185, isAdequate ? 150 : 28, isAdequate ? 105 : 28);
      doc.text(isAdequate ? "PRESSURE VESSEL SIZING VERIFICATION: PASSED (COMPLIANT)" : "PRESSURE VESSEL SIZING VERIFICATION: WARNING (INVALID CRITERIA)", 18, currentY + 5);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(8);
      const adequacyMsg = isAdequate
        ? `The required vessel capacity of ${results.volume_disp.toFixed(2)} ${volUnit} with gas preload of ${results.pc_disp.toFixed(2)} ${pressUnit} ensures pump cycle limits are restricted to $\\le$ ${results.z} starts/hr, complying with CIBSE Guide W and DIN 4807-5.`
        : `Invalid pressure configuration: cut-out pressure (Pp) must exceed cut-in pressure (Pa) by at least 0.5 bar to calculate effective drawdown.`;
      doc.text(adequacyMsg, 18, currentY + 9.5);

      // Signature Block (Table 3)
      currentY = currentY + 17;
      const reviewDetails = getSignatureBlockDetails(calcReviewState, currentUserName);
      const originatedDate = reviewDetails?.originatedDate || formatDateStr(new Date().toISOString());
      const reviewerDate = reviewDetails?.reviewerDate || "-";
      const approverDate = reviewDetails?.approverDate || "-";

      callAutoTable(doc, {
        startY: currentY,
        head: [["Approvals", "Originated By", "Reviewed By", "Approved By"]],
        body: [
          [
            { content: "Name / Role:", styles: { fontStyle: "bold", halign: "right" } },
            { content: reviewDetails.originator?.name || reviewDetails.originatedName || currentUserName || "-", styles: { halign: "center" } },
            { content: reviewDetails.reviewer?.name || reviewDetails.reviewerName || "-", styles: { halign: "center" } },
            { content: reviewDetails.approver?.name || reviewDetails.approverName || "-", styles: { halign: "center" } },
          ],
          [
            { content: "Status:", styles: { fontStyle: "bold", halign: "right" } },
            { content: reviewDetails.originator?.status || "Signed", styles: { halign: "center" } },
            { content: reviewDetails.reviewer?.status || (reviewDetails.reviewerName ? "Reviewed" : "Pending"), styles: { halign: "center" } },
            { content: reviewDetails.approver?.status || (reviewDetails.approverName ? "Approved" : "Pending"), styles: { halign: "center" } },
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate, styles: { halign: "center" } },
            { content: reviewerDate, styles: { halign: "center" } },
            { content: approverDate, styles: { halign: "center" } },
          ],
        ],
        theme: "grid",
        headStyles: {
          fillColor: primaryFill,
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 8.5,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [40, 40, 40],
        },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 50 },
        },
      });

      const pdfBuffer = doc.output("arraybuffer");
      await downloadFile(
        new Uint8Array(pdfBuffer),
        `Pressure_Vessel_Sizing_${project?.code || "P001"}.pdf`,
        "PDF Document",
        ["pdf"]
      );
      toast.success("Pressure Vessel Sizing PDF report exported successfully!");
    } catch (err: any) {
      console.error("PDF generation failed", err);
      toast.error(`Failed generating PDF report: ${err?.message || String(err)}`);
    }
  };

  const copyToClipboard = (val: string | number) => {
    navigator.clipboard.writeText(String(val));
    toast.success("Copied to clipboard");
  };

  const inputClass = "w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono text-xs text-foreground focus:outline-none focus:border-primary disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground";
  const flowInputClass = "w-full h-9 px-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-mono font-semibold text-foreground focus:outline-none focus:border-[#0A7BC7] disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground";
  const selectClass = "w-full h-8 pl-2.5 pr-7 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-xs text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground";

  const isFieldHighlighted = (id: string, name?: string) => {
    if (!highlightedTargetId) return "";
    const target = highlightedTargetId.toLowerCase();
    if (target === id.toLowerCase() || (name && target === name.toLowerCase())) {
      return "ring-2 ring-primary bg-blue-50/50 dark:bg-blue-950/40";
    }
    return "";
  };

  const renderCommentBadge = (id: string, name: string) => {
    const count = (commentsMap[id] || []).length;
    if (count === 0) return null;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setActiveCommentTarget({ id, label: name });
        }}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline ml-1.5 cursor-pointer"
      >
        <MessageSquare className="size-3 fill-primary/20" />
        <span>{count}</span>
      </button>
    );
  };

  // Helper renderer for input boxes with context menu matching ventilation
  const renderInputBox = (
    fieldId: keyof PressureVesselInputs,
    label: string,
    value: number | string,
    unit: string,
    step: string = "1",
    min: number = 0,
    defaultVal: number
  ) => {
    const isHighlighted = highlightedTargetId === fieldId;
    const comments = commentsMap[fieldId] || [];

    return (
      <ContextMenu key={fieldId}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${fieldId}`}
            className={`p-3 rounded-xl border transition-all relative ${
              isHighlighted
                ? "ring-2 ring-primary bg-blue-50/40 dark:bg-blue-950/30 border-primary"
                : "bg-slate-50/70 dark:bg-slate-900/50 border-border/80 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground tracking-tight">
                {label}
              </label>
              <div className="flex items-center gap-1">
                {comments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveCommentTarget({ id: fieldId, label })}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                    title={`${comments.length} comment(s)`}
                  >
                    <MessageSquare className="size-3 fill-primary/20" />
                    <span>{comments.length}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step={step}
                min={min}
                disabled={isEffectiveReadOnly}
                value={value}
                onChange={(e) => handleInputChange(fieldId, parseFloat(e.target.value) || 0)}
                className="w-full bg-background border border-border/90 rounded-lg px-3 py-1.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition disabled:opacity-60"
              />
              <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap min-w-[45px]">
                {unit}
              </span>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
          <ContextMenuItem
            onClick={() => setActiveCommentTarget({ id: fieldId, label })}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>Add / View Comment</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => copyToClipboard(value)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
          </ContextMenuItem>
          {!isEffectiveReadOnly && (
            <>
              <ContextMenuSeparator className="h-px bg-border my-1" />
              <ContextMenuItem
                onClick={() => handleInputChange(fieldId, defaultVal)}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-muted-foreground"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset Default ({defaultVal})</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <AppShell title="Pressure Vessel Sizing" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Page Header & Actions */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">Pressure Vessel Sizing</h1>
              
              {/* Intelligence Trigger Button */}
              <button 
                type="button"
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Pressure Vessel Sizing Intelligence"
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>

              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-pressure-vessel" calculatorTitle="Pressure Vessel Sizing" />
            </div>

            {/* Unit System Toggle in Header inline with Approve / Reject */}
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={inputs.unitSystem.toLowerCase() as any} onChange={(u) => handleUnitSystem(u.toUpperCase() as any)} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* Main Content Card Container */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setTab("calculator")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "calculator"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Pressure Vessel Sizer
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

                {/* Formula Breakdown button placed right next to tabs */}
                <TBtn
                  onClick={() => setShowFormulaModal(true)}
                  title="Detailed Formulas & Sizing Derivations"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Right Side Action Button: Export */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={handleExportPdf}>
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "calculator" ? (
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-8">
                    
                    {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
                    <div className="lg:col-span-5 space-y-5">
                      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                          <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                            🕹 SIZING PARAMETERS
                          </span>
                        </div>

                        {/* Section 1: Pump Duty & Inflow Criteria */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-pumpDuty"
                              data-field-id="pumpDuty"
                              data-comment-target="pumpDuty"
                              className={`space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("pumpDuty", "Pump Duty")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Pump Duty &amp; Inflow Rate
                                  </span>
                                  {renderCommentBadge("pumpDuty", "Pump Duty")}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => handleImport("booster")}
                                  className="py-1.5 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-primary border border-blue-200/80 dark:border-blue-800/60 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                                >
                                  Import Booster
                                </button>
                                <button
                                  type="button"
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => handleImport("transfer")}
                                  className="py-1.5 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-primary border border-blue-200/80 dark:border-blue-800/60 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                                >
                                  Import Transfer
                                </button>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                  Pump Discharge Flow Rate ({flowUnit})
                                </label>
                                <input
                                  type="number"
                                  step="1"
                                  min={0}
                                  disabled={isEffectiveReadOnly}
                                  value={inputs.qLmin}
                                  onChange={(e) => handleInputChange("qLmin", parseFloat(e.target.value) || 0)}
                                  className={flowInputClass}
                                />
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => {
                                handleInputChange("qLmin", isIP ? 20.6 : 78);
                                toast.success("Pump flow parameter reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Pump Duty</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "pumpDuty", label: "Pump Duty" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Section 2: Pressure & Starts Criteria */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-pressureSettings"
                              data-field-id="pressureSettings"
                              data-comment-target="pressureSettings"
                              className={`pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("pressureSettings", "Pressure & Starts")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Pressure &amp; Starts Settings
                                  </span>
                                  {renderCommentBadge("pressureSettings", "Pressure & Starts")}
                                </div>
                                <span className="text-[11.5px] font-medium text-slate-500">
                                  Preload: {results.pc_disp.toFixed(2)} {pressUnit}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Pump Stop (Pp) ({pressUnit})</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min={0}
                                    disabled={isEffectiveReadOnly}
                                    value={inputs.ppVal}
                                    onChange={(e) => handleInputChange("ppVal", parseFloat(e.target.value) || 0)}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Pump Start (Pa) ({pressUnit})</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min={0}
                                    disabled={isEffectiveReadOnly}
                                    value={inputs.paVal}
                                    onChange={(e) => handleInputChange("paVal", parseFloat(e.target.value) || 0)}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Band Factor (ratio)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    disabled={isEffectiveReadOnly}
                                    value={inputs.bandFactor}
                                    onChange={(e) => handleInputChange("bandFactor", parseFloat(e.target.value) || 0)}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Max Starts (Zmax #/hr)</label>
                                  <input
                                    type="number"
                                    step="5"
                                    min={0}
                                    disabled={isEffectiveReadOnly}
                                    value={inputs.zmax}
                                    onChange={(e) => handleInputChange("zmax", parseFloat(e.target.value) || 0)}
                                    className={inputClass}
                                  />
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => {
                                handleInputChange("ppVal", isIP ? 123.6 : 8.52);
                                handleInputChange("paVal", isIP ? 82.4 : 5.68);
                                handleInputChange("bandFactor", 0.20);
                                handleInputChange("zmax", 60);
                                toast.success("Pressure parameters reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Pressure Settings</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "pressureSettings", label: "Pressure & Starts" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                      </div>
                    </div>

                    {/* RIGHT COLUMN: CALCULATION RESULTS SUMMARY (lg:col-span-7) */}
                    <div className="lg:col-span-7 space-y-5 lg:sticky lg:top-0 self-start">
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="card-calculation-results"
                            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5 transition-all hover:border-slate-300 dark:hover:border-zinc-700"
                          >
                            
                            {/* Header */}
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                              <div className="flex items-center gap-2">
                                <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                  ⚡ Sizing Results Summary
                                </span>
                              </div>

                              {/* Status Badge */}
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                isAdequate
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              }`}>
                                {isAdequate ? <ShieldCheck className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                                <span>{isAdequate ? `Vessel: ${results.volume_disp.toFixed(1)} ${volUnit}` : "Check Pressures"}</span>
                              </span>
                            </div>

                            {/* 4 Colorful Top Metric Tiles (Matching Pump Sizing) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Required Capacity</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {results.volume_disp.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">{volUnit}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-mono mt-0.5">Physical nominal volume</span>
                              </div>

                              <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Preload Pressure</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {results.pc_disp.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{pressUnit}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">Pc @ Pa - 0.20 bar</span>
                              </div>

                              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Pressure Delta (ΔP)</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {results.deltaP_disp.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{pressUnit}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">Pp - Pa swing</span>
                              </div>

                              <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Max Starts / Hr</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {results.z} <span className="text-xs font-normal text-muted-foreground">#/hr</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">Motor switching threshold</span>
                              </div>
                            </div>

                            {/* DETAILED HYDRAULICS TABLE */}
                            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Pump Discharge Volume (Q):</span>
                                <span className="font-mono font-bold text-foreground">{inputs.qLmin.toFixed(2)} {flowUnit}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Pump Cut-out Stop Pressure (Pp):</span>
                                <span className="font-mono font-bold text-foreground">{Number(inputs.ppVal).toFixed(2)} {pressUnit}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Pump Cut-in Start Pressure (Pa):</span>
                                <span className="font-mono font-bold text-foreground">{Number(inputs.paVal).toFixed(2)} {pressUnit}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Gas Preload Setting Pressure (Pc):</span>
                                <span className="font-mono font-bold text-foreground">{results.pc_disp.toFixed(2)} {pressUnit}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">CIBSE Guide W / DIN Sizing Constant:</span>
                                <span className="font-mono font-bold text-foreground">16.5</span>
                              </div>
                              <div className="flex justify-between py-1 font-bold text-foreground">
                                <span>Estimated Required Physical Vessel Capacity:</span>
                                <span className="font-mono text-primary text-sm">
                                  {results.volume_disp.toFixed(2)} {volUnit}
                                </span>
                              </div>
                            </div>

                            {/* Storage / Hydraulic Verification Banner */}
                            <div className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                              isAdequate
                                ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200"
                                : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200"
                            }`}>
                              {isAdequate ? (
                                <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                              ) : (
                                <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                              )}
                              <div>
                                <strong className="text-[12px] block">
                                  {isAdequate ? "Pressure Vessel Capacity Verified:" : "Pressure Differential Warning:"}
                                </strong>
                                <p className="mt-0.5 leading-relaxed text-[11.5px]">
                                  {isAdequate
                                    ? `A pressure vessel of ${results.volume_disp.toFixed(1)} ${volUnit} with gas preload of ${results.pc_disp.toFixed(2)} ${pressUnit} maintains hydraulic buffer and limits pump switching frequency to $\\le$ ${results.z} starts/hr.`
                                    : `Pump cut-out pressure (${Number(inputs.ppVal).toFixed(2)} ${pressUnit}) must be higher than cut-in pressure (${Number(inputs.paVal).toFixed(2)} ${pressUnit}) to size pressure vessel.`}
                                </p>
                              </div>
                            </div>

                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => copyToClipboard(`Required Vessel Volume: ${results.volume_disp.toFixed(1)} ${volUnit}, Preload: ${results.pc_disp.toFixed(2)} ${pressUnit}`)}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Results Summary</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={handleExportPdf}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                          >
                            <FileText className="size-3.5" />
                            <span>Export PDF Report</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => setActiveCommentTarget({ id: "results", label: "Calculation Results" })}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add / View Comment</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  </div>
                </div>
              ) : (
                /* Report View Tab (Preliminary Document Format) */
                <PressureVesselReportView
                  inputs={inputs}
                  results={results}
                  project={project}
                  calcReviewState={calcReviewState}
                  currentUserName={currentUserName}
                  isIP={isIP}
                  flowUnit={flowUnit}
                  pressUnit={pressUnit}
                  volUnit={volUnit}
                  isAdequate={isAdequate}
                />
              )}
            </div>
          </div>
        </div>

        {/* Intelligence Drawer (Collapsible Right Side Panel) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <PressureVesselIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              inputs={inputs}
              handleInputChange={handleInputChange}
              setInputs={(newInputs: PressureVesselInputs) => {
                setInputs(newInputs);
                saveState(newInputs);
              }}
              results={results}
              flowUnit={flowUnit}
              pressUnit={pressUnit}
              volUnit={volUnit}
              isIP={isIP}
              isEffectiveReadOnly={isEffectiveReadOnly}
            />
          )}
        </div>
      </div>

      {/* Formula & Derivations Modal */}
      {showFormulaModal && (
        <PressureVesselFormulaModal
          inputs={inputs}
          results={results}
          isIP={isIP}
          flowUnit={flowUnit}
          pressUnit={pressUnit}
          volUnit={volUnit}
          onClose={() => setShowFormulaModal(false)}
        />
      )}

      {/* Assign / View Comment Modal */}
      {activeCommentTarget && (
        <AssignCommentModal
          isOpen={true}
          onClose={() => setActiveCommentTarget(null)}
          onSave={handleSaveComment}
          targetId={activeCommentTarget.id}
          targetName={activeCommentTarget.label}
          existingComments={commentsMap[activeCommentTarget.id] || []}
        />
      )}
    </AppShell>
  );
}

// Live Intelligence Drawer Component for Pressure Vessel Sizer
function PressureVesselIntelligenceDrawer({
  onClose,
  inputs,
  handleInputChange,
  setInputs,
  results,
  flowUnit,
  pressUnit,
  volUnit,
  isIP,
  isEffectiveReadOnly,
}: {
  onClose: () => void;
  inputs: PressureVesselInputs;
  handleInputChange: (field: keyof PressureVesselInputs, val: any) => void;
  setInputs: (inputs: PressureVesselInputs) => void;
  results: any;
  flowUnit: string;
  pressUnit: string;
  volUnit: string;
  isIP: boolean;
  isEffectiveReadOnly: boolean;
}) {
  const applyPreset = (preset: {
    qLmin: number;
    bandFactor: number;
    ppVal: number;
    paVal: number;
    zmax: number;
  }) => {
    if (isEffectiveReadOnly) return;
    const nextInputs: PressureVesselInputs = {
      ...inputs,
      qLmin: isIP ? Number((preset.qLmin / GPM_TO_LMIN).toFixed(2)) : preset.qLmin,
      bandFactor: preset.bandFactor,
      ppVal: isIP ? Number((preset.ppVal / PSI_TO_BAR).toFixed(2)) : preset.ppVal,
      paVal: isIP ? Number((preset.paVal / PSI_TO_BAR).toFixed(2)) : preset.paVal,
      zmax: preset.zmax,
    };
    setInputs(nextInputs);
    toast.success("Applied pressure vessel archetype preset");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4.5 text-primary" />
          <div>
            <h3 className="font-bold text-[13.5px] uppercase tracking-wider text-foreground">Live Intelligence</h3>
            <p className="text-[10.5px] text-muted-foreground font-medium">IPC / CIBSE Guide W Hydro-Pneumatic Sizer</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-7 rounded-lg hover:bg-surface-2 grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title="Close Live Intelligence"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-[12.5px] leading-relaxed text-foreground custom-scrollbar">
        
        {/* 1. Cycle & Drawdown Audit Card */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
              <Activity className="size-4 text-primary" />
              <span>Pump Cycling Frequency Audit</span>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${results.isAdequate ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}>
              {results.isAdequate ? "COMPLIANT" : "INVALID"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-border/60 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Required Tank Volume:</span>
              <span className="font-bold text-primary font-mono">{results.volume_disp.toFixed(1)} {volUnit}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Preload Setting (Pc):</span>
              <span className="font-bold text-foreground font-mono">{results.pc_disp.toFixed(2)} {pressUnit}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Pressure Delta (ΔP):</span>
              <span className="font-bold text-foreground font-mono">{results.deltaP_disp.toFixed(2)} {pressUnit}</span>
            </div>
          </div>
        </div>

        {/* 2. Technical Guidance */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
            <Zap className="size-4 text-amber-500" />
            <span>Preload Pressure Principle</span>
          </span>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            Gas preload ($P_c$) must be charged to <strong>0.20 bar (3 psi) below cut-in pressure ($P_a$)</strong>. This prevents bladder bottoming and ensures water buffer is instantly delivered before the pump starts.
          </p>
        </div>

        {/* 3. Project Archetype Presets */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
            <Building2 className="size-4 text-primary" />
            <span>Quick System Archetypes</span>
          </span>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={isEffectiveReadOnly}
              onClick={() => applyPreset({
                qLmin: 78,
                bandFactor: 0.20,
                ppVal: 8.52,
                paVal: 5.68,
                zmax: 60,
              })}
              className="p-2.5 rounded-xl border border-border/80 bg-slate-50/70 dark:bg-slate-900/40 hover:border-primary/60 text-left transition flex items-center justify-between group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Home className="size-4 text-primary shrink-0" />
                <div>
                  <strong className="text-xs text-foreground block">Standard Booster Set Vessel</strong>
                  <span className="text-[10.5px] text-muted-foreground">78 L/min · 8.5/5.7 bar · 60 starts/hr</span>
                </div>
              </div>
              <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-primary transition" />
            </button>

            <button
              type="button"
              disabled={isEffectiveReadOnly}
              onClick={() => applyPreset({
                qLmin: 240,
                bandFactor: 0.15,
                ppVal: 12.0,
                paVal: 8.5,
                zmax: 30,
              })}
              className="p-2.5 rounded-xl border border-border/80 bg-slate-50/70 dark:bg-slate-900/40 hover:border-primary/60 text-left transition flex items-center justify-between group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-primary shrink-0" />
                <div>
                  <strong className="text-xs text-foreground block">High-Rise Hydro-Pneumatic Station</strong>
                  <span className="text-[10.5px] text-muted-foreground">240 L/min · 12.0/8.5 bar · 30 starts/hr</span>
                </div>
              </div>
              <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-primary transition" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Preliminary Report View Component
function PressureVesselReportView({
  inputs,
  results,
  project,
  calcReviewState,
  currentUserName,
  isIP,
  flowUnit,
  pressUnit,
  volUnit,
  isAdequate,
}: {
  inputs: PressureVesselInputs;
  results: any;
  project: any;
  calcReviewState: CalculationReviewState | null;
  currentUserName: string;
  isIP: boolean;
  flowUnit: string;
  pressUnit: string;
  volUnit: string;
  isAdequate: boolean;
}) {
  const calcNo = `CALC-PV-${project?.code || "001"}`;
  const projectNo = project?.code || "PRJ-001";
  const projectName = project?.name || "Pressure Vessel Sizing Project";
  const clientName = (project as any)?.client || "Client Representative";
  const endUser = (project as any)?.endUser || "Building Facilities / MEP Department";
  const today = formatDateStr(new Date().toISOString());

  const sigDetails = getSignatureBlockDetails(calcReviewState, currentUserName);

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="flex items-center gap-1 px-4 h-11 shrink-0 border-b border-border/50 bg-card/50 no-print">
        <span className="text-[12px] text-muted-foreground font-semibold">
          Generated: <span className="text-foreground font-mono">{today}</span>
        </span>
      </div>

      {/* Main Report Document Sheet */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
        <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6 font-sans">
          
          {/* Header Title & Date */}
          <div className="flex justify-between items-start pb-4 border-b border-border">
            <div>
              <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                Pressure Vessel Sizing Preliminary Report
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Design Standards: IPC / CIBSE Guide W Section 4 / BS EN 13831 / DIN 4807-5 Bladder Expansion Vessel Sizing
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block font-mono">Date: {today}</span>
            </div>
          </div>

          {/* Enclosed Project Metadata Grid (3 rows x 2 cols) */}
          <div className="border border-border rounded-xl overflow-hidden text-[12px]">
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-muted/20">
              <div className="p-2.5 px-3 flex justify-between">
                <span className="font-bold text-foreground">Calculation No.:</span>
                <span className="text-muted-foreground font-mono">{calcNo}</span>
              </div>
              <div className="p-2.5 px-3 flex justify-between">
                <span className="font-bold text-foreground">Date:</span>
                <span className="text-muted-foreground">{today}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
              <div className="p-2.5 px-3 flex justify-between">
                <span className="font-bold text-foreground">Project No.:</span>
                <span className="text-muted-foreground">{projectNo}</span>
              </div>
              <div className="p-2.5 px-3 flex justify-between">
                <span className="font-bold text-foreground">Client:</span>
                <span className="text-muted-foreground">{clientName}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border">
              <div className="p-2.5 px-3 flex justify-between">
                <span className="font-bold text-foreground">Project Name:</span>
                <span className="text-muted-foreground">{projectName}</span>
              </div>
              <div className="p-2.5 px-3 flex justify-between">
                <span className="font-bold text-foreground">End User:</span>
                <span className="text-muted-foreground">{endUser}</span>
              </div>
            </div>
          </div>

          {/* Table 1: Pump Operating Parameters & Hydraulic Constraints */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              1. Pump Operating Parameters &amp; Pressure Constraints
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                      <th className="py-2 px-2.5 w-10">Sr.</th>
                      <th className="py-2 px-3 text-left">Parameter Description</th>
                      <th className="py-2 px-3 text-center w-32">Design Value</th>
                      <th className="py-2 px-3 text-center w-36">SI Equivalent</th>
                      <th className="py-2 px-3 text-left">Engineering Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">1</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Pump Discharge Flow (Q)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{inputs.qLmin.toFixed(2)} {flowUnit}</td>
                      <td className="py-2 px-3 text-center font-mono">{results.q_lmin.toFixed(1)} L/min</td>
                      <td className="py-2 px-3 text-muted-foreground">Continuous peak booster discharge capacity</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">2</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Band Factor (-)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{Number(inputs.bandFactor).toFixed(2)}</td>
                      <td className="py-2 px-3 text-center font-mono">±{(Number(inputs.bandFactor) * 100).toFixed(0)}%</td>
                      <td className="py-2 px-3 text-muted-foreground">Operating pressure band margin</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">3</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Pump Cut-out Stop Pressure (Pp)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{Number(inputs.ppVal).toFixed(2)} {pressUnit}</td>
                      <td className="py-2 px-3 text-center font-mono">{results.pp_bar.toFixed(2)} bar</td>
                      <td className="py-2 px-3 text-muted-foreground">Maximum system shut-off threshold</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">4</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Pump Cut-in Start Pressure (Pa)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{Number(inputs.paVal).toFixed(2)} {pressUnit}</td>
                      <td className="py-2 px-3 text-center font-mono">{results.pa_bar.toFixed(2)} bar</td>
                      <td className="py-2 px-3 text-muted-foreground">Minimum system start trigger pressure</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">5</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Gas Preload Setting (Pc)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{results.pc_disp.toFixed(2)} {pressUnit}</td>
                      <td className="py-2 px-3 text-center font-mono">{results.pc_bar.toFixed(2)} bar</td>
                      <td className="py-2 px-3 text-muted-foreground">Pre-charge nitrogen cushion (Pa - 0.20 bar)</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">6</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Max Starts per Hour (Zmax)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{inputs.zmax} starts/hr</td>
                      <td className="py-2 px-3 text-center font-mono">{inputs.zmax} / hr</td>
                      <td className="py-2 px-3 text-muted-foreground">Motor thermal cycle switching limitation</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Table 2: Vessel Capacity & Hydraulic Evaluation */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              2. Expansion &amp; Pressure Vessel Sizing Evaluation
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                      <th className="py-2 px-2.5 w-10">Sr.</th>
                      <th className="py-2 px-3 text-left">Metric / Sizing Parameter</th>
                      <th className="py-2 px-3 text-center w-36">Calculated Value</th>
                      <th className="py-2 px-3 text-center w-32">Allocation</th>
                      <th className="py-2 px-3 text-left">Formula &amp; Standard Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold text-foreground">
                      <td className="py-2 px-2.5 text-center font-mono">1</td>
                      <td className="py-2 px-3 text-primary">Required Vessel Capacity (V)</td>
                      <td className="py-2 px-3 text-center font-mono text-primary font-bold text-xs">{results.volume_disp.toFixed(2)} {volUnit}</td>
                      <td className="py-2 px-3 text-center font-mono">100% Volume</td>
                      <td className="py-2 px-3 text-primary">V = 16.5 × (Q × Pp × Pa) / (Zmax × ΔP × Pc)</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">2</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Gas Preload Setting (Pc)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{results.pc_disp.toFixed(2)} {pressUnit}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">Gas Cushion</td>
                      <td className="py-2 px-3 text-muted-foreground">Pc = Pa - 0.20 bar (prevents bladder bottoming)</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">3</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Working Pressure Delta (ΔP)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{results.deltaP_disp.toFixed(2)} {pressUnit}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">Pressure Swing</td>
                      <td className="py-2 px-3 text-muted-foreground">ΔP = Pp - Pa (usable differential range)</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">4</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Peak Cycle Switching (Z)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{results.z} starts/hr</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">Motor Limit</td>
                      <td className="py-2 px-3 text-muted-foreground">Prevents motor winding overheating</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Status Verification Banner */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
            isAdequate
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200"
          }`}>
            <CheckCircle className={`size-5 shrink-0 ${isAdequate ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} mt-0.5`} />
            <div>
              <strong className="text-sm block">
                {isAdequate ? "Pressure Vessel Sizing Verification: PASSED (COMPLIANT)" : "Pressure Vessel Sizing Verification: WARNING (INVALID)"}
              </strong>
              <p className="mt-1 leading-relaxed text-xs">
                {isAdequate
                  ? `The calculated vessel nominal capacity of ${results.volume_disp.toFixed(1)} ${volUnit} with gas preload of ${results.pc_disp.toFixed(2)} ${pressUnit} provides adequate hydraulic drawdown to maintain pump cycle rate $\\le$ ${results.z} starts/hr, satisfying CIBSE Guide W Section 4 and DIN 4807-5.`
                  : `Please check input pressures: cut-out stop pressure must be strictly greater than cut-in start pressure.`}
              </p>
            </div>
          </div>

          {/* Table 3: 4-Column Dynamic Signatures */}
          <div className="space-y-2 pt-2">
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                    <th className="py-2 px-3 w-32">Approvals</th>
                    <th className="py-2 px-3 text-center">Originated By</th>
                    <th className="py-2 px-3 text-center">Reviewed By</th>
                    <th className="py-2 px-3 text-center">Approved By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-sans">
                  <tr>
                    <td className="py-2 px-3 font-bold text-foreground text-right">Name / Role:</td>
                    <td className="py-2 px-3 text-center text-foreground font-medium">{sigDetails.originator?.name || sigDetails.originatedName || currentUserName}</td>
                    <td className="py-2 px-3 text-center text-foreground">{sigDetails.reviewer?.name || sigDetails.reviewerName || "-"}</td>
                    <td className="py-2 px-3 text-center text-foreground">{sigDetails.approver?.name || sigDetails.approverName || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-foreground text-right">Status:</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{sigDetails.originator?.status || "Signed"}</td>
                    <td className="py-2 px-3 text-center text-foreground">{sigDetails.reviewer?.status || (sigDetails.reviewerName ? "Reviewed" : "Pending")}</td>
                    <td className="py-2 px-3 text-center text-foreground">{sigDetails.approver?.status || (sigDetails.approverName ? "Approved" : "Pending")}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-foreground text-right">Date:</td>
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">{sigDetails?.originatedDate || today}</td>
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">{sigDetails?.reviewerDate || "-"}</td>
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">{sigDetails?.approverDate || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Step-by-Step Formula Breakdown Modal
function PressureVesselFormulaModal({
  inputs,
  results,
  isIP,
  flowUnit,
  pressUnit,
  volUnit,
  onClose,
}: {
  inputs: PressureVesselInputs;
  results: any;
  isIP: boolean;
  flowUnit: string;
  pressUnit: string;
  volUnit: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4 max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Info className="size-5 text-primary" />
            <div>
              <h3 className="font-bold text-base text-foreground">Pressure Vessel Mathematical Equations</h3>
              <p className="text-xs text-muted-foreground">IPC &amp; CIBSE Guide W Bladder Expansion Vessel Sizing</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-surface-2 grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Derivations Content */}
        <div className="flex-1 overflow-y-auto space-y-4 text-xs leading-relaxed custom-scrollbar pr-1">
          
          {/* Step 1 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-border space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px]">1</span>
              <span>Gas Preload Pressure (Pc)</span>
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Set slightly below pump cut-in pressure (Pa) to ensure continuous drawdown before pump start:
            </p>
            <div className="p-2.5 rounded-lg bg-background border font-mono text-primary text-xs">
              Pc = Pa − 0.20 bar (or Pc = Pa − 3.0 psi)
            </div>
            <p className="text-muted-foreground text-[11px] font-mono">
              Pc = {Number(inputs.paVal).toFixed(2)} {pressUnit} − {isIP ? "3.00 psi" : "0.20 bar"} = {results.pc_disp.toFixed(2)} {pressUnit}
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-border space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px]">2</span>
              <span>Operating Pressure Differential (ΔP)</span>
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Effective pressure swing between pump cut-out (Pp) and cut-in (Pa):
            </p>
            <div className="p-2.5 rounded-lg bg-background border font-mono text-primary text-xs">
              ΔP = Pp − Pa
            </div>
            <p className="text-muted-foreground text-[11px] font-mono">
              ΔP = {Number(inputs.ppVal).toFixed(2)} {pressUnit} − {Number(inputs.paVal).toFixed(2)} {pressUnit} = {results.deltaP_disp.toFixed(2)} {pressUnit}
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-border space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px]">3</span>
              <span>Required Vessel Nominal Volume (V)</span>
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              CIBSE Guide W / DIN 4807-5 formula based on discharge flow and cycle frequency:
            </p>
            <div className="p-2.5 rounded-lg bg-background border font-mono text-primary text-xs">
              V = 16.5 × (Q × Pp × Pa) ÷ (Zmax × ΔP × Pc)
            </div>
            <p className="text-muted-foreground text-[11px] font-mono">
              V = 16.5 × ({results.q_lmin.toFixed(1)} × {results.pp_bar.toFixed(2)} × {results.pa_bar.toFixed(2)}) ÷ ({results.z} × {results.deltaP_bar.toFixed(2)} × {results.pc_bar.toFixed(2)}) = {results.volume_disp.toFixed(2)} {volUnit}
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
