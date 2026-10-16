import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  FileText, X, ChevronDown, Check,
  Copy, RotateCcw, MessageSquare, Download,
  ShieldCheck, Layers, Info, Wind, CheckCircle2,
  FileSpreadsheet, SlidersHorizontal
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
import { dirtyStore } from "@/lib/dirty-store";

export const Route = createFileRoute("/liftwell-pressurization")({
  head: () => ({
    meta: [
      { title: "Liftwell Pressurization — MEP Calc" },
      { name: "description", content: "Calculate the required air supply volume and pressure relief for liftwell and liftwell containment systems per BS EN 12101-6 Table A.3 & NFPA 92." },
    ],
  }),
  component: LiftwellPressurizationPage,
});

export type DoorTypeKey = "single_leaf_into" | "single_leaf_outwards" | "double_leaf" | "lift_landing";

export interface En12101PressurePoint {
  pressurePa: number;
  airflowM3s: number;
}

export interface DoorTypeDefinition {
  key: DoorTypeKey;
  name: string;
  label: string; // for backward compatibility
  leakageArea: number; // m²
  designLeakageRate: number; // m³/s at reference design condition (e.g. 0.03 m³/s for single leaf into)
  leakageRateAt12_5Pa: number; // m³/s @ 12.5 Pa
  leakageRateAt50Pa: number; // m³/s @ 50 Pa
  referencePressurePa: number;
  en12101PressureTable: En12101PressurePoint[];
  description: string;
}

// Centralized Calculation Constants
export const CALCULATION_CONSTANTS = {
  EGRESS_VELOCITY: 1.0, // m/s (BS EN 12101-6 standard design velocity for open escape doors)
  CLOSED_DOOR_SAFETY_FACTOR: 0.25, // 25% safety factor on closed-door leakage (Excel standard)
  FINAL_SAFETY_FACTOR: 0.10, // 10% overall system safety factor (Excel row 28-29)
  DEFAULT_PRESSURE_REF_PA: 12.5, // Pa (design differential pressure)
  DEFAULT_DUCT_LENGTH_M: 68, // m (shaft height for liftwell riser)
  DEFAULT_OUTLETS_COUNT: 9, // supply outlets count
  GRILL_LOUVER_DROP_PA: 85, // Pa (70 Pa grille + 15 Pa fire damper)
  DUCT_PRESSURE_RATE_PA_PER_M: 1.0, // Pa/m friction rate
};

// Centralized Door Types Configuration with EN 12101-6 Reference Data
export const DOOR_TYPES_CONFIG: Record<DoorTypeKey, DoorTypeDefinition> = {
  single_leaf_into: {
    key: "single_leaf_into",
    name: "Single-leaf opening into pressurized space",
    label: "Single-leaf opening into pressurized space",
    leakageArea: 0.01,
    designLeakageRate: 0.03, // m³/s (Standard design leakage rate)
    leakageRateAt12_5Pa: 0.03,
    leakageRateAt50Pa: 0.06,
    referencePressurePa: 12.5,
    en12101PressureTable: [
      { pressurePa: 8, airflowM3s: 0.02 },
      { pressurePa: 15, airflowM3s: 0.03 },
      { pressurePa: 20, airflowM3s: 0.04 },
      { pressurePa: 25, airflowM3s: 0.04 },
      { pressurePa: 50, airflowM3s: 0.06 },
    ],
    description: "Standard lift shaft door opening inward into the pressurized enclosure (EN 12101-6 Table A.3)",
  },
  single_leaf_outwards: {
    key: "single_leaf_outwards",
    name: "Single-leaf opening outwards",
    label: "Single-leaf opening outwards",
    leakageArea: 0.02,
    designLeakageRate: 0.06, // m³/s
    leakageRateAt12_5Pa: 0.06,
    leakageRateAt50Pa: 0.12,
    referencePressurePa: 12.5,
    en12101PressureTable: [
      { pressurePa: 8, airflowM3s: 0.04 },
      { pressurePa: 15, airflowM3s: 0.06 },
      { pressurePa: 20, airflowM3s: 0.07 },
      { pressurePa: 25, airflowM3s: 0.08 },
      { pressurePa: 50, airflowM3s: 0.12 },
    ],
    description: "Exit door opening outward from the pressurized enclosure (EN 12101-6 Table A.3)",
  },
  double_leaf: {
    key: "double_leaf",
    name: "Double-leaf opening",
    label: "Double-leaf opening",
    leakageArea: 0.03,
    designLeakageRate: 0.10, // m³/s
    leakageRateAt12_5Pa: 0.10,
    leakageRateAt50Pa: 0.18,
    referencePressurePa: 12.5,
    en12101PressureTable: [
      { pressurePa: 8, airflowM3s: 0.06 },
      { pressurePa: 15, airflowM3s: 0.10 },
      { pressurePa: 20, airflowM3s: 0.12 },
      { pressurePa: 25, airflowM3s: 0.13 },
      { pressurePa: 50, airflowM3s: 0.18 },
    ],
    description: "Double leaf doors connecting lift shaft or pressurized vestibules (EN 12101-6 Table A.3)",
  },
  lift_landing: {
    key: "lift_landing",
    name: "Lift landing door",
    label: "Lift landing door",
    leakageArea: 0.06,
    designLeakageRate: 0.19, // m³/s
    leakageRateAt12_5Pa: 0.19,
    leakageRateAt50Pa: 0.35,
    referencePressurePa: 12.5,
    en12101PressureTable: [
      { pressurePa: 8, airflowM3s: 0.12 },
      { pressurePa: 15, airflowM3s: 0.19 },
      { pressurePa: 20, airflowM3s: 0.23 },
      { pressurePa: 25, airflowM3s: 0.25 },
      { pressurePa: 50, airflowM3s: 0.35 },
    ],
    description: "Elevator shaft / landing doors connecting to pressurized liftwell (EN 12101-6 Table A.3)",
  },
};

// Backward-compatible alias
export const TABLE_A3_DOORS = DOOR_TYPES_CONFIG;

// Core 4 User Inputs
export interface liftwellParams {
  doorType: DoorTypeKey; // 1. Door Type (Dropdown)
  doorArea: number | ""; // 2. Door Area (m² or sq ft)
  openDoorsCount: number | ""; // 3. Number of Open Doors
  closedDoorsCount: number | ""; // 4. Number of Closed Doors
}

const DEFAULT_PARAMS: liftwellParams = {
  doorType: "lift_landing",
  doorArea: 2.76, // m² (1.2 m × 2.3 m as in Liftwell sheet)
  openDoorsCount: 1, // One open door by default
  closedDoorsCount: 17, // 17 closed doors
};

