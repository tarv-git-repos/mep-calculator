import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { 
  Download, Save, FileText, Sparkles, Activity, Eye, MessageSquare, 
  X, CheckCircle2, ChevronRight, Gauge, Layers 
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

export const Route = createFileRoute("/plumbing-pressure-vessel")({
  head: () => ({
    meta: [
      { title: "Pressure Vessel Sizing — MEP Calc" },
      { name: "description", content: "Calculate the required volume of water supply expansion or bladder pressure vessels." },
    ],
  }),
  component: PressureVesselPage,
});

function PressureVesselPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-pressure-vessel", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-pressure-vessel", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  // Unit System
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const isSI = unitSystem === "si";

  // Conversion Constants
  const GAL_TO_L = 3.78541;
  const GPM_TO_LMIN = 3.78541;
  const PSI_TO_BAR = 0.0689476;

  // Input States (stored in SI internally)
  const [importedFlow, setImportedFlow] = useState<number | "">("");
  const [importedHead, setImportedHead] = useState<number | "">("");
  const [qLmin, setQLmin] = useState<number | "">(78);
  const [bandFactor, setBandFactor] = useState<number | "">(0.20);
  const [ppVal, setPpVal] = useState<number | "">(8.52);
  const [paVal, setPaVal] = useState<number | "">(5.68);
  const [zmax, setZmax] = useState<number | "">(60);

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Modals & Comments State
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  const isReadOnly = false;
  const isApprovedLocked = useCalculationLock("/plumbing-pressure-vessel", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";

  // Comments Persistence
  useEffect(() => {
    if (!project?.id) return;
    try {
      const saved = localStorage.getItem(`mep_comments_${project.id}_/plumbing-pressure-vessel`);
      if (saved) setCommentsList(JSON.parse(saved));
      else setCommentsList([]);
    } catch (e) {
      console.error(e);
    }
  }, [project?.id]);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    if (project?.id) {
      localStorage.setItem(`mep_comments_${project.id}_/plumbing-pressure-vessel`, JSON.stringify(newList));
    }
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (commentText: string, assignedUserIds: string[]) => {
    if (!commentTargetItem) return;
    const newComment = {
      id: `comment_${Date.now()}`,
      targetId: commentTargetItem.id,
      targetName: commentTargetItem.name,
      text: commentText,
      assignedUserIds,
      createdAt: new Date().toISOString(),
      author: currentUserName,
    };
    const updated = [...commentsList, newComment];
    saveComments(updated);

    notifyCommentAssigned({
      assignedUserIds,
      targetName: commentTargetItem.name,
      targetId: commentTargetItem.id,
      calculatorTitle: "Pressure Vessel Sizing",
      calculatorPath: "/plumbing-pressure-vessel",
      commentText,
      currentUserName,
    });
  };

  const renderCommentBadge = (id: string, name: string) => {
    const count = commentsList.filter((c) => c.targetId === id).length;
    if (count === 0) return null;
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleOpenComment(id, name);
        }}
        className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors flex items-center gap-1 text-[10px] font-bold"
      >
        <MessageSquare className="size-3" />
        <span>{count}</span>
      </button>
    );
  };

  const handleScrollTarget = (targetId?: string, targetName?: string) => {
    const matchedId = targetId || (targetName ? `card-${targetName.toLowerCase().replace(/[^a-z0-9]/g, "")}` : null);
    if (!matchedId) return;

    setHighlightedTargetId(matchedId);

    const elem = document.getElementById(matchedId);
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedTargetId(null);
    }, 2000);
  };

  useEffect(() => {
    const handleCustomEvent = (e: any) => {
      if (e.detail?.id || e.detail?.name) {
        handleScrollTarget(e.detail.id, e.detail.name);
      }
    };
    window.addEventListener("mep-scroll-to-item", handleCustomEvent);
    return () => window.removeEventListener("mep-scroll-to-item", handleCustomEvent);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("commentTargetId");
    const targetName = params.get("commentTargetName");

    if (targetId || targetName) {
      const timer = setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("mep-scroll-to-item", {
            detail: { id: targetId, name: targetName },
          })
        );
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [typeof window !== "undefined" ? window.location.search : ""]);

  const isFieldHighlighted = (id: string, name?: string) => {
    if (!highlightedTargetId) return false;
    if (highlightedTargetId === id) return true;
    if (name) {
      const cleanTarget = highlightedTargetId.toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return cleanTarget === cleanName || cleanTarget.includes(cleanName) || cleanName.includes(cleanTarget);
    }
    return false;
  };

  // Load state from localStorage on project change
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`mep_pressure_vessel_calc_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.importedFlow !== undefined) setImportedFlow(data.importedFlow);
          if (data.importedHead !== undefined) setImportedHead(data.importedHead);
          if (data.qLmin !== undefined) setQLmin(data.qLmin);
          if (data.bandFactor !== undefined) setBandFactor(data.bandFactor);
          if (data.ppVal !== undefined) setPpVal(data.ppVal);
          if (data.paVal !== undefined) setPaVal(data.paVal);
          if (data.zmax !== undefined) setZmax(data.zmax);
          if (data.unitSystem !== undefined) setUnitSystem(data.unitSystem);
        } else {
          setImportedFlow("");
          setImportedHead("");
          setQLmin(78);
          setBandFactor(0.20);
          setPpVal(8.52);
          setPaVal(5.68);
          setZmax(60);
          setUnitSystem("si");
        }
        setTimeout(() => dirtyStore.set(false), 50);
      } catch (e) {
        console.error("Failed to load pressure vessel calculation", e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        importedFlow,
        importedHead,
        qLmin,
        bandFactor,
        ppVal,
        paVal,
        zmax,
        unitSystem,
      };
      localStorage.setItem(`mep_pressure_vessel_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, importedFlow, importedHead, qLmin, bandFactor, ppVal, paVal, zmax, unitSystem]);

  const handleSaveCurrent = () => {
    try {
      if (project?.id) {
        const dataToSave = {
          importedFlow,
          importedHead,
          qLmin,
          bandFactor,
          ppVal,
          paVal,
          zmax,
          unitSystem,
        };
        localStorage.setItem(`mep_pressure_vessel_calc_${project.id}`, JSON.stringify(dataToSave));
        dirtyStore.set(false);
        if (forceSaveToCloud) forceSaveToCloud();
        toast.success("Pressure Vessel Sizing saved to project successfully!");
      }
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  // Helper parsers
  const parseNum = (val: string): number | "" => {
    if (val === "" || val === undefined || val === null) return "";
    const num = parseFloat(val);
    return isNaN(num) ? "" : num;
  };

  const valOrEmpty = (val: number | "") => (val === "" || val === undefined ? "" : val);

  // Import Handler
  const handleImport = (type: "booster" | "transfer") => {
    if (!project?.id) {
      toast.error("No active project loaded.");
      return;
    }
    try {
      const key = type === "booster" ? `mep_booster_pump_calc_${project.id}` : `mep_transfer_pump_calc_${project.id}`;
      const raw = localStorage.getItem(key) || localStorage.getItem(`mep_pump_sizing_calc_${project.id}`);
      if (!raw) {
        toast.error(`No ${type === "booster" ? "Booster" : "Transfer"} Pump sizing found in project.`);
        return;
      }
      const data = JSON.parse(raw);

      const vert = parseFloat(data.pipeVert) || 0;
      const horiz = parseFloat(data.pipeHoriz) || 0;
      const ff = parseFloat(data.fricFactor) || 0.4;
      const elbows = (vert + horiz) * 0.3;
      const valves = (vert + horiz) * 0.3;
      const L_sum = vert + horiz + elbows + valves;
      const equivLen = Math.ceil((L_sum * 1.05) / 10) * 10;
      const frictionLoss = equivLen * (ff / 100);

      let filterLoss = 0;
      if (type === "transfer") {
        if (data.filtCarbon) filterLoss += 0.8;
        if (data.filtMM) filterLoss += 0.8;
        if (data.filtCuAg) filterLoss += 0.2;
        if (data.filtSoftener) filterLoss += 0.8;
      }

      const staticH = parseFloat(data.staticHead) || 0;
      const outletH = parseFloat(data.presidHead) || 0;
      const suctionH = parseFloat(data.suctionHead) || 0;
      const safetyMargin = (parseFloat(data.sfHead) || 0) / 100;
      const rawHead = Math.max(0, frictionLoss + staticH + outletH - suctionH) + filterLoss;
      const calcHead = rawHead * (1 + safetyMargin);

      let flowLps = parseFloat(data.manualFlow) || parseFloat(data.flowLps) || 0;
      const wPumps = parseInt(data.workingPumps) || 1;
      if (type !== "transfer") {
        flowLps = flowLps * wPumps;
      }

      setImportedFlow(flowLps > 0 ? flowLps : 0);
      setImportedHead(calcHead > 0 ? calcHead : 0);

      if (flowLps > 0) {
        setQLmin(flowLps * 60);
      }
      dirtyStore.set(true);
      toast.success(`Imported from ${type === "booster" ? "Booster" : "Transfer"} Pump!`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to import values.");
    }
  };

  // Auto-update stop (Pp) and start (Pa) pressures if imported head or band factor changes
  // Auto-update stop (Pp) and start (Pa) pressures if imported head or band factor changes
  useEffect(() => {
    const head = typeof importedHead === "number" ? importedHead : 0;
    const factor = typeof bandFactor === "number" ? bandFactor : 0;
    if (head > 0) {
      const computedPp = Number((head * factor + head).toFixed(2));
      const computedPa = Number((head - head * factor).toFixed(2));
      setPpVal(computedPp);
      setPaVal(computedPa);
    }
  }, [importedHead, bandFactor]);

  // Sizing calculations
  const results = useMemo(() => {
    const q = typeof qLmin === "number" ? qLmin : 0;
    const pp = typeof ppVal === "number" ? ppVal : 0;
    const pa = typeof paVal === "number" ? paVal : 0;
    const z = typeof zmax === "number" ? zmax : 1;
    const pc = pa - 0.2;
    const constant = 16.5;

    let volume = 0;
    if (z > 0 && pp - pa > 0 && pc > 0) {
      volume = constant * ((q * pp * pa) / (z * (pp - pa) * pc));
    }

    return {
      q,
      pp,
      pa,
      pc,
      z,
      volume,
    };
  }, [qLmin, ppVal, paVal, zmax]);

  // Unit System Handler
  const handleUnitSystemChange = (next: "ip" | "si", _shouldConvert?: boolean) => {
    if (isEffectiveReadOnly) return;
    setUnitSystem(next);
    dirtyStore.set(true);
  };

  // PDF Export
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
      doc.text("PRESSURE VESSEL SIZING REPORT", 14, 18);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Project: ${project?.name || "General Project"} | Date: ${new Date().toLocaleDateString()}`, 14, 24);

      const tableData = [
        ["Pump Discharge Volume (Q)", isSI ? `${results.q.toFixed(2)} L/min` : `${(results.q / GPM_TO_LMIN).toFixed(2)} GPM`],
        ["On/Off Band Factor", `${typeof bandFactor === "number" ? bandFactor.toFixed(2) : "-"}`],
        ["Pump Stop Pressure (Pp)", isSI ? `${results.pp.toFixed(2)} bar` : `${(results.pp / PSI_TO_BAR).toFixed(2)} psi`],
        ["Pump Start Pressure (Pa)", isSI ? `${results.pa.toFixed(2)} bar` : `${(results.pa / PSI_TO_BAR).toFixed(2)} psi`],
        ["Gas Preload Pressure (Pc = Pa - 0.2)", isSI ? `${results.pc.toFixed(2)} bar` : `${(results.pc / PSI_TO_BAR).toFixed(2)} psi`],
        ["Max Starts per Hour (Zmax)", `${results.z} starts/hr`],
        ["REQUIRED VESSEL CAPACITY", isSI ? `${results.volume.toFixed(2)} Liters` : `${(results.volume / GAL_TO_L).toFixed(2)} Gallons`],
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
      addPdfSignatureBlock(doc, finalY, currentUserName, project?.id || "default", "plumbing-pressure-vessel");

      doc.save(`Pressure_Vessel_Sizing_${Date.now()}.pdf`);
      toast.success("PDF Report generated successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF report.");
    }
  };

  return (
    <AppShell
      title="Pressure Vessel Sizing"
      subtitle="Water supply expansion & bladder pressure vessel capacity sizing"
      actions={
        <div className="flex items-center gap-2">
          {/* SI / IP Unit Toggle */}
          <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} />

          <button
            onClick={() => setFormulaModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold rounded-full border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer shadow-xs"
          >
            <FileText className="size-3.5 text-primary" /> Formulas
          </button>
        </div>
      }
    >
      <div className={`flex-1 overflow-y-auto rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"} p-4 md:p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20`}>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: INPUT PARAMETER CARDS */}
          <div className="lg:col-span-5 space-y-5">
            {/* Card 1: Import & Flow Data */}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  id="card-import"
                  className={`bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs transition-colors ${
                    isFieldHighlighted("card-import", "Import & Flow Data")
                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-primary rounded-full" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center">
                        Import & Flow Data
                        {renderCommentBadge("card-import", "Import & Flow Data")}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleImport("booster")}
                      className="py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-full text-[11px] font-bold transition-all cursor-pointer"
                    >
                      Import Booster Pump
                    </button>
                    <button
                      type="button"
                      onClick={() => handleImport("transfer")}
                      className="py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-full text-[11px] font-bold transition-all cursor-pointer"
                    >
                      Import Transfer Pump
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground">
                        Imported Flow ({isSI ? "L/s" : "GPM"})
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={
                          typeof importedFlow === "number"
                            ? isSI
                              ? importedFlow.toFixed(2)
                              : (importedFlow / GPM_TO_LMIN).toFixed(2)
                            : ""
                        }
                        className={`${inputClass} opacity-70 cursor-not-allowed`}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground">
                        Imported Head ({isSI ? "bar" : "psi"})
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={
                          typeof importedHead === "number"
                            ? isSI
                              ? importedHead.toFixed(2)
                              : (importedHead / PSI_TO_BAR).toFixed(2)
                            : ""
                        }
                        className={`${inputClass} opacity-70 cursor-not-allowed`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs">
                    <label className="font-semibold text-foreground">
                      Discharge Volume (Q) ({isSI ? "L/min" : "GPM"})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={isEffectiveReadOnly}
                      value={qLmin === "" ? "" : isSI ? (typeof qLmin === "number" ? Number(qLmin.toFixed(2)) : qLmin) : (typeof qLmin === "number" ? Number((qLmin / GPM_TO_LMIN).toFixed(2)) : "")}
                      onChange={(e) => {
                        const val = parseNum(e.target.value);
                        setQLmin(val === "" ? "" : isSI ? val : val * GPM_TO_LMIN);
                        dirtyStore.set(true);
                      }}
                      className={inputClass}
                    />
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-64 font-sans">
                <ContextMenuItem
                  onClick={() => {
                    setQLmin(78);
                    dirtyStore.set(true);
                  }}
                  disabled={isEffectiveReadOnly}
                  className="text-xs cursor-pointer"
                >
                  Reset Flow Data
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => handleOpenComment("card-import", "Import & Flow Data")}
                  className="text-xs cursor-pointer text-primary flex items-center gap-2"
                >
                  <MessageSquare className="size-3.5" /> Add Comment / Task
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>

            {/* Card 2: Pressure & Starts Criteria */}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  id="card-pressures"
                  className={`bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs transition-colors ${
                    isFieldHighlighted("card-pressures", "Pressure & Starts Criteria")
                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-primary rounded-full" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center">
                        Pressure & Starts Criteria
                        {renderCommentBadge("card-pressures", "Pressure & Starts Criteria")}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground">
                        Band Factor (-)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={isEffectiveReadOnly}
                        value={bandFactor === "" ? "" : typeof bandFactor === "number" ? Number(bandFactor.toFixed(2)) : bandFactor}
                        onChange={(e) => {
                          setBandFactor(parseNum(e.target.value));
                          dirtyStore.set(true);
                        }}
                        className={inputClass}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground">
                        Max Starts (Zmax) (#/hr)
                      </label>
                      <input
                        type="number"
                        disabled={isEffectiveReadOnly}
                        value={zmax === "" ? "" : typeof zmax === "number" ? Number(zmax.toFixed(2)) : zmax}
                        onChange={(e) => {
                          setZmax(parseNum(e.target.value));
                          dirtyStore.set(true);
                        }}
                        className={inputClass}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground">
                        Pump Stop (Pp) ({isSI ? "bar" : "psi"})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={isEffectiveReadOnly}
                        value={ppVal === "" ? "" : isSI ? (typeof ppVal === "number" ? Number(ppVal.toFixed(2)) : ppVal) : (typeof ppVal === "number" ? Number((ppVal / PSI_TO_BAR).toFixed(2)) : "")}
                        onChange={(e) => {
                          const val = parseNum(e.target.value);
                          setPpVal(val === "" ? "" : isSI ? val : val * PSI_TO_BAR);
                          dirtyStore.set(true);
                        }}
                        className={inputClass}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-foreground">
                        Pump Start (Pa) ({isSI ? "bar" : "psi"})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={isEffectiveReadOnly}
                        value={paVal === "" ? "" : isSI ? (typeof paVal === "number" ? Number(paVal.toFixed(2)) : paVal) : (typeof paVal === "number" ? Number((paVal / PSI_TO_BAR).toFixed(2)) : "")}
                        onChange={(e) => {
                          const val = parseNum(e.target.value);
                          setPaVal(val === "" ? "" : isSI ? val : val * PSI_TO_BAR);
                          dirtyStore.set(true);
                        }}
                        className={inputClass}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2">
                      <label className="font-semibold text-foreground">
                        Preload Pressure (Pc = Pa - 0.2 bar) ({isSI ? "bar" : "psi"})
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={isSI ? results.pc.toFixed(2) : (results.pc / PSI_TO_BAR).toFixed(2)}
                        className={`${inputClass} opacity-70 cursor-not-allowed`}
                      />
                    </div>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-64 font-sans">
                <ContextMenuItem
                  onClick={() => {
                    setBandFactor(0.2);
                    setPpVal(8.52);
                    setPaVal(5.68);
                    setZmax(60);
                    dirtyStore.set(true);
                  }}
                  disabled={isEffectiveReadOnly}
                  className="text-xs cursor-pointer"
                >
                  Reset Pressure Parameters
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => handleOpenComment("card-pressures", "Pressure & Starts Criteria")}
                  className="text-xs cursor-pointer text-primary flex items-center gap-2"
                >
                  <MessageSquare className="size-3.5" /> Add Comment / Task
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </div>

          {/* RIGHT COLUMN: RESULTS CARDS */}
          <div className="lg:col-span-7 flex flex-col gap-5 lg:sticky lg:top-0">
            <div
              id="card-results"
              className={`bg-card border border-border rounded-2xl p-6 shadow-md transition-colors ${
                isFieldHighlighted("card-results")
                  ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                  : ""
              }`}
            >
              <div className="flex items-start sm:items-center justify-between pb-4 border-b border-border/80 mb-5 gap-4 flex-col sm:flex-row">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Sizing Results</h3>
                    <p className="text-xs text-muted-foreground">IPC & CIBSE Guide W Pressure Vessel Capacity</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewModalOpen(true)}
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

              {/* Sizing KPI Cards */}
              <div className="grid grid-cols-2 gap-3.5 mb-6">
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex flex-col gap-1 hover:border-primary/40 transition-colors">
                  <span className="text-xs font-semibold text-muted-foreground">Required Capacity</span>
                  <span className="text-2xl font-black text-primary">
                    {isSI ? `${results.volume.toFixed(2)} L` : `${(results.volume / GAL_TO_L).toFixed(2)} Gal`}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border/50 flex flex-col gap-1 hover:border-cyan-500/30 transition-colors">
                  <span className="text-xs font-semibold text-muted-foreground">Preload Pressure (Pc)</span>
                  <span className="text-xl font-bold text-foreground">
                    {isSI ? `${results.pc.toFixed(2)} bar` : `${(results.pc / PSI_TO_BAR).toFixed(2)} psi`}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border/50 flex flex-col gap-1 hover:border-purple-500/30 transition-colors">
                  <span className="text-xs font-semibold text-muted-foreground">Pressure Delta (Pp - Pa)</span>
                  <span className="text-xl font-bold text-foreground">
                    {isSI ? `${(results.pp - results.pa).toFixed(2)} bar` : `${((results.pp - results.pa) / PSI_TO_BAR).toFixed(2)} psi`}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border/50 flex flex-col gap-1 hover:border-orange-500/30 transition-colors">
                  <span className="text-xs font-semibold text-muted-foreground">Max Starts / Hr</span>
                  <span className="text-xl font-bold text-foreground">{results.z} starts</span>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="pt-5 border-t border-border/80">
                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-4 tracking-wider">Detailed Hydraulics</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border/40 text-sm">
                    <span className="text-muted-foreground font-medium">Discharge Volume (Q)</span>
                    <span className="font-bold text-foreground">
                      {isSI ? `${results.q.toFixed(2)} L/min` : `${(results.q / GPM_TO_LMIN).toFixed(2)} GPM`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/40 text-sm">
                    <span className="text-muted-foreground font-medium">Pump Cut-out Stop (Pp)</span>
                    <span className="font-bold text-foreground">
                      {isSI ? `${results.pp.toFixed(2)} bar` : `${(results.pp / PSI_TO_BAR).toFixed(2)} psi`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/40 text-sm">
                    <span className="text-muted-foreground font-medium">Pump Cut-in Start (Pa)</span>
                    <span className="font-bold text-foreground">
                      {isSI ? `${results.pa.toFixed(2)} bar` : `${(results.pa / PSI_TO_BAR).toFixed(2)} psi`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/40 text-sm">
                    <span className="text-muted-foreground font-medium">Gas Preload Pressure (Pc)</span>
                    <span className="font-bold text-foreground">
                      {isSI ? `${results.pc.toFixed(2)} bar` : `${(results.pc / PSI_TO_BAR).toFixed(2)} psi`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {formulaModalOpen && <PressureVesselFormulaModal onClose={() => setFormulaModalOpen(false)} />}

      {previewModalOpen && <PressureVesselPreviewModal onClose={() => setPreviewModalOpen(false)} calcResults={results} unitSystem={unitSystem} bandFactor={bandFactor} />}

      <AssignCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        onSave={handleSaveComment}
        targetItem={commentTargetItem?.name || "Parameter"}
        contextPath="/plumbing-pressure-vessel"
        contextId={commentTargetItem?.id}
      />
    </AppShell>
  );
}

const inputClass = `w-full bg-slate-100/60 dark:bg-slate-950/40 border border-border/80 rounded-xl px-3.5 py-2 font-bold outline-none focus:border-primary text-foreground disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-200/50 dark:disabled:bg-slate-900/50`;

// Formula Modal
function PressureVesselFormulaModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">Pressure Vessel Mathematical Equations</h3>
              <p className="text-xs text-muted-foreground">Standard formulas applied in bladder/expansion tank volume sizing</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-xs text-foreground">
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">1. Gas Preload Pressure (Pc)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              Pc = Pa - 0.2 bar (or Pc = Pa - 3 psi)
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Preload pressure is set slightly below the pump cut-in pressure (Pa) to ensure continuous flow before pump start.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">2. Required Vessel Volume (V)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              V = 16.5 × (Q × Pp × Pa) ÷ (Zmax × (Pp - Pa) × Pc)
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Vessel volume is calculated based on pump flow rate (Q), cut-out pressure (Pp), cut-in pressure (Pa), preload pressure (Pc), and maximum starts per hour (Zmax).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Calculation Preview Modal
function PressureVesselPreviewModal({
  onClose,
  calcResults,
  unitSystem,
  bandFactor,
}: {
  onClose: () => void;
  calcResults: any;
  unitSystem: "ip" | "si";
  bandFactor: number | "";
}) {
  const isSI = unitSystem === "si";
  const GPM_TO_LMIN = 3.78541;
  const PSI_TO_BAR = 0.0689476;
  const GAL_TO_L = 3.78541;

  const q = isSI ? calcResults.q : calcResults.q / GPM_TO_LMIN;
  const flowUnit = isSI ? "L/min" : "GPM";

  const pp = isSI ? calcResults.pp : calcResults.pp / PSI_TO_BAR;
  const pa = isSI ? calcResults.pa : calcResults.pa / PSI_TO_BAR;
  const pc = isSI ? calcResults.pc : calcResults.pc / PSI_TO_BAR;
  const pressUnit = isSI ? "bar" : "psi";

  const volume = isSI ? calcResults.volume : calcResults.volume / GAL_TO_L;
  const volUnit = isSI ? "Liters" : "Gallons";

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">Calculation Preview</h3>
              <p className="text-xs text-muted-foreground">Step-by-step breakdown of pressure vessel capacity results</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-xs text-foreground font-mono">
          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary">1. PUMP DISCHARGE VOLUME</span>
            </div>
            <div className="flex flex-col gap-1 pl-4">
              <span className="text-muted-foreground">Discharge Flow (Q) = {q.toFixed(2)} {flowUnit}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary">2. PRESSURE DIFFERENTIAL & PRELOAD</span>
            </div>
            <div className="flex flex-col gap-1 pl-4">
              <span className="text-muted-foreground">Cut-out Stop (Pp) = {pp.toFixed(2)} {pressUnit}</span>
              <span className="text-muted-foreground">Cut-in Start (Pa) = {pa.toFixed(2)} {pressUnit}</span>
              <span className="text-muted-foreground">Differential (Pp - Pa) = {(pp - pa).toFixed(2)} {pressUnit}</span>
              <span className="text-muted-foreground">Preload Pressure (Pc = Pa - {isSI ? "0.20 bar" : "3.00 psi"}) = {pc.toFixed(2)} {pressUnit}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary">3. REQUIRED VESSEL CAPACITY</span>
            </div>
            <div className="flex flex-col gap-1.5 pl-4">
              <span className="text-muted-foreground">Formula: V = 16.5 × (Q × Pp × Pa) ÷ (Zmax × (Pp - Pa) × Pc)</span>
              <span className="text-muted-foreground">Substitution: V = 16.5 × ({q.toFixed(2)} × {pp.toFixed(2)} × {pa.toFixed(2)}) ÷ ({calcResults.z} × {(pp - pa).toFixed(2)} × {pc.toFixed(2)})</span>
              <span className="text-foreground font-bold text-sm mt-1">Vessel Capacity = {volume.toFixed(2)} {volUnit}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
