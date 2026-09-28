import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { notifyCommentAssigned, dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, X, HelpCircle,
  MessageSquare, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw,
  Trash2, Edit3, Lock, Droplets, Waves, Gauge, Clock, ShieldCheck, Layers,
  ArrowRight, Download, Save, Zap, Cylinder, ArrowUpRight, ChevronDown, ChevronRight, Lightbulb,
  Home, Building2, Utensils, Factory, SlidersHorizontal, Building, ArrowDown, Settings
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
import { toast } from "sonner";
import { TBtn } from "@/components/workspace/Button";

export const Route = createFileRoute("/plumbing-sump-pump")({
  head: () => ({
    meta: [
      { title: "Sump Pump Sizing Calculator — MEP Calc" },
      { name: "description", content: "Calculate sump pit volume, flow, head, and motor requirements." },
    ],
  }),
  component: SumpPumpPage,
});

const GPM_TO_LPS = 0.0630902;
const FT_TO_M = 0.3048;
const IN_TO_MM = 25.4;
const GAL_TO_M3 = 0.00378541;
const GAL_TO_L = 3.78541;
const HP_TO_KW = 0.7457;
const PSI_TO_BAR = 0.0689476;

function SumpPumpPage() {
  const { project, activeProjectId, isReadOnly, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-sump-pump", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-sump-pump", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const isApprovedLocked = useCalculationLock("/plumbing-sump-pump", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";

  

  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("si");
  const isSI = unitSystem === "si";

  // State: stored natively in SI
  const [req, setReq] = useState<number | "">(1000);
  const [time, setTime] = useState<number | "">(1);
  const [flow, setFlow] = useState<number | "">(0);

  const [pitFlow, setPitFlow] = useState<number | "">(5);
  const [pitHold, setPitHold] = useState<number | "">(5);
  const [longestPipe, setLongestPipe] = useState<number | "">(15);
  const [propSide, setPropSide] = useState<number | "">(2);

  const [pipeVert, setPipeVert] = useState<number | "">(5);
  const [pipeHoriz, setPipeHoriz] = useState<number | "">(20);
  const [fricFactor, setFricFactor] = useState<number | "">(0.4);

  const [staticHead, setStaticHead] = useState<number | "">(5);
  const [presid, setPresid] = useState<number | "">(1);
  const [suction, setSuction] = useState<number | "">(0);
  const [sfHead, setSfHead] = useState<number | "">(10);
  
  const [selectedHead, setSelectedHead] = useState<number | "">(0);
  const [effMotor, setEffMotor] = useState<number | "">(85);
  const [effPump, setEffPump] = useState<number | "">(70);

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!project?.id) return;
    if (loadedProjectId === project.id) return;

    const pKey = `mep_sump_pump_params_${project.id}`;
    const stored = localStorage.getItem(pKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.req !== undefined) setReq(parsed.req);
        if (parsed.time !== undefined) setTime(parsed.time);
        if (parsed.flow !== undefined) setFlow(parsed.flow);
        if (parsed.pitFlow !== undefined) setPitFlow(parsed.pitFlow);
        if (parsed.pitHold !== undefined) setPitHold(parsed.pitHold);
        if (parsed.longestPipe !== undefined) setLongestPipe(parsed.longestPipe);
        if (parsed.propSide !== undefined) setPropSide(parsed.propSide);
        if (parsed.pipeVert !== undefined) setPipeVert(parsed.pipeVert);
        if (parsed.pipeHoriz !== undefined) setPipeHoriz(parsed.pipeHoriz);
        if (parsed.fricFactor !== undefined) setFricFactor(parsed.fricFactor);
        if (parsed.staticHead !== undefined) setStaticHead(parsed.staticHead);
        if (parsed.presid !== undefined) setPresid(parsed.presid);
        if (parsed.suction !== undefined) setSuction(parsed.suction);
        if (parsed.sfHead !== undefined) setSfHead(parsed.sfHead);
        if (parsed.selectedHead !== undefined) setSelectedHead(parsed.selectedHead);
        if (parsed.effMotor !== undefined) setEffMotor(parsed.effMotor);
        if (parsed.effPump !== undefined) setEffPump(parsed.effPump);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      } catch (e) {
        console.error("Failed to parse", e);
      }
    }
    setLoadedProjectId(project.id);
  }, [project?.id, loadedProjectId]);

  useEffect(() => {
    if (!project?.id || loadedProjectId !== project.id) return;
    const dataToSave = {
      req, time, flow, pitFlow, pitHold, longestPipe, propSide, pipeVert, pipeHoriz,
      fricFactor, staticHead, presid, suction, sfHead, selectedHead, effMotor, effPump, unitSystem,
      updatedAt: new Date().toISOString(),
    };
    const pKey = `mep_sump_pump_params_${project.id}`;
    localStorage.setItem(pKey, JSON.stringify(dataToSave));
    localStorage.setItem("mep_sump_pump_params", JSON.stringify(dataToSave));
  }, [project?.id, loadedProjectId, req, time, flow, pitFlow, pitHold, longestPipe, propSide, pipeVert, pipeHoriz, fricFactor, staticHead, presid, suction, sfHead, selectedHead, effMotor, effPump, unitSystem]);

  // Comment logic
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [formulaModalOpen, setFormulaModalOpen] = useState<boolean>(false);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/plumbing-sump-pump`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setCommentsList(parsed);
      }
    } catch (e) {}
  }, [project?.id]);

  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();
      const cleanRaw = cleanId.replace(/^(field-|card-|res-)/, "");
      const el = document.getElementById(targetId || "") || document.getElementById(`card-${cleanRaw}`);
      setHighlightedTargetId(cleanRaw || cleanId || targetId || null);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => { setHighlightedTargetId(null); }, 2500);
      if (el) setTimeout(() => { el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 120);
    };
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("commentTargetId") || params.get("commentTargetName")) {
        setTimeout(() => handleScrollTarget(params.get("commentTargetId") || undefined, params.get("commentTargetName") || undefined), 300);
      }
    }
    const handleScrollEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) handleScrollTarget(detail.id || detail.targetId, detail.name || detail.targetName);
    };
    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    return () => window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
  }, []);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/plumbing-sump-pump`, JSON.stringify(newList));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("storage"));
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (commentData: any) => {
    const targetId = commentTargetItem?.id || commentData?.targetId;
    const targetName = commentTargetItem?.name || commentData?.targetName;
    const commentWithMeta = {
      ...commentData, targetId, targetName, spaceId: targetId, spaceName: targetName, itemId: targetId,
      targetType: "Sump Pump Parameter", calculatorTitle: "Sump Pump Sizing", calculatorPath: "/plumbing-sump-pump",
      projectId: project?.id || "default", projectName: project?.name || "Sump Pump Sizing",
    };
    const updated = [commentWithMeta, ...commentsList.filter((c) => c.id !== commentData.id)];
    saveComments(updated);
    
    dispatchGlobalCommentNotification(commentWithMeta, { project });
    
    toast.success(`Comment assigned on "${targetName}"`);
    setCommentModalOpen(false);
  };

  const getItemComments = (id: string) => {
    if (!id) return [];
    const clean = id.toLowerCase().trim().replace(/^(field-|card-)/, "");
    return commentsList.filter((c) => {
      const tId = String(c.targetId || c.spaceId || c.itemId || c.id || "").toLowerCase().trim().replace(/^(field-|card-)/, "");
      return tId === clean;
    });
  };

  const isFieldHighlighted = (id: string) => {
    if (!highlightedTargetId) return false;
    const cleanHighlight = highlightedTargetId.toLowerCase().trim().replace(/^(field-|card-)/, "");
    const cleanId = id.toLowerCase().trim().replace(/^(field-|card-)/, "");
    return cleanHighlight === cleanId;
  };

  const renderCommentBadge = (id: string, name: string) => {
    const itemComments = getItemComments(id);
    if (itemComments.length === 0) return null;
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); handleOpenComment(id, name); }}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[10px] shadow-2xs hover:bg-blue-200 ml-2"
      >
        <MessageSquare className="size-3" /> <span>{itemComments.length}</span>
      </button>
    );
  };

  // Calculations
  const calcResults = useMemo(() => {
    const r = typeof req === "number" ? req : 0;
    const t = typeof time === "number" ? time : 0;
    const f = typeof flow === "number" ? flow : 0;
    const pf = typeof pitFlow === "number" ? pitFlow : 0;
    const ph = typeof pitHold === "number" ? pitHold : 0;
    const lp = typeof longestPipe === "number" ? longestPipe : 0;
    const ps = typeof propSide === "number" ? propSide : 0;
    const pv = typeof pipeVert === "number" ? pipeVert : 0;
    const phz = typeof pipeHoriz === "number" ? pipeHoriz : 0;
    const ff = typeof fricFactor === "number" ? fricFactor : 0;
    const sh = typeof staticHead === "number" ? staticHead : 0;
    const pr = typeof presid === "number" ? presid : 0;
    const suc = typeof suction === "number" ? suction : 0;
    const sfH = typeof sfHead === "number" ? sfHead : 0;
    const eP = typeof effPump === "number" ? effPump : 70;
    const eM = typeof effMotor === "number" ? effMotor : 85;

    const Q_flow = (f > 0) ? f : ((r > 0 && t > 0) ? r / (t * 3600) : 0);
    const pitVol = (pf * ph * 60) / 1000;
    const invertVal = lp > 0 ? (Math.ceil((lp / 90) * 100) / 100) + 0.16 : 0;
    
    let propDepth = 0;
    if (ps > 0) {
      const waterDepthRaw = pitVol / (ps * ps);
      const waterDepth = waterDepthRaw < 1.0 ? 1.0 : waterDepthRaw;
      propDepth = Math.ceil((waterDepth + invertVal + 0.25) * 100) / 100;
    }

    const L_elbows = (pv + phz) * 0.3;
    const L_valves = (pv + phz) * 0.3;
    const L_sum = pv + phz + L_elbows + L_valves;
    const L_equiv = Math.ceil((L_sum * 1.05) / 10) * 10;
    const H_loss = L_equiv * (ff / 100);

    const H_pump_calc = (Math.max(0, (H_loss + sh + pr) - suc)) * (1 + sfH / 100);
    const selHead = typeof selectedHead === "number" && selectedHead > 0 ? selectedHead : H_pump_calc;

    const P_shaft = (Q_flow * selHead * 100) / (1000 * (eP/100));
    const P_motor = P_shaft / (eM/100);
    const HP = P_motor * 1.34102;

    return { Q_flow, pitVol, invertVal, propDepth, pv, phz, ff, L_elbows, L_valves, L_sum, L_equiv, H_loss, H_pump_calc, selHead, P_motor, HP };
  }, [req, time, flow, pitFlow, pitHold, longestPipe, propSide, pipeVert, pipeHoriz, fricFactor, staticHead, presid, suction, sfHead, selectedHead, effPump, effMotor]);

  // View state handlers (IP/SI)
  const inputClass = `w-full bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-primary text-foreground disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-200/50 dark:disabled:bg-slate-900/50`;
  
  const handleUnitSystemChange = (next: "ip" | "si") => {
    if (isEffectiveReadOnly) return;
    setUnitSystem(next);
    dirtyStore.set(true);
  };

  const handleExport = () => {
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

      const calcNo = (project as any)?.calcNo || "TRV-CAL-SMP-01";
      const today = formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");
      const projectNo = project?.code || (project as any)?.projectNo || "P000";
      const projectName = project?.name || (project as any)?.projectName || "Sump Pump Station";
      const clientName = project?.client || "";
      const endUser = (project as any)?.endUser || (project as any)?.location || "";

      // Header Title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Sump Pump Sizing Calculation Report", 14, 13);

      // Metadata Block
      doc.setFontSize(8.5);
      doc.setLineWidth(0.3);
      doc.rect(14, 16, 182, 17); // Outer box for metadata
      doc.line(105, 16, 105, 33);
      doc.line(14, 21.7, 196, 21.7);
      doc.line(14, 27.4, 196, 27.4);

      doc.setFont("helvetica", "bold");
      doc.text("Calculation No.:", 16, 20.2);
      doc.setFont("helvetica", "normal");
      doc.text(calcNo, 45, 20.2);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", 107, 20.2);
      doc.setFont("helvetica", "normal");
      doc.text(today, 120, 20.2);

      doc.setFont("helvetica", "bold");
      doc.text("Project No.:", 16, 25.9);
      doc.setFont("helvetica", "normal");
      doc.text(projectNo, 45, 25.9);

      doc.setFont("helvetica", "bold");
      doc.text("Project Name:", 107, 25.9);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, 127, 25.9);

      doc.setFont("helvetica", "bold");
      doc.text("Client:", 16, 31.6);
      doc.setFont("helvetica", "normal");
      doc.text(clientName, 35, 31.6);

      doc.setFont("helvetica", "bold");
      doc.text("End User / Loc.:", 107, 31.6);
      doc.setFont("helvetica", "normal");
      doc.text(endUser, 133, 31.6);

      // Parameters Table
      const GPM_TO_LPS = 0.06309;
      const PSI_TO_BAR = 0.0689476;
      const FT_TO_M = 0.3048;
      const GAL_TO_M3 = 0.00378541;
      const GAL_TO_L = 3.78541;

      const flow = isSI ? calcResults.Q_flow : calcResults.Q_flow / GPM_TO_LPS;
      const flowUnit = isSI ? "L/s" : "GPM";
      const pitV = isSI ? calcResults.pitVol : calcResults.pitVol / GAL_TO_M3;
      const pitVUnit = isSI ? "m³" : "Gal";
      const h_loss = isSI ? calcResults.H_loss : calcResults.H_loss / PSI_TO_BAR;
      const l_equiv = isSI ? calcResults.L_equiv : calcResults.L_equiv / FT_TO_M;
      const l_unit = isSI ? "m" : "ft";
      const tdh = isSI ? calcResults.H_pump_calc : calcResults.H_pump_calc / PSI_TO_BAR;
      const tdhUnit = isSI ? "bar" : "psi";

      const tableData = [
        ["Required Volume", isSI ? req : typeof req === "number" ? req / GAL_TO_L : "", isSI ? "L" : "Gal", "Input"],
        ["Drawdown Time", time, "Hrs", "Input"],
        ["Calculated Flow Rate", flow.toFixed(2), flowUnit, "Volume / Time"],
        ["Pit Storage Volume", pitV.toFixed(2), pitVUnit, "Pit Flow x Hold"],
        ["Total Equivalent Length", l_equiv.toFixed(2), l_unit, "Pipe + Fittings"],
        ["Friction Loss", h_loss.toFixed(3), tdhUnit, "Hazen Williams"],
        ["Total Dynamic Head (TDH)", tdh.toFixed(3), tdhUnit, "Static + Friction + Residual"],
        ["Motor Power", isSI ? calcResults.P_motor.toFixed(2) : calcResults.HP.toFixed(2), isSI ? "kW" : "HP", "Power Equation"]
      ];

      callAutoTable(doc, {
        startY: 38,
        head: [["Parameter", "Value", "Unit", "Source / Formula"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 8.5, textColor: 50 },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: "bold" },
          1: { cellWidth: 35, halign: "center", fontStyle: "bold", textColor: [0, 0, 0] },
          2: { cellWidth: 25, halign: "center" },
          3: { cellWidth: "auto" }
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        styles: { cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.1 }
      });

      // 3-Tier Signature Block
      try {
        const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 180;
        const currentUserName = userData?.name || profile?.name || "System Admin";
        
        const {
          originatedName,
          originatedDate,
          reviewerName,
          reviewerDate,
          approverName,
          approverDate
        } = getSignatureBlockDetails(project?.id || "default", "/plumbing-sump-pump", currentUserName);

        const signatureFill: [number, number, number] = [255, 230, 204];

        callAutoTable(doc, {
          startY: finalY + 5,
          margin: { left: 14, right: 14 },
          theme: "grid",
          pageBreak: "avoid",
          styles: {
            fontSize: 7.2,
            halign: "center",
            valign: "middle",
            lineColor: [100, 100, 100],
            lineWidth: 0.1,
            cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
            minCellHeight: 5
          },
          headStyles: {
            fillColor: signatureFill,
            textColor: 0,
            fontStyle: "bold",
            cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }
          },
          head: [
            [
              { content: "" },
              { content: "Originator" },
              { content: "Reviewer" },
              { content: "Approver" }
            ]
          ],
          body: [
            [
              { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
              { content: originatedName || "-" },
              { content: reviewerName || "-" },
              { content: approverName || "-" }
            ],
            [
              { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
              { content: originatedDate || "-" },
              { content: reviewerDate || "-" },
              { content: approverDate || "-" }
            ],
            [
              { content: "Signature:", styles: { fontStyle: "bold", halign: "right", minCellHeight: 15 } },
              { content: "" },
              { content: "" },
              { content: "" }
            ]
          ]
        });
      } catch (e) {
        console.error("Signature block failed", e);
      }

      doc.save(`Sump_Pump_Report_${calcNo}_${Date.now()}.pdf`);
    } catch (err: any) {
      console.error("Export Error:", err);
      alert("Failed to export PDF: " + err.message);
    }
  };

  const valOrEmpty = (val: number | "") => (val === "" ? "" : val);
  const parseNum = (val: string) => (val === "" ? "" : Number(val));

  return (
    <AppShell title="Sump Pump Sizing" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Page Header & Actions */}
          <div className="flex justify-between items-start shrink-0 select-none no-print py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">Sump Pump Sizing</h1>
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-sump-pump" calculatorTitle="Sump Pump Sizing" />
            </div>
          </div>

          {/* Main Content */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            isApprovedLocked || calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setTab("solver")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "solver"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Pump Sizer
                  </button>
                  <button
                    onClick={() => setTab("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "report"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Report
                  </button>
                </div>
              </div>

              {/* Right Side Controls: Export & Unit System Toggle */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <button
                  type="button"
                  onClick={() => setFormulaModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 shadow-2xs"
                  title="View Formulas"
                >
                  <Info className="size-3.5 text-primary" />
                  <span>Formula Breakdown</span>
                </button>
                <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />
                <TBtn onClick={handleExport}>
                  <FileText className="size-3.5" /> Export
                </TBtn>

                <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} disabled={isEffectiveReadOnly} />
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" ? (
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column */}
                <div className="lg:col-span-5 flex flex-col gap-5">
                  
                  {/* Flow & Volume */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div id="card-flow" className={`bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs transition-colors ${isFieldHighlighted("card-flow") ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25" : ""}`}>
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center">
                              Flow & Volume Parameters
                              {renderCommentBadge("card-flow", "Flow Parameters")}
                            </h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Vol Req</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "L" : "Gal"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? req : (typeof req === "number" ? req / GAL_TO_L : ""))} onChange={e => { const val = parseNum(e.target.value); setReq(val === "" ? "" : (isSI ? val : val * GAL_TO_L)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Drawdown Time</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">Hrs</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(time)} onChange={e => { setTime(parseNum(e.target.value)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Manual Flow</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "L/s" : "GPM"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? flow : (typeof flow === "number" ? flow / GPM_TO_LPS : ""))} onChange={e => { const val = parseNum(e.target.value); setFlow(val === "" ? "" : (isSI ? val : val * GPM_TO_LPS)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-64 font-sans">
                      <ContextMenuItem onClick={() => { setReq(isSI ? 1000 : 264); setTime(1); dirtyStore.set(true); }} disabled={isEffectiveReadOnly} className="text-xs cursor-pointer">Reset Default</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handleOpenComment("card-flow", "Flow Parameters")} className="text-xs cursor-pointer text-primary flex items-center gap-2"><MessageSquare className="size-3.5" /> Add Comment / Task</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Pit Sizing */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div id="card-pit" className={`bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs transition-colors ${isFieldHighlighted("card-pit") ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25" : ""}`}>
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center">
                              Pit Sizing
                              {renderCommentBadge("card-pit", "Pit Sizing")}
                            </h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Flow per Pit</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "L/s" : "GPM"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? pitFlow : (typeof pitFlow === "number" ? pitFlow / GPM_TO_LPS : ""))} onChange={e => { const val = parseNum(e.target.value); setPitFlow(val === "" ? "" : (isSI ? val : val * GPM_TO_LPS)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Holding Time</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">min</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(pitHold)} onChange={e => { setPitHold(parseNum(e.target.value)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Longest Pipe</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "m" : "ft"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? longestPipe : (typeof longestPipe === "number" ? longestPipe / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setLongestPipe(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Prop. Side</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "m" : "ft"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? propSide : (typeof propSide === "number" ? propSide / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setPropSide(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-64 font-sans">
                      <ContextMenuItem onClick={() => { setPitFlow(5); setPitHold(5); setLongestPipe(15); setPropSide(2); dirtyStore.set(true); }} disabled={isEffectiveReadOnly} className="text-xs cursor-pointer">Reset Pit Sizing</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handleOpenComment("card-pit", "Pit Sizing")} className="text-xs cursor-pointer text-primary flex items-center gap-2"><MessageSquare className="size-3.5" /> Add Comment / Task</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Piping & Head */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div id="card-piping" className={`bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs transition-colors ${isFieldHighlighted("card-piping") ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25" : ""}`}>
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center">
                              Piping & Head
                              {renderCommentBadge("card-piping", "Piping & Head")}
                            </h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Vert Pipe</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "m" : "ft"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? pipeVert : (typeof pipeVert === "number" ? pipeVert / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setPipeVert(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Horiz Pipe</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "m" : "ft"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? pipeHoriz : (typeof pipeHoriz === "number" ? pipeHoriz / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setPipeHoriz(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Friction</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "bar/100m" : "psi/100ft"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? fricFactor : (typeof fricFactor === "number" ? (fricFactor / PSI_TO_BAR) * (FT_TO_M/100) * 100 : ""))} onChange={e => { const val = parseNum(e.target.value); setFricFactor(val === "" ? "" : (isSI ? val : (val * PSI_TO_BAR) / FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Static Head</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "bar" : "psi"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? staticHead : (typeof staticHead === "number" ? staticHead / PSI_TO_BAR : ""))} onChange={e => { const val = parseNum(e.target.value); setStaticHead(val === "" ? "" : (isSI ? val : val * PSI_TO_BAR)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Residual</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "bar" : "psi"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? presid : (typeof presid === "number" ? presid / PSI_TO_BAR : ""))} onChange={e => { const val = parseNum(e.target.value); setPresid(val === "" ? "" : (isSI ? val : val * PSI_TO_BAR)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Suction</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "bar" : "psi"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? suction : (typeof suction === "number" ? suction / PSI_TO_BAR : ""))} onChange={e => { const val = parseNum(e.target.value); setSuction(val === "" ? "" : (isSI ? val : val * PSI_TO_BAR)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Safety Margin</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">%</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(sfHead)} onChange={e => { setSfHead(parseNum(e.target.value)); dirtyStore.set(true); }} className={inputClass} />
                          </div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-64 font-sans">
                      <ContextMenuItem onClick={() => { setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0); dirtyStore.set(true); }} disabled={isEffectiveReadOnly} className="text-xs cursor-pointer">Reset Piping</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handleOpenComment("card-piping", "Piping & Head")} className="text-xs cursor-pointer text-primary flex items-center gap-2"><MessageSquare className="size-3.5" /> Add Comment / Task</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                </div>

                {/* Right Column: Results */}
                <div className="lg:col-span-7 flex flex-col gap-5 lg:sticky lg:top-0">
                      <div id="card-results" className={`bg-card border border-border rounded-2xl p-6 shadow-md transition-colors ${isFieldHighlighted("card-results") ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25" : ""}`}>
                        <div className="flex items-start sm:items-center justify-between pb-4 border-b border-border/80 mb-5 gap-4 flex-col sm:flex-row">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <Activity className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                Sizing Results {renderCommentBadge("card-results", "Results")}
                              </h2>
                              <p className="text-xs text-muted-foreground font-medium">Auto-calculated pump duty point and volume requirements</p>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setPreviewModalOpen(true)}
                            className="text-xs font-semibold px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 transition-colors rounded-lg flex items-center gap-1.5 shrink-0"
                          >
                            <Activity className="size-3.5" />
                            Calculation Preview
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border/50 flex flex-col gap-1 hover:border-primary/30 transition-colors">
                            <span className="text-xs font-semibold text-muted-foreground">Design Flow</span>
                            <span className="text-xl font-bold text-foreground">
                              {isSI ? `${calcResults.Q_flow.toFixed(2)} L/s` : `${(calcResults.Q_flow / GPM_TO_LPS).toFixed(1)} GPM`}
                            </span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border/50 flex flex-col gap-1 hover:border-cyan-500/30 transition-colors">
                            <span className="text-xs font-semibold text-muted-foreground">TDH Calc</span>
                            <span className="text-xl font-bold text-foreground">
                              {isSI ? `${calcResults.H_pump_calc.toFixed(3)} bar` : `${(calcResults.H_pump_calc / PSI_TO_BAR).toFixed(1)} psi`}
                            </span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border/50 flex flex-col gap-1 hover:border-purple-500/30 transition-colors">
                            <span className="text-xs font-semibold text-muted-foreground">Motor Power</span>
                            <span className="text-xl font-bold text-foreground">
                              {isSI ? `${calcResults.P_motor.toFixed(2)} kW` : `${calcResults.HP.toFixed(2)} HP`}
                            </span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border/50 flex flex-col gap-1 hover:border-orange-500/30 transition-colors">
                            <span className="text-xs font-semibold text-muted-foreground">Pit Volume</span>
                            <span className="text-xl font-bold text-foreground">
                              {isSI ? `${calcResults.pitVol.toFixed(2)} m³` : `${(calcResults.pitVol / GAL_TO_M3).toFixed(1)} Gal`}
                            </span>
                          </div>
                        </div>

                        <div className="mt-6 pt-5 border-t border-border/80">
                          <h4 className="text-xs font-bold uppercase text-muted-foreground mb-4 tracking-wider">Detailed Hydraulics</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-border/40 text-sm">
                              <span className="text-muted-foreground font-medium">Pipe Invert</span>
                              <span className="font-bold text-foreground">{isSI ? `${calcResults.invertVal.toFixed(2)} m` : `${(calcResults.invertVal / FT_TO_M).toFixed(1)} ft`}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border/40 text-sm">
                              <span className="text-muted-foreground font-medium">Prop Depth</span>
                              <span className="font-bold text-foreground">{isSI ? `${calcResults.propDepth.toFixed(2)} m` : `${(calcResults.propDepth / FT_TO_M).toFixed(1)} ft`}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border/40 text-sm">
                              <span className="text-muted-foreground font-medium">Equiv Pipe Length</span>
                              <span className="font-bold text-foreground">{isSI ? `${calcResults.L_equiv.toFixed(2)} m` : `${(calcResults.L_equiv / FT_TO_M).toFixed(1)} ft`}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border/40 text-sm">
                              <span className="text-muted-foreground font-medium">Friction Loss</span>
                              <span className="font-bold text-foreground">{isSI ? `${calcResults.H_loss.toFixed(3)} bar` : `${(calcResults.H_loss / PSI_TO_BAR).toFixed(2)} psi`}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      </div>
              </div>
            </div>
          ) : (
              <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <div className="bg-card border border-border rounded-xl p-8 shadow-sm max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
                  <FileText className="w-16 h-16 text-primary/40 mb-4" />
                  <h2 className="text-xl font-bold text-foreground mb-2">Calculation Report</h2>
                  <p className="text-muted-foreground text-sm max-w-md text-center mb-6">
                    Review the full sizing report and export it as a PDF for your records.
                  </p>
                  <TBtn size="lg" onClick={handleExport} className="font-bold shadow-md bg-primary text-primary-foreground hover:bg-primary/90">
                    <FileText className="w-5 h-5 mr-2" />
                    Download PDF Report
                  </TBtn>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        {formulaModalOpen && (
          <SumpPumpFormulaModal onClose={() => setFormulaModalOpen(false)} />
        )}
        
        {previewModalOpen && (
          <SumpPumpPreviewModal 
            onClose={() => setPreviewModalOpen(false)} 
            calcResults={calcResults}
            unitSystem={unitSystem}
          />
        )}
        
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          onSave={handleSaveComment}
          targetItem={commentTargetItem?.name || "Parameter"}
          contextPath="/plumbing-sump-pump"
          contextId={commentTargetItem?.id}
        />
        </div>
      </div>
    </AppShell>
  );
}

// Mathematical Formula Breakdown Modal
function SumpPumpFormulaModal({
  onClose,
}: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">Sump Pump Mathematical Equations</h3>
              <p className="text-xs text-muted-foreground">Standard formulas applied in dynamic head, storage volume & power sizing</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-xs text-foreground">
          
          {/* Equation 1: Flow Rate */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">1. Flow Rate (Q)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              Q = Pit Volume / Drawdown Time
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              The required flow rate is derived from the volumetric requirement divided by the intended drawdown time.
            </p>
          </div>

          {/* Equation 2: Friction Loss */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">2. Friction Loss (H_loss)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              H_loss = L_equiv × (Friction Factor / 100)
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Calculated using standard friction tables per 100 ft (or 100 m) of pipe, multiplied by the total equivalent length (including vertical, horizontal, and fittings).
            </p>
          </div>

          {/* Equation 3: Total Dynamic Head */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">3. Total Dynamic Head (TDH)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              TDH = Static Head + Friction Loss + Residual Pressure + Suction Head + Safety Factor
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              TDH represents the total equivalent height that a fluid is to be pumped, taking into account friction losses in the pipe and the residual pressure required at the discharge.
            </p>
          </div>

          {/* Equation 4: Motor Power */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">4. Motor Power (HP)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              HP = (Q × TDH × SG) / (3960 × Pump Efficiency × Motor Efficiency)
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Standard pump power equation where SG is Specific Gravity (typically 1.0 for water/sewage).
            </p>
          </div>
          
        </div>
      </div>
    </div>
  );
}

// Calculation Preview Modal
function SumpPumpPreviewModal({
  onClose,
  calcResults,
  unitSystem
}: { 
  onClose: () => void;
  calcResults: any;
  unitSystem: "ip" | "si";
}) {
  const isSI = unitSystem === "si";
  const GPM_TO_LPS = 0.06309;
  const PSI_TO_BAR = 0.0689476;
  const FT_TO_M = 0.3048;

  const flow = isSI ? calcResults.Q_flow : calcResults.Q_flow / GPM_TO_LPS;
  const flowUnit = isSI ? "L/s" : "GPM";
  
  const tdh = isSI ? calcResults.H_pump_calc : calcResults.H_pump_calc / PSI_TO_BAR;
  const tdhUnit = isSI ? "bar" : "psi";

  const headLoss = isSI ? calcResults.H_loss : calcResults.H_loss / PSI_TO_BAR;
  const equivLength = isSI ? calcResults.L_equiv : calcResults.L_equiv / FT_TO_M;
  const lengthUnit = isSI ? "m" : "ft";

  const hp = calcResults.HP;
  const kw = calcResults.P_motor;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">Calculation Preview</h3>
              <p className="text-xs text-muted-foreground">Step-by-step breakdown of your current results</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-xs text-foreground font-mono">
          
          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary">1. PUMP DUTY FLOW</span>
            </div>
            <div className="flex flex-col gap-1 pl-4">
              <span className="text-muted-foreground">Calculated Flow Rate = {flow.toFixed(2)} {flowUnit}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary">2. EQUIVALENT LENGTH & FRICTION LOSS</span>
            </div>
            <div className="flex flex-col gap-1 pl-4">
              <span className="text-muted-foreground">L_elbows (Fittings 30%) = ({isSI ? `${calcResults.pv || 0}m + ${calcResults.phz || 0}m` : `${((calcResults.pv || 0)/FT_TO_M).toFixed(1)}ft + ${((calcResults.phz || 0)/FT_TO_M).toFixed(1)}ft`}) × 0.30 = {isSI ? `${(calcResults.L_elbows || 0).toFixed(2)} m` : `${((calcResults.L_elbows || 0) / FT_TO_M).toFixed(1)} ft`}</span>
              <span className="text-muted-foreground">L_valves (Valves 30%) = ({isSI ? `${calcResults.pv || 0}m + ${calcResults.phz || 0}m` : `${((calcResults.pv || 0)/FT_TO_M).toFixed(1)}ft + ${((calcResults.phz || 0)/FT_TO_M).toFixed(1)}ft`}) × 0.30 = {isSI ? `${(calcResults.L_valves || 0).toFixed(2)} m` : `${((calcResults.L_valves || 0) / FT_TO_M).toFixed(1)} ft`}</span>
              <span className="text-muted-foreground">Total Equivalent Length (L_equiv with 5% safety) = {equivLength.toFixed(2)} {lengthUnit}</span>
              <span className="text-muted-foreground">Friction Loss (H_loss) = {equivLength.toFixed(2)} × ({isSI ? `${calcResults.ff || 0.4}` : `${((calcResults.ff || 0.4) / PSI_TO_BAR) * (FT_TO_M/100) * 100}`} / 100)</span>
              <span className="text-foreground font-bold mt-1">H_loss = {headLoss.toFixed(3)} {tdhUnit}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary">3. TOTAL DYNAMIC HEAD (TDH)</span>
            </div>
            <div className="flex flex-col gap-1 pl-4">
              <span className="text-muted-foreground">TDH = Static Head + Friction Loss + Residual + Suction + Safety Factor</span>
              <span className="text-foreground font-bold mt-1">TDH = {tdh.toFixed(3)} {tdhUnit}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary">4. MOTOR POWER</span>
            </div>
            <div className="flex flex-col gap-1 pl-4">
              <span className="text-muted-foreground">Mechanical Power (HP) = {hp.toFixed(2)} HP</span>
              <span className="text-foreground font-bold mt-1">Electrical Power = {kw.toFixed(2)} kW</span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
