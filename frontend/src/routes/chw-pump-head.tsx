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
  Download, Upload, Gauge, Layers, Zap, Flame, X, ArrowRight, Check
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
  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
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
      await exportChwPumpHeadExcel(
        {
          projectInfo,
          sizingParams,
          calculatedData,
          unitSystem,
        },
        {
          calcNo: projectInfo.calcNumber || "TRV-CHW-PUMP-01",
          projectNo: projectInfo.projectNumber || project?.code || "P000",
          projectName: projectInfo.projectName || project?.name || "CHW Pump Station",
          client: projectInfo.client || project?.client || "",
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
      sizingParams,
      calculatedData,
      projectInfo: {
        calcNumber: projectInfo.calcNumber || project?.calcNo || "CEC-MED-P539-202",
        projectNumber: projectInfo.projectNumber || project?.code || "6767",
        projectName: projectInfo.projectName || project?.name || "Dubai Mall",
        client: projectInfo.client || project?.client || "6765",
        endUser: projectInfo.endUser || project?.location || "hmbvm",
        date: projectInfo.date || new Date().toLocaleDateString("en-GB"),
      },
      meta: {
        userName: currentUserName,
      },
    });
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
            onDoubleClick={() => setShowDetailedCalcs(true)}
            title="Double-click to view step-by-step engineering calculation formulas"
            className={`flex justify-between items-center py-1.5 border-b border-border/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 px-2 rounded-lg transition cursor-pointer group ${
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

        <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => setShowDetailedCalcs(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/10 text-primary hover:text-primary rounded-lg cursor-pointer font-semibold"
          >
            <HelpCircle className="size-3.5 text-primary" />
            <span>View Calculation Steps</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double-Click</ContextMenuShortcut>
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
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Header Section matching screenshot */}
          <div className="flex flex-col gap-1 select-none">
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
                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  inputDescriptions="Vertical/Horizontal Lengths, Friction Factor, Pressures"
                  conversionExample={unitSystem === "si" ? "Convert 30 m → 98.4 ft, 0.4 bar/100m → 1.77 psi/100ft" : "Convert 100 ft → 30.5 m, 1.77 psi/100ft → 0.4 bar/100m"}
                />

                <TBtn onClick={handlePrintPDF} className="h-8 text-xs font-semibold">
                  <Printer className="size-3.5 text-blue-600" /> PDF Report
                </TBtn>
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Calculate chilled water pump dynamic piping friction losses, fittings equivalent lengths, static lift, and motor power requirements.
            </p>
          </div>

          {/* Core Calculator Layout (Balanced 6-6 Column Grid - No Scrolling Needed) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Inputs Column (6 cols) */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              
              {/* Card 1: Flow Demand & Piping Network */}
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">1. Flow Demand & Piping Geometry</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPclModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 hover:border-primary/40 border border-primary/25 rounded-lg transition shadow-2xs cursor-pointer"
                    title="Import total cooling load and calculate flow rate from Preliminary Cooling Load using Q = m·Cp·ΔT"
                  >
                    <Sparkles className="size-3 text-primary" />
                    <span>Import from PCL</span>
                  </button>
                </div>

                <div className="flex flex-col gap-2.5 text-xs">
                  {/* Flow Rate Input */}
                  {renderInputBox(
                    "chw-flow-rate",
                    "flowUsgpm",
                    `Design Flow Rate (${unitSystem === "ip" ? "GPM" : "L/s equivalent basis"})`,
                    sizingParams.flowUsgpm,
                    unitSystem === "ip" ? 500 : 500,
                    unitSystem === "ip" ? "500" : "500",
                    0
                  )}

                  {/* Quick PCL Indicator & 1-Click Apply */}
                  {pclSummary.count > 0 && pclSummary.totalKw > 0 && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-xs">
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

                  {/* 2-Column Grid for Lengths & Friction */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {renderInputBox(
                      "chw-vert-length",
                      "vertLength",
                      `Vertical Length (${calculatedData.lengthUnit})`,
                      sizingParams.vertLength,
                      unitSystem === "ip" ? 100 : 30,
                      unitSystem === "ip" ? "100" : "30",
                      0
                    )}
                    {renderInputBox(
                      "chw-horiz-length",
                      "horizLength",
                      `Horizontal Length (${calculatedData.lengthUnit})`,
                      sizingParams.horizLength,
                      unitSystem === "ip" ? 400 : 120,
                      unitSystem === "ip" ? "400" : "120",
                      0
                    )}
                    {renderInputBox(
                      "chw-friction-factor",
                      "frictionFactor",
                      `Friction Factor (${unitSystem === "ip" ? "psi/100ft" : "bar/100m"})`,
                      sizingParams.frictionFactor,
                      unitSystem === "ip" ? 1.77 : 0.4,
                      unitSystem === "ip" ? "1.77" : "0.4",
                      0,
                      "0.01"
                    )}
                    {renderInputBox(
                      "chw-safety-margin",
                      "safetyFactorHead",
                      "Safety Margin (%)",
                      sizingParams.safetyFactorHead,
                      5,
                      "5",
                      0,
                      "1"
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: Head Lift & Equipment Efficiencies */}
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">2. Head Pressures & Efficiencies</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
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
                    `Residual Outlet Press (${calculatedData.headUnit})`,
                    sizingParams.residualPressure,
                    unitSystem === "ip" ? 29.0 : 2.0,
                    unitSystem === "ip" ? "29.0" : "2.0",
                    0,
                    "0.1"
                  )}
                  {renderInputBox(
                    "chw-suction-pressure",
                    "suctionPressure",
                    `Suction Press Deducted (${calculatedData.headUnit})`,
                    sizingParams.suctionPressure,
                    0.0,
                    "0.0",
                    0,
                    "0.1"
                  )}
                  {renderInputBox(
                    "chw-selected-head",
                    "selectedHead",
                    `Operating Head Override (${calculatedData.headUnit})`,
                    sizingParams.selectedHead,
                    "",
                    "Calculated if blank",
                    0,
                    "0.1"
                  )}
                  {renderInputBox(
                    "chw-eff-pump",
                    "effPump",
                    "Pump Efficiency (%)",
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

            {/* Results Column (6 cols) */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              
              {/* Hero KPI Summary Strip */}
              <div 
                onDoubleClick={() => setShowDetailedCalcs(true)}
                title="Double-click to view step-by-step engineering calculation formulas"
                className="bg-gradient-to-r from-blue-50 via-sky-50/50 to-indigo-50/30 dark:from-blue-950/40 dark:via-sky-950/20 dark:to-indigo-950/20 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between gap-3 cursor-pointer hover:border-primary transition"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Pump Head (TDH)</span>
                  <span className="text-xl font-black font-mono text-primary mt-0.5">
                    {calculatedData.pumpHeadCalcDisplay.toFixed(3)} <span className="text-xs font-bold text-muted-foreground">{calculatedData.headUnit}</span>
                  </span>
                </div>

                <div className="h-8 w-px bg-border/80"></div>

                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Estimated Motor Power</span>
                  <span className="text-xl font-black font-mono text-foreground mt-0.5">
                    {calculatedData.motorPowerKw.toFixed(2)} <span className="text-xs font-bold text-muted-foreground">kW</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">({calculatedData.motorPowerHp.toFixed(2)} HP)</span>
                </div>

                <div className="h-8 w-px bg-border/80 hidden sm:block"></div>

                <div className="flex flex-col hidden sm:flex">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Design Flow</span>
                  <span className="text-base font-bold font-mono text-foreground mt-0.5">
                    {calculatedData.flowRateDisplay.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{calculatedData.flowUnit}</span>
                  </span>
                </div>
              </div>

              {/* Card 1: Piping & Equivalent Length Results */}
              <div 
                onDoubleClick={() => setShowDetailedCalcs(true)}
                title="Double-click to view step-by-step engineering calculation formulas"
                className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs hover:border-primary/40 transition cursor-pointer"
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Piping & Friction Loss Results</h3>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDetailedCalcs(true);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition cursor-pointer"
                    title="Double-click to view step-by-step math formulas"
                  >
                    <HelpCircle className="size-3" />
                    <span>Steps</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-sans text-xs">
                  {renderResultRow("res-sum-lengths", "Sum of Straight Lengths", `${(calculatedData.vertLengthDisplay + calculatedData.horizLengthDisplay).toFixed(1)} ${calculatedData.lengthUnit}`)}
                  {renderResultRow("res-elbows-eq", "Elbows Eq Length (+30%)", `${calculatedData.elbowsLengthDisplay.toFixed(2)} ${calculatedData.lengthUnit}`)}
                  {renderResultRow("res-valves-eq", "Valves Eq Length (+30%)", `${calculatedData.valvesLengthDisplay.toFixed(2)} ${calculatedData.lengthUnit}`)}
                  {renderResultRow("res-total-eq", "Total Eq Length (+5% SF)", `${calculatedData.equivLengthDisplay.toFixed(1)} ${calculatedData.lengthUnit}`, true, "text-[#0A7BC7] text-[12.5px]")}
                  {renderResultRow("res-friction-loss", "Major + Minor Friction Losses", `${calculatedData.frictionLossDisplay.toFixed(3)} ${calculatedData.headUnit}`, true, "text-[#0A7BC7] text-[13px]", true)}
                </div>
              </div>

              {/* Card 2: Pump Head & Motor Sizing Results */}
              <div 
                onDoubleClick={() => setShowDetailedCalcs(true)}
                title="Double-click to view step-by-step engineering calculation formulas"
                className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs hover:border-primary/40 transition cursor-pointer"
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Pump Head & Motor Sizing Results</h3>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDetailedCalcs(true);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition cursor-pointer"
                    title="Double-click to view step-by-step math formulas"
                  >
                    <HelpCircle className="size-3" />
                    <span>Steps</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-sans text-xs">
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
                  <Zap className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Import Flow Rate from PCL</h3>
                  <p className="text-xs text-muted-foreground">Thermodynamic derivation: Q = ṁ · Cp · ΔT</p>
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

            {/* PCL Source Summary Banner */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Flame className="size-3.5 text-orange-500" /> Building Total Cooling Load
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold font-mono text-primary">
                    {pclSummary.totalKw > 0 ? pclSummary.totalKw.toLocaleString() : "0"} kW
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    ({pclSummary.totalTr > 0 ? pclSummary.totalTr.toLocaleString() : "0"} TR)
                  </span>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                  {pclSummary.count} Space{pclSummary.count !== 1 ? "s" : ""}
                </span>
                {pclSummary.totalArea > 0 && (
                  <span className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    {pclSummary.totalArea.toLocaleString()} m²
                  </span>
                )}
              </div>
            </div>

            {/* Interactive Sizing Controls */}
            <div className="flex flex-col gap-4">
              
              {/* 1. Delta T Text/Number Input Only */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-foreground">
                    Chilled Water ΔT
                  </label>
                  <span className="text-xs font-mono font-bold text-primary">
                    {pclDeltaT > 0 ? pclDeltaT.toFixed(1) : "0.0"} °C{" "}
                    <span className="text-muted-foreground font-normal">
                      ({((pclDeltaT || 0) * 1.8).toFixed(1)} °F)
                    </span>
                  </span>
                </div>

                <div className="relative flex items-center">
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="30.0"
                    value={pclDeltaT || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPclDeltaT(isNaN(val) ? 0 : val);
                    }}
                    placeholder="Enter ΔT (e.g. 5.5)"
                    className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                  />
                  <span className="absolute right-3.5 text-xs font-bold text-muted-foreground font-mono select-none pointer-events-none">
                    °C
                  </span>
                </div>
              </div>

              {/* 2. Diversity Factor */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-foreground">
                    Diversity / Coincidence Factor
                  </label>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {pclDiversity}% <span className="text-muted-foreground font-normal">({((pclSummary.totalKw || 300) * (pclDiversity / 100)).toFixed(1)} kW)</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
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
            <div className="flex flex-col gap-3 text-xs font-sans">
              
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
                        className={`flex gap-3 items-start border border-border/60 bg-surface-2/40 p-3 rounded-xl transition cursor-context-menu hover:border-primary/40 ${
                          isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                        }`}
                      >
                        <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">1</div>
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
                          <div className="font-mono text-primary my-1 font-semibold">Q (L/s) = (Flow_GPM × 3.785) ÷ 60  |  ṁ = Q / (Cp · ΔT)</div>
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
                        className={`flex gap-3 items-start border border-border/60 bg-surface-2/40 p-3 rounded-xl transition cursor-context-menu hover:border-primary/40 ${
                          isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                        }`}
                      >
                        <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">2</div>
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
                          <div className="font-mono text-primary my-1 font-semibold">Leq = (L_vert + L_horiz + L_elbows + L_valves) × 1.05</div>
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
                        className={`flex gap-3 items-start border border-border/60 bg-surface-2/40 p-3 rounded-xl transition cursor-context-menu hover:border-primary/40 ${
                          isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                        }`}
                      >
                        <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">3</div>
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
                          <div className="font-mono text-primary my-1 font-semibold">H_loss = L_equiv × (FrictionFactor ÷ 100)</div>
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
                        className={`flex gap-3 items-start border border-border/60 bg-surface-2/40 p-3 rounded-xl transition cursor-context-menu hover:border-primary/40 ${
                          isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                        }`}
                      >
                        <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">4</div>
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
                          <div className="font-mono text-primary my-1 font-semibold">TDH = (H_loss + H_static + H_outlet − H_suction) × (1 + SF ÷ 100)</div>
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
                        className={`flex gap-3 items-start border border-border/60 bg-surface-2/40 p-3 rounded-xl transition cursor-context-menu hover:border-primary/40 ${
                          isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                        }`}
                      >
                        <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">5</div>
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
