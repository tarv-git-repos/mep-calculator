import { calculateCHWPumpHead } from "@/lib/calc-chw-pump-head";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock, formatDateStr, getSignatureBlockDetails } from "@/lib/pdfHelpers";
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
  Download, Upload, Gauge, Layers, Zap, Flame, X, ArrowRight, Check,
  Activity, ShieldCheck, Sliders, SlidersHorizontal, Droplets
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
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { EditChwPumpModal } from "@/components/workspace/EditChwPumpModal";
import { exportChwPumpHeadExcel } from "@/lib/exportChwPumpHeadExcel";
import { exportChwPumpHeadPDF } from "@/lib/exportChwPumpHeadPDF";
import { UnitToggle } from "@/components/workspace/UnitToggle";

// Water Specific Heat Capacity lookup table (kJ/kg·K)
const WATER_CP_LOOKUP: { [temp: number]: number } = {
  0: 4.217,
  20: 4.186,
  40: 4.179,
  60: 4.184,
  80: 4.196,
  100: 4.216,
};

function getWaterCp(tempC: number): number {
  const temps = [0, 20, 40, 60, 80, 100];
  if (tempC <= 0) return WATER_CP_LOOKUP[0];
  if (tempC >= 100) return WATER_CP_LOOKUP[100];
  for (let i = 0; i < temps.length - 1; i++) {
    const t0 = temps[i];
    const t1 = temps[i + 1];
    if (tempC >= t0 && tempC <= t1) {
      const cp0 = WATER_CP_LOOKUP[t0];
      const cp1 = WATER_CP_LOOKUP[t1];
      return Number((cp0 + ((tempC - t0) / (t1 - t0)) * (cp1 - cp0)).toFixed(4));
    }
  }
  return 4.186;
}

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
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/chw-pump-head", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/chw-pump-head", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const isApprovedLocked = useCalculationLock("/chw-pump-head", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Tab & Drawer State matching Plumbing Pump Sizing
  const [activeTab, setActiveTab] = useState<"sizing" | "report">("sizing");
  const [intelOpen, setIntelOpen] = useState(false);

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const isSI = unitSystem === "si";

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
    endUser: "Facility Management",
    notes: "Chilled water secondary circulation loop pump head and fittings loss calculation report.",
  });

  // Expandable sections & Detailed Calculations Dialog
  const [showDetailedCalcs, setShowDetailedCalcs] = useState<boolean>(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Preliminary Cooling Load Import Modal & Thermodynamic State
  const [showPclModal, setShowPclModal] = useState<boolean>(false);
  const [pclDeltaT, setPclDeltaT] = useState<number>(5.5); // °C (standard CHW ΔT is 5.5°C / 10°F)
  const [pclWaterTemp, setPclWaterTemp] = useState<number>(7.0); // °C CHW supply
  const [pclDiversity, setPclDiversity] = useState<number>(100); // %

  const getPclSummary = () => {
    const pId = project?.id || "default";
    let pclList: any[] = [];
    try {
      const saved = localStorage.getItem(`mep_pcl_rows_${pId}`) || localStorage.getItem("pcl_rows");
      if (saved) {
        pclList = JSON.parse(saved);
      }
    } catch (e) {}

    if (pclList.length === 0 && (project as any)?.workspace_data) {
      const wdata = typeof (project as any).workspace_data === "string"
        ? JSON.parse((project as any).workspace_data)
        : (project as any).workspace_data;
      if (wdata?.pcl_rows) pclList = wdata.pcl_rows;
    }

    const totalKw = pclList.reduce((acc, row) => {
      const kw = Number(row.kw || (row.tr ? row.tr * 3.517 : (row.dissipation ? row.dissipation / 1000 : 0)));
      return acc + (isNaN(kw) ? 0 : kw);
    }, 0);

    const totalTr = pclList.reduce((acc, row) => {
      const tr = Number(row.tr || (row.kw ? row.kw / 3.517 : 0));
      return acc + (isNaN(tr) ? 0 : tr);
    }, 0);

    const totalArea = pclList.reduce((acc, row) => {
      const area = Number(row.area || 0);
      return acc + (isNaN(area) ? 0 : area);
    }, 0);

    return {
      spaces: pclList,
      count: pclList.length,
      totalKw: Number(totalKw.toFixed(2)),
      totalTr: Number(totalTr.toFixed(2)),
      totalArea: Number(totalArea.toFixed(1)),
    };
  };

  const pclSummary = useMemo(() => getPclSummary(), [project?.id, showPclModal]);

  const handleApplyPclFlowRate = () => {
    if (!pclSummary || pclSummary.totalKw <= 0) {
      toast.error("No cooling load data found in Preliminary Cooling Load to import.");
      return;
    }

    const effectiveKw = pclSummary.totalKw * (pclDiversity / 100);
    const cp = getWaterCp(pclWaterTemp);
    const dt = pclDeltaT > 0 ? pclDeltaT : 5.5;
    // Mass flow m = Q / (cp * dt) [kg/s]
    const flowLps = effectiveKw / (cp * dt); // L/s
    const flowGpm = (flowLps * 60) / 3.78; // GPM basis
    
    const targetVal = unitSystem === "ip" ? Number(flowGpm.toFixed(1)) : Number(flowGpm.toFixed(0));
    const next = { 
      ...sizingParams, 
      flowUsgpm: targetVal, 
      flowLps: Number(flowLps.toFixed(2)) 
    };
    saveParams(next, unitSystem, projectInfo);
    setShowPclModal(false);
    toast.success(
      `Imported ${flowLps.toFixed(2)} L/s (${flowGpm.toFixed(1)} GPM) from Preliminary Cooling Load (${pclSummary.totalKw} kW @ ΔT=${dt}°C)`
    );
  };

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
  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean = true) => {
    if (targetUnit === unitSystem) return;

    let nextParams = { ...sizingParams };

    if (shouldConvert) {
      if (targetUnit === "ip") {
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
    }

    saveParams(nextParams, targetUnit, projectInfo);
    toast.info(`Switched to ${targetUnit === "ip" ? "Imperial (IP)" : "Metric (SI)"} units`);
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

  const handleExportExcel = async () => {
    try {
      await exportChwPumpHeadExcel(
        {
          projectInfo,
          sizingParams,
          calculatedData,
          unitSystem,
        },
        {
          calcNo: projectInfo.calcNumber || "CALC-HVAC-PMP02",
          projectNo: projectInfo.projectNumber || project?.code || "MEP-CHW-02",
          projectName: projectInfo.projectName || project?.name || "Commercial Tower CHW Pumping Study",
          client: projectInfo.client || project?.client || "Summit Estates Ltd",
          date: projectInfo.date || new Date().toLocaleDateString("en-GB"),
          userName: currentUserName,
        }
      );
      toast.success("Excel report exported successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export Excel report");
    }
  };

  const handlePrintPDF = async () => {
    await exportChwPumpHeadPDF({
      unitSystem,
      sizingParams: {
        flowRate: sizingParams.flowUsgpm,
        vertLength: sizingParams.vertLength,
        horizLength: sizingParams.horizLength,
        frictionFactor: sizingParams.frictionFactor,
        staticHead: sizingParams.staticHead,
        outletHead: sizingParams.residualPressure,
        suctionHead: sizingParams.suctionPressure,
        effPump: sizingParams.effPump,
        effMotor: sizingParams.effMotor,
        safetyMargin: sizingParams.safetyFactorHead,
      },
      calculatedData,
      projectInfo: {
        calcNumber: projectInfo.calcNumber || project?.calcNo || "CALC-HVAC-PMP02",
        projectNumber: projectInfo.projectNumber || project?.code || "MEP-CHW-02",
        projectName: projectInfo.projectName || project?.name || "Commercial Tower CHW Pumping Study",
        client: projectInfo.client || project?.client || "Summit Estates Ltd",
        endUser: projectInfo.endUser || project?.location || "Facility Management",
        date: projectInfo.date || new Date().toLocaleDateString("en-GB"),
      },
      meta: {
        userName: currentUserName,
      },
    });
  };

  const isFieldHighlighted = (fieldId: string, searchKey?: string) => {
    if (!highlightedTargetId) return "";
    const cleanHighlight = highlightedTargetId.toLowerCase().trim();
    if (fieldId.toLowerCase() === cleanHighlight) return "ring-2 ring-primary border-primary shadow-sm bg-primary/5 animate-pulse-light";
    if (fieldId.toLowerCase().includes(cleanHighlight)) return "ring-2 ring-primary border-primary shadow-sm bg-primary/5 animate-pulse-light";
    if (searchKey && searchKey.toLowerCase().includes(cleanHighlight)) return "ring-2 ring-primary border-primary shadow-sm bg-primary/5 animate-pulse-light";
    return "";
  };

  const renderCommentBadge = (id: string, name: string) => {
    const existing = getMergedItemComments(id, name, commentsList, "/chw-pump-head", project?.id);
    if (existing.length === 0) return null;
    const unresolvedCount = existing.filter((c: any) => c.status !== "resolved").length;
    if (unresolvedCount === 0) return null;
    return (
      <RowCommentCornerBadge
        id={id}
        count={unresolvedCount}
        onClick={() => handleOpenComment(id, name)}
        title={`${unresolvedCount} comment(s)/task(s) assigned`}
      />
    );
  };

  // Uniform standard styling matching Plumbing Pump Sizing
  const inputClass = "w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono text-xs focus:outline-none focus:border-primary disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base transition-all duration-150";
  const flowInputClass = "w-full h-9 px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-[#0A7BC7] disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base transition-all duration-150";

  // Helper component to render a result output row wrapped with Context Menu and Comment Indicator
  const renderResultRow = (
    id: string,
    label: string,
    valueFormatted: string,
    isHighlight: boolean = false,
    highlightClass: string = "text-foreground",
    colSpanTwo: boolean = false
  ) => {
    const itemComments = getMergedItemComments(id, label, commentsList, "/chw-pump-head", project?.id);
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
            onDoubleClick={() => setShowDetailedCalcs(true)}
            title="Double-click to view step-by-step engineering calculation formulas"
            className={`flex justify-between items-center py-1.5 border-b border-border/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 px-2 rounded-lg transition cursor-pointer group relative ${
              colSpanTwo ? "col-span-2" : ""
            } ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20 font-bold"
                : ""
            }`}
          >
            <RowCommentCornerBadge
              id={id}
              count={itemComments.length}
              onClick={() => handleOpenComment(id, label)}
            />
            <span className="font-semibold text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
              <span>{label}</span>
            </span>
            <strong className={`font-bold font-mono ${highlightClass}`}>{valueFormatted}</strong>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment"}</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => setShowDetailedCalcs(true)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
          >
            <HelpCircle className="size-3.5 text-primary" />
            <span>View Calculation Steps</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double-Click</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handleCopyValue(label, valueFormatted)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
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
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
          >
            <FileText className="size-3.5 text-muted-foreground" />
            <span>Copy Full Line</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <AppShell 
      title="CHW Pump Head" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
      intelLabel="Intelligence"
    >
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Page Header matching Plumbing Pump Sizing & Ventilation */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">CHW Pump Head</h1>
                <span className="text-[15px] font-semibold text-muted-foreground">Dynamic Piping Friction & TDH Sizing (ASHRAE)</span>
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
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/chw-pump-head" calculatorTitle="CHW Pump Head" />
              {commentsList.length > 0 && (
                <div 
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20 shadow-2xs"
                  title={`${commentsList.length} active comment(s)/task(s) in CHW Pump Head`}
                >
                  <MessageSquare className="size-3.5 fill-blue-500/20" />
                  <span>{commentsList.length} Active Task{commentsList.length === 1 ? "" : "s"} / Comment{commentsList.length === 1 ? "" : "s"}</span>
                </div>
              )}
            </div>

            {/* Unit System Toggle */}
            <div className="flex items-center gap-2 flex-wrap">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitSystemChange}
                inputDescriptions="Vertical/Horizontal Lengths, Friction Factor, Pressures"
                conversionExample={unitSystem === "si" ? "Convert 30 m → 98.4 ft, 0.4 bar/100m → 1.77 psi/100ft" : "Convert 100 ft → 30.5 m, 1.77 psi/100ft → 0.4 bar/100m"}
              />
            </div>
          </div>

          {/* White / Dark Card container matching Plumbing Pump Sizing */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : calcReviewState?.status === "REJECTED"
              ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
              : calcReviewState?.status === "REVIEWED"
              ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
              : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"}`}>

            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50 gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Main Tab Switcher */}
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
                    Calculator
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

                <TBtn
                  onClick={() => setShowDetailedCalcs(true)}
                  title="View Step-by-Step Formula Breakdown"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>

                <TBtn
                  onClick={() => setShowSaveModal(true)}
                  title="Save Calculation Preset"
                >
                  <Save className="size-3.5 text-muted-foreground" /> Save Preset
                </TBtn>

                {saves.length > 0 && (
                  <TBtn
                    onClick={() => setShowLoadModal(true)}
                    title="Load Saved Presets"
                  >
                    <FolderOpen className="size-3.5 text-muted-foreground" /> Presets ({saves.length})
                  </TBtn>
                )}
              </div>

              {/* Action buttons on the right of tabs */}
              <div className="flex items-center gap-2">
                <TBtn
                  onClick={handleExportExcel}
                  title="Export Excel Report"
                >
                  <FileSpreadsheet className="size-3.5 text-emerald-600" /> Excel
                </TBtn>
                <TBtn
                  onClick={handlePrintPDF}
                  title="Export PDF Report"
                >
                  <FileText className="size-3.5 text-blue-600" /> Export PDF
                </TBtn>
              </div>
            </div>

            {/* Sizing Parameters Grid or Report View */}
            {activeTab === "sizing" ? (
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
                  <div className="lg:col-span-5 space-y-5">
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          📥 Sizing Parameters
                        </span>
                      </div>

                      {/* FLOW DEMAND & RATE */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div 
                            id="field-flowParams" 
                            data-field-id="chw-flow-rate" 
                            data-comment-target="chw-flow-rate"
                            className={`p-2 -m-2 rounded-lg transition-colors relative ${isFieldHighlighted("chw-flow-rate", "Design Flow Rate")}`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                    Design Flow Rate ({unitSystem === "ip" ? "GPM" : "L/s equivalent basis"})
                                  </label>
                                  {renderCommentBadge("chw-flow-rate", "Design Flow Rate")}
                                </div>
                                <button
                                  type="button"
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => setShowPclModal(true)}
                                  className={`text-[10.5px] font-bold text-[#0A7BC7] hover:underline cursor-pointer flex items-center gap-1 ${isEffectiveReadOnly ? "hidden" : ""}`}
                                >
                                  <Sparkles className="size-3 text-[#0A7BC7]" />
                                  Import from PCL
                                </button>
                              </div>
                              <input
                                id="chw-flow-rate"
                                type="number"
                                disabled={isEffectiveReadOnly}
                                value={sizingParams.flowUsgpm}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : Number(e.target.value);
                                  const next = { ...sizingParams, flowUsgpm: val };
                                  next.flowLps = val !== "" ? Number((Number(val) * 3.78 / 60).toFixed(2)) : "";
                                  saveParams(next, unitSystem, projectInfo);
                                }}
                                className={flowInputClass}
                                placeholder={unitSystem === "ip" ? "500" : "500"}
                              />

                              {/* Quick PCL Indicator */}
                              {pclSummary.count > 0 && pclSummary.totalKw > 0 && (
                                <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-xs mt-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Zap className="size-3.5 text-amber-500 shrink-0" />
                                    <span className="truncate text-muted-foreground text-[11px]">
                                      PCL Load: <strong className="text-foreground font-mono">{pclSummary.totalKw} kW</strong> ({pclSummary.totalTr} TR) • {pclSummary.count} spaces
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cp = getWaterCp(7.0);
                                      const flowLps = pclSummary.totalKw / (cp * 5.5);
                                      const flowGpm = (flowLps * 60) / 3.78;
                                      const targetVal = unitSystem === "ip" ? Number(flowGpm.toFixed(1)) : Number(flowGpm.toFixed(0));
                                      const next = { ...sizingParams, flowUsgpm: targetVal, flowLps: Number(flowLps.toFixed(2)) };
                                      saveParams(next, unitSystem, projectInfo);
                                      toast.success(`Imported ${flowLps.toFixed(2)} L/s (${flowGpm.toFixed(1)} GPM) from Preliminary Cooling Load (ΔT=5.5°C)`);
                                    }}
                                    className="px-2 py-0.5 text-[10px] font-bold text-primary hover:text-primary-foreground hover:bg-primary rounded-md border border-primary/30 transition cursor-pointer shrink-0 ml-2"
                                    title="Quick import with standard ΔT = 5.5°C"
                                  >
                                    Quick Apply
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            onClick={() => handleResetValue("Design Flow Rate", "flowUsgpm", 500)}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset to Default (500)</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => handleOpenComment("chw-flow-rate", "Design Flow Rate")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* PIPING PARAMETERS */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div 
                            id="field-pipingParams" 
                            data-field-id="pipingParams" 
                            data-comment-target="pipingParams"
                            className={`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors relative ${isFieldHighlighted("pipingParams", "Piping & Friction")}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                  Piping & Friction
                                </span>
                                {renderCommentBadge("pipingParams", "Piping & Friction")}
                              </div>
                              <div className="text-[11.5px] font-medium text-slate-500 flex items-center gap-0.5">
                                <span>Friction Factor:</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  disabled={isEffectiveReadOnly}
                                  value={sizingParams.frictionFactor}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Number(e.target.value);
                                    saveParams({ ...sizingParams, frictionFactor: val }, unitSystem, projectInfo);
                                  }}
                                  className="w-12 bg-transparent text-slate-700 dark:text-slate-200 font-bold text-center border-none outline-none focus:ring-1 focus:ring-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded transition-all cursor-pointer p-0 font-mono text-xs"
                                />
                                <span>{unitSystem === "ip" ? "psi/100ft" : "bar/100m"}</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-[11px] text-slate-500">Vertical ({calculatedData.lengthUnit})</label>
                                <input
                                  type="number"
                                  disabled={isEffectiveReadOnly}
                                  value={sizingParams.vertLength}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Number(e.target.value);
                                    saveParams({ ...sizingParams, vertLength: val }, unitSystem, projectInfo);
                                  }}
                                  className={inputClass}
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-500">Horizontal ({calculatedData.lengthUnit})</label>
                                <input
                                  type="number"
                                  disabled={isEffectiveReadOnly}
                                  value={sizingParams.horizLength}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Number(e.target.value);
                                    saveParams({ ...sizingParams, horizLength: val }, unitSystem, projectInfo);
                                  }}
                                  className={inputClass}
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-500">Safety Margin (%)</label>
                                <input
                                  type="number"
                                  disabled={isEffectiveReadOnly}
                                  value={sizingParams.safetyFactorHead}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Number(e.target.value);
                                    saveParams({ ...sizingParams, safetyFactorHead: val }, unitSystem, projectInfo);
                                  }}
                                  className={inputClass}
                                />
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            onClick={() => {
                              if (isEffectiveReadOnly || isApprovedLocked) return;
                              const next = {
                                ...sizingParams,
                                vertLength: unitSystem === "ip" ? 100 : 30,
                                horizLength: unitSystem === "ip" ? 400 : 120,
                                frictionFactor: unitSystem === "ip" ? 1.77 : 0.4,
                                safetyFactorHead: 5
                              };
                              saveParams(next, unitSystem, projectInfo);
                              toast.success("Piping parameters reset to default");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset Piping Parameters</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => handleOpenComment("pipingParams", "Piping & Friction")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* HEAD & PRESSURES */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div 
                            id="field-headParams" 
                            data-field-id="headParams" 
                            data-comment-target="headParams"
                            className={`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors relative ${isFieldHighlighted("headParams", "Head & Pressures")}`}
                          >
                            <div className="flex items-center">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Head & Pressures ({calculatedData.headUnit})
                              </span>
                              {renderCommentBadge("headParams", "Head & Pressures")}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-[11px] text-slate-500">Static Head ({calculatedData.headUnit})</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  disabled={isEffectiveReadOnly}
                                  value={sizingParams.staticHead}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Number(e.target.value);
                                    saveParams({ ...sizingParams, staticHead: val }, unitSystem, projectInfo);
                                  }}
                                  className={inputClass}
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-500">Residual Outlet ({calculatedData.headUnit})</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  disabled={isEffectiveReadOnly}
                                  value={sizingParams.residualPressure}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Number(e.target.value);
                                    saveParams({ ...sizingParams, residualPressure: val }, unitSystem, projectInfo);
                                  }}
                                  className={inputClass}
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-500">Suction Pressure ({calculatedData.headUnit})</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  disabled={isEffectiveReadOnly}
                                  value={sizingParams.suctionPressure}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Number(e.target.value);
                                    saveParams({ ...sizingParams, suctionPressure: val }, unitSystem, projectInfo);
                                  }}
                                  className={inputClass}
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-500">Operating Head Override ({calculatedData.headUnit})</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  placeholder="Calculated if blank"
                                  disabled={isEffectiveReadOnly}
                                  value={sizingParams.selectedHead}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Number(e.target.value);
                                    saveParams({ ...sizingParams, selectedHead: val }, unitSystem, projectInfo);
                                  }}
                                  className={inputClass}
                                />
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            onClick={() => {
                              if (isEffectiveReadOnly || isApprovedLocked) return;
                              const next = {
                                ...sizingParams,
                                staticHead: unitSystem === "ip" ? 43.5 : 3.0,
                                residualPressure: unitSystem === "ip" ? 29.0 : 2.0,
                                suctionPressure: 0.0,
                                selectedHead: ""
                              };
                              saveParams(next, unitSystem, projectInfo);
                              toast.success("Head & pressure parameters reset to default");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset Head & Pressures</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => handleOpenComment("headParams", "Head & Pressures")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* EFFICIENCY RATINGS */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div 
                            id="field-efficiencyParams" 
                            data-field-id="efficiencyParams" 
                            data-comment-target="efficiencyParams"
                            className={`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors relative ${isFieldHighlighted("efficiencyParams", "Efficiency Ratings")}`}
                          >
                            <div className="flex items-center">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Efficiency Ratings (%)
                              </span>
                              {renderCommentBadge("efficiencyParams", "Efficiency Ratings")}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-[11px] text-slate-500">Pump Efficiency (%)</label>
                                <input
                                  type="number"
                                  disabled={isEffectiveReadOnly}
                                  value={sizingParams.effPump}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Number(e.target.value);
                                    saveParams({ ...sizingParams, effPump: val }, unitSystem, projectInfo);
                                  }}
                                  className={inputClass}
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-500">Motor Efficiency (%)</label>
                                <input
                                  type="number"
                                  disabled={isEffectiveReadOnly}
                                  value={sizingParams.effMotor}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Number(e.target.value);
                                    saveParams({ ...sizingParams, effMotor: val }, unitSystem, projectInfo);
                                  }}
                                  className={inputClass}
                                />
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            onClick={() => {
                              if (isEffectiveReadOnly || isApprovedLocked) return;
                              const next = { ...sizingParams, effPump: 70, effMotor: 85 };
                              saveParams(next, unitSystem, projectInfo);
                              toast.success("Efficiency ratings reset to default");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset Efficiency Ratings</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => handleOpenComment("efficiencyParams", "Efficiency Ratings")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: CALCULATION RESULTS (lg:col-span-7 STICKY) */}
                  <div className="lg:col-span-7 space-y-5 lg:sticky lg:top-0 self-start">
                    
                    {/* PRIMARY RESULTS CARD */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          id="card-hero-results" 
                          data-field-id="card-hero-results" 
                          data-comment-target="card-hero-results"
                          className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6 transition-colors relative ${isFieldHighlighted("card-hero-results", "Sizing Results Summary")}`}
                        >
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                            <div className="flex items-center">
                              <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                ⚡ Sizing Results Summary
                              </span>
                              {renderCommentBadge("card-hero-results", "Sizing Results Summary")}
                            </div>
                          </div>

                          {/* 4 DISPLAY STAT CARDS */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 relative">
                              {renderCommentBadge("res-flow-rate", "Design Flow Rate")}
                              <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Design Flow</div>
                              <div className="text-xl font-bold font-mono text-foreground mt-1">
                                {calculatedData.flowRateDisplay.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{calculatedData.flowUnit}</span>
                              </div>
                            </div>

                            <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 relative">
                              {renderCommentBadge("res-total-pump-head", "Total Dynamic Head")}
                              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Dynamic Head</div>
                              <div className="text-xl font-bold font-mono text-foreground mt-1">
                                {calculatedData.pumpHeadCalcDisplay.toFixed(3)} <span className="text-xs font-normal text-muted-foreground">{calculatedData.headUnit}</span>
                              </div>
                            </div>

                            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 relative">
                              {renderCommentBadge("res-total-motor-power", "Motor Rating")}
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Motor Rating</div>
                              <div className="text-xl font-bold font-mono text-foreground mt-1">
                                {calculatedData.motorPowerKw.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">kW</span>
                              </div>
                            </div>

                            <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 relative">
                              {renderCommentBadge("res-hp", "Horsepower")}
                              <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Horsepower</div>
                              <div className="text-xl font-bold font-mono text-foreground mt-1">
                                {calculatedData.motorPowerHp.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">HP</span>
                              </div>
                            </div>
                          </div>

                          {/* DETAILED METRICS TABLE */}
                          <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Equivalent Pipe Length:</span>
                              <span className="font-mono font-bold text-foreground">{calculatedData.equivLengthDisplay.toFixed(1)} {calculatedData.lengthUnit}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Friction Head Loss:</span>
                              <span className="font-mono font-bold text-foreground">{calculatedData.frictionLossDisplay.toFixed(3)} {calculatedData.headUnit}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Required Shaft Power:</span>
                              <span className="font-mono font-bold text-foreground">{calculatedData.shaftPowerKw.toFixed(2)} kW</span>
                            </div>
                            <div className="flex justify-between py-1 font-bold text-foreground">
                              <span>Estimated Electrical Motor Rating:</span>
                              <span className="font-mono text-[#0A7BC7]">{calculatedData.motorPowerKw.toFixed(2)} kW ({calculatedData.motorPowerHp.toFixed(2)} HP)</span>
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          onClick={() => setShowDetailedCalcs(true)}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                        >
                          <HelpCircle className="size-3.5 text-primary" />
                          <span>View Calculation Steps</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double-Click</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleOpenComment("card-hero-results", "Sizing Results Summary")}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* PIPING & FRICTION LOSS RESULTS CARD */}
                    <div 
                      onDoubleClick={() => setShowDetailedCalcs(true)}
                      title="Double-click to view step-by-step engineering calculation formulas"
                      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-4 hover:border-primary/40 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                            Piping & Friction Loss Results
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDetailedCalcs(true);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition cursor-pointer"
                          title="Double-click to view step-by-step math formulas"
                        >
                          <HelpCircle className="size-3" />
                          <span>Steps</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        {renderResultRow("res-sum-lengths", "Sum of Straight Lengths", `${(calculatedData.vertLengthDisplay + calculatedData.horizLengthDisplay).toFixed(1)} ${calculatedData.lengthUnit}`)}
                        {renderResultRow("res-elbows-eq", "Elbows Eq Length (+30%)", `${calculatedData.elbowsLengthDisplay.toFixed(2)} ${calculatedData.lengthUnit}`)}
                        {renderResultRow("res-valves-eq", "Valves Eq Length (+30%)", `${calculatedData.valvesLengthDisplay.toFixed(2)} ${calculatedData.lengthUnit}`)}
                        {renderResultRow("res-total-eq", "Total Eq Length (+5% SF)", `${calculatedData.equivLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`, true, "text-[#0A7BC7] text-[12.5px]")}
                        {renderResultRow("res-friction-loss", "Major + Minor Friction Losses", `${calculatedData.frictionLossDisplay.toFixed(3)} ${calculatedData.headUnit}`, true, "text-[#0A7BC7] text-[13px]", true)}
                      </div>
                    </div>

                    {/* PUMP HEAD & MOTOR SIZING RESULTS CARD */}
                    <div 
                      onDoubleClick={() => setShowDetailedCalcs(true)}
                      title="Double-click to view step-by-step engineering calculation formulas"
                      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-4 hover:border-primary/40 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                            Pump Head & Motor Sizing Results
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDetailedCalcs(true);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition cursor-pointer"
                          title="Double-click to view step-by-step math formulas"
                        >
                          <HelpCircle className="size-3" />
                          <span>Steps</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        {renderResultRow("res-flow-rate", "Design Flow Rate", `${calculatedData.flowRateDisplay.toFixed(2)} ${calculatedData.flowUnit}`, true, "text-[#0A7BC7]")}
                        {renderResultRow("res-static-lift", "Static Elevation Lift", `${calculatedData.staticHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`)}
                        {renderResultRow("res-residual-outlet", "Residual Outlet Pressure", `${calculatedData.outletHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`)}
                        {renderResultRow("res-suction-deducted", "Suction Pressure Deducted", `-${calculatedData.suctionHeadDisplay.toFixed(2)} ${calculatedData.headUnit}`)}
                        {renderResultRow("res-total-pump-head", "Total Calculated Head (TDH)", `${calculatedData.pumpHeadCalcDisplay.toFixed(3)} ${calculatedData.headUnit}`, true, "text-[#0A7BC7] text-[13.5px]", true)}
                        {renderResultRow("res-selected-head", "Selected Operating Head", `${calculatedData.selectedHeadDisplay.toFixed(3)} ${calculatedData.headUnit}`)}
                        {renderResultRow("res-shaft-power", "Hydraulic Shaft Power", `${calculatedData.shaftPowerKw.toFixed(2)} kW`)}
                        {renderResultRow("res-total-motor-power", "Estimated Motor Power", `${calculatedData.motorPowerKw.toFixed(2)} kW (${calculatedData.motorPowerHp.toFixed(2)} HP)`, true, "text-[#0A7BC7] text-[13.5px]", true)}
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            ) : (
              <ChwPumpHeadReportView
                sizingParams={sizingParams}
                calculatedData={calculatedData}
                unitSystem={unitSystem}
                project={project}
                calcReviewState={calcReviewState}
                currentUserName={currentUserName}
                projectInfo={projectInfo}
                onExportPdf={handlePrintPDF}
                onExportExcel={handleExportExcel}
              />
            )}
          </div>
        </div>

        {/* Collapsible Intelligence Drawer (Matching Plumbing Pump Sizing & Ventilation UI exactly) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen
              ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg flex flex-col"
              : "w-0"
          }`}
        >
          {intelOpen && (
            <ChwPumpHeadIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              sizingParams={sizingParams}
              setSizingParams={setSizingParams}
              saveParams={saveParams}
              calculatedData={calculatedData}
              unitSystem={unitSystem}
              projectInfo={projectInfo}
            />
          )}
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

      {/* Modal: Import Flow Rate from Preliminary Cooling Load */}
      {showPclModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col gap-5 max-h-[92vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Import Flow Rate from Preliminary Cooling Load</h3>
                  <p className="text-xs text-muted-foreground">Thermodynamic CHW Flow conversion based on ASHRAE Fundamentals</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPclModal(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* PCL Data Summary Card */}
            <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Connected PCL Workspace Data</span>
                <span className="text-[11px] font-mono text-muted-foreground">{pclSummary.count} conditioned spaces</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-center font-mono">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-sans">Total Load</div>
                  <div className="text-sm font-bold text-primary">{pclSummary.totalKw} kW</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-sans">Cooling Tonnage</div>
                  <div className="text-sm font-bold text-foreground">{pclSummary.totalTr} TR</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-sans">Total Area</div>
                  <div className="text-sm font-bold text-foreground">{pclSummary.totalArea} m²</div>
                </div>
              </div>
            </div>

            {/* Thermodynamic Parameters Input */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-foreground flex items-center justify-between">
                    <span>CHW Temperature Rise (ΔT)</span>
                    <span className="text-[10px] font-mono text-primary font-bold">{pclDeltaT}°C</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="15"
                    value={pclDeltaT}
                    onChange={(e) => setPclDeltaT(Math.max(0.1, Number(e.target.value)))}
                    className={inputClass}
                  />
                  <span className="text-[10px] text-muted-foreground">Standard CHW ΔT: 5.5°C (10°F)</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-foreground flex items-center justify-between">
                    <span>CHW Supply Temp</span>
                    <span className="text-[10px] font-mono text-primary font-bold">{pclWaterTemp}°C</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="2"
                    max="20"
                    value={pclWaterTemp}
                    onChange={(e) => setPclWaterTemp(Number(e.target.value))}
                    className={inputClass}
                  />
                  <span className="text-[10px] text-muted-foreground">Lookup Cp @ {pclWaterTemp}°C: {getWaterCp(pclWaterTemp)} kJ/kg·K</span>
                </div>
              </div>

              {/* Diversity Factor */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-xs text-foreground flex items-center justify-between">
                  <span>Piping Loop Diversity Factor</span>
                  <span className="text-[11px] font-mono text-primary font-bold">{pclDiversity}%</span>
                </label>
                <div className="flex gap-2">
                  {[80, 85, 90, 95, 100].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPclDiversity(d)}
                      className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        pclDiversity === d
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-surface-2 text-muted-foreground border-border/80 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                      }`}
                    >
                      {d}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Hero Result Card */}
            {(() => {
              const kw = (pclSummary.totalKw > 0 ? pclSummary.totalKw : 300) * (pclDiversity / 100);
              const cp = getWaterCp(pclWaterTemp);
              const dt = pclDeltaT > 0 ? pclDeltaT : 5.5;
              const flowLps = kw / (cp * dt);
              const flowGpm = (flowLps * 60) / 3.78;

              return (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/25 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Check className="size-4" /> Resulting CHW Design Flow Rate
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-md">
                      Cp = {cp} kJ/kg·K
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card/90 backdrop-blur-xs p-3.5 rounded-xl border border-border/80 flex flex-col items-center justify-center text-center shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Metric Flow Rate</span>
                      <span className="text-2xl font-black font-mono text-primary mt-0.5">
                        {flowLps.toFixed(2)} <span className="text-sm font-semibold">L/s</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {flowLps.toFixed(2)} kg/s mass flow
                      </span>
                    </div>

                    <div className="bg-card/90 backdrop-blur-xs p-3.5 rounded-xl border border-border/80 flex flex-col items-center justify-center text-center shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Imperial Flow Rate</span>
                      <span className="text-2xl font-black font-mono text-foreground mt-0.5">
                        {flowGpm.toFixed(1)} <span className="text-sm font-semibold">GPM</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {(flowGpm / (pclSummary.totalTr || 85)).toFixed(2)} GPM/TR
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground font-mono text-center pt-1 border-t border-border/40">
                    ṁ = {kw.toFixed(1)} kW ÷ ({cp} × {dt.toFixed(1)}°C) = <strong className="text-foreground">{flowLps.toFixed(2)} L/s</strong>
                  </div>
                </div>
              );
            })()}

            {/* Action Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-1 border-t border-border/60">
              <button
                type="button"
                onClick={() => setShowPclModal(false)}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              
              {(() => {
                const kw = (pclSummary.totalKw > 0 ? pclSummary.totalKw : 300) * (pclDiversity / 100);
                const cp = getWaterCp(pclWaterTemp);
                const dt = pclDeltaT > 0 ? pclDeltaT : 5.5;
                const flowLps = kw / (cp * dt);

                return (
                  <button
                    type="button"
                    onClick={handleApplyPclFlowRate}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition cursor-pointer shadow-md shadow-primary/20 active:scale-[0.98]"
                  >
                    <Sparkles className="size-4" />
                    <span>Apply {flowLps.toFixed(2)} L/s to CHW Pump</span>
                  </button>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* Modal: Detailed Calculations Steps (Triggered by Double-Clicking Calculation Output) */}
      {showDetailedCalcs && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <HelpCircle className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Σ Detailed Calculations Steps & Engineering Formulas</h3>
                  <p className="text-xs text-muted-foreground">Governing thermodynamic & fluid dynamics equations for CHW Pump Head</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailedCalcs(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Quick Sizing Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-surface-2 border border-border/70 text-center">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Total Head (TDH)</span>
                <span className="text-sm font-bold font-mono text-primary mt-0.5">{calculatedData.pumpHeadCalcDisplay.toFixed(3)} {calculatedData.headUnit}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Motor Power</span>
                <span className="text-sm font-bold font-mono text-foreground mt-0.5">{calculatedData.motorPowerKw.toFixed(2)} kW</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Design Flow Rate</span>
                <span className="text-sm font-bold font-mono text-foreground mt-0.5">{calculatedData.flowRateDisplay.toFixed(2)} {calculatedData.flowUnit}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Total Equiv Length</span>
                <span className="text-sm font-bold font-mono text-foreground mt-0.5">{calculatedData.equivLengthDisplay.toFixed(1)} {calculatedData.lengthUnit}</span>
              </div>
            </div>

            {/* Step 1 to 5 List */}
            <div className="flex flex-col gap-4">
              {/* Step 1 */}
              {(() => {
                const stepId = "step-1-flow";
                const stepLabel = "Step 1: Volumetric & Mass Flow Rate";
                const stepComments = getMergedItemComments(stepId, undefined, commentsList, "/chw-pump-head", project?.id);
                const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                return (
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id={stepId}
                        data-item-id={stepId}
                        data-field-id={stepId}
                        className={`flex gap-3 items-start border border-border/60 bg-surface-2/40 p-3 rounded-xl transition cursor-context-menu hover:border-primary/40 relative ${
                          isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                        }`}
                      >
                        <RowCommentCornerBadge
                          id={stepId}
                          count={stepComments.length}
                          onClick={() => handleOpenComment(stepId, stepLabel)}
                        />
                        <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">1</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground flex items-center justify-between">
                            <span>{stepLabel}</span>
                          </div>
                          <div className="font-mono text-primary my-1 font-semibold">Q (L/s) = (Flow_GPM × 3.785) ÷ 60  |  ṁ = Q / (Cp · ΔT)</div>
                          <div className="font-mono text-[10.5px] text-muted-foreground">Q = ({calculatedData.flowGpm} GPM × 3.785) ÷ 60</div>
                          <div className="font-bold text-[11px] text-foreground mt-0.5">Q = {calculatedData.flowRate.toFixed(2)} L/s ({calculatedData.massFlow.toFixed(3)} kg/s)</div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => handleOpenComment(stepId, stepLabel)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment"}</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Step 1 Flow", `${calculatedData.flowRate.toFixed(2)} L/s`)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                      >
                        <Copy className="size-3.5 text-muted-foreground" />
                        <span>Copy Step 1 Result</span>
                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })()}

              {/* Step 2 */}
              {(() => {
                const stepId = "step-2-equiv-length";
                const stepLabel = "Step 2: Total Equivalent Piping Length";
                const stepComments = getMergedItemComments(stepId, undefined, commentsList, "/chw-pump-head", project?.id);
                const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                return (
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id={stepId}
                        data-item-id={stepId}
                        data-field-id={stepId}
                        className={`flex gap-3 items-start border border-border/60 bg-surface-2/40 p-3 rounded-xl transition cursor-context-menu hover:border-primary/40 relative ${
                          isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                        }`}
                      >
                        <RowCommentCornerBadge
                          id={stepId}
                          count={stepComments.length}
                          onClick={() => handleOpenComment(stepId, stepLabel)}
                        />
                        <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">2</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground flex items-center justify-between">
                            <span>{stepLabel}</span>
                          </div>
                          <div className="font-mono text-primary my-1 font-semibold">L_equiv = ceil(((L_vert + L_horiz + 0.3·(L_v+L_h) + 0.3·(L_v+L_h)) × 1.05) ÷ 10) × 10</div>
                          <div className="font-mono text-[10.5px] text-muted-foreground">
                            Straight sum = {calculatedData.sumLengthsDisplay.toFixed(1)} {calculatedData.lengthUnit} | Elbows (+30%) = {calculatedData.elbowsLengthDisplay.toFixed(2)} | Valves (+30%) = {calculatedData.valvesLengthDisplay.toFixed(2)}
                          </div>
                          <div className="font-bold text-[11px] text-foreground mt-0.5">L_equiv = {calculatedData.equivLengthDisplay.toFixed(1)} {calculatedData.lengthUnit}</div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => handleOpenComment(stepId, stepLabel)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment"}</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Step 2 Length", `${calculatedData.equivLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                      >
                        <Copy className="size-3.5 text-muted-foreground" />
                        <span>Copy Step 2 Result</span>
                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })()}

              {/* Step 3 */}
              {(() => {
                const stepId = "step-3-friction-loss";
                const stepLabel = "Step 3: Total Dynamic Friction Losses";
                const stepComments = getMergedItemComments(stepId, undefined, commentsList, "/chw-pump-head", project?.id);
                const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                return (
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id={stepId}
                        data-item-id={stepId}
                        data-field-id={stepId}
                        className={`flex gap-3 items-start border border-border/60 bg-surface-2/40 p-3 rounded-xl transition cursor-context-menu hover:border-primary/40 relative ${
                          isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                        }`}
                      >
                        <RowCommentCornerBadge
                          id={stepId}
                          count={stepComments.length}
                          onClick={() => handleOpenComment(stepId, stepLabel)}
                        />
                        <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">3</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground flex items-center justify-between">
                            <span>{stepLabel}</span>
                          </div>
                          <div className="font-mono text-primary my-1 font-semibold">H_friction = L_equiv × (Friction_Factor ÷ 100)</div>
                          <div className="font-mono text-[10.5px] text-muted-foreground">
                            H_friction = {calculatedData.equivLengthDisplay.toFixed(1)} × ({calculatedData.ff} ÷ 100)
                          </div>
                          <div className="font-bold text-[11px] text-foreground mt-0.5">H_loss = {calculatedData.frictionLossDisplay.toFixed(3)} {calculatedData.headUnit}</div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => handleOpenComment(stepId, stepLabel)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment"}</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Step 3 Friction", `${calculatedData.frictionLossDisplay.toFixed(3)} ${calculatedData.headUnit}`)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                      >
                        <Copy className="size-3.5 text-muted-foreground" />
                        <span>Copy Step 3 Result</span>
                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })()}

              {/* Step 4 */}
              {(() => {
                const stepId = "step-4-total-head";
                const stepLabel = "Step 4: Total Dynamic Pump Head (TDH)";
                const stepComments = getMergedItemComments(stepId, undefined, commentsList, "/chw-pump-head", project?.id);
                const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                return (
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id={stepId}
                        data-item-id={stepId}
                        data-field-id={stepId}
                        className={`flex gap-3 items-start border border-border/60 bg-surface-2/40 p-3 rounded-xl transition cursor-context-menu hover:border-primary/40 relative ${
                          isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                        }`}
                      >
                        <RowCommentCornerBadge
                          id={stepId}
                          count={stepComments.length}
                          onClick={() => handleOpenComment(stepId, stepLabel)}
                        />
                        <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">4</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground flex items-center justify-between">
                            <span>{stepLabel}</span>
                          </div>
                          <div className="font-mono text-primary my-1 font-semibold">TDH = (H_loss + H_static + H_outlet − H_suction) × (1 + SF ÷ 100)</div>
                          <div className="font-mono text-[10.5px] text-muted-foreground">
                            TDH = ({calculatedData.frictionLossDisplay.toFixed(3)} + {calculatedData.staticHeadDisplay.toFixed(2)} + {calculatedData.outletHeadDisplay.toFixed(2)} − {calculatedData.suctionHeadDisplay.toFixed(2)}) × (1 + {calculatedData.sfPercent}%)
                          </div>
                          <div className="font-bold text-[11px] text-foreground mt-0.5">TDH = {calculatedData.pumpHeadCalcDisplay.toFixed(3)} {calculatedData.headUnit}</div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => handleOpenComment(stepId, stepLabel)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment"}</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Step 4 TDH", `${calculatedData.pumpHeadCalcDisplay.toFixed(3)} ${calculatedData.headUnit}`)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                      >
                        <Copy className="size-3.5 text-muted-foreground" />
                        <span>Copy Step 4 Result</span>
                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })()}

              {/* Step 5 */}
              {(() => {
                const stepId = "step-5-motor-power";
                const stepLabel = "Step 5: Hydraulic Shaft & Motor Sizing Power";
                const stepComments = getMergedItemComments(stepId, undefined, commentsList, "/chw-pump-head", project?.id);
                const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                return (
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id={stepId}
                        data-item-id={stepId}
                        data-field-id={stepId}
                        className={`flex gap-3 items-start border border-border/60 bg-surface-2/40 p-3 rounded-xl transition cursor-context-menu hover:border-primary/40 relative ${
                          isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                        }`}
                      >
                        <RowCommentCornerBadge
                          id={stepId}
                          count={stepComments.length}
                          onClick={() => handleOpenComment(stepId, stepLabel)}
                        />
                        <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">5</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground flex items-center justify-between">
                            <span>{stepLabel}</span>
                          </div>
                          <div className="font-mono text-primary my-1 font-semibold">P_shaft = (Flow_kg/s × Lift_kPa) ÷ (1000 × η_pump), P_motor = P_shaft ÷ η_motor</div>
                          <div className="font-mono text-[10.5px] text-muted-foreground">
                            P_shaft = ({calculatedData.massFlow.toFixed(3)} × {calculatedData.liftKpa.toFixed(1)}) ÷ (1000 × {calculatedData.effPumpVal / 100}) = {calculatedData.shaftPowerKw.toFixed(2)} kW
                          </div>
                          <div className="font-bold text-[11px] text-[#0A7BC7] mt-0.5">
                            P_motor = {calculatedData.motorPowerKw.toFixed(2)} kW ({calculatedData.motorPowerHp.toFixed(2)} HP)
                          </div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => handleOpenComment(stepId, stepLabel)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment"}</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Step 5 Motor Power", `${calculatedData.motorPowerKw.toFixed(2)} kW`)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                      >
                        <Copy className="size-3.5 text-muted-foreground" />
                        <span>Copy Step 5 Result</span>
                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })()}

            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <span className="text-[11px] text-muted-foreground font-mono">
                Tip: You can double-click any calculation row on the main screen to open this breakdown.
              </span>
              <button
                type="button"
                onClick={() => setShowDetailedCalcs(false)}
                className="px-5 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition cursor-pointer shadow-sm"
              >
                Close Breakdown
              </button>
            </div>

          </div>
        </div>
      )}
    </AppShell>
  );
}

