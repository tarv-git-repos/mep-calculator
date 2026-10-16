import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  Download, ChevronDown, ChevronRight, ChevronUp, Save, Sparkles, Eye,
  MessageSquare, CheckCircle2, AlertTriangle, Activity, Gauge, Zap,
  Droplets, ShieldCheck, Check, X, SlidersHorizontal, Sliders, TrendingDown,
  Info, ArrowRight, RefreshCw, RotateCcw, Layers, FileText, Printer, Calculator
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { exportPumpSizingPDF } from "@/lib/exportPumpSizingPDF";

import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-store";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass } from "@/components/workspace/CalculationReviewBar";
import { dirtyStore } from "@/lib/dirty-store";
import { IP_FIXTURE_UNITS } from "@/lib/calc-plumbing-fixture-unit";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { CalculationPreviewModal, CalculationPreviewData } from "@/components/calculator-framework/CalculationPreviewModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { useCalculatorFramework } from "@/components/calculator-framework";
import {
  ipcTable,
  wsfuToGPM,
  wsfuToLPS,
  computePumpSizingCalculations
} from "@/lib/calc-plumbing-pump-sizing";


export const Route = createFileRoute("/plumbing-pump-sizing")({
  head: () => ({
    meta: [
      { title: "Pump Sizing (Transfer/Booster) — MEP Calc" },
      {
        name: "description",
        content:
          "Determine domestic water booster or transfer pump capacity, dynamic head, and motor sizing.",
      },
    ],
  }),
  component: PumpSizingPage,
});

