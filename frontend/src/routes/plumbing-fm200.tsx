import { CalculationReviewBar, useCalculationLock } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, X, HelpCircle, MessageSquare, Flame, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw, Trash2, Edit3, Lock
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { VersionManager } from "@/components/workspace/VersionManager";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";

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

  const { project, isReadOnly } = useWorkspace();
  const isApprovedLocked = useCalculationLock("/plumbing-fm200", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const isEffectiveReadOnly = Boolean(isReadOnly || isApprovedLocked || isViewerRole);

  // Tabs & intelligence panel state
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);

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

  // Sync state with active project and handle VersionManager snapshots
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load saved FM-200 parameters on mount or project switch
  useEffect(() => {
    if (!project?.id) return;
    if (loadedProjectId === project.id) return;

    const pKey = `mep_fm200_params_${project.id}`;
    const stored = localStorage.getItem(pKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.area !== undefined) setArea(parsed.area);
        if (parsed.height !== undefined) setHeight(parsed.height);
        if (parsed.preset !== undefined) setPreset(parsed.preset);
        if (parsed.customConc !== undefined) setCustomConc(parsed.customConc);
        if (parsed.temp !== undefined) setTemp(parsed.temp);
        if (parsed.useStandardS !== undefined) setUseStandardS(parsed.useStandardS);
        if (parsed.safetyFactor !== undefined) setSafetyFactor(parsed.safetyFactor);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      } catch (e) {
        console.error("Failed to parse stored FM-200 params", e);
      }
    }
    setLoadedProjectId(project.id);
  }, [project?.id, loadedProjectId]);

  // Version History Restore Listener (Full parity with Ventilation & VersionManager)
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pId = project?.id || "default";
      const pKey = `mep_fm200_params_${pId}`;
      const lsCache = e?.detail?.localStorageCache;
      let restoredData: any = null;
      if (lsCache && lsCache[pKey]) {
        try {
          restoredData = typeof lsCache[pKey] === "string" ? JSON.parse(lsCache[pKey]) : lsCache[pKey];
        } catch (err) {}
      }
      if (!restoredData) {
        const stored = localStorage.getItem(pKey);
        if (stored) {
          try {
            restoredData = JSON.parse(stored);
          } catch (err) {}
        }
      }
      if (restoredData) {
        if (restoredData.area !== undefined) setArea(restoredData.area);
        if (restoredData.height !== undefined) setHeight(restoredData.height);
        if (restoredData.preset !== undefined) setPreset(restoredData.preset);
        if (restoredData.customConc !== undefined) setCustomConc(restoredData.customConc);
        if (restoredData.temp !== undefined) setTemp(restoredData.temp);
        if (restoredData.useStandardS !== undefined) setUseStandardS(restoredData.useStandardS);
        if (restoredData.safetyFactor !== undefined) setSafetyFactor(restoredData.safetyFactor);
        if (restoredData.unitSystem) setUnitSystem(restoredData.unitSystem);
        dirtyStore.set(false);
        toast.success("FM-200 calculation restored to selected version!");
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [project?.id]);

  // Auto-persist full calculator state for VersionManager snapshots and local storage
  useEffect(() => {
    if (!project?.id || loadedProjectId !== project.id) return;
    const dataToSave = {
      area,
      height,
      preset,
      customConc,
      temp,
      useStandardS,
      safetyFactor,
      unitSystem,
    };
    try {
      localStorage.setItem(`mep_fm200_params_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    } catch (e) {
      console.error("Failed to save FM-200 params", e);
    }
  }, [area, height, preset, customConc, temp, useStandardS, safetyFactor, unitSystem, project?.id, loadedProjectId]);

  // Comments and Task Assignment state
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  // Load comments from local storage on mount / project change
  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/plumbing-fm200`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCommentsList(parsed);
        }
      } else {
        setCommentsList([]);
      }
    } catch (e) {
      console.error("Failed to load comments", e);
    }
  }, [project?.id]);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/plumbing-fm200`, JSON.stringify(newList));
    // Immediately dispatch notification events for instantaneous UI and badge update (<1ms)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notif_tick"));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new CustomEvent("mep-notification-added"));
      window.dispatchEvent(new Event("storage"));
    }
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (comment: any) => {
    const commentWithMeta = {
      ...comment,
      targetId: commentTargetItem?.id,
      targetName: commentTargetItem?.name,
      targetType: "parameter",
      calculatorTitle: "FM-200 Gas Sizing",
      calculatorPath: "/plumbing-fm200",
      projectId: project?.id || "default",
      projectName: project?.name || "FM-200 Gas Sizing",
    };
    const updated = [commentWithMeta, ...commentsList.filter(c => c.id !== comment.id)];
    saveComments(updated);
    setCommentModalOpen(false);
  };

  const handleCopyValue = (label: string, value: any) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(String(value));
      toast.success(`Copied ${label}: ${value}`);
    }
  };

  const handlePasteValue = async (label: string, setter: (val: any) => void) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Editing is disabled.", { id: "readonly-notice" });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        const text = await navigator.clipboard.readText();
        const num = parseFloat(text);
        if (!isNaN(num)) {
          setter(num);
          toast.success(`Pasted into ${label}: ${num}`);
        } else if (text) {
          setter(text);
          toast.success(`Pasted into ${label}`);
        }
      } catch (e) {
        toast.error("Failed to read clipboard");
      }
    }
  };

  const handleResetValue = (label: string, setter: (val: any) => void, defaultVal: any) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Editing is disabled.", { id: "readonly-notice" });
      return;
    }
    setter(defaultVal);
    toast.info(`Reset ${label} to default (${defaultVal})`);
  };

  const handleClearValue = (label: string, setter: (val: any) => void) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Editing is disabled.", { id: "readonly-notice" });
      return;
    }
    setter("");
    toast.info(`Cleared ${label}`);
  };

  // Scroll and highlight notification target item (matching Preliminary Cooling Load)
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();

      const el = document.getElementById(targetId || "") ||
                 document.getElementById(`field-${targetId}`) ||
                 document.getElementById(`res-${targetId}`) ||
                 document.getElementById(`card-${targetId}`) ||
                 document.querySelector(`[data-item-id="${targetId}"]`) ||
                 document.querySelector(`[data-field-id="${targetId}"]`);

      if (el || cleanId) {
        setHighlightedTargetId(targetId || cleanId);

        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedTargetId(null);
          highlightTimeoutRef.current = null;
        }, 4000);

        if (el) {
          setTimeout(() => {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
        }
      }
    };

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("commentTargetId");
      const targetName = params.get("commentTargetName");
      if (targetId || targetName) {
        setTimeout(() => {
          handleScrollTarget(targetId || undefined, targetName || undefined);
        }, 300);
      }
    }

    const handleScrollEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        handleScrollTarget(detail.id, detail.name);
      }
    };

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    window.addEventListener("mep-data-grid-scroll", handleScrollEvent);

    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
      window.removeEventListener("mep-data-grid-scroll", handleScrollEvent);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const getItemComments = (id: string) => {
    return commentsList.filter(
      (c) => c.targetId === id || c.spaceId === id || c.itemId === id
    );
  };

  const renderCommentBadge = (id: string, name: string) => {
    const itemComments = getItemComments(id);
    if (itemComments.length === 0) return null;

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenComment(id, name);
        }}
        title={`${itemComments.length} comment(s)/task(s) on ${name}`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer shadow-2xs"
      >
        <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
        <span>{itemComments.length}</span>
      </button>
    );
  };

  // Synchronize design temperature default when unit system changes
  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean = true) => {
    if (targetUnit === unitSystem) return;
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Unit conversion is locked.", { id: "readonly-notice" });
      return;
    }
    setUnitSystem(targetUnit);
    if (shouldConvert) {
      if (targetUnit === "si") {
        // Convert from IP to SI
        setTemp((prev) => {
          if (prev === "") return 20;
          return Math.round((((Number(prev) - 32) * 5) / 9) * 10) / 10;
        });
        setArea((prev) => {
          if (prev === "") return "";
          return Math.round((Number(prev) / 10.7639) * 10) / 10 || 100;
        });
        setHeight((prev) => {
          if (prev === "") return "";
          return Math.round((Number(prev) / 3.28084) * 100) / 100 || 3;
        });
      } else {
        // Convert from SI to IP
        setTemp((prev) => {
          if (prev === "") return 68;
          return Math.round(((Number(prev) * 9) / 5 + 32) * 10) / 10;
        });
        setArea((prev) => {
          if (prev === "") return "";
          return Math.round(Number(prev) * 10.7639 * 10) / 10 || 1000;
        });
        setHeight((prev) => {
          if (prev === "") return "";
          return Math.round(Number(prev) * 3.28084 * 100) / 100 || 10;
        });
      }
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

  // Export to PDF handler (Exact formatting, color palette, and logic parity with Ventilation)
  const exportPdf = async () => {
    try {
      const isSI = unitSystem === "si";
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

      const calcNo = (project as any)?.calcNo || "TRV-CAL-FM200-01";
      const today = formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");
      const projectNo = project?.code || (project as any)?.projectNo || "P000";
      const projectName = project?.name || (project as any)?.projectName || "";
      const clientName = project?.client || "";
      const endUser = (project as any)?.endUser || (project as any)?.location || "";

      // Header Title (matching Ventilation)
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("FM-200 Clean Agent Suppression Sizing Report", 14, 14);

      // Metadata Block for Portrait Mode (182mm width: left 14mm to right 196mm)
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      doc.rect(14, 18, 182, 18); // Outer box for metadata

      // Vertical line to separate left/right metadata
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

      // Color palette matching Ventilation
      const primaryFill = [217, 217, 217] as [number, number, number]; // Gray for standard headers
      const blueFill = [218, 233, 248] as [number, number, number];    // Blue for key calculated totals

      const hazardLabelMap: Record<string, string> = {
        class_a: "Class A - Surface Fire (6.857%)",
        class_c: "Class C - Electrical Hazards (7.00%)",
        class_b: "Class B - Flammable Liquid (8.70%)",
        custom: `Custom Concentration (${calcResults.C.toFixed(2)}%)`
      };
      const hazardLabel = hazardLabelMap[preset] || preset.replace("_", " ").toUpperCase();

      // Table 1: Design Parameters & Enclosure Layout
      const inputTableBody = [
        ["1", "Protected Enclosure Floor Area", areaVal.toFixed(2), isSI ? "m²" : "ft²", "Architectural Layout"],
        ["2", "Protected Enclosure Clear Height", heightVal.toFixed(2), isSI ? "m" : "ft", "Architectural Section"],
        ["3", "Flooded Gross Enclosure Volume (V)", calcResults.volume.toFixed(2), isSI ? "m³" : "ft³", "V = Floor Area × Height"],
        ["4", "Hazard Classification", hazardLabel, "-", "NFPA 2001 Chapter 5"],
        ["5", "Minimum Design Concentration (C)", `${calcResults.C.toFixed(3)} %`, "%", "NFPA 2001 Table 5.4.2"],
        ["6", "Minimum Enclosure Design Temperature (T)", `${typeof temp === "number" ? temp.toFixed(1) : "20.0"} ${isSI ? "°C" : "°F"}`, isSI ? "°C" : "°F", "Project Environmental Data"],
        ["7", "Specific Vapor Volume (S)", `${calcResults.S.toFixed(4)} ${isSI ? "m³/kg" : "ft³/lb"}`, isSI ? "m³/kg" : "ft³/lb", useStandardS ? "Standard Default (0.1473 m³/kg)" : "S = k1 + k2 × T"],
        ["8", "Safety Margin Factor", `${safetyFactorVal.toFixed(2)}x`, "-", safetyFactorVal > 1.0 ? "NFPA Recommended Margin" : "Standard Base Sizing"]
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
          cellPadding: { top: 2.2, bottom: 2.2, left: 1.2, right: 1.2 },
          minCellHeight: 6
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 }
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 68, fontStyle: "bold" },
          2: { cellWidth: 38, fontStyle: "bold" },
          3: { cellWidth: 20 },
          4: { halign: "left", cellWidth: 46 }
        },
        head: [
          [
            { content: "No.", styles: { fillColor: primaryFill } },
            { content: "Design Parameter Description", styles: { fillColor: primaryFill } },
            { content: "Value", styles: { fillColor: primaryFill } },
            { content: "Unit", styles: { fillColor: primaryFill } },
            { content: "Standard / Code Reference", styles: { fillColor: primaryFill } }
          ]
        ],
        body: inputTableBody
      });

      let nextY = (doc as any).lastAutoTable?.finalY ?? 110;

      // Table 2: NFPA 2001 Sizing Results & Agent Weight
      const resultsTableBody = [
        ["A", "Total Flooding Net Enclosure Volume", `${calcResults.volume.toFixed(2)} ${isSI ? "m³" : "ft³"}`, "V = Area × Height"],
        ["B", "Specific Vapor Volume of Superheated FM-200 (S)", `${calcResults.S.toFixed(4)} ${isSI ? "m³/kg" : "ft³/lb"}`, isSI ? "k1 = 0.1269, k2 = 0.000513" : "k1 = 1.885, k2 = 0.0046"],
        ["C", "Volumetric Expansion Term [ C / (100 - C) ]", (calcResults.C / (100 - calcResults.C)).toFixed(5), "NFPA 2001 Equation 5.5.1"],
        ["D", "Safety Margin Multiplier Applied", `${safetyFactorVal.toFixed(2)}x`, "Engineering Safety Factor"],
        [
          "E",
          "REQUIRED FM-200 AGENT NET WEIGHT (W)",
          `${calcResults.weight.toFixed(2)} ${isSI ? "kg" : "lb"}`,
          "W = (V / S) × [ C / (100 - C) ] × Safety Factor"
        ],
        ["F", "Maximum Targeted Discharge Duration", "10.0 Seconds", "NFPA 2001 Clause 5.7.1.2"],
        ["G", "Minimum Enclosure Hold / Retention Time", "10.0 Minutes", "Door Fan Integrity Test Requirement"],
        [
          "H",
          "Occupational Safety Status",
          calcResults.C <= 9.0 ? "COMPLIANT (Below 9.0% NOAEL limit for occupied spaces)" : "WARNING: Concentration exceeds NOAEL threshold",
          "NFPA 2001 Toxicity Evaluation"
        ]
      ];

      callAutoTable(doc, {
        startY: nextY + 6,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.2, bottom: 2.2, left: 1.2, right: 1.2 },
          minCellHeight: 6
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold"
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 74, fontStyle: "bold" },
          2: { cellWidth: 46, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 52 }
        },
        head: [
          [
            { content: "Item", styles: { fillColor: primaryFill } },
            { content: "Sizing Output Summary (NFPA 2001)", styles: { fillColor: primaryFill } },
            { content: "Calculated Result", styles: { fillColor: blueFill } },
            { content: "Engineering Basis & Notes", styles: { fillColor: primaryFill } }
          ]
        ],
        body: resultsTableBody,
        didParseCell: function (data: any) {
          if (data.section === "body") {
            // Highlight row E (Required FM-200 Agent Weight) in blueFill
            if (data.row.index === 4) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = blueFill;
              if (data.column.index === 2) {
                data.cell.styles.fontSize = 8.5;
              }
            }
          }
        }
      });

      nextY = (doc as any).lastAutoTable?.finalY ?? 170;

      // Table 3: System Design Guidelines & Compliance Notes
      const notesTableBody = [
        ["1", "Door Fan Integrity Test", "Room integrity fan pressurization testing per NFPA 2001 Annex C must be conducted to certify minimum 10-minute agent retention holding time."],
        ["2", "Rapid Discharge Target", "System discharge must be completed within 10 seconds to rapidly extinguish flames and prevent thermal decomposition into Hydrogen Fluoride (HF)."],
        ["3", "Pressure Relief Damper", "Enclosure must be evaluated for positive/negative pressure spikes during discharge and fitted with a pressure relief vent if required."],
        ["4", "Safety & Life Protection", "Pre-discharge audio/visual alarms with minimum 30-second delay and manual abort stations must be provided at all enclosure exits."]
      ];

      callAutoTable(doc, {
        startY: nextY + 5,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7,
          halign: "left",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 }
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold"
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { cellWidth: 46, fontStyle: "bold" },
          2: { cellWidth: 126 }
        },
        head: [
          [
            { content: "No.", styles: { fillColor: primaryFill, halign: "center" } },
            { content: "Mandatory NFPA Guideline", styles: { fillColor: primaryFill } },
            { content: "Compliance & Commissioning Requirement", styles: { fillColor: primaryFill } }
          ]
        ],
        body: notesTableBody
      });

      const finalY = (doc as any).lastAutoTable?.finalY ?? 215;

      // 3-Tier Signature Block (Originated by, Reviewed by, Approved by)
      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate
      } = getSignatureBlockDetails(project?.id || "default", "/plumbing-fm200", currentUserName);

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
          fillColor: [255, 230, 204],
          textColor: 0,
          fontStyle: "bold"
        },
        head: [
          [
            { content: "" },
            { content: "Originated by" },
            { content: "Reviewed by" },
            { content: "Approved by" }
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
      await downloadFile(new Uint8Array(pdfBuffer), `FM200_Sizing_Report_${project?.code || "PROJ"}.pdf`, "PDF Document", ["pdf"]);
      toast.success("FM-200 PDF report exported successfully!");
    } catch (err: any) {
      console.error("exportPdf error:", err);
      toast.error(`Export PDF failed: ${err?.message || String(err)}`);
    }
  };

  return (
    <AppShell
      title="FM-200 Calculation"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
      intelLabel="Intelligence"
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">FIRE FIGHTING &gt; FM-200 CLEAN AGENT SIZER</span>
              <div className="flex items-center justify-between gap-3 mt-0.5 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-baseline gap-2">
                    <h1 className="text-[28px] font-bold tracking-tight text-foreground">FM-200 Gas Sizing</h1>
                    <span className="text-[15px] font-semibold text-muted-foreground">Total flooding clean agent sizer (NFPA 2001)</span>
                  </div>
                  <button 
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
                  <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-fm200" calculatorTitle="FM-200 Gas Sizing" />
                  {commentsList.length > 0 && (
                    <div 
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20 shadow-2xs"
                      title={`${commentsList.length} active comment(s)/task(s) in FM-200 calculation`}
                    >
                      <MessageSquare className="size-3.5 fill-blue-500/20" />
                      <span>{commentsList.length} Active Task{commentsList.length === 1 ? "" : "s"} / Comment{commentsList.length === 1 ? "" : "s"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-3xl transition-all duration-300 ${
            isApprovedLocked
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80">
              <div className="flex items-center gap-2">
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

                <button
                  type="button"
                  onClick={() => setFormulaModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 shadow-2xs"
                  title="View NFPA 2001 Formula Breakdown"
                >
                  <Info className="size-3.5 text-primary" />
                  <span>Formula Breakdown</span>
                </button>
              </div>

              {/* Sizing Unit system toggle */}
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitSystemChange}
                disabled={isEffectiveReadOnly}
                inputDescriptions="Floor Area, Enclosure Height, Minimum Temperature"
                conversionExample={
                  unitSystem === "si"
                    ? "Convert 100 m² → 1,076.4 ft², 3 m → 9.84 ft, 20°C → 68°F"
                    : "Convert 1,000 ft² → 92.9 m², 10 ft → 3.05 m, 68°F → 20°C"
                }
              />
            </div>
        {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
                    {/* Inputs & Parameters Section */}
                    <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-6 w-full">

                      {/* Room Enclosure Dimensions Card */}
                      <div className="border border-border rounded-3xl bg-background shadow-xs overflow-hidden">
                        <div className="bg-surface px-5 py-3 border-b border-border flex items-center justify-between">
                          <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-foreground">Enclosure Layout</h3>
                          <span className="text-[11px] font-mono text-muted-foreground">Dimensions</span>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div 
                                id="fm200-area"
                                data-item-id="fm200-area"
                                data-field-id="fm200-area"
                                className={`flex flex-col gap-1.5 p-3 rounded-2xl transition-all cursor-context-menu hover:bg-surface-2/40 border border-transparent hover:border-border/60 ${
                                  highlightedTargetId === "fm200-area" ? "ring-2 ring-primary bg-primary/10 animate-pulse" : ""
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground cursor-context-menu">
                                    Floor Area ({unitSystem === "si" ? "m²" : "ft²"})
                                  </label>
                                  {renderCommentBadge("fm200-area", `Floor Area (${unitSystem === "si" ? "m²" : "ft²"})`)}
                                </div>
                                <input
                                  type="number"
                                  disabled={isEffectiveReadOnly}
                                  value={area}
                                  onChange={(e) => setArea(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                                  className="h-10 rounded-xl border border-border px-3 text-[13px] bg-background text-foreground focus:border-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                                  placeholder="e.g. 100"
                                  step="any"
                                />
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue(`Floor Area (${unitSystem === "si" ? "m²" : "ft²"})`, area)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Area</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handlePasteValue(`Floor Area`, setArea)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handleResetValue(`Floor Area`, setArea, unitSystem === "si" ? 100 : 1076.4)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default ({unitSystem === "si" ? "100 m²" : "1,076.4 ft²"})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handleClearValue(`Floor Area`, setArea)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Clear Field</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("fm200-area", `Floor Area (${unitSystem === "si" ? "m²" : "ft²"})`)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div 
                                id="fm200-height"
                                data-item-id="fm200-height"
                                data-field-id="fm200-height"
                                className={`flex flex-col gap-1.5 p-3 rounded-2xl transition-all cursor-context-menu hover:bg-surface-2/40 border border-transparent hover:border-border/60 ${
                                  highlightedTargetId === "fm200-height" ? "ring-2 ring-primary bg-primary/10 animate-pulse" : ""
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground cursor-context-menu">
                                    Enclosure Height ({unitSystem === "si" ? "m" : "ft"})
                                  </label>
                                  {renderCommentBadge("fm200-height", `Enclosure Height (${unitSystem === "si" ? "m" : "ft"})`)}
                                </div>
                                <input
                                  type="number"
                                  disabled={isEffectiveReadOnly}
                                  value={height}
                                  onChange={(e) => setHeight(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                                  className="h-10 rounded-xl border border-border px-3 text-[13px] bg-background text-foreground focus:border-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                                  placeholder="e.g. 3"
                                  step="any"
                                />
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue(`Enclosure Height (${unitSystem === "si" ? "m" : "ft"})`, height)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Height</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handlePasteValue(`Enclosure Height`, setHeight)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handleResetValue(`Enclosure Height`, setHeight, unitSystem === "si" ? 3 : 9.84)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default ({unitSystem === "si" ? "3 m" : "9.84 ft"})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handleClearValue(`Enclosure Height`, setHeight)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Clear Field</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("fm200-height", `Enclosure Height (${unitSystem === "si" ? "m" : "ft"})`)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      </div>

                      {/* NFPA 2001 Design Presets Card */}
                      <div className="border border-border rounded-3xl bg-background shadow-xs overflow-hidden">
                        <div className="bg-surface px-5 py-3 border-b border-border flex items-center justify-between">
                          <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-foreground">Design Parameters</h3>
                          <span className="text-[11px] font-mono text-muted-foreground">NFPA 2001 Standard</span>
                        </div>
                        <div className="p-5 flex flex-col gap-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {/* Presets */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div 
                                  id="fm200-preset"
                                  data-item-id="fm200-preset"
                                  data-field-id="fm200-preset"
                                  className={`flex flex-col gap-1.5 p-3 rounded-2xl transition-all cursor-context-menu hover:bg-surface-2/40 border border-transparent hover:border-border/60 ${
                                    highlightedTargetId === "fm200-preset" ? "ring-2 ring-primary bg-primary/10 animate-pulse" : ""
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground cursor-context-menu">
                                      Hazard Classification
                                    </label>
                                    {renderCommentBadge("fm200-preset", "Hazard Classification")}
                                  </div>
                                  <select
                                    disabled={isEffectiveReadOnly}
                                    value={preset}
                                    onChange={(e) => setPreset(e.target.value as PresetOption)}
                                    className="h-10 rounded-xl border border-border px-3 text-[13px] bg-background text-foreground focus:border-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                                  >
                                    <option value="class_a">Class A - Surface Fire (6.857%)</option>
                                    <option value="class_c">Class C - Electrical Hazards (7.00%)</option>
                                    <option value="class_b">Class B - Flammable Liquid (8.70%)</option>
                                    <option value="custom">Custom Concentration %</option>
                                  </select>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Hazard Classification", preset.toUpperCase())}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Hazard Class</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => {
                                    if (isEffectiveReadOnly) return;
                                    setPreset("class_a");
                                  }}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                >
                                  <span>Set Class A (6.86%)</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => {
                                    if (isEffectiveReadOnly) return;
                                    setPreset("class_c");
                                  }}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                >
                                  <span>Set Class C (7.00%)</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => {
                                    if (isEffectiveReadOnly) return;
                                    setPreset("class_b");
                                  }}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                >
                                  <span>Set Class B (8.70%)</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("fm200-preset", "Hazard Classification")}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            {/* Custom Concentration (if custom) */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div 
                                  id="fm200-concentration"
                                  data-item-id="fm200-concentration"
                                  data-field-id="fm200-concentration"
                                  className={`flex flex-col gap-1.5 p-3 rounded-2xl transition-all cursor-context-menu hover:bg-surface-2/40 border border-transparent hover:border-border/60 ${
                                    highlightedTargetId === "fm200-concentration" ? "ring-2 ring-primary bg-primary/10 animate-pulse" : ""
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground cursor-context-menu">
                                      Design Concentration (C %)
                                    </label>
                                    {renderCommentBadge("fm200-concentration", "Design Concentration")}
                                  </div>
                                  <input
                                    type="number"
                                    disabled={isEffectiveReadOnly || preset !== "custom"}
                                    value={preset === "custom" ? customConc : calcResults.C}
                                    onChange={(e) => setCustomConc(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                                    className="h-10 rounded-xl border border-border px-3 text-[13px] bg-background text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2 disabled:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                                    placeholder="e.g. 7.0"
                                    step="0.01"
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Design Concentration", `${calcResults.C}%`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Concentration</span>
                                  <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                                </ContextMenuItem>
                                {preset === "custom" && (
                                  <>
                                    <ContextMenuItem
                                      disabled={isEffectiveReadOnly}
                                      onClick={() => handlePasteValue(`Design Concentration`, setCustomConc)}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                    >
                                      <Clipboard className="size-3.5 text-muted-foreground" />
                                      <span>Paste Value</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuSeparator className="h-px bg-border my-1" />
                                    <ContextMenuItem
                                      disabled={isEffectiveReadOnly}
                                      onClick={() => handleResetValue(`Design Concentration`, setCustomConc, 7.0)}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                    >
                                      <RotateCcw className="size-3.5 text-muted-foreground" />
                                      <span>Reset to 7.0%</span>
                                    </ContextMenuItem>
                                  </>
                                )}
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("fm200-concentration", "Design Concentration")}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-border pt-4">
                            {/* Minimum Temperature */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div 
                                  id="fm200-temperature"
                                  data-item-id="fm200-temperature"
                                  data-field-id="fm200-temperature"
                                  className={`flex flex-col gap-1.5 p-3 rounded-2xl transition-all cursor-context-menu hover:bg-surface-2/40 border border-transparent hover:border-border/60 ${
                                    highlightedTargetId === "fm200-temperature" ? "ring-2 ring-primary bg-primary/10 animate-pulse" : ""
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground cursor-context-menu">
                                      Minimum Temperature ({unitSystem === "si" ? "°C" : "°F"})
                                    </label>
                                    {renderCommentBadge("fm200-temperature", `Minimum Temperature (${unitSystem === "si" ? "°C" : "°F"})`)}
                                  </div>
                                  <input
                                    type="number"
                                    disabled={isEffectiveReadOnly}
                                    value={temp}
                                    onChange={(e) => setTemp(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                                    className="h-10 rounded-xl border border-border px-3 text-[13px] bg-background text-foreground focus:border-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                                    placeholder="e.g. 20"
                                    step="any"
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue(`Minimum Temperature (${unitSystem === "si" ? "°C" : "°F"})`, temp)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Temperature</span>
                                  <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => handlePasteValue(`Minimum Temperature`, setTemp)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                >
                                  <Clipboard className="size-3.5 text-muted-foreground" />
                                  <span>Paste Value</span>
                                  <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => handleResetValue(`Minimum Temperature`, setTemp, unitSystem === "si" ? 20 : 68)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                >
                                  <RotateCcw className="size-3.5 text-muted-foreground" />
                                  <span>Reset to Default ({unitSystem === "si" ? "20°C" : "68°F"})</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => handleClearValue(`Minimum Temperature`, setTemp)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                >
                                  <Trash2 className="size-3.5" />
                                  <span>Clear Field</span>
                                  <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("fm200-temperature", `Minimum Temperature (${unitSystem === "si" ? "°C" : "°F"})`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            {/* Safety Factor */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div 
                                  id="fm200-safety-factor"
                                  data-item-id="fm200-safety-factor"
                                  data-field-id="fm200-safety-factor"
                                  className={`flex flex-col gap-1.5 p-3 rounded-2xl transition-all cursor-context-menu hover:bg-surface-2/40 border border-transparent hover:border-border/60 ${
                                    highlightedTargetId === "fm200-safety-factor" ? "ring-2 ring-primary bg-primary/10 animate-pulse" : ""
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground cursor-context-menu">
                                      Safety Factor Multiplier
                                    </label>
                                    {renderCommentBadge("fm200-safety-factor", "Safety Factor Multiplier")}
                                  </div>
                                  <input
                                    type="number"
                                    disabled={isEffectiveReadOnly}
                                    value={safetyFactor}
                                    onChange={(e) => setSafetyFactor(e.target.value === "" ? "" : parseFloat(e.target.value) || 1.0)}
                                    className="h-10 rounded-xl border border-border px-3 text-[13px] bg-background text-foreground focus:border-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                                    placeholder="e.g. 1.0"
                                    step="0.05"
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Safety Factor Multiplier", `${safetyFactorVal}x`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Safety Factor</span>
                                  <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => handlePasteValue(`Safety Factor Multiplier`, setSafetyFactor)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                >
                                  <Clipboard className="size-3.5 text-muted-foreground" />
                                  <span>Paste Value</span>
                                  <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => handleResetValue(`Safety Factor Multiplier`, setSafetyFactor, 1.0)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                >
                                  <RotateCcw className="size-3.5 text-muted-foreground" />
                                  <span>Reset to Default (1.00x)</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => {
                                    if (isEffectiveReadOnly) return;
                                    setSafetyFactor(1.15);
                                  }}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                >
                                  <span>Set 1.15x (+15% Margin)</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("fm200-safety-factor", "Safety Factor Multiplier")}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </div>

                          {/* Specific Volume Switcher */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div 
                                id="fm200-lock-s"
                                data-item-id="fm200-lock-s"
                                data-field-id="fm200-lock-s"
                                className={`flex items-center justify-between border-t border-border pt-4 p-3 rounded-2xl transition-all cursor-context-menu hover:bg-surface-2/40 border border-transparent hover:border-border/60 ${
                                  highlightedTargetId === "fm200-lock-s" ? "ring-2 ring-primary bg-primary/10 animate-pulse" : ""
                                }`}
                              >
                                <div className="flex flex-col cursor-context-menu">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-semibold text-foreground">Lock S Value to Standard Default</span>
                                    {renderCommentBadge("fm200-lock-s", "Specific Volume S Standard")}
                                  </div>
                                  <span className="text-[11.5px] text-muted-foreground mt-0.5">
                                    Forces S to {unitSystem === "si" ? "0.1473 m³/kg" : "2.3595 ft³/lb"} (Baseline reference temperature)
                                  </span>
                                </div>
                                <input
                                  type="checkbox"
                                  disabled={isEffectiveReadOnly}
                                  checked={useStandardS}
                                  onChange={(e) => setUseStandardS(e.target.checked)}
                                  className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  if (isEffectiveReadOnly) return;
                                  setUseStandardS(!useStandardS);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <span>Toggle Lock S ({useStandardS ? "Unlock" : "Lock"})</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("fm200-lock-s", "Specific Volume S Standard")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Calculation Results & Sizing Schematics */}
                    <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-5 bg-surface/30 p-5 rounded-3xl border border-border shadow-2xs">
                      <div>
                        <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">Calculation Results</h3>
                        <p className="text-[11.5px] text-muted-foreground">Flooding weight outputs (NFPA 2001)</p>
                      </div>

                      <div className="flex flex-col gap-4">
                        {/* Enclosure Volume result card */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div 
                              id="fm200-volume"
                              data-item-id="fm200-volume"
                              data-field-id="fm200-volume"
                              className={`border border-border rounded-3xl bg-background p-4 flex flex-col gap-1 shadow-sm transition-all cursor-context-menu hover:border-primary/50 ${
                                highlightedTargetId === "fm200-volume" ? "ring-2 ring-primary bg-primary/10 animate-pulse" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-context-menu">Flooded Enclosure Volume</span>
                                {renderCommentBadge("fm200-volume", "Flooded Enclosure Volume")}
                              </div>
                              <div className="text-[22px] font-bold tracking-tight font-mono text-primary">
                                {calcResults.volume.toFixed(2)} <span className="text-[13.5px] font-normal">{unitSystem === "si" ? "m³" : "ft³"}</span>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Flooded Enclosure Volume", `${calcResults.volume.toFixed(2)} ${unitSystem === "si" ? "m³" : "ft³"}`)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Enclosure Volume</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleOpenComment("fm200-volume", "Flooded Enclosure Volume")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Required Gas Weight result card */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div 
                              id="fm200-weight"
                              data-item-id="fm200-weight"
                              data-field-id="fm200-weight"
                              className={`border border-border rounded-3xl bg-background p-4 flex flex-col gap-1 shadow-sm border-l-4 border-l-primary transition-all cursor-context-menu hover:border-primary/60 ${
                                highlightedTargetId === "fm200-weight" ? "ring-2 ring-primary bg-primary/10 animate-pulse" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-context-menu">Required FM-200 Agent Weight</span>
                                <div className="flex items-center gap-1">
                                  {renderCommentBadge("fm200-weight", "Required FM-200 Agent Weight")}
                                  <button
                                    type="button"
                                    onClick={() => setFormulaModalOpen(true)}
                                    className="size-5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors cursor-pointer"
                                    title="View Formula Breakdown (NFPA 2001)"
                                  >
                                    <Info className="size-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="text-[26px] font-bold tracking-tight font-mono text-primary">
                                {calcResults.weight.toFixed(2)} <span className="text-[15px] font-normal">{unitSystem === "si" ? "kg" : "lb"}</span>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[11px] text-muted-foreground">Design Concentration: {calcResults.C.toFixed(2)}%</span>
                                <button
                                  type="button"
                                  onClick={() => setFormulaModalOpen(true)}
                                  className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Breakdown</span>
                                  <Info className="size-2.5" />
                                </button>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Required FM-200 Weight", `${calcResults.weight.toFixed(2)} ${unitSystem === "si" ? "kg" : "lb"}`)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Required Weight</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => setFormulaModalOpen(true)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Info className="size-3.5 text-primary" />
                              <span>View NFPA 2001 Formula Breakdown</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleOpenComment("fm200-weight", "Required FM-200 Agent Weight")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

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
                        <div className="border border-border rounded-3xl bg-background p-4 shadow-sm flex flex-col gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Agent Sizing Chart</span>
                          <div className="bg-surface/50 rounded-2xl flex justify-center py-3 border border-border/50">
                            <svg viewBox="0 0 240 160" className="w-full max-w-[280px] h-auto overflow-visible">
                              {/* Room Enclosure Box */}
                              <rect x="20" y="20" width="200" height="95" rx="12" fill="none" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="3 3" />
                              
                              {/* Gas flooding overlay */}
                              <rect 
                                x="21" 
                                y="21" 
                                width="198" 
                                height="93" 
                                rx="11" 
                                fill="#0A7BC7" 
                                fillOpacity={calcResults.weight > 0 ? 0.15 : 0.02} 
                              />
                              
                              {/* Nozzles and system representation */}
                              <circle cx="75" cy="20" r="3" fill="#ef4444" />
                              <circle cx="165" cy="20" r="3" fill="#ef4444" />
                              <line x1="75" y1="20" x2="75" y2="35" stroke="#ef4444" strokeWidth="1.5" />
                              <line x1="165" y1="20" x2="165" y2="35" stroke="#ef4444" strokeWidth="1.5" />
                              
                              {/* Gas spray arcs */}
                              <path d="M 70 38 Q 75 33 80 38" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.8" />
                              <path d="M 67 41 Q 75 31 83 41" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.6" />
                              <path d="M 160 38 Q 165 33 170 38" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.8" />
                              <path d="M 157 41 Q 165 31 173 41" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.6" />

                              {/* Center Room Label */}
                              <text x="120" y="68" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#334155">
                                {calcResults.volume.toFixed(1)} {unitSystem === "si" ? "m³" : "ft³"}
                              </text>
                              
                              {/* Specific Volume and Agent label */}
                              <text x="120" y="85" textAnchor="middle" fontSize="9.5" fill="#64748B">
                                FM-200 Flooding Room
                              </text>

                              {/* Weight Tag at bottom */}
                              <rect x="55" y="126" width="130" height="24" rx="12" fill="#ef4444" fillOpacity="0.1" stroke="#ef4444" strokeWidth="1" />
                              <text x="120" y="142" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#ef4444">
                                Weight: {calcResults.weight.toFixed(1)} {unitSystem === "si" ? "kg" : "lb"}
                              </text>
                            </svg>
                          </div>
                        </div>

                        {/* Export PDF Button */}
                        <div>
                          <button
                            onClick={exportPdf}
                            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-2xl bg-primary text-primary-foreground text-[13px] font-bold hover:bg-primary/90 transition-all cursor-pointer shadow-xs hover:shadow-md active:scale-[0.99]"
                          >
                            <FileText className="size-4" />
                            <span>Export PDF Report</span>
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
                <div className="max-w-5xl mx-auto flex flex-col gap-6">
                  <div className="border border-border rounded-3xl bg-background p-6 flex flex-col gap-5 shadow-sm">
                    <div className="flex justify-between items-start border-b border-border pb-4">
                      <div>
                        <h2 className="text-[16px] font-bold text-foreground">Clean Agent Design Sizing Sheet</h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5">Calculated parameters for room fire flooding protection</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={exportPdf}
                          className="inline-flex items-center gap-1.5 h-8 px-4 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/95 transition-colors cursor-pointer shadow-sm"
                        >
                          <Printer className="size-3.5" /> Export PDF Report
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px] border-b border-border pb-5">
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-muted-foreground">Project Name</span>
                        <span className="font-semibold text-foreground">{project?.name || "Default Project"}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-muted-foreground">Project Code</span>
                        <span className="font-semibold font-mono text-foreground">{project?.code || "PROJ"}</span>
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

        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <FM200IntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calcResults={calcResults}
              preset={preset}
              setPreset={setPreset}
              isEffectiveReadOnly={isEffectiveReadOnly}
              safetyFactorVal={safetyFactorVal}
              unitSystem={unitSystem}
              setFormulaModalOpen={setFormulaModalOpen}
            />
          )}
        </div>
      </div>

      {/* NFPA 2001 Formula Breakdown Modal */}
      {formulaModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans animate-in fade-in duration-150"
          onClick={() => setFormulaModalOpen(false)}
        >
          <div 
            className="bg-card border border-border rounded-3xl w-full max-w-lg p-6 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-200 select-none max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-border/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">NFPA 2001 Formula Breakdown</h3>
                  <p className="text-[11.5px] text-muted-foreground">Clean agent flooding weight calculation per Clause 5.5.1</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormulaModalOpen(false)}
                className="size-7 rounded-lg hover:bg-surface-2 grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="text-[12.5px] text-foreground space-y-3">
              <p className="text-muted-foreground text-xs">
                The clean agent flooding weight is calculated according to NFPA 2001 Clause 5.5.1:
              </p>

              <div className="bg-surface-2 p-3 rounded-2xl font-mono text-xs text-center border border-border font-bold text-primary">
                W = (V / S) × (C / (100 - C)) × SafetyFactor
              </div>

              <div className="space-y-1.5 bg-surface/50 p-3.5 rounded-2xl border border-border/60 text-xs">
                <div className="flex justify-between border-b border-border/40 py-1.5">
                  <span className="font-semibold text-muted-foreground">V (Volume):</span>
                  <span className="font-mono font-medium">
                    {areaVal.toFixed(2)} × {heightVal.toFixed(2)} = {calcResults.volume.toFixed(2)} {unitSystem === "si" ? "m³" : "ft³"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/40 py-1.5">
                  <span className="font-semibold text-muted-foreground">S (Specific Volume):</span>
                  <span className="font-mono font-medium text-right">
                    {useStandardS 
                      ? `${calcResults.S.toFixed(4)} ${unitSystem === "si" ? "m³/kg" : "ft³/lb"} (Locked baseline)`
                      : unitSystem === "si"
                        ? `0.1269 + (0.000513 × ${temp}°C) = ${calcResults.S.toFixed(4)} m³/kg`
                        : `1.885 + (0.0046 × ${temp}°F) = ${calcResults.S.toFixed(4)} ft³/lb`}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/40 py-1.5">
                  <span className="font-semibold text-muted-foreground">C (Design Concentration):</span>
                  <span className="font-mono font-medium">
                    {calcResults.C.toFixed(3)} % ({preset.replace("_", " ").toUpperCase()})
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/40 py-1.5">
                  <span className="font-semibold text-muted-foreground">Safety Multiplier:</span>
                  <span className="font-mono font-medium">{safetyFactorVal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 text-primary font-bold text-[13px] border-t border-border/80">
                  <span>Total Weight (W):</span>
                  <span className="font-mono text-[13.5px]">
                    ({calcResults.volume.toFixed(2)} / {calcResults.S.toFixed(4)}) × ({calcResults.C.toFixed(3)} / {(100 - calcResults.C).toFixed(3)}) × {safetyFactorVal.toFixed(2)} = {calcResults.weight.toFixed(2)} {unitSystem === "si" ? "kg" : "lb"}
                  </span>
                </div>
              </div>

              <div className="bg-surface-2/70 p-3 rounded-xl border border-border/60 text-[11px] text-muted-foreground leading-relaxed">
                <strong>NFPA 2001 Criteria:</strong> Discharge time must not exceed <strong>10 seconds</strong> to establish extinguishing concentration rapidly and minimize decomposition products (HF acid vapor). Minimum enclosure hold time target is <strong>10 minutes</strong>.
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setFormulaModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Comment & Task Modal */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="FM-200 Parameter"
          calculatorTitle="FM-200 Gas Sizing"
          calculatorPath="/plumbing-fm200"
          existingComments={commentsList.filter(
            (c) =>
              c.targetId === commentTargetItem.id ||
              c.spaceId === commentTargetItem.id ||
              c.itemId === commentTargetItem.id
          )}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}

function FM200IntelligenceDrawer({
  onClose,
  calcResults,
  preset,
  setPreset,
  isEffectiveReadOnly,
  safetyFactorVal,
  unitSystem,
  setFormulaModalOpen,
}: {
  onClose: () => void;
  calcResults: any;
  preset: PresetOption;
  setPreset: (p: PresetOption) => void;
  isEffectiveReadOnly: boolean;
  safetyFactorVal: number;
  unitSystem: "si" | "ip";
  setFormulaModalOpen: (open: boolean) => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4.5 text-primary" />
          <div>
            <h3 className="font-bold text-[13.5px] uppercase tracking-wider text-foreground">Live Intelligence</h3>
            <p className="text-[10.5px] text-muted-foreground font-medium">NFPA 2001 Clean Agent Sizing Engine</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="size-7 rounded-lg hover:bg-surface-2 grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title="Close Live Intelligence"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-[12.5px] leading-relaxed text-foreground custom-scrollbar">
        {/* 1. Live Sizing & Safety Audit Card */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
              <Activity className="size-4 text-primary" />
              <span>Safety & Compliance Audit</span>
            </span>
            {calcResults.C <= 9.0 && calcResults.C >= 5.8 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <Check className="size-3" /> NOAEL Compliant
              </span>
            ) : calcResults.C <= 10.5 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <AlertTriangle className="size-3" /> LOAEL Caution
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                <ShieldAlert className="size-3" /> Hazard Alert
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {/* Human Exposure Status */}
            <div className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1 ${
              calcResults.C <= 9.0 
                ? "border-emerald-500/20 bg-emerald-500/5 text-foreground"
                : calcResults.C <= 10.5 
                ? "border-amber-500/20 bg-amber-500/5 text-foreground" 
                : "border-rose-500/20 bg-rose-500/5 text-foreground"
            }`}>
              <div className="flex items-center justify-between font-semibold text-[11.5px]">
                <span>Human Exposure Limit</span>
                <span className="font-mono font-bold">
                  {calcResults.C <= 9.0 ? "≤ 9.0% (NOAEL)" : calcResults.C <= 10.5 ? "9.0% - 10.5% (LOAEL)" : "> 10.5% (Restricted)"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {calcResults.C <= 9.0
                  ? "Design concentration is within NOAEL limit. Safe for normally occupied enclosures with standard egress provisions."
                  : calcResults.C <= 10.5
                  ? "Design concentration is between NOAEL and LOAEL. Occupants must be able to evacuate the enclosure within 5 minutes."
                  : "Concentration exceeds LOAEL limit (10.5%). Strictly restricted to normally unoccupied spaces per NFPA 2001."}
              </p>
            </div>

            {/* Agent Listing Minimum Audit */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-surface-2/60 border border-border/60 text-[11.5px]">
              <span className="text-muted-foreground">Listing Minimum (5.80%):</span>
              <span className={`font-mono font-bold ${calcResults.C >= 5.8 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                {calcResults.C >= 5.8 ? "✓ Compliant" : "⚠ Below 5.8%"}
              </span>
            </div>

            {/* Flooding Density Metric */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-surface-2/60 border border-border/60 text-[11.5px]">
              <span className="text-muted-foreground">Flooding Density:</span>
              <span className="font-mono font-bold text-primary">
                {(calcResults.weight / (calcResults.volume || 1)).toFixed(3)} {unitSystem === "si" ? "kg/m³" : "lb/ft³"}
              </span>
            </div>
          </div>
        </div>

        {/* 2. NFPA 2001 System Specifications */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Flame className="size-3.5 text-danger" /> System Performance Criteria
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2 p-2 rounded-xl bg-surface-2/60 border border-border/60">
              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">1</div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground text-[11.5px]">10-Second Discharge Time</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  NFPA 2001 requires the full calculated weight ({calcResults.weight.toFixed(1)} {unitSystem === "si" ? "kg" : "lb"}) to discharge within 10 seconds to limit HF acid byproducts.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2 rounded-xl bg-surface-2/60 border border-border/60">
              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">2</div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground text-[11.5px]">10-Minute Minimum Hold Time</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Enclosure must retain extinguishing concentration for ≥ 10 minutes. Verified via door fan integrity pressure test.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2 rounded-xl bg-surface-2/60 border border-border/60">
              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">3</div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground text-[11.5px]">Safety Multiplier Recommendation</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Current multiplier: <strong className="text-foreground">{safetyFactorVal.toFixed(2)}x</strong>. For spaces with unsealed cable penetrations, a 1.10x–1.20x factor is recommended.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Quick Hazard Class Presets */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Quick Hazard Class Switcher</span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={isEffectiveReadOnly}
              onClick={() => {
                if (isEffectiveReadOnly) return;
                setPreset("class_a");
              }}
              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer border ${
                preset === "class_a"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface-2 hover:bg-surface-3 text-muted-foreground border-border/70 disabled:opacity-60 disabled:cursor-not-allowed"
              }`}
            >
              Class A (6.86%)
            </button>
            <button
              type="button"
              disabled={isEffectiveReadOnly}
              onClick={() => {
                if (isEffectiveReadOnly) return;
                setPreset("class_c");
              }}
              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer border ${
                preset === "class_c"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface-2 hover:bg-surface-3 text-muted-foreground border-border/70 disabled:opacity-60 disabled:cursor-not-allowed"
              }`}
            >
              Class C (7.00%)
            </button>
            <button
              type="button"
              disabled={isEffectiveReadOnly}
              onClick={() => {
                if (isEffectiveReadOnly) return;
                setPreset("class_b");
              }}
              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer border ${
                preset === "class_b"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface-2 hover:bg-surface-3 text-muted-foreground border-border/70 disabled:opacity-60 disabled:cursor-not-allowed"
              }`}
            >
              Class B (8.70%)
            </button>
          </div>
        </div>

        {/* 4. Live Formula Quick Launcher */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">NFPA 2001 Formula</span>
            <span className="text-[10px] font-mono text-muted-foreground">Clause 5.5.1</span>
          </div>
          <div className="bg-surface-2 p-2.5 rounded-xl font-mono text-[11.5px] text-center border border-border/80 font-bold text-primary">
            W = (V / S) × (C / (100 - C)) × {safetyFactorVal.toFixed(2)}
          </div>
          <button
            type="button"
            onClick={() => setFormulaModalOpen(true)}
            className="w-full py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Info className="size-3.5" />
            <span>View Full Step-by-Step Values</span>
          </button>
        </div>
      </div>
    </div>
  );
}