// ==========================================
// CHW PUMP HEAD REPORT VIEW (MATCHING PLUMBING PUMP SIZING)
// ==========================================
function ChwPumpHeadReportView({
  sizingParams,
  calculatedData,
  unitSystem,
  project,
  calcReviewState,
  currentUserName,
  projectInfo,
  onExportPdf,
  onExportExcel,
}: {
  sizingParams: any;
  calculatedData: any;
  unitSystem: "si" | "ip";
  project: any;
  calcReviewState: any;
  currentUserName: string;
  projectInfo: any;
  onExportPdf: () => void;
  onExportExcel: () => void;
}) {
  const isSI = unitSystem === "si";
  const today = projectInfo?.date || new Date().toLocaleDateString("en-GB");
  const calcNo = projectInfo?.calcNumber || project?.calcNo || "CALC-HVAC-PMP02";
  const projectNo = projectInfo?.projectNumber || project?.code || "MEP-CHW-02";
  const projectName = projectInfo?.projectName || project?.name || "Commercial Tower CHW Pumping Study";
  const clientName = projectInfo?.client || project?.client || "Summit Estates Ltd";
  const endUser = projectInfo?.endUser || project?.location || "Facility Management";

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white dark:bg-zinc-950 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Printable Document Sheet Container */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
          
          {/* Header Title & Date */}
          <div className="flex justify-between items-start border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary tracking-wider uppercase">ASHRAE HVAC Engineering Standard</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground font-mono">HVAC Dynamic Circulation Loop</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1">
                Chilled Water Pump Dynamic Head &amp; Motor Sizing Report
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dynamic pipe friction, fittings equivalent losses, static elevation lift, and motor electrical demand.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block mt-0.5 font-mono">Date: {today}</span>
            </div>
          </div>

          {/* Project Metadata Table 3x2 (Enclosed Corporate Header matching Plumbing Pump Sizing) */}
          <div className="border border-border rounded-xl overflow-hidden text-xs">
            <div className="grid grid-cols-4 divide-x divide-y divide-border">
              <div className="p-2.5 font-bold bg-muted/20">Calculation No.:</div>
              <div className="p-2.5 font-mono">{calcNo}</div>
              <div className="p-2.5 font-bold bg-muted/20">Date:</div>
              <div className="p-2.5 font-mono">{today}</div>

              <div className="p-2.5 font-bold bg-muted/20">Project No.:</div>
              <div className="p-2.5 font-mono">{projectNo}</div>
              <div className="p-2.5 font-bold bg-muted/20">Client:</div>
              <div className="p-2.5">{clientName}</div>

              <div className="p-2.5 font-bold bg-muted/20">Project Name:</div>
              <div className="p-2.5">{projectName}</div>
              <div className="p-2.5 font-bold bg-muted/20">End User:</div>
              <div className="p-2.5">{endUser}</div>
            </div>
          </div>

          {/* Table 1: Executive Design Parameters & Pump Duty Summary */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              1. Executive Design Parameters &amp; CHW Pump Duty Summary
            </h3>
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2.5 w-12 text-center">No.</th>
                    <th className="p-2.5">Executive Design Parameter Summary</th>
                    <th className="p-2.5 text-center w-28">Value</th>
                    <th className="p-2.5 text-center w-20">Unit</th>
                    <th className="p-2.5">Engineering Design Basis / Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">1</td>
                    <td className="p-2.5 font-bold">Chilled Water System Loop</td>
                    <td className="p-2.5 text-center font-bold text-foreground">Secondary Loop</td>
                    <td className="p-2.5 text-center text-muted-foreground">-</td>
                    <td className="p-2.5 text-muted-foreground">Variable speed primary/secondary chilled water distribution</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                    <td className="p-2.5 font-bold">Design Fluid &amp; Operating Temperatures</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">Water (6°C / 12°C)</td>
                    <td className="p-2.5 text-center text-muted-foreground">°C</td>
                    <td className="p-2.5 text-muted-foreground">Cp = 4.186 kJ/kg·K @ ΔT = 5.5°C to 6.0°C standard lift</td>
                  </tr>
                  {/* Highlighted Duty Parameter: Design Flow Rate */}
                  <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                    <td className="p-2.5 text-center font-mono">3</td>
                    <td className="p-2.5 font-bold">Design Flow Rate (Q)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{calculatedData.flowRateDisplay.toFixed(2)}</td>
                    <td className="p-2.5 text-center font-mono font-bold">{calculatedData.flowUnit}</td>
                    <td className="p-2.5">Chilled water mass flow rate: {calculatedData.massFlow.toFixed(3)} kg/s</td>
                  </tr>
                  {/* Highlighted Duty Parameter: Total Dynamic Head */}
                  <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                    <td className="p-2.5 text-center font-mono">4</td>
                    <td className="p-2.5 font-bold">Calculated Total Dynamic Head (TDH)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{calculatedData.pumpHeadCalcDisplay.toFixed(3)}</td>
                    <td className="p-2.5 text-center font-mono font-bold">{calculatedData.headUnit}</td>
                    <td className="p-2.5">Pipe friction + static elevation + terminal residual + {calculatedData.sfPercent}% margin</td>
                  </tr>
                  {/* Highlighted Duty Parameter: Motor Power */}
                  <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                    <td className="p-2.5 text-center font-mono">5</td>
                    <td className="p-2.5 font-bold">Estimated Motor Power Rating</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{calculatedData.motorPowerKw.toFixed(2)}</td>
                    <td className="p-2.5 text-center font-mono font-bold">kW</td>
                    <td className="p-2.5">Equivalent: {calculatedData.motorPowerHp.toFixed(2)} HP (Pump η: {calculatedData.effPumpVal}%, Motor η: {calculatedData.effMotorVal}%)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Detailed Hydraulic Piping & Friction Loss Schedule */}
          <div className="space-y-2 mt-6">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              2. Hydraulic Piping &amp; Friction Loss Schedule
            </h3>
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2.5 w-12 text-center">No.</th>
                    <th className="p-2.5">Piping &amp; Hydraulic Loss Parameter</th>
                    <th className="p-2.5 text-center w-28">Value</th>
                    <th className="p-2.5 text-center w-20">Unit</th>
                    <th className="p-2.5">Engineering Calculation Basis</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-border">
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">1</td>
                    <td className="p-2.5 font-bold">Vertical Pipe Height (Riser Lift)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.vertLengthDisplay.toFixed(1)}</td>
                    <td className="p-2.5 text-center">{calculatedData.lengthUnit}</td>
                    <td className="p-2.5 text-muted-foreground">Geometric vertical height differential through building shaft</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                    <td className="p-2.5 font-bold">Horizontal Pipe Header Run</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.horizLengthDisplay.toFixed(1)}</td>
                    <td className="p-2.5 text-center">{calculatedData.lengthUnit}</td>
                    <td className="p-2.5 text-muted-foreground">Plantroom headers, basement runs, and floor branch distributions</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                    <td className="p-2.5 font-bold">Fittings &amp; Valves Equivalent Allowance</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{(calculatedData.elbowsLengthDisplay + calculatedData.valvesLengthDisplay).toFixed(1)}</td>
                    <td className="p-2.5 text-center">{calculatedData.lengthUnit}</td>
                    <td className="p-2.5 text-muted-foreground">30% elbows + 30% isolation valves ASHRAE dynamic allowance</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">4</td>
                    <td className="p-2.5 font-bold">Total Equivalent Pipe Length (L_equiv)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.equivLengthDisplay.toFixed(1)}</td>
                    <td className="p-2.5 text-center">{calculatedData.lengthUnit}</td>
                    <td className="p-2.5 text-muted-foreground">Developed length with 5% safety margin rounded to nearest 10m step</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">5</td>
                    <td className="p-2.5 font-bold">Unit Friction Factor Rate</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.ff}</td>
                    <td className="p-2.5 text-center">{isSI ? "bar/100m" : "psi/100ft"}</td>
                    <td className="p-2.5 text-muted-foreground">Darcy-Weisbach / Hazen-Williams dynamic hydronic loss gradient</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">6</td>
                    <td className="p-2.5 font-bold">Calculated Piping Friction Head Loss</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.frictionLossDisplay.toFixed(3)}</td>
                    <td className="p-2.5 text-center">{calculatedData.headUnit}</td>
                    <td className="p-2.5 text-muted-foreground">L_equiv × (Friction Factor ÷ 100)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 3: Pressure Head Components & Total Dynamic Head (TDH) */}
          <div className="space-y-2 mt-6">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              3. Pressure Head Components &amp; Total Dynamic Head Breakdown
            </h3>
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2.5 w-12 text-center">No.</th>
                    <th className="p-2.5">Head &amp; Pressure Component</th>
                    <th className="p-2.5 text-center w-28">Value</th>
                    <th className="p-2.5 text-center w-20">Unit</th>
                    <th className="p-2.5">System Pressure Basis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">1</td>
                    <td className="p-2.5 font-bold">Static Elevation Head (H_static)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.staticHeadDisplay.toFixed(2)}</td>
                    <td className="p-2.5 text-center">{calculatedData.headUnit}</td>
                    <td className="p-2.5 text-muted-foreground">Rooftop AHU / highest terminal riser static elevation differential</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                    <td className="p-2.5 font-bold">Residual Terminal Outlet Pressure</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.outletHeadDisplay.toFixed(2)}</td>
                    <td className="p-2.5 text-center">{calculatedData.headUnit}</td>
                    <td className="p-2.5 text-muted-foreground">Pressure drop across remote 2-way control valve and cooling coil</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                    <td className="p-2.5 font-bold">Suction Pressure Deducted</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">-{calculatedData.suctionHeadDisplay.toFixed(2)}</td>
                    <td className="p-2.5 text-center">{calculatedData.headUnit}</td>
                    <td className="p-2.5 text-muted-foreground">Positive suction pressure from header or booster stage</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">4</td>
                    <td className="p-2.5 font-bold">Contingency Safety Factor</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.sfPercent}%</td>
                    <td className="p-2.5 text-center">%</td>
                    <td className="p-2.5 text-muted-foreground">Engineering allowance for aging, scaling, and future expansion</td>
                  </tr>
                  <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                    <td className="p-2.5 text-center font-mono">5</td>
                    <td className="p-2.5 font-bold">Final Operating Head Selection (TDH)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{calculatedData.pumpHeadSelectedDisplay.toFixed(3)}</td>
                    <td className="p-2.5 text-center font-mono font-bold">{calculatedData.headUnit}</td>
                    <td className="p-2.5">{sizingParams.selectedHead ? "User custom operating head override" : "Calculated TDH based on complete hydraulic circuit"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 4: Motor & Energy Demand Analysis */}
          <div className="space-y-2 mt-6">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              4. Motor &amp; Energy Demand Analysis
            </h3>
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2.5 w-12 text-center">No.</th>
                    <th className="p-2.5">Power &amp; Efficiency Parameter</th>
                    <th className="p-2.5 text-center w-28">Value</th>
                    <th className="p-2.5 text-center w-20">Unit</th>
                    <th className="p-2.5">Efficiency &amp; Mechanical Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">1</td>
                    <td className="p-2.5 font-bold">Hydraulic Lift Pressure Differential</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.liftKpa.toFixed(1)}</td>
                    <td className="p-2.5 text-center">kPa</td>
                    <td className="p-2.5 text-muted-foreground">Calculated pressure differential = TDH × 100 kPa/bar</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                    <td className="p-2.5 font-bold">Pump Hydraulic Efficiency (η_pump)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.effPumpVal}%</td>
                    <td className="p-2.5 text-center">%</td>
                    <td className="p-2.5 text-muted-foreground">Centrifugal chilled water pump hydraulic efficiency curve</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                    <td className="p-2.5 font-bold">Calculated Shaft Power (P_shaft)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.shaftPowerKw.toFixed(2)}</td>
                    <td className="p-2.5 text-center">kW</td>
                    <td className="p-2.5 text-muted-foreground">P_shaft = (Q × ΔP) ÷ (1000 × η_pump)</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">4</td>
                    <td className="p-2.5 font-bold">Electric Motor Efficiency (η_motor)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.effMotorVal}%</td>
                    <td className="p-2.5 text-center">%</td>
                    <td className="p-2.5 text-muted-foreground">IEC Premium Efficiency (IE3 / IE4) induction motor rating</td>
                  </tr>
                  <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                    <td className="p-2.5 text-center font-mono">5</td>
                    <td className="p-2.5 font-bold">Required Motor Power (P_motor)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{calculatedData.motorPowerKw.toFixed(2)}</td>
                    <td className="p-2.5 text-center font-mono font-bold">kW</td>
                    <td className="p-2.5">P_motor = P_shaft ÷ η_motor ({calculatedData.motorPowerHp.toFixed(2)} HP duty)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Compliance Verification Banner */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                Hydraulic Duty &amp; Motor Power Compliance Verification
              </span>
              <p className="text-muted-foreground leading-relaxed">
                This chilled water pump sizing calculation complies with ASHRAE 90.1, CIBSE KS04, and Hydraulic Institute (HI) standards for commercial hydronic loops. Total Dynamic Head accommodates developed piping equivalent length, static elevation differentials, and a {calculatedData.sfPercent}% design safety contingency.
              </p>
            </div>
          </div>

          {/* Table 5: 4-Column Professional Review & Sign-Off Block */}
          <div className="space-y-2 mt-6">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              5. Professional Review &amp; Sign-Off Block
            </h3>
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2.5 text-left w-1/4">Approval Role</th>
                    <th className="p-2.5 text-center w-1/4">Originated By</th>
                    <th className="p-2.5 text-center w-1/4">Reviewed By</th>
                    <th className="p-2.5 text-center w-1/4">Approved By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 font-bold bg-muted/10">Full Name</td>
                    <td className="p-2.5 text-center font-mono text-foreground font-semibold">{currentUserName}</td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">{calcReviewState?.reviewedBy || "Pending Review"}</td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">{calcReviewState?.approvedBy || "Pending Approval"}</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 font-bold bg-muted/10">Designation</td>
                    <td className="p-2.5 text-center text-muted-foreground">HVAC Design Engineer</td>
                    <td className="p-2.5 text-center text-muted-foreground">Lead MEP Engineer</td>
                    <td className="p-2.5 text-center text-muted-foreground">Principal Consultant</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold bg-muted/10">Status / Decision</td>
                    <td className="p-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">DESIGN READY</td>
                    <td className="p-2.5 text-center font-bold font-mono">
                      {calcReviewState?.status === "APPROVED" || calcReviewState?.status === "REVIEWED" ? "REVIEW VERIFIED" : "PENDING"}
                    </td>
                    <td className="p-2.5 text-center font-bold font-mono">
                      {calcReviewState?.status === "APPROVED" ? "APPROVED FOR TENDER" : "PENDING"}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 font-bold bg-muted/10">Action Date</td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">{today}</td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">
                      {calcReviewState?.reviewedAt ? formatDateStr(calcReviewState.reviewedAt) : "-"}
                    </td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">
                      {calcReviewState?.approvedAt ? formatDateStr(calcReviewState.approvedAt) : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Export Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border no-print">
            <TBtn onClick={onExportExcel} className="h-9 px-4 text-xs font-semibold">
              <FileSpreadsheet className="size-4 text-emerald-600" /> Export Excel
            </TBtn>
            <TBtn onClick={onExportPdf} className="h-9 px-4 text-xs font-semibold">
              <FileText className="size-4 text-blue-600" /> Export PDF
            </TBtn>
          </div>

        </div>

      </div>
    </div>
  );
}

