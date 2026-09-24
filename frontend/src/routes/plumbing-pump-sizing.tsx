import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { Download, ChevronDown, ChevronRight, Save, Sparkles, Eye, MessageSquare } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { IP_FIXTURE_UNITS } from "./plumbing-fixture-unit";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  StandardCalculatorLayout,
  useCalculatorFramework,
  CalculationPreviewData,
} from "@/components/calculator-framework";

const ipcTable = [
  { wsfu: 0, gpm: 0 },
  { wsfu: 1, gpm: 3 },
  { wsfu: 2, gpm: 5 },
  { wsfu: 3, gpm: 6.5 },
  { wsfu: 5, gpm: 9.4 },
  { wsfu: 10, gpm: 14.6 },
  { wsfu: 15, gpm: 17.5 },
  { wsfu: 20, gpm: 19.6 },
  { wsfu: 25, gpm: 21.5 },
  { wsfu: 30, gpm: 23.3 },
  { wsfu: 40, gpm: 26.3 },
  { wsfu: 50, gpm: 29.1 },
  { wsfu: 60, gpm: 32 },
  { wsfu: 70, gpm: 35 },
  { wsfu: 80, gpm: 38 },
  { wsfu: 90, gpm: 41 },
  { wsfu: 100, gpm: 43.5 },
  { wsfu: 120, gpm: 48 },
  { wsfu: 140, gpm: 52.5 },
  { wsfu: 160, gpm: 57 },
  { wsfu: 180, gpm: 61 },
  { wsfu: 200, gpm: 65 },
  { wsfu: 225, gpm: 70 },
  { wsfu: 250, gpm: 75 },
  { wsfu: 275, gpm: 80 },
  { wsfu: 300, gpm: 85 },
  { wsfu: 400, gpm: 105 },
  { wsfu: 500, gpm: 124 },
  { wsfu: 750, gpm: 170 },
  { wsfu: 1000, gpm: 208 },
  { wsfu: 1250, gpm: 239 },
  { wsfu: 1500, gpm: 269 },
  { wsfu: 1750, gpm: 297 },
  { wsfu: 2000, gpm: 325 },
  { wsfu: 2500, gpm: 380 },
  { wsfu: 3000, gpm: 433 },
  { wsfu: 4000, gpm: 525 },
  { wsfu: 5000, gpm: 593 }
];

function wsfuToGPM(wsfu: number) {
  let val = Math.max(0, Math.min(wsfu, 5000));
  for (let i = 0; i < ipcTable.length; i++) {
    if (ipcTable[i].wsfu === val) return ipcTable[i].gpm;
  }
  for (let i = 0; i < ipcTable.length - 1; i++) {
    const lower = ipcTable[i];
    const upper = ipcTable[i + 1];
    if (val > lower.wsfu && val < upper.wsfu) {
      const ratio = (val - lower.wsfu) / (upper.wsfu - lower.wsfu);
      return lower.gpm + ratio * (upper.gpm - lower.gpm);
    }
  }
  return 0;
}

