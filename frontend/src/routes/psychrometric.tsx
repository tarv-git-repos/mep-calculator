import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  Download, ChevronDown, ChevronRight, ChevronUp, Save, Sparkles, Eye,
  MessageSquare, CheckCircle2, AlertTriangle, Activity, Gauge, Zap,
  Droplets, ShieldCheck, Check, X, SlidersHorizontal, Sliders, TrendingDown,
  Info, ArrowRight, RefreshCw, RotateCcw, Layers, FileText, FileSpreadsheet, Calculator,
  Thermometer, Wind, Flame, Lock, Edit3, HelpCircle, Copy, Clipboard, Trash2
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-store";
import {
  CalculationReviewBar,
  useCalculationLock,
  useCalculationEffectiveReadOnly,
  useCalculationReviewState,
  getCalculationStatusBorderClass
} from "@/components/workspace/CalculationReviewBar";
import { dirtyStore } from "@/lib/dirty-store";
import { useAuth } from "@/contexts/AuthContext";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { EditPsychrometricModal, type PsychrometricFormData } from "@/components/workspace/EditPsychrometricModal";
import { CalculationPreviewModal, CalculationPreviewData } from "@/components/calculator-framework/CalculationPreviewModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { useCalculatorFramework } from "@/components/calculator-framework";
import { exportPsychrometricPDF } from "@/lib/exportPsychrometricPDF";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { calculatePsychrometricData, fToC, cToF, wFromRH, satP } from "@/lib/calc-psychrometric";

export const Route = createFileRoute("/psychrometric")({
  head: () => ({
    meta: [
      { title: "Psychrometric Calculator — MEP Calc" },
      { name: "description", content: "Moist air psychrometric properties calculator utilizing standard Hyland-Wexler equations." },
    ],
  }),
  component: PsychrometricPage,
});

type SecondParam = "rh" | "wb" | "dp" | "w";

function PsychrometricPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const { user, userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || (user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";
  
  const calcReviewState = useCalculationReviewState("/psychrometric", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/psychrometric", activeProjectId || project?.id);
  const isCalcLocked = useCalculationLock("/psychrometric", project?.id);
  const isApprovedLocked = isCalcLocked || calcReviewState?.status === "APPROVED";

  const [tab, setTab] = useState<"calculator" | "report">("calculator");
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const isSI = unitSystem === "si";
  const ip = unitSystem === "ip";

  // Inputs
  const [dbtInput, setDbtInput] = useState<number | "">(35);
  const [secondParam, setSecondParam] = useState<SecondParam>("rh");
  const [paramValue, setParamValue] = useState<number | "">(60);
  const [atmPressure, setAtmPressure] = useState<number | "">(101.325); // kPa
  const [hasCalculated, setHasCalculated] = useState<boolean>(true);
  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Comments System State
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  const getItemComments = (itemId: string) => commentsList.filter(c => c.targetId === itemId || c.spaceId === itemId || c.itemId === itemId);

  // Load comments on project switch
  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/psychrometric`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setCommentsList(parsed);
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
    localStorage.setItem(`mep_calc_comments_${pId}_/psychrometric`, JSON.stringify(newList));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notif_tick"));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new CustomEvent("mep-notification-added"));
      window.dispatchEvent(new Event("storage"));
    }
    if (typeof forceSaveToCloud === "function") {
      setTimeout(() => forceSaveToCloud(), 50);
    }
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (commentData: any) => {
    const targetId = commentTargetItem?.id || commentData?.targetId || commentData?.spaceId || commentData?.itemId || "psych-dbt";
    const targetName = commentTargetItem?.name || commentData?.targetName || commentData?.spaceName || "Psychrometric Parameter";

    const commentWithMeta = {
      ...commentData,
      targetId,
      targetName,
      spaceId: targetId,
      spaceName: targetName,
      itemId: targetId,
      targetType: "Psychrometric Parameter",
      calculatorPath: "/psychrometric",
      calculatorTitle: "Psychrometric Calculator",
      projectId: project?.id || "default",
      projectName: project?.name || "Psychrometric Analysis",
    };

    const updated = [commentWithMeta, ...commentsList.filter(c => c.id !== commentData.id)];
    saveComments(updated);

    notifyCommentAssigned({
      ...commentWithMeta,
      url: `/psychrometric?targetId=${targetId}&targetName=${encodeURIComponent(targetName)}`
    });

    setCommentModalOpen(false);
    toast.success("Comment / Task saved successfully!");
  };

  // Scroll and highlight notification target item
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();
      const cleanRaw = cleanId.replace(/^(field-|card-|res-)/, "");

      const el = document.getElementById(targetId || "") ||
                 document.getElementById(`field-${cleanRaw}`) ||
                 document.getElementById(`card-${cleanRaw}`) ||
                 document.getElementById(`res-${cleanRaw}`) ||
                 document.querySelector(`[data-field-id="${cleanRaw}"]`) ||
                 document.querySelector(`[data-field-id="${targetId}"]`) ||
                 document.querySelector(`[data-comment-target="${cleanRaw}"]`);

      setHighlightedTargetId(cleanRaw || cleanId || targetId || null);

      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedTargetId(null);
        highlightTimeoutRef.current = null;
      }, 4500);

      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };

    const handleScrollEvent = (e: any) => {
      if (e.detail?.targetId) handleScrollTarget(e.detail.targetId, e.detail.targetName);
    };

    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const urlTargetId = searchParams.get("targetId") || searchParams.get("itemId") || searchParams.get("spaceId");
      if (urlTargetId) {
        setTimeout(() => handleScrollTarget(urlTargetId, searchParams.get("targetName") || ""), 800);
      }
    }

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    window.addEventListener("mep-data-grid-scroll", handleScrollEvent);
    window.addEventListener("mep_scroll_to_comment_target", handleScrollEvent);

    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
      window.removeEventListener("mep-data-grid-scroll", handleScrollEvent);
      window.removeEventListener("mep_scroll_to_comment_target", handleScrollEvent);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const isFieldHighlighted = (fieldId: string, searchKey?: string) => {
    if (!highlightedTargetId) return "";
    const cleanHighlight = highlightedTargetId.toLowerCase().trim();
    if (fieldId.toLowerCase() === cleanHighlight || fieldId.toLowerCase().includes(cleanHighlight)) {
      return "ring-2 ring-primary border-primary shadow-sm bg-primary/5 animate-pulse-light";
    }
    if (searchKey && searchKey.toLowerCase().includes(cleanHighlight)) {
      return "ring-2 ring-primary border-primary shadow-sm bg-primary/5 animate-pulse-light";
    }
    return "";
  };

  const renderCommentBadge = (id: string, name: string) => {
    const existing = getItemComments(id);
    if (existing.length === 0) return null;
    const unresolvedCount = existing.filter(c => c.status !== "resolved").length;
    if (unresolvedCount === 0) return null;
    return (
      <RowCommentCornerBadge
        id={id}
        count={unresolvedCount}
        onClick={() => handleOpenComment(id, name)}
      />
    );
  };

  // Modular Framework Hook for Psychrometric Calculator
  const framework = useCalculatorFramework({
    calculatorId: "/psychrometric",
    calculatorTitle: "Psychrometric Calculator",
    items: [
      {
        id: "psych-state-1",
        name: "Moist Air State",
        code: "PSY-01",
      },
    ],
  });

  // Load project-scoped state
  useEffect(() => {
    if (!project?.id) return;
    const pKey = `mep_psychrometric_calc_${project.id}`;
    const stored = localStorage.getItem(pKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
        if (parsed.dbtInput !== undefined) setDbtInput(parsed.dbtInput);
        if (parsed.secondParam) setSecondParam(parsed.secondParam);
        if (parsed.paramValue !== undefined) setParamValue(parsed.paramValue);
        if (parsed.atmPressure !== undefined) setAtmPressure(parsed.atmPressure);
        if (parsed.hasCalculated !== undefined) setHasCalculated(parsed.hasCalculated);
      } catch (e) {
        console.error("Failed to load saved psychrometric calculation", e);
      }
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  // Save project-scoped state
  const handleSaveCurrent = useCallback(() => {
    if (!project?.id) return;
    try {
      const dataToSave = {
        unitSystem,
        dbtInput,
        secondParam,
        paramValue,
        atmPressure,
        hasCalculated,
      };
      localStorage.setItem(`mep_psychrometric_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(false);
      if (forceSaveToCloud) forceSaveToCloud();
      toast.success("Psychrometric calculation saved to project successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  }, [project?.id, unitSystem, dbtInput, secondParam, paramValue, atmPressure, hasCalculated, forceSaveToCloud]);

  useEffect(() => {
    const handleTriggerSave = (e: any) => {
      if (e.detail) e.detail.handled = true;
      handleSaveCurrent();
    };
    window.addEventListener("mep-trigger-save", handleTriggerSave);
    return () => window.removeEventListener("mep-trigger-save", handleTriggerSave);
  }, [handleSaveCurrent]);

  // Version History Restore Listener
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pKey = `mep_psychrometric_calc_${project?.id || "default"}`;
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
        if (restoredData.unitSystem) setUnitSystem(restoredData.unitSystem);
        if (restoredData.dbtInput !== undefined) setDbtInput(restoredData.dbtInput);
        if (restoredData.secondParam) setSecondParam(restoredData.secondParam);
        if (restoredData.paramValue !== undefined) setParamValue(restoredData.paramValue);
        if (restoredData.atmPressure !== undefined) setAtmPressure(restoredData.atmPressure);
        if (restoredData.hasCalculated !== undefined) setHasCalculated(restoredData.hasCalculated);
        dirtyStore.set(false);
        toast.success("Psychrometric calculation restored to selected version!");
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [project?.id]);

  const handleSavePsychrometricModal = (data: PsychrometricFormData) => {
    setUnitSystem(data.unitSystem);
    setDbtInput(data.dbtInput);
    setSecondParam(data.secondParam);
    setParamValue(data.paramValue);
    setAtmPressure(data.atmPressure);
    setHasCalculated(true);
    dirtyStore.set(true);
  };

  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean = true) => {
    if (isApprovedLocked || framework.isReadOnly) {
      toast.info("Calculation is Locked. Unlock required to change unit system.");
      return;
    }
    if (targetUnit === unitSystem) return;

    if (shouldConvert) {
      if (targetUnit === "ip") {
        setDbtInput(dbtInput !== "" ? Number((Number(dbtInput) * 1.8 + 32).toFixed(1)) : "");
        if (secondParam === "wb" || secondParam === "dp") {
          setParamValue(paramValue !== "" ? Number((Number(paramValue) * 1.8 + 32).toFixed(1)) : "");
        } else if (secondParam === "w") {
          setParamValue(paramValue !== "" ? Number((Number(paramValue) * 7).toFixed(2)) : "");
        }
      } else {
        setDbtInput(dbtInput !== "" ? Number(((Number(dbtInput) - 32) / 1.8).toFixed(1)) : "");
        if (secondParam === "wb" || secondParam === "dp") {
          setParamValue(paramValue !== "" ? Number(((Number(paramValue) - 32) / 1.8).toFixed(1)) : "");
        } else if (secondParam === "w") {
          setParamValue(paramValue !== "" ? Number((Number(paramValue) / 7).toFixed(5)) : "");
        }
      }
    }
    setUnitSystem(targetUnit);
    dirtyStore.set(true);
    toast.info(`Switched to ${targetUnit === "ip" ? "Imperial (IP)" : "Metric (SI)"} units`);
  };

  // Calculations
  const calculatedData = useMemo(() => {
    try {
      return calculatePsychrometricData(dbtInput, secondParam, paramValue, atmPressure, ip);
    } catch (err) {
      console.error("Psychrometric calculation error:", err);
      return {
        dbt: 35,
        wbt: 25.5,
        dp: 21.2,
        rh: 60,
        w: 0.0215,
        h: 90.5,
        v: 0.895,
        pw: 3375,
      };
    }
  }, [dbtInput, secondParam, paramValue, atmPressure, ip]);

  // Solved values in both units for easy display
  const pAtmKpa = atmPressure !== "" ? Number(atmPressure) : 101.325;
  const pAtmPsi = (pAtmKpa * 0.145038).toFixed(3);
  const dbtC = calculatedData.dbt;
  const dbtF = cToF(dbtC);
  const wbtC = calculatedData.wbt;
  const wbtF = cToF(wbtC);
  const dpC = calculatedData.dp;
  const dpF = cToF(dpC);
  const rhVal = calculatedData.rh;
  const wGPerKg = calculatedData.w * 1000;
  const wGrPerLb = calculatedData.w * 7000;
  const hKjKg = calculatedData.h;
  const hBtuLb = calculatedData.h / 2.326;
  const vM3Kg = calculatedData.v;
  const vFt3Lb = calculatedData.v * 16.0185;
  const pwKpa = calculatedData.pw / 1000;
  const pwPsi = calculatedData.pw / 6894.76;
  const densitySi = vM3Kg > 0 ? 1 / vM3Kg : 0;
  const densityIp = vFt3Lb > 0 ? 1 / vFt3Lb : 0;

  const warnings = useMemo(() => {
    const warns: string[] = [];
    if (rhVal > 90) {
      warns.push(`RH ${rhVal.toFixed(1)}% — Near saturation limit. High condensation risk on uninsulated cold surfaces.`);
    } else if (rhVal < 20) {
      warns.push(`RH ${rhVal.toFixed(1)}% — Very dry air. Electrostatic discharge and mucosal dryness risk.`);
    }
    if (dbtC > 40) {
      warns.push(`DBT ${dbtC.toFixed(1)}°C — High ambient temperature. Requires extensive sensible cooling.`);
    } else if (dbtC < 0) {
      warns.push(`DBT ${dbtC.toFixed(1)}°C — Sub-freezing air. Protect cooling coils with preheat or antifreeze.`);
    }
    return warns;
  }, [rhVal, dbtC]);

  const isSummerComfort = dbtC >= 23 && dbtC <= 26 && rhVal >= 30 && rhVal <= 60;
  const isWinterComfort = dbtC >= 20 && dbtC <= 24 && rhVal >= 30 && rhVal <= 60;
  let comfortStatusText = "Standard Conditioned Boundary";
  if (isSummerComfort) comfortStatusText = "Compliant (ASHRAE 55 Summer Comfort)";
  else if (isWinterComfort) comfortStatusText = "Compliant (ASHRAE 55 Winter Comfort)";
  else if (rhVal > 80) comfortStatusText = "Caution: High Humidity / Mold Risk";
  else if (rhVal < 20) comfortStatusText = "Caution: Low Humidity / Static Risk";

  const sensEnthalpy = 1.006 * dbtC;
  const latEnthalpy = calculatedData.w * (2501 + 1.805 * dbtC);
  const sensPercent = hKjKg > 0 ? ((sensEnthalpy / hKjKg) * 100).toFixed(1) : "0.0";
  const latPercent = hKjKg > 0 ? ((latEnthalpy / hKjKg) * 100).toFixed(1) : "0.0";
  const wbDepression = (dbtC - wbtC).toFixed(1);

  const paramNameMap: Record<SecondParam, string> = {
    rh: "Relative Humidity (RH)",
    wb: "Wet Bulb Temperature (T_wb)",
    dp: "Dew Point Temperature (T_dp)",
    w: "Humidity Ratio (W)",
  };
  const paramName = paramNameMap[secondParam] || "Relative Humidity (RH)";
  let paramValDisplay = `${rhVal.toFixed(1)} %`;
  if (secondParam === "wb") {
    paramValDisplay = `${wbtC.toFixed(1)} °C (${wbtF.toFixed(1)} °F)`;
  } else if (secondParam === "dp") {
    paramValDisplay = `${dpC.toFixed(1)} °C (${dpF.toFixed(1)} °F)`;
  } else if (secondParam === "w") {
    paramValDisplay = `${wGPerKg.toFixed(2)} g/kg (${wGrPerLb.toFixed(2)} gr/lb)`;
  }

  // Step-by-Step Formula Preview Data for Framework Modal
  const calculationPreviewData: CalculationPreviewData = useMemo(() => {
    const pAtmPa = pAtmKpa * 1000;
    const tK = dbtC + 273.15;
    const pwsPa = satP(tK);
    const pwPa = calculatedData.pw;

    return {
      title: "Psychrometric State & Moist Air Property Calculation",
      itemName: "Moist Air State 01",
      itemCode: "PSY-01",
      standardReference: "ASHRAE Handbook Fundamentals (Hyland-Wexler Formulation)",
      inputs: [
        { label: "Dry Bulb Temperature (T_db)", value: dbtC.toFixed(1), unit: "°C" },
        { label: "Second Known Parameter", value: paramNameMap[secondParam] },
        { label: "Second Parameter Value", value: String(paramValue !== "" ? paramValue : "-") },
        { label: "Atmospheric Pressure (P_atm)", value: pAtmKpa.toFixed(3), unit: "kPa" },
      ],
      steps: [
        {
          stepNumber: 1,
          label: "Saturation Vapor Pressure (P_ws)",
          formula: "P_ws = exp(C_8/T_k + C_9 + C_10*T_k + C_11*T_k^2 + C_12*T_k^3 + C_13*ln(T_k))",
          substitution: `P_ws = Hyland-Wexler formulation at T_k = ${tK.toFixed(2)} K (${dbtC.toFixed(1)} °C)`,
          result: (pwsPa / 1000).toFixed(3),
          unit: "kPa",
          status: "info",
          description: "Evaluates pure water saturation pressure using ASHRAE fundamental coefficients."
        },
        {
          stepNumber: 2,
          label: "Partial Water Vapor Pressure (P_w)",
          formula: secondParam === "rh"
            ? "P_w = (RH / 100) * P_ws"
            : "P_w = (W * P_atm) / (0.621945 + W)",
          substitution: secondParam === "rh"
            ? `P_w = (${calculatedData.rh.toFixed(1)} / 100) * ${(pwsPa / 1000).toFixed(3)} kPa`
            : `P_w = (${calculatedData.w.toFixed(5)} * ${pAtmKpa.toFixed(3)}) / (0.621945 + ${calculatedData.w.toFixed(5)})`,
          result: (pwPa / 1000).toFixed(3),
          unit: "kPa",
          status: "info",
        },
        {
          stepNumber: 3,
          label: "Humidity Ratio / Specific Moisture (W)",
          formula: "W = 0.621945 * P_w / (P_atm - P_w)",
          substitution: `W = 0.621945 * ${(pwPa / 1000).toFixed(3)} / (${pAtmKpa.toFixed(3)} - ${(pwPa / 1000).toFixed(3)})`,
          result: wGPerKg.toFixed(2),
          unit: "g/kg dry air",
          status: "pass",
          description: `Mass ratio of water vapor to dry air (${wGrPerLb.toFixed(2)} gr/lb in IP units).`
        },
        {
          stepNumber: 4,
          label: "Specific Enthalpy (h)",
          formula: "h = 1.006 * T_db + W * (2501 + 1.805 * T_db)",
          substitution: `h = 1.006 * ${dbtC.toFixed(1)} + ${calculatedData.w.toFixed(5)} * (2501 + 1.805 * ${dbtC.toFixed(1)})`,
          result: hKjKg.toFixed(2),
          unit: "kJ/kg",
          status: "pass",
          description: `Total energy per kg dry air including sensible thermal energy and latent vapor enthalpy (${hBtuLb.toFixed(2)} BTU/lb).`
        },
        {
          stepNumber: 5,
          label: "Specific Volume (v) & Moist Air Density (ρ)",
          formula: "v = 0.287042 * T_k * (1 + 1.607858 * W) / P_atm, ρ = 1 / v",
          substitution: `v = 0.287042 * ${tK.toFixed(2)} * (1 + 1.607858 * ${calculatedData.w.toFixed(5)}) / ${pAtmKpa.toFixed(3)}`,
          result: vM3Kg.toFixed(4),
          unit: "m³/kg",
          status: "info",
          description: `Moist air density ρ = ${densitySi.toFixed(3)} kg/m³ (${densityIp.toFixed(4)} lb/ft³).`
        },
      ],
      finalResultLabel: "Total Specific Enthalpy (h)",
      finalResultValue: ip ? hBtuLb.toFixed(2) : hKjKg.toFixed(2),
      finalResultUnit: ip ? "BTU/lb" : "kJ/kg",
      complianceNote: "Psychrometric properties calculated in strict accordance with ASHRAE Handbook Fundamentals & Hyland-Wexler formulations.",
    };
  }, [pAtmKpa, dbtC, secondParam, paramValue, calculatedData, wGPerKg, wGrPerLb, hKjKg, hBtuLb, vM3Kg, densitySi, densityIp, ip]);

  const sigDetails = useMemo(() => {
    return getSignatureBlockDetails(project?.id || "default", "/psychrometric", currentUserName, calcReviewState);
  }, [project?.id, calcReviewState, currentUserName]);

  const handleExportPDF = async () => {
    try {
      toast.loading("Generating Psychrometric calculation PDF report...", { id: "psych-pdf-export" });
      await exportPsychrometricPDF(calculatedData, {
        calcNo: (project as any)?.calcNo || `TRV-CAL-PSY-${(project?.id || "0000").slice(-4).toUpperCase()}`,
        projectNo: project?.code || (project?.id ? project.id.slice(0, 8) : "P000"),
        projectName: project?.name || "MEP Project",
        client: project?.client || "",
        endUser: (project as any)?.endUser || (project as any)?.location || "",
        unitSystem,
        secondParam,
        paramValue,
        atmPressure,
        dbtInput,
      });
      toast.dismiss("psych-pdf-export");
      toast.success("PDF Report exported successfully!");
    } catch (e) {
      console.error("Failed to export Psychrometric PDF", e);
      toast.dismiss("psych-pdf-export");
      toast.error("Failed to generate Psychrometric PDF report.");
    }
  };

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Psychrometric Calculation");

      worksheet.columns = [
        { header: "Psychrometric Property / Parameter", key: "param", width: 40 },
        { header: "Design Value (SI)", key: "valSi", width: 24 },
        { header: "Design Value (IP)", key: "valIp", width: 24 },
        { header: "Engineering Definition & Standard", key: "notes", width: 48 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: false, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0A7BC7" },
      };

      const rows = [
        { param: "Atmospheric Pressure (P_atm)", valSi: `${pAtmKpa.toFixed(3)} kPa`, valIp: `${pAtmPsi} psi`, notes: "Sea level standard barometric pressure" },
        { param: "Dry Bulb Temperature (T_db)", valSi: `${dbtC.toFixed(1)} °C`, valIp: `${dbtF.toFixed(1)} °F`, notes: "Primary sensible temperature" },
        { param: "Wet Bulb Temperature (T_wb)", valSi: `${wbtC.toFixed(1)} °C`, valIp: `${wbtF.toFixed(1)} °F`, notes: "Evaporative saturation limit" },
        { param: "Dew Point Temperature (T_dp)", valSi: `${dpC.toFixed(1)} °C`, valIp: `${dpF.toFixed(1)} °F`, notes: "Surface condensation threshold" },
        { param: "Relative Humidity (RH)", valSi: `${rhVal.toFixed(1)} %`, valIp: `${rhVal.toFixed(1)} %`, notes: "Degree of moisture saturation" },
        { param: "Humidity Ratio (W)", valSi: `${wGPerKg.toFixed(2)} g/kg`, valIp: `${wGrPerLb.toFixed(2)} gr/lb`, notes: "Mass ratio of water vapor to dry air" },
        { param: "Specific Enthalpy (h)", valSi: `${hKjKg.toFixed(2)} kJ/kg`, valIp: `${hBtuLb.toFixed(2)} BTU/lb`, notes: "Total moist air energy content" },
        { param: "Specific Volume (v)", valSi: `${vM3Kg.toFixed(4)} m³/kg`, valIp: `${vFt3Lb.toFixed(4)} ft³/lb`, notes: "Volume per unit mass of dry air" },
        { param: "Moist Air Density (ρ)", valSi: `${densitySi.toFixed(3)} kg/m³`, valIp: `${densityIp.toFixed(4)} lb/ft³`, notes: "Density of moist air mixture" },
        { param: "Vapor Pressure (P_w)", valSi: `${pwKpa.toFixed(3)} kPa`, valIp: `${pwPsi.toFixed(4)} psi`, notes: "Water vapor partial pressure" },
        { param: "ASHRAE 55 Comfort Status", valSi: comfortStatusText, valIp: comfortStatusText, notes: "Human thermal comfort compliance" },
      ];

      rows.forEach((r) => worksheet.addRow(r));

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Psychrometric_Calculation_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel Spreadsheet exported successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export Excel spreadsheet.");
    }
  };

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (intelOpen) { setIntelOpen(false); e.preventDefault(); return; }
        if (commentModalOpen) { setCommentModalOpen(false); e.preventDefault(); return; }
        return;
      }

      const activeEl = document.activeElement;
      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.tagName === "SELECT"
      );

      const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if ((e.key === "Enter" && isInput) || (isCmdOrCtrl && e.key === "Enter")) {
        e.preventDefault();
        setHasCalculated(true);
        toast.success("Psychrometric state calculated!");
        return;
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveCurrent();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [intelOpen, commentModalOpen, handleSaveCurrent]);

  const inputClass = "w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono font-normal focus:outline-none focus:border-primary disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";
  const flowInputClass = "w-full h-9 px-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-mono font-normal focus:outline-none focus:border-[#0A7BC7] disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";

  const getInputClass = (id: string, name?: string) => {
    const isHigh = isFieldHighlighted(id, name);
    const baseStyle = "w-full h-9 px-3 rounded-lg text-xs font-mono font-medium focus:outline-none disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base transition-all duration-150";

    return `${baseStyle} bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-foreground focus:border-[#0A7BC7] ${isHigh}`;
  };

  const getCardCommentClass = (id: string, name: string, baseClass: string) => {
    const isHigh = isFieldHighlighted(id, name);
    return `${baseClass} relative ${isHigh}`;
  };

  const renderChart = () => {
    const valDbt = ip ? cToF(calculatedData.dbt) : calculatedData.dbt + 273.15;
    const valDp = ip ? cToF(calculatedData.dp) : calculatedData.dp + 273.15;
    const valH = calculatedData.h;

    const uTemp = ip ? "°F" : "K";
    const uH = ip ? "BTU/lb" : "kJ/kg";

    const bars = [
      { label: `Dry Bulb (${uTemp})`, value: valDbt, color: "#0A7BC7", display: valDbt.toFixed(1) + " " + uTemp },
      { label: `Dew Point (${uTemp})`, value: valDp, color: "#06456F", display: valDp.toFixed(1) + " " + uTemp },
      { label: `Enthalpy (${uH})`, value: valH, color: "#7C3AED", display: valH.toFixed(1) + " " + uH }
    ];

    const W = 560;
    const H = 150;
    const PL = 135;
    const PR = 95;
    const PT = 15;
    const PB = 20;
    const CW = W - PL - PR;
    const CH = H - PT - PB;

    const maxVal = Math.max(...bars.map(b => b.value)) * 1.2 || 1;
    const chartId = "psych-chart-breakdown";
    const chartLabel = "Moist Air Properties Breakdown";

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            id={chartId}
            data-field-id={chartId}
            data-comment-target={chartId}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditModalOpen(true);
            }}
            className={`flex flex-col gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm select-none cursor-context-menu transition overflow-hidden ${isFieldHighlighted(chartId, "Psychrometric Chart")}`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <span className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                📊 {chartLabel}
              </span>
              {renderCommentBadge(chartId, chartLabel)}
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block overflow-hidden mt-1">
              {bars.map((b, i) => {
                const bw = CH / bars.length;
                const barH = bw * 0.55;
                const y = PT + i * bw + (bw - barH) / 2;
                const barW = (b.value / maxVal) * CW;
                return (
                  <g key={i}>
                    <text
                      x={PL - 10}
                      y={y + barH / 2 + 4}
                      textAnchor="end"
                      fontSize="10"
                      fontWeight="500"
                      fill="currentColor"
                      className="fill-foreground font-sans"
                    >
                      {b.label}
                    </text>
                    <rect x={PL} y={y} width={Math.max(2, barW)} height={barH} fill={b.color} rx="3" />
                    <text
                      x={PL + barW + 8}
                      y={y + barH / 2 + 4}
                      textAnchor="start"
                      fontSize="10"
                      fontWeight="600"
                      fill={b.color}
                      className="font-mono"
                    >
                      {b.display}
                    </text>
                  </g>
                );
              })}
              <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="currentColor" className="stroke-border" strokeWidth="1.5" />
            </svg>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
          <ContextMenuItem
            onClick={() => handleOpenComment(chartId, chartLabel)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>Add Comment</span>
          </ContextMenuItem>
          <ContextMenuSeparator className="h-px bg-border my-1" />
          <ContextMenuItem
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Edit Parameters</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <AppShell
      title="Psychrometric Calculator"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-2 gap-4 overflow-y-auto h-full">
          {/* Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Psychrometric Calculator</h1>
              </div>
              <button
                onClick={() => setIntelOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${intelOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>
              <CalculationReviewBar
                projectId={activeProjectId || project?.id}
                calculatorPath="/psychrometric"
                calculatorTitle="Psychrometric Calculator"
              />
            </div>
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} />
            </div>
          </div>

          {/* White / Dark Card container for Parameters & Results Grid */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED"
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
            : calcReviewState?.status === "REJECTED"
              ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
              : calcReviewState?.status === "REVIEWED"
                ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
            }`}>

            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    type="button"
                    onClick={() => setTab("calculator")}
                    className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "calculator"
                        ? "bg-background text-foreground shadow-sm font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Calculator
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("report")}
                    className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "report"
                        ? "bg-background text-foreground shadow-sm font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Report
                  </button>
                </div>

                {/* Formula Breakdown button */}
                <TBtn
                  onClick={() => framework.openPreviewModal(calculationPreviewData)}
                  title="View Step-by-Step Formula Breakdown"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Right Side Action Button: Export */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn
                  onClick={handleExportPDF}
                  title="Export PDF Calculation"
                >
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Content area */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20"
            >
              {tab === "calculator" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
                  <div className="lg:col-span-5 space-y-5">
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <span className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          📥 Input Air State
                        </span>
                      </div>

                      {/* DRY BULB TEMPERATURE */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="field-psych-dbt"
                            data-field-id="psych-dbt"
                            data-comment-target="psych-dbt"
                            className={`p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("psych-dbt", "Dry Bulb Temperature")}`}
                          >
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                                Dry Bulb Temperature ({isSI ? "°C" : "°F"})
                              </label>
                              <div className="relative mt-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  disabled={framework.isReadOnly || isApprovedLocked}
                                  value={dbtInput}
                                  onChange={(e) => {
                                    if (isApprovedLocked) return;
                                    setDbtInput(e.target.value === "" ? "" : Number(e.target.value));
                                    setHasCalculated(true);
                                    dirtyStore.set(true);
                                  }}
                                  className={getInputClass("psych-dbt", "Dry Bulb Temperature")}
                                />
                                {renderCommentBadge("psych-dbt", "Dry Bulb Temperature")}
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("psych-dbt", "Dry Bulb Temperature")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={framework.isReadOnly || isApprovedLocked}
                            onClick={() => {
                              if (framework.isReadOnly || isApprovedLocked) return;
                              setDbtInput(isSI ? 35 : 95);
                              toast.success("Dry bulb temperature reset to default");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset Dry Bulb Temp</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* KNOWN SECOND PARAMETER SELECTOR */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="field-psych-second-param"
                            data-field-id="psych-second-param"
                            data-comment-target="psych-second-param"
                            className={`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("psych-second-param", "Known Second Parameter")}`}
                          >
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                              Select Known 2nd Property
                            </span>
                            <div className="relative mt-1">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {(["rh", "wb", "dp", "w"] as SecondParam[]).map((param) => {
                                  const active = secondParam === param;
                                  const labelMap: Record<SecondParam, string> = {
                                    rh: "Rel. Humidity",
                                    wb: "Wet Bulb",
                                    dp: "Dew Point",
                                    w: "Hum. Ratio"
                                  };
                                  return (
                                    <button
                                      key={param}
                                      type="button"
                                      disabled={framework.isReadOnly || isApprovedLocked}
                                      onClick={() => {
                                        if (isApprovedLocked || framework.isReadOnly) return;
                                        setSecondParam(param);
                                        setHasCalculated(true);
                                        dirtyStore.set(true);
                                      }}
                                      className={`py-2 px-3 rounded-xl border text-center font-medium transition-all text-xs cursor-pointer ${
                                        active
                                          ? "bg-primary/10 border-primary text-primary shadow-xs font-semibold"
                                          : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:bg-slate-100 text-muted-foreground"
                                      }`}
                                    >
                                      {labelMap[param]}
                                    </button>
                                  );
                                })}
                              </div>
                              {renderCommentBadge("psych-second-param", "Known Second Parameter")}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("psych-second-param", "Known Second Parameter")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* PARAMETER VALUE INPUT */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="field-psych-param-value"
                            data-field-id="psych-param-value"
                            data-comment-target="psych-param-value"
                            className={`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("psych-param-value", "Parameter Value")}`}
                          >
                            <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                              {secondParam === "rh"
                                ? "Relative Humidity (%)"
                                : secondParam === "wb"
                                ? `Wet Bulb Temperature (${isSI ? "°C" : "°F"})`
                                : secondParam === "dp"
                                ? `Dew Point Temperature (${isSI ? "°C" : "°F"})`
                                : `Humidity Ratio (${isSI ? "g/kg" : "gr/lb"})`}
                            </label>
                            <div className="relative mt-1">
                              <input
                                type="number"
                                step="any"
                                disabled={framework.isReadOnly || isApprovedLocked}
                                value={paramValue}
                                onChange={(e) => {
                                  if (isApprovedLocked) return;
                                  setParamValue(e.target.value === "" ? "" : Number(e.target.value));
                                  setHasCalculated(true);
                                  dirtyStore.set(true);
                                }}
                                className={getInputClass("psych-param-value", "Parameter Value")}
                              />
                              {renderCommentBadge("psych-param-value", "Parameter Value")}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("psych-param-value", "Parameter Value")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={framework.isReadOnly || isApprovedLocked}
                            onClick={() => {
                              if (framework.isReadOnly || isApprovedLocked) return;
                              setParamValue(secondParam === "rh" ? 60 : secondParam === "wb" || secondParam === "dp" ? (isSI ? 25.5 : 78) : (isSI ? 15 : 100));
                              toast.success("Parameter value reset to default");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset Value</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* ATMOSPHERIC PRESSURE */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="field-psych-atm-pressure"
                            data-field-id="psych-atm-pressure"
                            data-comment-target="psych-atm-pressure"
                            className={`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("psych-atm-pressure", "Atmospheric Pressure")}`}
                          >
                            <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                              Atmospheric Pressure (kPa)
                            </label>
                            <div className="relative mt-1">
                              <input
                                type="number"
                                step="0.001"
                                disabled={framework.isReadOnly || isApprovedLocked}
                                value={atmPressure}
                                onChange={(e) => {
                                  if (isApprovedLocked) return;
                                  setAtmPressure(e.target.value === "" ? "" : Number(e.target.value));
                                  setHasCalculated(true);
                                  dirtyStore.set(true);
                                }}
                                className={getInputClass("psych-atm-pressure", "Atmospheric Pressure")}
                              />
                              {renderCommentBadge("psych-atm-pressure", "Atmospheric Pressure")}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("psych-atm-pressure", "Atmospheric Pressure")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={framework.isReadOnly || isApprovedLocked}
                            onClick={() => {
                              if (framework.isReadOnly || isApprovedLocked) return;
                              setAtmPressure(101.325);
                              toast.success("Atmospheric pressure reset to sea level default (101.325 kPa)");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset Atmospheric Pressure</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: CALCULATION RESULTS (lg:col-span-7) */}
                  <div className="lg:col-span-7 space-y-5 lg:sticky lg:top-0 self-start">
                    {/* PRIMARY RESULTS CARD */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id="card-hero-results"
                          data-field-id="card-hero-results"
                          data-comment-target="card-hero-results"
                          className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6 transition-colors ${isFieldHighlighted("card-hero-results", "Solved Air State Summary")}`}
                        >
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                            <div className="flex items-center">
                              <span className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                ⚡ Solved Air State Summary
                              </span>
                              {renderCommentBadge("card-hero-results", "Solved Air State Summary")}
                            </div>
                          </div>

                          {/* DISPLAY STAT CARDS */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="res-dbt"
                                  data-field-id="res-dbt"
                                  data-comment-target="res-dbt"
                                  className={getCardCommentClass("res-dbt", "Dry Bulb Temp", "bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 transition-all cursor-context-menu")}
                                >
                                  <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Dry Bulb Temp</div>
                                  <div className="text-xl font-semibold font-mono text-foreground mt-1">
                                    {isSI ? `${dbtC.toFixed(1)}` : `${dbtF.toFixed(1)}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "°C" : "°F"}</span>
                                  </div>
                                  {renderCommentBadge("res-dbt", "Dry Bulb Temp")}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("res-dbt", "Dry Bulb Temp")}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${isSI ? dbtC.toFixed(1) : dbtF.toFixed(1)} ${isSI ? "°C" : "°F"}`);
                                    toast.success("Copied Dry Bulb Temp");
                                  }}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                >
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="res-rh"
                                  data-field-id="res-rh"
                                  data-comment-target="res-rh"
                                  className={getCardCommentClass("res-rh", "Relative Humidity", "bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 transition-all cursor-context-menu")}
                                >
                                  <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Relative Humidity</div>
                                  <div className="text-xl font-semibold font-mono text-foreground mt-1">
                                    {rhVal.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">%</span>
                                  </div>
                                  {renderCommentBadge("res-rh", "Relative Humidity")}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("res-rh", "Relative Humidity")}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${rhVal.toFixed(1)} %`);
                                    toast.success("Copied Relative Humidity");
                                  }}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                >
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="res-enthalpy"
                                  data-field-id="res-enthalpy"
                                  data-comment-target="res-enthalpy"
                                  className={getCardCommentClass("res-enthalpy", "Specific Enthalpy", "bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 transition-all cursor-context-menu")}
                                >
                                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Specific Enthalpy</div>
                                  <div className="text-xl font-semibold font-mono text-foreground mt-1">
                                    {isSI ? `${hKjKg.toFixed(2)}` : `${hBtuLb.toFixed(2)}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "kJ/kg" : "BTU/lb"}</span>
                                  </div>
                                  {renderCommentBadge("res-enthalpy", "Specific Enthalpy")}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("res-enthalpy", "Specific Enthalpy")}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${isSI ? hKjKg.toFixed(2) : hBtuLb.toFixed(2)} ${isSI ? "kJ/kg" : "BTU/lb"}`);
                                    toast.success("Copied Specific Enthalpy");
                                  }}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                >
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="res-dewpoint"
                                  data-field-id="res-dewpoint"
                                  data-comment-target="res-dewpoint"
                                  className={getCardCommentClass("res-dewpoint", "Dew Point Temp", "bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 transition-all cursor-context-menu")}
                                >
                                  <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Dew Point Temp</div>
                                  <div className="text-xl font-semibold font-mono text-foreground mt-1">
                                    {isSI ? `${dpC.toFixed(1)}` : `${dpF.toFixed(1)}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "°C" : "°F"}</span>
                                  </div>
                                  {renderCommentBadge("res-dewpoint", "Dew Point Temp")}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("res-dewpoint", "Dew Point Temp")}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${isSI ? dpC.toFixed(1) : dpF.toFixed(1)} ${isSI ? "°C" : "°F"}`);
                                    toast.success("Copied Dew Point Temp");
                                  }}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                >
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </div>

                          {/* DETAILED METRICS TABLE */}
                          <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Wet Bulb Temperature:</span>
                              <span className="font-mono font-medium">{isSI ? `${wbtC.toFixed(1)} °C` : `${wbtF.toFixed(1)} °F`}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Humidity Ratio (W):</span>
                              <span className="font-mono font-medium">{isSI ? `${wGPerKg.toFixed(2)} g/kg` : `${wGrPerLb.toFixed(2)} gr/lb`}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Specific Volume (v):</span>
                              <span className="font-mono font-medium">{isSI ? `${vM3Kg.toFixed(4)} m³/kg` : `${vFt3Lb.toFixed(4)} ft³/lb`}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Moist Air Density (ρ):</span>
                              <span className="font-mono font-medium">{isSI ? `${densitySi.toFixed(3)} kg/m³` : `${densityIp.toFixed(4)} lb/ft³`}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Water Vapor Pressure (P_w):</span>
                              <span className="font-mono font-medium">{isSI ? `${pwKpa.toFixed(3)} kPa` : `${pwPsi.toFixed(4)} psi`}</span>
                            </div>
                            <div className="flex justify-between py-1 font-medium text-foreground">
                              <span>Calculated Total Enthalpy (h):</span>
                              <span className="font-mono font-semibold text-[#0A7BC7]">{isSI ? `${hKjKg.toFixed(2)} kJ/kg` : `${hBtuLb.toFixed(2)} BTU/lb`}</span>
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          onClick={() => handleOpenComment("card-hero-results", "Solved Air State Summary")}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => framework.openPreviewModal(calculationPreviewData)}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                        >
                          <Eye className="size-3.5 text-primary" />
                          <span>Calculation Preview</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Formula</ContextMenuShortcut>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </div>
                </div>
              )}

              {/* REPORT PREVIEW TAB */}
              {tab === "report" && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6">
                    {/* 1. Title */}
                    <div className="pb-1">
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                        Psychrometric Calculation
                      </h2>
                    </div>

                    {/* Enclosed Project Metadata Grid */}
                    <div className="border border-border rounded-xl overflow-hidden text-[12px] bg-card">
                      <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-muted/20">
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Calculation No.:</span>
                          <span className="text-foreground font-mono font-medium">
                            {(project as any)?.calcNo || `TRV-CAL-PSY-${(project?.id || "0000").slice(-4).toUpperCase()}`}
                          </span>
                        </div>
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Date:</span>
                          <span className="text-foreground font-mono font-medium">{formatDateStr(new Date().toISOString())}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Project No.:</span>
                          <span className="text-muted-foreground font-mono">{project?.code || project?.id?.substring(0, 8) || "P000"}</span>
                        </div>
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Client:</span>
                          <span className="text-muted-foreground">{project?.client || "-"}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-border">
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Project Name:</span>
                          <span className="text-muted-foreground">{project?.name || "Psychrometric Calculation"}</span>
                        </div>
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">End User:</span>
                          <span className="text-muted-foreground">{(project as any)?.endUser || (project as any)?.location || "-"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Table 1: Design Input Parameter */}
                    <div className="border border-border rounded-xl overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                              <th className="py-2.5 px-2.5 w-10">Sr.</th>
                              <th className="py-2.5 px-3 text-left">Design Input Parameter</th>
                              <th className="py-2.5 px-3 text-left">Governing Rule / Basis</th>
                              <th className="py-2.5 px-3 text-right">Specified Value</th>
                              <th className="py-2.5 px-3 text-left">Engineering Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 font-sans">
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">1</td>
                              <td className="py-2 px-3 font-medium text-foreground">Atmospheric Pressure (P_atm)</td>
                              <td className="py-2 px-3 text-muted-foreground">Standard Barometric Design Level</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{pAtmKpa.toFixed(3)} kPa ({pAtmPsi} psi)</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Sea-level standard atmosphere</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">2</td>
                              <td className="py-2 px-3 font-medium text-foreground">Dry Bulb Temperature (T_db)</td>
                              <td className="py-2 px-3 text-muted-foreground">Primary Known Moist Air Temperature</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">
                                {isSI ? `${dbtC.toFixed(1)} °C (${dbtF.toFixed(1)} °F)` : `${dbtF.toFixed(1)} °F (${dbtC.toFixed(1)} °C)`}
                              </td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Sensible boundary condition</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">3</td>
                              <td className="py-2 px-3 font-medium text-foreground">Known 2nd Parameter ({paramName})</td>
                              <td className="py-2 px-3 text-muted-foreground">Independent Thermodynamic Boundary</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{paramValDisplay}</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Governing moisture state condition</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">4</td>
                              <td className="py-2 px-3 font-medium text-foreground">Thermodynamic Formulation</td>
                              <td className="py-2 px-3 text-muted-foreground">ASHRAE Handbook Fundamentals</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">Hyland-Wexler Formulation</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Standard high-precision psychrometric model</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Table 2: Solved Psychrometric Properties */}
                    <div className="border border-border rounded-xl overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                              <th className="py-2.5 px-2.5 w-10">Sr.</th>
                              <th className="py-2.5 px-3 text-left">Psychrometric Property</th>
                              <th className="py-2.5 px-2 text-center">Symbol</th>
                              <th className="py-2.5 px-3 text-right">SI Metric</th>
                              <th className="py-2.5 px-3 text-right">IP Imperial</th>
                              <th className="py-2.5 px-3 text-left">Engineering Definition</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 font-sans">
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">1</td>
                              <td className="py-2 px-3 font-medium text-foreground">Dry Bulb Temperature</td>
                              <td className="py-2 px-2 text-center font-mono font-medium">T_db</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{dbtC.toFixed(1)} °C</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{dbtF.toFixed(1)} °F</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Sensible thermal state of moist air</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">2</td>
                              <td className="py-2 px-3 font-medium text-foreground">Wet Bulb Temperature</td>
                              <td className="py-2 px-2 text-center font-mono font-medium">T_wb</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{wbtC.toFixed(1)} °C</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{wbtF.toFixed(1)} °F</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Adiabatic saturation limit</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">3</td>
                              <td className="py-2 px-3 font-medium text-foreground">Dew Point Temperature</td>
                              <td className="py-2 px-2 text-center font-mono font-medium">T_dp</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{dpC.toFixed(1)} °C</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{dpF.toFixed(1)} °F</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Surface condensation threshold</td>
                            </tr>
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-foreground font-medium">
                              <td className="py-2 px-2.5 text-center font-mono">4</td>
                              <td className="py-2 px-3 font-semibold">Relative Humidity</td>
                              <td className="py-2 px-2 text-center font-mono font-medium">RH</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{rhVal.toFixed(1)} %</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{rhVal.toFixed(1)} %</td>
                              <td className="py-2 px-3 text-[10.5px]">Degree of moisture saturation</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">5</td>
                              <td className="py-2 px-3 font-medium text-foreground">Humidity Ratio (Specific Moisture)</td>
                              <td className="py-2 px-2 text-center font-mono font-medium">W</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{wGPerKg.toFixed(2)} g/kg</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{wGrPerLb.toFixed(2)} gr/lb</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Mass ratio of moisture to dry air</td>
                            </tr>
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-foreground font-medium">
                              <td className="py-2 px-2.5 text-center font-mono">6</td>
                              <td className="py-2 px-3 font-semibold">Specific Enthalpy (Total Energy)</td>
                              <td className="py-2 px-2 text-center font-mono font-medium">h</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{hKjKg.toFixed(2)} kJ/kg</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{hBtuLb.toFixed(2)} BTU/lb</td>
                              <td className="py-2 px-3 text-[10.5px]">Total energy content (Sensible + Latent)</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">7</td>
                              <td className="py-2 px-3 font-medium text-foreground">Specific Volume</td>
                              <td className="py-2 px-2 text-center font-mono font-medium">v</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{vM3Kg.toFixed(4)} m³/kg</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{vFt3Lb.toFixed(4)} ft³/lb</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Volume per unit mass of dry air</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">8</td>
                              <td className="py-2 px-3 font-medium text-foreground">Moist Air Density</td>
                              <td className="py-2 px-2 text-center font-mono font-medium">ρ</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{densitySi.toFixed(3)} kg/m³</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{densityIp.toFixed(4)} lb/ft³</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Reciprocal of moist air specific volume</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">9</td>
                              <td className="py-2 px-3 font-medium text-foreground">Water Vapor Partial Pressure</td>
                              <td className="py-2 px-2 text-center font-mono font-medium">P_w</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{pwKpa.toFixed(3)} kPa</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{pwPsi.toFixed(4)} psi</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Partial pressure exerted by water vapor</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* MOIST AIR PROPERTIES BREAKDOWN */}
                    {renderChart()}

                    {/* Table 3: Dynamic Signature Block */}
                    <div className="border border-border rounded-xl overflow-hidden mt-6 bg-card">
                      <table className="w-full text-center text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-[#FFE6CC] text-black font-semibold border-b border-border">
                            <th className="py-2 px-3 text-left w-1/4">Designation</th>
                            <th className="py-2 px-3 w-1/4">Originator</th>
                            <th className="py-2 px-3 w-1/4">Reviewer</th>
                            <th className="py-2 px-3 w-1/4">Approver</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-sans">
                          <tr>
                            <td className="py-2 px-3 text-left font-medium text-foreground">Name:</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.name || sigDetails?.originatedName || "-"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.name || sigDetails?.reviewerName || "-"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.name || sigDetails?.approverName || "-"}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 text-left font-medium text-foreground">Date:</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.date || sigDetails?.originatedDate || "-"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.date || sigDetails?.reviewerDate || "-"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.date || sigDetails?.approverDate || "-"}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 text-left font-medium text-foreground">Signature:</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.status || (sigDetails?.originatedName ? "Signed" : "-")}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.status || (sigDetails?.reviewerName ? "Reviewed" : "-")}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.status || (sigDetails?.approverName ? "Approved" : "-")}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Intelligence Drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen
              ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg flex flex-col"
              : "w-0"
          }`}
        >
          {intelOpen && (
            <PsychrometricIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calculatedData={calculatedData}
              unitSystem={unitSystem}
              atmPressure={atmPressure}
              dbtInput={dbtInput}
              secondParam={secondParam}
              paramValue={paramValue}
              onApplyPreset={(preset) => {
                if (isApprovedLocked || framework.isReadOnly) {
                  toast.info("Calculation is Locked. Unlock required to apply preset.");
                  return;
                }
                setUnitSystem(preset.unitSystem);
                setDbtInput(preset.dbt);
                setSecondParam(preset.secondParam);
                setParamValue(preset.paramValue);
                if (preset.atmPressure !== undefined) {
                  setAtmPressure(preset.atmPressure);
                }
                setHasCalculated(true);
                dirtyStore.set(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Framework Preview & Comment Modals */}
      <CalculationPreviewModal
        isOpen={framework.isPreviewOpen}
        onClose={framework.closePreviewModal}
        data={framework.previewData || calculationPreviewData}
      />
      <AssignCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        targetId={commentTargetItem?.id || ""}
        targetName={commentTargetItem?.name || ""}
        targetType="Psychrometric Parameter"
        calculatorTitle="Psychrometric Calculator"
        calculatorPath="/psychrometric"
        existingComments={getItemComments(commentTargetItem?.id || "")}
        onSave={handleSaveComment}
      />
      {editModalOpen && (
        <EditPsychrometricModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSave={handleSavePsychrometricModal}
          currentData={{
            unitSystem,
            dbtInput,
            secondParam,
            paramValue,
            atmPressure,
          }}
          isApprovedLocked={isApprovedLocked}
        />
      )}
    </AppShell>
  );
}

// ==========================================
// PSYCHROMETRIC INTELLIGENCE DRAWER COMPONENT
// ==========================================

interface PsychPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  unitSystem: "ip" | "si";
  dbt: number;
  secondParam: SecondParam;
  paramValue: number;
  atmPressure?: number;
}

function PsychrometricIntelligenceDrawer({
  onClose,
  calculatedData,
  unitSystem,
  atmPressure,
  dbtInput,
  secondParam,
  paramValue,
  onApplyPreset,
}: {
  onClose: () => void;
  calculatedData: {
    dbt: number;
    wbt: number;
    dp: number;
    rh: number;
    w: number;
    h: number;
    v: number;
    pw: number;
  };
  unitSystem: "si" | "ip";
  atmPressure: number | "";
  dbtInput: number | "";
  secondParam: SecondParam;
  paramValue: number | "";
  onApplyPreset: (preset: PsychPreset) => void;
}) {
  const ip = unitSystem === "ip";
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    comfort: true,
    enthalpy: true,
    condensation: true,
    evaporative: true,
    altitude: false,
    presets: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const tC = calculatedData.dbt;
  const rh = calculatedData.rh;
  const w = calculatedData.w;
  const dpC = calculatedData.dp;
  const wbC = calculatedData.wbt;
  const pAtmVal = atmPressure !== "" ? Number(atmPressure) : 101.325;

  // 1. Thermal Comfort & Health Assessment (ASHRAE 55)
  const comfortAudit = useMemo(() => {
    const isSummerComfort = tC >= 23 && tC <= 26 && rh >= 30 && rh <= 60;
    const isWinterComfort = tC >= 20 && tC <= 24 && rh >= 30 && rh <= 60;
    const isComfortable = isSummerComfort || isWinterComfort;

    let status = "Standard Operable State";
    let badgeClass = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
    let message = "Air state is within typical engineering conditioning operating bounds.";
    let icon = Activity;

    if (isComfortable) {
      status = isSummerComfort ? "ASHRAE 55 Summer Comfort Compliant" : "ASHRAE 55 Winter Comfort Compliant";
      badgeClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      message = "Air state fully satisfies human thermal comfort criteria (ASHRAE 55 / ISO 7730 standard).";
      icon = CheckCircle2;
    } else if (rh > 80) {
      status = "High Humidity / Mold & Condensation Risk";
      badgeClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      message = "Relative humidity exceeds 80%. Elevated likelihood of microbial growth and condensation on uninsulated cool surfaces.";
      icon = AlertTriangle;
    } else if (rh < 25) {
      status = "Excessively Dry / Electrostatic Risk";
      badgeClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      message = "Relative humidity is below 25%. High risk of electrostatic discharge, dry mucosa, and material shrinkage.";
      icon = AlertTriangle;
    } else if (tC > 38) {
      status = "Extreme Heat / Heat Stress Risk";
      badgeClass = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      message = "High dry bulb temperature requires extensive sensible cooling and occupant heat stress mitigation.";
      icon = Flame;
    } else if (tC < 0) {
      status = "Sub-Freezing / Coil Freeze Risk";
      badgeClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      message = "Dry bulb temperature is below 0°C. Protect cooling coils with preheat or antifreeze controls.";
      icon = Wind;
    }

    return { status, badgeClass, message, isComfortable, icon };
  }, [tC, rh]);

  // 2. Sensible vs Latent Enthalpy Partition
  const enthalpyPartition = useMemo(() => {
    const hSensible_kJ = 1.006 * tC;
    const hLatent_kJ = w * (2501 + 1.805 * tC);
    const total_h_kJ = calculatedData.h;

    const sensibleRatio = total_h_kJ > 0 ? Math.min(100, Math.max(0, Math.round((hSensible_kJ / total_h_kJ) * 100))) : 50;
    const latentRatio = Math.max(0, 100 - sensibleRatio);

    const hSensibleDisplay = ip ? (hSensible_kJ / 2.326).toFixed(2) + " BTU/lb" : hSensible_kJ.toFixed(2) + " kJ/kg";
    const hLatentDisplay = ip ? (hLatent_kJ / 2.326).toFixed(2) + " BTU/lb" : hLatent_kJ.toFixed(2) + " kJ/kg";

    const density_kg_m3 = calculatedData.v > 0 ? (1 / calculatedData.v) : 1.2;
    const densityDisplay = ip ? (density_kg_m3 * 0.062428).toFixed(4) + " lb/ft³" : density_kg_m3.toFixed(3) + " kg/m³";

    return {
      hSensibleDisplay,
      hLatentDisplay,
      sensibleRatio,
      latentRatio,
      densityDisplay,
    };
  }, [tC, w, calculatedData.h, calculatedData.v, ip]);

  // 3. Condensation & Dew Point Depression Analysis
  const condensationAnalysis = useMemo(() => {
    const dpDepressionC = tC - dpC;
    const dpDepressionF = dpDepressionC * 1.8;
    const depressionDisplay = ip ? `${dpDepressionF.toFixed(1)} °F` : `${dpDepressionC.toFixed(1)} °C`;

    let riskLevel = "Low Risk";
    let riskClass = "text-emerald-600 dark:text-emerald-400";
    let advice = "Safe thermal margin against envelope and ductwork condensation.";

    if (dpDepressionC < 2.0) {
      riskLevel = "Critical Risk";
      riskClass = "text-red-600 dark:text-red-400";
      advice = "Any surface cooler than the air by >2°C will immediately form condensate. Vapor retarder required.";
    } else if (dpDepressionC < 5.0) {
      riskLevel = "Moderate Risk";
      riskClass = "text-amber-600 dark:text-amber-400";
      advice = "Ensure chilled water piping and supply ducts are adequately insulated.";
    }

    return {
      depressionDisplay,
      riskLevel,
      riskClass,
      advice,
    };
  }, [tC, dpC, ip]);

  // 4. Direct Evaporative & Dehumidification Analysis
  const hvacFeasibility = useMemo(() => {
    const wbDepressionC = tC - wbC;
    const wbDepressionF = wbDepressionC * 1.8;
    const evaporativePotential = ip ? `${wbDepressionF.toFixed(1)} °F` : `${wbDepressionC.toFixed(1)} °C`;

    const targetW = wFromRH(tC, 50, pAtmVal * 1000);
    const deltaW_kg = Math.max(0, w - targetW);
    const deltaWDisplay = ip
      ? `${(deltaW_kg * 7000).toFixed(1)} gr/lb`
      : `${(deltaW_kg * 1000).toFixed(2)} g/kg`;

    return {
      evaporativePotential,
      deltaWDisplay,
      needsDehumidification: deltaW_kg > 0.0005,
    };
  }, [tC, wbC, w, pAtmVal, ip]);

  // 5. Altitude & Atmospheric Analysis
  const altitudeAnalysis = useMemo(() => {
    const altMeters = 44330 * (1 - Math.pow(pAtmVal / 101.325, 0.190284));
    const altFeet = altMeters * 3.28084;
    const densityRatio = (calculatedData.v > 0 ? (1 / calculatedData.v) : 1.2) / 1.204;

    return {
      altDisplay: ip ? `${Math.round(altFeet).toLocaleString()} ft` : `${Math.round(altMeters).toLocaleString()} m`,
      densityRatioPct: Math.round(densityRatio * 100),
      isHighAltitude: Math.abs(altMeters) > 300,
    };
  }, [pAtmVal, calculatedData.v, ip]);

  // 6. Presets list
  const presets: PsychPreset[] = [
    {
      id: "ashrae-summer-peak",
      name: "ASHRAE 0.4% Summer Peak",
      category: "Outdoor Design",
      description: "Standard hot summer ambient design condition for cooling coil sizing.",
      unitSystem: "ip",
      dbt: 95,
      secondParam: "wb",
      paramValue: 78,
      atmPressure: 101.325,
    },
    {
      id: "ashrae-indoor-comfort",
      name: "Standard Indoor Comfort",
      category: "ASHRAE 55",
      description: "Typical conditioned indoor office space (75°F / 50% RH).",
      unitSystem: "ip",
      dbt: 75,
      secondParam: "rh",
      paramValue: 50,
      atmPressure: 101.325,
    },
    {
      id: "winter-heating",
      name: "Winter Heating Condition",
      category: "Winter Design",
      description: "Indoor space during winter heating season (70°F / 30% RH).",
      unitSystem: "ip",
      dbt: 70,
      secondParam: "rh",
      paramValue: 30,
      atmPressure: 101.325,
    },
    {
      id: "datacenter-white-space",
      name: "Data Center (ASHRAE TC 9.9)",
      category: "Critical Facility",
      description: "Recommended data hall inlet condition (68°F DBT / 50°F DP).",
      unitSystem: "ip",
      dbt: 68,
      secondParam: "dp",
      paramValue: 50,
      atmPressure: 101.325,
    },
    {
      id: "hospital-operating-room",
      name: "Hospital Surgery Suite",
      category: "Healthcare",
      description: "ASHRAE 170 surgical suite condition (66°F DBT / 45% RH).",
      unitSystem: "ip",
      dbt: 66,
      secondParam: "rh",
      paramValue: 45,
      atmPressure: 101.325,
    },
    {
      id: "cleanroom-iso5",
      name: "Cleanroom Class 100 / ISO 5",
      category: "Pharmaceutical",
      description: "High-spec semiconductor or cleanroom space (20°C DBT / 40% RH).",
      unitSystem: "si",
      dbt: 20,
      secondParam: "rh",
      paramValue: 40,
      atmPressure: 101.325,
    },
    {
      id: "cold-storage",
      name: "Cold Storage Room",
      category: "Refrigeration",
      description: "Chilled produce preservation chamber (2°C DBT / 85% RH).",
      unitSystem: "si",
      dbt: 2,
      secondParam: "rh",
      paramValue: 85,
      atmPressure: 101.325,
    },
  ];

  const StatusIcon = comfortAudit.icon;

  return (
    <div className="h-full w-[360px] flex flex-col font-sans select-none animate-in fade-in duration-200 bg-card">
      {/* Header */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-border/80 bg-slate-50/50 dark:bg-slate-900/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <span className="text-[13px] font-semibold text-foreground tracking-tight">Psychrometric Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Close Intelligence Drawer"
        >
          <X className="size-3.5" />
        </button>
      </header>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60 text-xs custom-scrollbar">
        {/* 1. Comfort & Health Assessment */}
        <section className="p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <StatusIcon className="size-3.5 text-primary" /> ASHRAE 55 Audit
            </span>
          </div>

          <div className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${comfortAudit.badgeClass}`}>
            <span className="font-semibold text-[11.5px] flex items-center gap-1.5">
              <StatusIcon className="size-3.5 shrink-0" />
              {comfortAudit.status}
            </span>
            <p className="text-[11px] opacity-90 leading-relaxed">
              {comfortAudit.message}
            </p>
          </div>
        </section>

        {/* 2. Sensible vs Latent Enthalpy Breakdown */}
        <section className="p-4 flex flex-col gap-2.5">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("enthalpy")}
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="size-3.5 text-[#0A7BC7]" /> Enthalpy & Density
            </span>
            {openSections.enthalpy ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.enthalpy && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60">
                  <span className="text-[10px] uppercase font-medium text-muted-foreground">Sensible Heat</span>
                  <div className="font-mono font-semibold text-xs text-foreground mt-0.5">
                    {enthalpyPartition.hSensibleDisplay}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {enthalpyPartition.sensibleRatio}% of Enthalpy
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60">
                  <span className="text-[10px] uppercase font-medium text-muted-foreground">Latent (Moisture)</span>
                  <div className="font-mono font-semibold text-xs text-primary mt-0.5">
                    {enthalpyPartition.hLatentDisplay}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {enthalpyPartition.latentRatio}% of Enthalpy
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                  <span>Sensible ({enthalpyPartition.sensibleRatio}%)</span>
                  <span>Latent ({enthalpyPartition.latentRatio}%)</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800">
                  <div style={{ width: `${enthalpyPartition.sensibleRatio}%` }} className="bg-[#0A7BC7] h-full" />
                  <div style={{ width: `${enthalpyPartition.latentRatio}%` }} className="bg-primary h-full" />
                </div>
              </div>

              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 p-2 rounded-lg border border-border/50 text-[11px] mt-1">
                <span className="font-medium text-muted-foreground">Moist Air Density</span>
                <span className="font-mono font-semibold text-foreground">{enthalpyPartition.densityDisplay}</span>
              </div>
            </div>
          )}
        </section>

        {/* 3. Condensation Risk */}
        <section className="p-4 flex flex-col gap-2.5">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("condensation")}
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Droplets className="size-3.5 text-blue-500" /> Condensation Risk
            </span>
            {openSections.condensation ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.condensation && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60">
                <div>
                  <span className="text-[10px] uppercase font-medium text-muted-foreground block">Dew Point Depression</span>
                  <span className="font-mono font-semibold text-sm text-foreground">{condensationAnalysis.depressionDisplay}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-medium text-muted-foreground block">Risk Level</span>
                  <span className={`font-semibold text-xs ${condensationAnalysis.riskClass}`}>{condensationAnalysis.riskLevel}</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
                {condensationAnalysis.advice}
              </p>
            </div>
          )}
        </section>

        {/* 4. Process Feasibility */}
        <section className="p-4 flex flex-col gap-2.5">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("evaporative")}
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wind className="size-3.5 text-emerald-500" /> Process Feasibility
            </span>
            {openSections.evaporative ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.evaporative && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10.5px] font-medium text-muted-foreground">Evaporative Cooling Potential</span>
                  <span className="font-mono font-semibold text-foreground">{hvacFeasibility.evaporativePotential}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Max sensible temperature drop achievable via direct 100% adiabatic saturation.
                </span>
              </div>

              {hvacFeasibility.needsDehumidification && (
                <div className="bg-primary/5 p-2.5 rounded-xl border border-primary/20 flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10.5px] font-medium text-primary">Dehumidification Needed</span>
                    <span className="font-mono font-semibold text-primary">{hvacFeasibility.deltaWDisplay}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Moisture removal required per unit mass of dry air to reach 50% relative humidity.
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 5. Altitude & Atmospheric */}
        <section className="p-4 flex flex-col gap-2.5">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("altitude")}
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Gauge className="size-3.5 text-purple-500" /> Altitude & Barometric
            </span>
            {openSections.altitude ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.altitude && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60">
                  <span className="text-[10px] uppercase font-medium text-muted-foreground">Equiv. Altitude</span>
                  <div className="font-mono font-semibold text-xs text-foreground mt-0.5">
                    {altitudeAnalysis.altDisplay}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60">
                  <span className="text-[10px] uppercase font-medium text-muted-foreground">Density Multiplier</span>
                  <div className="font-mono font-semibold text-xs text-foreground mt-0.5">
                    {altitudeAnalysis.densityRatioPct}%
                  </div>
                </div>
              </div>
              <p className="text-[10.5px] text-muted-foreground px-1">
                {altitudeAnalysis.isHighAltitude
                  ? "Significant altitude variance. Airflow rates (CFM / L/s) must be derated by the density multiplier."
                  : "Sea level standard barometric conditions (101.325 kPa / 29.921 inHg)."}
              </p>
            </div>
          )}
        </section>

        {/* 6. Standard HVAC Presets */}
        <section className="p-4 flex flex-col gap-2.5">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("presets")}
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders className="size-3.5 text-amber-500" /> Standard HVAC Presets
            </span>
            {openSections.presets ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.presets && (
            <div className="flex flex-col gap-2 mt-1">
              <p className="text-[10.5px] text-muted-foreground px-0.5">
                Click any standard design benchmark to immediately load and solve:
              </p>
              <div className="flex flex-col gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onApplyPreset(p);
                      toast.success(`Applied preset "${p.name}"`);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-primary/5 transition text-left group cursor-pointer"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-[11.5px] text-foreground group-hover:text-primary transition-colors">{p.name}</span>
                        <span className="text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground">{p.category}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-tight">{p.description}</span>
                    </div>
                    <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-primary shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