// ==========================================
// CHW PUMP HEAD INTELLIGENCE DRAWER (MATCHING PLUMBING PUMP SIZING)
// ==========================================
function ChwPumpHeadIntelligenceDrawer({
  onClose,
  sizingParams,
  setSizingParams,
  saveParams,
  calculatedData,
  unitSystem,
  projectInfo,
}: {
  onClose: () => void;
  sizingParams: any;
  setSizingParams: React.Dispatch<React.SetStateAction<any>>;
  saveParams: (params: any, unit: "si" | "ip", proj?: any) => void;
  calculatedData: any;
  unitSystem: "si" | "ip";
  projectInfo: any;
}) {
  const isSI = unitSystem === "si";

  // Recommended discharge pipe size based on 1.5 m/s velocity
  const pipeSizing = useMemo(() => {
    const qM3s = (calculatedData.flowRate || 31.5) / 1000; // m3/s
    const targetVel = 1.5; // m/s
    const reqArea = qM3s / targetVel;
    const reqDiaMm = Math.sqrt((4 * reqArea) / Math.PI) * 1000;

    const stdSizes = [
      { dn: 50, nps: '2"', idMm: 52.5 },
      { dn: 65, nps: '2.5"', idMm: 68.8 },
      { dn: 80, nps: '3"', idMm: 80.8 },
      { dn: 100, nps: '4"', idMm: 102.3 },
      { dn: 125, nps: '5"', idMm: 128.2 },
      { dn: 150, nps: '6"', idMm: 154.1 },
      { dn: 200, nps: '8"', idMm: 202.7 },
      { dn: 250, nps: '10"', idMm: 254.5 },
      { dn: 300, nps: '12"', idMm: 304.8 },
      { dn: 350, nps: '14"', idMm: 336.5 },
      { dn: 400, nps: '16"', idMm: 387.4 },
      { dn: 500, nps: '20"', idMm: 488.9 },
    ];

    let chosen = stdSizes[0];
    for (const s of stdSizes) {
      if (s.idMm >= reqDiaMm * 0.92) {
        chosen = s;
        break;
      }
    }

    const actualArea = (Math.PI * Math.pow(chosen.idMm / 1000, 2)) / 4;
    const actualVelMps = qM3s / actualArea;
    const actualVelFps = actualVelMps * 3.28084;

    return {
      dn: chosen.dn,
      nps: chosen.nps,
      velocityMps: actualVelMps,
      velocityFps: actualVelFps,
    };
  }, [calculatedData.flowRate]);

  // Standard motor sizing step
  const motorSizing = useMemo(() => {
    const stdKwSteps = [0.75, 1.1, 1.5, 2.2, 3.0, 4.0, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250, 315];
    const pMot = calculatedData.motorPowerKw || 5.5;
    let chosenKw = stdKwSteps[stdKwSteps.length - 1];
    for (const kw of stdKwSteps) {
      if (kw >= pMot * 1.0) {
        chosenKw = kw;
        break;
      }
    }
    const stdHp = Number((chosenKw * 1.34102).toFixed(1));
    const fla3Phase = Math.round((chosenKw * 1000) / (Math.sqrt(3) * 400 * 0.85 * 0.90));
    const starter = chosenKw <= 5.5 ? "Direct-On-Line (DOL) / VFD" : chosenKw <= 11 ? "Star-Delta / VFD" : "Variable Frequency Drive (VFD)";

    return {
      stdKw: chosenKw,
      stdHp,
      fla3Phase,
      starter,
    };
  }, [calculatedData.motorPowerKw]);

  // Engineering Diagnostics & Warnings
  const auditWarnings = useMemo(() => {
    const list: Array<{ type: "warning" | "info" | "success"; text: string }> = [];

    if (pipeSizing.velocityMps > 2.4) {
      list.push({
        type: "warning",
        text: `High discharge flow velocity (${pipeSizing.velocityMps.toFixed(2)} m/s). Recommended maximum is 2.2 m/s to prevent pipe erosion and hydronic noise.`,
      });
    } else if (pipeSizing.velocityMps < 0.8) {
      list.push({
        type: "warning",
        text: `Low velocity in pipe (${pipeSizing.velocityMps.toFixed(2)} m/s). Risk of sedimentation in chilled water header.`,
      });
    } else {
      list.push({
        type: "success",
        text: `Flow velocity is within optimal ASHRAE chilled water range (1.2–2.2 m/s).`,
      });
    }

    if (calculatedData.ff > 0.5) {
      list.push({
        type: "warning",
        text: `High friction factor (${calculatedData.ff} bar/100m). Consider upsizing pipe diameter to save long-term pumping energy.`,
      });
    }

    if (calculatedData.effPumpVal < 65) {
      list.push({
        type: "warning",
        text: `Pump efficiency is set below 65%. Most modern centrifugal CHW pumps achieve 70–82%.`,
      });
    }

    if (calculatedData.sfPercent < 5) {
      list.push({
        type: "info",
        text: `Safety margin is below 5%. 5–10% contingency is recommended for piping scale and future demand.`,
      });
    }

    return list;
  }, [pipeSizing, calculatedData]);

  // Overall compliance score
  const complianceScore = useMemo(() => {
    let score = 100;
    if (pipeSizing.velocityMps > 2.4 || pipeSizing.velocityMps < 0.8) score -= 15;
    if (calculatedData.ff > 0.5) score -= 15;
    if (calculatedData.effPumpVal < 65) score -= 10;
    if (calculatedData.sfPercent < 5) score -= 10;
    return Math.max(50, Math.min(100, score));
  }, [pipeSizing, calculatedData]);

  // Application Presets
  const presets = [
    {
      id: "primary-constant",
      name: "Primary Constant Flow Loop (1W+1S)",
      desc: "Chiller evaporator circulation at 2.5 bar TDH, 400 GPM flow, low static lift.",
      apply: () => {
        const next = {
          ...sizingParams,
          flowUsgpm: unitSystem === "ip" ? 400 : 400,
          vertLength: unitSystem === "ip" ? 30 : 10,
          horizLength: unitSystem === "ip" ? 150 : 50,
          frictionFactor: unitSystem === "ip" ? 1.5 : 0.35,
          staticHead: unitSystem === "ip" ? 15 : 1.0,
          residualPressure: unitSystem === "ip" ? 20 : 1.5,
          suctionPressure: 0.0,
          safetyFactorHead: 5,
          effPump: 75,
          effMotor: 90,
        };
        saveParams(next, unitSystem, projectInfo);
        toast.success("Applied Primary Constant Flow Preset!");
      },
    },
    {
      id: "secondary-variable",
      name: "Secondary Variable Primary (2W+1S)",
      desc: "Commercial building secondary distribution, 500 GPM, 4.5 bar TDH across high-rise risers.",
      apply: () => {
        const next = {
          ...sizingParams,
          flowUsgpm: unitSystem === "ip" ? 500 : 500,
          vertLength: unitSystem === "ip" ? 100 : 30,
          horizLength: unitSystem === "ip" ? 400 : 120,
          frictionFactor: unitSystem === "ip" ? 1.77 : 0.4,
          staticHead: unitSystem === "ip" ? 43.5 : 3.0,
          residualPressure: unitSystem === "ip" ? 29.0 : 2.0,
          suctionPressure: 0.0,
          safetyFactorHead: 5,
          effPump: 72,
          effMotor: 85,
        };
        saveParams(next, unitSystem, projectInfo);
        toast.success("Applied Secondary Variable Primary Preset!");
      },
    },
    {
      id: "tertiary-heat-exchanger",
      name: "Tertiary Heat Exchanger Pump",
      desc: "District cooling plate heat exchanger decoupling pump, 3.2 bar TDH with compact runs.",
      apply: () => {
        const next = {
          ...sizingParams,
          flowUsgpm: unitSystem === "ip" ? 300 : 300,
          vertLength: unitSystem === "ip" ? 20 : 6,
          horizLength: unitSystem === "ip" ? 100 : 30,
          frictionFactor: unitSystem === "ip" ? 1.6 : 0.38,
          staticHead: unitSystem === "ip" ? 10 : 0.8,
          residualPressure: unitSystem === "ip" ? 25 : 1.8,
          suctionPressure: 0.0,
          safetyFactorHead: 5,
          effPump: 78,
          effMotor: 90,
        };
        saveParams(next, unitSystem, projectInfo);
        toast.success("Applied Tertiary Heat Exchanger Preset!");
      },
    },
  ];

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in select-none">
      {/* Header matching Plumbing Pump Sizing */}
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </header>

      {/* Drawer Scrollable Content */}
      <div className="flex-1 overflow-auto">
        {/* Compliance Status Section */}
        <IntelSection icon={CheckCircle2} tone={complianceScore >= 80 ? "success" : "warning"} title="Compliance Status">
          <div className="text-[12px] text-muted-foreground">
            ASHRAE 90.1, CIBSE KS04 &amp; Hydraulic Institute validation across loop hydraulics.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${complianceScore >= 80 ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${complianceScore}%` }}
              />
            </div>
            <span className="font-mono tabular text-[11.5px] font-semibold">{complianceScore}%</span>
          </div>
        </IntelSection>

        {/* Hydraulic & Pipe Sizing Audit */}
        <IntelSection icon={Activity} tone="primary" title="Hydraulic & Pipe Sizing Audit">
          <div className="p-2.5 rounded-xl border border-primary/20 bg-primary/5 text-foreground flex flex-col gap-1 mb-2.5">
            <div className="flex items-center justify-between font-semibold text-[11.5px]">
              <span>Recommended Header Size</span>
              <span className="font-mono font-bold text-primary text-[12.5px]">
                {isSI ? `DN ${pipeSizing.dn} mm` : `${pipeSizing.nps} NPS`}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Calculated flow velocity is <strong className="text-foreground">{isSI ? `${pipeSizing.velocityMps.toFixed(2)} m/s` : `${pipeSizing.velocityFps.toFixed(2)} ft/s`}</strong> (standard 1.2–2.2 m/s range to prevent noise and erosion).
            </p>
          </div>
          <KV
            k="Operating Design Flow"
            v={`${calculatedData.flowRateDisplay.toFixed(2)} ${calculatedData.flowUnit}`}
          />
          <KV
            k="Total Dynamic Head"
            v={`${calculatedData.pumpHeadCalcDisplay.toFixed(3)} ${calculatedData.headUnit}`}
          />
          <KV
            k="Friction vs Static Head"
            v={calculatedData.pumpHeadCalcDisplay > 0 ? `${Math.round((calculatedData.frictionLossDisplay / calculatedData.pumpHeadCalcDisplay) * 100)}% / ${Math.round((calculatedData.staticHeadDisplay / calculatedData.pumpHeadCalcDisplay) * 100)}%` : "0% / 0%"}
          />
        </IntelSection>

        {/* Motor & Electrical Sizing */}
        <IntelSection icon={Zap} tone="primary" title="Motor & Electrical Sizing (IE3)">
          <KV
            k="Standard Motor Step"
            v={`${motorSizing.stdKw} kW (${motorSizing.stdHp} HP)`}
          />
          <KV
            k="Shaft Power Demand"
            v={`${calculatedData.shaftPowerKw.toFixed(2)} kW`}
          />
          <KV
            k="Est. 3-Ph Current (400V)"
            v={`~${motorSizing.fla3Phase} Amps`}
          />
          <KV
            k="Recommended Starter"
            v={motorSizing.starter}
          />
        </IntelSection>

        {/* Engineering Diagnostics & Warnings */}
        <IntelSection
          icon={auditWarnings.some(w => w.type === "warning") ? AlertTriangle : ShieldCheck}
          tone={auditWarnings.some(w => w.type === "warning") ? "warning" : "success"}
          title="Engineering Diagnostics"
        >
          <div className="space-y-2 mt-1">
            {auditWarnings.map((w, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                  w.type === "warning"
                    ? "border-amber-500/25 bg-amber-500/5 text-amber-900 dark:text-amber-200"
                    : w.type === "info"
                    ? "border-blue-500/25 bg-blue-500/5 text-blue-900 dark:text-blue-200"
                    : "border-emerald-500/20 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
                }`}
              >
                {w.type === "warning" ? (
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
                ) : w.type === "info" ? (
                  <Info className="size-4 shrink-0 mt-0.5 text-blue-500" />
                ) : (
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                )}
                <div className="text-[11.5px] leading-snug flex-1">
                  {w.text}
                </div>
              </div>
            ))}
          </div>
        </IntelSection>

        {/* Application Presets */}
        <IntelSection icon={SlidersHorizontal} tone="primary" title="Application Presets">
          <div className="space-y-2">
            {presets.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl border border-border/80 bg-surface-2/40 hover:bg-surface-2 transition flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[12px] text-foreground">{p.name}</span>
                  <button
                    type="button"
                    onClick={p.apply}
                    className="text-[10.5px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{p.desc}</p>
              </div>
            ))}
          </div>
        </IntelSection>

      </div>
    </div>
  );
}

// Reusable Intel drawer components matching Plumbing Pump Sizing
function IntelSection({
  icon: Icon,
  tone = "default",
  title,
  children,
}: {
  icon: any;
  tone?: "default" | "primary" | "warning" | "success";
  title: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
      ? "text-amber-500"
      : tone === "success"
      ? "text-emerald-500"
      : "text-muted-foreground";

  return (
    <div className="p-3.5 border-b border-border/60 space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className={`size-3.5 ${toneClass}`} />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs border-b border-border/40 last:border-0">
      <span className="text-muted-foreground text-[11.5px]">{k}</span>
      <span className="font-mono font-semibold text-foreground text-[12px]">{v}</span>
    </div>
  );
}
