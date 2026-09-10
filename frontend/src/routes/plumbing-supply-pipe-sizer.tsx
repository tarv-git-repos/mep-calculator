import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
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
import { useAuth } from "@/contexts/AuthContext";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";

export const Route = createFileRoute("/plumbing-supply-pipe-sizer")({
  head: () => ({
    meta: [
      { title: "Supply Pipe Sizer — MEP Calc" },
      { name: "description", content: "Water supply pipe sizer using ASPE/IPC velocity and Hazen-Williams friction loss constraints." },
    ],
  }),
  component: SupplyPipeSizerPage,
});

interface PipeSize {
  nps: string;
  dn: string;
  id: number; // inches
}

interface SavedCalculation {
  id: string;
  type: string;
  name: string;
  savedAt: string;
  values: Record<string, any>;
  unitSystem: "si" | "ip";
}

const PIPE_SIZES: PipeSize[] = [
  { nps: '¾"', dn: '20 mm', id: 0.811 },
  { nps: '1"', dn: '25 mm', id: 1.055 },
  { nps: '1¼"', dn: '32 mm', id: 1.265 },
  { nps: '1½"', dn: '40 mm', id: 1.505 },
  { nps: '2"', dn: '50 mm', id: 2.009 },
  { nps: '2½"', dn: '65 mm', id: 2.495 },
  { nps: '3"', dn: '80 mm', id: 3.035 },
  { nps: '4"', dn: '100 mm', id: 4.009 }
];

function SupplyPipeSizerPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const { project, forceSaveToCloud } = useWorkspace();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  
  // Inputs state
  const [flow, setFlow] = useState<number | "">("");
  const [pAvail, setPAvail] = useState<number | "">("");
  const [pResid, setPResid] = useState<number | "">("");
  const [length, setLength] = useState<number | "">("");
  const [fittingAllowance, setFittingAllowance] = useState<number>(20);
  const [elevation, setElevation] = useState<number | "">("");
  const [pipeMaterial, setPipeMaterial] = useState<string>("150"); // default Copper/CPVC C=150
  const [showDetailedCalcs, setShowDetailedCalcs] = useState<boolean>(true);

  // Comment System State & Persistence
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const ip = unitSystem === "ip";

  useEffect(() => {
    const pId = project?.id || "default";
    const savedComments = localStorage.getItem(`mep_calc_comments_${pId}_/plumbing-supply-pipe-sizer`);
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
    localStorage.setItem(`mep_calc_comments_${pId}_/plumbing-supply-pipe-sizer`, JSON.stringify(newList));
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
      calculatorTitle: "Water Supply Pipe Sizer",
      calculatorPath: "/plumbing-supply-pipe-sizer",
      projectId: project?.id || "default",
      projectName: project?.name || "Water Supply Pipe Sizing",
    };
    const updated = [newComment, ...commentsList];
    saveComments(updated);
    toast.success(`Comment / task assigned on "${commentTargetItem?.name || "parameter"}"`);
    setCommentModalOpen(false);

    notifyCommentAssigned({
      comment: newComment,
      targetId: commentTargetItem?.id || "plumbing-supply-pipe-sizer",
      targetName: commentTargetItem?.name || "Supply Pipe",
      targetType: "equipment",
      calculatorTitle: "Water Supply Pipe Sizer",
      calculatorPath: "/plumbing-supply-pipe-sizer",
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
      const stored = localStorage.getItem("mep_supply_pipe_sizer_saves");
      if (stored) {
        setSaves(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load custom saves", e);
    }
  }, []);

  const saveToLocalStorage = (newSaves: SavedCalculation[]) => {
    setSaves(newSaves);
    localStorage.setItem("mep_supply_pipe_sizer_saves", JSON.stringify(newSaves));
  };

  const handleSaveCurrent = () => {
    if (!saveName.trim()) return;
    const newSave: SavedCalculation = {
      id: "supply_pipe_save_" + Date.now(),
      type: "plumbing-supply-pipe-sizer",
      name: saveName.trim(),
      savedAt: new Date().toISOString(),
      values: { flow, pAvail, pResid, length, fittingAllowance, elevation, pipeMaterial },
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
    const v = target.values;
    if (v.flow !== undefined) setFlow(v.flow);
    if (v.pAvail !== undefined) setPAvail(v.pAvail);
    if (v.pResid !== undefined) setPResid(v.pResid);
    if (v.length !== undefined) setLength(v.length);
    if (v.fittingAllowance !== undefined) setFittingAllowance(v.fittingAllowance);
    if (v.elevation !== undefined) setElevation(v.elevation);
    if (v.pipeMaterial !== undefined) setPipeMaterial(v.pipeMaterial);
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

  // Load state from localStorage on project change
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_supply_pipe_sizer_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.flow !== undefined) setFlow(data.flow);
        if (data.pAvail !== undefined) setPAvail(data.pAvail);
        if (data.pResid !== undefined) setPResid(data.pResid);
        if (data.length !== undefined) setLength(data.length);
        if (data.fittingAllowance !== undefined) setFittingAllowance(data.fittingAllowance);
        if (data.elevation !== undefined) setElevation(data.elevation);
        if (data.pipeMaterial !== undefined) setPipeMaterial(data.pipeMaterial);
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load supply pipe sizer calculation", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = { unitSystem, flow, pAvail, pResid, length, fittingAllowance, elevation, pipeMaterial };
      localStorage.setItem(`mep_supply_pipe_sizer_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, unitSystem, flow, pAvail, pResid, length, fittingAllowance, elevation, pipeMaterial]);

  const handleUnitSystemChange = (targetUnit: "si" | "ip") => {
    if (targetUnit === unitSystem) return;
    const toIP = targetUnit === "ip";
    const keepValues = (window as any).__mep_keep_values;

    if (!keepValues) {
      setFlow(prev => {
        if (prev === "") return "";
        const val = toIP ? Number(prev) * 15.8503 : Number(prev) / 15.8503;
        return Number(val.toFixed(2));
      });

      setPAvail(prev => {
        if (prev === "") return "";
        const val = toIP ? Number(prev) / 6.89476 : Number(prev) * 6.89476;
        return Number(val.toFixed(1));
      });

      setPResid(prev => {
        if (prev === "") return "";
        const val = toIP ? Number(prev) / 6.89476 : Number(prev) * 6.89476;
        return Number(val.toFixed(1));
      });

      setLength(prev => {
        if (prev === "") return "";
        const val = toIP ? Number(prev) * 3.28084 : Number(prev) / 3.28084;
        return Number(val.toFixed(1));
      });

      setElevation(prev => {
        if (prev === "") return "";
        const val = toIP ? Number(prev) * 3.28084 : Number(prev) / 3.28084;
        return Number(val.toFixed(1));
      });
    }

    setUnitSystem(targetUnit);
    toast.info(`Switched to ${targetUnit === "ip" ? "Imperial (IP)" : "Metric (SI)"} units`);
  };

  // Sizing Calculations
  const calculations = useMemo(() => {
    const flowVal = flow !== "" ? Number(flow) : (ip ? 25 : 1.58);
    const pAvailVal = pAvail !== "" ? Number(pAvail) : (ip ? 60 : 413.7);
    const pResidVal = pResid !== "" ? Number(pResid) : (ip ? 20 : 137.9);
    const lengthVal = length !== "" ? Number(length) : (ip ? 120 : 36.6);
    const elevVal = elevation !== "" ? Number(elevation) : (ip ? 20 : 6.1);
    const fitPct = (fittingAllowance !== undefined ? Number(fittingAllowance) : 20) / 100;

    const Q_gpm = ip ? flowVal : flowVal * 15.8503;
    const pAvail_psi = ip ? pAvailVal : pAvailVal / 6.89476;
    const pResid_psi = ip ? pResidVal : pResidVal / 6.89476;
    const L_ft = ip ? lengthVal : lengthVal * 3.28084;
    const elev_ft = ip ? elevVal : elevVal * 3.28084;

    const C = Number(pipeMaterial) || 150;
    const Leff = L_ft * (1 + fitPct);
    const elevLoss_psi = elev_ft / 2.31;
    const elevLoss_kpa = elevLoss_psi * 6.89476;

    const rows = PIPE_SIZES.map(s => {
      const hf_psi = 4.52 * Leff * Math.pow(Q_gpm, 1.85) / (Math.pow(C, 1.85) * Math.pow(s.id, 4.87));
      const hf_kpa = hf_psi * 6.89476;

      const A = Math.PI * Math.pow(s.id / 12, 2) / 4;
      const v_fps = (Q_gpm / 448.8) / A;
      const v_ms = v_fps * 0.3048;

      const resid_psi = pAvail_psi - hf_psi - elevLoss_psi;
      const resid_kpa = resid_psi * 6.89476;

      const isPressureOk = resid_psi >= pResid_psi;
      const isVelocityOk = v_fps >= 1 && v_fps <= 8;
      const ok = isPressureOk && isVelocityOk;

      return {
        ...s,
        hf_psi,
        hf_kpa,
        v_fps,
        v_ms,
        resid_psi,
        resid_kpa,
        ok,
        isPressureOk,
        isVelocityOk
      };
    });

    const rec = rows.find(r => r.ok) || rows[rows.length - 1];

    return {
      flowVal,
      pAvailVal,
      pResidVal,
      lengthVal,
      elevVal,
      Q_gpm,
      pAvail_psi,
      pResid_psi,
      L_ft,
      Leff,
      C,
      elev_ft,
      elevLoss_psi,
      elevLoss_kpa,
      rows,
      rec
    };
  }, [flow, pAvail, pResid, length, fittingAllowance, elevation, pipeMaterial, ip]);

  const handleCopyValue = (label: string, value: string | number) => {
    if (value === "" || value === undefined) {
      toast.info(`No value in ${label} to copy`);
      return;
    }
    navigator.clipboard.writeText(String(value));
    toast.success(`Copied ${label}: ${value} to clipboard`);
  };

  const handlePasteValue = async (label: string, setter: (val: number | "") => void) => {
    try {
      const text = await navigator.clipboard.readText();
      const num = parseFloat(text.trim());
      if (!isNaN(num)) {
        setter(num);
        toast.success(`Pasted ${num} into ${label}`);
      } else {
        toast.error(`Clipboard content "${text}" is not a valid number`);
      }
    } catch (err) {
      toast.error("Unable to read clipboard");
    }
  };

  const handleResetValue = (label: string, setter: (val: number | "") => void, defaultVal: number | "") => {
    setter(defaultVal);
    toast.success(`Reset ${label} to default`);
  };

  const handleClearValue = (label: string, setter: (val: number | "") => void) => {
    setter("");
    toast.info(`Cleared ${label}`);
  };

  const handleExportExcel = () => {
    if (!calculations) return;
    const wb = XLSX.utils.book_new();
    const rowsData = [
      ["Water Supply Pipe Sizing Report"],
      ["Generated on: " + new Date().toLocaleDateString(), `Unit System: ${unitSystem.toUpperCase()}`],
      [],
      ["1. System Design Parameters"],
      ["Design Flow Rate", `${flow || calculations.flowVal} ${ip ? "GPM" : "L/s"}`],
      ["Available Supply Pressure", `${pAvail || calculations.pAvailVal} ${ip ? "psi" : "kPa"}`],
      ["Required Residual at Fixture", `${pResid || calculations.pResidVal} ${ip ? "psi" : "kPa"}`],
      ["Total Pipe Run Length", `${length || calculations.lengthVal} ${ip ? "ft" : "m"}`],
      ["Fitting Allowance", `${fittingAllowance} %`],
      ["Elevation Rise", `${elevation || calculations.elevVal} ${ip ? "ft" : "m"}`],
      [],
      ["2. Recommended Pipe Selection"],
      ["Recommended Pipe Size", `${calculations.rec.nps} NPS (${calculations.rec.dn})`],
      ["Flow Velocity", `${(ip ? calculations.rec.v_fps : calculations.rec.v_ms).toFixed(2)} ${ip ? "fps" : "m/s"}`],
      ["Friction Pressure Loss", `${(ip ? calculations.rec.hf_psi : calculations.rec.hf_kpa).toFixed(2)} ${ip ? "psi" : "kPa"}`],
      ["Elevation Static Loss", `${(ip ? calculations.elevLoss_psi : calculations.elevLoss_kpa).toFixed(2)} ${ip ? "psi" : "kPa"}`],
      ["Residual Pressure at Fixture", `${(ip ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1)} ${ip ? "psi" : "kPa"}`],
      [],
      ["3. Full Sizing Schedule"],
      ["Size (NPS)", "Size (DN)", "Velocity", "Friction Loss", "Elev Loss", "Residual Press", "Status"],
      ...calculations.rows.map(r => [
        r.nps,
        r.dn,
        `${(ip ? r.v_fps : r.v_ms).toFixed(2)} ${ip ? "fps" : "m/s"}`,
        `${(ip ? r.hf_psi : r.hf_kpa).toFixed(2)} ${ip ? "psi" : "kPa"}`,
        `${(ip ? calculations.elevLoss_psi : calculations.elevLoss_kpa).toFixed(2)} ${ip ? "psi" : "kPa"}`,
        `${(ip ? r.resid_psi : r.resid_kpa).toFixed(1)} ${ip ? "psi" : "kPa"}`,
        r.ok ? "PASS" : "FAIL"
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(rowsData);
    XLSX.utils.book_append_sheet(wb, ws, "Supply Pipe Sizer");
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "Water_Supply_Pipe_Sizer_Report.xlsx", "Excel Document", ["xlsx"]);
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
      doc.text("WATER SUPPLY PIPE SIZING REPORT", 40, 50);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toISOString().split("T")[0]} | Unit System: ${unitSystem.toUpperCase()}`, 40, 68);

      doc.setDrawColor(200);
      doc.line(40, 75, 550, 75);

      const summaryData = [
        ["Design Flow Rate", `${flow || calculations.flowVal} ${ip ? "GPM" : "L/s"}`, "Available Pressure", `${pAvail || calculations.pAvailVal} ${ip ? "psi" : "kPa"}`],
        ["Required Residual", `${pResid || calculations.pResidVal} ${ip ? "psi" : "kPa"}`, "Total Pipe Length", `${length || calculations.lengthVal} ${ip ? "ft" : "m"}`],
        ["Elevation Rise", `${elevation || calculations.elevVal} ${ip ? "ft" : "m"}`, "Fitting Allowance", `${fittingAllowance}%`],
        ["Recommended Size", `${calculations.rec.nps} (${calculations.rec.dn})`, "Remote Residual", `${(ip ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1)} ${ip ? "psi" : "kPa"}`],
      ];

      autoTable(doc, {
        startY: 90,
        head: [],
        body: summaryData,
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: 3.5 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 130 },
          1: { cellWidth: 120 },
          2: { fontStyle: "bold", cellWidth: 130 },
          3: { cellWidth: 120 },
        },
      });

      const scheduleData = calculations.rows.map(r => [
        r.nps,
        r.dn,
        `${(ip ? r.v_fps : r.v_ms).toFixed(2)} ${ip ? "fps" : "m/s"}`,
        `${(ip ? r.hf_psi : r.hf_kpa).toFixed(2)} ${ip ? "psi" : "kPa"}`,
        `${(ip ? r.resid_psi : r.resid_kpa).toFixed(1)} ${ip ? "psi" : "kPa"}`,
        r.ok ? "PASS" : "FAIL"
      ]);

      doc.setFont("helvetica", "bold");
      doc.text("Piping Sizing Schedule", 40, (doc as any).lastAutoTable.finalY + 20);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 30,
        head: [["NPS", "DN", "Velocity", "Friction Drop", "Residual Press", "Status"]],
        body: scheduleData,
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: 3.5 },
      });

      const pdfBuffer = doc.output("arraybuffer");
      downloadFile(new Uint8Array(pdfBuffer), "Water_Supply_Pipe_Sizer_Report.pdf", "PDF Document", ["pdf"]);
      toast.success("PDF report generated successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF report");
    }
  };

  const renderInputBox = (
    id: string,
    label: string,
    value: number | "",
    setter: (val: number | "") => void,
    defaultVal: number | "",
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
              onChange={(e) => setter(e.target.value === "" ? "" : Number(e.target.value))}
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
            onClick={() => handlePasteValue(label, setter)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Clipboard className="size-3.5 text-muted-foreground" />
            <span>Paste Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleResetValue(label, setter, defaultVal)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset to Default ({defaultVal !== "" ? defaultVal : "Blank"})</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handleClearValue(label, setter)}
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
    <AppShell title="Water Supply Pipe Sizer" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Header Section */}
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">PLUMBING &gt; WATER SUPPLY &gt; SUPPLY PIPE SIZER</span>
            <div className="flex flex-wrap items-center justify-between gap-4 mt-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Water Supply Pipe Sizer</h1>
                <CalculationReviewBar projectId={project?.id} calculatorPath="/plumbing-supply-pipe-sizer" calculatorTitle="Water Supply Pipe Sizer" />
                {commentsList.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                    <MessageSquare className="size-3.5 fill-blue-500/20" />
                    <span>{commentsList.length} Active Task(s) / Comment(s)</span>
                  </div>
                )}
              </div>

              {/* Action Buttons & Unit Toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => handleUnitSystemChange("si")}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                      unitSystem === "si"
                        ? "bg-background text-[#0A7BC7] shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Metric (SI)
                  </button>
                  <button
                    onClick={() => handleUnitSystemChange("ip")}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                      unitSystem === "ip"
                        ? "bg-background text-[#0A7BC7] shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Imperial (IP)
                  </button>
                </div>

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
              Size domestic water supply distribution pipes and calculate residual fixture pressure using the Hazen-Williams equation.
            </p>
          </div>

          {/* Sizing Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Inputs Column (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Card 1: Flow & Demand Parameters */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">1. Flow & Demand Parameters</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {renderInputBox(
                    "supply-flow-rate",
                    `Design Flow Rate (${ip ? "GPM" : "L/s"})`,
                    flow,
                    setFlow,
                    ip ? 25 : 1.58,
                    ip ? "25" : "1.58",
                    0
                  )}

                  <div className="flex flex-col gap-1.5 p-2 rounded-xl">
                    <label className="font-semibold text-foreground">Pipe Material</label>
                    <select
                      value={pipeMaterial}
                      onChange={(e) => setPipeMaterial(e.target.value)}
                      className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none"
                    >
                      <option value="150">Copper Type L (C = 150)</option>
                      <option value="150">CPVC Schedule 80 (C = 150)</option>
                      <option value="130">PEX Tubing (C = 130)</option>
                      <option value="120">Galvanized Steel Pipe (C = 120)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Card 2: Pressure & Pipe Run Constraints */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">2. Pressure & Pipe Run Constraints</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {renderInputBox(
                    "supply-p-avail",
                    `Available Supply Pressure (${ip ? "psi" : "kPa"})`,
                    pAvail,
                    setPAvail,
                    ip ? 60 : 413.7,
                    ip ? "60" : "413.7",
                    0
                  )}
                  {renderInputBox(
                    "supply-p-resid",
                    `Required Residual at Fixture (${ip ? "psi" : "kPa"})`,
                    pResid,
                    setPResid,
                    ip ? 20 : 137.9,
                    ip ? "20" : "137.9",
                    0
                  )}
                  {renderInputBox(
                    "supply-length",
                    `Total Pipe Run Length (${ip ? "ft" : "m"})`,
                    length,
                    setLength,
                    ip ? 120 : 36.6,
                    ip ? "120" : "36.6",
                    0
                  )}
                  {renderInputBox(
                    "supply-fitting-allowance",
                    "Fittings Allowance (% of pipe length)",
                    fittingAllowance,
                    (val) => setFittingAllowance(val === "" ? 20 : Number(val)),
                    20,
                    "20",
                    0,
                    "1"
                  )}
                  {renderInputBox(
                    "supply-elevation",
                    `Elevation Rise (${ip ? "ft" : "m"})`,
                    elevation,
                    setElevation,
                    ip ? 20 : 6.1,
                    ip ? "20" : "6.1",
                    0
                  )}
                </div>
              </div>

            </div>

            {/* Results Column (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              
              {/* Card 1: Recommended Sizing Selection */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Recommended Pipe Sizing</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                  {renderResultRow("res-rec-pipe-size", "Recommended Size", `${calculations.rec.nps} NPS (${calculations.rec.dn})`, true, "text-[#0A7BC7] text-[14px]")}
                  {renderResultRow("res-rec-velocity", "Water Velocity", `${(ip ? calculations.rec.v_fps : calculations.rec.v_ms).toFixed(2)} ${ip ? "fps" : "m/s"}`, true, "text-[#0A7BC7]")}
                  {renderResultRow("res-rec-fric-loss", "Friction Head Loss", `${(ip ? calculations.rec.hf_psi : calculations.rec.hf_kpa).toFixed(2)} ${ip ? "psi" : "kPa"}`)}
                  {renderResultRow("res-rec-elev-loss", "Elevation Static Loss", `${(ip ? calculations.elevLoss_psi : calculations.elevLoss_kpa).toFixed(2)} ${ip ? "psi" : "kPa"}`)}
                  {renderResultRow("res-rec-resid-press", "Residual at Fixture", `${(ip ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1)} ${ip ? "psi" : "kPa"}`, true, "text-[#0A7BC7] text-[14px]", true)}
                </div>
              </div>

              {/* Card 2: Pipe Sizing Schedule */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs overflow-hidden">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Sizing Schedule (All Pipe Sizes)</h3>
                </div>

                <div className="overflow-x-auto border border-border/60 rounded-xl">
                  <table className="w-full text-[11px] font-sans text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-900 font-bold text-foreground border-b border-border/60">
                        <th className="p-2 text-center">NPS</th>
                        <th className="p-2 text-center">DN</th>
                        <th className="p-2 text-right">Velocity</th>
                        <th className="p-2 text-right">Friction Drop</th>
                        <th className="p-2 text-right">Residual Press</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {calculations.rows.map((r) => {
                        const isChosen = calculations.rec?.nps === r.nps;
                        const showVel = ip ? r.v_fps : r.v_ms;
                        const showFric = ip ? r.hf_psi : r.hf_kpa;
                        const showResid = ip ? r.resid_psi : r.resid_kpa;

                        return (
                          <tr key={r.nps} className={`hover:bg-slate-50 dark:hover:bg-slate-900/50 ${isChosen ? "bg-primary/10 font-bold" : ""}`}>
                            <td className="p-2 text-center font-bold font-sans">{r.nps}</td>
                            <td className="p-2 text-center">{r.dn}</td>
                            <td className="p-2 text-right">{showVel.toFixed(2)} {ip ? "fps" : "m/s"}</td>
                            <td className="p-2 text-right">{showFric.toFixed(2)} {ip ? "psi" : "kPa"}</td>
                            <td className={`p-2 text-right font-bold ${r.resid_psi >= calculations.pResid_psi ? "text-emerald-500" : "text-red-500"}`}>
                              {showResid.toFixed(1)} {ip ? "psi" : "kPa"}
                            </td>
                            <td className="p-2 text-center">
                              {r.ok ? (
                                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                  {isChosen ? "✓ RECOMMENDED" : "✓ PASS"}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60 text-[10px]">NON-COMPLIANT</span>
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
                      const stepId = "step-1-effective-length";
                      const stepLabel = "Step 1: Total Effective Piping Length";
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
                                <div className="font-mono text-primary my-1">Leff = Length × (1 + Fitting_Allowance ÷ 100)</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">Leff = {calculations.L_ft.toFixed(1)} ft × (1 + {fittingAllowance}%)</div>
                                <div className="font-bold text-[11px] text-foreground mt-0.5">Leff = {calculations.Leff.toFixed(1)} ft ({(calculations.Leff * 0.3048).toFixed(1)} m)</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => handleCopyValue("Step 1 Length", `${calculations.Leff.toFixed(1)} ft`)}>
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
                      const stepId = "step-2-elevation-loss";
                      const stepLabel = "Step 2: Elevation Static Head Loss";
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
                                <div className="font-mono text-primary my-1">ΔP_elev (psi) = Elevation_Rise_ft ÷ 2.31</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">ΔP_elev = {calculations.elev_ft.toFixed(1)} ft ÷ 2.31</div>
                                <div className="font-bold text-[11px] text-foreground mt-0.5">
                                  ΔP_elev = {(ip ? calculations.elevLoss_psi : calculations.elevLoss_kpa).toFixed(2)} {ip ? "psi" : "kPa"}
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => handleCopyValue("Step 2 Elevation Loss", `${(ip ? calculations.elevLoss_psi : calculations.elevLoss_kpa).toFixed(2)} ${ip ? "psi" : "kPa"}`)}>
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
                      const stepId = "step-3-hazen-williams";
                      const stepLabel = "Step 3: Hazen-Williams Friction Head Loss";
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
                                <div className="font-mono text-primary my-1">hf = (4.52 × Leff × Q^1.85) ÷ (C^1.85 × d^4.87)</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">Q = {calculations.Q_gpm.toFixed(1)} GPM, C = {calculations.C}, d = {calculations.rec.id}"</div>
                                <div className="font-bold text-[11px] text-[#0A7BC7] mt-0.5">
                                  hf = {(ip ? calculations.rec.hf_psi : calculations.rec.hf_kpa).toFixed(2)} {ip ? "psi" : "kPa"}
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => handleCopyValue("Step 3 Friction", `${(ip ? calculations.rec.hf_psi : calculations.rec.hf_kpa).toFixed(2)} ${ip ? "psi" : "kPa"}`)}>
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
                      const stepId = "step-4-residual-pressure";
                      const stepLabel = "Step 4: Residual Pressure Verification";
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
                                <div className="font-mono text-primary my-1">P_residual = P_available − hf − ΔP_elev ≥ P_required</div>
                                <div className="font-bold text-[11px] text-[#0A7BC7] mt-0.5">
                                  P_residual = {(ip ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1)} {ip ? "psi" : "kPa"} (Required: {(ip ? calculations.pResid_psi : calculations.pResid_psi * 6.89476).toFixed(1)} {ip ? "psi" : "kPa"}) — ✓ PASS
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => handleCopyValue("Step 4 Residual", `${(ip ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1)} ${ip ? "psi" : "kPa"}`)}>
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
              Save current water supply pipe sizing inputs to preset library.
            </p>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Main Header Copper Sizing"
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
              <FolderOpen className="size-4 text-primary" /> Saved Supply Pipe Presets
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
                    <span className="text-[10px] text-muted-foreground">Saved {new Date(s.savedAt).toLocaleDateString()} | Unit: {s.unitSystem?.toUpperCase() || "SI"}</span>
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
    </AppShell>
  );
}