function wsfuToLPS(wsfu: number) {
  return wsfuToGPM(wsfu) * 0.06309;
}

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
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const { project, forceSaveToCloud } = useWorkspace();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Inputs
  const [pumpType, setPumpType] = useState<"booster" | "transfer" | "transfer-booster">("booster");
  const [wsfuVal, setWsfuVal] = useState<string>("21.6");
  const [manualFlow, setManualFlow] = useState<string>("1.3");
  
  // Transfer pump specifics
  const [reqVolume, setReqVolume] = useState<string>("5000");
  const [fillTime, setFillTime] = useState<string>("2");
  
  // Pumps count
  const [workingPumps, setWorkingPumps] = useState<string>("1");
  const [standbyPumps, setStandbyPumps] = useState<string>("-");
  
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
  const [expandDetails, setExpandDetails] = useState<boolean>(false);
  const [expandAssumptions, setExpandAssumptions] = useState<boolean>(false);
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
      const cleanName = (targetName || "").toLowerCase().trim();

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
      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenComment(id, name); }}
        className="ml-2 inline-flex items-center justify-center size-4 bg-primary text-primary-foreground rounded-full text-[9px] font-bold shadow-sm"
      >
        {unresolvedCount}
      </button>
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
    const vert = parseFloat(pipeVert) || 0;
    const horiz = parseFloat(pipeHoriz) || 0;
    const ff = parseFloat(fricFactor) || 0.4;
    
    const elbows = (vert + horiz) * 0.3;
    const valves = (vert + horiz) * 0.3;
    const L_sum = vert + horiz + elbows + valves;
    const equivLen = Math.ceil((L_sum * 1.05) / 10) * 10;
    const frictionLoss = equivLen * (ff / 100);
    
    let filterLoss = 0;
    if (pumpType === "transfer") {
      if (filtCarbon) filterLoss += 0.8;
      if (filtMM) filterLoss += 0.8;
      if (filtCuAg) filterLoss += 0.2;
      if (filtSoftener) filterLoss += 0.8;
    }
    
    const staticH = parseFloat(staticHead) || 0;
    const outletH = parseFloat(presidHead) || 0;
    const suctionH = parseFloat(suctionHead) || 0;
    const safetyMargin = (parseFloat(sfHead) || 0) / 100;
    
    const rawHead = Math.max(0, (frictionLoss + staticH + outletH) - suctionH) + filterLoss;
    const calcHead = rawHead * (1 + safetyMargin);
    const selHead = parseFloat(selectedHead) || calcHead;
    
    let flowLps = parseFloat(manualFlow) || 0;
    const wPumps = parseInt(workingPumps) || 1;
    
    if (pumpType === "booster" || pumpType === "transfer-booster") {
       const wsfu = parseFloat(wsfuVal) || 0;
       if (wsfu > 0) {
         flowLps = wsfuToLPS(wsfu) / Math.max(1, wPumps);
       }
    } else if (pumpType === "transfer") {
       const req = parseFloat(reqVolume) || 0;
       const time = parseFloat(fillTime) || 0;
       if (req > 0 && time > 0) {
         flowLps = req / (time * 3600);
       }
    }
    
    const liftKpa = selHead * 100;
    const pEff = (parseFloat(effPump) || 70) / 100;
    const mEff = (parseFloat(effMotor) || 85) / 100;
    
    const shaftPower = pEff > 0 ? (flowLps * liftKpa) / (1000 * pEff) : 0;
    const motorPower = mEff > 0 ? shaftPower / mEff : 0;
    const hp = motorPower * 1.34102;
    
    return {
      elbows,
      valves,
      totalLen: L_sum,
      equivLen,
      frictionLoss,
      filterLoss,
      calcHead,
      selectedHead: selHead,
      flowLps,
      liftKpa,
      shaftPower,
      motorPower,
      hp,
    };
  }, [
    pipeVert, pipeHoriz, fricFactor, pumpType, filtCarbon, filtMM, filtCuAg, filtSoftener,
    staticHead, presidHead, suctionHead, sfHead, selectedHead, manualFlow,
    effPump, effMotor, wsfuVal, reqVolume, fillTime, workingPumps
  ]);

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

  const handleExportPDF = () => {
    try {
      const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
      const doc = new JsPDFClass("portrait", "mm", "a4");

      const callAutoTable = (pdfDoc: any, options: any) => {
        if (typeof autoTable === "function") {
          autoTable(pdfDoc, options);
        } else if (typeof (autoTable as any)?.default === "function") {
          (autoTable as any).default(pdfDoc, options);
        } else if (typeof pdfDoc.autoTable === "function") {
          pdfDoc.autoTable(options);
        }
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(10, 123, 199);
      doc.text("PUMP SIZING CALCULATION REPORT", 14, 18);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Project: ${project?.name || "General Project"} | Date: ${new Date().toLocaleDateString()}`, 14, 24);

      const flowDisp = isSI ? `${results.flowLps.toFixed(2)} L/s` : `${(results.flowLps * 15.8503).toFixed(2)} GPM`;
      const headDisp = isSI ? `${results.calcHead.toFixed(2)} bar` : `${(results.calcHead * 14.5038).toFixed(2)} psi`;
      const staticDisp = isSI ? `${staticHead} bar` : `${staticHead} psi`;
      const vertDisp = isSI ? `${pipeVert} m` : `${pipeVert} ft`;
      const horizDisp = isSI ? `${pipeHoriz} m` : `${pipeHoriz} ft`;

      const tableData = [
        ["Pump Application Type", pumpType.toUpperCase()],
        ["Total Fixture Units (WSFU)", wsfuVal || "-"],
        ["Working / Standby Pumps", `${workingPumps} working / ${standbyPumps} standby`],
        ["Vertical / Horizontal Pipe Length", `${vertDisp} vert / ${horizDisp} horiz`],
        ["Major + Minor Friction Loss", isSI ? `${results.frictionLoss.toFixed(3)} bar` : `${(results.frictionLoss * 14.5038).toFixed(3)} psi`],
        ["Static Head", staticDisp],
        ["DESIGN FLOW RATE", flowDisp],
        ["CALCULATED DYNAMIC HEAD", headDisp],
        ["REQUIRED MOTOR POWER", `${results.motorPower.toFixed(2)} kW (${results.hp.toFixed(2)} HP)`],
      ];

      callAutoTable(doc, {
        startY: 30,
        head: [["Metric / Parameter", "Value"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [10, 123, 199], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 9.5, cellPadding: 3.5 },
      });

      const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 120;
      addPdfSignatureBlock(doc, finalY, currentUserName, project?.id || "default", "plumbing-pump-sizing");

      doc.save(`Pump_Sizing_${Date.now()}.pdf`);
      toast.success("PDF Report generated successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF report.");
    }
  };

  const inputClass = "w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono focus:outline-none focus:border-primary disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";
  const flowInputClass = "w-full h-9 px-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:border-[#0A7BC7] disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";
  const pumpTypeBtnClass = (t: string) => `flex-1 px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer text-center ${
    pumpType === t
      ? "bg-background text-foreground shadow-sm font-bold"
      : "text-muted-foreground hover:text-foreground"
  }`;
  const pumpTypeContainerClass = "flex bg-slate-100/80 dark:bg-zinc-800/80 p-1 rounded-full gap-1 border border-slate-200 dark:border-zinc-700/80";

  return (
    <AppShell
      title="Pump Sizing Calculator"
      subtitle="Transfer & Booster Pump Duty Sizing"
      actions={
        <div className="flex items-center gap-2">
          <UnitToggle unitSystem={unitSystem} onChange={handleUnitToggle} />
        </div>
      }
    >
      <StandardCalculatorLayout
        calculatorPath="/plumbing-pump-sizing"
        title="Domestic Water Pump Sizing"
        subtitle="Calculates booster & transfer pump capacity, dynamic head, friction loss, and motor rating."
        icon={Sparkles}
        summaryPills={[
          { label: "Flow Rate", value: isSI ? results.flowLps.toFixed(2) : (results.flowLps * 15.8503).toFixed(2), unit: isSI ? "L/s" : "GPM", variant: "primary" },
          { label: "Calculated Head", value: isSI ? results.calcHead.toFixed(2) : (results.calcHead * 14.5038).toFixed(2), unit: isSI ? "bar" : "psi", variant: "warning" },
          { label: "Motor Power", value: results.motorPower.toFixed(2), unit: "kW", variant: "success" },
          { label: "Horsepower", value: results.hp.toFixed(2), unit: "HP" },
        ]}
        rows={[]}
        columns={[]}
        selectedIds={framework.selected}
        onToggle={framework.toggle}
        onToggleAll={framework.toggleAll}
        onClearSelection={framework.clearSelection}
        isReadOnly={framework.isReadOnly}
        onImport={handleImportWSFU}
        importLabel="Import WSFU"
        getCalculationPreview={() => calculationPreviewData}
        previewData={framework.previewData}
        isPreviewOpen={framework.isPreviewOpen}
        onClosePreviewModal={framework.closePreviewModal}
        commentTarget={commentTargetItem}
        isCommentOpen={commentModalOpen}
        onCloseCommentModal={() => setCommentModalOpen(false)}
        onSaveComment={handleSaveComment}
        hideHeader={true}
        hideReviewBar={true}
        customToolbarActions={null}
      >
        {/* Top Tabs Bar (Pump Application Type) */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div 
              id="field-pumpType" 
              data-field-id="pumpType" 
              data-comment-target="pumpType"
              className={`flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/50 transition-colors ${isFieldHighlighted("pumpType", "Pump Application Type")}`}
            >
              <div className="flex items-center gap-3">
                <div className={pumpTypeContainerClass}>
                  {(["booster", "transfer", "transfer-booster"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setPumpType(t)}
                      className={pumpTypeBtnClass(t)}
                    >
                      {t === "booster" ? "Booster" : t === "transfer" ? "Transfer" : "Both"}
                    </button>
                  ))}
                </div>
                {renderCommentBadge("pumpType", "Pump Application Type")}
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-64 font-sans">
            <ContextMenuItem onClick={() => setPumpType("booster")} className="text-xs cursor-pointer">
              Reset to Booster
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => handleOpenComment("pumpType", "Pump Application Type")} className="text-xs cursor-pointer text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2">
              <MessageSquare className="size-3.5" />
              Add Comment / Assign Task
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Pump Sizing Parameter Inputs and Calculation Breakdown Grid */}
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
                  <ContextMenuContent className="w-64 font-sans">
                    <ContextMenuItem onClick={() => { setWsfuVal("21.6"); setReqVolume("1000"); setFillTime("2"); }} className="text-xs cursor-pointer">
                      Reset Flow Parameters
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => handleOpenComment("flowParams", "Flow Parameters")} className="text-xs cursor-pointer text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2">
                      <MessageSquare className="size-3.5" />
                      Add Comment / Assign Task
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
                  <ContextMenuContent className="w-64 font-sans">
                    <ContextMenuItem onClick={() => { setPipeVert("20"); setPipeHoriz("50"); setFricFactor("0.4"); }} className="text-xs cursor-pointer">
                      Reset Piping Parameters
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => handleOpenComment("pipingParams", "Piping & Friction")} className="text-xs cursor-pointer text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2">
                      <MessageSquare className="size-3.5" />
                      Add Comment / Assign Task
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
                  <ContextMenuContent className="w-64 font-sans">
                    <ContextMenuItem onClick={() => { setStaticHead("5.0"); setPresidHead("1.0"); }} className="text-xs cursor-pointer">
                      Reset Head & Pressures
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => handleOpenComment("headParams", "Head & Pressures")} className="text-xs cursor-pointer text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2">
                      <MessageSquare className="size-3.5" />
                      Add Comment / Assign Task
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
                  <ContextMenuContent className="w-64 font-sans">
                    <ContextMenuItem onClick={() => { setEffPump("70"); setEffMotor("85"); }} className="text-xs cursor-pointer">
                      Reset Efficiency Ratings
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => handleOpenComment("efficiencyParams", "Efficiency Ratings")} className="text-xs cursor-pointer text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2">
                      <MessageSquare className="size-3.5" />
                      Add Comment / Assign Task
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </div>
            </div>

            {/* RIGHT COLUMN: CALCULATION RESULTS (lg:col-span-7) */}
            <div className="lg:col-span-7 space-y-5">
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => framework.openPreviewModal(calculationPreviewData)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold rounded-full border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer shadow-xs"
                        >
                          <Eye className="size-3.5 text-primary" /> Preview
                        </button>
                        <button
                          onClick={handleExportPDF}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold rounded-full border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer shadow-xs"
                        >
                          <Download className="size-3.5 text-primary" /> PDF
                        </button>
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
                <ContextMenuContent className="w-64 font-sans">
                  <ContextMenuItem onClick={() => handleOpenComment("card-hero-results", "Sizing Results Summary")} className="text-xs cursor-pointer text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2">
                    <MessageSquare className="size-3.5" />
                    Add Comment / Assign Task
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>
          </div>
        </div>
      </StandardCalculatorLayout>
    </AppShell>
  );
}
