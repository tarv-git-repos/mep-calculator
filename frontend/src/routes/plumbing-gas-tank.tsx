import React, { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { TBtn } from "@/components/workspace/Button";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr, addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Flame, Info, Download, MessageSquare, Check, ShieldCheck,
  AlertTriangle, Copy, RotateCcw, CheckCircle2, X, Gauge, Cylinder, Sparkles, FileText,
  TrendingUp, Layers, HelpCircle, Printer, Activity, Zap, Building2, Utensils, Home, ArrowUpRight
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

export const Route = createFileRoute("/plumbing-gas-tank")({
  head: () => ({
    meta: [
      { title: "Gas Storage Capacity — MEP Calc" },
      { name: "description", content: "Calculate required gas storage tank capacity and sizing based on residential and retail kitchen average daily demand." }
    ],
  }),
  component: GasTankPage,
});

export interface GasTankInputs {
  gasType: "ng" | "lpg";
  unitSystem: "SI" | "IP";
  resKitchens: number;
  resDemandConst: number; // m3/day (SI) or ft3/day (IP)
  retKitchens: number;
  retDemandConst: number; // m3/day (SI) or ft3/day (IP)
  storageCapacity: number; // Litres (SI) or US Gallons (IP)
}

const DEFAULT_INPUTS: GasTankInputs = {
  gasType: "ng",
  unitSystem: "SI",
  resKitchens: 0,
  resDemandConst: 0.19,
  retKitchens: 0,
  retDemandConst: 52,
  storageCapacity: 30000,
};

function GasTankPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-gas-tank", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-gas-tank", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "Engineer";

  const [inputs, setInputs] = useState<GasTankInputs>(DEFAULT_INPUTS);
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [activeCommentTarget, setActiveCommentTarget] = useState<{ id: string; label: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const { isLocked: isReviewLocked } = useCalculationLock("/plumbing-gas-tank");
  const [tab, setTab] = useState<"calculator" | "report">("calculator");

  // Deep-link from comment notifications and URL query params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("commentTargetId");
      if (targetId) {
        setHighlightedTargetId(targetId);
        setTimeout(() => {
          const el = document.getElementById(`field-${targetId}`) || document.getElementById(targetId);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }

      const onGlobalNotification = (e: any) => {
        const detail = e.detail;
        if (detail?.targetId) {
          setHighlightedTargetId(detail.targetId);
          if (detail.autoOpen) {
            setActiveCommentTarget({ id: detail.targetId, label: detail.targetName || detail.targetId });
          }
          const el = document.getElementById(`field-${detail.targetId}`) || document.getElementById(detail.targetId);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };

      window.addEventListener("mep-comment-notification-clicked", onGlobalNotification);
      return () => {
        window.removeEventListener("mep-comment-notification-clicked", onGlobalNotification);
      };
    }
  }, []);

  // Sync state with Workspace / LocalStorage
  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_gas_tank_calc_${pId}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.inputs) setInputs(parsed.inputs);
        if (parsed.commentsMap) setCommentsMap(parsed.commentsMap);
      } else {
        setInputs(DEFAULT_INPUTS);
        setCommentsMap({});
      }
    } catch (e) {
      console.error("Error loading gas tank state", e);
    }
    setIsLoaded(true);
  }, [project?.id]);

  const saveState = (newInputs: GasTankInputs, newComments = commentsMap) => {
    const pId = project?.id || "default";
    const storageKey = `mep_gas_tank_calc_${pId}`;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          inputs: newInputs,
          commentsMap: newComments,
          updatedAt: new Date().toISOString(),
        })
      );
      dirtyStore.set(true);
    } catch (e) {
      console.error("Error saving gas tank state", e);
    }
  };

  const handleInputChange = (field: keyof GasTankInputs, val: any) => {
    if (isEffectiveReadOnly) return;
    const next = { ...inputs, [field]: val };
    setInputs(next);
    saveState(next);
  };

  const handleGasType = (type: "ng" | "lpg") => {
    if (isEffectiveReadOnly) return;
    handleInputChange("gasType", type);
  };

  const handleUnitSystem = (sys: "SI" | "IP") => {
    if (isEffectiveReadOnly) return;
    handleInputChange("unitSystem", sys);
  };

  // Comment Handlers
  const handleSaveComment = (commentText: string, metadata?: any) => {
    if (!activeCommentTarget) return;
    const targetId = activeCommentTarget.id;
    const currentList = commentsMap[targetId] || [];
    const newComment = {
      id: "cmt-" + Date.now(),
      author: currentUserName,
      date: new Date().toISOString(),
      text: commentText,
      assignedTo: metadata?.assignedTo,
      priority: metadata?.priority || "medium",
      status: "open",
    };
    const updated = { ...commentsMap, [targetId]: [...currentList, newComment] };
    setCommentsMap(updated);
    saveState(inputs, updated);
    toast.success("Comment added");
  };

  const totalCommentsCount = Object.values(commentsMap).reduce((acc, curr) => acc + (curr?.length || 0), 0);

  // Unit system derived labels & conversion factors
  const isIP = inputs.unitSystem === "IP";
  const M3_TO_FT3 = 35.3147;
  const L_TO_GAL = 0.264172;
  const demandUnit = isIP ? "ft³/day" : "m³/day";
  const volUnit = isIP ? "US Gal" : "Litres";

  const resConsumption = inputs.resKitchens * inputs.resDemandConst; // m³/day
  const retConsumption = inputs.retKitchens * inputs.retDemandConst; // m³/day

  const totalDemandNg = (resConsumption + retConsumption) * 1000; // L/day
  const totalDemandLpg = totalDemandNg / 2.67; // L/day (LPG energy ratio ~2.67x)

  const activeDemand = inputs.gasType === "ng" ? totalDemandNg : totalDemandLpg; // L/day
  const activeDemandM3 = activeDemand / 1000; // m³/day

  const resConsumptionDisp = isIP ? resConsumption * M3_TO_FT3 : resConsumption;
  const retConsumptionDisp = isIP ? retConsumption * M3_TO_FT3 : retConsumption;
  const activeDemandDisp = isIP ? activeDemandM3 * M3_TO_FT3 : activeDemandM3;
  const activeDemandVolDisp = isIP ? activeDemand * L_TO_GAL : activeDemand;
  const volUnitDay = isIP ? "gal/day" : "L/day";

  const tankCapacity = activeDemand > 0 ? (activeDemand * 7) / 0.7 : 0; // Litres recommended for 7 days
  const tankCapacityDisp = isIP ? tankCapacity * L_TO_GAL : tankCapacity;

  const storageCapacityL = isIP ? inputs.storageCapacity / L_TO_GAL : inputs.storageCapacity;
  const usableGas = storageCapacityL * 0.7 * 0.8;
  const reserveGas = storageCapacityL * 0.7 * 0.2;
  const vaporHeadspace = storageCapacityL * 0.3;

  const usableGasDisp = isIP ? usableGas * L_TO_GAL : usableGas;
  const reserveGasDisp = isIP ? reserveGas * L_TO_GAL : reserveGas;
  const vaporHeadspaceDisp = isIP ? vaporHeadspace * L_TO_GAL : vaporHeadspace;

  const autonomyDays = activeDemand > 0 ? (usableGas / activeDemand) : 0;
  const isAdequate = storageCapacityL >= tankCapacity;
  const volumeSurplusDeficit = storageCapacityL - tankCapacity;
  const volumeSurplusDeficitDisp = isIP ? volumeSurplusDeficit * L_TO_GAL : volumeSurplusDeficit;

  // PDF Export Function
  const handleExportPdf = async () => {
    try {
      const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
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

      const calcNo = (project as any)?.calcNo || "TRV-CAL-101-R01";
      const today = formatDateStr(new Date().toISOString());
      const projectNo = project?.code || (project as any)?.projectNo || "P000";
      const projectName = project?.name || (project as any)?.projectName || "";
      const clientName = project?.client || "";
      const endUser = (project as any)?.endUser || (project as any)?.location || "";

      // Header Title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Gas Storage Tank Capacity Sizing Report", 14, 14);

      // Metadata Block
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      doc.rect(14, 18, 182, 18);

      doc.line(105, 18, 105, 36);
      doc.line(14, 24, 196, 24);
      doc.line(14, 30, 196, 30);

      doc.setFont("helvetica", "bold");
      doc.text("Calculation No.:", 16, 22);
      doc.setFont("helvetica", "normal");
      doc.text(calcNo, 45, 22);

      doc.setFont("helvetica", "bold");
      doc.text("Project No.:", 16, 28);
      doc.setFont("helvetica", "normal");
      doc.text(projectNo, 40, 28);

      doc.setFont("helvetica", "bold");
      doc.text("Project Name:", 16, 34);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, 42, 34);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", 107, 22);
      doc.setFont("helvetica", "normal");
      doc.text(today, 120, 22);

      doc.setFont("helvetica", "bold");
      doc.text("Client:", 107, 28);
      doc.setFont("helvetica", "normal");
      doc.text(clientName, 120, 28);

      doc.setFont("helvetica", "bold");
      doc.text("End User:", 107, 34);
      doc.setFont("helvetica", "normal");
      doc.text(endUser, 125, 34);

      const primaryFill = [217, 217, 217] as [number, number, number];
      const blueFill = [218, 233, 248] as [number, number, number];

      // Section 1: Kitchen Demand
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("1. Kitchen Consumption & Demand Load Breakdown", 14, 43);

      const demandBody: any[] = [
        [
          "Residential Kitchens",
          `${inputs.resKitchens} units`,
          `${inputs.resDemandConst} m³/day`,
          `${resConsumption.toFixed(2)} m³/day`,
          `${(resConsumption * 1000).toFixed(0)} L/day`,
        ],
        [
          "Retail Food & Beverage (F&B)",
          `${inputs.retKitchens} kitchens`,
          `${inputs.retDemandConst} m³/day`,
          `${retConsumption.toFixed(2)} m³/day`,
          `${(retConsumption * 1000).toFixed(0)} L/day`,
        ],
        [
          "Total Natural Gas Demand (NG)",
          "-",
          "-",
          `${(resConsumption + retConsumption).toFixed(2)} m³/day`,
          `${totalDemandNg.toFixed(1)} L/day`,
        ],
        [
          "Total LPG Gas Demand (Equiv)",
          "-",
          "NG Demand / 2.67",
          `${(totalDemandLpg / 1000).toFixed(2)} m³/day`,
          `${totalDemandLpg.toFixed(1)} L/day`,
        ],
      ];

      callAutoTable(doc, {
        startY: 46,
        head: [["Description / Category", "Quantity", "Constant Basis", "Volumetric Demand", "Daily Volume"]],
        body: demandBody,
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
          1: { cellWidth: 28, halign: "center" },
          2: { cellWidth: 32, halign: "center" },
          3: { cellWidth: 35, halign: "center", fontStyle: "bold" },
          4: { cellWidth: 32, halign: "center", fontStyle: "bold" },
        },
      });

      let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 100;

      // Section 2: Storage Tank Sizing
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("2. Storage Tank Capacity Allocation & Sizing", 14, currentY);

      const activeGasLabel = inputs.gasType === "ng" ? "Natural Gas (NG)" : "LPG Gas (Propane / Butane)";

      const sizingBody: any[] = [
        ["Selected Fuel Type", activeGasLabel, "-", "Selected System Design Basis"],
        ["Active Daily Gas Demand", `${activeDemandVolDisp.toFixed(1)} ${volUnitDay}`, `${activeDemandDisp.toFixed(2)} ${demandUnit}`, "Calculated combined peak daily requirement"],
        ["Design Autonomy Period", "7.0 Days", "-", "Standard weekly replenishment interval"],
        ["Minimum Recommended Tank (7-Day)", `${tankCapacityDisp.toFixed(0)} ${volUnit}`, "70% Max Liquid Fill", "7-day total volume requirement divided by 0.7 fill limit"],
        ["Installed Physical Tank Capacity", `${inputs.storageCapacity.toLocaleString()} ${volUnit}`, "100% Vessel Volume", "Installed vessel gross physical nominal rating"],
        ["Effective Usable Working Volume", `${usableGasDisp.toFixed(0)} ${volUnit}`, "56% Net Working Volume", "Usable operational volume between 70% fill and 20% reserve"],
        ["Safety Refill Reorder Reserve", `${reserveGasDisp.toFixed(0)} ${volUnit}`, "14% Buffer Reserve", "Emergency inventory before tank replenishment"],
        ["Thermal Expansion Vapor Headspace", `${vaporHeadspaceDisp.toFixed(0)} ${volUnit}`, "30% Vapor Space", "Required safety headspace per NFPA 58 / BS 5482 codes"],
        ["Achieved Autonomy Duration", `${autonomyDays.toFixed(1)} Days`, isAdequate ? "Meets Criteria (≥7 Days)" : "Deficit (<7 Days)", isAdequate ? "Adequate storage for weekly autonomy" : "Tank capacity undersized for weekly replenishment"],
      ];

      callAutoTable(doc, {
        startY: currentY + 3,
        head: [["Parameter / Sizing Metric", "Value (Selected Unit)", "Design Allocation", "Engineering Notes / Standard Reference"]],
        body: sizingBody,
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
          0: { cellWidth: 55, fontStyle: "bold" },
          1: { cellWidth: 38, halign: "center", fontStyle: "bold" },
          2: { cellWidth: 38, halign: "center" },
          3: { cellWidth: 51, halign: "left" },
        },
      });

      currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 170;

      // Status Compliance Banner
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      if (isAdequate) {
        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(16, 185, 129);
      } else {
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(239, 68, 68);
      }
      doc.rect(14, currentY, 182, 14, "FD");

      doc.setFont("helvetica", "bold");
      doc.setTextColor(isAdequate ? 5 : 185, isAdequate ? 150 : 28, isAdequate ? 105 : 28);
      doc.text(isAdequate ? "STORAGE CAPACITY VERIFICATION: PASSED (ADEQUATE)" : "STORAGE CAPACITY VERIFICATION: WARNING (UNDERSIZED)", 18, currentY + 5.5);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(8);
      const adequacyMsg = isAdequate
        ? `The installed tank volume of ${inputs.storageCapacity.toLocaleString()} ${volUnit} provides a surplus of +${volumeSurplusDeficitDisp.toFixed(0)} ${volUnit} over the 7-day requirement (${tankCapacityDisp.toFixed(0)} ${volUnit}), achieving ${autonomyDays.toFixed(1)} days of continuous autonomy.`
        : `The installed tank volume of ${inputs.storageCapacity.toLocaleString()} ${volUnit} is insufficient for 7-day autonomy (required: ${tankCapacityDisp.toFixed(0)} ${volUnit}, deficit: ${Math.abs(volumeSurplusDeficitDisp).toFixed(0)} ${volUnit}). Please increase tank size.`;
      doc.text(adequacyMsg, 18, currentY + 10.5);

      // Add Standard Signature Block
      currentY = currentY + 18;
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
        `Gas_Storage_Tank_Sizing_${project?.code || "P000"}.pdf`,
        "PDF Document",
        ["pdf"]
      );
      toast.success("Gas Storage Tank PDF report exported successfully!");
    } catch (err: any) {
      console.error("PDF generation failed", err);
      toast.error(`Failed generating PDF report: ${err?.message || String(err)}`);
    }
  };

  const copyToClipboard = (val: string | number) => {
    navigator.clipboard.writeText(String(val));
    toast.success("Copied to clipboard");
  };

  // Helper renderer for input boxes with context menu matching ventilation fonts & styling
  const renderInputBox = (
    fieldId: keyof GasTankInputs,
    label: string,
    value: number,
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
              <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap min-w-[50px]">
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
    <AppShell title="Gas Storage Capacity" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Page Header & Actions */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">Gas Storage Capacity</h1>
              
              {/* Intelligence Trigger Button */}
              <button 
                type="button"
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Gas Storage Sizing Intelligence"
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>

              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-gas-tank" calculatorTitle="Gas Storage Capacity" />
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
                    Gas Tank Sizer
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
                  title="Detailed Formulas & Derivations"
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
                            📥 Sizing Parameters
                          </span>
                        </div>

                        {/* Section 1: Fuel System Selection */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div 
                              id="field-gasType"
                              data-field-id="gasType"
                              data-comment-target="gasType"
                              className={`space-y-2 p-2 -m-2 rounded-lg transition-colors ${
                                highlightedTargetId === "gasType" ? "ring-2 ring-primary bg-primary/5" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                  Fuel System Selection
                                </span>
                                {(commentsMap["gasType"] || []).length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveCommentTarget({ id: "gasType", label: "Fuel System Selection" })}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                                  >
                                    <MessageSquare className="size-3 fill-primary/20" />
                                    <span>{(commentsMap["gasType"] || []).length}</span>
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-2.5">
                                <button
                                  type="button"
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => handleGasType("ng")}
                                  className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                                    inputs.gasType === "ng"
                                      ? "bg-blue-50 dark:bg-blue-950/40 border-primary text-primary ring-1 ring-primary"
                                      : "bg-slate-50/70 dark:bg-slate-900/50 border-border text-muted-foreground hover:border-primary/50"
                                  }`}
                                >
                                  <span className="text-sm">Natural Gas (NG)</span>
                                  <span className="text-[10px] font-normal text-muted-foreground">Standard Mains / Bulk SNG</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => handleGasType("lpg")}
                                  className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                                    inputs.gasType === "lpg"
                                      ? "bg-blue-50 dark:bg-blue-950/40 border-primary text-primary ring-1 ring-primary"
                                      : "bg-slate-50/70 dark:bg-slate-900/50 border-border text-muted-foreground hover:border-primary/50"
                                  }`}
                                >
                                  <span className="text-sm">LPG Gas (Propane / Butane)</span>
                                  <span className="text-[10px] font-normal text-muted-foreground">2.67× Energy Ratio</span>
                                </button>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleGasType(inputs.gasType === "ng" ? "lpg" : "ng")}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <Flame className="size-3.5 text-primary" />
                              <span>Toggle Fuel ({inputs.gasType === "ng" ? "Switch to LPG" : "Switch to NG"})</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "gasType", label: "Fuel System Selection" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add / View Comment</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Section 2: Units & Demand Constants */}
                        <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Kitchen Units &amp; Demand Constants
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {renderInputBox(
                              "resKitchens",
                              "Residential Units",
                              inputs.resKitchens,
                              "Units",
                              "1",
                              0,
                              DEFAULT_INPUTS.resKitchens
                            )}
                            {renderInputBox(
                              "resDemandConst",
                              "Res. Demand Const.",
                              inputs.resDemandConst,
                              demandUnit,
                              "0.01",
                              0,
                              DEFAULT_INPUTS.resDemandConst
                            )}
                          </div>

                          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium">Residential Subtotal:</span>
                            <span className="font-mono font-bold text-foreground">
                              {resConsumptionDisp.toFixed(2)} {demandUnit} ({(resConsumption * 1000 * (isIP ? L_TO_GAL : 1)).toFixed(0)} {volUnitDay})
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                            {renderInputBox(
                              "retKitchens",
                              "Retail F&B Units",
                              inputs.retKitchens,
                              "Units",
                              "1",
                              0,
                              DEFAULT_INPUTS.retKitchens
                            )}
                            {renderInputBox(
                              "retDemandConst",
                              "Retail Demand Const.",
                              inputs.retDemandConst,
                              demandUnit,
                              "1",
                              0,
                              DEFAULT_INPUTS.retDemandConst
                            )}
                          </div>

                          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium">Retail Subtotal:</span>
                            <span className="font-mono font-bold text-foreground">
                              {retConsumptionDisp.toFixed(2)} {demandUnit} ({(retConsumption * 1000 * (isIP ? L_TO_GAL : 1)).toFixed(0)} {volUnitDay})
                            </span>
                          </div>
                        </div>

                        {/* Section 3: Storage Tank Setting */}
                        <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Storage Tank Capacity
                            </span>
                          </div>

                          {renderInputBox(
                            "storageCapacity",
                            "Installed Tank Nominal Capacity",
                            inputs.storageCapacity,
                            volUnit,
                            "500",
                            0,
                            DEFAULT_INPUTS.storageCapacity
                          )}

                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                              <span className="text-[10px] text-muted-foreground block">Max Safe Fill</span>
                              <strong className="text-primary font-mono text-xs">70% Volume</strong>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800">
                              <span className="text-[10px] text-muted-foreground block">Refill Reserve</span>
                              <strong className="text-foreground font-mono text-xs">20% Level</strong>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800">
                              <span className="text-[10px] text-muted-foreground block">Vapor Space</span>
                              <strong className="text-foreground font-mono text-xs">30% Headroom</strong>
                            </div>
                          </div>
                        </div>

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
                                <span>{isAdequate ? "Adequate Storage" : "Undersized Storage"}</span>
                              </span>
                            </div>

                            {/* 4 Colorful Top Metric Tiles (Matching Pump Sizing) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Active Gas Demand</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {activeDemandVolDisp.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">{volUnitDay}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-mono mt-0.5">({activeDemandDisp.toFixed(2)} {demandUnit})</span>
                              </div>

                              <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Autonomy Duration</div>
                                <div className={`text-xl font-bold font-mono mt-1 ${isAdequate ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                                  {autonomyDays.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">Days</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">Target: ≥ 7.0 Days</span>
                              </div>

                              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Effective Usable Gas</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {usableGasDisp.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">{volUnit}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">56% net working volume</span>
                              </div>

                              <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Recommended Tank</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {tankCapacityDisp.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">{volUnit}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">Weekly supply @ 70% fill</span>
                              </div>
                            </div>

                            {/* DETAILED METRICS TABLE (Matching Pump Sizing) */}
                            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Installed Physical Tank Capacity:</span>
                                <span className="font-mono font-bold text-foreground">{inputs.storageCapacity.toLocaleString()} {volUnit} (100%)</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Effective Usable Working Volume:</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{usableGasDisp.toFixed(0)} {volUnit} (56%)</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Safety Refill Reserve Buffer:</span>
                                <span className="font-mono font-bold">{reserveGasDisp.toFixed(0)} {volUnit} (14%)</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Thermal Expansion Vapor Headspace:</span>
                                <span className="font-mono font-bold">{vaporHeadspaceDisp.toFixed(0)} {volUnit} (30%)</span>
                              </div>
                              <div className="flex justify-between py-1 font-bold text-foreground">
                                <span>Tank Storage Margin / Status:</span>
                                <span className={`font-mono ${isAdequate ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                                  {isAdequate ? `+${volumeSurplusDeficitDisp.toFixed(0)} ${volUnit} Surplus (Adequate)` : `-${Math.abs(volumeSurplusDeficitDisp).toFixed(0)} ${volUnit} Deficit (Undersized)`}
                                </span>
                              </div>
                            </div>

                            {/* Tank Capacity Allocation Visual Proportion Bar */}
                            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs">
                              <div className="flex justify-between items-center text-[11px] font-semibold text-muted-foreground">
                                <span>Tank Capacity Allocation:</span>
                                <span className="font-mono font-bold text-foreground">Total: {inputs.storageCapacity.toLocaleString()} {volUnit}</span>
                              </div>
                              <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                <div style={{ width: "56%" }} className="bg-primary h-full" title="56% Usable Working Gas" />
                                <div style={{ width: "14%" }} className="bg-sky-400 h-full" title="14% Safety Refill Reserve" />
                                <div style={{ width: "30%" }} className="bg-slate-300 dark:bg-slate-600 h-full" title="30% Vapor Headspace" />
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium pt-0.5">
                                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Usable (56%)</span>
                                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-400" /> Reserve (14%)</span>
                                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-400" /> Vapor Space (30%)</span>
                              </div>
                            </div>

                            {/* Storage Capacity Verification Banner */}
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
                                  {isAdequate ? "Storage Capacity Verified:" : "Storage Undersized Warning:"}
                                </strong>
                                <p className="mt-0.5 leading-relaxed text-[11.5px]">
                                  {isAdequate
                                    ? `The installed tank (${inputs.storageCapacity.toLocaleString()} ${volUnit}) provides +${volumeSurplusDeficitDisp.toFixed(0)} ${volUnit} surplus over the weekly requirement (${tankCapacityDisp.toFixed(0)} ${volUnit}). Autonomy is ${autonomyDays.toFixed(1)} days.`
                                    : `The installed tank (${inputs.storageCapacity.toLocaleString()} ${volUnit}) is insufficient for 7-day autonomy (${tankCapacityDisp.toFixed(0)} ${volUnit} required, deficit: ${Math.abs(volumeSurplusDeficitDisp).toFixed(0)} ${volUnit}). Please increase installed tank capacity.`}
                                </p>
                              </div>
                            </div>

                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => copyToClipboard(`Active Demand: ${activeDemandVolDisp.toFixed(1)} ${volUnitDay}, Autonomy: ${autonomyDays.toFixed(1)} Days`)}
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
                <GasTankReportView
                  inputs={inputs}
                  project={project}
                  calcReviewState={calcReviewState}
                  currentUserName={currentUserName}
                  onExportPdf={handleExportPdf}
                  resConsumption={resConsumption}
                  retConsumption={retConsumption}
                  totalDemandNg={totalDemandNg}
                  totalDemandLpg={totalDemandLpg}
                  activeDemandVolDisp={activeDemandVolDisp}
                  activeDemandDisp={activeDemandDisp}
                  volUnitDay={volUnitDay}
                  demandUnit={demandUnit}
                  volUnit={volUnit}
                  tankCapacityDisp={tankCapacityDisp}
                  usableGasDisp={usableGasDisp}
                  reserveGasDisp={reserveGasDisp}
                  vaporHeadspaceDisp={vaporHeadspaceDisp}
                  autonomyDays={autonomyDays}
                  isAdequate={isAdequate}
                  volumeSurplusDeficitDisp={volumeSurplusDeficitDisp}
                  isIP={isIP}
                />
              )}
            </div>
          </div>
        </div>

        {/* Intelligence Drawer (Collapsible Right Side Panel matching Ventilation & Condensate Drain) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <GasTankIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              inputs={inputs}
              handleInputChange={handleInputChange}
              setInputs={(newInputs: GasTankInputs) => {
                setInputs(newInputs);
                saveState(newInputs);
              }}
              activeDemandVolDisp={activeDemandVolDisp}
              activeDemandDisp={activeDemandDisp}
              autonomyDays={autonomyDays}
              tankCapacityDisp={tankCapacityDisp}
              usableGasDisp={usableGasDisp}
              reserveGasDisp={reserveGasDisp}
              vaporHeadspaceDisp={vaporHeadspaceDisp}
              isAdequate={isAdequate}
              volumeSurplusDeficitDisp={volumeSurplusDeficitDisp}
              volUnit={volUnit}
              volUnitDay={volUnitDay}
              demandUnit={demandUnit}
              isIP={isIP}
              isEffectiveReadOnly={isEffectiveReadOnly}
              setShowFormulaModal={setShowFormulaModal}
            />
          )}
        </div>
      </div>

      {/* Formula & Derivations Modal */}
      {showFormulaModal && (
        <GasTankFormulaModal onClose={() => setShowFormulaModal(false)} />
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

// Live Intelligence Drawer Component
function GasTankIntelligenceDrawer({
  onClose,
  inputs,
  handleInputChange,
  setInputs,
  activeDemandVolDisp,
  activeDemandDisp,
  autonomyDays,
  tankCapacityDisp,
  usableGasDisp,
  reserveGasDisp,
  vaporHeadspaceDisp,
  isAdequate,
  volumeSurplusDeficitDisp,
  volUnit,
  volUnitDay,
  demandUnit,
  isIP,
  isEffectiveReadOnly,
  setShowFormulaModal,
}: {
  onClose: () => void;
  inputs: GasTankInputs;
  handleInputChange: (field: keyof GasTankInputs, val: any) => void;
  setInputs: (inputs: GasTankInputs) => void;
  activeDemandVolDisp: number;
  activeDemandDisp: number;
  autonomyDays: number;
  tankCapacityDisp: number;
  usableGasDisp: number;
  reserveGasDisp: number;
  vaporHeadspaceDisp: number;
  isAdequate: boolean;
  volumeSurplusDeficitDisp: number;
  volUnit: string;
  volUnitDay: string;
  demandUnit: string;
  isIP: boolean;
  isEffectiveReadOnly: boolean;
  setShowFormulaModal: (val: boolean) => void;
}) {
  const applyPreset = (preset: {
    gasType: "ng" | "lpg";
    resKitchens: number;
    retKitchens: number;
    resDemandConst: number;
    retDemandConst: number;
    storageCapacity: number;
  }) => {
    if (isEffectiveReadOnly) return;
    const nextInputs: GasTankInputs = {
      ...inputs,
      gasType: preset.gasType,
      resKitchens: preset.resKitchens,
      retKitchens: preset.retKitchens,
      resDemandConst: preset.resDemandConst,
      retDemandConst: preset.retDemandConst,
      storageCapacity: isIP ? Math.round(preset.storageCapacity * 0.264172) : preset.storageCapacity,
    };
    setInputs(nextInputs);
    toast.success("Applied preset archetype configuration");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4.5 text-primary" />
          <div>
            <h3 className="font-bold text-[13.5px] uppercase tracking-wider text-foreground">Live Intelligence</h3>
            <p className="text-[10.5px] text-muted-foreground font-medium">NFPA 54 / 58 &amp; BS 5482 Storage Audit Engine</p>
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
        
        {/* 1. Storage Autonomy & Code Audit Card */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
              <Activity className="size-4 text-primary" />
              <span>Weekly Autonomy Audit</span>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isAdequate ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}>
              {isAdequate ? "COMPLIANT" : "UNDERSIZED"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-border/60 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Target Autonomy:</span>
              <span className="font-bold text-foreground font-mono">≥ 7.0 Days</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Current Autonomy:</span>
              <span className={`font-bold font-mono ${autonomyDays >= 7 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {autonomyDays.toFixed(1)} Days
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Installed Storage:</span>
              <span className="font-bold text-foreground font-mono">{inputs.storageCapacity.toLocaleString()} {volUnit}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Surplus / Deficit:</span>
              <span className={`font-bold font-mono ${volumeSurplusDeficitDisp >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {volumeSurplusDeficitDisp >= 0 ? `+${volumeSurplusDeficitDisp.toFixed(0)}` : `${volumeSurplusDeficitDisp.toFixed(0)}`} {volUnit}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Fuel Comparison & Density Insights */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
            <Zap className="size-4 text-amber-500" />
            <span>Fuel Energy Equivalence</span>
          </span>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            LPG has <strong>2.67× higher volumetric energy density</strong> than pipeline Natural Gas. Switching to LPG reduces required tank volume by ~62.5%.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-center">
              <span className="text-[10px] text-muted-foreground block">NG Equiv Demand</span>
              <strong className="text-primary font-mono text-xs">{inputs.gasType === "ng" ? activeDemandVolDisp.toFixed(0) : (activeDemandVolDisp * 2.67).toFixed(0)} {volUnitDay}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-center">
              <span className="text-[10px] text-muted-foreground block">LPG Equiv Demand</span>
              <strong className="text-amber-600 dark:text-amber-400 font-mono text-xs">{inputs.gasType === "lpg" ? activeDemandVolDisp.toFixed(0) : (activeDemandVolDisp / 2.67).toFixed(0)} {volUnitDay}</strong>
            </div>
          </div>
        </div>

        {/* 3. Project Archetype Presets */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
            <Building2 className="size-4 text-primary" />
            <span>Quick Project Archetypes</span>
          </span>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={isEffectiveReadOnly}
              onClick={() => applyPreset({
                gasType: "ng",
                resKitchens: 120,
                retKitchens: 0,
                resDemandConst: 0.19,
                retDemandConst: 52,
                storageCapacity: 10000,
              })}
              className="p-2.5 rounded-xl border border-border/80 bg-slate-50/70 dark:bg-slate-900/40 hover:border-primary/60 text-left transition flex items-center justify-between group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Home className="size-4 text-primary shrink-0" />
                <div>
                  <strong className="text-xs text-foreground block">Residential Tower</strong>
                  <span className="text-[10.5px] text-muted-foreground">120 Apts · 10,000 L Tank</span>
                </div>
              </div>
              <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-primary transition" />
            </button>

            <button
              type="button"
              disabled={isEffectiveReadOnly}
              onClick={() => applyPreset({
                gasType: "ng",
                resKitchens: 50,
                retKitchens: 8,
                resDemandConst: 0.19,
                retDemandConst: 52,
                storageCapacity: 50000,
              })}
              className="p-2.5 rounded-xl border border-border/80 bg-slate-50/70 dark:bg-slate-900/40 hover:border-primary/60 text-left transition flex items-center justify-between group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-primary shrink-0" />
                <div>
                  <strong className="text-xs text-foreground block">Mixed-Use Complex</strong>
                  <span className="text-[10.5px] text-muted-foreground">50 Res + 8 F&amp;B Kitchens · 50k L</span>
                </div>
              </div>
              <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-primary transition" />
            </button>

            <button
              type="button"
              disabled={isEffectiveReadOnly}
              onClick={() => applyPreset({
                gasType: "lpg",
                resKitchens: 0,
                retKitchens: 15,
                resDemandConst: 0.19,
                retDemandConst: 52,
                storageCapacity: 35000,
              })}
              className="p-2.5 rounded-xl border border-border/80 bg-slate-50/70 dark:bg-slate-900/40 hover:border-primary/60 text-left transition flex items-center justify-between group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Utensils className="size-4 text-amber-500 shrink-0" />
                <div>
                  <strong className="text-xs text-foreground block">Commercial Food Court (LPG)</strong>
                  <span className="text-[10.5px] text-muted-foreground">15 F&amp;B Hubs · 35k L LPG Tank</span>
                </div>
              </div>
              <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-primary transition" />
            </button>
          </div>
        </div>

        {/* 4. Formulas & Standard Reference */}
        <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-foreground block">Engineering Formulations</span>
            <span className="text-[10.5px] text-muted-foreground">NFPA 58 volume allocation derivations</span>
          </div>
          <button
            type="button"
            onClick={() => setShowFormulaModal(true)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
          >
            View Formulas
          </button>
        </div>

      </div>
    </div>
  );
}

// Preliminary-Format Report View Component
function GasTankReportView({
  inputs,
  project,
  calcReviewState,
  currentUserName,
  onExportPdf,
  resConsumption,
  retConsumption,
  totalDemandNg,
  totalDemandLpg,
  activeDemandVolDisp,
  activeDemandDisp,
  volUnitDay,
  demandUnit,
  volUnit,
  tankCapacityDisp,
  usableGasDisp,
  reserveGasDisp,
  vaporHeadspaceDisp,
  autonomyDays,
  isAdequate,
  volumeSurplusDeficitDisp,
  isIP,
}: any) {
  const calcNo = (project as any)?.calcNo || `TRV-CAL-GST-${(project?.id || "0000").slice(-4).toUpperCase()}`;
  const today = formatDateStr(new Date().toISOString());
  const projectNo = project?.code || (project as any)?.projectNo || "P000";
  const projectName = project?.name || (project as any)?.projectName || "Gas Distribution & Storage Project";
  const clientName = project?.client || "-";
  const endUser = (project as any)?.endUser || (project as any)?.location || "-";

  const sigDetails = getSignatureBlockDetails(calcReviewState, currentUserName);

  const resUnits = Number(inputs?.resKitchens) || 0;
  const resConst = Number(inputs?.resDemandConst) || 0;
  const retUnits = Number(inputs?.retKitchens) || 0;
  const retConst = Number(inputs?.retDemandConst) || 0;
  const storageCap = Number(inputs?.storageCapacity) || 0;

  const resDailyVol = (resConsumption || 0) * 1000 * (isIP ? 0.264172 : 1);
  const retDailyVol = (retConsumption || 0) * 1000 * (isIP ? 0.264172 : 1);

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
                Gas Storage Tank Capacity Sizing Report
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Design Standards: NFPA 54 / NFPA 58 / BS 5482 Autonomy Storage &amp; Daily Kitchen Gas Consumption
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

          {/* Table 1: Kitchen Consumption Breakdown & Volumetric Fuel Demand */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              1. Kitchen Consumption &amp; Daily Fuel Demand Breakdown
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                      <th className="py-2 px-2.5 w-10">Sr.</th>
                      <th className="py-2 px-3 text-left">Description / Consumer Category</th>
                      <th className="py-2 px-3 text-center w-28">Quantity</th>
                      <th className="py-2 px-3 text-center w-36">Constant Basis</th>
                      <th className="py-2 px-3 text-right w-36">Volumetric Demand</th>
                      <th className="py-2 px-3 text-right w-32">Daily Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">1</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Residential Kitchens</td>
                      <td className="py-2 px-3 text-center font-mono">{resUnits} units</td>
                      <td className="py-2 px-3 text-center font-mono">{resConst} {demandUnit}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{(resConsumption || 0).toFixed(2)} m³/day</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{resDailyVol.toFixed(0)} {volUnitDay}</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">2</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Retail Food &amp; Beverage (F&amp;B)</td>
                      <td className="py-2 px-3 text-center font-mono">{retUnits} kitchens</td>
                      <td className="py-2 px-3 text-center font-mono">{retConst} {demandUnit}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{(retConsumption || 0).toFixed(2)} m³/day</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{retDailyVol.toFixed(0)} {volUnitDay}</td>
                    </tr>
                    {/* Key Highlighted Summary Rows */}
                    <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold text-foreground">
                      <td className="py-2 px-2.5 text-center font-mono">3</td>
                      <td className="py-2 px-3 text-primary">TOTAL NATURAL GAS DEMAND (NG)</td>
                      <td className="py-2 px-3 text-center font-mono">{resUnits + retUnits} Units</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">Cumulative</td>
                      <td className="py-2 px-3 text-right font-mono text-primary">{((resConsumption || 0) + (retConsumption || 0)).toFixed(2)} m³/day</td>
                      <td className="py-2 px-3 text-right font-mono text-primary font-bold">{(totalDemandNg || 0).toFixed(1)} L/day</td>
                    </tr>
                    <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold text-foreground">
                      <td className="py-2 px-2.5 text-center font-mono">4</td>
                      <td className="py-2 px-3 text-foreground">TOTAL LPG GAS DEMAND (EQUIVALENT)</td>
                      <td className="py-2 px-3 text-center font-mono">{resUnits + retUnits} Units</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">NG Demand / 2.67</td>
                      <td className="py-2 px-3 text-right font-mono">{((totalDemandLpg || 0) / 1000).toFixed(2)} m³/day</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{(totalDemandLpg || 0).toFixed(1)} L/day</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Table 2: Storage Vessel Capacity Allocation & Sizing */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              2. Storage Tank Capacity Allocation &amp; Autonomy Sizing
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                      <th className="py-2 px-2.5 w-10">Sr.</th>
                      <th className="py-2 px-3 text-left">Parameter / Sizing Metric</th>
                      <th className="py-2 px-3 text-center w-40">Calculated Value</th>
                      <th className="py-2 px-3 text-center w-36">Design Allocation</th>
                      <th className="py-2 px-3 text-left">Engineering Design Notes / Standard Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">1</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Selected Fuel System Basis</td>
                      <td className="py-2 px-3 text-center font-bold text-primary font-mono">
                        {inputs?.gasType === "ng" ? "Natural Gas (NG)" : "LPG Gas (Propane / Butane)"}
                      </td>
                      <td className="py-2 px-3 text-center text-muted-foreground font-mono">-</td>
                      <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Selected fuel supply configuration</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">2</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Active Daily Fuel Demand</td>
                      <td className="py-2 px-3 text-center font-bold font-mono">{(activeDemandVolDisp || 0).toFixed(1)} {volUnitDay}</td>
                      <td className="py-2 px-3 text-center font-mono">{(activeDemandDisp || 0).toFixed(2)} {demandUnit}</td>
                      <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Total active peak consumption per day</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">3</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Design Autonomy Period Target</td>
                      <td className="py-2 px-3 text-center font-bold font-mono">7.0 Days</td>
                      <td className="py-2 px-3 text-center text-muted-foreground font-mono">-</td>
                      <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Standard weekly replenishment schedule</td>
                    </tr>
                    <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold text-foreground">
                      <td className="py-2 px-2.5 text-center font-mono">4</td>
                      <td className="py-2 px-3">MINIMUM RECOMMENDED TANK (7-DAY)</td>
                      <td className="py-2 px-3 text-center font-mono text-primary font-bold text-[12px]">{(tankCapacityDisp || 0).toFixed(0)} {volUnit}</td>
                      <td className="py-2 px-3 text-center font-semibold text-primary font-mono">70% Max Fill Limit</td>
                      <td className="py-2 px-3 text-[10.5px]">Weekly volume divided by 0.70 liquid fill safety limit</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">5</td>
                      <td className="py-2 px-3 font-bold text-foreground">Installed Physical Tank Capacity</td>
                      <td className="py-2 px-3 text-center font-bold text-primary font-mono text-[12px]">{storageCap.toLocaleString()} {volUnit}</td>
                      <td className="py-2 px-3 text-center font-bold font-mono">100% Gross Vessel</td>
                      <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Installed gross nominal vessel capacity</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">6</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Effective Usable Working Volume</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 font-mono">{(usableGasDisp || 0).toFixed(0)} {volUnit}</td>
                      <td className="py-2 px-3 text-center font-mono">56% Net Working</td>
                      <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Working inventory between 70% fill and 20% refill reserve</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">7</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Safety Refill Reorder Reserve</td>
                      <td className="py-2 px-3 text-center font-bold font-mono">{(reserveGasDisp || 0).toFixed(0)} {volUnit}</td>
                      <td className="py-2 px-3 text-center font-mono">14% Buffer Reserve</td>
                      <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Safety margin to trigger supplier reorder</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">8</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Thermal Expansion Vapor Headspace</td>
                      <td className="py-2 px-3 text-center font-bold font-mono">{(vaporHeadspaceDisp || 0).toFixed(0)} {volUnit}</td>
                      <td className="py-2 px-3 text-center font-mono">30% Vapor Headroom</td>
                      <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Liquid thermal expansion safety margin (NFPA 58 / BS 5482)</td>
                    </tr>
                    <tr className={`font-bold ${isAdequate ? "bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200" : "bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"}`}>
                      <td className="py-2 px-2.5 text-center font-mono">9</td>
                      <td className="py-2 px-3">ACHIEVED AUTONOMY DURATION</td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-[12.5px]">{(autonomyDays || 0).toFixed(1)} Days</td>
                      <td className="py-2 px-3 text-center font-bold">{isAdequate ? "Meets Criteria (≥ 7 Days)" : "Deficit (< 7 Days)"}</td>
                      <td className="py-2 px-3 text-[10.5px]">{isAdequate ? "Adequate storage for continuous weekly replenishment" : "Vessel undersized for 7-day autonomy requirement"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 3: Engineering Compliance Verification Banner */}
          <div
            className={`p-4 rounded-xl border flex items-center gap-3.5 text-xs ${
              isAdequate
                ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200"
                : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200"
            }`}
          >
            {isAdequate ? (
              <CheckCircle2 className="size-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="size-6 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div>
              <strong className="text-[13px] block">
                {isAdequate ? "STORAGE CAPACITY VERIFICATION: PASSED (ADEQUATE)" : "STORAGE CAPACITY VERIFICATION: WARNING (UNDERSIZED)"}
              </strong>
              <p className="mt-1 leading-relaxed">
                {isAdequate
                  ? `The installed tank volume of ${storageCap.toLocaleString()} ${volUnit} provides a surplus of +${(volumeSurplusDeficitDisp || 0).toFixed(0)} ${volUnit} over the 7-day requirement (${(tankCapacityDisp || 0).toFixed(0)} ${volUnit}), achieving ${(autonomyDays || 0).toFixed(1)} days of continuous autonomy.`
                  : `The installed tank volume of ${storageCap.toLocaleString()} ${volUnit} is insufficient for 7-day autonomy (required: ${(tankCapacityDisp || 0).toFixed(0)} ${volUnit}, deficit: ${Math.abs(volumeSurplusDeficitDisp || 0).toFixed(0)} ${volUnit}). Please increase installed tank capacity.`}
              </p>
            </div>
          </div>

          {/* Section 4: 4-Column Dynamic Signature Block (Preliminary Format) */}
          <div className="border border-border rounded-xl overflow-hidden mt-6">
            <table className="w-full text-center text-[11px] border-collapse">
              <thead>
                <tr className="bg-[#FFE6CC] text-black font-bold border-b border-border">
                  <th className="py-2 px-3 text-left w-1/4">Designation</th>
                  <th className="py-2 px-3 w-1/4">Originator</th>
                  <th className="py-2 px-3 w-1/4">Reviewer</th>
                  <th className="py-2 px-3 w-1/4">Approver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-sans">
                <tr>
                  <td className="py-2 px-3 text-left font-bold text-foreground">Name:</td>
                  <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.name || sigDetails?.originatedName || currentUserName || "-"}</td>
                  <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.name || sigDetails?.reviewerName || "-"}</td>
                  <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.name || sigDetails?.approverName || "-"}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-left font-bold text-foreground">Date:</td>
                  <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.date || sigDetails?.originatedDate || today}</td>
                  <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.date || sigDetails?.reviewerDate || "-"}</td>
                  <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.date || sigDetails?.approverDate || "-"}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-left font-bold text-foreground">Signature:</td>
                  <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.status || (sigDetails?.originatedName ? "Signed" : "Originator")}</td>
                  <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.status || (sigDetails?.reviewerName ? "Reviewed" : "Pending")}</td>
                  <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.status || (sigDetails?.approverName ? "Approved" : "Pending")}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}

// Mathematical Formula Breakdown Modal
function GasTankFormulaModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-2">
            <Flame className="size-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">Gas Storage Tank Sizing Equations</h3>
              <p className="text-xs text-muted-foreground">Standards &amp; equations applied in commercial kitchen demand &amp; bulk vessel sizing</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-xs text-foreground">
          
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">1. Kitchen Volumetric Demand</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              Q_res = N_res × q_res &nbsp;&nbsp;|&nbsp;&nbsp; Q_ret = N_ret × q_ret &nbsp;(m³/day)
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Where N is the count of kitchen units and q is the average daily demand constant (0.19 m³/day residential, 52 m³/day retail F&amp;B).
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">2. Fuel Energy Equivalence (Natural Gas vs LPG)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              Q_NG = (Q_res + Q_ret) × 1,000 (L/day) &nbsp;&nbsp;|&nbsp;&nbsp; Q_LPG = Q_NG / 2.67 (L/day)
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              LPG (Propane / Butane blend) possesses approximately 2.67 times higher volumetric energy density than pipeline Natural Gas.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">3. 7-Day Autonomy Storage Tank Requirement</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              V_tank = (Q_daily × 7) / 0.70 &nbsp;(Litres)
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Per NFPA 58 and BS 5482 codes, bulk gas vessels maintain a maximum safe liquid fill limit of 70% to accommodate liquid thermal expansion.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">4. Effective Usable Volume &amp; Refill Reserve</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              V_usable = V_installed × 56% &nbsp;|&nbsp; V_reserve = V_installed × 14% &nbsp;|&nbsp; V_vapor = V_installed × 30%
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Usable operational gas is 56% (70% fill × 80% working inventory), with a 14% safety reorder buffer and 30% expansion vapor headspace.
            </p>
          </div>
          
        </div>
      </div>
    </div>
  );
}