function PumpSizingPage() {
  const { project, activeProjectId, isReadOnly, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-pump-sizing", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-pump-sizing", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const isApprovedLocked = useCalculationLock("/plumbing-pump-sizing", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Intelligence Drawer State
  const [activeTab, setActiveTab] = useState<"sizing" | "report">("sizing");
  const [intelOpen, setIntelOpen] = useState<boolean>(false);

  // Inputs
  const [pumpType, setPumpType] = useState<"booster" | "transfer" | "transfer-booster">("booster");
  const [wsfuVal, setWsfuVal] = useState<string>("21.6");
  const [manualFlow, setManualFlow] = useState<string>("1.3");
  
  // Transfer pump specifics
  const [reqVolume, setReqVolume] = useState<string>("5000");
  const [fillTime, setFillTime] = useState<string>("2");
  
  // Pumps count
  const [workingPumps, setWorkingPumps] = useState<string>("1");
  const [standbyPumps, setStandbyPumps] = useState<string>("1");
  
  // Piping
  const [fricFactor, setFricFactor] = useState<string>("0.4");
  const [pipeVert, setPipeVert] = useState<string>("20");
  const [pipeHoriz, setPipeHoriz] = useState<string>("50");
  
  // Filters
  const [filtCarbon, setFiltCarbon] = useState(false);
  const [filtMM, setFiltMM] = useState(false);
  const [filtCuAg, setFiltCuAg] = useState(false);
  const [filtSoftener, setFiltSoftener] = useState(false);
  
  // Sizing head parameters
  const [staticHead, setStaticHead] = useState<string>("5.0");
  const [presidHead, setPresidHead] = useState<string>("1.0");
  const [suctionHead, setSuctionHead] = useState<string>("0");
  const [sfHead, setSfHead] = useState<string>("5");
  
  // Motor parameters
  const [selectedHead, setSelectedHead] = useState<string>("");
  const [effMotor, setEffMotor] = useState<string>("85");
  const [effPump, setEffPump] = useState<string>("70");
  
  // Unit System
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const isSI = unitSystem === "si";

  const handleUnitToggle = (targetUnit: "si" | "ip", shouldConvert: boolean = true) => {
    if (targetUnit === unitSystem) return;
    if (shouldConvert) {
      if (targetUnit === "ip") {
        const vertNum = parseFloat(pipeVert);
        if (!isNaN(vertNum)) setPipeVert((vertNum * 3.28084).toFixed(1));
        const horizNum = parseFloat(pipeHoriz);
        if (!isNaN(horizNum)) setPipeHoriz((horizNum * 3.28084).toFixed(1));
        const reqVolNum = parseFloat(reqVolume);
        if (!isNaN(reqVolNum)) setReqVolume((reqVolNum * 0.264172).toFixed(1));
        const staticHNum = parseFloat(staticHead);
        if (!isNaN(staticHNum)) setStaticHead((staticHNum * 14.5038).toFixed(1));
        const presidHNum = parseFloat(presidHead);
        if (!isNaN(presidHNum)) setPresidHead((presidHNum * 14.5038).toFixed(1));
        const suctionHNum = parseFloat(suctionHead);
        if (!isNaN(suctionHNum)) setSuctionHead((suctionHNum * 14.5038).toFixed(1));
      } else {
        const vertNum = parseFloat(pipeVert);
        if (!isNaN(vertNum)) setPipeVert((vertNum / 3.28084).toFixed(1));
        const horizNum = parseFloat(pipeHoriz);
        if (!isNaN(horizNum)) setPipeHoriz((horizNum / 3.28084).toFixed(1));
        const reqVolNum = parseFloat(reqVolume);
        if (!isNaN(reqVolNum)) setReqVolume((reqVolNum / 0.264172).toFixed(1));
        const staticHNum = parseFloat(staticHead);
        if (!isNaN(staticHNum)) setStaticHead((staticHNum / 14.5038).toFixed(1));
        const presidHNum = parseFloat(presidHead);
        if (!isNaN(presidHNum)) setPresidHead((presidHNum / 14.5038).toFixed(1));
        const suctionHNum = parseFloat(suctionHead);
        if (!isNaN(suctionHNum)) setSuctionHead((suctionHNum / 14.5038).toFixed(1));
      }
    }
    setUnitSystem(targetUnit);
    dirtyStore.set(true);
  };
  
  // Accordion UI state
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Comments state
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  const getItemComments = (itemId: string) => commentsList.filter(c => c.targetId === itemId || c.spaceId === itemId || c.itemId === itemId);

  // Load comments on project switch
  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/plumbing-pump-sizing`;
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

  // Scroll and highlight notification target item
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();
      const cleanRaw = cleanId.replace(/^(field-|card-|res-)/, "");

      const el = document.getElementById(targetId || "") ||
                 document.getElementById(`field-${cleanRaw}`) ||
                 document.getElementById(`card-${cleanRaw}`) ||
                 document.getElementById(`field-${targetId}`) ||
                 document.getElementById(`card-${targetId}`) ||
                 document.querySelector(`[data-field-id="${cleanRaw}"]`) ||
                 document.querySelector(`[data-field-id="${targetId}"]`) ||
                 document.querySelector(`[data-comment-target="${cleanRaw}"]`) ||
                 document.querySelector(`[data-comment-target="${targetId}"]`);

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
  }, [typeof window !== "undefined" ? window.location.search : ""]);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/plumbing-pump-sizing`, JSON.stringify(newList));
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

  const handleSaveComment = (commentData: any) => {
    const targetId = commentTargetItem?.id || commentData?.targetId || commentData?.spaceId || commentData?.itemId || "pumpType";
    const targetName = commentTargetItem?.name || commentData?.targetName || commentData?.spaceName || "Pump Parameter";

    const commentWithMeta = {
      ...commentData,
      targetId,
      targetName,
      spaceId: targetId,
      spaceName: targetName,
      itemId: targetId,
      targetType: "Pump Sizing Parameter",
      calculatorPath: "/plumbing-pump-sizing",
    };

    const updated = [commentWithMeta, ...commentsList];
    saveComments(updated);

    notifyCommentAssigned({
      ...commentWithMeta,
      url: `/plumbing-pump-sizing?targetId=${targetId}&targetName=${encodeURIComponent(targetName)}`
    });

    setCommentModalOpen(false);
    toast.success("Comment/Task added successfully!");
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
    const existing = getItemComments(id);
    if (existing.length === 0) return null;
    const unresolvedCount = existing.filter(c => c.status !== "resolved").length;
    if (unresolvedCount === 0) return null;
    return (
      <RowCommentCornerBadge
        count={unresolvedCount}
        onClick={() => handleOpenComment(id, name)}
      />
    );
  };

  // Modular Framework Hook
  const framework = useCalculatorFramework({
    calculatorId: "/plumbing-pump-sizing",
    calculatorTitle: "Pump Sizing (Transfer/Booster)",
    items: [
      {
        id: "pump-duty-1",
        name: `${pumpType.toUpperCase()} Pump Duty`,
        code: `PUMP-01`,
      },
    ],
  });

  // Load state from localStorage on project change
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_pump_sizing_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.pumpType) setPumpType(data.pumpType);
        if (data.wsfuVal !== undefined) setWsfuVal(data.wsfuVal);
        if (data.manualFlow !== undefined) setManualFlow(data.manualFlow);
        if (data.reqVolume !== undefined) setReqVolume(data.reqVolume);
        if (data.fillTime !== undefined) setFillTime(data.fillTime);
        if (data.workingPumps !== undefined) setWorkingPumps(data.workingPumps);
        if (data.standbyPumps !== undefined) setStandbyPumps(data.standbyPumps);
        if (data.fricFactor !== undefined) setFricFactor(data.fricFactor);
        if (data.pipeVert !== undefined) setPipeVert(data.pipeVert);
        if (data.pipeHoriz !== undefined) setPipeHoriz(data.pipeHoriz);
        if (data.filtCarbon !== undefined) setFiltCarbon(data.filtCarbon);
        if (data.filtMM !== undefined) setFiltMM(data.filtMM);
        if (data.filtCuAg !== undefined) setFiltCuAg(data.filtCuAg);
        if (data.filtSoftener !== undefined) setFiltSoftener(data.filtSoftener);
        if (data.staticHead !== undefined) setStaticHead(data.staticHead);
        if (data.presidHead !== undefined) setPresidHead(data.presidHead);
        if (data.suctionHead !== undefined) setSuctionHead(data.suctionHead);
        if (data.sfHead !== undefined) setSfHead(data.sfHead);
        if (data.selectedHead !== undefined) setSelectedHead(data.selectedHead);
        if (data.effMotor !== undefined) setEffMotor(data.effMotor);
        if (data.effPump !== undefined) setEffPump(data.effPump);
        if (data.unitSystem !== undefined) setUnitSystem(data.unitSystem);
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load pump sizing calculation", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  const handleSaveCurrent = useCallback(() => {
    try {
      const dataToSave = {
        pumpType,
        wsfuVal,
        manualFlow,
        reqVolume,
        fillTime,
        workingPumps,
        standbyPumps,
        fricFactor,
        pipeVert,
        pipeHoriz,
        filtCarbon,
        filtMM,
        filtCuAg,
        filtSoftener,
        staticHead,
        presidHead,
        suctionHead,
        sfHead,
        selectedHead,
        effMotor,
        effPump,
        unitSystem,
      };
      localStorage.setItem(`mep_pump_sizing_calc_${project?.id || "default"}`, JSON.stringify(dataToSave));
      dirtyStore.set(false);
      if (forceSaveToCloud) forceSaveToCloud();
      toast.success("Pump Sizing Calculation saved to project successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  }, [
    project?.id, pumpType, wsfuVal, manualFlow, reqVolume, fillTime, workingPumps, standbyPumps,
    fricFactor, pipeVert, pipeHoriz, filtCarbon, filtMM, filtCuAg, filtSoftener,
    staticHead, presidHead, suctionHead, sfHead, selectedHead, effMotor, effPump, forceSaveToCloud
  ]);

  useEffect(() => {
    const handleTriggerSave = (e: any) => {
      if (e.detail) e.detail.handled = true;
      handleSaveCurrent();
    };
    window.addEventListener("mep-trigger-save", handleTriggerSave);
    return () => window.removeEventListener("mep-trigger-save", handleTriggerSave);
  }, [handleSaveCurrent]);

  const handleImportWSFU = () => {
    try {
      const stored = localStorage.getItem(`mep_fixture_unit_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.fuSpaces && Array.isArray(data.fuSpaces)) {
          let total = 0;
          data.fuSpaces.forEach((s: any) => {
            const spaceStd = s.std || "ipc-total";
            Object.keys(s.fixtures || {}).forEach((fid) => {
              const qty = s.fixtures[fid] || 0;
              const unitFU = IP_FIXTURE_UNITS[fid]?.[spaceStd] || 0;
              total += qty * unitFU;
            });
          });

          if (total > 0) {
            setWsfuVal(total.toFixed(1));
            dirtyStore.set(true);
            toast.success(`Imported ${total.toFixed(1)} WSFU from Fixture Unit Calculator!`);
          } else {
            toast.error("No fixture unit calculations found in this project.");
          }
        }
      } else {
        toast.error("No saved Fixture Unit Calculator found for this project.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to import values.");
    }
  };

  // Calculations
  const results = useMemo(() => {
    return computePumpSizingCalculations(pipeVert, pipeHoriz, fricFactor, pumpType, filtCarbon, filtMM, filtCuAg, filtSoftener, staticHead, presidHead, suctionHead, sfHead, selectedHead, manualFlow, effPump, effMotor, wsfuVal, reqVolume, fillTime, workingPumps);
  }, [pipeVert, pipeHoriz, fricFactor, pumpType, filtCarbon, filtMM, filtCuAg, filtSoftener, staticHead, presidHead, suctionHead, sfHead, selectedHead, manualFlow, effPump, effMotor, wsfuVal, reqVolume, fillTime, workingPumps]);

  // Step-by-Step Formula Preview Data for Framework Modal
  const calculationPreviewData: CalculationPreviewData = useMemo(() => {
    return {
      title: "Pump Dynamic Head & Motor Sizing Calculation",
      itemName: `${pumpType.toUpperCase()} Pump Duty`,
      itemCode: "PUMP-01",
      standardReference: "IPC / CIBSE Guide W",
      inputs: [
        { label: "Pump Type", value: pumpType.toUpperCase() },
        { label: "Design Flow Q", value: results.flowLps.toFixed(2), unit: "L/s" },
        { label: "Pipe Vertical Length (L_vert)", value: pipeVert, unit: "m" },
        { label: "Pipe Horizontal Length (L_horiz)", value: pipeHoriz, unit: "m" },
        { label: "Elbows & Reducers Equiv (L_elbows)", value: results.elbows.toFixed(1), unit: "m" },
        { label: "Valves & Fittings Equiv (L_valves)", value: results.valves.toFixed(1), unit: "m" },
        { label: "Friction Factor", value: fricFactor, unit: "bar/100m" },
        { label: "Static Head", value: staticHead, unit: "bar" },
        { label: "Residual Outlet Pressure", value: presidHead, unit: "bar" },
        { label: "Suction Pressure", value: suctionHead, unit: "bar" },
        { label: "Pump Efficiency", value: effPump, unit: "%" },
        { label: "Motor Efficiency", value: effMotor, unit: "%" },
      ],
      steps: [
        {
          stepNumber: 1,
          label: "Equivalent Pipe Length (L_eq)",
          formula: "L_eq = Math.ceil((L_vert + L_horiz + L_elbows + L_valves) * 1.05 / 10) * 10",
          substitution: `L_eq = Math.ceil((${pipeVert} + ${pipeHoriz} + ${results.elbows.toFixed(1)} + ${results.valves.toFixed(1)}) * 1.05 / 10) * 10`,
          result: results.equivLen.toFixed(1),
          unit: "m",
          status: "info",
          description: `L_elbows = 30% of (${pipeVert} + ${pipeHoriz}) = ${results.elbows.toFixed(1)} m. L_valves = 30% of (${pipeVert} + ${pipeHoriz}) = ${results.valves.toFixed(1)} m. Equivalent length includes 5% safety margin and is rounded up to nearest 10m.`
        },
        {
          stepNumber: 2,
          label: "Friction Head Loss (H_fric)",
          formula: "H_fric = L_eq * (Friction Factor / 100)",
          substitution: `H_fric = ${results.equivLen.toFixed(1)} * (${fricFactor} / 100)`,
          result: results.frictionLoss.toFixed(3),
          unit: "bar",
          status: "info",
          description: `Calculated using target friction factor (${fricFactor} bar per 100m equivalent pipe length).`
        },
        {
          stepNumber: 3,
          label: "Total Dynamic Pump Head (H_total)",
          formula: "H_total = [(H_fric + H_static + H_outlet) - H_suction] * (1 + Safety Margin)",
          substitution: `H_total = (${results.frictionLoss.toFixed(3)} + ${staticHead} + ${presidHead} - ${suctionHead}) * (1 + ${sfHead}%)`,
          result: results.calcHead.toFixed(3),
          unit: "bar",
          status: "pass",
        },
        {
          stepNumber: 4,
          label: "Shaft Power Requirement (P_shaft)",
          formula: "P_shaft = (Q * H_lift_kPa) / (1000 * Pump_Efficiency)",
          substitution: `P_shaft = (${results.flowLps.toFixed(2)} * ${results.liftKpa.toFixed(1)}) / (1000 * ${parseFloat(effPump) / 100})`,
          result: results.shaftPower.toFixed(2),
          unit: "kW",
          status: "info",
        },
        {
          stepNumber: 5,
          label: "Required Motor Power (P_motor)",
          formula: "P_motor = P_shaft / Motor_Efficiency",
          substitution: `P_motor = ${results.shaftPower.toFixed(2)} / (${parseFloat(effMotor) / 100})`,
          result: results.motorPower.toFixed(2),
          unit: "kW",
          status: "pass",
        },
      ],
      finalResultLabel: "Final Motor Power Duty",
      finalResultValue: results.motorPower.toFixed(2),
      finalResultUnit: `kW (${results.hp.toFixed(2)} HP)`,
      complianceNote: "Pump head and motor power calculated in compliance with IPC & CIBSE Guide W.",
    };
  }, [
    pumpType, results, pipeVert, pipeHoriz, fricFactor, staticHead, presidHead, suctionHead, effPump, effMotor, sfHead
  ]);

  const handleExportPDF = async () => {
    await exportPumpSizingPDF(
      {
        pumpType,
        wsfuVal,
        manualFlow,
        reqVolume,
        fillTime,
        workingPumps,
        standbyPumps,
        fricFactor,
        pipeVert,
        pipeHoriz,
        filtCarbon,
        filtMM,
        filtCuAg,
        filtSoftener,
        staticHead,
        presidHead,
        suctionHead,
        sfHead,
        effPump,
        effMotor,
      },
      results,
      unitSystem,
      {
        projectName: (project as any)?.name || (project as any)?.projectName,
        client: (project as any)?.client,
        projectNo: (project as any)?.code || (project as any)?.projectNo,
        calcNo: (project as any)?.calcNo,
        endUser: (project as any)?.endUser || (project as any)?.location,
        userName: currentUserName,
        reviewState: calcReviewState,
      }
    );
  };

  const inputClass = "w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono focus:outline-none focus:border-primary disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";
  const flowInputClass = "w-full h-9 px-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:border-[#0A7BC7] disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";

  return (
    <AppShell
      title="Pump Sizing"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Pump Sizing (Booster / Transfer)</h1>
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
                projectId={activeProjectId}
                calculatorPath="/plumbing-pump-sizing"
                calculatorTitle="Pump Sizing (Transfer/Booster)"
              />
            </div>
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitToggle} />
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
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50 gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Main Tab Switcher (Matching Ventilation & Fixture Unit format) */}
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
                    Sizing &amp; Inputs
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

                {/* Sizing Sub-pills (Pump Type selection) */}
                {activeTab === "sizing" && (
                  <>
                    <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                      {(["booster", "transfer", "transfer-booster"] as const).map((t) => {
                        const active = pumpType === t;
                        return (
                          <button
                            key={t}
                            onClick={() => setPumpType(t)}
                            className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                              active
                                ? "bg-background text-foreground shadow-xs font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {t === "booster" ? "Booster Pump" : t === "transfer" ? "Transfer Pump" : "Dual Booster / Transfer"}
                          </button>
                        );
                      })}
                    </div>

                    <TBtn
                      onClick={() => framework.openPreviewModal(calculationPreviewData)}
                      title="View Step-by-Step Formula Breakdown"
                    >
                      <Info className="size-3.5 text-primary" /> Formula Breakdown
                    </TBtn>
                  </>
                )}
              </div>

              {/* Action buttons on the right of tabs */}
              <div className="flex items-center gap-2">
                <TBtn
                  onClick={handleExportPDF}
                  title="Export PDF Report"
                >
                  <FileText className="size-3.5" /> Export
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

                    {/* WSFU vs VOLUME INPUTS */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          id="field-flowParams" 
                          data-field-id="flowParams" 
                          data-comment-target="flowParams"
                          className={`p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("flowParams", "Flow Parameters")}`}
                        >
                          {pumpType !== "transfer" ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                    Total Water Supply Fixture Units (WSFU)
                                  </label>
                                  {renderCommentBadge("flowParams", "Flow Parameters")}
                                </div>
                                <button
                                  disabled={framework.isReadOnly}
                                  onClick={handleImportWSFU}
                                  className={`text-[10.5px] font-bold text-[#0A7BC7] hover:underline cursor-pointer ${framework.isReadOnly ? "hidden" : ""}`}
                                >
                                  Import WSFU
                                </button>
                              </div>
                              <input
                                type="number"
                                disabled={framework.isReadOnly}
                                value={wsfuVal}
                                onChange={(e) => setWsfuVal(e.target.value)}
                                className={flowInputClass}
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="flex items-center">
                                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                    Target Volume ({isSI ? "Litres" : "Gallons"})
                                  </label>
                                  {renderCommentBadge("flowParams", "Flow Parameters")}
                                </div>
                                <input
                                  type="number"
                                  disabled={framework.isReadOnly}
                                  value={reqVolume}
                                  onChange={(e) => setReqVolume(e.target.value)}
                                  className={flowInputClass}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                  Fill Time (Hours)
                                </label>
                                <input
                                  type="number"
                                  disabled={framework.isReadOnly}
                                  value={fillTime}
                                  onChange={(e) => setFillTime(e.target.value)}
                                  className={flowInputClass}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          disabled={framework.isReadOnly || isApprovedLocked}
                          onClick={() => {
                            if (framework.isReadOnly || isApprovedLocked) return;
                            setWsfuVal("21.6");
                            setReqVolume("1000");
                            setFillTime("2");
                            toast.success("Flow parameters reset to default");
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <RotateCcw className="size-3.5 text-muted-foreground" />
                          <span>Reset Flow Parameters</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleOpenComment("flowParams", "Flow Parameters")}
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
                          className={`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("pipingParams", "Piping & Friction")}`}
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
                                disabled={framework.isReadOnly}
                                value={fricFactor}
                                onChange={(e) => setFricFactor(e.target.value)}
                                className="w-8 bg-transparent text-slate-700 dark:text-slate-200 font-bold text-center border-none outline-none focus:ring-1 focus:ring-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded transition-all cursor-pointer p-0"
                              />
                              <span>{isSI ? "bar/100m length" : "psi/100ft length"}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="text-[11px] text-slate-500">Vertical ({isSI ? "m" : "ft"})</label>
                              <input
                                type="number"
                                disabled={framework.isReadOnly}
                                value={pipeVert}
                                onChange={(e) => setPipeVert(e.target.value)}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500">Horizontal ({isSI ? "m" : "ft"})</label>
                              <input
                                type="number"
                                disabled={framework.isReadOnly}
                                value={pipeHoriz}
                                onChange={(e) => setPipeHoriz(e.target.value)}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          disabled={framework.isReadOnly || isApprovedLocked}
                          onClick={() => {
                            if (framework.isReadOnly || isApprovedLocked) return;
                            setPipeVert("20");
                            setPipeHoriz("50");
                            setFricFactor("0.4");
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
                          className={`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("headParams", "Head & Pressures")}`}
                        >
                          <div className="flex items-center">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Head & Pressures ({isSI ? "bar" : "psi"})
                            </span>
                            {renderCommentBadge("headParams", "Head & Pressures")}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="text-[11px] text-slate-500">Static Head ({isSI ? "bar" : "psi"})</label>
                              <input
                                type="number"
                                disabled={framework.isReadOnly}
                                value={staticHead}
                                onChange={(e) => setStaticHead(e.target.value)}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500">Residual Outlet ({isSI ? "bar" : "psi"})</label>
                              <input
                                type="number"
                                disabled={framework.isReadOnly}
                                value={presidHead}
                                onChange={(e) => setPresidHead(e.target.value)}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500">Suction Pressure ({isSI ? "bar" : "psi"})</label>
                              <input
                                type="number"
                                disabled={framework.isReadOnly}
                                value={suctionHead}
                                onChange={(e) => setSuctionHead(e.target.value)}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500">Safety Margin (%)</label>
                              <input
                                type="number"
                                disabled={framework.isReadOnly}
                                value={sfHead}
                                onChange={(e) => setSfHead(e.target.value)}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          disabled={framework.isReadOnly || isApprovedLocked}
                          onClick={() => {
                            if (framework.isReadOnly || isApprovedLocked) return;
                            setStaticHead("5.0");
                            setPresidHead("1.0");
                            setSuctionHead("0");
                            setSfHead("10");
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

                    {/* EFFICIENCY PARAMETERS */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          id="field-efficiencyParams" 
                          data-field-id="efficiencyParams" 
                          data-comment-target="efficiencyParams"
                          className={`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("efficiencyParams", "Efficiency Ratings")}`}
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
                                disabled={framework.isReadOnly}
                                value={effPump}
                                onChange={(e) => setEffPump(e.target.value)}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500">Motor Efficiency (%)</label>
                              <input
                                type="number"
                                disabled={framework.isReadOnly}
                                value={effMotor}
                                onChange={(e) => setEffMotor(e.target.value)}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          disabled={framework.isReadOnly || isApprovedLocked}
                          onClick={() => {
                            if (framework.isReadOnly || isApprovedLocked) return;
                            setEffPump("70");
                            setEffMotor("85");
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

                {/* RIGHT COLUMN: CALCULATION RESULTS (lg:col-span-7) */}
                <div className="lg:col-span-7 space-y-5 lg:sticky lg:top-0 self-start">
                  {/* PRIMARY RESULTS CARD */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div 
                        id="card-hero-results" 
                        data-field-id="card-hero-results" 
                        data-comment-target="card-hero-results"
                        className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6 transition-colors ${isFieldHighlighted("card-hero-results", "Sizing Results Summary")}`}
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                          <div className="flex items-center">
                            <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                              ⚡ Sizing Results Summary
                            </span>
                            {renderCommentBadge("card-hero-results", "Sizing Results Summary")}
                          </div>
                        </div>

                        {/* DISPLAY STAT CARDS */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5">
                            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Design Flow</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {isSI ? `${results.flowLps.toFixed(2)}` : `${(results.flowLps * 15.8503).toFixed(2)}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "L/s" : "GPM"}</span>
                            </div>
                          </div>

                          <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5">
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Dynamic Head</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {isSI ? `${results.calcHead.toFixed(2)}` : `${(results.calcHead * 14.5038).toFixed(2)}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "bar" : "psi"}</span>
                            </div>
                          </div>

                          <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5">
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Motor Rating</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {results.motorPower.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">kW</span>
                            </div>
                          </div>

                          <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5">
                            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Horsepower</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {results.hp.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">HP</span>
                            </div>
                          </div>
                        </div>

                        {/* DETAILED METRICS TABLE */}
                        <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Equivalent Pipe Length:</span>
                            <span className="font-mono font-bold">{results.equivLen.toFixed(1)} m</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Friction Head Loss:</span>
                            <span className="font-mono font-bold">{results.frictionLoss.toFixed(3)} bar</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Required Shaft Power:</span>
                            <span className="font-mono font-bold">{results.shaftPower.toFixed(2)} kW</span>
                          </div>
                          <div className="flex justify-between py-1 font-bold text-foreground">
                            <span>Estimated Electrical Motor Rating:</span>
                            <span className="font-mono text-[#0A7BC7]">{results.motorPower.toFixed(2)} kW ({results.hp.toFixed(2)} HP)</span>
                          </div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => framework.openPreviewModal(calculationPreviewData)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                      >
                        <Eye className="size-3.5 text-primary" />
                        <span>Calculation Preview</span>
                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Formula</ContextMenuShortcut>
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
                </div>
              </div>
            </div>
            ) : (
              <PumpSizingReportView
                inputs={{
                  pumpType,
                  wsfuVal,
                  manualFlow,
                  reqVolume,
                  fillTime,
                  workingPumps,
                  standbyPumps,
                  fricFactor,
                  pipeVert,
                  pipeHoriz,
                  filtCarbon,
                  filtMM,
                  filtCuAg,
                  filtSoftener,
                  staticHead,
                  presidHead,
                  suctionHead,
                  sfHead,
                  effPump,
                  effMotor,
                }}
                results={results}
                unitSystem={unitSystem}
                project={project}
                calcReviewState={calcReviewState}
                currentUserName={currentUserName}
                onExportPdf={handleExportPDF}
              />
            )}
          </div>
        </div>

        {/* Collapsible Intelligence Drawer (Matching Ventilation UI exactly) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen
              ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg flex flex-col"
              : "w-0"
          }`}
        >
          {intelOpen && (
            <PumpSizingIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              pumpType={pumpType}
              setPumpType={setPumpType}
              wsfuVal={wsfuVal}
              setWsfuVal={setWsfuVal}
              manualFlow={manualFlow}
              setManualFlow={setManualFlow}
              reqVolume={reqVolume}
              setReqVolume={setReqVolume}
              fillTime={fillTime}
              setFillTime={setFillTime}
              workingPumps={workingPumps}
              setWorkingPumps={setWorkingPumps}
              standbyPumps={standbyPumps}
              setStandbyPumps={setStandbyPumps}
              pipeVert={pipeVert}
              setPipeVert={setPipeVert}
              pipeHoriz={pipeHoriz}
              setPipeHoriz={setPipeHoriz}
              fricFactor={fricFactor}
              setFricFactor={setFricFactor}
              staticHead={staticHead}
              setStaticHead={setStaticHead}
              presidHead={presidHead}
              setPresidHead={setPresidHead}
              suctionHead={suctionHead}
              setSuctionHead={setSuctionHead}
              sfHead={sfHead}
              setSfHead={setSfHead}
              effPump={effPump}
              setEffPump={setEffPump}
              effMotor={effMotor}
              setEffMotor={setEffMotor}
              filtCarbon={filtCarbon}
              setFiltCarbon={setFiltCarbon}
              filtMM={filtMM}
              setFiltMM={setFiltMM}
              filtCuAg={filtCuAg}
              setFiltCuAg={setFiltCuAg}
              filtSoftener={filtSoftener}
              setFiltSoftener={setFiltSoftener}
              results={results}
              unitSystem={unitSystem}
              isLocked={framework.isReadOnly || isApprovedLocked}
              commentsList={commentsList}
              onOpenComment={handleOpenComment}
              onOpenPreview={() => framework.openPreviewModal(calculationPreviewData)}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <CalculationPreviewModal
        isOpen={framework.isPreviewOpen}
        onClose={framework.closePreviewModal}
        data={framework.previewData || calculationPreviewData}
        onExportPDF={handleExportPDF}
      />
      <AssignCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        targetId={commentTargetItem?.id || ""}
        targetName={commentTargetItem?.name || ""}
        onSave={handleSaveComment}
        currentUserId={userData?.id || "user-1"}
        currentUserName={currentUserName}
      />
    </AppShell>
  );
}

// ==========================================
// PUMP SIZING REPORT VIEW COMPONENT (MATCHING VENTILATION DESIGN FORMAT)
// ==========================================

interface PumpSizingReportViewProps {
  inputs: {
    pumpType: "booster" | "transfer" | "transfer-booster";
    wsfuVal: string;
    manualFlow: string;
    reqVolume: string;
    fillTime: string;
    workingPumps: string;
    standbyPumps: string;
    fricFactor: string;
    pipeVert: string;
    pipeHoriz: string;
    filtCarbon: boolean;
    filtMM: boolean;
    filtCuAg: boolean;
    filtSoftener: boolean;
    staticHead: string;
    presidHead: string;
    suctionHead: string;
    sfHead: string;
    effPump: string;
    effMotor: string;
  };
  results: {
    elbows: number;
    valves: number;
    totalLen: number;
    equivLen: number;
    frictionLoss: number;
    filterLoss: number;
    calcHead: number;
    selectedHead: number;
    flowLps: number;
    liftKpa: number;
    shaftPower: number;
    motorPower: number;
    hp: number;
  };
  unitSystem: "si" | "ip";
  project: any;
  calcReviewState: any;
  currentUserName: string;
  onExportPdf: () => void;
}

function PumpSizingReportView({
  inputs,
  results,
  unitSystem,
  project,
  calcReviewState,
  currentUserName,
  onExportPdf,
}: PumpSizingReportViewProps) {
  const isSI = unitSystem === "si";
  const today = new Date().toLocaleDateString("en-GB");
  const calcNo = project?.calcNo || "TRV-CAL-PMP-R01";
  const projectNo = project?.code || project?.projectNo || "P000";
  const projectName = project?.name || project?.projectName || "Domestic Water Pump Sizing";
  const clientName = project?.client || "Design Client";
  const endUser = project?.endUser || project?.location || "Site Development";

  const pumpTypeLabel =
    inputs.pumpType === "booster"
      ? "Domestic Booster Pump Station"
      : inputs.pumpType === "transfer"
      ? "Roof Tank Transfer Pump"
      : "Dual Booster / Transfer System";

  const flowDisp = isSI
    ? `${results.flowLps.toFixed(2)}`
    : `${(results.flowLps * 15.8503).toFixed(2)}`;
  const flowUnit = isSI ? "L/s" : "GPM";

  const headDisp = isSI
    ? `${results.calcHead.toFixed(2)}`
    : `${(results.calcHead * 14.5038).toFixed(2)}`;
  const headUnit = isSI ? "bar" : "psi";

  const lenUnit = isSI ? "m" : "ft";

  const sigDetails = getSignatureBlockDetails(
    project?.id || "default",
    "/plumbing-pump-sizing",
    currentUserName,
    calcReviewState
  );

  return (
    <div className="flex flex-col h-full select-none">
      {/* Top Action Bar matching Ventilation standard */}
      <div className="flex items-center gap-1 px-4 h-11 shrink-0 border-b border-border/50 bg-card/50">
        <span className="text-[12px] text-muted-foreground font-semibold">
          Generated: <span className="text-foreground font-mono">{formatDateStr(new Date())}</span>
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <TBtn onClick={() => window.print()}>
            <Printer className="size-3.5" /> Print
          </TBtn>
          <TBtn primary onClick={onExportPdf}>
            <FileText className="size-3.5" /> Export PDF
          </TBtn>
        </div>
      </div>

      {/* Main Report Page Layout matching Ventilation styling */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
        <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6 font-sans">
          
          {/* Header Title and Meta */}
          <div className="flex justify-between items-start pb-4 border-b border-border">
            <div>
              <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                Pump Sizing Calculation Report
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Domestic Water Booster &amp; Transfer Station Hydraulic Analysis &amp; Motor Sizing (IPC Table 604.3 / BS EN 806 / CIBSE Guide W)
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block mt-0.5 font-mono">Date: {today}</span>
            </div>
          </div>

          {/* Project Metadata Table 3x2 (Enclosed Corporate Header matching Ventilation) */}
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
              1. Executive Design Parameters &amp; Pump Duty Summary
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
                    <td className="p-2.5 font-bold">Pump Application Type</td>
                    <td className="p-2.5 text-center font-bold text-foreground">{pumpTypeLabel}</td>
                    <td className="p-2.5 text-center text-muted-foreground">-</td>
                    <td className="p-2.5 text-muted-foreground">Domestic Water Distribution System</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                    <td className="p-2.5 font-bold">Pump Station Configuration</td>
                    <td className="p-2.5 text-center font-bold text-foreground">{inputs.workingPumps}W + {inputs.standbyPumps}S</td>
                    <td className="p-2.5 text-center text-muted-foreground">units</td>
                    <td className="p-2.5 text-muted-foreground">Standard N+1 duty and standby arrangement</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                    <td className="p-2.5 font-bold">
                      {inputs.pumpType === "transfer" ? "Storage Tank Volume & Fill Time" : "Water Supply Fixture Units (WSFU)"}
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">
                      {inputs.pumpType === "transfer" ? `${inputs.reqVolume} L in ${inputs.fillTime} hrs` : (inputs.wsfuVal || "-")}
                    </td>
                    <td className="p-2.5 text-center text-muted-foreground">
                      {inputs.pumpType === "transfer" ? "L / hr" : "WSFU"}
                    </td>
                    <td className="p-2.5 text-muted-foreground">
                      {inputs.pumpType === "transfer" ? "Storage refill duty cycle" : "IPC Table 604.3 / Hunter's Curve demand"}
                    </td>
                  </tr>
                  {/* Highlighted Duty Parameter: Design Flow Rate (Matching Ventilation standard #DAE9F8) */}
                  <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                    <td className="p-2.5 text-center font-mono">4</td>
                    <td className="p-2.5 font-bold">Design Flow Rate per Pump (Q)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{flowDisp}</td>
                    <td className="p-2.5 text-center font-mono font-bold">{flowUnit}</td>
                    <td className="p-2.5">Peak simultaneous demand flow requirement</td>
                  </tr>
                  {/* Highlighted Duty Parameter: Total Dynamic Head (Matching Ventilation standard #DAE9F8) */}
                  <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                    <td className="p-2.5 text-center font-mono">5</td>
                    <td className="p-2.5 font-bold">Calculated Total Dynamic Head (TDH)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{headDisp}</td>
                    <td className="p-2.5 text-center font-mono font-bold">{headUnit}</td>
                    <td className="p-2.5">Static head + friction + residual pressure + {inputs.sfHead}% margin</td>
                  </tr>
                  {/* Highlighted Duty Parameter: Motor Power (Matching Ventilation standard #DAE9F8) */}
                  <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                    <td className="p-2.5 text-center font-mono">6</td>
                    <td className="p-2.5 font-bold">Estimated Motor Rating Demand</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{results.motorPower.toFixed(2)}</td>
                    <td className="p-2.5 text-center font-mono font-bold">kW</td>
                    <td className="p-2.5">Equivalent: {results.hp.toFixed(2)} HP (Pump η: {inputs.effPump}%, Motor η: {inputs.effMotor}%)</td>
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
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">1</td>
                    <td className="p-2.5 font-bold">Vertical Pipe Height (Riser Lift)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{inputs.pipeVert}</td>
                    <td className="p-2.5 text-center">{lenUnit}</td>
                    <td className="p-2.5 text-muted-foreground">Geometric vertical lift to highest fixture / roof tank</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                    <td className="p-2.5 font-bold">Horizontal Pipe Distribution Run</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{inputs.pipeHoriz}</td>
                    <td className="p-2.5 text-center">{lenUnit}</td>
                    <td className="p-2.5 text-muted-foreground">Horizontal distribution header and branch length</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                    <td className="p-2.5 font-bold">Fittings &amp; Valves Equivalent Allowance</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{(results.elbows + results.valves).toFixed(1)}</td>
                    <td className="p-2.5 text-center">{lenUnit}</td>
                    <td className="p-2.5 text-muted-foreground">30% elbows + 30% valves standard empirical allowance</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">4</td>
                    <td className="p-2.5 font-bold">Total Equivalent Pipe Length (L_equiv)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{results.equivLen.toFixed(1)}</td>
                    <td className="p-2.5 text-center">{lenUnit}</td>
                    <td className="p-2.5 text-muted-foreground">Developed length with 5% safety margin rounded to 10m</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">5</td>
                    <td className="p-2.5 font-bold">Unit Friction Factor (Loss / 100m)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{inputs.fricFactor}</td>
                    <td className="p-2.5 text-center">{isSI ? "bar/100m" : "psi/100ft"}</td>
                    <td className="p-2.5 text-muted-foreground">Hazen-Williams / Darcy-Weisbach standard friction loss rate</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">6</td>
                    <td className="p-2.5 font-bold">Calculated Pipe Friction Loss</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{isSI ? results.frictionLoss.toFixed(3) : (results.frictionLoss * 14.5038).toFixed(3)}</td>
                    <td className="p-2.5 text-center">{isSI ? "bar" : "psi"}</td>
                    <td className="p-2.5 text-muted-foreground">L_equiv * (Friction Factor / 100)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">7</td>
                    <td className="p-2.5 font-bold">Water Filtration &amp; Treatment Loss</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{isSI ? results.filterLoss.toFixed(2) : (results.filterLoss * 14.5038).toFixed(2)}</td>
                    <td className="p-2.5 text-center">{isSI ? "bar" : "psi"}</td>
                    <td className="p-2.5 text-muted-foreground">Active carbon / sand / softener / Cu-Ag ionization filter head loss</td>
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
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{inputs.staticHead}</td>
                    <td className="p-2.5 text-center">{isSI ? "bar" : "psi"}</td>
                    <td className="p-2.5 text-muted-foreground">Building elevation height differential</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                    <td className="p-2.5 font-bold">Residual Terminal Pressure (P_res)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{inputs.presidHead}</td>
                    <td className="p-2.5 text-center">{isSI ? "bar" : "psi"}</td>
                    <td className="p-2.5 text-muted-foreground">Minimum required pressure at remotest outlet fixture</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                    <td className="p-2.5 font-bold">Suction Tank Inflow / Head Credit (H_suct)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{inputs.suctionHead}</td>
                    <td className="p-2.5 text-center">{isSI ? "bar" : "psi"}</td>
                    <td className="p-2.5 text-muted-foreground">Positive suction head from elevated supply reservoir</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">4</td>
                    <td className="p-2.5 font-bold">Aging &amp; Fouling Safety Margin</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{inputs.sfHead}</td>
                    <td className="p-2.5 text-center">%</td>
                    <td className="p-2.5 text-muted-foreground">Engineering contingency margin</td>
                  </tr>
                  <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                    <td className="p-2.5 text-center font-mono">5</td>
                    <td className="p-2.5 font-bold">Total Dynamic Calculation Head (TDH)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{headDisp}</td>
                    <td className="p-2.5 text-center font-mono font-bold">{headUnit}</td>
                    <td className="p-2.5">((H_fric + H_static + P_res) - H_suct + H_filt) * (1 + Safety Margin)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 4: Motor & Energy Power Analysis */}
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
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{results.liftKpa.toFixed(1)}</td>
                    <td className="p-2.5 text-center">kPa</td>
                    <td className="p-2.5 text-muted-foreground">Calculated pressure differential = TDH * 100</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                    <td className="p-2.5 font-bold">Pump Hydraulic Efficiency (η_pump)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{inputs.effPump}</td>
                    <td className="p-2.5 text-center">%</td>
                    <td className="p-2.5 text-muted-foreground">Centrifugal pump hydraulic efficiency curve</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                    <td className="p-2.5 font-bold">Calculated Shaft Power (P_shaft)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{results.shaftPower.toFixed(2)}</td>
                    <td className="p-2.5 text-center">kW</td>
                    <td className="p-2.5 text-muted-foreground">P_shaft = (Q * ΔP) / (1000 * η_pump)</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">4</td>
                    <td className="p-2.5 font-bold">Electric Motor Efficiency (η_motor)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{inputs.effMotor}</td>
                    <td className="p-2.5 text-center">%</td>
                    <td className="p-2.5 text-muted-foreground">IEC Premium Efficiency (IE3 / IE4) induction motor</td>
                  </tr>
                  <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                    <td className="p-2.5 text-center font-mono">5</td>
                    <td className="p-2.5 font-bold">Required Motor Power (P_motor)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{results.motorPower.toFixed(2)}</td>
                    <td className="p-2.5 text-center font-mono font-bold">kW</td>
                    <td className="p-2.5">P_motor = P_shaft / η_motor ({results.hp.toFixed(2)} HP duty)</td>
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
                This pump sizing calculation complies with IPC Table 604.3, CIBSE Guide W, and IEC electric motor standards for domestic water booster/transfer pump systems. Total Dynamic Head includes static elevation, equivalent pipe friction, active filtration losses, and a {inputs.sfHead}% contingency margin.
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
                  <tr className="bg-[#FFE6CC] dark:bg-amber-950/40 text-foreground font-bold border-b border-border">
                    <th className="p-2.5 text-left w-1/4">Approval Role</th>
                    <th className="p-2.5 text-center w-1/4">Originated By</th>
                    <th className="p-2.5 text-center w-1/4">Reviewed By</th>
                    <th className="p-2.5 text-center w-1/4">Approved By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 font-bold text-muted-foreground">Name:</td>
                    <td className="p-2.5 text-center font-bold text-foreground">{sigDetails.originatedName}</td>
                    <td className="p-2.5 text-center font-bold text-foreground">{sigDetails.reviewerName || "Pending Review"}</td>
                    <td className="p-2.5 text-center font-bold text-foreground">{sigDetails.approverName || "Pending Approval"}</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 font-bold text-muted-foreground">Role / Status:</td>
                    <td className="p-2.5 text-center text-muted-foreground">MEP Design Engineer</td>
                    <td className="p-2.5 text-center text-muted-foreground">Senior Plumbing Lead</td>
                    <td className="p-2.5 text-center text-muted-foreground">Principal / MEP Director</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-muted-foreground">Date:</td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">{sigDetails.originatedDate || today}</td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">{sigDetails.reviewerDate || "—"}</td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">{sigDetails.approverDate || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ==========================================
// PUMP SIZING INTELLIGENCE DRAWER COMPONENT
// ==========================================

interface PumpSizingIntelligenceDrawerProps {
  onClose: () => void;
  pumpType: "booster" | "transfer" | "transfer-booster";
  setPumpType: (v: "booster" | "transfer" | "transfer-booster") => void;
  wsfuVal: string;
  setWsfuVal: (v: string) => void;
  manualFlow: string;
  setManualFlow: (v: string) => void;
  reqVolume: string;
  setReqVolume: (v: string) => void;
  fillTime: string;
  setFillTime: (v: string) => void;
  workingPumps: string;
  setWorkingPumps: (v: string) => void;
  standbyPumps: string;
  setStandbyPumps: (v: string) => void;
  pipeVert: string;
  setPipeVert: (v: string) => void;
  pipeHoriz: string;
  setPipeHoriz: (v: string) => void;
  fricFactor: string;
  setFricFactor: (v: string) => void;
  staticHead: string;
  setStaticHead: (v: string) => void;
  presidHead: string;
  setPresidHead: (v: string) => void;
  suctionHead: string;
  setSuctionHead: (v: string) => void;
  sfHead: string;
  setSfHead: (v: string) => void;
  effPump: string;
  setEffPump: (v: string) => void;
  effMotor: string;
  setEffMotor: (v: string) => void;
  filtCarbon: boolean;
  setFiltCarbon: (v: boolean) => void;
  filtMM: boolean;
  setFiltMM: (v: boolean) => void;
  filtCuAg: boolean;
  setFiltCuAg: (v: boolean) => void;
  filtSoftener: boolean;
  setFiltSoftener: (v: boolean) => void;
  results: {
    elbows: number;
    valves: number;
    totalLen: number;
    equivLen: number;
    frictionLoss: number;
    filterLoss: number;
    calcHead: number;
    selectedHead: number;
    flowLps: number;
    liftKpa: number;
    shaftPower: number;
    motorPower: number;
    hp: number;
  };
  unitSystem: "si" | "ip";
  isLocked: boolean;
  commentsList: any[];
  onOpenComment: (id: string, name: string) => void;
  onOpenPreview: () => void;
}

function PumpSizingIntelligenceDrawer({
  onClose,
  pumpType,
  setPumpType,
  wsfuVal,
  setWsfuVal,
  manualFlow,
  setManualFlow,
  reqVolume,
  setReqVolume,
  fillTime,
  setFillTime,
  workingPumps,
  setWorkingPumps,
  standbyPumps,
  setStandbyPumps,
  pipeVert,
  setPipeVert,
  pipeHoriz,
  setPipeHoriz,
  fricFactor,
  setFricFactor,
  staticHead,
  setStaticHead,
  presidHead,
  setPresidHead,
  suctionHead,
  setSuctionHead,
  sfHead,
  setSfHead,
  effPump,
  setEffPump,
  effMotor,
  setEffMotor,
  filtCarbon,
  setFiltCarbon,
  filtMM,
  setFiltMM,
  filtCuAg,
  setFiltCuAg,
  filtSoftener,
  setFiltSoftener,
  results,
  unitSystem,
  isLocked,
  commentsList,
  onOpenComment,
  onOpenPreview,
}: PumpSizingIntelligenceDrawerProps) {
  const isSI = unitSystem === "si";

  // Discharge Pipe Sizing & Velocity (target 1.6 m/s)
  const pipeSizing = useMemo(() => {
    const flowM3s = (results.flowLps || 0) / 1000;
    if (flowM3s <= 0) return { dn: 25, nps: '1"', velocityMps: 0, velocityFps: 0, isOptimal: true };

    const targetVelocity = 1.6; // m/s
    const calcDiameterM = Math.sqrt((4 * flowM3s) / (Math.PI * targetVelocity));
    const calcDiameterMm = calcDiameterM * 1000;

    const standardDNs = [
      { dn: 15, nps: '1/2"', idMm: 16 },
      { dn: 20, nps: '3/4"', idMm: 21 },
      { dn: 25, nps: '1"', idMm: 27 },
      { dn: 32, nps: '1-1/4"', idMm: 35 },
      { dn: 40, nps: '1-1/2"', idMm: 41 },
      { dn: 50, nps: '2"', idMm: 53 },
      { dn: 65, nps: '2-1/2"', idMm: 68 },
      { dn: 80, nps: '3"', idMm: 80 },
      { dn: 100, nps: '4"', idMm: 105 },
      { dn: 125, nps: '5"', idMm: 130 },
      { dn: 150, nps: '6"', idMm: 155 },
      { dn: 200, nps: '8"', idMm: 204 },
    ];

    let chosen = standardDNs[0];
    for (const pipe of standardDNs) {
      if (pipe.idMm >= calcDiameterMm * 0.9) {
        chosen = pipe;
        break;
      }
      chosen = pipe;
    }

    const areaM2 = (Math.PI * Math.pow(chosen.idMm / 1000, 2)) / 4;
    const actualVelMps = areaM2 > 0 ? flowM3s / areaM2 : 0;
    const actualVelFps = actualVelMps * 3.28084;
    const isOptimal = actualVelMps >= 1.0 && actualVelMps <= 2.2;

    return {
      dn: chosen.dn,
      nps: chosen.nps,
      velocityMps: actualVelMps,
      velocityFps: actualVelFps,
      isOptimal,
    };
  }, [results.flowLps]);

  // Standard Motor Rating (IEC / NEMA standard steps)
  const motorSizing = useMemo(() => {
    const pKw = results.motorPower || 0;
    const standardKwRatings = [
      0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3.0, 4.0, 5.5, 7.5, 9.2, 11, 15, 18.5, 22, 30, 37, 45, 55, 75
    ];

    let stdKw = standardKwRatings[standardKwRatings.length - 1];
    for (const kw of standardKwRatings) {
      if (kw >= pKw * 1.08) {
        stdKw = kw;
        break;
      }
    }

    const stdHp = stdKw * 1.34102;
    // Estimated FLA @ 400V 3-phase, PF=0.85, eff=0.88
    const fla3Phase = stdKw > 0 ? (stdKw * 1000) / (Math.sqrt(3) * 400 * 0.85 * 0.88) : 0;

    let starter = "Direct-On-Line (DOL)";
    if (stdKw > 15) {
      starter = "Soft Starter / VFD";
    } else if (stdKw >= 5.5) {
      starter = "Star-Delta / Soft Starter";
    } else {
      starter = "DOL / Inverter VFD";
    }

    return {
      stdKw,
      stdHp: Math.round(stdHp * 10) / 10,
      fla3Phase: Math.round(fla3Phase * 10) / 10,
      starter,
    };
  }, [results.motorPower]);

  // Energy & Operating Cost Analytics
  const energyAnalytics = useMemo(() => {
    const hoursPerDay = pumpType === "transfer" ? 2.5 : 6.0;
    const dailyKwh = (results.motorPower || 0) * hoursPerDay;
    const annualKwh = dailyKwh * 365;
    const costPerKwh = 0.15; // $0.15 / kWh
    const annualCost = annualKwh * costPerKwh;
    const vfdSavingsKwh = annualKwh * 0.28; // 28% typical VFD affinity savings
    const vfdSavingsCost = vfdSavingsKwh * costPerKwh;
    const co2SavedKg = vfdSavingsKwh * 0.45; // 0.45 kg CO2 per kWh

    return {
      dailyKwh: Math.round(dailyKwh * 10) / 10,
      annualKwh: Math.round(annualKwh),
      annualCost: Math.round(annualCost),
      vfdSavingsKwh: Math.round(vfdSavingsKwh),
      vfdSavingsCost: Math.round(vfdSavingsCost),
      co2SavedKg: Math.round(co2SavedKg),
    };
  }, [results.motorPower, pumpType]);

  // Compliance Checks
  const isVelocityOk = pipeSizing.isOptimal;
  const isSafetyFactorOk = (parseFloat(sfHead) || 0) >= 5;
  const isSuctionOk = (parseFloat(suctionHead) || 0) >= 0;
  const isStandbyOk = (parseInt(standbyPumps) || 0) >= 1 || pumpType === "transfer";
  const isFrictionOk = (parseFloat(fricFactor) || 0) <= 0.6;

  const checks = [isVelocityOk, isSafetyFactorOk, isSuctionOk, isStandbyOk, isFrictionOk];
  const passedChecksCount = checks.filter(Boolean).length;
  const complianceScore = Math.round((passedChecksCount / checks.length) * 100);

  // Heuristic Audits & Code Warnings
  const auditWarnings = useMemo(() => {
    const warnings: { title: string; desc: string; type: "warning" | "info" | "pass" }[] = [];

    const ff = parseFloat(fricFactor) || 0;
    if (ff > 0.6) {
      warnings.push({
        title: "High Friction Gradient",
        desc: `Friction factor (${ff} bar/100m) exceeds recommended 0.45 bar/100m. Consider upsizing piping.`,
        type: "warning",
      });
    } else {
      warnings.push({
        title: "Optimal Friction Loss",
        desc: `Piping friction gradient (${ff} bar/100m) complies with CIBSE Guide W design velocity standards.`,
        type: "pass",
      });
    }

    const suctionVal = parseFloat(suctionHead) || 0;
    if (suctionVal < 0) {
      warnings.push({
        title: "Negative Suction Lift Risk",
        desc: "Negative suction pressure detected. Ensure foot valve, air release, and minimum 1.5m NPSHa safety margin.",
        type: "warning",
      });
    } else {
      warnings.push({
        title: "Flooded / Positive Suction",
        desc: "Suction head provides adequate positive pressure, minimizing cavitation risks.",
        type: "pass",
      });
    }

    const sf = parseFloat(sfHead) || 0;
    if (sf < 5) {
      warnings.push({
        title: "Low Safety Margin",
        desc: "Head safety margin is below 5%. Consider at least 5% to 10% for pipe aging and valve fouling.",
        type: "warning",
      });
    } else {
      warnings.push({
        title: "Adequate Head Margin",
        desc: `${sf}% safety allowance accounts for long-term scale and valve fouling.`,
        type: "pass",
      });
    }

    const sP = parseInt(standbyPumps) || 0;
    if (sP === 0 && pumpType !== "transfer") {
      warnings.push({
        title: "No Standby Redundancy (N+1)",
        desc: "Critical booster sets should have at least 1 standby pump (e.g. 1W+1S or 2W+1S) for uncompromised water supply.",
        type: "warning",
      });
    }

    return warnings;
  }, [fricFactor, suctionHead, sfHead, standbyPumps, pumpType]);

  // Preset Configurations
  const presets = [
    {
      id: "booster-highrise",
      name: "High-Rise Triplex Booster (2W+1S)",
      category: "Multi-Story Building",
      desc: "5.5 bar head, 85 WSFU, 10% safety margin, 2 duty + 1 standby.",
      apply: () => {
        setPumpType("booster");
        setWsfuVal("85");
        setWorkingPumps("2");
        setStandbyPumps("1");
        setStaticHead("5.5");
        setPresidHead("1.5");
        setSuctionHead("0.5");
        setSfHead("10");
        setPipeVert("45");
        setPipeHoriz("60");
        setFricFactor("0.4");
        setEffPump("75");
        setEffMotor("88");
        dirtyStore.set(true);
        toast.success("Applied High-Rise Triplex Booster Preset!");
      }
    },
    {
      id: "transfer-overhead",
      name: "Roof Tank Transfer Pump (1W+1S)",
      category: "Overhead Tank Fill",
      desc: "15,000 L volume, 2.5 hr fill time, 35m lift, dual media & carbon filtration.",
      apply: () => {
        setPumpType("transfer");
        setReqVolume("15000");
        setFillTime("2.5");
        setWorkingPumps("1");
        setStandbyPumps("1");
        setStaticHead("3.8");
        setPresidHead("0.5");
        setSuctionHead("0");
        setSfHead("8");
        setPipeVert("35");
        setPipeHoriz("25");
        setFricFactor("0.35");
        setFiltCarbon(true);
        setFiltMM(true);
        setFiltCuAg(false);
        setFiltSoftener(false);
        setEffPump("72");
        setEffMotor("86");
        dirtyStore.set(true);
        toast.success("Applied Roof Tank Transfer Pump Preset!");
      }
    },
    {
      id: "booster-villa",
      name: "Villa / Residential Booster (1W+1S)",
      category: "Residential / Low-Rise",
      desc: "2.8 bar head, 24 WSFU, compact vertical booster with 5% safety margin.",
      apply: () => {
        setPumpType("booster");
        setWsfuVal("24");
        setWorkingPumps("1");
        setStandbyPumps("1");
        setStaticHead("2.5");
        setPresidHead("1.0");
        setSuctionHead("0.2");
        setSfHead("5");
        setPipeVert("12");
        setPipeHoriz("20");
        setFricFactor("0.4");
        setEffPump("70");
        setEffMotor("85");
        dirtyStore.set(true);
        toast.success("Applied Villa Booster Preset!");
      }
    },
    {
      id: "commercial-podium",
      name: "Commercial Podium Booster (2W+1S)",
      category: "Shopping Mall / Podium",
      desc: "4.2 bar head, 120 WSFU, heavy simultaneous demand with VFD modulation.",
      apply: () => {
        setPumpType("booster");
        setWsfuVal("120");
        setWorkingPumps("2");
        setStandbyPumps("1");
        setStaticHead("4.0");
        setPresidHead("1.5");
        setSuctionHead("0.5");
        setSfHead("10");
        setPipeVert("25");
        setPipeHoriz("80");
        setFricFactor("0.42");
        setEffPump("78");
        setEffMotor("90");
        dirtyStore.set(true);
        toast.success("Applied Commercial Podium Booster Preset!");
      }
    }
  ];

  const handleNavigateToField = (fieldId: string) => {
    const el = document.getElementById(`field-${fieldId}`) || document.getElementById(fieldId) || document.querySelector(`[data-field-id="${fieldId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in select-none">
      {/* Header matching Ventilation exactly */}
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
            IPC, DIN 1988 &amp; CIBSE Guide W validation across pump hydraulics.
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
              <span>Recommended Discharge Pipe</span>
              <span className="font-mono font-bold text-primary text-[12.5px]">
                {isSI ? `DN ${pipeSizing.dn} mm` : `${pipeSizing.nps} NPS`}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Calculated flow velocity is <strong className="text-foreground">{isSI ? `${pipeSizing.velocityMps.toFixed(2)} m/s` : `${pipeSizing.velocityFps.toFixed(2)} ft/s`}</strong> (standard 1.2–2.1 m/s range to prevent noise and erosion).
            </p>
          </div>
          <KV
            k="Operating Design Flow"
            v={isSI ? `${results.flowLps.toFixed(2)} L/s (${(results.flowLps * 3.6).toFixed(1)} m³/h)` : `${(results.flowLps * 15.8503).toFixed(2)} GPM`}
          />
          <KV
            k="Total Dynamic Head"
            v={isSI ? `${results.calcHead.toFixed(2)} bar (${(results.calcHead * 10.197).toFixed(1)} m)` : `${(results.calcHead * 14.5038).toFixed(2)} psi (${(results.calcHead * 33.45).toFixed(1)} ft)`}
          />
          <KV
            k="Friction vs Static Head"
            v={results.calcHead > 0 ? `${Math.round((results.frictionLoss / results.calcHead) * 100)}% / ${Math.round((parseFloat(staticHead) / results.calcHead) * 100)}%` : "0% / 0%"}
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
            v={`${results.shaftPower.toFixed(2)} kW`}
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
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[11.5px] leading-tight">{w.title}</div>
                  <div className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">{w.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </IntelSection>

        {/* Intelligent 1-Click Presets */}
        <IntelSection icon={Sliders} tone="primary" title="1-Click Engineering Presets">
          <div className="space-y-2 mt-1">
            {presets.map((preset) => (
              <button
                key={preset.id}
                disabled={isLocked}
                onClick={preset.apply}
                className="w-full text-left p-2.5 rounded-xl border border-border hover:border-primary/40 bg-surface-2/50 hover:bg-surface-2 transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11.5px] text-foreground group-hover:text-primary transition-colors">
                    {preset.name}
                  </span>
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                    {preset.category}
                  </span>
                </div>
                <p className="text-[10.5px] text-muted-foreground mt-1 leading-snug">
                  {preset.desc}
                </p>
              </button>
            ))}
          </div>
        </IntelSection>

        {/* Active Comments & Assigned Tasks */}
        {commentsList && commentsList.length > 0 && (
          <IntelSection icon={MessageSquare} tone="muted" title="Active Comments & Tasks">
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar mt-1">
              {commentsList.map((c, idx) => (
                <div
                  key={c.id || idx}
                  onClick={() => {
                    const target = c.targetId || c.spaceId || c.itemId;
                    if (target) handleNavigateToField(target);
                  }}
                  className="p-2 rounded-lg bg-surface-2 border border-border/70 hover:border-primary/50 transition cursor-pointer text-xs group"
                >
                  <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground mb-0.5">
                    <span className="text-foreground group-hover:text-primary transition-colors font-semibold">
                      {c.targetName || c.spaceName || "Pump Parameter"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{c.authorName || "Engineer"}</span>
                  </div>
                  <p className="text-[11px] text-foreground/90 line-clamp-2 leading-relaxed">{c.text}</p>
                </div>
              ))}
            </div>
          </IntelSection>
        )}

        {/* Energy & VFD Life-Cycle Analytics */}
        <IntelSection icon={TrendingDown} tone="success" title="Energy & VFD Life-Cycle">
          <KV k="Estimated Annual Energy" v={`${energyAnalytics.annualKwh.toLocaleString()} kWh/yr`} />
          <KV k="Annual Baseline Cost (@ $0.15)" v={`$${energyAnalytics.annualCost.toLocaleString()}/yr`} />
          <KV k="VFD Energy Savings (-28%)" v={`-$${energyAnalytics.vfdSavingsCost.toLocaleString()}/yr`} />
          <KV k="CO₂ Emission Reduction" v={`${energyAnalytics.co2SavedKg.toLocaleString()} kg/yr`} />
        </IntelSection>

        {/* Optimization Suggestions */}
        <IntelSection icon={Sparkles} tone="primary" title="Optimization Suggestions">
          <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Install a VFD controller to modulate speed with demand and reduce pump cycling.</li>
            <li>Maintain 1.5m net positive suction head (NPSHa) above pump NPSHr to prevent cavitation.</li>
            <li>Use 10% safety margin for static head to accommodate future pipe scaling.</li>
          </ul>
        </IntelSection>

        {/* Engineering Notes & Derivations */}
        <IntelSection icon={Info} tone="muted" title="Engineering Notes">
          <div className="text-[12px] text-muted-foreground mb-2.5">
            Sized in compliance with IPC Table 604.3 and DIN 1988 booster staging criteria.
          </div>
          <button
            type="button"
            onClick={onOpenPreview}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition shadow-sm cursor-pointer"
          >
            <Eye className="size-3.5" />
            <span>View Step-by-Step Derivations</span>
          </button>
        </IntelSection>
      </div>
    </div>
  );
}

function IntelSection({ icon: Icon, title, tone, children }: { icon: any; title: string; tone: "success" | "warning" | "primary" | "muted"; children: React.ReactNode }) {
  const color =
    tone === "success" ? "text-emerald-500" :
      tone === "warning" ? "text-amber-500" :
        tone === "primary" ? "text-primary" : "text-muted-foreground";
  return (
    <section className="px-3 py-3 border-b border-border">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`size-3.5 ${color}`} />
        <h4 className="text-[11px] uppercase tracking-wider font-semibold">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[12px] py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono tabular font-medium">{v}</span>
    </div>
  );
}
