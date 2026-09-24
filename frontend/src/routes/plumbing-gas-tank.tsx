import React, { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalculationReviewBar, useCalculationLock } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr, addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Flame, Info, Download, MessageSquare, Check, ShieldCheck,
  AlertTriangle, Copy, RotateCcw, CheckCircle2, X, Gauge, Cylinder,
  TrendingUp, Layers, HelpCircle
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
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const { project, forceSaveToCloud } = useWorkspace();

  const [inputs, setInputs] = useState<GasTankInputs>(DEFAULT_INPUTS);
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [activeCommentTarget, setActiveCommentTarget] = useState<{ id: string; label: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const { isLocked: isReviewLocked } = useCalculationLock("/plumbing-gas-tank");
  const isEffectiveReadOnly = isReviewLocked;

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

  // Load project state
  useEffect(() => {
    const pId = project?.id || "default";
    try {
      const saved = localStorage.getItem(`gasTank_${pId}`);
      if (saved) {
        const p = JSON.parse(saved);
        setInputs({
          gasType: p.gasType || "ng",
          unitSystem: p.unitSystem || "SI",
          resDemandConst: p.resDemandConst ?? 0.19,
          resKitchens: p.resKitchens ?? 0,
          retDemandConst: p.retDemandConst ?? 52,
          retKitchens: p.retKitchens ?? 0,
          storageCapacity: p.storageCapacity ?? 30000,
        });
      }
      const savedComments = localStorage.getItem(`gasTankComments_${pId}`);
      if (savedComments) {
        setCommentsMap(JSON.parse(savedComments));
      }
    } catch (e) {
      console.error("Failed to parse saved Gas Tank data:", e);
    }
    setIsLoaded(true);
  }, [project?.id]);

  // Persist state on change
  const saveState = (updatedInputs: GasTankInputs, updatedComments?: Record<string, any[]>) => {
    const pId = project?.id || "default";
    try {
      localStorage.setItem(`gasTank_${pId}`, JSON.stringify(updatedInputs));
      if (updatedComments) {
        localStorage.setItem(`gasTankComments_${pId}`, JSON.stringify(updatedComments));
      }
      dirtyStore.set(true);
    } catch (e) {
      console.error("Failed to save state", e);
    }
  };

  const handleInputChange = (field: keyof GasTankInputs, value: any) => {
    if (isEffectiveReadOnly) return;
    const next = { ...inputs, [field]: value };
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

  const handleSaveCalculation = () => {
    const pId = project?.id || "default";
    saveState(inputs, commentsMap);
    dirtyStore.set(false);
    if (forceSaveToCloud) forceSaveToCloud();
    toast.success("Gas Tank calculation saved successfully");
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
  // IP conversions: 1 m³ = 35.3147 ft³; 1 Litre = 0.264172 US Gal
  const M3_TO_FT3 = 35.3147;
  const L_TO_GAL = 0.264172;
  const demandUnit = isIP ? "ft³/day" : "m³/day";
  const volUnit = isIP ? "US Gal" : "Litres";

  // Calculations — always work in SI (m³/day, Litres) internally, convert for display
  // Input demand constants stored as m³/day (SI). In IP mode the user enters ft³/day, stored converted back.
  // For simplicity: store values in SI always; when IP is chosen, display converts to IP units.
  const resConsumption = inputs.resKitchens * inputs.resDemandConst; // m³/day
  const retConsumption = inputs.retKitchens * inputs.retDemandConst; // m³/day

  const totalDemandNg = (resConsumption + retConsumption) * 1000; // L/day
  const totalDemandLpg = totalDemandNg / 2.67; // L/day (LPG energy ratio ~2.67x)

  const activeDemand = inputs.gasType === "ng" ? totalDemandNg : totalDemandLpg; // L/day
  const activeDemandM3 = activeDemand / 1000; // m³/day

  // IP display equivalents
  const resConsumptionDisp = isIP ? resConsumption * M3_TO_FT3 : resConsumption;
  const retConsumptionDisp = isIP ? retConsumption * M3_TO_FT3 : retConsumption;
  const activeDemandDisp = isIP ? activeDemandM3 * M3_TO_FT3 : activeDemandM3; // ft³/day or m³/day
  const activeDemandVolDisp = isIP ? activeDemand * L_TO_GAL : activeDemand; // gal/day or L/day
  const volUnitDay = isIP ? "gal/day" : "L/day";

  // Weekly autonomy storage requirement based on 70% maximum safe fill limit
  const tankCapacity = activeDemand > 0 ? (activeDemand * 7) / 0.7 : 0; // Litres recommended for 7 days
  const tankCapacityDisp = isIP ? tankCapacity * L_TO_GAL : tankCapacity;

  // Usable volume from installed physical tank: 70% fill limit, 20% refill reserve -> 56% operational gas
  const storageCapacityL = isIP ? inputs.storageCapacity / L_TO_GAL : inputs.storageCapacity; // always Litres internally
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

  // PDF Export Function (Ventilation Report Format)
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

      // Header Title (Ventilation Format)
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Gas Storage Tank Capacity Sizing Report", 14, 14);

      // Metadata Block for Portrait Mode (182mm width: left 14mm to right 196mm)
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      doc.rect(14, 18, 182, 18); // Outer box for metadata

      // Vertical line to separate left/right metadata
      doc.line(105, 18, 105, 36);

      // Horizontal lines
      doc.line(14, 24, 196, 24);
      doc.line(14, 30, 196, 30);

      // Left Column
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

      // Right Column
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

      // Standard Ventilation Palette
      const primaryFill = [217, 217, 217] as [number, number, number]; // Gray #D9D9D9 for standard headers
      const blueFill = [218, 233, 248] as [number, number, number];    // Blue #DAE9F8 for highlights

      // Section 1: Kitchen Consumption & Demand Load Breakdown
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

      demandBody[2]._isTotal = true;
      demandBody[3]._isTotal = true;

      callAutoTable(doc, {
        startY: 47,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 8,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          fontSize: 8.5,
        },
        columnStyles: {
          0: { halign: "left", cellWidth: 52, fontStyle: "bold" },
          1: { cellWidth: 28 },
          2: { cellWidth: 34 },
          3: { cellWidth: 34 },
          4: { cellWidth: 34 },
        },
        head: [["Consumption Source", "Count", "Demand Constant", "Daily Volume (m³)", "Daily Volume (L)"]],
        body: demandBody,
        didParseCell: function (data: any) {
          if (data.section === "body") {
            const rawRow = data.row.raw;
            if (rawRow && rawRow._isTotal) {
              data.cell.styles.fontStyle = "bold";
              if (data.column.index === 3 || data.column.index === 4) {
                data.cell.styles.fillColor = [242, 248, 253];
              }
            }
          }
        },
      });

      let nextY = (doc as any).lastAutoTable?.finalY ?? 95;
      nextY += 8;

      // Section 2: Storage Tank Sizing & Autonomy Analysis
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("2. Storage Tank Sizing & Autonomy Analysis", 14, nextY);
      nextY += 4;

      const resultsBody = [
        ["A", "Selected Fuel Type", inputs.gasType === "ng" ? "Natural Gas (NG)" : "Liquefied Petroleum Gas (LPG)", "Primary Fuel Selection Basis"],
        ["B", "Active Daily Gas Demand", `${activeDemand.toFixed(1)} L/day (${activeDemandM3.toFixed(2)} m³/day)`, `Based on chosen ${inputs.gasType === "ng" ? "Natural Gas" : "LPG"} fuel`],
        ["C", "Recommended Tank Capacity (7-Day)", `${tankCapacity.toFixed(0)} Litres`, "7-day autonomy requirement based on 70% maximum fill level"],
        ["D", "Physical Installed Tank Capacity", `${inputs.storageCapacity.toLocaleString()} Litres`, "Physical nominal storage tank volume"],
        ["E", "Effective Usable Gas Volume", `${usableGas.toFixed(0)} Litres`, "70% fill limit × 80% working gas volume (56% net)"],
        ["F", "Safety Refill Reserve Volume", `${reserveGas.toFixed(0)} Litres`, "20% threshold volume reserved before emergency replenishment (14% net)"],
        ["G", "Vapor Expansion Headspace", `${vaporHeadspace.toFixed(0)} Litres`, "30% vapor expansion headspace per NFPA 58 / BS safety code"],
        ["H", "Operational Autonomy Duration", `${autonomyDays.toFixed(1)} days`, autonomyDays >= 7 ? "Compliant (≥ 7 days autonomy)" : "Less than 7 days autonomy"],
        ["I", "Storage Adequacy Status", `${volumeSurplusDeficit >= 0 ? "+" : ""}${volumeSurplusDeficit.toFixed(0)} Litres`, isAdequate ? "Adequate Storage Capacity" : "Undersized — Upgrade Recommended"],
      ];

      callAutoTable(doc, {
        startY: nextY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 8,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          fontSize: 8.5,
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 62, fontStyle: "bold" },
          2: { cellWidth: 42, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 68 },
        },
        head: [["#", "Storage & Sizing Parameter", "Calculated Value", "Engineering Design Basis"]],
        body: resultsBody,
        didParseCell: function (data: any) {
          if (data.section === "body") {
            // Highlight Recommended Tank Capacity and Operational Autonomy in soft blue fill
            if (data.row.index === 2 || data.row.index === 7) {
              if (data.column.index === 2) {
                data.cell.styles.fillColor = blueFill;
              }
            }
          }
        },
      });

      nextY = (doc as any).lastAutoTable?.finalY ?? 180;
      nextY += 8;

      // Section 3: Engineering Sign-off Block (exact Ventilation 3-Tier sign-off block)
      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate,
      } = getSignatureBlockDetails(project?.id || "default", "/plumbing-gas-tank", currentUserName || "");

      callAutoTable(doc, {
        startY: nextY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 8,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
        },
        headStyles: {
          fillColor: [255, 230, 204], // Apricot / warm peach header
          textColor: 0,
          fontStyle: "bold",
        },
        head: [
          [
            { content: "" },
            { content: "Originator" },
            { content: "Reviewer" },
            { content: "Approver" },
          ],
        ],
        body: [
          [
            { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedName, styles: { halign: "center" } },
            { content: reviewerName, styles: { halign: "center" } },
            { content: approverName, styles: { halign: "center" } },
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate, styles: { halign: "center" } },
            { content: reviewerDate, styles: { halign: "center" } },
            { content: approverDate, styles: { halign: "center" } },
          ],
        ],
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

  // Helper renderer for input boxes with context menu
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
                ? "ring-2 ring-[#0A7BC7] bg-blue-50/40 dark:bg-blue-950/30 border-[#0A7BC7]"
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
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0A7BC7] hover:underline"
                    title={`${comments.length} comment(s)`}
                  >
                    <MessageSquare className="size-3 fill-[#0A7BC7]/20" />
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
                className="w-full bg-background border border-border/90 rounded-lg px-3 py-1.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-[#0A7BC7]/40 focus:border-[#0A7BC7] outline-none transition disabled:opacity-60"
              />
              <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap min-w-[50px]">
                {unit}
              </span>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-48 text-xs">
          <ContextMenuItem
            onClick={() => setActiveCommentTarget({ id: fieldId, label })}
            className="flex items-center gap-2 cursor-pointer font-medium"
          >
            <MessageSquare className="size-3.5 text-[#0A7BC7]" />
            <span>Add / View Comment</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => copyToClipboard(value)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
          </ContextMenuItem>
          {!isEffectiveReadOnly && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => handleInputChange(fieldId, defaultVal)}
                className="flex items-center gap-2 cursor-pointer text-muted-foreground"
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
      <div className="flex flex-col flex-1 min-h-0 h-[calc(100vh-68px)] overflow-hidden bg-background text-foreground">
        <div className="flex-1 min-h-0 p-4 md:p-5 max-w-7xl mx-auto w-full flex flex-col gap-4 overflow-hidden">
          
          {/* Top Title & Action Bar (Stationary, Fixed at Top) */}
          <div className="flex flex-col gap-2 border-b border-border/80 pb-3 shrink-0">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center justify-between gap-3 mt-0.5 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Flame className="size-6 text-[#0A7BC7]" />
                    <h1 className="text-[28px] font-bold tracking-tight text-foreground">Gas Storage Capacity</h1>
                  </div>

                  <CalculationReviewBar
                    projectId={project?.id || "default"}
                    calculatorPath="/plumbing-gas-tank"
                    calculatorTitle="Gas Storage Capacity"
                  />

                  {totalCommentsCount > 0 && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/70 text-[#0A7BC7] text-xs font-bold border border-blue-200 dark:border-blue-900/60 shadow-2xs"
                      title={`${totalCommentsCount} active comment(s)/task(s)`}
                    >
                      <MessageSquare className="size-3.5 fill-[#0A7BC7]/20" />
                      <span>{totalCommentsCount} Active Task{totalCommentsCount === 1 ? "" : "s"}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFormulaModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-card hover:bg-muted/70 transition cursor-pointer text-foreground shadow-2xs"
                    title="Detailed Formulas & Derivations"
                  >
                    <Info className="size-3.5 text-[#0A7BC7]" />
                    <span>Formulas & Derivations</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-full bg-[#0A7BC7] text-white hover:bg-[#0866A5] transition shadow-xs cursor-pointer"
                    title="Export PDF Report"
                  >
                    <Download className="size-3.5" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Layout Grid: Inputs (Left, Scrollable) & Results Summary (Right, Constant) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start flex-1 min-h-0 overflow-hidden">
            
            {/* Left Column: Inputs (Independently Scrollable) */}
            <div className="lg:col-span-7 flex flex-col gap-4 h-full overflow-y-auto pr-2 pb-8">
              
              {/* Card 1: Fuel Selection & Unit System */}
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                      1. FUEL SYSTEM SELECTION
                    </h3>
                  </div>
                  <Flame className="size-4 text-[#0A7BC7]" />
                </div>

                {/* Gas Type Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isEffectiveReadOnly}
                    onClick={() => handleGasType("ng")}
                    className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                      inputs.gasType === "ng"
                        ? "bg-blue-50 dark:bg-blue-950/40 border-[#0A7BC7] text-[#0A7BC7] ring-1 ring-[#0A7BC7]"
                        : "bg-slate-50/70 dark:bg-slate-900/50 border-border text-muted-foreground hover:border-[#0A7BC7]/50"
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
                        ? "bg-blue-50 dark:bg-blue-950/40 border-[#0A7BC7] text-[#0A7BC7] ring-1 ring-[#0A7BC7]"
                        : "bg-slate-50/70 dark:bg-slate-900/50 border-border text-muted-foreground hover:border-[#0A7BC7]/50"
                    }`}
                  >
                    <span className="text-sm">LPG Gas (Propane / Butane)</span>
                    <span className="text-[10px] font-normal text-muted-foreground">2.67× Energy Ratio</span>
                  </button>
                </div>

                {/* IP / SI Unit System Toggle */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-muted-foreground">Unit System</span>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full p-0.5 border border-border/60">
                    <button
                      type="button"
                      disabled={isEffectiveReadOnly}
                      onClick={() => handleUnitSystem("SI")}
                      className={`px-4 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                        inputs.unitSystem === "SI"
                          ? "bg-[#0A7BC7] text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      SI
                    </button>
                    <button
                      type="button"
                      disabled={isEffectiveReadOnly}
                      onClick={() => handleUnitSystem("IP")}
                      className={`px-4 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                        inputs.unitSystem === "IP"
                          ? "bg-[#0A7BC7] text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      IP
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground -mt-2">
                  {isIP
                    ? "Imperial: demand in ft³/day · storage in US Gallons"
                    : "SI: demand in m³/day · storage in Litres"}
                </p>
              </div>

              {/* Card 2: Units & Consumption Constants */}
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                      2. UNITS & CONSUMPTION CONSTANTS
                    </h3>
                  </div>
                  <Layers className="size-4 text-[#0A7BC7]" />
                </div>

                <div className="flex flex-col gap-3">
                  {/* Residential row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderInputBox(
                      "resKitchens",
                      "Residential Units",
                      inputs.resKitchens,
                      "Units",
                      "1",
                      0,
                      DEFAULT_INPUTS.resKitchens
                    )}

                    {/* Residential Demand Constant — styled as a constant but still editable */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id="field-resDemandConst"
                          className={`p-3 rounded-xl border transition-all relative ${
                            highlightedTargetId === "resDemandConst"
                              ? "ring-2 ring-[#0A7BC7] bg-blue-50/40 dark:bg-blue-950/30 border-[#0A7BC7]"
                              : "bg-slate-100/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
                              Residential Demand Constant
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Constant
                              </span>
                            </label>
                            {(commentsMap["resDemandConst"] || []).length > 0 && (
                              <button
                                type="button"
                                onClick={() => setActiveCommentTarget({ id: "resDemandConst", label: "Residential Demand Constant" })}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0A7BC7] hover:underline"
                              >
                                <MessageSquare className="size-3 fill-[#0A7BC7]/20" />
                                <span>{(commentsMap["resDemandConst"] || []).length}</span>
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={isEffectiveReadOnly}
                              value={inputs.resDemandConst}
                              onChange={(e) => handleInputChange("resDemandConst", parseFloat(e.target.value) || 0)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-[#0A7BC7]/40 focus:border-[#0A7BC7] outline-none transition disabled:opacity-60"
                            />
                            <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap min-w-[50px]">
                              {demandUnit}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">Default: 0.19 m³/unit/day</p>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48 text-xs">
                        <ContextMenuItem
                          onClick={() => setActiveCommentTarget({ id: "resDemandConst", label: "Residential Demand Constant" })}
                          className="flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <MessageSquare className="size-3.5 text-[#0A7BC7]" />
                          <span>Add / View Comment</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => copyToClipboard(inputs.resDemandConst)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span>Copy Value</span>
                        </ContextMenuItem>
                        {!isEffectiveReadOnly && (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onClick={() => handleInputChange("resDemandConst", 0.19)}
                              className="flex items-center gap-2 cursor-pointer text-muted-foreground"
                            >
                              <RotateCcw className="size-3.5" />
                              <span>Reset Default (0.19)</span>
                            </ContextMenuItem>
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-100/60 dark:bg-slate-900/40 border border-border/60 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Residential Subtotal:</span>
                    <span className="font-mono font-bold text-foreground">
                      {resConsumptionDisp.toFixed(2)} {demandUnit} ({(resConsumption * 1000 * (isIP ? L_TO_GAL : 1)).toFixed(0)} {volUnitDay})
                    </span>
                  </div>

                  {/* Retail row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
                      "Retail Demand Constant",
                      inputs.retDemandConst,
                      demandUnit,
                      "1",
                      0,
                      DEFAULT_INPUTS.retDemandConst
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-100/60 dark:bg-slate-900/40 border border-border/60 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Retail Subtotal:</span>
                    <span className="font-mono font-bold text-foreground">
                      {retConsumptionDisp.toFixed(2)} {demandUnit} ({(retConsumption * 1000 * (isIP ? L_TO_GAL : 1)).toFixed(0)} {volUnitDay})
                    </span>
                  </div>
                </div>
              </div>


              {/* Card 3: Storage Tank Setting */}
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                      3. STORAGE TANK CAPACITY
                    </h3>
                  </div>
                  <Cylinder className="size-4 text-[#0A7BC7]" />
                </div>

                <div className="flex flex-col gap-3">
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
                      <strong className="text-[#0A7BC7] font-mono">70% Volume</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-100/60 dark:bg-slate-900/40 border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Refill Reserve</span>
                      <strong className="text-foreground font-mono">20% Level</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-100/60 dark:bg-slate-900/40 border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Vapor Space</span>
                      <strong className="text-foreground font-mono">30% Headroom</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Sizing Results Dashboard (100% Constant & Stationary, Never Moves or Scrolls) */}
            <div className="lg:col-span-5 flex flex-col gap-4 shrink-0">
              
              {/* Primary Results Highlight Card */}
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                      CALCULATION RESULTS
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowFormulaModal(true)}
                      className="inline-flex items-center justify-center size-5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-[#0A7BC7] transition cursor-pointer"
                      title="View Formula & Derivations"
                    >
                      <Info className="size-3.5" />
                    </button>
                  </div>

                  {/* Status Badge */}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-xs ${
                      isAdequate
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50"
                    }`}
                  >
                    {isAdequate ? <ShieldCheck className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                    <span>{isAdequate ? "Adequate Storage" : "Undersized Storage"}</span>
                  </div>
                </div>

                {/* Main Metric Tile */}
                <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-border flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Active Total Gas Demand ({inputs.gasType === "ng" ? "Natural Gas" : "LPG"})
                    </span>
                    <div className="text-2xl font-bold font-mono text-[#0A7BC7] mt-0.5">
                      {activeDemandVolDisp.toFixed(1)} {volUnitDay}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      ({activeDemandDisp.toFixed(2)} {demandUnit} equivalent)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Autonomy Duration
                    </span>
                    <div
                      className={`text-xl font-bold font-mono mt-0.5 ${
                        autonomyDays >= 7 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {autonomyDays.toFixed(1)} Days
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Target: ≥ 7 Days
                    </span>
                  </div>
                </div>

                {/* Sub-Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50/70 dark:bg-slate-900/50 rounded-xl border border-border/60 flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Recommended Tank (7-Day)</span>
                    <strong className="font-mono text-foreground text-sm">
                      {tankCapacityDisp.toFixed(0)} {volUnit} ({isIP ? (tankCapacity / 1000 * L_TO_GAL * 1000).toFixed(0) : (tankCapacity / 1000).toFixed(1)} {isIP ? "US Gal" : "m³"})
                    </strong>
                    <span className="text-[10px] text-muted-foreground">Weekly supply @ 70% usable fill</span>
                  </div>

                  <div className="p-3 bg-slate-50/70 dark:bg-slate-900/50 rounded-xl border border-border/60 flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Installed Tank Capacity</span>
                    <strong className="font-mono text-foreground text-sm">
                      {inputs.storageCapacity.toLocaleString()} {volUnit}
                    </strong>
                    <span className="text-[10px] text-muted-foreground">Physical nominal volume</span>
                  </div>

                  <div className="p-3 bg-slate-50/70 dark:bg-slate-900/50 rounded-xl border border-border/60 flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Effective Usable Gas</span>
                    <strong className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                      {usableGasDisp.toFixed(0)} {volUnit}
                    </strong>
                    <span className="text-[10px] text-muted-foreground">56% net working volume</span>
                  </div>

                  <div className="p-3 bg-slate-50/70 dark:bg-slate-900/50 rounded-xl border border-border/60 flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Safety Refill Reserve</span>
                    <strong className="font-mono text-foreground text-sm">
                      {reserveGasDisp.toFixed(0)} {volUnit}
                    </strong>
                    <span className="text-[10px] text-muted-foreground">20% reorder reserve level</span>
                  </div>
                </div>

                {/* Tank Visual Proportion Bar */}
                <div className="p-3 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-border/60 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">Tank Capacity Allocation:</span>
                    <span className="font-mono text-[11px] text-foreground">
                      Total: {inputs.storageCapacity.toLocaleString()} {volUnit}
                    </span>
                  </div>

                  <div className="w-full h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: "56%" }}
                      className="bg-[#0A7BC7] h-full"
                      title="56% Usable Working Gas"
                    />
                    <div
                      style={{ width: "14%" }}
                      className="bg-sky-400 h-full"
                      title="14% Safety Refill Reserve"
                    />
                    <div
                      style={{ width: "30%" }}
                      className="bg-slate-300 dark:bg-slate-700 h-full"
                      title="30% Vapor Headspace"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-[#0A7BC7]" />
                      <span>Usable (56%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-sky-400" />
                      <span>Reserve (14%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-slate-400" />
                      <span>Vapor Space (30%)</span>
                    </div>
                  </div>
                </div>

                {/* Adequacy Feedback */}
                <div
                  className={`p-3 rounded-xl border flex items-center gap-3 text-xs ${
                    isAdequate
                      ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300"
                      : "bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  {isAdequate ? (
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="size-5 shrink-0 text-amber-600" />
                  )}
                  <div>
                    <strong>{isAdequate ? "Storage Capacity Verified:" : "Storage Undersized Warning:"}</strong>
                    <p className="mt-0.5 leading-relaxed">
                      {isAdequate
                        ? `The installed tank (${inputs.storageCapacity.toLocaleString()} ${volUnit}) provides +${volumeSurplusDeficitDisp.toFixed(0)} ${volUnit} surplus over the weekly requirement (${tankCapacityDisp.toFixed(0)} ${volUnit}). Autonomy is ${autonomyDays.toFixed(1)} days.`
                        : `The installed tank (${inputs.storageCapacity.toLocaleString()} ${volUnit}) is insufficient for 7-day autonomy (${tankCapacityDisp.toFixed(0)} ${volUnit} required, deficit: ${Math.abs(volumeSurplusDeficitDisp).toFixed(0)} ${volUnit}). Please increase installed tank capacity.`}
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Formula & Derivations Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Flame className="size-5 text-[#0A7BC7]" />
                <h3 className="font-bold text-base text-foreground">
                  Gas Storage Tank Sizing — Formulas & Engineering Basis
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                className="size-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3.5 text-xs text-muted-foreground leading-relaxed">
              <div className="p-3 bg-slate-100/60 dark:bg-slate-900/40 rounded-xl border border-border/80 flex flex-col gap-1.5">
                <strong className="text-foreground text-xs">1. Kitchen Consumption Formulas</strong>
                <p className="font-mono text-foreground bg-card p-2 rounded border border-border/60">
                  Q_res = N_res × q_res &nbsp;(Residential Volumetric Demand, m³/day)
                  <br />
                  Q_ret = N_ret × q_ret &nbsp;(Retail F&B Volumetric Demand, m³/day)
                </p>
                <span>Where: N is number of units/kitchens, and q is average daily consumption constant.</span>
              </div>

              <div className="p-3 bg-slate-100/60 dark:bg-slate-900/40 rounded-xl border border-border/80 flex flex-col gap-1.5">
                <strong className="text-foreground text-xs">2. Total Gas Demand (Natural Gas vs LPG)</strong>
                <p className="font-mono text-foreground bg-card p-2 rounded border border-border/60">
                  Q_NG = (Q_res + Q_ret) × 1,000 &nbsp;(L/day)
                  <br />
                  Q_LPG = Q_NG / 2.67 &nbsp;(L/day)
                </p>
                <span>
                  LPG (Propane / Butane blend) possesses approximately 2.67 times higher volumetric energy density than standard pipeline Natural Gas (Methane).
                </span>
              </div>

              <div className="p-3 bg-slate-100/60 dark:bg-slate-900/40 rounded-xl border border-border/80 flex flex-col gap-1.5">
                <strong className="text-foreground text-xs">3. Weekly Tank Storage Sizing (7-Day Autonomy)</strong>
                <p className="font-mono text-foreground bg-card p-2 rounded border border-border/60">
                  V_tank = (Q_daily × 7) / 0.70 &nbsp;(Litres)
                </p>
                <span>
                  Per NFPA 58 / BS 5482 codes, bulk gas vessels must maintain a maximum liquid fill limit of 70% to 85% to allow for thermal liquid expansion without overpressurizing pressure relief valves.
                </span>
              </div>

              <div className="p-3 bg-slate-100/60 dark:bg-slate-900/40 rounded-xl border border-border/80 flex flex-col gap-1.5">
                <strong className="text-foreground text-xs">4. Effective Usable Volume & Refill Reserve</strong>
                <p className="font-mono text-foreground bg-card p-2 rounded border border-border/60">
                  V_usable = V_installed × 0.70 × 0.80 &nbsp;(56% Net Operational Gas)
                  <br />
                  V_reserve = V_installed × 0.70 × 0.20 &nbsp;(14% Emergency Reorder Reserve)
                  <br />
                  V_vapor = V_installed × 0.30 &nbsp;(30% Expansion Vapor Headspace)
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#0A7BC7] text-white hover:bg-[#0866A5] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
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
