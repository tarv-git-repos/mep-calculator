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
import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { EditChwPumpModal } from "@/components/workspace/EditChwPumpModal";

export const Route = createFileRoute("/chw-pump-head")({
  head: () => ({
    meta: [
      { title: "CHW Pump Head — MEP Calc" },
      { name: "description", content: "Chilled water pump head loss sizer based on pipe friction, fittings losses, and static elevation." },
    ],
  }),
  component: ChwPumpHeadPage,
});

interface SavedCalculation {
  id: string;
  type: string;
  name: string;
  savedAt: string;
  values: Record<string, any>;
  unitSystem: "si" | "ip";
}

function ChwPumpHeadPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, forceSaveToCloud } = useWorkspace();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

  // State matching the calculation variables
  const [sizingParams, setSizingParams] = useState({
    flowUsgpm: "" as number | "",
    flowLps: "" as number | "",
    vertLength: "" as number | "",
    horizLength: "" as number | "",
    frictionFactor: "" as number | "",
    staticHead: "" as number | "",
    residualPressure: "" as number | "",
    suctionPressure: "" as number | "",
    safetyFactorHead: 5 as number | "", // %
    selectedHead: "" as number | "", // bar or psi (override)
    effMotor: 85 as number | "", // %
    effPump: 70 as number | "", // %
  });

  const [projectInfo, setProjectInfo] = useState({
    projectName: "Commercial Tower CHW Pumping Study",
    projectNumber: "MEP-CHW-02",
    client: "Summit Estates Ltd",
    consultant: "Consistent Engineering Consultants",
    date: new Date().toISOString().split("T")[0],
    revision: "Rev 0",
    calcNumber: "CALC-HVAC-PMP02",
    notes: "Chilled water secondary circulation loop pump head and fittings loss calculation report.",
  });

  // Expandable sections
  const [showDetailedCalcs, setShowDetailedCalcs] = useState<boolean>(true);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Comment System State & Persistence
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pId = project?.id || "default";
    const savedComments = localStorage.getItem(`mep_calc_comments_${pId}_/chw-pump-head`);
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
    localStorage.setItem(`mep_calc_comments_${pId}_/chw-pump-head`, JSON.stringify(newList));
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
      calculatorTitle: "CHW Pump Head",
      calculatorPath: "/chw-pump-head",
      projectId: project?.id || "default",
      projectName: project?.name || "CHW Pump Head",
    };
    const updated = [newComment, ...commentsList];
    saveComments(updated);
    toast.success(`Comment / task assigned on "${commentTargetItem?.name || "parameter"}"`);
    setCommentModalOpen(false);

    notifyCommentAssigned({
      comment: newComment,
      targetId: commentTargetItem?.id || "chw-pump-head",
      targetName: commentTargetItem?.name || "Chilled Water Pump",
      targetType: "equipment",
      calculatorTitle: "CHW Pump Head Loss Sizer",
      calculatorPath: "/chw-pump-head",
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

  // Load from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("chw_pump_sizer_v2_params");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sizingParams) setSizingParams(parsed.sizingParams);
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
      localStorage.setItem("chw_pump_sizer_v2_params", JSON.stringify({ sizingParams: params, unitSystem: unit, projectInfo: proj }));
      dirtyStore.set(true);
    } catch (e) {
      console.error(e);
    }
  };

  // Convert values when unit system changes
  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;

    const nextParams = { ...sizingParams };

    if (unit === "ip") {
      // SI -> IP
      if (sizingParams.vertLength !== "") nextParams.vertLength = Number((Number(sizingParams.vertLength) * 3.28084).toFixed(1));
      if (sizingParams.horizLength !== "") nextParams.horizLength = Number((Number(sizingParams.horizLength) * 3.28084).toFixed(1));
      if (sizingParams.frictionFactor !== "") nextParams.frictionFactor = Number((Number(sizingParams.frictionFactor) * 4.4207).toFixed(3));
      if (sizingParams.staticHead !== "") nextParams.staticHead = Number((Number(sizingParams.staticHead) * 14.50377).toFixed(2));
      if (sizingParams.residualPressure !== "") nextParams.residualPressure = Number((Number(sizingParams.residualPressure) * 14.50377).toFixed(2));
      if (sizingParams.suctionPressure !== "") nextParams.suctionPressure = Number((Number(sizingParams.suctionPressure) * 14.50377).toFixed(2));
      if (sizingParams.selectedHead !== "" && Number(sizingParams.selectedHead) > 0) {
        nextParams.selectedHead = Number((Number(sizingParams.selectedHead) * 14.50377).toFixed(2));
      }
    } else {
      // IP -> SI
      if (sizingParams.vertLength !== "") nextParams.vertLength = Number((Number(sizingParams.vertLength) / 3.28084).toFixed(1));
      if (sizingParams.horizLength !== "") nextParams.horizLength = Number((Number(sizingParams.horizLength) / 3.28084).toFixed(1));
      if (sizingParams.frictionFactor !== "") nextParams.frictionFactor = Number((Number(sizingParams.frictionFactor) / 4.4207).toFixed(3));
      if (sizingParams.staticHead !== "") nextParams.staticHead = Number((Number(sizingParams.staticHead) / 14.50377).toFixed(2));
      if (sizingParams.residualPressure !== "") nextParams.residualPressure = Number((Number(sizingParams.residualPressure) / 14.50377).toFixed(2));
      if (sizingParams.suctionPressure !== "") nextParams.suctionPressure = Number((Number(sizingParams.suctionPressure) / 14.50377).toFixed(2));
      if (sizingParams.selectedHead !== "" && Number(sizingParams.selectedHead) > 0) {
        nextParams.selectedHead = Number((Number(sizingParams.selectedHead) / 14.50377).toFixed(2));
      }
    }

    saveParams(nextParams, unit, projectInfo);
    toast.info(`Switched to ${unit === "ip" ? "Imperial (IP)" : "Metric (SI)"} units`);
  };

  // Custom Load/Save presets dialogs
  const [saves, setSaves] = useState<SavedCalculation[]>([]);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [showLoadModal, setShowLoadModal] = useState<boolean>(false);
  const [saveName, setSaveName] = useState<string>("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mep_chw_pump_custom_saves");
      if (stored) {
        setSaves(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load custom saves", e);
    }
  }, []);

  const saveToLocalStorage = (newSaves: SavedCalculation[]) => {
    setSaves(newSaves);
    localStorage.setItem("mep_chw_pump_custom_saves", JSON.stringify(newSaves));
  };

  const handleSaveCurrent = () => {
    if (!saveName.trim()) return;
    const newSave: SavedCalculation = {
      id: "chw_save_" + Date.now(),
      type: "chw-pump-head",
      name: saveName.trim(),
      savedAt: new Date().toISOString(),
      values: { ...sizingParams },
      unitSystem
    };
    const updated = [newSave, ...saves];
    saveToLocalStorage(updated);
    setSaveName("");
    setShowSaveModal(false);
    toast.success(`Preset "${newSave.name}" saved successfully`);
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

  // Calculations matching original exact website calcFpump logic
  const calculatedData = useMemo(() => {
    const ip = unitSystem === "ip";
    
    const flowGpm = sizingParams.flowUsgpm !== "" ? Number(sizingParams.flowUsgpm) : (ip ? 500 : 500);
    const vertL = sizingParams.vertLength !== "" ? Number(sizingParams.vertLength) : (ip ? 100 : 30);
    const horizL = sizingParams.horizLength !== "" ? Number(sizingParams.horizLength) : (ip ? 400 : 120);
    const ff = sizingParams.frictionFactor !== "" ? Number(sizingParams.frictionFactor) : (ip ? 1.77 : 0.4);
    const statH = sizingParams.staticHead !== "" ? Number(sizingParams.staticHead) : (ip ? 43.5 : 3.0);
    const resP = sizingParams.residualPressure !== "" ? Number(sizingParams.residualPressure) : (ip ? 29 : 2.0);
    const sucP = sizingParams.suctionPressure !== "" ? Number(sizingParams.suctionPressure) : 0.0;
    const sfPercent = sizingParams.safetyFactorHead !== "" ? Number(sizingParams.safetyFactorHead) : 5;
    const effPumpVal = sizingParams.effPump !== "" ? Number(sizingParams.effPump) : 70;
    const effMotorVal = sizingParams.effMotor !== "" ? Number(sizingParams.effMotor) : 85;

    // Normalized internal calculation values in Metric base (m, bar, L/s)
    const L_vert_m = ip ? vertL / 3.28084 : vertL;
    const L_horiz_m = ip ? horizL / 3.28084 : horizL;
    const Q_flow = (flowGpm * 3.78) / 60; // L/s

    // Elbows & Reducers and Isolation Valves calculated dynamically: (vertical + horizontal) * 0.3
    const L_elbows_m = (L_vert_m + L_horiz_m) * 0.3;
    const L_valves_m = (L_vert_m + L_horiz_m) * 0.3;

    // Safety factor for equivalent length is 5%
    const L_sum_m = L_vert_m + L_horiz_m + L_elbows_m + L_valves_m;
    const L_equiv_m = Math.ceil((L_sum_m * 1.05) / 10) * 10;

    const ff_metric = ip ? ff / 4.4207 : ff;
    const H_loss_bar = L_equiv_m * (ff_metric / 100);

    const H_static_bar = ip ? statH / 14.50377 : statH;
    const H_outlet_bar = ip ? resP / 14.50377 : resP;
    const H_suction_bar = ip ? sucP / 14.50377 : sucP;

    const H_pump_calc_bar = Math.max(0, (H_loss_bar + H_static_bar + H_outlet_bar) - H_suction_bar) * (1 + sfPercent / 100);

    // Selected Head
    const rawSelected = Number(sizingParams.selectedHead) || 0;
    const H_selected_bar = rawSelected > 0 
      ? (ip ? rawSelected / 14.50377 : rawSelected) 
      : H_pump_calc_bar;

    const F_flow = Q_flow; // kg/s (assuming water density = 1)
    const L_lift_kpa = H_selected_bar * 100; // kPa

    const eff_pump = (effPumpVal || 70) / 100;
    const eff_motor = (effMotorVal || 85) / 100;

    // Shaft Power = (Flow * Head Lift) / (1000 * Pump Efficiency)
    const P_shaft_kw = (F_flow * L_lift_kpa) / (1000 * (eff_pump || 0.7));
    const P_motor_kw = P_shaft_kw / (eff_motor || 0.85);
    const HP = P_motor_kw * 1.34102;

    // Convert display outputs based on unit system
    const displayLengthUnit = ip ? "ft" : "m";
    const displayHeadUnit = ip ? "psi" : "bar";
    const displayFlowUnit = ip ? "GPM" : "L/s";

    const toDisplayLength = (m: number) => ip ? m * 3.28084 : m;
    const toDisplayHead = (bar: number) => ip ? bar * 14.50377 : bar;
    const toDisplayFlow = (lps: number) => ip ? lps * 15.8503 : lps;

    return {
      flowRate: Q_flow,
      flowGpm,
      vertL,
      horizL,
      ff,
      statH,
      resP,
      sucP,
      sfPercent,
      effPumpVal,
      effMotorVal,
      L_vert_m,
      L_horiz_m,
      L_sum_m,
      L_equiv_m,
      H_loss_bar,
      H_static_bar,
      H_outlet_bar,
      H_suction_bar,
      H_pump_calc_bar,
      H_selected_bar,
      flowRateDisplay: ip ? flowGpm : toDisplayFlow(Q_flow),
      sumLengthsDisplay: toDisplayLength(L_sum_m),
      equivLengthDisplay: toDisplayLength(L_equiv_m),
      elbowsLengthDisplay: toDisplayLength(L_elbows_m),
      valvesLengthDisplay: toDisplayLength(L_valves_m),
      vertLengthDisplay: toDisplayLength(L_vert_m),
      horizLengthDisplay: toDisplayLength(L_horiz_m),
      frictionLossDisplay: toDisplayHead(H_loss_bar),
      staticHeadDisplay: toDisplayHead(H_static_bar),
      residualPressureDisplay: toDisplayHead(H_outlet_bar),
      outletHeadDisplay: toDisplayHead(H_outlet_bar),
      suctionPressureDisplay: toDisplayHead(H_suction_bar),
      suctionHeadDisplay: toDisplayHead(H_suction_bar),
      pumpHeadCalcDisplay: toDisplayHead(H_pump_calc_bar),
      pumpHeadSelectedDisplay: toDisplayHead(H_selected_bar),
      selectedHeadDisplay: toDisplayHead(H_selected_bar),
      massFlow: F_flow,
      liftKpa: L_lift_kpa,
      shaftPowerKw: P_shaft_kw,
      motorPowerKw: P_motor_kw,
      motorPowerHp: HP,
      lengthUnit: displayLengthUnit,
      headUnit: displayHeadUnit,
      flowUnit: displayFlowUnit,
    };
  }, [sizingParams, unitSystem]);

  // Copy / Paste / Reset helpers
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
        if (fieldKey === "flowUsgpm") {
          next.flowLps = Number((num * 3.78 / 60).toFixed(2));
        }
        saveParams(next, unitSystem, projectInfo);
        toast.success(`Pasted ${num} into ${label}`);
      } else {
        toast.error(`Clipboard content "${text}" is not a valid number`);
      }
    } catch (err) {
      toast.error("Unable to read clipboard");
    }
  };

  const handleResetValue = (label: string, fieldKey: keyof typeof sizingParams, defaultVal: number | "") => {
    const next = { ...sizingParams, [fieldKey]: defaultVal };
    if (fieldKey === "flowUsgpm") {
      next.flowLps = defaultVal !== "" ? Number((Number(defaultVal) * 3.78 / 60).toFixed(2)) : "";
    }
    saveParams(next, unitSystem, projectInfo);
    toast.success(`Reset ${label} to default ${defaultVal !== "" ? defaultVal : "(blank)"}`);
  };

  const handleClearValue = (label: string, fieldKey: keyof typeof sizingParams) => {
    const next = { ...sizingParams, [fieldKey]: "" };
    if (fieldKey === "flowUsgpm") next.flowLps = "";
    saveParams(next, unitSystem, projectInfo);
    toast.info(`Cleared ${label}`);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ projectInfo, sizingParams, unitSystem }));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${projectInfo.projectName.replace(/\s+/g, "_")}_chw_pump_head.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Exported calculation JSON");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
        if (parsed.sizingParams) setSizingParams(parsed.sizingParams);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
        toast.success("Loaded configuration from JSON file");
      } catch (err) {
        toast.error("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const handleExportExcel = async () => {
    try {
      const wb = XLSX.utils.book_new();
      const data = [
        ["CHW Pump Head Loss & Motor Sizing Calculation"],
        ["Generated on: " + new Date().toLocaleDateString(), `Unit System: ${unitSystem.toUpperCase()}`],
        [],
        ["1. Flow Demand Parameters"],
        ["Design Flow Rate", `${calculatedData.flowRateDisplay.toFixed(2)} ${calculatedData.flowUnit}`],
        ["Metric Flow Basis", `${calculatedData.flowRate.toFixed(2)} L/s (${calculatedData.massFlow.toFixed(3)} kg/s)`],
        [],
        ["2. Piping Run & Friction Losses"],
        ["Vertical Pipe Length", `${calculatedData.vertLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`],
        ["Horizontal Pipe Length", `${calculatedData.horizLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`],
        ["Sum of Straight Pipe Lengths", `${(calculatedData.vertLengthDisplay + calculatedData.horizLengthDisplay).toFixed(1)} ${calculatedData.lengthUnit}`],
        ["Elbows & Reducers Allowance (+30%)", `${calculatedData.elbowsLengthDisplay.toFixed(2)} ${calculatedData.lengthUnit}`],
        ["Valves & Accessories Allowance (+30%)", `${calculatedData.valvesLengthDisplay.toFixed(2)} ${calculatedData.lengthUnit}`],
        ["Total Equivalent Length (with 5% Safety)", `${calculatedData.equivLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`],
        ["Design Friction Factor", `${sizingParams.frictionFactor || (unitSystem === "ip" ? 1.77 : 0.4)} ${unitSystem === "ip" ? "psi/100ft" : "bar/100m"}`],
        ["Head Loss in Piping Run", `${calculatedData.frictionLossDisplay.toFixed(3)} ${calculatedData.headUnit}`],
        [],
        ["3. Pump Head Requirements"],
        ["Static Elevation Lift", `${calculatedData.staticHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
        ["Residual Pressure at Outlet", `${calculatedData.outletHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
        ["Suction Pressure (Deducted)", `-${calculatedData.suctionHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
        ["Safety Margin Applied", `${calculatedData.sfPercent}%`],
        ["Total Calculated Dynamic Head (TDH)", `${calculatedData.pumpHeadCalcDisplay.toFixed(3)} ${calculatedData.headUnit}`],
        ["Selected Operating Head", `${calculatedData.selectedHeadDisplay.toFixed(3)} ${calculatedData.headUnit}`],
        [],
        ["4. Motor & Pump Selection"],
        ["Pump Hydraulic Efficiency", `${calculatedData.effPumpVal}%`],
        ["Motor Efficiency", `${calculatedData.effMotorVal}%`],
        ["Hydraulic Shaft Power", `${calculatedData.shaftPowerKw.toFixed(2)} kW`],
        ["Total Estimated Motor Power", `${calculatedData.motorPowerKw.toFixed(2)} kW / ${calculatedData.motorPowerHp.toFixed(2)} HP`],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "CHW Pump Head");
      const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      downloadFile(new Uint8Array(xlsxBuffer), "CHW_Pump_Head_Calculation.xlsx", "Excel Document", ["xlsx"]);
      toast.success("Excel report exported successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export Excel report");
    }
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
      doc.text("PUMP HEAD CALCULATION REPORT", 40, 50);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Generated on: ${projectInfo.date} | Calculation Ref: ${projectInfo.calcNumber} | Unit: ${unitSystem.toUpperCase()}`, 40, 68);

      doc.setDrawColor(200);
      doc.line(40, 75, 550, 75);

      // 1. Project details
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text("1. Project Details", 40, 95);

      const projectData = [
        ["Project Name", projectInfo.projectName, "Project Number", projectInfo.projectNumber],
        ["Consultant", projectInfo.consultant, "Client", projectInfo.client],
        ["Revision", projectInfo.revision, "Calculation Ref", projectInfo.calcNumber],
      ];

      autoTable(doc, {
        startY: 105,
        head: [],
        body: projectData,
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 90 },
          1: { cellWidth: 170 },
          2: { fontStyle: "bold", cellWidth: 90 },
          3: { cellWidth: 170 },
        },
      });

      // 2. Design Sizing Parameters
      doc.setFont("helvetica", "bold");
      doc.text("2. Design Sizing Parameters", 40, (doc as any).lastAutoTable.finalY + 20);

      const paramData = [
        ["Design Flow Rate", `${calculatedData.flowRateDisplay.toFixed(2)} ${calculatedData.flowUnit}`, "Vertical Pipe Length", `${calculatedData.vertLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`],
        ["Horizontal Pipe Length", `${calculatedData.horizLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`, "Design Friction Factor", `${sizingParams.frictionFactor || (unitSystem === "ip" ? 1.77 : 0.4)} ${unitSystem === "ip" ? "psi/100ft" : "bar/100m"}`],
        ["Static Elevation Head", `${calculatedData.staticHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`, "Residual Pressure at Outlet", `${calculatedData.outletHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
        ["Suction Pressure (Available)", `${calculatedData.suctionHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`, "Safety Margin applied", `${calculatedData.sfPercent}%`],
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 30,
        head: [],
        body: paramData,
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: 3.5 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 130 },
          1: { cellWidth: 120 },
          2: { fontStyle: "bold", cellWidth: 130 },
          3: { cellWidth: 120 },
        },
      });

      // 3. Friction & Equivalent Length Breakdown
      doc.setFont("helvetica", "bold");
      doc.text("3. Friction and Equivalent Length Breakdown", 40, (doc as any).lastAutoTable.finalY + 20);

      const breakdownData = [
        ["Vertical + Horizontal length sum", `${calculatedData.vertLengthDisplay.toFixed(1)} + ${calculatedData.horizLengthDisplay.toFixed(1)} = ${(calculatedData.vertLengthDisplay + calculatedData.horizLengthDisplay).toFixed(1)} ${calculatedData.lengthUnit}`],
        ["Fittings equivalent allowance", `Elbows: ${calculatedData.elbowsLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit} | Valves: ${calculatedData.valvesLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`],
        ["Total design equivalent length", `${calculatedData.equivLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`],
        ["Major + Minor Friction losses", `${calculatedData.frictionLossDisplay.toFixed(3)} ${calculatedData.headUnit}`],
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 30,
        head: [],
        body: breakdownData,
        theme: "plain",
        styles: { fontSize: 8.5, cellPadding: 3.5 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 180 },
          1: { cellWidth: 320 },
        },
      });

      // 4. Head & Motor Selection Sizing Results
      doc.setFont("helvetica", "bold");
      doc.text("4. Head & Motor Selection Sizing Results", 40, (doc as any).lastAutoTable.finalY + 20);

      const resultsData = [
        ["Piping Friction Loss head", `${calculatedData.frictionLossDisplay.toFixed(3)} ${calculatedData.headUnit}`],
        ["Static Elevation Head lift", `${calculatedData.staticHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
        ["Residual pressure required", `${calculatedData.outletHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
        ["Suction pressure deducted", `-${calculatedData.suctionHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`],
        ["Total dynamic Head (TDH)", `${calculatedData.pumpHeadCalcDisplay.toFixed(3)} ${calculatedData.headUnit}`],
        ["Estimated motor power required", `${calculatedData.motorPowerKw.toFixed(2)} kW (${calculatedData.motorPowerHp.toFixed(2)} HP)`],
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 30,
        head: [],
        body: resultsData,
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: 3.5 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 180 },
          1: { cellWidth: 320 },
        },
      });

      const sigFinalY = (doc as any).lastAutoTable?.finalY || 40;
      addPdfSignatureBlock(doc, sigFinalY, currentUserName, project?.id || "default", "chw-pump-head");
      const pdfBuffer = doc.output("arraybuffer");
      downloadFile(new Uint8Array(pdfBuffer), `${projectInfo.projectName.replace(/\s+/g, "_")}_report.pdf`, "PDF Document", ["pdf"]);
      toast.success("PDF report generated successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF report");
    }
  };

  // Helper component to render an input field wrapped with Context Menu and Comment Indicator
  const renderInputBox = (
    id: string,
    fieldKey: keyof typeof sizingParams,
    label: string,
    value: number | "",
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
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                const next = { ...sizingParams, [fieldKey]: val };
                if (fieldKey === "flowUsgpm") {
                  next.flowLps = val !== "" ? Number((Number(val) * 3.78 / 60).toFixed(2)) : "";
                }
                saveParams(next, unitSystem, projectInfo);
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

  // Helper component to render a result output row wrapped with Context Menu and Comment Indicator
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
    <AppShell title="CHW Pump Head" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6">
          
          {/* Header Section matching screenshot */}
          <div className="flex flex-col gap-1 select-none">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; HYDRONIC &gt; CHW PUMP HEAD</span>
            <div className="flex flex-wrap items-center justify-between gap-4 mt-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">CHW Pump Head</h1>
                <CalculationReviewBar projectId={project?.id} calculatorPath="/chw-pump-head" calculatorTitle="CHW Pump Head" />
                {commentsList.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                    <MessageSquare className="size-3.5 fill-blue-500/20" />
                    <span>{commentsList.length} Active Task(s) / Comment(s)</span>
                  </div>
                )}
              </div>

              {/* Unit System Toggle & Action Buttons */}
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
              Calculate chilled water pump dynamic piping friction losses, fittings equivalent lengths, static lift, and motor power requirements.
            </p>
          </div>

          {/* Core Calculator Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Inputs Column (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Card 1: Flow Demand Parameters */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">1. Flow Demand Parameters</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {renderInputBox(
                    "chw-flow-rate",
                    "flowUsgpm",
                    `Design Flow Rate (${unitSystem === "ip" ? "GPM" : "L/s equivalent basis"})`,
                    sizingParams.flowUsgpm,
                    unitSystem === "ip" ? 500 : 500,
                    unitSystem === "ip" ? "500" : "500",
                    0
                  )}
                </div>
              </div>

              {/* Card 2: Piping Run & Friction Losses */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">2. Piping Run & Friction Losses</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {renderInputBox(
                    "chw-vert-length",
                    "vertLength",
                    `Vertical Pipe Length (${calculatedData.lengthUnit})`,
                    sizingParams.vertLength,
                    unitSystem === "ip" ? 100 : 30,
                    unitSystem === "ip" ? "100" : "30",
                    0
                  )}
                  {renderInputBox(
                    "chw-horiz-length",
                    "horizLength",
                    `Horizontal Pipe Length (${calculatedData.lengthUnit})`,
                    sizingParams.horizLength,
                    unitSystem === "ip" ? 400 : 120,
                    unitSystem === "ip" ? "400" : "120",
                    0
                  )}
                  {renderInputBox(
                    "chw-friction-factor",
                    "frictionFactor",
                    `Piping Friction Factor (${unitSystem === "ip" ? "psi/100ft" : "bar/100m length"})`,
                    sizingParams.frictionFactor,
                    unitSystem === "ip" ? 1.77 : 0.4,
                    unitSystem === "ip" ? "1.77" : "0.4",
                    0,
                    "0.01"
                  )}
                </div>
              </div>

              {/* Card 3: Pump Head Requirements */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">3. Pump Head Requirements</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {renderInputBox(
                    "chw-static-head",
                    "staticHead",
                    `Static Elevation Lift (${calculatedData.headUnit})`,
                    sizingParams.staticHead,
                    unitSystem === "ip" ? 43.5 : 3.0,
                    unitSystem === "ip" ? "43.5" : "3.0",
                    0,
                    "0.1"
                  )}
                  {renderInputBox(
                    "chw-residual-pressure",
                    "residualPressure",
                    `Residual Pressure at Outlet (${calculatedData.headUnit})`,
                    sizingParams.residualPressure,
                    unitSystem === "ip" ? 29.0 : 2.0,
                    unitSystem === "ip" ? "29.0" : "2.0",
                    0,
                    "0.1"
                  )}
                  {renderInputBox(
                    "chw-suction-pressure",
                    "suctionPressure",
                    `Suction Pressure (Available Deducted) (${calculatedData.headUnit})`,
                    sizingParams.suctionPressure,
                    0.0,
                    "0.0",
                    0,
                    "0.1"
                  )}
                  {renderInputBox(
                    "chw-safety-margin",
                    "safetyFactorHead",
                    "Considering Safety Margin (%)",
                    sizingParams.safetyFactorHead,
                    5,
                    "5",
                    0,
                    "1"
                  )}
                  {renderInputBox(
                    "chw-selected-head",
                    "selectedHead",
                    `Selected Operating Head (Override) (${calculatedData.headUnit})`,
                    sizingParams.selectedHead,
                    "",
                    "Same as calculated head if blank",
                    0,
                    "0.1"
                  )}
                </div>
              </div>

              {/* Card 4: Motor & Pump Efficiencies */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">4. Motor & Pump Efficiencies</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {renderInputBox(
                    "chw-eff-pump",
                    "effPump",
                    "Pump Hydraulic Efficiency (%)",
                    sizingParams.effPump,
                    70,
                    "70",
                    1,
                    "1"
                  )}
                  {renderInputBox(
                    "chw-eff-motor",
                    "effMotor",
                    "Motor Efficiency (%)",
                    sizingParams.effMotor,
                    85,
                    "85",
                    1,
                    "1"
                  )}
                </div>
              </div>

            </div>

            {/* Results Column (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              
              {/* Card 1: Piping & Equivalent Length Results */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Piping & Friction Loss Results</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                  {renderResultRow("res-sum-lengths", "Sum of Straight Lengths", `${(calculatedData.vertLengthDisplay + calculatedData.horizLengthDisplay).toFixed(1)} ${calculatedData.lengthUnit}`)}
                  {renderResultRow("res-elbows-eq", "Elbows Equivalent Length (+30%)", `${calculatedData.elbowsLengthDisplay.toFixed(2)} ${calculatedData.lengthUnit}`)}
                  {renderResultRow("res-valves-eq", "Valves Equivalent Length (+30%)", `${calculatedData.valvesLengthDisplay.toFixed(2)} ${calculatedData.lengthUnit}`)}
                  {renderResultRow("res-total-eq", "Total Equivalent Length (+5% SF)", `${calculatedData.equivLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`, true, "text-[#0A7BC7] text-[13px]")}
                  {renderResultRow("res-friction-loss", "Major + Minor Friction Losses", `${calculatedData.frictionLossDisplay.toFixed(3)} ${calculatedData.headUnit}`, true, "text-[#0A7BC7] text-[13.5px]", true)}
                </div>
              </div>

              {/* Card 2: Pump Head & Motor Sizing Results */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Pump Head & Motor Sizing Results</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                  {renderResultRow("res-flow-rate", "Design Flow Rate", `${calculatedData.flowRateDisplay.toFixed(2)} ${calculatedData.flowUnit}`, true, "text-[#0A7BC7]")}
                  {renderResultRow("res-static-lift", "Static Elevation Lift", `${calculatedData.staticHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`)}
                  {renderResultRow("res-residual-outlet", "Residual Outlet Pressure", `${calculatedData.outletHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`)}
                  {renderResultRow("res-suction-deducted", "Suction Pressure Deducted", `-${calculatedData.suctionHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`)}
                  {renderResultRow("res-total-pump-head", "Total Calculated Pump Head (TDH)", `${calculatedData.pumpHeadCalcDisplay.toFixed(3)} ${calculatedData.headUnit}`, true, "text-[#0A7BC7] text-[14px]", true)}
                  {renderResultRow("res-selected-head", "Selected Operating Head", `${calculatedData.selectedHeadDisplay.toFixed(3)} ${calculatedData.headUnit}`)}
                  {renderResultRow("res-shaft-power", "Hydraulic Shaft Power", `${calculatedData.shaftPowerKw.toFixed(2)} kW`)}
                  {renderResultRow("res-total-motor-power", "Estimated Motor Power Requirement", `${calculatedData.motorPowerKw.toFixed(2)} kW (${calculatedData.motorPowerHp.toFixed(2)} HP)`, true, "text-[#0A7BC7] text-[14px]", true)}
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
                  <div className="p-5 pt-0 border-t border-border/40 text-xs font-sans flex flex-col gap-4 max-h-[420px] overflow-y-auto">
                    
                    {/* Step 1 */}
                    {(() => {
                      const stepId = "step-1-flow-rate";
                      const stepLabel = "Step 1: Volumetric & Mass Flow Rate Conversion";
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
                                <div className="font-mono text-primary my-1">Q (L/s) = (Flow_GPM × 3.785) ÷ 60</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">Q = ({calculatedData.flowGpm} GPM × 3.785) ÷ 60</div>
                                <div className="font-bold text-[11px] text-foreground mt-0.5">Q = {calculatedData.flowRate.toFixed(2)} L/s ({calculatedData.massFlow.toFixed(3)} kg/s)</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => handleCopyValue("Step 1 Flow", `${calculatedData.flowRate.toFixed(2)} L/s`)}>
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
                      const stepId = "step-2-equiv-length";
                      const stepLabel = "Step 2: Total Equivalent Piping Length";
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
                                <div className="font-mono text-primary my-1">Leq = (L_vert + L_horiz + L_elbows + L_valves) × 1.05</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">
                                  Leq = ({calculatedData.L_vert_m.toFixed(1)}m + {calculatedData.L_horiz_m.toFixed(1)}m + {calculatedData.elbowsLengthDisplay.toFixed(1)}{calculatedData.lengthUnit} + {calculatedData.valvesLengthDisplay.toFixed(1)}{calculatedData.lengthUnit}) × 1.05
                                </div>
                                <div className="font-bold text-[11px] text-foreground mt-0.5">Leq = {calculatedData.equivLengthDisplay.toFixed(1)} {calculatedData.lengthUnit}</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => handleCopyValue("Step 2 Equiv Length", `${calculatedData.equivLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`)}>
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
                      const stepId = "step-3-friction-loss";
                      const stepLabel = "Step 3: Piping Friction Pressure Losses";
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
                                <div className="font-mono text-primary my-1">H_loss = L_equiv × (FrictionFactor ÷ 100)</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">
                                  H_loss = {calculatedData.L_equiv_m.toFixed(1)}m × ({calculatedData.ff} ÷ 100)
                                </div>
                                <div className="font-bold text-[11px] text-foreground mt-0.5">H_loss = {calculatedData.frictionLossDisplay.toFixed(3)} {calculatedData.headUnit}</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => handleCopyValue("Step 3 Friction Loss", `${calculatedData.frictionLossDisplay.toFixed(3)} ${calculatedData.headUnit}`)}>
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
                      const stepId = "step-4-total-head";
                      const stepLabel = "Step 4: Total Dynamic Pump Head (TDH)";
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
                                <div className="font-mono text-primary my-1">TDH = (H_loss + H_static + H_outlet − H_suction) × (1 + SF ÷ 100)</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">
                                  TDH = ({calculatedData.frictionLossDisplay.toFixed(3)} + {calculatedData.staticHeadDisplay.toFixed(2)} + {calculatedData.outletHeadDisplay.toFixed(2)} − {calculatedData.suctionHeadDisplay.toFixed(2)}) × (1 + {calculatedData.sfPercent}%)
                                </div>
                                <div className="font-bold text-[11px] text-foreground mt-0.5">TDH = {calculatedData.pumpHeadCalcDisplay.toFixed(3)} {calculatedData.headUnit}</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => handleCopyValue("Step 4 TDH", `${calculatedData.pumpHeadCalcDisplay.toFixed(3)} ${calculatedData.headUnit}`)}>
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

                    {/* Step 5 */}
                    {(() => {
                      const stepId = "step-5-motor-power";
                      const stepLabel = "Step 5: Hydraulic Shaft & Motor Sizing Power";
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
                              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">5</div>
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
                                <div className="font-mono text-primary my-1">P_shaft = (Flow_kg/s × Lift_kPa) ÷ (1000 × η_pump), P_motor = P_shaft ÷ η_motor</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">
                                  P_shaft = ({calculatedData.massFlow.toFixed(3)} × {calculatedData.liftKpa.toFixed(1)}) ÷ (1000 × {calculatedData.effPumpVal / 100}) = {calculatedData.shaftPowerKw.toFixed(2)} kW
                                </div>
                                <div className="font-bold text-[11px] text-[#0A7BC7] mt-0.5">
                                  P_motor = {calculatedData.motorPowerKw.toFixed(2)} kW ({calculatedData.motorPowerHp.toFixed(2)} HP)
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => handleCopyValue("Step 5 Motor Power", `${calculatedData.motorPowerKw.toFixed(2)} kW`)}>
                              <Copy className="size-3.5 text-muted-foreground mr-2" />
                              <span>Copy Step 5 Result</span>
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
              Save the current CHW pump sizing parameters and configuration to your preset library.
            </p>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Tower A Secondary Chiller Pump"
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
              <FolderOpen className="size-4 text-primary" /> Saved CHW Pump Presets
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

      {/* Full Edit Modal */}
      {editModalOpen && (
        <EditChwPumpModal
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
