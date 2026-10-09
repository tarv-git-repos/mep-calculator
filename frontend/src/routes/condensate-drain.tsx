import { calculateDrainResults, type CondMode } from "@/lib/calc-condensate-drain";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { kwToTr, trToKw, kwToBtu, btuToKw, mToFt, ftToM } from "@/utils/conversions";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { useAuth } from "@/contexts/AuthContext";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { TBtn } from "@/components/workspace/Button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  MessageSquare,
  FileSpreadsheet,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  RotateCcw,
  Zap,
  Droplets,
  Clipboard,
  Check,
  Edit3,
  X,
  Sparkles,
  Sliders,
  Info,
  BookOpen,
  Printer,
  Calendar,
  UserCheck,
  CheckCircle2,
  Activity,
  AlertTriangle,
  Gauge,
} from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/condensate-drain")({
  head: () => ({
    meta: [
      { title: "Condensate Drain Sizing — MEP Calc" },
      { name: "description", content: "Condensate Drain pipe sizing, slope, and drop calculator." },
    ],
  }),
  component: CondensateDrainPage,
});

interface SizingInputData {
  condMode: CondMode;
  trLoad: number;
  latentLoad: number;
  unitsQty: number;
  drainLength: number;
}

export function CondensateDrainPage() {
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/condensate-drain", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/condensate-drain", activeProjectId || project?.id);
  const { profile, userData } = useAuth();
  const currentUserName = userData?.name || profile?.name || (userData as any)?.full_name || "Design Engineer";
  const isApprovedLocked = useCalculationLock("/condensate-drain", activeProjectId || project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const isLocked = isEffectiveReadOnly || isApprovedLocked || isViewerRole;

  // Tabs state (Matching FM-200 UI: "solver" | "report")
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState<boolean>(false);

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [condMode, setCondMode] = useState<CondMode>("tr");
  const [trLoad, setTrLoad] = useState<number>(35);
  const [latentLoad, setLatentLoad] = useState<number>(3.5);
  const [unitsQty, setUnitsQty] = useState<number>(1);
  const [drainLength, setDrainLength] = useState<number>(3);

  // Formula Breakdown Modal State
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);

  // Edit Modal State (Exact Ventilation EditSpaceModal workflow)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalForm, setEditModalForm] = useState<SizingInputData>({
    condMode: "tr",
    trLoad: 35,
    latentLoad: 3.5,
    unitsQty: 1,
    drainLength: 3,
  });

  // Comment & Task Assignment Modal State (Exact Preliminary Cooling Load workflow)
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string; type?: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [commentsList, setCommentsList] = useState<any[]>(() => {
    try {
      const pId = project?.id || activeProjectId || "default";
      const list1 = JSON.parse(localStorage.getItem(`mep_calc_comments_${pId}_/condensate-drain`) || "[]");
      const list2 = JSON.parse(localStorage.getItem(`mep_calc_comments_default_/condensate-drain`) || "[]");
      const list3 = JSON.parse(localStorage.getItem("mep_calc_coord_notifs") || "[]");
      const list4 = JSON.parse(localStorage.getItem("mep_persistent_user_notifs") || "[]");
      const all = [
        ...(Array.isArray(list1) ? list1 : []),
        ...(Array.isArray(list2) ? list2 : []),
        ...(Array.isArray(list3) ? list3 : []),
        ...(Array.isArray(list4) ? list4 : [])
      ];
      const seen = new Set<string>();
      return all.filter((c) => {
        if (!c || typeof c !== "object") return false;
        const sig = `${c.id || ""}_${c.targetId || ""}_${c.text || ""}_${c.timestamp || ""}`;
        if (seen.has(sig)) return false;
        seen.add(sig);
        return true;
      });
    } catch {
      return [];
    }
  });

  // Listen for storage changes and real-time comment additions
  useEffect(() => {
    const handleReloadComments = () => {
      try {
        const pId = project?.id || activeProjectId || "default";
        const list1 = JSON.parse(localStorage.getItem(`mep_calc_comments_${pId}_/condensate-drain`) || "[]");
        const list2 = JSON.parse(localStorage.getItem(`mep_calc_comments_default_/condensate-drain`) || "[]");
        const list3 = JSON.parse(localStorage.getItem("mep_calc_coord_notifs") || "[]");
        const list4 = JSON.parse(localStorage.getItem("mep_persistent_user_notifs") || "[]");
        const all = [
          ...(Array.isArray(list1) ? list1 : []),
          ...(Array.isArray(list2) ? list2 : []),
          ...(Array.isArray(list3) ? list3 : []),
          ...(Array.isArray(list4) ? list4 : [])
        ];
        const seen = new Set<string>();
        const clean = all.filter((c) => {
          if (!c || typeof c !== "object") return false;
          const sig = `${c.id || ""}_${c.targetId || ""}_${c.text || ""}_${c.timestamp || ""}`;
          if (seen.has(sig)) return false;
          seen.add(sig);
          return true;
        });
        setCommentsList(clean);
      } catch {}
    };

    window.addEventListener("storage", handleReloadComments);
    window.addEventListener("mep-notification-added" as any, handleReloadComments);
    window.addEventListener("mep_notification_received" as any, handleReloadComments);
    window.addEventListener("mep_notif_tick" as any, handleReloadComments);
    window.addEventListener("mep_storage_changed" as any, handleReloadComments);
    window.addEventListener("mep-highlight-item" as any, handleReloadComments);

    return () => {
      window.removeEventListener("storage", handleReloadComments);
      window.removeEventListener("mep-notification-added" as any, handleReloadComments);
      window.removeEventListener("mep_notification_received" as any, handleReloadComments);
      window.removeEventListener("mep_notif_tick" as any, handleReloadComments);
      window.removeEventListener("mep_storage_changed" as any, handleReloadComments);
      window.removeEventListener("mep-highlight-item" as any, handleReloadComments);
    };
  }, [project?.id, activeProjectId]);

  const [hasCalculated, setHasCalculated] = useState<boolean>(true);

  const ip = unitSystem === "ip";

  // Deep-link highlighting handler for notifications & double-clicks
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();

      const el =
        document.getElementById(targetId || "") ||
        document.getElementById(`field-${targetId}`) ||
        document.getElementById(`res-${targetId}`) ||
        document.getElementById(`step-${targetId}`) ||
        document.querySelector(`[data-item-id="${targetId}"]`) ||
        document.querySelector(`[data-field-id="${targetId}"]`);

      if (el) {
        setHighlightedTargetId(targetId || cleanId);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedTargetId(null);
        }, 5000);
      }
    };

    const handleCustomHighlight = (e: any) => {
      const { targetId, targetName } = e.detail || {};
      handleScrollTarget(targetId, targetName);
    };

    window.addEventListener("mep-highlight-item" as any, handleCustomHighlight);

    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      const params = new URLSearchParams(window.location.search);
      const targetParam = params.get("targetId") || params.get("highlight") || hash;
      if (targetParam) {
        setTimeout(() => handleScrollTarget(targetParam), 400);
      }
    }

    return () => {
      window.removeEventListener("mep-highlight-item" as any, handleCustomHighlight);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  // Open Comment Modal (Exact Preliminary Cooling Load signature)
  const handleOpenComment = (item: { id: string; name: string; type?: string }) => {
    setCommentTargetItem({ id: item.id, name: item.name, type: item.type || "Condensate Drain Parameter" });
    setCommentModalOpen(true);
  };

  // Save Comment (Exact Preliminary Cooling Load persistence & deduplication)
  const handleSaveComment = (commentData: any) => {
    if (!commentTargetItem) return;

    const comment =
      typeof commentData === "object" && commentData !== null
        ? commentData
        : {
            id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            text: String(commentData || ""),
            authorName: currentUserName,
            authorRole: profile?.role || "Engineer",
            timestamp: new Date().toISOString(),
            assignedUsers: [],
            targetId: commentTargetItem.id,
            targetName: commentTargetItem.name,
            targetType: commentTargetItem.type || "equipment",
            calculatorTitle: "Condensate Drain Sizing",
            calculatorPath: "/condensate-drain",
            projectId: project?.id || "default",
            projectName: project?.name || "Condensate Drain",
          };

    setCommentsList((prev) => {
      // Deduplicate by ID and content signature
      const exists = prev.some(
        (c) =>
          c.id === comment.id ||
          (c.text === comment.text &&
            c.targetId === comment.targetId &&
            Math.abs(new Date(c.timestamp || 0).getTime() - new Date(comment.timestamp || 0).getTime()) < 10000)
      );
      if (exists) return prev;
      const updated = [comment, ...prev];
      const pId = project?.id || "default";
      localStorage.setItem(`mep_calc_comments_${pId}_/condensate-drain`, JSON.stringify(updated));
      return updated;
    });

    setCommentModalOpen(false);
  };

  // Open Edit Modal (Double-click workflow like Ventilation)
  const handleOpenEditModal = () => {
    if (isLocked) {
      toast.info("Workspace / calculation is in read-only mode.", { id: "readonly-notice" });
      return;
    }
    setEditModalForm({
      condMode,
      trLoad,
      latentLoad,
      unitsQty,
      drainLength,
    });
    setEditModalOpen(true);
  };

  const handleSaveEditModal = () => {
    setCondMode(editModalForm.condMode);
    setTrLoad(Number(editModalForm.trLoad) || 0);
    setLatentLoad(Number(editModalForm.latentLoad) || 0);
    setUnitsQty(Math.max(1, Number(editModalForm.unitsQty) || 1));
    setDrainLength(Number(editModalForm.drainLength) || 0);
    setHasCalculated(true);
    setEditModalOpen(false);
    toast.success("Condensate drain parameters updated.");
  };

  // Unit Toggle handler matching Sewage Pump format
  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean = true) => {
    if (isEffectiveReadOnly) return;
    if (targetUnit === unitSystem) return;
    setUnitSystem(targetUnit);

    if (shouldConvert) {
      if (targetUnit === "ip") {
        setTrLoad(Number(kwToTr(trLoad).toFixed(1)));
        setLatentLoad(Number(kwToBtu(latentLoad).toFixed(0)));
        setDrainLength(Number(mToFt(drainLength).toFixed(1)));
      } else {
        setTrLoad(Number(trToKw(trLoad).toFixed(1)));
        setLatentLoad(Number(btuToKw(latentLoad).toFixed(1)));
        setDrainLength(Number(ftToM(drainLength).toFixed(1)));
      }
    }
  };

  // Sizing calculation logic
  const calculateDrainResults = (mode: CondMode, tr: number, lat: number, qty: number, length: number, isIp: boolean) => {
    let trVal = mode === "tr" ? (isIp ? tr : kwToTr(tr)) : 0;
    let latBTU = 0;
    if (mode === "tr") {
      latBTU = trVal * 12000 * 0.3;
    } else {
      latBTU = isIp ? lat : kwToBtu(lat);
    }

    const galPerHrSingle = latBTU / (1075 * 8.34);
    const galPerHr = galPerHrSingle * qty;
    const lPerMin = galPerHr * 0.063;

    let pipeSize = "";
    let minSlope = "";
    let totalDrop = "";

    if (galPerHr < 5) {
      pipeSize = '3/4" (19mm)';
      minSlope = isIp ? '1/4" per ft (2.0%)' : "2.0% (1:50)";
      const d = 0.25 * length;
      totalDrop = isIp ? `${d.toFixed(2)} in` : `${(length * 0.02 * 1000).toFixed(0)} mm`;
    } else if (galPerHr < 20) {
      pipeSize = '1" (25mm)';
      minSlope = isIp ? '1/4" per ft (2.0%)' : "2.0% (1:50)";
      const d = 0.25 * length;
      totalDrop = isIp ? `${d.toFixed(2)} in` : `${(length * 0.02 * 1000).toFixed(0)} mm`;
    } else {
      pipeSize = '1-1/4" (32mm)';
      minSlope = isIp ? '1/8" per ft (1.0%)' : "1.0% (1:100)";
      const d = 0.125 * length;
      totalDrop = isIp ? `${d.toFixed(2)} in` : `${(length * 0.01 * 1000).toFixed(0)} mm`;
    }

    return {
      trVal,
      latBTU,
      galPerHrSingle,
      galPerHr,
      lPerMin,
      flowRateDisplay: isIp ? `${galPerHr.toFixed(2)} gal/hr` : `${lPerMin.toFixed(3)} L/min`,
      pipeSize,
      minSlope,
      totalDrop,
    };
  };

  const calculatedData = useMemo(() => {
    return calculateDrainResults(condMode, trLoad, latentLoad, unitsQty, drainLength, ip);
  }, [condMode, trLoad, latentLoad, unitsQty, drainLength, ip]);

  // Modal preview calculation
  const modalPreviewData = useMemo(() => {
    return calculateDrainResults(
      editModalForm.condMode,
      editModalForm.trLoad,
      editModalForm.latentLoad,
      editModalForm.unitsQty,
      editModalForm.drainLength,
      ip
    );
  }, [editModalForm, ip]);

  const handleCalculate = () => {
    setHasCalculated(true);
    toast.success("Condensate drain pipe sized successfully.");
  };

  const handleResetDefaults = () => {
    if (isLocked) {
      toast.error("Calculation is locked or read-only.");
      return;
    }
    setCondMode("tr");
    setTrLoad(ip ? 10 : 35);
    setLatentLoad(ip ? 12000 : 3.5);
    setUnitsQty(1);
    setDrainLength(ip ? 10 : 3);
    setHasCalculated(true);
    toast.info("All parameters reset to default values.");
  };

  const handleCopyValue = (label: string, val: string | number) => {
    navigator.clipboard.writeText(String(val));
    toast.success(`Copied ${label}: ${val}`);
  };

  const handlePasteValue = async (setter: (val: number) => void, label: string) => {
    if (isLocked) {
      toast.error("Calculation is locked or read-only.");
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      const num = parseFloat(text.replace(/[^0-9.-]/g, ""));
      if (!isNaN(num) && num > 0) {
        setter(num);
        toast.success(`Pasted ${label}: ${num}`);
      } else {
        toast.error(`Invalid clipboard number for ${label}: "${text}"`);
      }
    } catch {
      toast.error("Unable to read clipboard. Please grant permission.");
    }
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headers = ["Parameter", "Value"];
    const exportData = [
      ["Sizing Method", condMode === "tr" ? "From Cooling Capacity" : "From Latent Load"],
      [
        condMode === "tr" ? `Cooling Capacity (${ip ? "TR" : "kW"})` : `Latent Load (${ip ? "BTU/hr" : "kW"})`,
        condMode === "tr" ? trLoad : latentLoad,
      ],
      ["Number of AC/FCU Units", unitsQty],
      [`Drain Length (${ip ? "ft" : "m"})`, drainLength],
      [],
      ["Sizing Results"],
      ["Condensate Flow Rate", calculatedData.flowRateDisplay],
      ["Recommended Pipe Size", calculatedData.pipeSize],
      ["Minimum Slope", calculatedData.minSlope],
      ["Total Drop Over Run", calculatedData.totalDrop],
    ];
    const ws = XLSX.utils.aoa_to_sheet([["Condensate Drain Sizing"], [], headers, ...exportData]);
    XLSX.utils.book_append_sheet(wb, ws, "Drain Sizing");
    const xlsxBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadFile(new Uint8Array(xlsxBuffer), "Condensate_Drain_Sizing.xlsx", "Excel Document", ["xlsx"]);
    toast.success("Condensate drain schedule exported to Excel.");
  };

  const exportPdf = async () => {
    try {
      const activeProj: any = project || workspaceStore.getState()?.project || {};
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

      const calcNo = activeProj?.calcNo || `TRV-CAL-CDS-${(activeProjectId || "0000").slice(-4).toUpperCase()}`;
      const today = formatDateStr(new Date());
      const projectNo = activeProj?.code || activeProj?.projectNo || (activeProjectId !== "default" ? activeProjectId.slice(0, 8) : "P000");
      const projectName = activeProj?.name || activeProj?.projectName || "MEP Project";
      const clientName = activeProj?.client || "-";
      const endUser = activeProj?.endUser || activeProj?.location || "-";

      // Header Title (Exact Ventilation standard: font 14 bold at x=14, y=14)
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Condensate Drain Sizing Calculation Report", 14, 14);

      // Metadata Block for Portrait Mode (182mm width: left 14mm to right 196mm, height 18mm: y=18 to y=36)
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      doc.setDrawColor(0, 0, 0);
      doc.rect(14, 18, 182, 18); // Outer box for metadata

      // Vertical line to separate left/right metadata (at x = 105)
      doc.line(105, 18, 105, 36);

      // Horizontal lines (at y = 24 and y = 30)
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

      // Styling tokens matching Ventilation PDF
      const primaryFill = [217, 217, 217] as [number, number, number]; // Standard header gray (#D9D9D9)
      const blueFill = [218, 233, 248] as [number, number, number]; // Result highlight blue (#DAE9F8)
      const orangeFill = [255, 230, 204] as [number, number, number]; // Signature header orange (#FFE6CC)

      // Table 1: Design Parameters & Hydraulic Input Data
      const inputTableBody = [
        [
          "1",
          "Applied Sizing Methodology",
          condMode === "tr" ? "From Cooling Capacity" : "From Latent Heat Load",
          "-",
          "Design Engineer Input Mode"
        ],
        [
          "2",
          condMode === "tr" ? "Cooling Capacity Rating" : "Latent Heat Load",
          condMode === "tr"
            ? `${trLoad} ${ip ? "TR" : "kW"}`
            : `${latentLoad} ${ip ? "BTU/hr" : "kW"}`,
          ip ? (condMode === "tr" ? "TR" : "BTU/hr") : "kW",
          "Equipment Schedule Data"
        ],
        [
          "3",
          "Connected AC / FCU Units Quantity",
          String(unitsQty),
          "Units",
          "Connected Equipment Quantity"
        ],
        [
          "4",
          "Total Drain Run Piping Length",
          `${drainLength} ${ip ? "ft" : "m"}`,
          ip ? "ft" : "m",
          "Layout Piping Routing"
        ],
        [
          "5",
          "Design Latent Ratio Assumption",
          "30.0%",
          "%",
          "ASHRAE Fundamentals Standard"
        ]
      ];

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
          minCellHeight: 6
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 }
        },
        columnStyles: {
          0: { cellWidth: 14, halign: "center" },
          1: { halign: "left", cellWidth: 70, fontStyle: "bold" },
          2: { cellWidth: 38, fontStyle: "bold" },
          3: { cellWidth: 20 },
          4: { halign: "left", cellWidth: 40 }
        },
        head: [
          [
            { content: "Sr. No.", styles: { fillColor: primaryFill } },
            { content: "Design Parameter Description", styles: { fillColor: primaryFill } },
            { content: "Value", styles: { fillColor: primaryFill } },
            { content: "Unit", styles: { fillColor: primaryFill } },
            { content: "Standard / Code Reference", styles: { fillColor: primaryFill } }
          ]
        ],
        body: inputTableBody
      });

      let nextY = (doc as any).lastAutoTable?.finalY ?? 95;

      // Table 2: Calculated Sizing Results
      const resultsTableBody = [
        [
          "A",
          "Calculated Total Latent Cooling Load",
          `${Math.round(calculatedData.latBTU).toLocaleString()} BTU/hr`,
          "Q_latent = TR × 12,000 × 0.30"
        ],
        [
          "B",
          "Condensate Generation per Single Unit",
          `${calculatedData.galPerHrSingle.toFixed(2)} GPH`,
          "q = Q_latent / (1,075 × 8.34)"
        ],
        [
          "C",
          "Total Aggregate Condensate Flow Rate",
          calculatedData.flowRateDisplay,
          "Q_total = q_single × Units Quantity"
        ],
        [
          "D",
          "RECOMMENDED DRAIN PIPE SIZE",
          calculatedData.pipeSize,
          "IPC Table 307.2.2 Minimum Diameter"
        ],
        [
          "E",
          "Statutory Minimum Installation Slope",
          calculatedData.minSlope,
          "IPC Section 307.2.1 Gravity Fall"
        ],
        [
          "F",
          "Total Vertical Drop / Fall Over Run",
          calculatedData.totalDrop,
          "Total Drop = Run Length × Slope"
        ]
      ];

      callAutoTable(doc, {
        startY: nextY + 5,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 },
          minCellHeight: 6
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 }
        },
        columnStyles: {
          0: { cellWidth: 14, halign: "center" },
          1: { halign: "left", cellWidth: 74, fontStyle: "bold" },
          2: { cellWidth: 44, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 50 }
        },
        head: [
          [
            { content: "Item", styles: { fillColor: primaryFill } },
            { content: "Sizing Output Parameter (IPC 307.2.2)", styles: { fillColor: primaryFill } },
            { content: "Calculated Result", styles: { fillColor: blueFill } },
            { content: "Governing Code / Engineering Basis", styles: { fillColor: primaryFill } }
          ]
        ],
        body: resultsTableBody,
        didParseCell: function (data: any) {
          if (data.section === "body" && data.row.index === 3) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = blueFill;
            if (data.column.index === 2) {
              data.cell.styles.fontSize = 8.5;
            }
          }
        }
      });

      nextY = (doc as any).lastAutoTable?.finalY ?? 145;

      // Table 3: IPC Table 307.2.2 Sizing Guidelines
      const is34 = calculatedData.pipeSize.includes("3/4");
      const is1 = calculatedData.pipeSize.includes('1"') && !calculatedData.pipeSize.includes("1-");
      const is114 = calculatedData.pipeSize.includes("1-1/4");
      const is112 = calculatedData.pipeSize.includes("1-1/2");

      const ipcTableBody = [
        ["1", "Cooling Equipment Capacity < 20 Tons (Flow < 5 GPH)", "3/4\" (DN20 / 19mm)", "1/8 in/ft (10.4 mm/m) Minimum Fall"],
        ["2", "Cooling Equipment Capacity 20 to 40 Tons (Flow 5–20 GPH)", "1\" (DN25 / 25mm)", "1/8 in/ft (10.4 mm/m) Minimum Fall"],
        ["3", "Cooling Equipment Capacity 40 to 90 Tons (Flow 20–40 GPH)", "1-1/4\" (DN32 / 32mm)", "1/8 in/ft (10.4 mm/m) Minimum Fall"],
        ["4", "Cooling Equipment Capacity 90 to 125 Tons (Flow > 40 GPH)", "1-1/2\" (DN40 / 38mm)", "1/8 in/ft (10.4 mm/m) Minimum Fall"]
      ];

      callAutoTable(doc, {
        startY: nextY + 5,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 1.8, bottom: 1.8, left: 1, right: 1 }
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 }
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 14 },
          1: { halign: "left", cellWidth: 76, fontStyle: "bold" },
          2: { halign: "center", cellWidth: 42, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 50 }
        },
        head: [
          [
            { content: "No.", styles: { fillColor: primaryFill } },
            { content: "IPC 307.2.2 Equipment Capacity Bracket", styles: { fillColor: primaryFill } },
            { content: "Minimum Pipe Size", styles: { fillColor: primaryFill } },
            { content: "Installation Slope Criteria", styles: { fillColor: primaryFill } }
          ]
        ],
        body: ipcTableBody,
        didParseCell: function (data: any) {
          if (data.section === "body") {
            const isSelected =
              (data.row.index === 0 && is34) ||
              (data.row.index === 1 && is1) ||
              (data.row.index === 2 && is114) ||
              (data.row.index === 3 && is112);
            if (isSelected) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [242, 248, 253];
            }
          }
        }
      });

      nextY = (doc as any).lastAutoTable?.finalY ?? 185;

      // Table 4: Standard Notes
      callAutoTable(doc, {
        startY: nextY + 4,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 6.8,
          halign: "left",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 }
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold"
        },
        head: [
          [
            { content: "Standard Notes & Statutory Guidelines (IPC Section 307.2)" }
          ]
        ],
        body: [
          ["1. Trapping: Condensate drains must be trapped when connected to equipment under negative suction pressure to prevent air locks and water carryover."],
          ["2. Indirect Connection: Condensate waste pipes shall not connect directly to any drainage system without an approved indirect waste receptor with an air break."],
          ["3. Cleanouts: A cleanout shall be installed at each change in direction greater than 45 degrees and at the start of each horizontal run."]
        ]
      });

      const finalY = (doc as any).lastAutoTable?.finalY ?? 220;

      // 3-Tier Signature Block (Exact Ventilation standard: Originator, Reviewer, Approver with #FFE6CC header)
      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate
      } = getSignatureBlockDetails(activeProjectId || project?.id || "default", "/condensate-drain", currentUserName);

      callAutoTable(doc, {
        startY: finalY + 6,
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
        headStyles: {
          fillColor: orangeFill,
          textColor: 0,
          fontStyle: "bold"
        },
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
            { content: originatedName || "-", styles: { halign: "center" } },
            { content: reviewerName || "-", styles: { halign: "center" } },
            { content: approverName || "-", styles: { halign: "center" } }
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate || "-", styles: { halign: "center" } },
            { content: reviewerDate || "-", styles: { halign: "center" } },
            { content: approverDate || "-", styles: { halign: "center" } }
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
      await downloadFile(new Uint8Array(pdfBuffer), `Condensate_Drain_Report_${project?.code || "P000"}.pdf`, "PDF Document", ["pdf"]);
      toast.success("Condensate Drain PDF exported successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(`Export failed: ${err.message || err}`);
    }
  };

  // Helper component to render an input row with item-specific comments & Ventilation double-click
  const renderInputRow = (
    id: string,
    label: string,
    value: number,
    setter: (val: number) => void,
    defaultValue: number,
    inputProps: { step?: string; min?: number } = {}
  ) => {
    const itemComments = getMergedItemComments(id, label, commentsList, "/condensate-drain", activeProjectId || project?.id);
    const hasComments = itemComments.length > 0;
    const isHighlighted =
      highlightedTargetId === id ||
      highlightedTargetId === `field-${id}` ||
      (highlightedTargetId && id.toLowerCase().includes(highlightedTargetId.toLowerCase())) ||
      (highlightedTargetId && label.toLowerCase().includes(highlightedTargetId.toLowerCase()));

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${id}`}
            data-item-id={id}
            data-field-id={id}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleOpenEditModal();
            }}
            title="Double-click to open Edit Parameters Modal (Ventilation style)"
            className={`flex flex-col gap-1.5 p-2 -mx-2 rounded-xl transition-all duration-200 cursor-pointer group ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-[#0A7BC7] bg-[#0A7BC7]/10 z-20 font-bold"
                : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
            }`}
          >
            <div className="flex justify-between items-center select-none">
              <label className="font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                <span>{label}</span>
                {hasComments && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenComment({ id, name: label, type: "input" });
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold text-[10.5px] hover:bg-blue-200 dark:hover:bg-blue-900 transition cursor-pointer shadow-xs select-none border border-blue-300/60 dark:border-blue-700/60 shrink-0"
                    title={`${itemComments.length} comment(s)/task(s) assigned to ${label}`}
                  >
                    <MessageSquare className="size-3.5 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                    <span className="text-[10px] font-extrabold">{itemComments.length}</span>
                  </button>
                )}
              </label>
              <div className="flex items-center gap-1.5" />
            </div>

            <input
              type="number"
              step={inputProps.step || "any"}
              min={inputProps.min || 0}
              disabled={isLocked}
              value={value}
              onChange={(e) => {
                setter(Number(e.target.value));
              }}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleOpenEditModal();
              }}
              className={`w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs outline-none font-bold transition-all focus:border-[#0A7BC7] focus:ring-1 focus:ring-[#0A7BC7]/50 ${
                isLocked ? "cursor-not-allowed opacity-75" : "cursor-text"
              }`}
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={handleOpenEditModal}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/10 text-primary rounded-lg cursor-pointer font-semibold"
          >
            <Edit3 className="size-3.5 text-primary" />
            <span>Edit Parameters Modal</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleCopyValue(label, value)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value ({value})</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          {!isLocked && (
            <ContextMenuItem
              onClick={() => handlePasteValue(setter, label)}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
            >
              <Clipboard className="size-3.5 text-muted-foreground" />
              <span>Paste Value</span>
              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
            </ContextMenuItem>
          )}

          {!isLocked && (
            <ContextMenuItem
              onClick={() => {
                setter(defaultValue);
                toast.info(`Reset ${label} to default (${defaultValue})`);
              }}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
            >
              <RotateCcw className="size-3.5 text-muted-foreground" />
              <span>Reset to Default ({defaultValue})</span>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment({ id, name: label, type: "input" })}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment / Assign Task"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // Helper component to render a result output row with item-specific comments & Ventilation double-click
  const renderResultRow = (
    id: string,
    label: string,
    valueFormatted: string,
    stepLinked: number,
    isHighlight: boolean = false,
    highlightClass: string = "text-foreground"
  ) => {
    const itemComments = getMergedItemComments(id, label, commentsList, "/condensate-drain", activeProjectId || project?.id);
    const hasComments = itemComments.length > 0;
    const isHighlighted =
      highlightedTargetId === id ||
      highlightedTargetId === `res-${id}` ||
      (highlightedTargetId && id.toLowerCase().includes(highlightedTargetId.toLowerCase())) ||
      (highlightedTargetId && label.toLowerCase().includes(highlightedTargetId.toLowerCase()));

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`res-${id}`}
            data-item-id={id}
            data-field-id={id}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleOpenEditModal();
            }}
            title="Double-click to open Edit Parameters Modal (Ventilation style)"
            className={`flex justify-between items-center py-2 px-2.5 border-b border-border/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 rounded-lg transition-all duration-150 cursor-pointer group select-none ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-[#0A7BC7] bg-[#0A7BC7]/10 z-20 font-bold"
                : ""
            }`}
          >
            <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
              <span>{label}</span>
              {hasComments && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenComment({ id, name: label, type: "result" });
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold text-[10.5px] hover:bg-blue-200 dark:hover:bg-blue-900 transition cursor-pointer shadow-xs select-none border border-blue-300/60 dark:border-blue-700/60 shrink-0"
                  title={`${itemComments.length} comment(s)/task(s) assigned to ${label}`}
                >
                  <MessageSquare className="size-3.5 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                  <span className="text-[10px] font-extrabold">{itemComments.length}</span>
                </button>
              )}
            </span>
            <div className="flex items-center gap-2">
              
              <strong className={`font-mono text-xs ${isHighlight ? "text-[#0A7BC7] text-[14px] font-bold" : highlightClass}`}>
                {valueFormatted}
              </strong>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-64 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={handleOpenEditModal}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/10 text-primary rounded-lg cursor-pointer font-semibold"
          >
            <Edit3 className="size-3.5 text-primary" />
            <span>Edit Parameters Modal</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => setFormulaModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent rounded-lg cursor-pointer font-medium"
          >
            <HelpCircle className="size-3.5 text-primary" />
            <span>Formula Breakdown Guide</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleCopyValue(label, valueFormatted)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value ({valueFormatted})</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => {
              navigator.clipboard.writeText(`${label}: ${valueFormatted}`);
              toast.success(`Copied full row: "${label}: ${valueFormatted}"`);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <FileText className="size-3.5 text-muted-foreground" />
            <span>Copy Full Row</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment({ id, name: label, type: "result" })}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment / Assign Task"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <AppShell
      title="Condensate Drain Sizing"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
      intelLabel="Intelligence"
    >
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Condensate Drain Sizer</h1>
              </div>
              <button 
                type="button"
                onClick={() => setIntelOpen((v) => !v)}
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
                projectId={activeProjectId || project?.id}
                calculatorPath="/condensate-drain"
                calculatorTitle="Condensate Drain Sizing"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitSystemChange}
                disabled={isLocked}
                inputDescriptions="Cooling Capacity (TR / kW), Latent Load (BTU/hr / kW), Drain Run Length (ft / m)"
                conversionExample={
                  unitSystem === "ip"
                    ? "Convert 10 TR → 35.17 kW, 12,000 BTU/hr → 3.52 kW, 10 ft → 3.05 m"
                    : "Convert 35 kW → 9.95 TR, 3.5 kW → 11,942 BTU/hr, 3 m → 9.84 ft"
                }
              />
            </div>
          </div>

          {/* Main Card Container for Tabs & Content (Matching FM-200 Layout) */}
          <div
            className={`flex-1 flex flex-col min-h-[500px] overflow-hidden rounded-2xl transition-all duration-300 bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)] ${
              calcReviewState?.status === "APPROVED"
                ? "border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
                : calcReviewState?.status === "REJECTED"
                ? "border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                : calcReviewState?.status === "REVIEWED"
                ? "border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                : ""
            }`}
          >
            {/* Tabs Selector row (Exact FM-200 standard format) */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80">
              <div className="flex items-center gap-2">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    type="button"
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
                    type="button"
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

                <TBtn onClick={() => setFormulaModalOpen(true)} title="View IPC & ASHRAE Formula Breakdown">
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Right Side Controls: Export */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={exportPdf}>
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Inputs Card */}
                    <div className="lg:col-span-5 flex flex-col gap-5">
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            onDoubleClick={handleOpenEditModal}
                            className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs cursor-pointer transition-all hover:border-border/80"
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-border/60 select-none">
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                                  Inputs
                                </h3>
                              </div>
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {ip ? "IP Units" : "SI Units"}
                              </span>
                            </div>

                            <div className="flex flex-col gap-3.5 text-xs">
                              {/* Sizing Method Switch */}
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div className="flex flex-col gap-1.5 p-1 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                    <div className="flex justify-between items-center select-none">
                                      <label className="font-semibold text-foreground">Sizing Method</label>
                                    </div>
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 border border-border/60 select-none">
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCondMode("tr");
                                        }}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                                          condMode === "tr"
                                            ? "bg-white dark:bg-slate-900 text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                        }`}
                                      >
                                        From Cooling capacity
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCondMode("lat");
                                        }}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                                          condMode === "lat"
                                            ? "bg-white dark:bg-slate-900 text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                        }`}
                                      >
                                        From Latent load
                                      </button>
                                    </div>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                  <ContextMenuItem
                                    onClick={() => setCondMode("tr")}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent rounded-lg cursor-pointer font-medium"
                                  >
                                    <Droplets className="size-3.5 text-primary" />
                                    <span>Switch to Cooling Capacity</span>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => setCondMode("lat")}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent rounded-lg cursor-pointer font-medium"
                                  >
                                    <Droplets className="size-3.5 text-primary" />
                                    <span>Switch to Latent Load</span>
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>

                              {/* Cooling Capacity or Latent Load */}
                              {condMode === "tr"
                                ? renderInputRow(
                                    "cooling-capacity",
                                    `Cooling Capacity (${ip ? "TR" : "kW"})`,
                                    trLoad,
                                    setTrLoad,
                                    ip ? 10 : 35,
                                    { step: "any", min: 0.1 }
                                  )
                                : renderInputRow(
                                    "latent-load",
                                    `Latent Load (${ip ? "BTU/hr" : "kW"})`,
                                    latentLoad,
                                    setLatentLoad,
                                    ip ? 12000 : 3.5,
                                    { step: "any", min: 0.1 }
                                  )}

                              {/* Units Quantity */}
                              {renderInputRow(
                                "units-quantity",
                                "Number of AC/FCU Units",
                                unitsQty,
                                setUnitsQty,
                                1,
                                { step: "1", min: 1 }
                              )}

                              {/* Drain Length */}
                              {renderInputRow(
                                "drain-length",
                                `Drain Length (${ip ? "ft" : "m"})`,
                                drainLength,
                                setDrainLength,
                                ip ? 10 : 3,
                                { step: "any", min: 0.1 }
                              )}
                            </div>
                          </div>
                        </ContextMenuTrigger>

                        <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={handleOpenEditModal}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/10 text-primary rounded-lg cursor-pointer font-semibold"
                          >
                            <Edit3 className="size-3.5 text-primary" />
                            <span>Edit Parameters Modal</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
                          </ContextMenuItem>

                          <ContextMenuItem
                            onClick={() => setFormulaModalOpen(true)}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent rounded-lg cursor-pointer font-medium"
                          >
                            <Info className="size-3.5 text-primary" />
                            <span>Formula Breakdown Guide</span>
                          </ContextMenuItem>

                          <ContextMenuItem
                            onClick={handleCalculate}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent rounded-lg cursor-pointer font-medium"
                          >
                            <Zap className="size-3.5 text-[#0A7BC7]" />
                            <span>Size Condensate Drain</span>
                          </ContextMenuItem>

                          <ContextMenuSeparator className="h-px bg-border my-1" />

                          <ContextMenuItem
                            onClick={handleResetDefaults}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent rounded-lg cursor-pointer font-medium"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset All Inputs to Defaults</span>
                          </ContextMenuItem>

                          <ContextMenuItem
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent rounded-lg cursor-pointer font-medium"
                          >
                            <FileSpreadsheet className="size-3.5 text-emerald-600" />
                            <span>Export Excel Document</span>
                          </ContextMenuItem>

                          <ContextMenuSeparator className="h-px bg-border my-1" />

                          <ContextMenuItem
                            onClick={() => handleOpenComment({ id: "condensate-inputs", name: "Condensate Sizing Inputs", type: "section" })}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 rounded-lg cursor-pointer font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment to Inputs</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      <button
                        type="button"
                        onClick={handleCalculate}
                        className="w-full bg-[#0A7BC7] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                      >
                        <Zap className="size-4 fill-white" />
                        <span>Size Condensate Drain</span>
                      </button>
                    </div>

                    {/* Right Results Card */}
                    <div className="lg:col-span-7 flex flex-col gap-5">
                      {!hasCalculated ? (
                        <div className="bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs">
                          <div className="size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none">
                            💧
                          </div>
                          <h4 className="text-xs font-bold text-foreground mb-1 uppercase tracking-wider">Ready to Size</h4>
                          <p className="text-[11.5px] text-muted-foreground max-w-xs leading-normal">
                            Enter the cooling parameters and drain run configuration to see pipe recommendations.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-5 animate-fade-in">
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                onDoubleClick={handleOpenEditModal}
                                className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs cursor-pointer transition-all hover:border-border/80"
                              >
                                <div className="flex items-center justify-between pb-2 border-b border-border/60 select-none">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                                      Sizing Results
                                    </h3>
                                  </div>
                                  <span className="text-[10.5px] text-muted-foreground italic">
                                    Tip: Double-click any row to edit parameters (Ventilation style)
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 font-sans text-xs">
                                  {renderResultRow("flow-rate", "Condensate Flow Rate", calculatedData.flowRateDisplay, 3)}
                                  {renderResultRow("pipe-size", "Recommended Pipe Size", calculatedData.pipeSize, 4, true)}
                                  {renderResultRow("minimum-slope", "Minimum Slope", calculatedData.minSlope, 5)}
                                  {renderResultRow("total-drop", "Total Drop Over Run", calculatedData.totalDrop, 5)}
                                </div>
                              </div>
                            </ContextMenuTrigger>

                            <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={handleOpenEditModal}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/10 text-primary rounded-lg cursor-pointer font-semibold"
                              >
                                <Edit3 className="size-3.5 text-primary" />
                                <span>Edit Parameters Modal</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
                              </ContextMenuItem>

                              <ContextMenuItem
                                onClick={() => setFormulaModalOpen(true)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent rounded-lg cursor-pointer font-medium"
                              >
                                <Info className="size-3.5 text-primary" />
                                <span>Formula Breakdown Guide</span>
                              </ContextMenuItem>

                              <ContextMenuSeparator className="h-px bg-border my-1" />

                              <ContextMenuItem
                                onClick={() => handleOpenComment({ id: "condensate-results", name: "Sizing Results Summary", type: "result-summary" })}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 rounded-lg cursor-pointer font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment to Results</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Calculation Report (Exact FM-200 / Standard Layout) */}
              {tab === "report" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-surface/30 custom-scrollbar">
                  <div className="max-w-4xl mx-auto flex flex-col gap-6">
                    <div className="border border-border rounded-3xl bg-background p-6 md:p-8 flex flex-col gap-6 shadow-sm">
                      {/* Report Header */}
                      <div className="flex justify-between items-start border-b border-border pb-4">
                        <div>
                          <h2 className="text-xl font-black uppercase tracking-wide text-foreground">
                            Condensate Drain Pipe Sizing Calculation Report
                          </h2>
                          <p className="text-[12px] text-muted-foreground mt-0.5">
                            IPC Section 307.2.2 &amp; ASHRAE Standard Gravity Condensate Drainage Analysis
                          </p>
                        </div>
                        <div className="flex items-center gap-2 no-print">
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-card hover:bg-accent text-foreground flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-[0.98]"
                            title="Print Sizing Calculation Report"
                          >
                            <Printer className="size-3.5 text-muted-foreground" />
                            <span>Print</span>
                          </button>
                          <button
                            type="button"
                            onClick={exportPdf}
                            className="px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-[0.98]"
                            title="Export PDF Report Document"
                          >
                            <FileText className="size-3.5" />
                            <span>Download PDF</span>
                          </button>
                        </div>
                      </div>

                      {/* Project Meta Info Grid (Matching Ventilation 6-Cell Structure) */}
                      <div className="grid grid-cols-2 md:grid-cols-6 border border-border divide-y md:divide-y-0 md:divide-x divide-border rounded-xl bg-card overflow-hidden text-xs">
                        <div className="p-3">
                          <span className="text-muted-foreground block text-[11px] font-medium">Calculation No.</span>
                          <strong className="text-foreground text-[12.5px] font-mono">{project?.calcNo || `TRV-CAL-CDS-${(activeProjectId || "0000").slice(-4).toUpperCase()}`}</strong>
                        </div>
                        <div className="p-3">
                          <span className="text-muted-foreground block text-[11px] font-medium">Date</span>
                          <strong className="text-foreground text-[12.5px]">{formatDateStr(new Date())}</strong>
                        </div>
                        <div className="p-3">
                          <span className="text-muted-foreground block text-[11px] font-medium">Project No.</span>
                          <strong className="text-foreground text-[12.5px] font-mono">{project?.code || project?.projectNo || "P000"}</strong>
                        </div>
                        <div className="p-3">
                          <span className="text-muted-foreground block text-[11px] font-medium">Client</span>
                          <strong className="text-foreground text-[12.5px]">{project?.client || "-"}</strong>
                        </div>
                        <div className="p-3">
                          <span className="text-muted-foreground block text-[11px] font-medium">Project Name</span>
                          <strong className="text-foreground text-[12.5px] truncate block">{project?.name || "MEP Project"}</strong>
                        </div>
                        <div className="p-3">
                          <span className="text-muted-foreground block text-[11px] font-medium">End User</span>
                          <strong className="text-foreground text-[12.5px] truncate block">{project?.endUser || project?.location || "-"}</strong>
                        </div>
                      </div>

                      {/* Table 1: Design Parameters & Hydraulic Input Data */}
                      <div className="space-y-2">
                        <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                          1. Design Parameters &amp; Input Sizing Criteria
                        </h3>
                        <table className="w-full text-[12px] border-collapse border border-border">
                          <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                            <tr>
                              <th className="border border-border p-2 text-center w-12">Sr. No.</th>
                              <th className="border border-border p-2 text-left">Design Parameter Description</th>
                              <th className="border border-border p-2 text-center w-36">Value</th>
                              <th className="border border-border p-2 text-center w-20">Unit</th>
                              <th className="border border-border p-2 text-left">Standard / Code Reference</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                              <td className="border border-border p-2 font-bold">Applied Sizing Methodology</td>
                              <td className="border border-border p-2 text-center font-bold">
                                {condMode === "tr" ? "From Cooling Capacity" : "From Latent Heat Load"}
                              </td>
                              <td className="border border-border p-2 text-center">-</td>
                              <td className="border border-border p-2 text-muted-foreground">Design Engineer Input Mode</td>
                            </tr>
                            <tr>
                              <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                              <td className="border border-border p-2 font-bold">
                                {condMode === "tr" ? "Cooling Capacity Rating" : "Latent Heat Load"}
                              </td>
                              <td className="border border-border p-2 text-center font-bold">
                                {condMode === "tr" ? `${trLoad} ${ip ? "TR" : "kW"}` : `${latentLoad} ${ip ? "BTU/hr" : "kW"}`}
                              </td>
                              <td className="border border-border p-2 text-center">{ip ? (condMode === "tr" ? "TR" : "BTU/hr") : "kW"}</td>
                              <td className="border border-border p-2 text-muted-foreground">Equipment Rating Schedule</td>
                            </tr>
                            <tr>
                              <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                              <td className="border border-border p-2 font-bold">Connected AC / FCU Units Quantity</td>
                              <td className="border border-border p-2 text-center font-bold">{unitsQty}</td>
                              <td className="border border-border p-2 text-center">Units</td>
                              <td className="border border-border p-2 text-muted-foreground">Total Connected Coils</td>
                            </tr>
                            <tr>
                              <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                              <td className="border border-border p-2 font-bold">Total Drain Run Piping Length</td>
                              <td className="border border-border p-2 text-center font-bold">{drainLength}</td>
                              <td className="border border-border p-2 text-center">{ip ? "ft" : "m"}</td>
                              <td className="border border-border p-2 text-muted-foreground">Layout Routing Length</td>
                            </tr>
                            <tr>
                              <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                              <td className="border border-border p-2 font-bold">Design Latent Ratio Assumption</td>
                              <td className="border border-border p-2 text-center font-bold">30.0%</td>
                              <td className="border border-border p-2 text-center">%</td>
                              <td className="border border-border p-2 text-muted-foreground">ASHRAE Standard Sensible/Latent Ratio</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Table 2: Condensate Load & Pipe Sizing Results */}
                      <div className="space-y-2">
                        <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                          2. Condensate Load &amp; Pipe Sizing Output Summary
                        </h3>
                        <table className="w-full text-[12px] border-collapse border border-border">
                          <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                            <tr>
                              <th className="border border-border p-2 text-center w-12">Item</th>
                              <th className="border border-border p-2 text-left">Sizing Output Description</th>
                              <th className="border border-border p-2 text-center w-36 bg-[#DAE9F8] dark:bg-sky-950/60">Calculated Result</th>
                              <th className="border border-border p-2 text-left">Governing Code / Engineering Basis</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-border p-2 text-center text-muted-foreground">A</td>
                              <td className="border border-border p-2 font-bold">Calculated Total Latent Cooling Load</td>
                              <td className="border border-border p-2 text-center font-mono font-bold text-foreground">
                                {Math.round(calculatedData.latBTU).toLocaleString()} BTU/hr
                              </td>
                              <td className="border border-border p-2 text-muted-foreground">Q_latent = TR × 12,000 × 0.30</td>
                            </tr>
                            <tr>
                              <td className="border border-border p-2 text-center text-muted-foreground">B</td>
                              <td className="border border-border p-2 font-bold">Condensate Generation per Single Unit</td>
                              <td className="border border-border p-2 text-center font-mono font-bold text-foreground">
                                {calculatedData.galPerHrSingle.toFixed(2)} GPH
                              </td>
                              <td className="border border-border p-2 text-muted-foreground">q = Q_latent / (1,075 × 8.34)</td>
                            </tr>
                            <tr>
                              <td className="border border-border p-2 text-center text-muted-foreground">C</td>
                              <td className="border border-border p-2 font-bold">Total Aggregate Condensate Flow Rate</td>
                              <td className="border border-border p-2 text-center font-mono font-bold text-foreground">
                                {calculatedData.flowRateDisplay}
                              </td>
                              <td className="border border-border p-2 text-muted-foreground">Q_total = q_single × Units Quantity</td>
                            </tr>
                            <tr className="bg-sky-50/80 dark:bg-sky-950/40">
                              <td className="border border-border p-2 text-center text-[#0A7BC7] font-bold">D</td>
                              <td className="border border-border p-2 font-bold text-[#0A7BC7]">RECOMMENDED DRAIN PIPE SIZE</td>
                              <td className="border border-border p-2 text-center font-mono font-extrabold text-[#0A7BC7] text-[13px] bg-[#DAE9F8] dark:bg-sky-900/60">
                                {calculatedData.pipeSize}
                              </td>
                              <td className="border border-border p-2 font-semibold text-[#0A7BC7]">IPC Table 307.2.2 Minimum Diameter</td>
                            </tr>
                            <tr>
                              <td className="border border-border p-2 text-center text-muted-foreground">E</td>
                              <td className="border border-border p-2 font-bold">Statutory Minimum Installation Slope</td>
                              <td className="border border-border p-2 text-center font-mono font-bold text-foreground">
                                {calculatedData.minSlope}
                              </td>
                              <td className="border border-border p-2 text-muted-foreground">IPC Section 307.2.1 Gravity Fall</td>
                            </tr>
                            <tr>
                              <td className="border border-border p-2 text-center text-muted-foreground">F</td>
                              <td className="border border-border p-2 font-bold">Total Vertical Fall / Drop Over Run</td>
                              <td className="border border-border p-2 text-center font-mono font-bold text-foreground">
                                {calculatedData.totalDrop}
                              </td>
                              <td className="border border-border p-2 text-muted-foreground">Total Drop = Run Length × Slope</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Table 3: IPC Table 307.2.2 Schedule */}
                      <div className="space-y-2">
                        <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                          3. IPC Table 307.2.2 Condensate Drain Sizing Schedule
                        </h3>
                        <table className="w-full text-[12px] border-collapse border border-border">
                          <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                            <tr>
                              <th className="border border-border p-2 text-center w-12">No.</th>
                              <th className="border border-border p-2 text-left">Equipment Capacity Bracket</th>
                              <th className="border border-border p-2 text-center w-36">Minimum Drain Pipe Size</th>
                              <th className="border border-border p-2 text-left">Installation Slope Criteria</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className={calculatedData.pipeSize.includes('3/4') ? "bg-sky-50 dark:bg-sky-950/40 font-bold" : ""}>
                              <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                              <td className="border border-border p-2">Cooling Equipment Capacity &lt; 20 Tons (Flow &lt; 5 GPH)</td>
                              <td className="border border-border p-2 text-center font-mono">3/4" (DN20 / 19mm)</td>
                              <td className="border border-border p-2 text-muted-foreground">1/8 in/ft (10.4 mm/m) Minimum Fall</td>
                            </tr>
                            <tr className={calculatedData.pipeSize.includes('1"') && !calculatedData.pipeSize.includes('1-') ? "bg-sky-50 dark:bg-sky-950/40 font-bold" : ""}>
                              <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                              <td className="border border-border p-2">Cooling Equipment Capacity 20 to 40 Tons (Flow 5–20 GPH)</td>
                              <td className="border border-border p-2 text-center font-mono">1" (DN25 / 25mm)</td>
                              <td className="border border-border p-2 text-muted-foreground">1/8 in/ft (10.4 mm/m) Minimum Fall</td>
                            </tr>
                            <tr className={calculatedData.pipeSize.includes('1-1/4') ? "bg-sky-50 dark:bg-sky-950/40 font-bold" : ""}>
                              <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                              <td className="border border-border p-2">Cooling Equipment Capacity 40 to 90 Tons (Flow 20–40 GPH)</td>
                              <td className="border border-border p-2 text-center font-mono">1-1/4" (DN32 / 32mm)</td>
                              <td className="border border-border p-2 text-muted-foreground">1/8 in/ft (10.4 mm/m) Minimum Fall</td>
                            </tr>
                            <tr className={calculatedData.pipeSize.includes('1-1/2') ? "bg-sky-50 dark:bg-sky-950/40 font-bold" : ""}>
                              <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                              <td className="border border-border p-2">Cooling Equipment Capacity 90 to 125 Tons (Flow &gt; 40 GPH)</td>
                              <td className="border border-border p-2 text-center font-mono">1-1/2" (DN40 / 38mm)</td>
                              <td className="border border-border p-2 text-muted-foreground">1/8 in/ft (10.4 mm/m) Minimum Fall</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Standard Notes & Engineering Basis */}
                      <div className="text-[12px] text-muted-foreground flex flex-col gap-2 p-4 bg-muted/20 border border-border/60 rounded-2xl">
                        <div className="font-bold text-foreground">Standard Notes &amp; Statutory Guidelines:</div>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>
                            Condensate drains must be trapped when connected to equipment under negative suction pressure to prevent air locks and water carryover.
                          </li>
                          <li>
                            Condensate waste pipes shall not connect directly to any drainage system without an approved indirect waste receptor with an air break.
                          </li>
                          <li>
                            A cleanout shall be installed at each change in direction greater than 45 degrees and at the start of each horizontal run.
                          </li>
                        </ul>
                      </div>

                      {/* 3-Tier Signature Sign-Off Block */}
                      {(() => {
                        const sig = getSignatureBlockDetails(project?.id || "default", "/condensate-drain", currentUserName);
                        return (
                          <div className="space-y-2 pt-2">
                            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                              4. Engineering Review &amp; Approval Sign-Off Block
                            </h3>
                            <table className="w-full text-[12px] border-collapse border border-border">
                              <thead className="bg-[#FFE6CC] dark:bg-amber-950/40 text-foreground font-bold">
                                <tr>
                                  <th className="border border-border p-2 text-center w-28"></th>
                                  <th className="border border-border p-2 text-center">Originator</th>
                                  <th className="border border-border p-2 text-center">Reviewer</th>
                                  <th className="border border-border p-2 text-center">Approver</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="border border-border p-2 font-bold text-right">Name:</td>
                                  <td className="border border-border p-2 text-center font-semibold">{sig.originatedName || "-"}</td>
                                  <td className="border border-border p-2 text-center font-semibold">{sig.reviewerName || "-"}</td>
                                  <td className="border border-border p-2 text-center font-semibold">{sig.approverName || "-"}</td>
                                </tr>
                                <tr>
                                  <td className="border border-border p-2 font-bold text-right">Date:</td>
                                  <td className="border border-border p-2 text-center font-mono">{sig.originatedDate || "-"}</td>
                                  <td className="border border-border p-2 text-center font-mono">{sig.reviewerDate || "-"}</td>
                                  <td className="border border-border p-2 text-center font-mono">{sig.approverDate || "-"}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Intelligence Drawer (Collapsible Right Side Panel matching Ventilation & FM-200) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <CondensateDrainIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calculatedData={calculatedData}
              condMode={condMode}
              setCondMode={setCondMode}
              trLoad={trLoad}
              setTrLoad={setTrLoad}
              latentLoad={latentLoad}
              setLatentLoad={setLatentLoad}
              unitsQty={unitsQty}
              setUnitsQty={setUnitsQty}
              drainLength={drainLength}
              setDrainLength={setDrainLength}
              ip={ip}
              unitSystem={unitSystem}
              isLocked={isLocked}
              setFormulaModalOpen={setFormulaModalOpen}
            />
          )}
        </div>
      </div>

      {/* Formula Breakdown Modal (Exact Sewage / Drainage Standard Format) */}
      {formulaModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <BookOpen className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">IPC & ASHRAE Condensate Drain Formula Breakdown</h3>
                  <p className="text-xs text-muted-foreground">Engineering mathematical equations for condensate load, flow rate & pipe diameter sizing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormulaModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5 text-xs text-foreground">
              {/* Equation 1 */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                <span className="font-bold text-primary uppercase tracking-wider text-[11px]">1. Latent Cooling Load (Q_latent)</span>
                <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border text-[13px]">
                  Q_latent = TR_load × 12,000 × 0.30  [BTU/hr]
                </div>
                <p className="text-muted-foreground text-[11.5px] leading-relaxed">
                  ASHRAE Fundamentals establishes a standard 30% latent ratio (0.30) for typical comfort cooling air conditioning systems in commercial and residential spaces.
                </p>
              </div>

              {/* Equation 2 */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                <span className="font-bold text-primary uppercase tracking-wider text-[11px]">2. Condensate Generation per Unit (q_single)</span>
                <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border text-[13px]">
                  q_single = Q_latent / (h_fg × ρ_water) = Q_latent / (1,075 × 8.34) = Q_latent / 8,965.5  [gal/hr]
                </div>
                <p className="text-muted-foreground text-[11.5px] leading-relaxed">
                  Calculated from the latent heat of vaporization of water (1,075 BTU/lb at typical coil dew point) and density of water (8.34 lb/gal).
                </p>
              </div>

              {/* Equation 3 */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                <span className="font-bold text-primary uppercase tracking-wider text-[11px]">3. Total Aggregate Condensate Flow Rate (Q_total)</span>
                <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border text-[13px]">
                  Q_total = q_single × Units_Quantity  [GPH or L/min]
                </div>
                <p className="text-muted-foreground text-[11.5px] leading-relaxed">
                  Aggregates multiple fan coil units (FCUs) or air handling units (AHUs) connected into the common drain header.
                </p>
              </div>

              {/* Equation 4 */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                <span className="font-bold text-primary uppercase tracking-wider text-[11px]">4. IPC 307.2.2 Condensate Drain Sizing Table</span>
                <div className="grid grid-cols-2 gap-2 text-center font-mono font-bold text-foreground">
                  <div className="p-2 bg-background rounded border border-border">Flow &lt; 5.0 GPH → 3/4" (19mm)</div>
                  <div className="p-2 bg-background rounded border border-border">Flow 5–20 GPH → 1" (25mm)</div>
                  <div className="p-2 bg-background rounded border border-border">Flow 20–40 GPH → 1-1/4" (32mm)</div>
                  <div className="p-2 bg-background rounded border border-border">Flow &gt; 40 GPH → 1-1/2" (38mm)</div>
                </div>
                <p className="text-muted-foreground text-[11.5px] leading-relaxed mt-2">
                  International Plumbing Code (IPC) Section 307.2 specifies minimum pipe internal diameters to prevent overflow, bio-film clogging, and air locks.
                </p>
              </div>

              {/* Equation 5 */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                <span className="font-bold text-primary uppercase tracking-wider text-[11px]">5. Minimum Slope & Elevation Drop</span>
                <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border text-[13px]">
                  Total_Drop = Run_Length × Minimum_Slope
                </div>
                <p className="text-muted-foreground text-[11.5px] leading-relaxed">
                  IPC requires a minimum slope of not less than 1% (1/8" per foot) for pipe sizes &gt; 1", and 2% (1/4" per foot) for pipe sizes ≤ 1".
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-card flex justify-end">
              <button
                type="button"
                onClick={() => setFormulaModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 cursor-pointer shadow-xs"
              >
                Close Formula Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Parameters Modal (Exact Ventilation & Preliminary Style) */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in text-foreground overflow-hidden">
            <header className="px-5 py-4 border-b border-border flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-[#0A7BC7]/10 text-[#0A7BC7] flex items-center justify-center font-bold">
                  <Sliders className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[15px] leading-tight">Edit Condensate Sizer Parameters</h3>
                  <p className="text-[11px] text-muted-foreground">Modify cooling capacity, unit count, and pipe run</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded-lg p-1.5 cursor-pointer transition-colors"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="p-5 flex flex-col gap-4 text-xs">
              {/* Sizing Mode Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-foreground">Sizing Method</label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 border border-border/60">
                  <button
                    type="button"
                    onClick={() => setEditModalForm(prev => ({ ...prev, condMode: "tr" }))}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      editModalForm.condMode === "tr"
                        ? "bg-white dark:bg-slate-900 text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    From Cooling capacity
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditModalForm(prev => ({ ...prev, condMode: "lat" }))}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      editModalForm.condMode === "lat"
                        ? "bg-white dark:bg-slate-900 text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    From Latent load
                  </button>
                </div>
              </div>

              {/* Load Input */}
              {editModalForm.condMode === "tr" ? (
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-foreground">Cooling Capacity ({ip ? "TR" : "kW"})</label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    value={editModalForm.trLoad}
                    onChange={(e) => setEditModalForm(prev => ({ ...prev, trLoad: Number(e.target.value) }))}
                    className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[#0A7BC7]"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-foreground">Latent Load ({ip ? "BTU/hr" : "kW"})</label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    value={editModalForm.latentLoad}
                    onChange={(e) => setEditModalForm(prev => ({ ...prev, latentLoad: Number(e.target.value) }))}
                    className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[#0A7BC7]"
                  />
                </div>
              )}

              {/* Units Quantity */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-foreground">Number of AC/FCU Units</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={editModalForm.unitsQty}
                  onChange={(e) => setEditModalForm(prev => ({ ...prev, unitsQty: Number(e.target.value) }))}
                  className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[#0A7BC7]"
                />
              </div>

              {/* Drain Length */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-foreground">Drain Length ({ip ? "ft" : "m"})</label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={editModalForm.drainLength}
                  onChange={(e) => setEditModalForm(prev => ({ ...prev, drainLength: Number(e.target.value) }))}
                  className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[#0A7BC7]"
                />
              </div>

              {/* Live Preview Box */}
              <div className="mt-1 bg-slate-50 dark:bg-slate-900/60 border border-border rounded-xl p-3 flex flex-col gap-2 select-none">
                <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px]">
                  <Sparkles className="size-3.5 text-[#0A7BC7]" />
                  <span>Instant Sizing Preview</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Flow Rate:</span>
                    <strong className="font-mono font-bold text-foreground">{modalPreviewData.flowRateDisplay}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pipe Size:</span>
                    <strong className="font-mono font-bold text-[#0A7BC7]">{modalPreviewData.pipeSize}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min Slope:</span>
                    <strong className="font-mono font-bold text-foreground">{modalPreviewData.minSlope}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Drop:</span>
                    <strong className="font-mono font-bold text-foreground">{modalPreviewData.totalDrop}</strong>
                  </div>
                </div>
              </div>
            </div>

            <footer className="px-5 py-3.5 border-t border-border flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-surface-3 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditModal}
                className="px-4 py-1.5 text-xs font-bold bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="size-3.5" />
                <span>Apply & Size Drain</span>
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Assign Comment & Task Modal (Exact Preliminary & Ventilation Logic) */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType={commentTargetItem.type || "Condensate Drain"}
          calculatorTitle="Condensate Drain Sizing"
          calculatorPath="/condensate-drain"
          existingComments={getMergedItemComments(
            commentTargetItem.id,
            commentTargetItem.name,
            commentsList,
            "/condensate-drain",
            activeProjectId || project?.id
          )}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}

function CondensateDrainIntelligenceDrawer({
  onClose,
  calculatedData,
  condMode,
  setCondMode,
  trLoad,
  setTrLoad,
  latentLoad,
  setLatentLoad,
  unitsQty,
  setUnitsQty,
  drainLength,
  setDrainLength,
  ip,
  unitSystem,
  isLocked,
  setFormulaModalOpen,
}: {
  onClose: () => void;
  calculatedData: any;
  condMode: CondMode;
  setCondMode: (mode: CondMode) => void;
  trLoad: number;
  setTrLoad: (val: number) => void;
  latentLoad: number;
  setLatentLoad: (val: number) => void;
  unitsQty: number;
  setUnitsQty: (val: number) => void;
  drainLength: number;
  setDrainLength: (val: number) => void;
  ip: boolean;
  unitSystem: "si" | "ip";
  isLocked: boolean;
  setFormulaModalOpen: (open: boolean) => void;
}) {
  const isHighFlow = (calculatedData.galPerHr || 0) >= 20;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4.5 text-primary" />
          <div>
            <h3 className="font-bold text-[13.5px] uppercase tracking-wider text-foreground">Live Intelligence</h3>
            <p className="text-[10.5px] text-muted-foreground font-medium">IPC 307.2.2 &amp; ASHRAE Sizing Engine</p>
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
        {/* 1. Code Compliance & Sizing Audit Card */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
              <Activity className="size-4 text-primary" />
              <span>IPC 307.2.2 Compliance Audit</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <Check className="size-3" /> IPC Verified
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {/* Sizing Status Banner */}
            <div className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1 ${
              isHighFlow
                ? "border-amber-500/20 bg-amber-500/5 text-foreground"
                : "border-emerald-500/20 bg-emerald-500/5 text-foreground"
            }`}>
              <div className="flex items-center justify-between font-semibold text-[11.5px]">
                <span>Selected Diameter</span>
                <span className="font-mono font-bold text-[#0A7BC7] text-[13px]">
                  {calculatedData.pipeSize}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {isHighFlow
                  ? 'High volume manifold run requires minimum 1-1/4" (32mm) pipe with 1/8" per ft (1.0%) pitch per IPC Table 307.2.2.'
                  : "Gravity drainage sizing meets IPC 307.2.2 criteria with full self-scouring velocity and anti-siphon protection."}
              </p>
            </div>

            {/* Total Flow Rate */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-surface-2/60 border border-border/60 text-[11.5px]">
              <span className="text-muted-foreground">Total Aggregate Flow:</span>
              <span className="font-mono font-bold text-foreground">
                {calculatedData.flowRateDisplay}
              </span>
            </div>

            {/* Minimum Slope Required */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-surface-2/60 border border-border/60 text-[11.5px]">
              <span className="text-muted-foreground">Minimum Slope Fall:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {calculatedData.minSlope}
              </span>
            </div>

            {/* Invert Elevation Drop */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-surface-2/60 border border-border/60 text-[11.5px]">
              <span className="text-muted-foreground">Total Invert Drop:</span>
              <span className="font-mono font-bold text-primary">
                {calculatedData.totalDrop} ({drainLength} {ip ? "ft" : "m"} run)
              </span>
            </div>
          </div>
        </div>

        {/* 2. Psychrometric & Load Analytics Card */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Droplets className="size-3.5 text-[#0A7BC7]" /> Psychrometric Load Breakdown
          </h4>

          <div className="space-y-2 text-xs">
            <div className="p-2 rounded-xl bg-surface-2/60 border border-border/60 flex justify-between items-center">
              <span className="text-muted-foreground text-[11.5px]">Single Unit Flow:</span>
              <span className="font-mono font-bold text-foreground">
                {calculatedData.galPerHrSingle.toFixed(2)} GPH {ip ? "" : `(${(calculatedData.galPerHrSingle * 0.063).toFixed(3)} L/min)`}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-surface-2/60 border border-border/60 flex justify-between items-center">
              <span className="text-muted-foreground text-[11.5px]">Total Latent Cooling:</span>
              <span className="font-mono font-bold text-foreground">
                {Math.round(calculatedData.latBTU).toLocaleString()} BTU/hr
              </span>
            </div>

            <div className="p-2 rounded-xl bg-surface-2/60 border border-border/60 flex justify-between items-center">
              <span className="text-muted-foreground text-[11.5px]">Connected AC Units:</span>
              <span className="font-mono font-bold text-primary">
                {unitsQty} Unit{unitsQty === 1 ? "" : "s"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-500/20 text-[11px] text-muted-foreground">
              <strong className="text-foreground">ASHRAE Standard Basis:</strong> Latent condensation rate is sized assuming 30.0% of total cooling enthalpy is latent moisture removal under peak summer design conditions.
            </div>
          </div>
        </div>

        {/* 3. Statutory Engineering Best Practices & Checklist */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Gauge className="size-3.5 text-primary" /> Mandatory Installation Standards
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2 p-2 rounded-xl bg-surface-2/60 border border-border/60">
              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">1</div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground text-[11.5px]">Trap Depth &amp; Static Pressure</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  For draw-through cooling coils, provide a P-trap depth equal to the unit static pressure + 1" (25mm) to prevent air-lock flooding.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2 rounded-xl bg-surface-2/60 border border-border/60">
              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">2</div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground text-[11.5px]">Indirect Waste Air Gap</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Condensate lines must discharge through a physical air gap of ≥ 1" (25mm) above floor drain/receptor rim to prevent sewer backflow.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2 rounded-xl bg-surface-2/60 border border-border/60">
              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">3</div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground text-[11.5px]">Thermal Insulation Requirement</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Insulate entire horizontal run with ≥ 1/2" (13mm) elastomeric closed-cell foam to prevent condensation dripping in unconditioned plenums.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2 rounded-xl bg-surface-2/60 border border-border/60">
              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">4</div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground text-[11.5px]">Cleanout Plugs &amp; Access</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Install a cleanout tee at every direction change &gt; 45° and at the head of every manifold run for periodic maintenance.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Quick Adjusters & Presets */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Quick AC Units Quantity</span>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 4, 8].map((qty) => (
              <button
                key={qty}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) return;
                  setUnitsQty(qty);
                  toast.success(`Set connected units to ${qty}`);
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  unitsQty === qty
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-surface-2 hover:bg-surface border-border/80 text-foreground"
                } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {qty} {qty === 1 ? "Unit" : "Units"}
              </button>
            ))}
          </div>
        </div>

        {/* Formula Breakdown Trigger */}
        <button
          type="button"
          onClick={() => setFormulaModalOpen(true)}
          className="w-full py-2.5 px-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-semibold rounded-xl text-[12px] flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
        >
          <BookOpen className="size-3.5" />
          View Full Equations Guide (IPC &amp; ASHRAE)
        </button>
      </div>
    </div>
  );
}