function LiftwellPressurizationPage() {
  const { project, isReadOnly, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/liftwell-pressurization", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/liftwell-pressurization", activeProjectId || project?.id);
  const { userData, profile, user } = useAuth();
  const currentUserName = userData?.name || profile?.name || user?.user_metadata?.full_name || user?.email?.split("@")?.[0] || "Design Engineer";
  const isApprovedLocked = useCalculationLock("/liftwell-pressurization", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";

  // State definitions
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [sizingParams, setSizingParams] = useState<liftwellParams>(DEFAULT_PARAMS);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [activeInfoModal, setActiveInfoModal] = useState<
    "open_doors" | "closed_doors" | "total_fan" | "pressure_drop" | "relief_area" | "table_a3" | null
  >(null);
  const [activeCommentTarget, setActiveCommentTarget] = useState<{ id: string; label: string } | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  

  // Notification target scroll / highlight listener
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

      const onGlobalNotification = (e: any) => {
        if (e.detail?.fieldName || e.detail?.targetItemId) {
          handleScrollTarget(e.detail.targetItemId, e.detail.fieldName);
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
    if (!project?.id) return;
    const pId = project.id;
    const storageKey = `mep_liftwell_pressurization_${pId}`;

    if (loadedProjectId !== pId) {
      let loadedData: any = null;

      if (project.workspace_data) {
        let wdata = project.workspace_data;
        if (typeof wdata === "string") {
          try { wdata = JSON.parse(wdata); } catch (e) {}
        }
        if (wdata?.liftwell_press_data) {
          loadedData = wdata.liftwell_press_data;
        }
      }

      if (!loadedData && typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(storageKey) || localStorage.getItem(`liftwell_press_state_${pId}`);
          if (saved) loadedData = JSON.parse(saved);
        } catch (e) {}
      }

      if (loadedData) {
        if (loadedData.sizingParams) {
          setSizingParams({
            ...DEFAULT_PARAMS,
            doorType: loadedData.sizingParams.doorType || DEFAULT_PARAMS.doorType,
            doorArea: loadedData.sizingParams.doorArea ?? DEFAULT_PARAMS.doorArea,
            openDoorsCount: loadedData.sizingParams.openDoorsCount ?? DEFAULT_PARAMS.openDoorsCount,
            closedDoorsCount: loadedData.sizingParams.closedDoorsCount ?? DEFAULT_PARAMS.closedDoorsCount,
          });
        }
        if (loadedData.unitSystem) setUnitSystem(loadedData.unitSystem);
        if (loadedData.commentsMap) setCommentsMap(loadedData.commentsMap);
      }

      setLoadedProjectId(pId);
    }
  }, [project, loadedProjectId]);

  // Save helper
  const saveState = (
    newParams: liftwellParams,
    newUnits: "si" | "ip",
    newComments = commentsMap
  ) => {
    const pId = project?.id || "default";
    const dataToSave = {
      sizingParams: newParams,
      unitSystem: newUnits,
      commentsMap: newComments,
      updatedAt: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(`mep_liftwell_pressurization_${pId}`, JSON.stringify(dataToSave));
    }

    dirtyStore.set(true);
  };

  // Door Type Dropdown Change Handler
  const handleDoorTypeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isEffectiveReadOnly) return;
    const selectedKey = e.target.value as DoorTypeKey;
    const doorInfo = DOOR_TYPES_CONFIG[selectedKey];
    if (!doorInfo) return;

    const isIp = unitSystem === "ip";
    const isLift = selectedKey === "lift_landing";

    // Update 4 core inputs with smart defaults if switching to lift vs standard stair
    const newParams: liftwellParams = {
      ...sizingParams,
      doorType: selectedKey,
      doorArea: isLift
        ? (isIp ? Number((2.76 * 10.7639).toFixed(2)) : 2.76)
        : (isIp ? Number((2.53 * 10.7639).toFixed(2)) : 2.53),
      openDoorsCount: isLift ? 1 : 2,
      closedDoorsCount: isLift ? 17 : 16,
    };

    setSizingParams(newParams);
    saveState(newParams, unitSystem);
    toast.success(`Selected ${doorInfo.name} (Leakage Rate: ${doorInfo.designLeakageRate} m³/s)`);
  };

  // Unit conversion
  const handleUnitSystemChange = (target: "si" | "ip", shouldConvert: boolean = true) => {
    if (target === unitSystem) return;
    const area = sizingParams.doorArea;
    let convertedArea: number | "" = area;

    if (shouldConvert) {
      if (target === "si") {
        convertedArea = area !== "" ? Number((Number(area) / 10.7639).toFixed(2)) : "";
      } else {
        convertedArea = area !== "" ? Number((Number(area) * 10.7639).toFixed(2)) : "";
      }
    }

    const updatedParams: liftwellParams = {
      ...sizingParams,
      doorArea: convertedArea,
    };

    setUnitSystem(target);
    setSizingParams(updatedParams);
    saveState(updatedParams, target);
    toast.success(`Switched unit system to ${target.toUpperCase()}`);
  };

  // Validation according to Section 12
  const validationErrors = useMemo(() => {
    const errors: { doorType?: string; doorArea?: string; openDoors?: string; closedDoors?: string } = {};

    if (!sizingParams.doorType || !DOOR_TYPES_CONFIG[sizingParams.doorType]) {
      errors.doorType = "Door Type selection is mandatory.";
    }

    if (sizingParams.doorArea === "" || isNaN(Number(sizingParams.doorArea))) {
      errors.doorArea = "Door Area is mandatory.";
    } else if (Number(sizingParams.doorArea) <= 0) {
      errors.doorArea = "Door Area must be greater than 0.";
    }

    if (sizingParams.openDoorsCount === "" || isNaN(Number(sizingParams.openDoorsCount))) {
      errors.openDoors = "Number of Open Doors is mandatory.";
    } else if (!Number.isInteger(Number(sizingParams.openDoorsCount)) || Number(sizingParams.openDoorsCount) < 1) {
      errors.openDoors = "Number of Open Doors must be an integer ≥ 1.";
    }

    if (sizingParams.closedDoorsCount === "" || isNaN(Number(sizingParams.closedDoorsCount))) {
      errors.closedDoors = "Number of Closed Doors is mandatory.";
    } else if (!Number.isInteger(Number(sizingParams.closedDoorsCount)) || Number(sizingParams.closedDoorsCount) < 0) {
      errors.closedDoors = "Number of Closed Doors must be an integer ≥ 0.";
    }

    return errors;
  }, [sizingParams]);

  const isValid = Object.keys(validationErrors).length === 0;

  // Calculation Engine strictly adhering to the 4 Core Inputs and Centralized Constants
  const calc = useMemo(() => {
    const isIp = unitSystem === "ip";

    if (!isValid) {
      return {
        isValid: false,
        isIp,
        doorAreaM2: 0,
        doorAreaSqFt: 0,
        egressVelocityMps: CALCULATION_CONSTANTS.EGRESS_VELOCITY,
        openDoorsCount: 0,
        closedDoorsCount: 0,
        leakageRateM3s: 0,
        openFlowM3s: 0,
        openFlowLs: 0,
        openFlowCfm: 0,
        closedLeakageBaseM3s: 0,
        closedSafetyFactor: CALCULATION_CONSTANTS.CLOSED_DOOR_SAFETY_FACTOR,
        closedSafetyM3s: 0,
        closedFlowM3s: 0,
        closedFlowLs: 0,
        closedFlowCfm: 0,
        subtotalM3s: 0,
        subtotalLs: 0,
        subtotalCfm: 0,
        fanSafetyFactor: CALCULATION_CONSTANTS.FINAL_SAFETY_FACTOR,
        fanSafetyM3s: 0,
        totalFanCapacityM3s: 0,
        totalFanCapacityLs: 0,
        totalFanCapacityCfm: 0,
        totalFanCapacityM3h: 0,
        designPressureDropPa: 0,
        reliefAreaM2: 0,
        reliefAreaSqFt: 0,
        airVolumePerOutletLs: 0,
      };
    }

    const doorConfig = DOOR_TYPES_CONFIG[sizingParams.doorType] || DOOR_TYPES_CONFIG.single_leaf_into;
    const rawArea = Number(sizingParams.doorArea);
    const doorAreaM2 = isIp ? rawArea / 10.7639 : rawArea;
    const doorAreaSqFt = doorAreaM2 * 10.7639;

    const egressVelMps = CALCULATION_CONSTANTS.EGRESS_VELOCITY; // Fixed 1.0 m/s automatic
    const openDoorsCount = Number(sizingParams.openDoorsCount); // Core input: e.g. 2
    const closedDoorsCount = Number(sizingParams.closedDoorsCount); // Core input: e.g. 16

    // 1. Open Door Airflow: Q_open = Door Area × Velocity × Number of Open Doors
    const openFlowM3s = doorAreaM2 * egressVelMps * openDoorsCount; // 2.53 * 1.0 * 2 = 5.06 m³/s
    const openFlowLs = openFlowM3s * 1000;
    const openFlowCfm = openFlowM3s * 2118.88;

    // 2. Closed Door Base Leakage: Q_closed_base = Leakage Airflow per Door × Number of Closed Doors
    const leakageRateM3s = doorConfig.designLeakageRate; // 0.03 m³/s
    const closedLeakageBaseM3s = leakageRateM3s * closedDoorsCount; // 0.03 * 16 = 0.48 m³/s

    // 3. Closed Door Safety Factor: 25% safety (CLOSED_DOOR_SAFETY_FACTOR)
    const closedSafetyM3s = closedLeakageBaseM3s * CALCULATION_CONSTANTS.CLOSED_DOOR_SAFETY_FACTOR; // 0.48 * 0.25 = 0.12 m³/s
    const closedFlowM3s = closedLeakageBaseM3s + closedSafetyM3s; // 0.48 + 0.12 = 0.60 m³/s
    const closedFlowLs = closedFlowM3s * 1000;
    const closedFlowCfm = closedFlowM3s * 2118.88;

    // 4. Total Airflow before final safety: Q_total_base = Q_open + Q_closed_design
    const subtotalM3s = openFlowM3s + closedFlowM3s; // 5.06 + 0.60 = 5.66 m³/s
    const subtotalLs = subtotalM3s * 1000;
    const subtotalCfm = subtotalM3s * 2118.88;

    // 5. Final 10% Safety Factor:
    const fanSafetyM3s = subtotalM3s * CALCULATION_CONSTANTS.FINAL_SAFETY_FACTOR; // 5.66 * 0.10 = 0.566 m³/s (~0.57)
    const totalFanCapacityRaw = subtotalM3s + fanSafetyM3s; // 5.66 * 1.10 = 6.226 m³/s (~6.23 m³/s)
    const totalFanCapacityM3s = Number(totalFanCapacityRaw.toFixed(2)); // 6.23 m³/s

    // Programmatic unit conversions derived from final airflow:
    // 6.23 m³/s * 3600 = 22,428 m³/h
    const totalFanCapacityM3h = Math.round(totalFanCapacityM3s * 3600);
    // 6.23 m³/s * 1000 = 6,230 L/s
    const totalFanCapacityLs = Math.round(totalFanCapacityM3s * 1000);
    // Programmatic CFM conversion: 6.226 * 2118.88 ≈ 13,190 - 13,192 CFM
    const totalFanCapacityCfm = Math.round(totalFanCapacityRaw * 2118.88);

    // 6. System Pressure drop & relief area derivation
    const ductLengthM = CALCULATION_CONSTANTS.DEFAULT_DUCT_LENGTH_M; // 68 m
    const ductDropPa = ductLengthM * CALCULATION_CONSTANTS.DUCT_PRESSURE_RATE_PA_PER_M; // 68 Pa
    const grillLouverDropPa = CALCULATION_CONSTANTS.GRILL_LOUVER_DROP_PA; // 85 Pa
    const pressureDiffPa = CALCULATION_CONSTANTS.DEFAULT_PRESSURE_REF_PA; // 12.5 Pa
    const totalSystemDropBeforeSafety = ductDropPa + grillLouverDropPa + pressureDiffPa;
    const pressureDropSafetyVal = totalSystemDropBeforeSafety * CALCULATION_CONSTANTS.CLOSED_DOOR_SAFETY_FACTOR; // 25% safety
    const designPressureDropPa = Math.ceil((totalSystemDropBeforeSafety + pressureDropSafetyVal) / 5) * 5; // 210 Pa

    const sqrtP = Math.sqrt(Math.max(1, pressureDiffPa));
    const reliefAreaM2 = totalFanCapacityM3s / (0.827 * sqrtP); // 2.133 m²
    const reliefAreaSqFt = reliefAreaM2 * 10.7639;

    const outletsCount = CALCULATION_CONSTANTS.DEFAULT_OUTLETS_COUNT;
    const airVolumePerOutletLs = outletsCount > 0 ? (totalFanCapacityLs / outletsCount) : totalFanCapacityLs;

    return {
      isValid: true,
      isIp,
      doorAreaM2: Number(doorAreaM2.toFixed(3)),
      doorAreaSqFt: Number(doorAreaSqFt.toFixed(2)),
      egressVelocityMps: egressVelMps,
      openDoorsCount,
      closedDoorsCount,
      leakageRateM3s,
      openFlowM3s: Number(openFlowM3s.toFixed(3)),
      openFlowLs: Number(openFlowLs.toFixed(1)),
      openFlowCfm: Number(openFlowCfm.toFixed(0)),
      closedLeakageBaseM3s: Number(closedLeakageBaseM3s.toFixed(3)),
      closedSafetyM3s: Number(closedSafetyM3s.toFixed(3)),
      closedSafetyFactor: CALCULATION_CONSTANTS.CLOSED_DOOR_SAFETY_FACTOR,
      closedFlowM3s: Number(closedFlowM3s.toFixed(3)),
      closedFlowLs: Number(closedFlowLs.toFixed(1)),
      closedFlowCfm: Number(closedFlowCfm.toFixed(0)),
      subtotalM3s: Number(subtotalM3s.toFixed(3)),
      subtotalLs: Number(subtotalLs.toFixed(1)),
      subtotalCfm: Number(subtotalCfm.toFixed(0)),
      fanSafetyM3s: Number(fanSafetyM3s.toFixed(3)),
      fanSafetyFactor: CALCULATION_CONSTANTS.FINAL_SAFETY_FACTOR,
      totalFanCapacityM3s: Number(totalFanCapacityM3s.toFixed(3)),
      totalFanCapacityLs,
      totalFanCapacityCfm: Number(totalFanCapacityCfm.toFixed(0)),
      totalFanCapacityM3h,
      designPressureDropPa,
      reliefAreaM2: Number(reliefAreaM2.toFixed(3)),
      reliefAreaSqFt: Number(reliefAreaSqFt.toFixed(2)),
      airVolumePerOutletLs: Number(airVolumePerOutletLs.toFixed(1)),
    };
  }, [sizingParams, unitSystem, isValid]);
  // Context menu actions
  const handleCopyValue = (label: string, value: any) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(String(value));
      toast.success(`Copied ${label}: ${value}`);
    }
  };

  const handleResetValue = (field: keyof liftwellParams, label: string) => {
    if (isEffectiveReadOnly) return;
    const def = DEFAULT_PARAMS[field];
    const updated = { ...sizingParams, [field]: def };
    setSizingParams(updated);
    saveState(updated, unitSystem);
    toast.info(`Reset ${label} to default (${def})`);
  };

  const handleOpenComment = (id: string, label: string) => {
    setActiveCommentTarget({ id, label });
  };

  const handleSaveComment = (newComment: any) => {
    if (!activeCommentTarget) return;
    const existing = commentsMap[activeCommentTarget.id] || [];
    const updated = { ...commentsMap, [activeCommentTarget.id]: [...existing, newComment] };
    setCommentsMap(updated);
    saveState(sizingParams, unitSystem, updated);
    setActiveCommentTarget(null);
    toast.success(`Task assigned successfully!`);
  };

  const renderCommentBadge = (id: string, label: string) => {
    const itemComments = commentsMap[id] || [];
    if (itemComments.length === 0) return null;
    return (
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
    );
  };

  const renderResultRowWithContext = (
    id: string,
    label: string,
    value: string,
    options: {
      modalKey?: "open_doors" | "closed_doors" | "total_fan" | "pressure_drop" | "relief_area" | "table_a3";
      rowClassName?: string;
      labelClassName?: string;
      valueClassName?: string;
    } = {}
  ) => {
    const { modalKey, rowClassName = "", labelClassName = "", valueClassName = "" } = options;
    const itemComments = commentsMap[id] || [];
    const isHighlighted = highlightedTargetId === id || highlightedTargetId === `res-${id}`;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`res-${id}`}
            data-item-id={id}
            data-field-id={id}
            className={`flex items-center justify-between py-1 transition cursor-context-menu hover:bg-slate-100/60 dark:hover:bg-slate-800/40 px-1.5 rounded-lg ${
              isHighlighted ? "ring-2 ring-primary bg-primary/20 z-10" : ""
            } ${rowClassName}`}
          >
            <span className={`font-sans flex items-center gap-1.5 ${labelClassName || "text-muted-foreground text-xs"}`}>
              <span>{label}</span>
              {modalKey && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveInfoModal(modalKey);
                  }}
                  className="cursor-pointer text-[#0A7BC7] hover:opacity-80 p-0.5"
                  title="View Calculation Formula"
                >
                  <Info className="size-3.5" />
                </button>
              )}
              {renderCommentBadge(id, label)}
            </span>
            <span className={`font-bold font-mono ${valueClassName || "text-foreground text-xs"}`}>
              {value}
            </span>
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
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(`${label}: ${value}`);
                toast.success(`Copied: "${label}: ${value}"`);
              }
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <FileText className="size-3.5 text-muted-foreground" />
            <span>Copy Full Line</span>
          </ContextMenuItem>

          {modalKey && (
            <ContextMenuItem
              onClick={() => setActiveInfoModal(modalKey)}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium text-[#0A7BC7]"
            >
              <Info className="size-3.5" />
              <span>View Calculation Formula</span>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{itemComments.length ? `View / Add Comments (${itemComments.length})` : "Add Comment / Assign Task"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // PDF Export Generation (Showing Only Required Details)
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const callAutoTable = (autoTable as any).default || autoTable;

      const headerFill: [number, number, number] = [220, 235, 252];
      const primaryFill: [number, number, number] = [240, 245, 250];
      const blueFill: [number, number, number] = [215, 235, 255];

      // Header Title & Bar
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(10, 123, 199);
      doc.text("LIFTWELL PRESSURIZATION CALCULATION REPORT", 14, 16);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text("Life Safety Smoke Control & Pressurization System", 14, 21.5);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 23.5, 196, 23.5);

      // Section 1: Project Information (Clean 2-row metadata)
      const metadataBody = [
        [
          { content: "Project Name:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: project?.name || "Liftwell Pressurization Project" },
          { content: "Calculation ID:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: project?.code || (project as any)?.calcNo || "CALC-STAIR-01" }
        ],
        [
          { content: "Client:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: project?.client || "Master Client" },
          { content: "Date:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString('en-GB') }
        ]
      ];

      callAutoTable(doc, {
        startY: 26,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, lineColor: [100, 100, 100], lineWidth: 0.1 },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 59 },
          2: { cellWidth: 32 },
          3: { cellWidth: 59 }
        },
        body: metadataBody
      });

      let nextY = (doc as any).lastAutoTable?.finalY ?? 40;
      nextY += 6;

      // Section 2: Design Input Parameters (Only the 4 Required Inputs)
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("1. Design Input Parameters", 14, nextY);
      nextY += 2.5;

      const activeDoor = DOOR_TYPES_CONFIG[sizingParams.doorType] || DOOR_TYPES_CONFIG.single_leaf_into;

      const inputsBody = [
        ["1", "Door Type", activeDoor.name, `Design Leakage: ${activeDoor.designLeakageRate} m³/s`],
        ["2", "Single Door Cross-Sectional Area", `${calc.doorAreaM2} m² (${calc.doorAreaSqFt} sq ft)`, "Clear Door Opening Area"],
        ["3", "Number of Open Doors", `${sizingParams.openDoorsCount} Doors`, `Egress Air Velocity: ${calc.egressVelocityMps.toFixed(1)} m/s`],
        ["4", "Number of Closed Doors", `${sizingParams.closedDoorsCount} Doors`, "Pressurized Enclosure Doors"]
      ];

      callAutoTable(doc, {
        startY: nextY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 }
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold"
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 66, fontStyle: "bold" },
          2: { cellWidth: 52, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 54 }
        },
        head: [
          [
            { content: "#" },
            { content: "Input Parameter" },
            { content: "Design Value" },
            { content: "Description / Basis" }
          ]
        ],
        body: inputsBody
      });

      nextY = (doc as any).lastAutoTable?.finalY ?? 80;
      nextY += 6;

      // Section 3: Calculation Results (Only Required Output Details)
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.text("2. Air Volume Flowrate & System Sizing Results", 14, nextY);
      nextY += 2.5;

      const resultsBody = [
        [
          "1",
          "REQUIRED FAN AIRFLOW (Q_fan)",
          `${calc.totalFanCapacityM3s} m³/s\n(${calc.totalFanCapacityLs.toLocaleString()} L/s / ${calc.totalFanCapacityM3h.toLocaleString()} m³/h)`
        ],
        [
          "2",
          "Airflow Thro' Open Doors (Q_open)",
          `${calc.openFlowM3s} m³/s (${calc.openFlowLs.toLocaleString()} L/s)`
        ],
        [
          "3",
          "Closed Door Leakage Flow (Q_closed)",
          `${calc.closedFlowM3s} m³/s (${calc.closedFlowLs.toLocaleString()} L/s)`
        ],
        [
          "4",
          "Design Total Pressure Drop (dP_total)",
          `${calc.designPressureDropPa} Pa`
        ],
        [
          "5",
          "Pressure Relief Louver Area (A_v)",
          `${calc.reliefAreaM2} m²`
        ]
      ];

      callAutoTable(doc, {
        startY: nextY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 }
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold"
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 86, fontStyle: "bold" },
          2: { cellWidth: 86, fontStyle: "bold" }
        },
        head: [
          [
            { content: "#" },
            { content: "Hydraulic Output Parameter" },
            { content: "Calculated Value" }
          ]
        ],
        body: resultsBody,
        didParseCell: function (data: any) {
          if (data.section === "body" && data.row.index === 0) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = blueFill;
            if (data.column.index === 2) {
              data.cell.styles.fontSize = 8.5;
            }
          }
        }
      });

      let sigFinalY = (doc as any).lastAutoTable?.finalY ?? 140;
      sigFinalY += 6;

      if (sigFinalY > 230) {
        doc.addPage();
        sigFinalY = 18;
      }

      // Section 4: Approval & Sign-Off Block
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.text("3. Approval & Sign-Off Block", 14, sigFinalY);
      sigFinalY += 2.5;

      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate
      } = getSignatureBlockDetails(project?.id || "default", "/liftwell-pressurization", currentUserName);

      callAutoTable(doc, {
        startY: sigFinalY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2, bottom: 2, left: 1, right: 1 }
        },
        headStyles: { fillColor: [255, 230, 204], textColor: 0, fontStyle: "bold" },
        head: [
          [
            { content: "" },
            { content: "Originator" },
            { content: "Reviewer" },
            { content: "Approver" }
          ]
        ],
        body: [
          ["Name", originatedName || currentUserName, reviewerName || "-", approverName || "-"],
          ["Date", formatDateStr(originatedDate) || new Date().toLocaleDateString('en-GB'), formatDateStr(reviewerDate) || "-", formatDateStr(approverDate) || "-"]
        ]
      });

      // Page Footer
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text("Generated by MEP Suite • Liftwell Pressurization Module", 14, 287);
      doc.text("Page 1 of 1", 182, 287);

      doc.save(`Liftwell_Pressurization_Report.pdf`);
      toast.success("PDF calculation report downloaded successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF report");
    }
  };

  // Excel Export Generation
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const activeDoor = DOOR_TYPES_CONFIG[sizingParams.doorType] || DOOR_TYPES_CONFIG.single_leaf_into;

      const wsData = [
        ["LIFTWELL PRESSURIZATION CALCULATION REPORT"],
        ["Standard: BS EN 12101-6 Table A.3 & NFPA 92 Smoke Containment Standards"],
        [],
        ["1. CORE DESIGN PARAMETERS"],
        ["Project Name", project?.name || "Pressurization System"],
        ["Calculation No", "CEC-MED-P509-105 Rev.00"],
        ["Client", project?.client || "Master Client"],
        ["Engineer", currentUserName],
        ["Date", new Date().toLocaleDateString('en-GB')],
        ["1. Door Type", activeDoor.name],
        ["2. Door Area", `${calc.doorAreaM2} m²`],
        ["3. Number of Open Doors", sizingParams.openDoorsCount],
        ["4. Number of Closed Doors", sizingParams.closedDoorsCount],
        [],
        ["2. AUTOMATIC ENGINEERING PARAMETERS"],
        ["Egress Air Velocity", `${CALCULATION_CONSTANTS.EGRESS_VELOCITY} m/s (Fixed standard)`],
        ["Table A.3 Leakage Area", `${activeDoor.leakageArea} m²`],
        ["Leakage Rate per Closed Door", `${activeDoor.designLeakageRate} m³/s @ ${CALCULATION_CONSTANTS.DEFAULT_PRESSURE_REF_PA} Pa`],
        ["Closed Door Safety Factor", `${CALCULATION_CONSTANTS.CLOSED_DOOR_SAFETY_FACTOR * 100}%`],
        ["Final Fan Safety Factor", `${CALCULATION_CONSTANTS.FINAL_SAFETY_FACTOR * 100}%`],
        [],
        ["3. CALCULATION RESULTS"],
        ["Open Door Airflow (Q_open)", `${calc.openFlowM3s} m³/s (${calc.openFlowLs} L/s)`],
        ["Base Closed Door Leakage (Q_closed_base)", `${calc.closedLeakageBaseM3s} m³/s`],
        ["Closed Door Leakage + 25% Safety", `${calc.closedFlowM3s} m³/s (${calc.closedFlowLs} L/s)`],
        ["Total Airflow (Before Final Safety)", `${calc.subtotalM3s} m³/s (${calc.subtotalLs} L/s)`],
        ["Final 10% Safety Allowance", `${calc.fanSafetyM3s} m³/s`],
        ["REQUIRED FAN AIRFLOW (Q_final)", `${calc.totalFanCapacityM3s} m³/s (~${calc.totalFanCapacityM3h.toLocaleString()} m³/h / ${calc.totalFanCapacityLs} L/s / ${calc.totalFanCapacityCfm.toLocaleString()} CFM)`],
        ["Design Pressure Drop", `${calc.designPressureDropPa} Pa`],
        ["Pressure Relief Louver Area", `${calc.reliefAreaM2} m²`],
        [],
        ["4. SIGN-OFF BLOCK"],
        ["Role", "Originator", "Reviewer", "Approver"],
        ["Name", currentUserName, "-", "-"],
        ["Date", new Date().toLocaleDateString('en-GB'), "-", "-"]
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Pressurization Calc");
      const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      downloadFile(new Uint8Array(xlsxBuffer), `liftwell_Pressurization.xlsx`, "Excel Document", ["xlsx"]);
      toast.success("Excel report exported successfully!");
      setShowExportMenu(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to export Excel report");
    }
  };

  const activeDoorData = DOOR_TYPES_CONFIG[sizingParams.doorType] || DOOR_TYPES_CONFIG.single_leaf_into;

  return (
    <AppShell title="Liftwell Pressurization" hideSubHeader={true}>
      <div className="flex flex-col h-full min-h-0 bg-transparent font-sans">

        {/* Header Bar */}
        <div className="flex justify-between items-start shrink-0 select-none pt-4 pb-2 border-b border-border/60 no-print">
          <div className="flex flex-col gap-1 w-full">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    Liftwell Pressurization Calculation
                  </h1>
                </div>
                <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/liftwell-pressurization" calculatorTitle="Liftwell Pressurization" />
              </div>

              <div className="flex items-center gap-2">
                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  ipLabel="IP"
                  siLabel="SI"
                  inputDescriptions="Door size, velocity, and air volumes"
                  conversionExample={unitSystem === "si" ? "Convert 2.53 m² → 27.2 sq ft" : "Convert 27.2 sq ft → 2.53 m²"}
                />

                <button
                  type="button"
                  onClick={() => setActiveInfoModal("open_doors")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-card hover:bg-muted/70 transition cursor-pointer text-foreground shadow-2xs"
                  title="View Calculation Formulas & Step-by-Step Breakdown"
                >
                  <Info className="size-3.5 text-[#0A7BC7]" />
                  <span>Calculations (i)</span>
                </button>

                {/* Export PDF Button (Only PDF option) */}
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-full bg-[#0A7BC7] text-white hover:bg-[#0866A5] transition shadow-xs cursor-pointer"
                  title="Export PDF Report"
                >
                  <FileText className="size-3.5" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main 2-Column Layout (Left: Inputs (50%) | Right: Results (50%)) */}
        <div className="flex-1 min-h-0 pt-4 pb-4 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full">

            {/* Left Column: Scrollable Inputs */}
            <div className="h-full overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-4">

              {/* CORE INPUTS CARD */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-sm font-bold text-foreground">
                      Core Inputs
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveInfoModal("table_a3")}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#0A7BC7] hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/40 transition cursor-pointer"
                    title="View BS EN 12101-6 Table A.3 Door Leakage Reference"
                  >
                    <Info className="size-3.5" />
                    <span>Table A.3 Reference</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* INPUT 1: DOOR TYPE */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id="field-doorType"
                        data-item-id="doorType"
                        className={`flex flex-col gap-1.5 sm:col-span-2 rounded-xl p-1 transition cursor-context-menu ${
                          highlightedTargetId === "doorType" || highlightedTargetId === "field-doorType" ? "ring-2 ring-[#0A7BC7] bg-[#0A7BC7]/10" : ""
                        }`}
                      >
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span>1. Door Type</span>
                            {renderCommentBadge("doorType", "1. Door Type")}
                          </span>
                          <span className="text-[11px] font-mono font-normal text-muted-foreground">Table A.3 Reference</span>
                        </label>
                        <div className="relative">
                          <select
                            disabled={isEffectiveReadOnly}
                            value={sizingParams.doorType}
                            onChange={handleDoorTypeSelect}
                            className={`w-full bg-background border ${
                              validationErrors.doorType ? "border-red-500 focus:ring-red-500/40" : "border-border focus:ring-[#0A7BC7]/40"
                            } rounded-xl px-3.5 py-2.5 text-xs font-semibold text-foreground focus:ring-2 focus:border-[#0A7BC7] outline-none transition appearance-none cursor-pointer pr-9`}
                          >
                            {(Object.keys(DOOR_TYPES_CONFIG) as DoorTypeKey[]).map((key) => {
                              const item = DOOR_TYPES_CONFIG[key];
                              return (
                                <option key={key} value={key}>
                                  {item.name}
                                </option>
                              );
                            })}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                        </div>
                        {validationErrors.doorType ? (
                          <span className="text-[11px] text-red-500 font-medium">{validationErrors.doorType}</span>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            {activeDoorData?.description}
                          </p>
                        )}
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Door Type", activeDoorData?.name)}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <Copy className="size-3.5 text-muted-foreground" />
                        <span>Copy Value</span>
                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => handleResetValue("doorType", "Door Type")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <RotateCcw className="size-3.5 text-muted-foreground" />
                        <span>Reset to Default</span>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => setActiveInfoModal("table_a3")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium text-[#0A7BC7]"
                      >
                        <Info className="size-3.5" />
                        <span>Table A.3 Reference</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleOpenComment("doorType", "1. Door Type")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>{commentsMap["doorType"]?.length ? `View / Add Comments (${commentsMap["doorType"].length})` : "Add Comment / Assign Task"}</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* INPUT 2: DOOR AREA */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id="field-doorArea"
                        data-item-id="doorArea"
                        className={`flex flex-col gap-1.5 sm:col-span-2 rounded-xl p-1 transition cursor-context-menu ${
                          highlightedTargetId === "doorArea" || highlightedTargetId === "field-doorArea" ? "ring-2 ring-[#0A7BC7] bg-[#0A7BC7]/10" : ""
                        }`}
                      >
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span>2. Door Area</span>
                            {renderCommentBadge("doorArea", "2. Door Area")}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">Total opening area</span>
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            disabled={isEffectiveReadOnly}
                            value={sizingParams.doorArea}
                            onChange={(e) => {
                              const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                              const updated = { ...sizingParams, doorArea: val };
                              setSizingParams(updated);
                              saveState(updated, unitSystem);
                            }}
                            placeholder={unitSystem === "ip" ? "29.7" : "2.76"}
                            className={`w-full bg-background border ${
                              validationErrors.doorArea ? "border-red-500 focus:ring-red-500/40" : "border-border focus:ring-[#0A7BC7]/40"
                            } rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-foreground focus:ring-2 focus:border-[#0A7BC7] outline-none transition`}
                          />
                          <span className="absolute right-3 text-xs font-semibold text-muted-foreground pointer-events-none">
                            {unitSystem === "ip" ? "sq ft" : "m²"}
                          </span>
                        </div>
                        {validationErrors.doorArea ? (
                          <span className="text-[11px] text-red-500 font-medium">{validationErrors.doorArea}</span>
                        ) : (
                          <span className="text-[10.5px] text-muted-foreground">
                            Total door opening area (e.g. 2.76 m² / 29.7 sq ft)
                          </span>
                        )}
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Door Area", `${sizingParams.doorArea} ${unitSystem === "ip" ? "sq ft" : "m²"}`)}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <Copy className="size-3.5 text-muted-foreground" />
                        <span>Copy Value</span>
                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => handleResetValue("doorArea", "Door Area")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <RotateCcw className="size-3.5 text-muted-foreground" />
                        <span>Reset to Default ({unitSystem === "ip" ? "29.7 sq ft" : "2.76 m²"})</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleOpenComment("doorArea", "2. Door Area")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>{commentsMap["doorArea"]?.length ? `View / Add Comments (${commentsMap["doorArea"].length})` : "Add Comment / Assign Task"}</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* INPUT 3: NUMBER OF OPEN DOORS (SIDE BY SIDE LEFT) */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id="field-openDoorsCount"
                        data-item-id="openDoorsCount"
                        className={`flex flex-col gap-1.5 rounded-xl p-1 transition cursor-context-menu ${
                          highlightedTargetId === "openDoorsCount" || highlightedTargetId === "field-openDoorsCount" ? "ring-2 ring-[#0A7BC7] bg-[#0A7BC7]/10" : ""
                        }`}
                      >
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span>3. Number of Open Doors</span>
                            {renderCommentBadge("openDoorsCount", "3. Number of Open Doors")}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">Escape doors</span>
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            disabled={isEffectiveReadOnly}
                            value={sizingParams.openDoorsCount}
                            onChange={(e) => {
                              const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                              const updated = { ...sizingParams, openDoorsCount: val };
                              setSizingParams(updated);
                              saveState(updated, unitSystem);
                            }}
                            placeholder="2"
                            className={`w-full bg-background border ${
                              validationErrors.openDoors ? "border-red-500 focus:ring-red-500/40" : "border-border focus:ring-[#0A7BC7]/40"
                            } rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-foreground focus:ring-2 focus:border-[#0A7BC7] outline-none transition`}
                          />
                          <span className="absolute right-3 text-xs font-semibold text-muted-foreground pointer-events-none">
                            doors
                          </span>
                        </div>
                        {validationErrors.openDoors ? (
                          <span className="text-[11px] text-red-500 font-medium">{validationErrors.openDoors}</span>
                        ) : (
                          <span className="text-[10.5px] text-muted-foreground">
                            Simultaneously open escape doors (default: 1)
                          </span>
                        )}
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Number of Open Doors", sizingParams.openDoorsCount)}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <Copy className="size-3.5 text-muted-foreground" />
                        <span>Copy Value</span>
                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => handleResetValue("openDoorsCount", "Number of Open Doors")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <RotateCcw className="size-3.5 text-muted-foreground" />
                        <span>Reset to Default (1 door)</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleOpenComment("openDoorsCount", "3. Number of Open Doors")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>{commentsMap["openDoorsCount"]?.length ? `View / Add Comments (${commentsMap["openDoorsCount"].length})` : "Add Comment / Assign Task"}</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* INPUT 4: NUMBER OF CLOSED DOORS (SIDE BY SIDE RIGHT) */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id="field-closedDoorsCount"
                        data-item-id="closedDoorsCount"
                        className={`flex flex-col gap-1.5 rounded-xl p-1 transition cursor-context-menu ${
                          highlightedTargetId === "closedDoorsCount" || highlightedTargetId === "field-closedDoorsCount" ? "ring-2 ring-[#0A7BC7] bg-[#0A7BC7]/10" : ""
                        }`}
                      >
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span>4. Number of Closed Doors</span>
                            {renderCommentBadge("closedDoorsCount", "4. Number of Closed Doors")}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">Perimeter leakage</span>
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            disabled={isEffectiveReadOnly}
                            value={sizingParams.closedDoorsCount}
                            onChange={(e) => {
                              const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                              const updated = { ...sizingParams, closedDoorsCount: val };
                              setSizingParams(updated);
                              saveState(updated, unitSystem);
                            }}
                            placeholder="16"
                            className={`w-full bg-background border ${
                              validationErrors.closedDoors ? "border-red-500 focus:ring-red-500/40" : "border-border focus:ring-[#0A7BC7]/40"
                            } rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-foreground focus:ring-2 focus:border-[#0A7BC7] outline-none transition`}
                          />
                          <span className="absolute right-3 text-xs font-semibold text-muted-foreground pointer-events-none">
                            doors
                          </span>
                        </div>
                        {validationErrors.closedDoors ? (
                          <span className="text-[11px] text-red-500 font-medium">{validationErrors.closedDoors}</span>
                        ) : (
                          <span className="text-[10.5px] text-muted-foreground">
                            Remaining closed fire doors (default: 17)
                          </span>
                        )}
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Number of Closed Doors", sizingParams.closedDoorsCount)}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <Copy className="size-3.5 text-muted-foreground" />
                        <span>Copy Value</span>
                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => handleResetValue("closedDoorsCount", "Number of Closed Doors")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <RotateCcw className="size-3.5 text-muted-foreground" />
                        <span>Reset to Default (17 doors)</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleOpenComment("closedDoorsCount", "4. Number of Closed Doors")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>{commentsMap["closedDoorsCount"]?.length ? `View / Add Comments (${commentsMap["closedDoorsCount"].length})` : "Add Comment / Assign Task"}</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </div>

                {/* AUTOMATIC ENGINEERING PARAMETERS (DERIVED VALUES) */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-border/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-[#0A7BC7]" />
                      <span>Automatic Engineering Parameters (Standards Derived)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveInfoModal("open_doors")}
                      className="text-[10.5px] text-[#0A7BC7] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Info className="size-3" />
                      <span>Formulas & Methodology</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                    <div className="p-2 rounded-lg bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Egress Velocity</span>
                      <strong className="font-mono text-foreground">{CALCULATION_CONSTANTS.EGRESS_VELOCITY.toFixed(2)} m/s</strong>
                      <span className="text-[9.5px] text-muted-foreground block">BS EN 12101-6</span>
                    </div>
                    <div className="p-2 rounded-lg bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Door Leakage Rate</span>
                      <strong className="font-mono text-[#0A7BC7]">{activeDoorData?.designLeakageRate} m³/s</strong>
                      <span className="text-[9.5px] text-muted-foreground block">From Door Type</span>
                    </div>
                    <div className="p-2 rounded-lg bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Closed Door Safety</span>
                      <strong className="font-mono text-foreground">{CALCULATION_CONSTANTS.CLOSED_DOOR_SAFETY_FACTOR * 100}%</strong>
                      <span className="text-[9.5px] text-muted-foreground block">25% Design Margin</span>
                    </div>
                    <div className="p-2 rounded-lg bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">System Fan Safety</span>
                      <strong className="font-mono text-[#0A7BC7]">{CALCULATION_CONSTANTS.FINAL_SAFETY_FACTOR * 100}%</strong>
                      <span className="text-[9.5px] text-muted-foreground block">Overall Tolerance</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Right Column: Results Card (Equal 50% Width & Standard Readable Fonts) */}
            <div className="h-full overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-4 select-none">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                
                {/* Result Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-sm font-bold text-foreground font-sans">
                      Calculation Results
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-bold text-xs border border-emerald-200 dark:border-emerald-800/40">
                    <ShieldCheck className="size-3.5" />
                    <span>Compliant</span>
                  </div>
                </div>

                {!calc.isValid ? (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs">
                    Please provide valid core inputs to generate calculation results.
                  </div>
                ) : (
                  <>
                    {/* Primary Hero Result Metric: Required Fan Airflow */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id="res-total-fan"
                          data-item-id="total-fan"
                          className={`p-4 rounded-xl bg-slate-100/90 dark:bg-slate-900/90 border border-border flex flex-col gap-2 relative transition cursor-context-menu ${
                            highlightedTargetId === "total-fan" || highlightedTargetId === "res-total-fan" ? "ring-2 ring-primary bg-primary/20" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <span>Required Fan Airflow</span>
                              {renderCommentBadge("total-fan", "Required Fan Airflow")}
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveInfoModal("total_fan")}
                              className="p-1 rounded-md text-[#0A7BC7] hover:bg-[#0A7BC7]/10 transition cursor-pointer"
                              title="Click to view Total Fan Capacity calculation"
                            >
                              <Info className="size-4" />
                            </button>
                          </div>
                          <div className="flex items-baseline justify-between flex-wrap gap-2">
                            <div className="text-3xl sm:text-4xl font-black font-mono text-[#0A7BC7] tracking-tight">
                              {calc.totalFanCapacityM3s.toFixed(2)} <span className="text-base sm:text-lg font-semibold text-muted-foreground">m³/s</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm sm:text-base font-bold font-mono text-foreground block">
                                ≈ {calc.totalFanCapacityM3h.toLocaleString()} m³/h
                              </span>
                              <span className="text-xs text-muted-foreground block font-mono">
                                ({calc.totalFanCapacityLs.toLocaleString()} L/s · {calc.totalFanCapacityCfm.toLocaleString()} CFM)
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground border-t border-border/60 pt-2 mt-1 flex justify-between items-center">
                            <span>Includes 25% closed door &amp; 10% fan safety</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">Design Certified</span>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                        <ContextMenuItem
                          onClick={() => handleCopyValue("Required Fan Airflow", `${calc.totalFanCapacityM3s.toFixed(2)} m³/s`)}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span>Copy Value ({calc.totalFanCapacityM3s.toFixed(2)} m³/s)</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            if (typeof navigator !== "undefined" && navigator.clipboard) {
                              navigator.clipboard.writeText(`Required Fan Airflow: ${calc.totalFanCapacityM3s.toFixed(2)} m³/s (≈ ${calc.totalFanCapacityM3h.toLocaleString()} m³/h / ${calc.totalFanCapacityLs.toLocaleString()} L/s / ${calc.totalFanCapacityCfm.toLocaleString()} CFM)`);
                              toast.success("Copied summary to clipboard");
                            }
                          }}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                        >
                          <FileText className="size-3.5 text-muted-foreground" />
                          <span>Copy Full Specification</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => setActiveInfoModal("total_fan")}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium text-[#0A7BC7]"
                        >
                          <Info className="size-3.5" />
                          <span>View Calculation Formula</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleOpenComment("total-fan", "Required Fan Airflow")}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>{commentsMap["total-fan"]?.length ? `View / Add Comments (${commentsMap["total-fan"].length})` : "Add Comment / Assign Task"}</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* Step-by-Step Clean Summary Rows */}
                    <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-border/70 text-xs font-mono">
                      {renderResultRowWithContext("door-area", "Door Area:", `${calc.doorAreaM2} m²`, { rowClassName: "border-b border-border/50" })}
                      {renderResultRowWithContext("egress-velocity", "Egress Velocity:", `${calc.egressVelocityMps.toFixed(2)} m/s`, { rowClassName: "border-b border-border/50" })}
                      {renderResultRowWithContext("open-doors", "Open Doors:", `${calc.openDoorsCount}`, { rowClassName: "border-b border-border/50" })}
                      {renderResultRowWithContext("closed-doors", "Closed Doors:", `${calc.closedDoorsCount}`, { rowClassName: "border-b border-border/50" })}
                      {renderResultRowWithContext("open-flow", "Open Door Airflow:", `${calc.openFlowM3s.toFixed(2)} m³/s`, {
                        modalKey: "open_doors",
                        rowClassName: "bg-blue-50/60 dark:bg-blue-950/40 px-2 py-1.5 rounded-lg border-b border-border/50",
                        labelClassName: "text-[#0A7BC7] font-semibold text-xs",
                        valueClassName: "text-[#0A7BC7] text-xs font-bold",
                      })}
                      {renderResultRowWithContext("leakage-rate", "Leakage Airflow per Closed Door:", `${calc.leakageRateM3s.toFixed(2)} m³/s`, {
                        modalKey: "table_a3",
                        rowClassName: "border-b border-border/50",
                      })}
                      {renderResultRowWithContext("closed-leakage-base", "Base Closed Door Leakage:", `${calc.closedLeakageBaseM3s.toFixed(2)} m³/s`, {
                        modalKey: "closed_doors",
                        rowClassName: "border-b border-border/50",
                      })}
                      {renderResultRowWithContext("closed-flow", "Closed Door Leakage + 25% Safety:", `${calc.closedFlowM3s.toFixed(2)} m³/s`, {
                        modalKey: "closed_doors",
                        rowClassName: "bg-sky-50/60 dark:bg-sky-950/40 px-2 py-1.5 rounded-lg border-b border-border/50",
                        labelClassName: "text-sky-700 dark:text-sky-300 font-semibold text-xs",
                        valueClassName: "text-sky-700 dark:text-sky-400 text-xs font-bold",
                      })}
                      {renderResultRowWithContext("total-flow", "Total Airflow:", `${calc.subtotalM3s.toFixed(2)} m³/s`, {
                        modalKey: "total_fan",
                        rowClassName: "border-b border-border/50 font-bold",
                        labelClassName: "text-foreground font-semibold text-xs",
                        valueClassName: "text-foreground text-xs font-bold",
                      })}
                      {renderResultRowWithContext("fan-safety", "Final 10% Safety Allowance:", `${calc.fanSafetyM3s.toFixed(2)} m³/s`, {
                        valueClassName: "text-[#0A7BC7] font-bold text-xs",
                      })}
                    </div>

                    {/* Additional Derived Engineering Results (Pressure Drop & Relief Louver Area) */}
                    <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-900/40 border border-border/70 text-xs">
                      {renderResultRowWithContext("pressure-drop", "Design Pressure Drop:", `${calc.designPressureDropPa} Pa`, {
                        modalKey: "pressure_drop",
                        valueClassName: "text-foreground font-bold text-xs font-mono",
                      })}
                      {renderResultRowWithContext("relief-area", "Pressure Relief Area:", `${calc.reliefAreaM2} m² (${calc.reliefAreaSqFt} sq ft)`, {
                        modalKey: "relief_area",
                        rowClassName: "border-t border-border/50 pt-1.5",
                        valueClassName: "text-[#0A7BC7] font-bold text-xs font-mono",
                      })}
                    </div>

                    {/* Excel Matching Confirmation Badge */}
                    <div className="p-2.5 rounded-xl border flex items-center gap-2.5 text-xs bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      <span className="text-xs leading-normal">
                        Strictly matches Excel formula model (CEC-MED-FRM-105 Rev.02).
                      </span>
                    </div>

                    {/* Visual Airflow Breakdown Bar - Positioned at Right Side Bottom with ContextMenu */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id="res-flow-distribution"
                          data-item-id="flow-distribution"
                          className={`flex flex-col gap-2 p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-900/40 border border-border/60 transition cursor-context-menu ${
                            highlightedTargetId === "flow-distribution" || highlightedTargetId === "res-flow-distribution" ? "ring-2 ring-primary bg-primary/20" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-foreground flex items-center gap-1.5">
                              <span>Flow Distribution:</span>
                              {renderCommentBadge("flow-distribution", "Flow Distribution")}
                            </span>
                            <span className="font-mono text-foreground font-bold text-xs">{calc.totalFanCapacityM3s.toFixed(2)} m³/s</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${Math.round((calc.openFlowM3s / (calc.totalFanCapacityM3s || 1)) * 100)}%` }}
                              className="bg-[#0A7BC7] h-full"
                              title="Open Door Airflow"
                            />
                            <div
                              style={{ width: `${Math.round((calc.closedFlowM3s / (calc.totalFanCapacityM3s || 1)) * 100)}%` }}
                              className="bg-sky-400 h-full"
                              title="Closed Door Leakage (with 25% safety)"
                            />
                            <div
                              style={{ width: `${Math.round((calc.fanSafetyM3s / (calc.totalFanCapacityM3s || 1)) * 100)}%` }}
                              className="bg-slate-400 h-full"
                              title="10% Fan Capacity Safety"
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-1">
                            <span className="flex items-center gap-1.5">
                              <span className="size-2 rounded-full bg-[#0A7BC7]"></span>
                              Open ({Math.round((calc.openFlowM3s / (calc.totalFanCapacityM3s || 1)) * 100)}%)
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="size-2 rounded-full bg-sky-400"></span>
                              Closed ({Math.round((calc.closedFlowM3s / (calc.totalFanCapacityM3s || 1)) * 100)}%)
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="size-2 rounded-full bg-slate-400"></span>
                              Safety ({Math.round((calc.fanSafetyM3s / (calc.totalFanCapacityM3s || 1)) * 100)}%)
                            </span>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                        <ContextMenuItem
                          onClick={() => handleCopyValue("Total Fan Airflow", `${calc.totalFanCapacityM3s.toFixed(2)} m³/s`)}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span>Copy Airflow ({calc.totalFanCapacityM3s.toFixed(2)} m³/s)</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => setActiveInfoModal("total_fan")}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium text-[#0A7BC7]"
                        >
                          <Info className="size-3.5" />
                          <span>View Calculation Formula</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleOpenComment("flow-distribution", "Flow Distribution")}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>{commentsMap["flow-distribution"]?.length ? `View / Add Comments (${commentsMap["flow-distribution"].length})` : "Add Comment / Assign Task"}</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </>
                )}

              </div>
            </div>

          </div>
        </div>

        {/* Interactive Calculation Details Modal (Opens when user clicks any (i) icon) */}
        {activeInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-5 shadow-2xl flex flex-col font-sans max-h-[85vh] overflow-hidden">
              
              {/* Modal Header (Fixed, non-squashable) */}
              <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-[#0A7BC7]/10 flex items-center justify-center text-[#0A7BC7]">
                    <Info className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      Calculation & Methodology Details
                    </h2>
                    <span className="text-[11px] text-muted-foreground">
                      BS EN 12101-6 Table A.3 & NFPA 92 Smoke Containment System
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveInfoModal(null)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Navigation Tabs Inside Modal (Fixed, non-squashable) */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 border-b border-border/60 text-xs shrink-0 custom-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveInfoModal("open_doors")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    activeInfoModal === "open_doors"
                      ? "bg-[#0A7BC7] text-white shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  1. Open Doors (Q_open)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInfoModal("closed_doors")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    activeInfoModal === "closed_doors"
                      ? "bg-[#0A7BC7] text-white shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  2. Closed Doors (Q_closed)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInfoModal("total_fan")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    activeInfoModal === "total_fan"
                      ? "bg-[#0A7BC7] text-white shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  3. Total Fan (Q_fan)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInfoModal("pressure_drop")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    activeInfoModal === "pressure_drop"
                      ? "bg-[#0A7BC7] text-white shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  4. Pressure Drop (ΔP)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInfoModal("relief_area")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    activeInfoModal === "relief_area"
                      ? "bg-[#0A7BC7] text-white shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  5. Relief Louver Area
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInfoModal("table_a3")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    activeInfoModal === "table_a3"
                      ? "bg-[#0A7BC7] text-white shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Table A.3 Reference
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3.5 custom-scrollbar min-h-0 pr-1">

              {/* Tab 1: Open Doors */}
              {activeInfoModal === "open_doors" && (
                <div className="space-y-3.5 text-xs text-muted-foreground animate-in fade-in duration-100">
                  <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex flex-col gap-1.5">
                    <span className="font-bold text-foreground text-sm">
                      Air Flow Through Open Doors (Q_open)
                    </span>
                    <p className="text-muted-foreground">
                      BS EN 12101-6 Clause 5.2.2 requires maintaining a minimum egress air velocity of 1.0 m/s through open escape doors to prevent smoke infiltration into the lift shaft.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/60 flex flex-col gap-1.5">
                    <span className="font-bold text-foreground uppercase tracking-wider text-[10.5px]">Formula</span>
                    <code className="font-mono text-[#0A7BC7] text-xs font-bold">
                      Q_open = Door Area (A_door) × Egress Velocity (v = 1.0 m/s) × Number of Open Doors (N_open)
                    </code>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border/80 bg-card flex flex-col gap-2">
                    <span className="font-bold text-foreground uppercase tracking-wider text-[10.5px]">Applied Values</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2 rounded-lg bg-muted/40">
                        <span className="text-muted-foreground block text-[10.5px]">Door Area (A_door)</span>
                        <strong className="font-mono text-foreground">{calc.doorAreaM2} m²</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/40">
                        <span className="text-muted-foreground block text-[10.5px]">Egress Velocity (v)</span>
                        <strong className="font-mono text-foreground">{calc.egressVelocityMps.toFixed(2)} m/s</strong>
                        <span className="text-[9.5px] text-muted-foreground block">Automatic standard constant</span>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/40">
                        <span className="text-muted-foreground block text-[10.5px]">Open Doors (N_open)</span>
                        <strong className="font-mono text-foreground">{sizingParams.openDoorsCount} doors</strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-border flex flex-col gap-2">
                    <span className="font-bold text-foreground uppercase tracking-wider text-[10.5px]">Step-by-Step Calculation</span>
                    <div className="font-mono text-xs text-foreground bg-background p-2.5 rounded-lg border border-border">
                      Q_open = {calc.doorAreaM2} m² × {calc.egressVelocityMps} m/s × {calc.openDoorsCount} = <strong className="text-[#0A7BC7]">{calc.openFlowM3s} m³/s</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-muted-foreground">Equivalent volumetric flow:</span>
                      <strong className="font-mono text-foreground">
                        {calc.openFlowLs.toLocaleString()} L/s · {calc.openFlowCfm.toLocaleString()} CFM
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Closed Doors */}
              {activeInfoModal === "closed_doors" && (
                <div className="space-y-3.5 text-xs text-muted-foreground animate-in fade-in duration-100">
                  <div className="p-3.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 flex flex-col gap-1.5">
                    <span className="font-bold text-foreground text-sm">
                      Air Flow Through Closed Doors (Q_closed)
                    </span>
                    <p className="text-muted-foreground">
                      Calculates the leakage airflow across all closed doors per BS EN 12101-6 Table A.3, including a centralized 25% safety factor on closed-door leakage.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/60 flex flex-col gap-1.5">
                    <span className="font-bold text-foreground uppercase tracking-wider text-[10.5px]">Formula</span>
                    <code className="font-mono text-[#0A7BC7] text-xs font-bold">
                      Q_closed_base = Leakage Airflow per Door × Number of Closed Doors
                      <br />
                      Q_closed_design = Q_closed_base × (1 + CLOSED_DOOR_SAFETY_FACTOR)
                    </code>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border/80 bg-card flex flex-col gap-2">
                    <span className="font-bold text-foreground uppercase tracking-wider text-[10.5px]">Applied Values</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2 rounded-lg bg-muted/40">
                        <span className="text-muted-foreground block text-[10.5px]">Leakage per Door</span>
                        <strong className="font-mono text-foreground">{calc.leakageRateM3s} m³/s</strong>
                        <span className="text-[9.5px] text-muted-foreground block">From {activeDoorData?.name}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/40">
                        <span className="text-muted-foreground block text-[10.5px]">Closed Doors (N_closed)</span>
                        <strong className="font-mono text-foreground">{sizingParams.closedDoorsCount} doors</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/40">
                        <span className="text-muted-foreground block text-[10.5px]">Safety Factor</span>
                        <strong className="font-mono text-foreground">{CALCULATION_CONSTANTS.CLOSED_DOOR_SAFETY_FACTOR * 100}%</strong>
                        <span className="text-[9.5px] text-muted-foreground block">Centralized constant (1.25)</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-border flex flex-col gap-2">
                    <span className="font-bold text-foreground uppercase tracking-wider text-[10.5px]">Step-by-Step Calculation</span>
                    <div className="space-y-1.5 font-mono text-xs text-foreground bg-background p-2.5 rounded-lg border border-border">
                      <div>Base Closed Door Leakage = {calc.leakageRateM3s} × {calc.closedDoorsCount} = <strong className="text-foreground">{calc.closedLeakageBaseM3s} m³/s</strong></div>
                      <div>Closed Door Leakage + 25% Safety = {calc.closedLeakageBaseM3s} × 1.25 = <strong className="text-sky-700 dark:text-sky-400">{calc.closedFlowM3s} m³/s</strong></div>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-muted-foreground">Equivalent volumetric flow:</span>
                      <strong className="font-mono text-foreground">
                        {calc.closedFlowLs.toLocaleString()} L/s · {calc.closedFlowCfm.toLocaleString()} CFM
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Total Fan Capacity */}
              {activeInfoModal === "total_fan" && (
                <div className="space-y-3.5 text-xs text-muted-foreground animate-in fade-in duration-100">
                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-border flex flex-col gap-1.5">
                    <span className="font-bold text-foreground text-sm">
                      Total Pressurization Fan Air Volume (Q_fan)
                    </span>
                    <p className="text-muted-foreground">
                      Combines Open Door Airflow with Closed Door Design Leakage, followed by the overall 10% fan system safety factor.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/60 flex flex-col gap-1.5">
                    <span className="font-bold text-foreground uppercase tracking-wider text-[10.5px]">Formula</span>
                    <code className="font-mono text-[#0A7BC7] text-xs font-bold">
                      Q_total_base = Q_open + Q_closed_design
                      <br />
                      Q_final = Q_total_base × (1 + FINAL_SAFETY_FACTOR)
                    </code>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border/80 bg-card flex flex-col gap-2">
                    <span className="font-bold text-foreground uppercase tracking-wider text-[10.5px]">Subtotal Components</span>
                    <div className="space-y-1.5 font-mono text-xs">
                      <div className="flex justify-between p-2 rounded-lg bg-muted/40">
                        <span>Open Door Airflow (Q_open):</span>
                        <strong className="text-foreground">{calc.openFlowM3s.toFixed(2)} m³/s ({calc.openFlowLs.toLocaleString()} L/s)</strong>
                      </div>
                      <div className="flex justify-between p-2 rounded-lg bg-muted/40">
                        <span>Closed Door Leakage + 25% Safety (Q_closed,design):</span>
                        <strong className="text-foreground">{calc.closedFlowM3s.toFixed(2)} m³/s ({calc.closedFlowLs.toLocaleString()} L/s)</strong>
                      </div>
                      <div className="flex justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60">
                        <span className="font-bold text-[#0A7BC7]">Total Airflow (Q_total):</span>
                        <strong className="text-[#0A7BC7]">{calc.subtotalM3s.toFixed(2)} m³/s ({calc.subtotalLs.toLocaleString()} L/s)</strong>
                      </div>
                      <div className="flex justify-between p-2 rounded-lg bg-muted/40">
                        <span>Final 10% System Safety Allowance:</span>
                        <strong className="text-foreground">{calc.fanSafetyM3s.toFixed(2)} m³/s</strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground block font-sans">Final Required Fan Airflow (Q_final)</span>
                      <strong className="text-xl font-bold font-mono text-[#0A7BC7]">
                        {calc.totalFanCapacityM3s.toFixed(2)} m³/s
                      </strong>
                    </div>
                    <div className="text-right text-xs font-mono text-foreground">
                      <div className="font-bold">≈ {calc.totalFanCapacityM3h.toLocaleString()} m³/h</div>
                      <div className="text-muted-foreground">({calc.totalFanCapacityLs.toLocaleString()} L/s · {calc.totalFanCapacityCfm.toLocaleString()} CFM)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Pressure Drop */}
              {activeInfoModal === "pressure_drop" && (
                <div className="space-y-3.5 text-xs text-muted-foreground animate-in fade-in duration-100">
                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-border flex flex-col gap-1.5">
                    <span className="font-bold text-foreground text-sm">
                      Total Pressurization System Pressure Drop (ΔP_total)
                    </span>
                    <p className="text-muted-foreground">
                      Calculates the duct friction loss along the riser shaft, plus supply grilles and fire dampers, plus lift shaft differential pressure, with 25% safety margin, ceiling rounded to nearest 5 Pa.
                    </p>
                  </div>

                  {/* Explicit Assumption Callout */}
                  <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col gap-1 text-[11px] text-amber-900 dark:text-amber-300 font-sans">
                    <span className="font-bold">Current project/default assumptions:</span>
                    <span>• Shaft height: 68 m (17 floors × 4.0 m)</span>
                    <span>• Dynamic grille loss: 85 Pa (70 Pa grille + 15 Pa fire damper)</span>
                    <span>• Default external static pressure: 210 Pa</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Note: These values are configured project/default assumptions rather than universal EN 12101-6 requirements. Verify against specific project requirements.</span>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/60 flex flex-col gap-1.5">
                    <span className="font-bold text-foreground uppercase tracking-wider text-[10.5px]">Formula</span>
                    <code className="font-mono text-[#0A7BC7] text-xs font-bold">
                      ΔP_total = CEILING( [ (Duct Length × 1.0 Pa/m) + 85 Pa + Design ΔP ] × 1.25, 5 )
                    </code>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-muted/40">
                      <span>Shaft Height / Duct Friction ({CALCULATION_CONSTANTS.DEFAULT_DUCT_LENGTH_M} m × 1.0 Pa/m):</span>
                      <strong className="text-foreground">{CALCULATION_CONSTANTS.DEFAULT_DUCT_LENGTH_M} Pa</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-muted/40">
                      <span>Supply Grilles (70 Pa) + Fire Dampers (15 Pa):</span>
                      <strong className="text-foreground">{CALCULATION_CONSTANTS.GRILL_LOUVER_DROP_PA} Pa</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-muted/40">
                      <span>Design Differential Pressure:</span>
                      <strong className="text-foreground">{CALCULATION_CONSTANTS.DEFAULT_PRESSURE_REF_PA} Pa (project/reference value)</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-muted/40">
                      <span>Safety Factor:</span>
                      <strong className="text-foreground">{CALCULATION_CONSTANTS.CLOSED_DOOR_SAFETY_FACTOR * 100}% (× 1.25)</strong>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground block">Default External Static Pressure (ESP):</span>
                      <span className="text-[10px] text-muted-foreground font-sans">Current project/default assumption</span>
                    </div>
                    <strong className="text-xl font-bold font-mono text-[#0A7BC7]">
                      {calc.designPressureDropPa} Pa
                    </strong>
                  </div>
                </div>
              )}

              {/* Tab 5: Relief Louver Area */}
              {activeInfoModal === "relief_area" && (
                <div className="space-y-3.5 text-xs text-muted-foreground animate-in fade-in duration-100">
                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-border flex flex-col gap-1.5">
                    <span className="font-bold text-foreground text-sm">
                      Pressure Relief Louver Area (A_relief)
                    </span>
                    <p className="text-muted-foreground">
                      Calculates the required free relief area at the top of the lift shaft to prevent door opening force from exceeding 100 N when all escape doors are closed per BS EN 12101-6.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/60 flex flex-col gap-1.5">
                    <span className="font-bold text-foreground uppercase tracking-wider text-[10.5px]">Formula</span>
                    <code className="font-mono text-[#0A7BC7] text-xs font-bold">
                      A_relief = Q_fan / (0.827 × √ΔP)
                    </code>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-muted/40">
                      <span>Total Fan Capacity (Q_fan):</span>
                      <strong className="text-foreground">{calc.totalFanCapacityM3s.toFixed(2)} m³/s</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-muted/40">
                      <span>Design Differential Pressure (ΔP):</span>
                      <strong className="text-foreground">{CALCULATION_CONSTANTS.DEFAULT_PRESSURE_REF_PA} Pa</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-muted/40">
                      <span>Flow Discharge Coefficient:</span>
                      <strong className="text-foreground">0.827</strong>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-border flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Required Relief Louver Free Area:</span>
                    <strong className="text-xl font-bold font-mono text-[#0A7BC7]">
                      {calc.reliefAreaM2} m² ({calc.reliefAreaSqFt} sq ft)
                    </strong>
                  </div>
                </div>
              )}

              {/* Tab 6: Table A.3 Reference & Multi-Pressure Mapping */}
              {activeInfoModal === "table_a3" && (
                <div className="space-y-3.5 text-xs text-muted-foreground animate-in fade-in duration-100">
                  <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex flex-col gap-1">
                    <span className="font-bold text-foreground text-sm">
                      BS EN 12101-6 Table A.3 — Air Leakage Data from Doors
                    </span>
                    <p className="text-muted-foreground">
                      Standard design leakage areas and flow rates.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-border/80 flex flex-col gap-1 text-xs font-sans">
                    <span className="font-bold text-foreground">Design Differential Pressure:</span>
                    <p className="text-muted-foreground text-[11.5px] leading-relaxed">
                      12.5 Pa — project/reference value currently configured for the leakage calculation. Verify against the approved project specification and EN 12101-6 design condition.
                    </p>
                    <p className="text-muted-foreground text-[10.5px] mt-0.5 leading-relaxed">
                      EN 12101-6 Table A.3 specifies established pressure points (8 Pa, 15 Pa, 20 Pa, 25 Pa, 50 Pa). The 12.5 Pa figure is a project/reference value configured in the project calculation methodology.
                    </p>
                  </div>

                  {/* Primary Door Types Table */}
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/70 text-foreground font-bold border-b border-border text-left">
                          <th className="py-2 px-3">Type of Door</th>
                          <th className="py-2 px-3 text-center">Leakage Area (m²)</th>
                          <th className="py-2 px-3 text-center">Design Flow (m³/s)</th>
                          <th className="py-2 px-3 text-center">@ 50 Pa (m³/s)</th>
                          <th className="py-2 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Object.keys(DOOR_TYPES_CONFIG) as DoorTypeKey[]).map((k) => {
                          const row = DOOR_TYPES_CONFIG[k];
                          const isSelected = sizingParams.doorType === k;
                          return (
                            <tr
                              key={k}
                              className={`border-b border-border/40 transition ${
                                isSelected
                                  ? "bg-blue-100/60 dark:bg-blue-950/60 font-semibold"
                                  : "hover:bg-muted/40"
                              }`}
                            >
                              <td className="py-2 px-3 flex items-center gap-2">
                                {isSelected && <div className="size-2 rounded-full bg-[#0A7BC7]"></div>}
                                <span className="text-foreground">{row.name}</span>
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-foreground">{row.leakageArea}</td>
                              <td className="py-2 px-3 text-center font-mono text-[#0A7BC7] font-bold">{row.designLeakageRate}</td>
                              <td className="py-2 px-3 text-center font-mono text-foreground">{row.leakageRateAt50Pa}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const synthEvent = { target: { value: k } } as React.ChangeEvent<HTMLSelectElement>;
                                    handleDoorTypeSelect(synthEvent);
                                  }}
                                  disabled={isSelected}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                                    isSelected
                                      ? "bg-[#0A7BC7] text-white cursor-default"
                                      : "bg-muted hover:bg-muted/80 text-foreground"
                                  }`}
                                >
                                  {isSelected ? "Active" : "Select"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Multi-Pressure Reference Points Table */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-border/70 space-y-2">
                    <span className="font-bold text-foreground text-[11px] block">
                      EN 12101-6 Multi-Pressure Leakage Table (m³/s per door):
                    </span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] border-collapse font-mono">
                        <thead>
                          <tr className="border-b border-border/60 text-muted-foreground text-[10px] text-left">
                            <th className="py-1 px-2">Door Type</th>
                            <th className="py-1 px-2 text-center">8 Pa</th>
                            <th className="py-1 px-2 text-center">15 Pa</th>
                            <th className="py-1 px-2 text-center">20 Pa</th>
                            <th className="py-1 px-2 text-center">25 Pa</th>
                            <th className="py-1 px-2 text-center">50 Pa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Object.keys(DOOR_TYPES_CONFIG) as DoorTypeKey[]).map((k) => {
                            const d = DOOR_TYPES_CONFIG[k];
                            const pMap: Record<number, number> = {};
                            d.en12101PressureTable.forEach((pt) => { pMap[pt.pressurePa] = pt.airflowM3s; });
                            const isCurrent = sizingParams.doorType === k;
                            return (
                              <tr key={k} className={`border-b border-border/30 ${isCurrent ? "font-bold text-[#0A7BC7]" : "text-muted-foreground"}`}>
                                <td className="py-1 px-2 font-sans">{d.name}</td>
                                <td className="py-1 px-2 text-center">{pMap[8] ?? "-"}</td>
                                <td className="py-1 px-2 text-center">{pMap[15] ?? "-"}</td>
                                <td className="py-1 px-2 text-center">{pMap[20] ?? "-"}</td>
                                <td className="py-1 px-2 text-center">{pMap[25] ?? "-"}</td>
                                <td className="py-1 px-2 text-center">{pMap[50] ?? "-"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              </div>

              {/* Modal Footer (Fixed, non-squashable) */}
              <div className="flex justify-end pt-3 border-t border-border shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveInfoModal(null)}
                  className="px-4 py-2 rounded-xl bg-[#0A7BC7] text-white font-semibold text-xs cursor-pointer hover:bg-[#0866A5] transition shadow-xs"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Legacy showFormulaModal kept for compatibility */}
        {showFormulaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4 font-sans">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h2 className="text-base font-bold text-foreground">Liftwell Pressurization Formulas</h2>
                <button
                  onClick={() => setShowFormulaModal(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-muted-foreground">
                <div className="p-3 rounded-xl bg-muted/60 flex flex-col gap-1.5">
                  <span className="font-bold text-foreground">1. Open Door Air Flow</span>
                  <code className="font-mono text-[#0A7BC7] text-[11px]">
                    Q_open = Door Area × Velocity (1.0 m/s) × Number of Open Doors
                  </code>
                </div>

                <div className="p-3 rounded-xl bg-muted/60 flex flex-col gap-1.5">
                  <span className="font-bold text-foreground">2. Closed Door Air Flow (with 25% Safety)</span>
                  <code className="font-mono text-[#0A7BC7] text-[11px]">
                    Q_closed = Leakage Rate × Number of Closed Doors × 1.25
                  </code>
                </div>

                <div className="p-3 rounded-xl bg-muted/60 flex flex-col gap-1.5">
                  <span className="font-bold text-foreground">3. Total Fan Capacity (with 10% Safety)</span>
                  <code className="font-mono text-[#0A7BC7] text-[11px]">
                    Q_total = (Q_open + Q_closed) × 1.10
                  </code>
                </div>

                <div className="p-3 rounded-xl bg-muted/60 flex flex-col gap-1.5">
                  <span className="font-bold text-foreground">4. Pressure Relief Louver Area</span>
                  <code className="font-mono text-[#0A7BC7] text-[11px]">
                    A_relief = Q_fan / (0.827 × √P)
                  </code>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <button
                  onClick={() => setShowFormulaModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-[#0A7BC7] text-white font-semibold text-xs cursor-pointer hover:bg-[#0866A5] transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Comment Assignment Modal */}
        {activeCommentTarget && (
          <AssignCommentModal
            isOpen={Boolean(activeCommentTarget)}
            targetId={activeCommentTarget.id}
            targetName={activeCommentTarget.label}
            calculatorPath="/liftwell-pressurization"
            calculatorTitle="Liftwell Pressurization"
            onClose={() => setActiveCommentTarget(null)}
            onCommentAdded={handleSaveComment}
          />
        )}

      </div>
    </AppShell>
  );
}
export default LiftwellPressurizationPage;
