import { CalculationReviewBar, useCalculationLock } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle,
  Save, FolderOpen, ChevronDown, ChevronUp, Trash2, Copy, Clipboard,
  RotateCcw, MessageSquare, Edit3, FileText, CheckCircle2, Sparkles,
  Download, Upload, Gauge, Layers
} from "lucide-react";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { EditChwPipeModal } from "@/components/workspace/EditChwPipeModal";
import { UnitToggle } from "@/components/workspace/UnitToggle";

export const Route = createFileRoute("/chw-pipe-sizer")({
  head: () => ({
    meta: [
      { title: "CHW Pipe Sizer — MEP Calc" },
      { name: "description", content: "Chilled water and condenser water pipe sizer based on flowrate, fluid type, and target pressure drop." },
    ],
  }),
  component: ChwPipeSizerPage,
});

const pipeTable: Record<string, number> = {
  0.5: 15.80, 0.75: 20.93, 1.0: 26.64, 1.25: 35.05, 1.5: 40.89,
  2.0: 52.50, 2.5: 62.71, 3.0: 77.93, 3.5: 90.12, 4.0: 102.26,
  5.0: 128.19, 6.0: 154.05, 8.0: 202.72, 10.0: 254.46, 12.0: 303.23
};

const GLYCOL_VISC: Record<string, number> = { chw: 1, cw: 1, g25: 1.8, g40: 2.6 };
const GLYCOL_DENS: Record<string, number> = { chw: 1, cw: 1, g25: 1.03, g40: 1.05 };

function colebrook(Re: number, relR: number): number {
  if (Re <= 0) return 0.1;
  if (Re < 2300) return 64 / Re;
  let f = 0.25 / Math.pow(Math.log(relR / 3.7 + 5.74 / Math.pow(Re, 0.9)) / Math.LN10, 2);
  for (let i = 0; i < 80; i++) {
    const r = -2 * Math.log((relR / 3.7) + (2.51 / (Re * Math.sqrt(f)))) / Math.LN10;
    const fn = 1 / (r * r);
    if (Math.abs(fn - f) < 1e-10) {
      f = fn;
      break;
    }
    f = fn;
  }
  return f;
}

function waterDens(tC: number): number {
  return 999.842594 + 6.793952e-2 * tC - 9.09529e-3 * Math.pow(tC, 2) + 1.001685e-4 * Math.pow(tC, 3) - 1.120083e-6 * Math.pow(tC, 4) + 6.536332e-9 * Math.pow(tC, 5);
}

function waterVisc(tC: number): number {
  return 2.414e-5 * Math.pow(10, 247.8 / (tC + 406.15));
}

function fToC(f: number): number {
  return (f - 32) * 5 / 9;
}

interface SavedCalculation {
  id: string;
  type: string;
  name: string;
  savedAt: string;
  values: Record<string, any>;
  unitSystem: "si" | "ip";
}

function ChwPipeSizerPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const { project, forceSaveToCloud } = useWorkspace();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");

  const [sizingParams, setSizingParams] = useState({
    flowRate: "" as number | "",
    fluidType: "chw" as "chw" | "cw" | "g25" | "g40",
    temperature: "" as number | "",
    materialRoughness: 0.000046, // Carbon Steel in meters
    targetDp: "" as number | "",
  });

  const [projectInfo, setProjectInfo] = useState({
    projectName: "Commercial Tower CHW Sizing",
    projectNumber: "MEP-CHW-02",
    client: "Summit Estates Ltd",
    consultant: "Consistent Engineering Consultants",
    date: new Date().toISOString().split("T")[0],
    revision: "Rev 0",
    calcNumber: "CALC-HVAC-CHW02",
    notes: "Chilled water distribution pipe sizing study to identify optimal NPS sizes and pressure drops.",
  });

  const [showDetailedCalcs, setShowDetailedCalcs] = useState<boolean>(true);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);

  // Comment System State & Persistence
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const ip = unitSystem === "ip";

  useEffect(() => {
    const pId = project?.id || "default";
    const savedComments = localStorage.getItem(`mep_calc_comments_${pId}_/chw-pipe-sizer`);
    if (savedComments) {
      try {
        setCommentsList(JSON.parse(savedComments));
      } catch (e) {
        console.error("Failed to load comments", e);
      }
    }
  }, [project?.id]);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/chw-pipe-sizer`, JSON.stringify(newList));
    try {
      if (typeof forceSaveToCloud === "function") {
        forceSaveToCloud(true);
      }
    } catch (e) {}
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (commentData: any) => {
    const newComment = {
      id: `cmt_${Date.now()}`,
      text: commentData.text,
      authorName: currentUserName,
      authorRole: profile?.role || "Engineer",
      timestamp: new Date().toISOString(),
      assignedUsers: commentData.assignedUsers || [],
      itemId: commentTargetItem?.id,
      spaceId: commentTargetItem?.id,
      targetId: commentTargetItem?.id,
      targetName: commentTargetItem?.name,
      calculatorTitle: "CHW Pipe Sizer",
      calculatorPath: "/chw-pipe-sizer",
      projectId: project?.id || "default",
      projectName: project?.name || "CHW Pipe Sizing",
    };
    const updated = [newComment, ...commentsList];
    saveComments(updated);
    toast.success(`Comment / task assigned on "${commentTargetItem?.name || "parameter"}"`);
    setCommentModalOpen(false);

    notifyCommentAssigned({
      comment: newComment,
      targetId: commentTargetItem?.id || "chw-pipe-sizer",
      targetName: commentTargetItem?.name || "CHW Pipe",
      targetType: "equipment",
      calculatorTitle: "CHW Pipe Sizer",
      calculatorPath: "/chw-pipe-sizer",
      project,
      currentUserName,
      currentUserId: userData?.id || profile?.id
    }).catch(console.error);
  };

  // Scroll and highlight notification target item
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();

      const el = document.getElementById(targetId || "") ||
                 document.getElementById(`field-${targetId}`) ||
                 document.getElementById(`res-${targetId}`) ||
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

  // Presets load/save
  const [saves, setSaves] = useState<SavedCalculation[]>([]);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [showLoadModal, setShowLoadModal] = useState<boolean>(false);
  const [saveName, setSaveName] = useState<string>("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mep_chw_pipe_sizer_saves");
      if (stored) {
        setSaves(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load custom saves", e);
    }
  }, []);

  const saveToLocalStorage = (newSaves: SavedCalculation[]) => {
    setSaves(newSaves);
    localStorage.setItem("mep_chw_pipe_sizer_saves", JSON.stringify(newSaves));
  };

  const handleSaveCurrent = () => {
    if (!saveName.trim()) return;
    const newSave: SavedCalculation = {
      id: "pipe_save_" + Date.now(),
      type: "chw-pipe-sizer",
      name: saveName.trim(),
      savedAt: new Date().toISOString(),
      values: { ...sizingParams },
      unitSystem
    };
    const updated = [newSave, ...saves];
    saveToLocalStorage(updated);
    setSaveName("");
    setShowSaveModal(false);
    toast.success(`Preset "${newSave.name}" saved`);
    if (typeof forceSaveToCloud === "function") {
      forceSaveToCloud();
    }
  };

  const handleLoadSave = (id: string) => {
    const target = saves.find(s => s.id === id);
    if (!target) return;
    setSizingParams(target.values as typeof sizingParams);
    if (target.unitSystem) setUnitSystem(target.unitSystem);
    setShowLoadModal(false);
    toast.success(`Loaded preset "${target.name}"`);
  };

  const handleDeleteSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = saves.filter(s => s.id !== id);
    saveToLocalStorage(updated);
    toast.info("Deleted preset");
  };

  // State persistence per project
  useEffect(() => {
    try {
      const saved = localStorage.getItem("chw_pipe_sizer_params");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sizingParams) {
          let loadedParams = { ...parsed.sizingParams };
          if (loadedParams.materialRoughness >= 0.001) {
            loadedParams.materialRoughness = loadedParams.materialRoughness / 1000;
          }
          setSizingParams(loadedParams);
        }
        if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      }
    } catch (e) {
      console.error(e);
    }
    if (project?.id) setLoadedProjectId(project.id);
  }, [project?.id]);

  const saveParams = (params: typeof sizingParams, unit: "si" | "ip", proj: typeof projectInfo = projectInfo) => {
    setSizingParams(params);
    setUnitSystem(unit);
    setProjectInfo(proj);
    try {
      localStorage.setItem("chw_pipe_sizer_params", JSON.stringify({ sizingParams: params, unitSystem: unit, projectInfo: proj }));
      dirtyStore.set(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (targetUnit === unitSystem) return;

    let updatedParams = { ...sizingParams };

    if (shouldConvert) {
      let nextFlow = sizingParams.flowRate;
      let nextDp = sizingParams.targetDp;
      let nextTemp = sizingParams.temperature;

      if (targetUnit === "ip") {
        // SI -> IP
        nextFlow = sizingParams.flowRate !== "" ? Number((Number(sizingParams.flowRate) * 15.8503).toFixed(1)) : "";
        nextDp = sizingParams.targetDp !== "" ? Number((Number(sizingParams.targetDp) / 22.62).toFixed(2)) : "";
        nextTemp = sizingParams.temperature !== "" ? Number((Number(sizingParams.temperature) * 1.8 + 32).toFixed(1)) : "";
      } else {
        // IP -> SI
        nextFlow = sizingParams.flowRate !== "" ? Number((Number(sizingParams.flowRate) / 15.8503).toFixed(2)) : "";
        nextDp = sizingParams.targetDp !== "" ? Number((Number(sizingParams.targetDp) * 22.62).toFixed(0)) : "";
        nextTemp = sizingParams.temperature !== "" ? Number(((Number(sizingParams.temperature) - 32) / 1.8).toFixed(1)) : "";
      }

      updatedParams = {
        ...sizingParams,
        flowRate: nextFlow,
        targetDp: nextDp,
        temperature: nextTemp
      };
    }
    
    saveParams(updatedParams, targetUnit, projectInfo);
    toast.info(`Switched to ${targetUnit === "ip" ? "Imperial (IP)" : "Metric (SI)"} units`);
  };

  // Calculations matching original exact website calcHvacPipe logic
  const calculatedData = useMemo(() => {
    const flowVal = sizingParams.flowRate !== "" ? Number(sizingParams.flowRate) : (ip ? 80 : 5.0);
    const Q = ip ? flowVal * 6.30902e-5 : flowVal * 1e-3; // m³/s
    const tRaw = sizingParams.temperature !== "" ? Number(sizingParams.temperature) : (ip ? 44 : 6.7);
    const tC = ip ? fToC(tRaw) : tRaw;
    const eps = Number(sizingParams.materialRoughness) || 0.000046;
    
    const dpRaw = sizingParams.targetDp !== "" ? Number(sizingParams.targetDp) : (ip ? 4.0 : 40);
    const targetDpPaM = ip ? dpRaw * 22.62 : dpRaw;

    const rho = waterDens(tC) * GLYCOL_DENS[sizingParams.fluidType];
    const mu = waterVisc(tC) * GLYCOL_VISC[sizingParams.fluidType];

    let chosen: any = null;
    const allPipes: any[] = [];

    for (const [nps, idMm] of Object.entries(pipeTable)) {
      const D = idMm / 1000;
      const A = (Math.PI * D * D) / 4;
      const v = Q / A;
      const Re = (rho * v * D) / mu;
      const f = colebrook(Re, eps / D);
      const dp = (f * rho * v * v) / (2 * D);
      const dpFt = dp / 22.62;
      const vFps = v / 0.3048;
      const isCompliant = dp <= targetDpPaM * 1.05;

      const rowObj = {
        nps: Number(nps),
        idMm,
        D,
        A,
        v,
        vFps,
        Re,
        f,
        dp,
        dpFt,
        isCompliant
      };
      allPipes.push(rowObj);

      if (!chosen && isCompliant) {
        chosen = rowObj;
      }
    }

    if (!chosen && allPipes.length > 0) {
      chosen = allPipes[allPipes.length - 1];
    }

    const flowDisplay = ip ? `${flowVal.toFixed(1)} GPM` : `${flowVal.toFixed(2)} L/s`;
    const tempDisplay = ip ? `${tRaw.toFixed(1)} °F` : `${tRaw.toFixed(1)} °C`;
    const targetDpDisplay = ip ? `${dpRaw.toFixed(2)} psi/100ft` : `${dpRaw.toFixed(0)} Pa/m`;

    return {
      flowVal,
      flowDisplay,
      Q,
      tRaw,
      tC,
      tempDisplay,
      dpRaw,
      targetDpDisplay,
      rho,
      mu,
      chosen,
      allPipes
    };
  }, [sizingParams, unitSystem, ip]);

  const handleCopyValue = (label: string, value: string | number) => {
    if (value === "" || value === undefined) {
      toast.info(`No value in ${label} to copy`);
      return;
    }
    navigator.clipboard.writeText(String(value));
    toast.success(`Copied ${label}: ${value} to clipboard`);
  };

  const handlePasteValue = async (label: string, fieldKey: keyof typeof sizingParams) => {
    try {
      const text = await navigator.clipboard.readText();
      const num = parseFloat(text.trim());
      if (!isNaN(num)) {
        const next = { ...sizingParams, [fieldKey]: num };
        saveParams(next, unitSystem, projectInfo);
        toast.success(`Pasted ${num} into ${label}`);
      } else {
        toast.error(`Clipboard content "${text}" is not a valid number`);
      }
    } catch (err) {
      toast.error("Unable to read clipboard");
    }
  };

  const handleResetValue = (label: string, fieldKey: keyof typeof sizingParams, defaultVal: any) => {
    const next = { ...sizingParams, [fieldKey]: defaultVal };
    saveParams(next, unitSystem, projectInfo);
    toast.success(`Reset ${label} to default`);
  };

  const handleClearValue = (label: string, fieldKey: keyof typeof sizingParams) => {
    const next = { ...sizingParams, [fieldKey]: "" };
    saveParams(next, unitSystem, projectInfo);
    toast.info(`Cleared ${label}`);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ["CHW Pipe Sizing Report"],
      ["Generated on: " + new Date().toLocaleDateString(), `Unit System: ${unitSystem.toUpperCase()}`],
      [],
      ["1. Design Inputs"],
      ["Design Flow Rate", calculatedData.flowDisplay],
      ["Fluid Type", sizingParams.fluidType.toUpperCase()],
      ["Operating Temperature", calculatedData.tempDisplay],
      ["Target Head Loss", calculatedData.targetDpDisplay],
      [],
      ["2. Recommended Pipe Selection"],
      ["Recommended Pipe Size", `${calculatedData.chosen?.nps}" NPS (${calculatedData.chosen?.idMm} mm ID)`],
      ["Flow Velocity", ip ? `${calculatedData.chosen?.vFps.toFixed(2)} fps` : `${calculatedData.chosen?.v.toFixed(2)} m/s`],
      ["Actual Pressure Drop", ip ? `${calculatedData.chosen?.dpFt.toFixed(2)} psi/100ft` : `${calculatedData.chosen?.dp.toFixed(1)} Pa/m`],
      ["Reynolds Number", calculatedData.chosen?.Re.toFixed(0)],
      ["Darcy Friction Factor (f)", calculatedData.chosen?.f.toFixed(4)],
      [],
      ["3. Full Pipe Sizing Schedule"],
      ["NPS", "ID (mm)", "Velocity", "Pressure Drop", "Reynolds", "Status"],
      ...calculatedData.allPipes.map(p => [
        `${p.nps}"`,
        p.idMm,
        ip ? `${p.vFps.toFixed(2)} fps` : `${p.v.toFixed(2)} m/s`,
        ip ? `${p.dpFt.toFixed(2)} psi/100ft` : `${p.dp.toFixed(1)} Pa/m`,
        p.Re.toFixed(0),
        p.isCompliant ? "COMPLIANT" : "EXCEEDS TARGET"
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "CHW Pipe Sizer");
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "CHW_Pipe_Sizing_Report.xlsx", "Excel Document", ["xlsx"]);
    toast.success("Excel report exported successfully");
  };

  const handlePrintPDF = async () => {
    try {
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule;

      const doc = new jsPDF("p", "pt", "a4");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("CHILLED WATER PIPE SIZING REPORT", 40, 50);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Generated on: ${projectInfo.date} | Calculation Ref: ${projectInfo.calcNumber} | Unit: ${unitSystem.toUpperCase()}`, 40, 68);

      doc.setDrawColor(200);
      doc.line(40, 75, 550, 75);

      const tableData = [
        ["Design Flow Rate", calculatedData.flowDisplay, "Fluid Type", sizingParams.fluidType.toUpperCase()],
        ["Operating Temperature", calculatedData.tempDisplay, "Target Head Loss", calculatedData.targetDpDisplay],
        ["Recommended Size", `${calculatedData.chosen?.nps}" NPS (${calculatedData.chosen?.idMm} mm ID)`, "Flow Velocity", ip ? `${calculatedData.chosen?.vFps.toFixed(2)} fps` : `${calculatedData.chosen?.v.toFixed(2)} m/s`],
        ["Actual Drop", ip ? `${calculatedData.chosen?.dpFt.toFixed(2)} psi/100ft` : `${calculatedData.chosen?.dp.toFixed(1)} Pa/m`, "Reynolds (Re)", calculatedData.chosen?.Re.toFixed(0)],
      ];

      autoTable(doc, {
        startY: 90,
        head: [],
        body: tableData,
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 130 },
          1: { cellWidth: 120 },
          2: { fontStyle: "bold", cellWidth: 130 },
          3: { cellWidth: 120 },
        },
      });

      const pdfBuffer = doc.output("arraybuffer");
      downloadFile(new Uint8Array(pdfBuffer), "CHW_Pipe_Sizing_Report.pdf", "PDF Document", ["pdf"]);
      toast.success("PDF report generated successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF report");
    }
  };

  const renderInputBox = (
    id: string,
    fieldKey: keyof typeof sizingParams,
    label: string,
    value: any,
    defaultVal: any,
    placeholder: string,
    min?: number,
    step: string = "any"
  ) => {
    const itemComments = commentsList.filter(c => c.spaceId === id || c.targetId === id || c.itemId === id);
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === id ||
                          highlightedTargetId === `field-${id}` ||
                          (highlightedTargetId && id && id.toLowerCase().includes(highlightedTargetId.toLowerCase())) ||
                          (highlightedTargetId && label && label.toLowerCase().includes(highlightedTargetId.toLowerCase()));

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${id}`}
            data-item-id={id}
            data-field-id={id}
            className={`flex flex-col gap-1.5 group cursor-context-menu p-2 rounded-xl transition-all ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20 font-bold"
                : ""
            }`}
          >
            <label className="font-semibold text-foreground flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span>{label}</span>
                {hasComments && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenComment(id, label);
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                    title={`${itemComments.length} comment(s)/task(s) assigned`}
                  >
                    <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                    <span>{itemComments.length}</span>
                  </button>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition">Right-click for options</span>
            </label>
            <input
              id={id}
              type="number"
              min={min}
              step={step}
              value={value}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                saveParams({ ...sizingParams, [fieldKey]: val }, unitSystem, projectInfo);
              }}
              placeholder={placeholder}
              className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal transition hover:border-[#0A7BC7]/50"
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => handleCopyValue(label, value)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handlePasteValue(label, fieldKey)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Clipboard className="size-3.5 text-muted-foreground" />
            <span>Paste Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleResetValue(label, fieldKey, defaultVal)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset to Default ({defaultVal !== "" ? defaultVal : "Blank"})</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handleClearValue(label, fieldKey)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium text-amber-600 dark:text-amber-400"
          >
            <Trash2 className="size-3.5" />
            <span>Clear Field</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment / Assign Task"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderResultRow = (
    id: string,
    label: string,
    valueFormatted: string,
    isHighlight: boolean = false,
    highlightClass: string = "text-foreground",
    colSpanTwo: boolean = false
  ) => {
    const itemComments = commentsList.filter(c => c.spaceId === id || c.targetId === id || c.itemId === id);
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === id ||
                          highlightedTargetId === `res-${id}` ||
                          (highlightedTargetId && id && id.toLowerCase().includes(highlightedTargetId.toLowerCase())) ||
                          (highlightedTargetId && label && label.toLowerCase().includes(highlightedTargetId.toLowerCase()));

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`res-${id}`}
            data-item-id={id}
            data-field-id={id}
            className={`flex justify-between items-center py-1.5 border-b border-border/40 hover:bg-slate-100/40 dark:hover:bg-slate-800/30 px-2 rounded-lg transition cursor-context-menu group ${
              colSpanTwo ? "col-span-2" : ""
            } ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20 font-bold"
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
                    handleOpenComment(id, label);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                  title={`${itemComments.length} comment(s)/task(s) assigned`}
                >
                  <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                  <span>{itemComments.length}</span>
                </button>
              )}
            </span>
            <strong className={`font-bold font-mono ${highlightClass}`}>{valueFormatted}</strong>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
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
              toast.success(`Copied full line: "${label}: ${valueFormatted}"`);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <FileText className="size-3.5 text-muted-foreground" />
            <span>Copy Full Line</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
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
    <AppShell title="CHW Pipe Sizer" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Header Section */}
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; HYDRONIC &gt; CHW PIPE SIZER</span>
            <div className="flex flex-wrap items-center justify-between gap-4 mt-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">CHW Pipe Sizer</h1>
                <CalculationReviewBar projectId={project?.id} calculatorPath="/chw-pipe-sizer" calculatorTitle="CHW Pipe Sizer" />
                {commentsList.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                    <MessageSquare className="size-3.5 fill-blue-500/20" />
                    <span>{commentsList.length} Active Task(s) / Comment(s)</span>
                  </div>
                )}
              </div>

              {/* Action Buttons & Unit Toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  inputDescriptions="Flow Rate, Target ΔP, Operating Temperature"
                  conversionExample={unitSystem === "si" ? "Convert 5 L/s → 79.3 GPM, 40 Pa/m → 1.77 psi/100ft" : "Convert 80 GPM → 5.05 L/s, 4 psi/100ft → 90.5 Pa/m"}
                />

                <TBtn onClick={handleExportExcel} className="h-8 text-xs font-semibold">
                  <FileSpreadsheet className="size-3.5 text-emerald-600" /> Export Excel
                </TBtn>
                <TBtn onClick={handlePrintPDF} className="h-8 text-xs font-semibold">
                  <Printer className="size-3.5 text-blue-600" /> PDF Report
                </TBtn>
                <TBtn onClick={() => setShowSaveModal(true)} className="h-8 text-xs font-semibold">
                  <Save className="size-3.5 text-amber-600" /> Save Preset
                </TBtn>
                {saves.length > 0 && (
                  <TBtn onClick={() => setShowLoadModal(true)} className="h-8 text-xs font-semibold">
                    <FolderOpen className="size-3.5 text-indigo-600" /> Load ({saves.length})
                  </TBtn>
                )}
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Size chilled water and condenser water piping based on design flowrate, fluid properties, and target friction head loss.
            </p>
          </div>

          {/* Sizing Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Inputs Column (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Card 1: Flow & Fluid Parameters */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">1. Flow & Fluid Parameters</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {renderInputBox(
                    "chw-pipe-flow",
                    "flowRate",
                    `Design Flow Rate (${ip ? "GPM" : "L/s"})`,
                    sizingParams.flowRate,
                    ip ? 80 : 5.0,
                    ip ? "80" : "5.0",
                    0
                  )}

                  <div className="flex flex-col gap-1.5 p-2 rounded-xl">
                    <label className="font-semibold text-foreground">Fluid Type</label>
                    <select
                      value={sizingParams.fluidType}
                      onChange={(e) => saveParams({ ...sizingParams, fluidType: e.target.value as any }, unitSystem, projectInfo)}
                      className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none"
                    >
                      <option value="chw">Chilled Water (CHW - Pure)</option>
                      <option value="cw">Condenser Water (CW)</option>
                      <option value="g25">25% Ethylene/Propylene Glycol</option>
                      <option value="g40">40% Ethylene/Propylene Glycol</option>
                    </select>
                  </div>

                  {renderInputBox(
                    "chw-pipe-temp",
                    "temperature",
                    `Fluid Operating Temperature (${ip ? "°F" : "°C"})`,
                    sizingParams.temperature,
                    ip ? 44 : 6.7,
                    ip ? "44" : "6.7"
                  )}
                </div>
              </div>

              {/* Card 2: Piping Sizing Criteria */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">2. Piping Sizing Criteria</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {renderInputBox(
                    "chw-pipe-target-dp",
                    "targetDp",
                    `Target Head Loss Gradient (${ip ? "psi/100ft" : "Pa/m"})`,
                    sizingParams.targetDp,
                    ip ? 4.0 : 40,
                    ip ? "4.0" : "40",
                    0,
                    "0.1"
                  )}

                  {renderInputBox(
                    "chw-pipe-roughness",
                    "materialRoughness",
                    "Pipe Absolute Roughness ε (meters)",
                    sizingParams.materialRoughness,
                    0.000046,
                    "0.000046",
                    0,
                    "0.000001"
                  )}
                </div>
              </div>

            </div>

            {/* Results Column (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              
              {/* Card 1: Recommended Selection */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Recommended Pipe Selection</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                  {renderResultRow("res-rec-nps", "Recommended Size", `${calculatedData.chosen?.nps}" NPS (${calculatedData.chosen?.idMm} mm ID)`, true, "text-[#0A7BC7] text-[14px]")}
                  {renderResultRow("res-rec-vel", "Fluid Velocity", ip ? `${calculatedData.chosen?.vFps.toFixed(2)} fps` : `${calculatedData.chosen?.v.toFixed(2)} m/s`, true, "text-[#0A7BC7]")}
                  {renderResultRow("res-rec-dp", "Actual Head Loss Drop", ip ? `${calculatedData.chosen?.dpFt.toFixed(2)} psi/100ft` : `${calculatedData.chosen?.dp.toFixed(1)} Pa/m`, true, "text-[#0A7BC7]")}
                  {renderResultRow("res-rec-re", "Reynolds Number (Re)", `${calculatedData.chosen?.Re.toFixed(0)} (${calculatedData.chosen?.Re > 4000 ? "Turbulent" : "Laminar"})`)}
                  {renderResultRow("res-rec-f", "Darcy Friction Factor (f)", calculatedData.chosen?.f.toFixed(4))}
                  {renderResultRow("res-rec-dens", "Fluid Density (ρ)", `${calculatedData.rho.toFixed(1)} kg/m³`)}
                </div>
              </div>

              {/* Card 2: Full Schedule Table */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs overflow-hidden">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Piping Sizing Schedule</h3>
                </div>

                <div className="overflow-x-auto border border-border/60 rounded-xl">
                  <table className="w-full text-[11px] font-sans text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-900 font-bold text-foreground border-b border-border/60">
                        <th className="p-2 text-center">NPS</th>
                        <th className="p-2 text-center">ID (mm)</th>
                        <th className="p-2 text-right">Velocity</th>
                        <th className="p-2 text-right">Head Loss</th>
                        <th className="p-2 text-right">Reynolds</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {calculatedData.allPipes.map((p) => {
                        const isChosen = calculatedData.chosen?.nps === p.nps;
                        return (
                          <tr key={p.nps} className={`hover:bg-slate-50 dark:hover:bg-slate-900/50 ${isChosen ? "bg-primary/10 font-bold" : ""}`}>
                            <td className="p-2 text-center font-bold font-sans">{p.nps}"</td>
                            <td className="p-2 text-center">{p.idMm}</td>
                            <td className="p-2 text-right">{ip ? `${p.vFps.toFixed(2)} fps` : `${p.v.toFixed(2)} m/s`}</td>
                            <td className="p-2 text-right">{ip ? `${p.dpFt.toFixed(2)} psi/100ft` : `${p.dp.toFixed(1)} Pa/m`}</td>
                            <td className="p-2 text-right">{p.Re.toFixed(0)}</td>
                            <td className="p-2 text-center">
                              {p.isCompliant ? (
                                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                  {isChosen ? "✓ SELECTED" : "✓ PASS"}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60 text-[10px]">HIGH DROP</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Card 3: Detailed Calculations Steps Accordion */}
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
                    
                    {/* Step 1 */}
                    {(() => {
                      const stepId = "step-1-fluid-properties";
                      const stepLabel = "Step 1: Fluid Density & Dynamic Viscosity";
                      const stepComments = commentsList.filter(c => c.spaceId === stepId || c.targetId === stepId || c.itemId === stepId);
                      const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                      return (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id={stepId}
                              data-item-id={stepId}
                              data-field-id={stepId}
                              className={`flex gap-3 items-start border-b border-border/40 pb-2 cursor-context-menu hover:bg-slate-100/40 dark:hover:bg-slate-800/30 p-1.5 rounded-lg transition ${
                                isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                              }`}
                            >
                              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">1</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-foreground flex items-center justify-between">
                                  <span>{stepLabel}</span>
                                  {stepComments.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenComment(stepId, stepLabel);
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                                    >
                                      <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                                      <span>{stepComments.length}</span>
                                    </button>
                                  )}
                                </div>
                                <div className="font-mono text-primary my-1">ρ = f(T_c) × Glycol_Factor, μ = f(T_c) × Glycol_Visc</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">T = {calculatedData.tC.toFixed(2)} °C | Type = {sizingParams.fluidType.toUpperCase()}</div>
                                <div className="font-bold text-[11px] text-foreground mt-0.5">ρ = {calculatedData.rho.toFixed(2)} kg/m³, μ = {calculatedData.mu.toExponential(3)} Pa·s</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => handleCopyValue("Step 1 Properties", `ρ=${calculatedData.rho.toFixed(2)} kg/m³`)}>
                              <Copy className="size-3.5 text-muted-foreground mr-2" />
                              <span>Copy Step 1 Result</span>
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenComment(stepId, stepLabel)}>
                              <MessageSquare className="size-3.5 text-blue-600 mr-2" />
                              <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment / Assign Task"}</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })()}

                    {/* Step 2 */}
                    {(() => {
                      const stepId = "step-2-velocity";
                      const stepLabel = "Step 2: Internal Cross-Section Area & Velocity";
                      const stepComments = commentsList.filter(c => c.spaceId === stepId || c.targetId === stepId || c.itemId === stepId);
                      const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                      return (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id={stepId}
                              data-item-id={stepId}
                              data-field-id={stepId}
                              className={`flex gap-3 items-start border-b border-border/40 pb-2 cursor-context-menu hover:bg-slate-100/40 dark:hover:bg-slate-800/30 p-1.5 rounded-lg transition ${
                                isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                              }`}
                            >
                              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">2</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-foreground flex items-center justify-between">
                                  <span>{stepLabel}</span>
                                  {stepComments.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenComment(stepId, stepLabel);
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                                    >
                                      <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                                      <span>{stepComments.length}</span>
                                    </button>
                                  )}
                                </div>
                                <div className="font-mono text-primary my-1">A = π × D² ÷ 4, v = Q ÷ A</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">D = {calculatedData.chosen?.D.toFixed(4)} m, Q = {calculatedData.Q.toExponential(3)} m³/s</div>
                                <div className="font-bold text-[11px] text-[#0A7BC7] mt-0.5">
                                  v = {calculatedData.chosen?.v.toFixed(2)} m/s ({calculatedData.chosen?.vFps.toFixed(2)} fps)
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => handleCopyValue("Step 2 Velocity", `${calculatedData.chosen?.v.toFixed(2)} m/s`)}>
                              <Copy className="size-3.5 text-muted-foreground mr-2" />
                              <span>Copy Step 2 Result</span>
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenComment(stepId, stepLabel)}>
                              <MessageSquare className="size-3.5 text-blue-600 mr-2" />
                              <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment / Assign Task"}</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })()}

                    {/* Step 3 */}
                    {(() => {
                      const stepId = "step-3-reynolds-friction";
                      const stepLabel = "Step 3: Reynolds Number & Colebrook Friction Factor";
                      const stepComments = commentsList.filter(c => c.spaceId === stepId || c.targetId === stepId || c.itemId === stepId);
                      const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                      return (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id={stepId}
                              data-item-id={stepId}
                              data-field-id={stepId}
                              className={`flex gap-3 items-start border-b border-border/40 pb-2 cursor-context-menu hover:bg-slate-100/40 dark:hover:bg-slate-800/30 p-1.5 rounded-lg transition ${
                                isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                              }`}
                            >
                              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">3</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-foreground flex items-center justify-between">
                                  <span>{stepLabel}</span>
                                  {stepComments.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenComment(stepId, stepLabel);
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                                    >
                                      <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                                      <span>{stepComments.length}</span>
                                    </button>
                                  )}
                                </div>
                                <div className="font-mono text-primary my-1">Re = (ρ × v × D) ÷ μ, 1/√f = -2 log10( (ε/D)/3.7 + 2.51/(Re√f) )</div>
                                <div className="font-bold text-[11px] text-foreground mt-0.5">
                                  Re = {calculatedData.chosen?.Re.toFixed(0)}, f = {calculatedData.chosen?.f.toFixed(4)}
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => handleCopyValue("Step 3 Friction", `f=${calculatedData.chosen?.f.toFixed(4)}`)}>
                              <Copy className="size-3.5 text-muted-foreground mr-2" />
                              <span>Copy Step 3 Result</span>
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenComment(stepId, stepLabel)}>
                              <MessageSquare className="size-3.5 text-blue-600 mr-2" />
                              <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment / Assign Task"}</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })()}

                    {/* Step 4 */}
                    {(() => {
                      const stepId = "step-4-dp-gradient";
                      const stepLabel = "Step 4: Darcy-Weisbach Pressure Drop Gradient";
                      const stepComments = commentsList.filter(c => c.spaceId === stepId || c.targetId === stepId || c.itemId === stepId);
                      const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                      return (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id={stepId}
                              data-item-id={stepId}
                              data-field-id={stepId}
                              className={`flex gap-3 items-start pb-1 cursor-context-menu hover:bg-slate-100/40 dark:hover:bg-slate-800/30 p-1.5 rounded-lg transition ${
                                isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                              }`}
                            >
                              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">4</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-foreground flex items-center justify-between">
                                  <span>{stepLabel}</span>
                                  {stepComments.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenComment(stepId, stepLabel);
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                                    >
                                      <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                                      <span>{stepComments.length}</span>
                                    </button>
                                  )}
                                </div>
                                <div className="font-mono text-primary my-1">ΔP/L = (f × ρ × v²) ÷ (2 × D)</div>
                                <div className="font-bold text-[11px] text-[#0A7BC7] mt-0.5">
                                  ΔP/L = {calculatedData.chosen?.dp.toFixed(1)} Pa/m ({calculatedData.chosen?.dpFt.toFixed(2)} psi/100ft)
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => handleCopyValue("Step 4 Drop", `${calculatedData.chosen?.dp.toFixed(1)} Pa/m`)}>
                              <Copy className="size-3.5 text-muted-foreground mr-2" />
                              <span>Copy Step 4 Result</span>
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenComment(stepId, stepLabel)}>
                              <MessageSquare className="size-3.5 text-blue-600 mr-2" />
                              <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment / Assign Task"}</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })()}

                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* Save Preset Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Save className="size-4 text-primary" /> Save Calculation Preset
            </h3>
            <p className="text-xs text-muted-foreground">
              Save current CHW pipe sizing inputs to preset library.
            </p>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Primary Chiller Loop 4-inch"
              className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:border-primary outline-none"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSaveCurrent()}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCurrent}
                disabled={!saveName.trim()}
                className="px-4 py-2 text-xs font-bold bg-[#0A7BC7] hover:bg-[#0863A0] text-white rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Preset Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <FolderOpen className="size-4 text-primary" /> Saved CHW Pipe Presets
            </h3>
            <div className="max-h-60 overflow-y-auto flex flex-col gap-2">
              {saves.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleLoadSave(s.id)}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 cursor-pointer transition"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-foreground">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">Saved {new Date(s.savedAt).toLocaleDateString()} | Unit: {s.unitSystem?.toUpperCase() || "IP"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSave(s.id, e)}
                    className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                    title="Delete preset"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowLoadModal(false)}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Assignment Modal */}
      <AssignCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        targetItem={commentTargetItem}
        comments={commentsList}
        onSave={handleSaveComment}
      />

      {/* Edit Modal */}
      {editModalOpen && (
        <EditChwPipeModal
          params={sizingParams}
          unitSystem={unitSystem}
          onClose={() => setEditModalOpen(false)}
          onSave={(updated) => {
            saveParams(updated, unitSystem, projectInfo);
            setEditModalOpen(false);
          }}
          calculatedData={calculatedData}
        />
      )}
    </AppShell>
  );
}
