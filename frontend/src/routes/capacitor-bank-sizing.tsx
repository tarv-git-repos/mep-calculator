import { CalculationReviewBar, useCalculationLock } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock, addPdfHeader } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { Download, Plus, X, ChevronDown, ChevronUp, Zap, Activity, FileText, MessageSquare, Flag, Copy, Trash2, Edit3, Sparkles, AlertCircle, CheckCircle2, ShieldCheck, Search, Filter, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-store";
import { api } from "@/services/api";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import type { TaskComment } from "@/lib/ventilation-calc";

export const Route = createFileRoute("/capacitor-bank-sizing")({
  component: CapacitorBankSizingPage,
});

interface CapPanel {
  id: string;
  name: string;
  panelRef: string;
  totalLoadKw: number | "";
  maxDemandLoadKw: number | "";
  initialPf: number | "";
  targetPf: number | "";
  stepUnit: number;
  overcurrentFactor: number;
  voltageKv: number;
  flagged?: boolean;
  comments?: TaskComment[];
}

const defaultPanel = (id: number): CapPanel => ({
  id: id.toString(),
  name: `SS1-LV-0${id}`,
  panelRef: `PFC (LV PANEL-0${id})`,
  totalLoadKw: 1688.8,
  maxDemandLoadKw: 1097.7,
  initialPf: 0.8,
  targetPf: 0.9,
  stepUnit: 50,
  overcurrentFactor: 1.35,
  voltageKv: 0.4
});

function CapacitorBankSizingPage() {
  const { userData, profile } = useAuth();
  const { project: projectObj } = useWorkspace();
  const isApprovedLocked = useCalculationLock("/capacitor-bank-sizing", projectObj?.id);
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const [project, setProject] = useState("");
  const [sub, setSub] = useState("");
  
  const [panels, setPanels] = useState<CapPanel[]>([defaultPanel(1)]);
  const [activePanelId, setActivePanelId] = useState<string | null>("1");
  const [nextId, setNextId] = useState(2);
  const [showMathId, setShowMathId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "flagged" | "low_pf">("all");
  const [sortBy, setSortBy] = useState<"none" | "name" | "load">("none");

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; panelId: string } | null>(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetPanel, setCommentTargetPanel] = useState<CapPanel | null>(null);
  const [editingPanel, setEditingPanel] = useState<CapPanel | null>(null);
  const [intelOpen, setIntelOpen] = useState(false);

  const panelInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const filteredPanels = useMemo(() => {
    let list = [...panels];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.panelRef.toLowerCase().includes(q));
    }
    if (filterStatus === "flagged") {
      list = list.filter(p => p.flagged);
    } else if (filterStatus === "low_pf") {
      list = list.filter(p => Number(p.initialPf || 1) < 0.85);
    }
    if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "load") {
      list.sort((a, b) => (Number(b.maxDemandLoadKw) || 0) - (Number(a.maxDemandLoadKw) || 0));
    }
    return list;
  }, [panels, searchQuery, filterStatus, sortBy]);

  // Close context menu on click or scroll
  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener("click", handleClose);
    window.addEventListener("scroll", handleClose);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("scroll", handleClose);
    };
  }, []);

  // Load from workspace_data on mount or project switch
  useEffect(() => {
    if (projectObj?.workspace_data) {
      let wdata = projectObj.workspace_data;
      if (typeof wdata === "string") {
        try { wdata = JSON.parse(wdata); } catch(e) {}
      }
      if (wdata?.capacitor_bank_calc) {
        const cbc = wdata.capacitor_bank_calc;
        if (Array.isArray(cbc.panels) && cbc.panels.length > 0) {
          setPanels(cbc.panels);
          setNextId(cbc.panels.length + 1);
        }
        if (cbc.project !== undefined) setProject(cbc.project);
        if (cbc.sub !== undefined) setSub(cbc.sub);
      }
    }
  }, [projectObj?.id]);

  // Sync state changes to workspace_data
  const saveToWorkspace = (updatedPanels: CapPanel[], projName: string = project, subRef: string = sub) => {
    if (!projectObj?.id) return;
    try {
      let wdata = projectObj.workspace_data || {};
      if (typeof wdata === "string") {
        try { wdata = JSON.parse(wdata); } catch(e) {}
      }
      wdata.capacitor_bank_calc = {
        panels: updatedPanels,
        project: projName,
        sub: subRef,
        updatedAt: new Date().toISOString()
      };
      api.updateProject(projectObj.id, { workspace_data: wdata }).catch(console.error);
      useWorkspace.getState().updateProject({ ...projectObj, workspace_data: wdata });
    } catch(err) {
      console.error("Failed to save capacitor bank data to workspace:", err);
    }
  };

  const updatePanel = (id: string, field: keyof CapPanel, value: any) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const updated = panels.map(p => p.id === id ? { ...p, [field]: value } : p);
    setPanels(updated);
    saveToWorkspace(updated);
  };

  const handleSaveModalPanel = (updatedPanel: CapPanel) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const updated = panels.map(p => p.id === updatedPanel.id ? updatedPanel : p);
    setPanels(updated);
    saveToWorkspace(updated);
    toast.success(`Updated ${updatedPanel.name}`);
  };

  const addPanel = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const newPanel = defaultPanel(nextId);
    const updated = [...panels, newPanel];
    setPanels(updated);
    setActivePanelId(newPanel.id);
    setNextId(nextId + 1);
    saveToWorkspace(updated);
  };

  const removePanel = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    if (panels.length <= 1) return;
    const newPanels = panels.filter(p => p.id !== id);
    setPanels(newPanels);
    if (activePanelId === id) {
      setActivePanelId(null);
    }
    saveToWorkspace(newPanels);
  };

  const handleDuplicatePanel = (panelId: string) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const target = panels.find(p => p.id === panelId);
    if (!target) return;
    const newPanel: CapPanel = {
      ...target,
      id: `cap_panel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${target.name} (Copy)`,
      panelRef: `${target.panelRef} (Copy)`,
      comments: target.comments ? [...target.comments] : []
    };
    const newPanels = [...panels, newPanel];
    setPanels(newPanels);
    setActivePanelId(newPanel.id);
    saveToWorkspace(newPanels);
    toast.success(`Duplicated ${target.name}`);
  };

  const handleToggleFlagPanel = (panelId: string) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const newPanels = panels.map(p => p.id === panelId ? { ...p, flagged: !p.flagged } : p);
    setPanels(newPanels);
    saveToWorkspace(newPanels);
    toast.info("Panel flag status updated");
  };

  const handleOpenCommentModal = (panel: CapPanel, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCommentTargetPanel(panel);
    setCommentModalOpen(true);
  };

  const handleSaveComment = async (newComment: TaskComment) => {
    if (!commentTargetPanel) return;
    const updatedComments = [...(commentTargetPanel.comments || []), newComment];
    const newPanels = panels.map(p => p.id === commentTargetPanel.id ? { ...p, comments: updatedComments } : p);
    setPanels(newPanels);
    saveToWorkspace(newPanels);

    const commentWithMeta = {
      ...newComment,
      targetId: commentTargetPanel.id,
      targetName: commentTargetPanel.name,
      targetType: "Capacitor Bank Panel",
      projectName: projectObj?.name || project || "Project",
      projectId: projectObj?.id || "current",
      calculatorPath: "/capacitor-bank-sizing"
    };

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notification_received", { detail: commentWithMeta }));
      window.dispatchEvent(new CustomEvent("mep-notification-added", { detail: commentWithMeta }));
      window.dispatchEvent(new Event("storage"));
    }

    notifyCommentAssigned({
      comment: commentWithMeta,
      targetId: commentTargetPanel.id,
      targetName: commentTargetPanel.name,
      targetType: "Capacitor Bank Panel",
      calculatorPath: "/capacitor-bank-sizing",
      projectName: projectObj?.name || project || "Project"
    });
    
    toast.success(`Comment saved & notification sent for ${commentTargetPanel.name}`);
  };

  const handlePanelContextMenu = (e: React.MouseEvent, panelId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      panelId
    });
  };

  const handlePanelDoubleClick = (p: CapPanel, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activePanelId !== p.id) {
      setActivePanelId(p.id);
    }
    setEditingPanel(p);
  };

  const calculatePanel = (p: CapPanel) => {
    const demand = Number(p.maxDemandLoadKw) || 0;
    const pf1 = Number(p.initialPf) || 1;
    const pf2 = Number(p.targetPf) || 1;

    const safePf1 = Math.min(Math.max(pf1, 0.1), 1);
    const safePf2 = Math.min(Math.max(pf2, 0.1), 1);

    const theta1Rad = Math.acos(safePf1);
    const theta2Rad = Math.acos(safePf2);
    
    const theta1Deg = theta1Rad * (180 / Math.PI);
    const theta2Deg = theta2Rad * (180 / Math.PI);

    const tanTheta1 = Math.tan(theta1Rad);
    const tanTheta2 = Math.tan(theta2Rad);
    const tanThetaDiff = tanTheta1 - tanTheta2;

    const requiredKvar = demand * tanThetaDiff;

    let proposedKvar = Math.ceil(requiredKvar / 25) * 25;
    if (proposedKvar <= 0) proposedKvar = 25;

    const stepUnit = Number(p.stepUnit) || 50;
    const numFullSteps = Math.floor(proposedKvar / stepUnit);
    const remainderStep = proposedKvar % stepUnit;

    const initialKva = demand / safePf1;
    const targetKva = demand / safePf2;
    const initialKvar = Math.sin(theta1Rad) * initialKva;
    const targetKvar = Math.sin(theta2Rad) * targetKva;

    const overcurrentFactor = Number(p.overcurrentFactor) || 1.35;
    const voltageKv = Number(p.voltageKv) || 0.4;
    const ampI = (overcurrentFactor * proposedKvar) / (1.732 * voltageKv);

    return {
      theta1Deg, theta2Deg, tanTheta1, tanTheta2, tanThetaDiff,
      requiredKvar, proposedKvar, numFullSteps, remainderStep,
      initialKva, targetKva, initialKvar, targetKvar, ampI
    };
  };

  // Intelligence calculations & audit warnings
  const warningsList = useMemo(() => {
    const list: { type: 'critical' | 'warning' | 'info'; title: string; panelName: string; desc: string }[] = [];
    panels.forEach(p => {
      const initPf = Number(p.initialPf) || 0.8;
      const targetPf = Number(p.targetPf) || 0.9;
      const factor = Number(p.overcurrentFactor) || 1.35;

      if (targetPf > 0.98) {
        list.push({
          type: 'warning',
          title: 'Leading P.F. Over-correction Risk',
          panelName: p.name,
          desc: `Target P.F. of ${targetPf} is close to 1.0. Risk of leading P.F. causing resonance and utility penalties.`
        });
      }
      if (targetPf < 0.85) {
        list.push({
          type: 'critical',
          title: 'Sub-standard Target P.F.',
          panelName: p.name,
          desc: `Target P.F. ${targetPf} is below recommended standard minimum of 0.90.`
        });
      }
      if (initPf < 0.75) {
        list.push({
          type: 'warning',
          title: 'Low Initial Power Factor',
          panelName: p.name,
          desc: `Initial P.F. ${initPf} indicates high reactive current draw.`
        });
      }
      if (factor < 1.30) {
        list.push({
          type: 'warning',
          title: 'Low Overcurrent Safety Factor',
          panelName: p.name,
          desc: `Factor ${factor} is below IEEE 18 standard recommendation (1.35x).`
        });
      }
    });
    return list;
  }, [panels]);

  const complianceScore = useMemo(() => {
    if (panels.length === 0) return 100;
    const criticals = warningsList.filter(w => w.type === 'critical').length;
    const warnings = warningsList.filter(w => w.type === 'warning').length;
    const penalty = (criticals * 25) + (warnings * 10);
    return Math.max(0, 100 - penalty);
  }, [panels.length, warningsList]);

  const handleFixAllTargetPf = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const updated = panels.map(p => ({ ...p, targetPf: 0.95 }));
    setPanels(updated);
    saveToWorkspace(updated);
    toast.success("Set Target P.F. to 0.95 across all panels");
  };

  const handleOptimizeStepUnits = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const updated = panels.map(p => {
      const calc = calculatePanel(p);
      let stepUnit = 50;
      if (calc.proposedKvar <= 100) stepUnit = 25;
      else if (calc.proposedKvar > 500) stepUnit = 100;
      return { ...p, stepUnit };
    });
    setPanels(updated);
    saveToWorkspace(updated);
    toast.success("Optimized capacitor step sizes for all panels");
  };

  const handleFlagPoorPfPanels = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const updated = panels.map(p => {
      const initPf = Number(p.initialPf) || 0.8;
      return initPf < 0.80 ? { ...p, flagged: true } : p;
    });
    setPanels(updated);
    saveToWorkspace(updated);
    toast.info("Flagged panels with Initial P.F. < 0.80");
  };

  const exportExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    // @ts-ignore
    const { saveAs } = await import('file-saver');

    const wb = new ExcelJS.Workbook();
    
    const base64ImageURL = getDiagramBase64();
    const base64Data = base64ImageURL.replace(/^data:image\/(png|jpg);base64,/, "");
    
    const imageId = base64Data ? wb.addImage({
      base64: base64Data,
      extension: 'png',
    }) : null;

    panels.forEach(p => {
      const c = calculatePanel(p);
      const ws = wb.addWorksheet(p.name);
      
      const projName = projectObj?.name || project || "PFC Project";
      const rows = [
        ["PROJECT", ":", projName],
        [],
        ["SUB", ":", sub || "-"],
        [],
        ["PANEL REF", ":", p.panelRef],
        [],
        ["Total Connected Load", "=", `${Number(p.totalLoadKw || 0).toFixed(2)} kW`],
        ["", "", "(Including all standby, duty power and spares)"],
        [],
        ["Max Demand Load (IFC)", "=", `${Number(p.maxDemandLoadKw || 0).toFixed(2)} kW`],
        [],
        ["Assumed Existing P.F", "=", p.initialPf],
        [],
        ["Target P.F", "=", p.targetPf],
        [],
        ["Initial Power Factor", "=", p.initialPf],
        ["ie     Cosθ1", "=", Number(p.initialPf || 0).toFixed(2)],
        [],
        ["       θ1", "=", `${p.initialPf} Cos⁻¹`],
        ["", "=", c.theta1Deg.toFixed(2)],
        [],
        ["Corrective Power Factor", "=", p.targetPf],
        [],
        ["ie     Cosθ2", "=", Number(p.targetPf || 0).toFixed(2)],
        [],
        ["       θ2", "=", `${p.targetPf} Cos⁻¹`],
        ["", "=", c.theta2Deg.toFixed(2)],
        [],
        ["       Tan θ", "=", "Tan θ1 - Tan θ2"],
        [],
        ["", "=", c.tanThetaDiff.toFixed(3)],
        [],
        ["", "=", "kVAr/kW"],
        [],
        ["Therefore kVAr", "=", "kW x Tanθ"],
        [],
        ["", "=", `${c.requiredKvar.toFixed(2)} kVAr`],
        [],
        ["Proposed Capacitor Bank", "=", `${c.proposedKvar} kVAr`, "", "STEPS OF CAPACITOR BANK"],
        ...Array.from({ length: c.numFullSteps }).map((_, i) => (
          ["", "", "", "", `STEP-${i + 1} = ${p.stepUnit}kVAr(2x${p.stepUnit/2}kVAr)`]
        )),
        ...(c.remainderStep > 0 ? [["", "", "", "", `STEP-${c.numFullSteps + 1} = ${c.remainderStep}kVAr(2x${c.remainderStep/2}kVAr)`]] : []),
        ["", "", "", "", `TOTAL = ${c.proposedKvar} kVAr CAPACITORS`],
        [],
        ["Amp (I)", "=", `(${p.overcurrentFactor} X kVAr)/(1.732 X ${p.voltageKv})`],
        ["", "=", `${c.ampI.toFixed(2)} A`]
      ];

      ws.addRows(rows);

      ws.columns = [
        { width: 25 },
        { width: 3 },
        { width: 20 },
        { width: 5 },
        { width: 35 }
      ];

      // Formatting
      let stepStartRow = -1;
      let stepEndRow = -1;

      ws.eachRow((row, rowNumber) => {
        const cellA = row.getCell(1);
        if (cellA.value === 'Proposed Capacitor Bank' || cellA.value === 'PROJECT' || cellA.value === 'SUB' || cellA.value === 'PANEL REF') {
          cellA.font = { bold: true };
        }
        
        // Center align Column B (= or :)
        const cellB = row.getCell(2);
        if (cellB.value) {
            cellB.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Center align Column C (Values)
        const cellC = row.getCell(3);
        if (cellC.value !== null && cellC.value !== undefined && cellC.value !== "") {
            if (typeof cellC.value === 'string' && cellC.value.includes('standby')) {
                cellC.alignment = { horizontal: 'left', vertical: 'middle' };
            } else {
                cellC.alignment = { horizontal: 'center', vertical: 'middle' };
            }
        }
        
        const cellE = row.getCell(5); // Column E
        if (cellE.value === 'STEPS OF CAPACITOR BANK') {
          stepStartRow = rowNumber;
          cellE.font = { bold: true, underline: true };
          cellE.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        if (typeof cellE.value === 'string' && cellE.value.startsWith('TOTAL =')) {
          stepEndRow = rowNumber;
          cellE.font = { bold: true };
        }
      });

      if (stepStartRow !== -1 && stepEndRow !== -1) {
        for (let r = stepStartRow; r <= stepEndRow; r++) {
          const cell = ws.getCell(r, 5);
          cell.border = {
            top: r === stepStartRow ? { style: 'medium' as const } : undefined,
            bottom: r === stepEndRow ? { style: 'medium' as const } : undefined,
            left: { style: 'medium' as const },
            right: { style: 'medium' as const }
          };
        }
      }

      // Add image to Excel (Column E, Row 16)
      if (imageId !== null) {
        ws.addImage(imageId, {
          tl: { col: 4, row: 15 },
          ext: { width: 280, height: 180 }
        });
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "Capacitor_Bank_Calculations.xlsx");
  };

  const exportPdf = async () => {
    try {
      const doc = new jsPDF();
      const base64ImageURL = getDiagramBase64();

      const projName = projectObj?.name || project || "PFC Project";
      let currentY = addPdfHeader(doc, "P.F. CORRECTION CAPACITOR CALCULATION", {
        projectName: projName,
        calcNo: "TRV-CAP-001",
      });

      panels.forEach((p, index) => {
        if (index > 0) {
          doc.addPage();
          currentY = addPdfHeader(doc, "P.F. CORRECTION CAPACITOR CALCULATION", {
            projectName: projName,
            calcNo: "TRV-CAP-001",
          });
        }

        const c = calculatePanel(p);

        // Panel Section Title
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(`PANEL: ${p.name} (${p.panelRef})`, 14, currentY + 6);
        currentY += 10;

        // Table 1: Input Parameters
        const inputData = [
          ["Total Connected Load", `${Number(p.totalLoadKw || 0).toFixed(2)} kW`, "Sub / System Ref", sub || "-"],
          ["Max Demand Load (IFC)", `${Number(p.maxDemandLoadKw || 0).toFixed(2)} kW`, "System Voltage", `${p.voltageKv} kV`],
          ["Assumed Existing P.F (Cos θ1)", `${p.initialPf}`, "Target P.F (Cos θ2)", `${p.targetPf}`],
          ["Overcurrent Safety Factor", `${p.overcurrentFactor}`, "Capacitor Step Unit", `${p.stepUnit} kVAr`],
        ];

        autoTable(doc, {
          startY: currentY,
          head: [["Parameter", "Value", "Parameter", "Value"]],
          body: inputData,
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
          columnStyles: {
            0: { fontStyle: "bold", cellWidth: 45 },
            1: { cellWidth: 39 },
            2: { fontStyle: "bold", cellWidth: 45 },
            3: { cellWidth: 39 },
          },
          margin: { left: 14, right: 14 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        // Table 2: Calculations & Steps Breakdown
        const stepsDetail: string[] = [];
        for (let i = 0; i < c.numFullSteps; i++) {
          stepsDetail.push(`STEP-${i + 1}: ${p.stepUnit} kVAr (2x${p.stepUnit / 2}kVAr)`);
        }
        if (c.remainderStep > 0) {
          stepsDetail.push(`STEP-${c.numFullSteps + 1}: ${c.remainderStep} kVAr (2x${c.remainderStep / 2}kVAr)`);
        }

        const calcData = [
          ["Existing Angle (θ1)", `${c.theta1Deg.toFixed(2)}°`],
          ["Target Angle (θ2)", `${c.theta2Deg.toFixed(2)}°`],
          ["Tan θ (Tan θ1 - Tan θ2)", `${c.tanThetaDiff.toFixed(3)} kVAr/kW`],
          ["Required Reactive Power (Qc)", `${c.requiredKvar.toFixed(2)} kVAr`],
          ["Proposed Capacitor Bank", `${c.proposedKvar} kVAr`],
          ["Capacitor Steps Breakdown", stepsDetail.join(" | ") || `1 x ${c.proposedKvar} kVAr`],
          ["Required Breaker Amp (I)", `${c.ampI.toFixed(2)} A (Formula: [${p.overcurrentFactor} × ${c.proposedKvar}] / [1.732 × ${p.voltageKv}])`],
        ];

        autoTable(doc, {
          startY: currentY,
          head: [["Calculation Step / Metric", "Result"]],
          body: calcData,
          theme: "striped",
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold" },
          columnStyles: {
            0: { fontStyle: "bold", cellWidth: 60 },
            1: { cellWidth: 108 },
          },
          margin: { left: 14, right: 14 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 6;

        // Diagram Image
        if (base64ImageURL) {
          if (currentY + 55 > 270) {
            doc.addPage();
            currentY = 20;
          }
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 41, 59);
          doc.text("Power Factor Phasor Diagram:", 14, currentY + 4);
          doc.addImage(base64ImageURL, "JPEG", 14, currentY + 6, 85, 48);
          currentY += 56;
        }
      });

      if (currentY + 40 > 270) {
        doc.addPage();
        currentY = 15;
      }
      addPdfSignatureBlock(doc, currentY, currentUserName, projectObj?.name || project || "default", "capacitor-bank-sizing");

      const pdfBuffer = doc.output("arraybuffer");
      await downloadFile(new Uint8Array(pdfBuffer), "Capacitor_Bank_Calculations.pdf", "PDF Document", ["pdf"]);
      toast.success("PDF report generated successfully!");
    } catch (err: any) {
      console.error("Failed to export PDF:", err);
      toast.error(`PDF Export Error: ${err?.message || String(err)}`);
    }
  };

  const handleImportExcelRows = (mappedRows: any[]) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const newPanels: CapPanel[] = mappedRows.map((mr, idx) => ({
      id: `cap_import_${Date.now()}_${idx}`,
      name: mr.name || `Imported Panel ${idx + 1}`,
      panelRef: mr.panelRef || "",
      totalLoadKw: Number(mr.totalLoadKw) || 0,
      maxDemandLoadKw: Number(mr.maxDemandLoadKw) || 0,
      initialPf: Number(mr.existingPf) || 0.8,
      targetPf: Number(mr.targetPf) || 0.9,
      stepUnit: Number(mr.capacitorStepSize) || 50,
      voltageKv: Number(mr.voltageKv) || 0.4,
      overcurrentFactor: Number(mr.overcurrentFactor) || 1.35,
    }));
    const updated = [...panels, ...newPanels];
    setPanels(updated);
    saveToWorkspace(updated);
  };

  const actions = (
    <>
      <ImportExcelBtn
        columnMapping={{
          "Name": "name",
          "Panel Ref": "panelRef",
          "Total Load (kW)": "totalLoadKw",
          "Max Demand Load (kW)": "maxDemandLoadKw",
          "Existing PF": "existingPf",
          "Target PF": "targetPf",
          "Step Size": "capacitorStepSize",
          "Voltage (kV)": "voltageKv",
          "Overcurrent Factor": "overcurrentFactor",
        }}
        onImport={handleImportExcelRows}
      />
      <button
        onClick={exportExcel}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full border border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
      >
        <Download className="size-3.5 text-emerald-600" /> Export Excel
      </button>
      <button
        onClick={exportPdf}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full border border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
      >
        <FileText className="size-3.5 text-blue-600" /> Export PDF
      </button>
    </>
  );

  return (
    <AppShell title="Capacitor Bank Sizing" hideSubHeader={true}>
      <div className="flex flex-col h-full overflow-hidden pt-4 gap-4 bg-slate-50/30 dark:bg-slate-950/30 relative">
        
        {/* Breadcrumbs & Page Header */}
        <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg px-4 z-10">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">ELECTRICAL &gt; CAPACITOR BANK SIZING</span>
            <div className="flex items-center gap-3 mt-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Capacitor Bank Sizing</h1>
                <button
                  onClick={() => setIntelOpen(!intelOpen)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border transition-all cursor-pointer shadow-2xs ${
                    intelOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  Intelligence
                </button>
                <CalculationReviewBar projectId={projectObj?.id} calculatorPath="/capacitor-bank-sizing" calculatorTitle="Capacitor Bank Sizing" />
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              P.F. Correction Capacitor Calculation (Right-click or Double-click panels to edit & add comments)
            </p>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden p-4 z-10 min-h-0 gap-4">
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="w-full flex flex-col gap-4">
            
            {/* Filter & Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 py-2 min-h-[44px] border border-border/70 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl shrink-0 select-none gap-2 shadow-xs">
              {/* Left: Search + Filter + View Options */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter loads..."
                    className="h-7 w-full sm:w-56 pl-8 pr-3 bg-surface-2 text-foreground border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none transition-all"
                  />
                </div>

                {/* Filter Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                        filterStatus !== "all"
                          ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                          : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      }`}
                    >
                      <Filter className="size-3.5 shrink-0" />
                      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                        Filter
                      </span>
                      {filterStatus !== "all" && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                          1
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border">
                      <span className="text-xs font-bold text-foreground">Filter Panels</span>
                      {filterStatus !== "all" && (
                        <button onClick={() => setFilterStatus("all")} className="text-[10px] text-primary hover:underline font-semibold">
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => setFilterStatus("all")}
                        className={`px-2.5 py-1.5 text-xs text-left rounded-lg transition-colors font-medium flex items-center justify-between ${filterStatus === "all" ? "bg-primary/10 text-primary font-bold" : "hover:bg-surface-2 text-foreground"}`}
                      >
                        <span>All Panels ({panels.length})</span>
                      </button>
                      <button
                        onClick={() => setFilterStatus("flagged")}
                        className={`px-2.5 py-1.5 text-xs text-left rounded-lg transition-colors font-medium flex items-center justify-between ${filterStatus === "flagged" ? "bg-primary/10 text-primary font-bold" : "hover:bg-surface-2 text-foreground"}`}
                      >
                        <span>Flagged Panels ({panels.filter(p => p.flagged).length})</span>
                      </button>
                      <button
                        onClick={() => setFilterStatus("low_pf")}
                        className={`px-2.5 py-1.5 text-xs text-left rounded-lg transition-colors font-medium flex items-center justify-between ${filterStatus === "low_pf" ? "bg-primary/10 text-primary font-bold" : "hover:bg-surface-2 text-foreground"}`}
                      >
                        <span>Low Initial P.F. (&lt; 0.85)</span>
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* View Options Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                        sortBy !== "none"
                          ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                          : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      }`}
                    >
                      <SlidersHorizontal className="size-3.5 shrink-0" />
                      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                        View Options
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-56 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50">
                    <div className="pb-1.5 border-b border-border text-xs font-bold text-foreground">
                      View Options
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Sort By</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="h-8 w-full px-2 bg-surface-2 text-foreground border border-border rounded-lg text-xs outline-none cursor-pointer"
                      >
                        <option value="none">Original Order</option>
                        <option value="name">Panel Name (A-Z)</option>
                        <option value="load">Max Demand Load (High to Low)</option>
                      </select>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Right: Import Excel + Export Excel + Export PDF + New Row */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                <ImportExcelBtn
                  columnMapping={{
                    "Name": "name",
                    "Panel Ref": "panelRef",
                    "Total Load (kW)": "totalLoadKw",
                    "Max Demand Load (kW)": "maxDemandLoadKw",
                    "Existing PF": "existingPf",
                    "Target PF": "targetPf",
                    "Step Size": "capacitorStepSize",
                    "Voltage (kV)": "voltageKv",
                    "Overcurrent Factor": "overcurrentFactor",
                  }}
                  onImport={handleImportExcelRows}
                />
                <button
                  onClick={exportPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
                >
                  <FileText className="size-3.5 text-foreground" /> Export PDF
                </button>
                <button
                  onClick={addPanel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1 text-xs font-bold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="size-3.5" /> New Row
                </button>
              </div>
            </div>

            {filteredPanels.map((p) => {
              const isActive = activePanelId === p.id;
              const calc = calculatePanel(p);
              const commentCount = p.comments?.length || 0;
              
              return (
                <div 
                  key={p.id} 
                  onContextMenu={(e) => handlePanelContextMenu(e, p.id)}
                  onDoubleClick={(e) => handlePanelDoubleClick(p, e)}
                  className={`flex flex-col bg-white/60 dark:bg-black/40 backdrop-blur-xl border rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all overflow-hidden cursor-pointer ${isActive ? 'border-white/80 dark:border-white/30 shadow-lg' : 'border-white/50 dark:border-white/10 hover:border-white/80 dark:hover:border-white/30'} ${p.flagged ? 'ring-2 ring-red-500/40' : ''}`}
                  title="Double click to edit panel details"
                >
                  {/* Accordion Header */}
                  <div 
                    onClick={() => setActivePanelId(isActive ? null : p.id)}
                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between py-2 px-4 transition-colors ${isActive ? 'bg-primary/5' : 'bg-white/40 dark:bg-white/5 hover:bg-white/50 dark:hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${isActive ? 'bg-primary text-primary-foreground' : 'bg-surface-3 text-muted-foreground'}`}>
                          <Zap className="size-3" />
                        </div>
                        <input 
                          ref={el => { panelInputRefs.current[p.id] = el; }}
                          type="text"
                          value={p.name}
                          onChange={e => updatePanel(p.id, "name", e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => { e.stopPropagation(); setEditingPanel(p); }}
                          disabled={isApprovedLocked}
                          className={`bg-transparent outline-none font-bold text-sm w-36 focus:ring-1 focus:ring-primary/20 rounded px-1 transition-colors ${isActive ? 'text-primary' : 'text-foreground'}`}
                          placeholder="Panel Name"
                        />
                      </div>
                      <div className="h-4 w-px bg-border hidden sm:block"></div>
                      <input 
                        type="text"
                        value={p.panelRef}
                        onChange={e => updatePanel(p.id, "panelRef", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingPanel(p); }}
                        disabled={isApprovedLocked}
                        className="bg-transparent outline-none text-xs text-muted-foreground w-40 focus:ring-1 focus:ring-primary/20 rounded px-1 hidden sm:block"
                        placeholder="Panel Reference"
                      />

                      {p.flagged && (
                        <span title="Flagged Panel" className="p-0.5 rounded-full bg-red-500/10 text-red-500">
                          <Flag className="size-3 fill-red-500 text-red-500" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:block">Total Cap:</span>
                        <span className={`text-sm font-black font-mono ${isActive ? 'text-primary' : 'text-foreground'}`}>{calc.proposedKvar} <span className="text-[10px] font-bold text-muted-foreground">kVAr</span></span>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleOpenCommentModal(p, e)}
                          className={`p-1 px-1.5 rounded-full flex items-center gap-1 text-[11px] font-bold transition-colors ${
                            commentCount > 0
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 border border-amber-500/30"
                              : "hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400"
                          }`}
                          title={commentCount > 0 ? `${commentCount} comment(s) - Click to add/view` : "Add comment / task"}
                        >
                          <MessageSquare className="size-3.5" />
                          {commentCount > 0 && <span>{commentCount}</span>}
                        </button>

                        <button 
                          onClick={(e) => removePanel(p.id, e)}
                          disabled={isApprovedLocked}
                          className={`p-1 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors ${panels.length <= 1 ? 'hidden' : ''}`}
                          title="Remove Panel"
                        >
                          <X className="size-3.5" />
                        </button>
                        <div className="p-0.5">
                          {isActive ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Accordion Body (Expanded Content) */}
                  {isActive && (
                    <div className="p-3 sm:p-4 border-t border-border/50 animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] xl:grid-cols-[3fr_2fr] gap-4">
                        
                        {/* LEFT COLUMN - INPUTS & MATH */}
                        <div className="flex flex-col gap-3">
                          
                          {/* Inputs Card */}
                          <div className="bg-white/40 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden">
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                              
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Total Connected Load (kW)</label>
                                <input type="number" disabled={isApprovedLocked} className="h-7 px-2 bg-surface-1 border border-border rounded outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all font-mono text-[11px]" value={p.totalLoadKw} onChange={e => updatePanel(p.id, "totalLoadKw", e.target.value === "" ? "" : Number(e.target.value))} />
                              </div>
                              
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Max Demand Load (IFC)</label>
                                <input type="number" disabled={isApprovedLocked} className="h-7 px-2 bg-primary/5 border border-primary/20 rounded outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary transition-all font-mono text-[11px] text-primary font-bold" value={p.maxDemandLoadKw} onChange={e => updatePanel(p.id, "maxDemandLoadKw", e.target.value === "" ? "" : Number(e.target.value))} />
                              </div>

                              <div className="col-span-1 sm:col-span-2 h-px bg-border/50 my-0.5"></div>

                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Assumed Existing P.F.</label>
                                <input type="number" step="0.01" disabled={isApprovedLocked} className="h-7 px-2 bg-surface-1 border border-border rounded outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all font-mono text-[11px]" value={p.initialPf} onChange={e => updatePanel(p.id, "initialPf", e.target.value === "" ? "" : Number(e.target.value))} />
                              </div>
                              
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Target P.F.</label>
                                <input type="number" step="0.01" disabled={isApprovedLocked} className="h-7 px-2 bg-surface-1 border border-border rounded outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all font-mono text-[11px]" value={p.targetPf} onChange={e => updatePanel(p.id, "targetPf", e.target.value === "" ? "" : Number(e.target.value))} />
                              </div>

                              <div className="col-span-1 sm:col-span-2 h-px bg-border/50 my-0.5"></div>

                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">System Voltage (kV)</label>
                                <input type="number" step="0.01" disabled={isApprovedLocked} className="h-7 px-2 bg-surface-1 border border-border rounded outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all font-mono text-[11px]" value={p.voltageKv} onChange={e => updatePanel(p.id, "voltageKv", e.target.value === "" ? "" : Number(e.target.value))} />
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Capacitor Step Unit (kVAr)</label>
                                <input type="number" step="5" disabled={isApprovedLocked} className="h-7 px-2 bg-surface-1 border border-border rounded outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all font-mono text-[11px]" value={p.stepUnit} onChange={e => updatePanel(p.id, "stepUnit", e.target.value === "" ? "" : Number(e.target.value))} />
                              </div>

                              <div className="col-span-1 sm:col-span-2 flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Overcurrent Safety Factor</label>
                                <input type="number" step="0.05" disabled={isApprovedLocked} className="h-7 px-2 bg-surface-1 border border-border rounded outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all font-mono text-[11px]" value={p.overcurrentFactor} onChange={e => updatePanel(p.id, "overcurrentFactor", e.target.value === "" ? "" : Number(e.target.value))} />
                              </div>

                            </div>
                          </div>

                        </div>

                        {/* RIGHT COLUMN - HERO & STEPS & MATH */}
                        <div className="flex flex-col gap-3">
                          
                          {/* Hero Result Card */}
                          <div className="bg-primary rounded-2xl shadow-xl overflow-hidden relative border border-primary/20">
                            {/* Decorative background circle */}
                            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
                            
                            <div className="p-4 flex flex-col gap-3 relative z-10">
                              <div className="flex flex-col">
                                <span className="text-primary-foreground/80 text-[9px] font-bold uppercase tracking-widest">Proposed Capacitor Bank</span>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-3xl font-black tracking-tight text-white">{calc.proposedKvar}</span>
                                  <span className="text-sm font-bold text-primary-foreground/90">kVAr</span>
                                </div>
                              </div>

                              <div className="h-px bg-white/20 w-full"></div>

                              <div className="flex flex-col">
                                <span className="text-primary-foreground/80 text-[9px] font-bold uppercase tracking-widest mb-0.5">Required Breaker Amp (I)</span>
                                <div className="flex items-center justify-between">
                                  <span className="text-xl font-black text-white drop-shadow-sm tracking-tight">
                                    {calc.ampI.toFixed(2)} A
                                  </span>
                                  <span className="text-[9px] font-mono text-primary-foreground/90 bg-black/10 px-1.5 py-0.5 rounded border border-white/10">
                                    ({p.overcurrentFactor}×kVAr)/(1.732×{p.voltageKv})
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Math Breakdown Accordion */}
                          <div className="bg-white/40 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl shadow-xl p-4 h-full flex flex-col justify-center gap-4 relative overflow-hidden">
                            <button 
                              onClick={() => setShowMathId(showMathId === p.id ? null : p.id)}
                              className="w-full bg-surface-1/50 hover:bg-surface-2 transition-colors border-b border-border px-3 py-2 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-1.5">
                                <Activity className="size-3 text-muted-foreground" />
                                <h2 className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground">Mathematical Breakdown</h2>
                              </div>
                              {showMathId === p.id ? <ChevronUp className="size-3 text-muted-foreground" /> : <ChevronDown className="size-3 text-muted-foreground" />}
                            </button>
                            
                            {showMathId === p.id && (
                              <div className="p-3 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200 bg-surface-1/20">
                                <div className="flex items-center justify-between pb-1.5 border-b border-border/50 text-[10px]">
                                  <span className="text-muted-foreground">Initial P.F (Cos θ1) = {(Number(p.initialPf) || 0).toFixed(2)}</span>
                                  <span className="font-mono">θ1 = {calc.theta1Deg.toFixed(1)}°</span>
                                </div>
                                <div className="flex items-center justify-between pb-1.5 border-b border-border/50 text-[10px]">
                                  <span className="text-muted-foreground">Corrective P.F (Cos θ2) = {(Number(p.targetPf) || 0).toFixed(2)}</span>
                                  <span className="font-mono">θ2 = {calc.theta2Deg.toFixed(1)}°</span>
                                </div>
                                <div className="flex items-center justify-between pb-1.5 border-b border-border/50 text-[10px]">
                                  <span className="text-muted-foreground">Tan θ (Tan θ1 - Tan θ2)</span>
                                  <span className="font-mono text-primary font-medium">{calc.tanThetaDiff.toFixed(3)}</span>
                                </div>
                                
                                <div className="bg-primary/5 rounded p-2 border border-primary/10 flex items-center justify-between mt-1">
                                  <span className="text-primary font-bold text-[9px] uppercase tracking-wider">kVAr = kW × Tan θ</span>
                                  <span className="font-mono font-bold text-primary text-[10px]">{calc.requiredKvar.toFixed(2)} kVAr</span>
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            <button 
              onClick={addPanel}
              disabled={isApprovedLocked}
              className="w-full flex items-center justify-center gap-1 py-3 border border-dashed border-primary/30 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary font-bold transition-all text-sm disabled:opacity-50"
            >
              <Plus className="size-4" /> Add New Panel
            </button>

          </div>
          </div>

          {/* Live Intelligence Side Drawer */}
          <div
            className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-out select-none no-print ${
              intelOpen ? "w-[360px] border border-border rounded-2xl bg-white/90 dark:bg-black/90 backdrop-blur-xl shadow-xl flex flex-col" : "w-0 hidden"
            }`}
          >
            {intelOpen && (
              <div className="w-[360px] h-full flex flex-col min-h-0 font-sans">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-surface-1 shrink-0 rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Live Intelligence & Audit</h3>
                  </div>
                  <button onClick={() => setIntelOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded hover:bg-surface-2">
                    <X className="size-4" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  {/* IEEE Compliance Scorecard */}
                  <div className="border border-border rounded-2xl p-4 bg-background shadow-xs flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">IEEE 18 Compliance Score</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        complianceScore === 100 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}>
                        {complianceScore === 100 ? "IEEE Compliant" : `${warningsList.length} Action(s) Needed`}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-[26px] font-extrabold font-mono text-foreground leading-none">
                        {complianceScore}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              complianceScore === 100 ? "bg-emerald-500" : complianceScore >= 70 ? "bg-amber-500" : "bg-red-500"
                            }`}
                            style={{ width: `${complianceScore}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-medium">
                          <span>{panels.length} Total Panels</span>
                          <span>{panels.length - warningsList.filter(w => w.type === 'critical').length} Compliant</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Quick Optimizers */}
                  <div className="border border-border rounded-2xl p-4 bg-background shadow-xs flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground">AI Quick Optimizers</h4>
                      <span className="text-[9px] font-semibold text-primary uppercase tracking-wider">1-Click Actions</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Automatically optimize target power factor, capacitor step units, and panel flagging.
                    </p>
                    
                    <div className="flex flex-col gap-2 mt-1">
                      <button
                        onClick={handleFixAllTargetPf}
                        disabled={isApprovedLocked}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-left transition-all cursor-pointer flex items-center justify-between shadow-2xs disabled:opacity-50"
                      >
                        <span>⚡ Set Target P.F. to 0.95 (All Panels)</span>
                        <span className="text-[9px] font-mono text-primary/70">Auto-set</span>
                      </button>

                      <button
                        onClick={handleOptimizeStepUnits}
                        disabled={isApprovedLocked}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-left transition-all cursor-pointer flex items-center justify-between shadow-2xs disabled:opacity-50"
                      >
                        <span>🔄 Balance Capacitor Step Sizes</span>
                        <span className="text-[9px] font-mono text-primary/70">Auto-step</span>
                      </button>

                      <button
                        onClick={handleFlagPoorPfPanels}
                        disabled={isApprovedLocked}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 text-left transition-all cursor-pointer flex items-center justify-between shadow-2xs disabled:opacity-50"
                      >
                        <span>🚩 Flag Low P.F. Panels (&lt; 0.80)</span>
                        <span className="text-[9px] font-mono text-amber-500">Auto-flag</span>
                      </button>
                    </div>
                  </div>

                  {/* Audit Warnings */}
                  <div className="border border-border rounded-2xl p-4 bg-background shadow-xs flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-primary" />
                      <span>Engineering Audit Findings ({warningsList.length})</span>
                    </h4>

                    {warningsList.length === 0 ? (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="size-4 shrink-0" />
                        <span>All capacitor bank parameters meet IEEE 18 & NEC 460 standards!</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {warningsList.map((w, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border text-[11px] flex flex-col gap-1 ${
                              w.type === 'critical'
                                ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                                : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1">
                                <AlertCircle className="size-3.5 shrink-0" />
                                {w.title}
                              </span>
                              <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-black/10">
                                {w.panelName}
                              </span>
                            </div>
                            <p className="text-[10.5px] opacity-90 leading-tight">
                              {w.desc}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Floating Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-white dark:bg-slate-900 border border-border/80 rounded-xl shadow-2xl py-1.5 w-56 text-xs text-foreground animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 font-bold text-[10px] uppercase text-muted-foreground tracking-wider border-b border-border/50 flex items-center justify-between">
            <span>Panel Options</span>
            <span className="font-mono text-[9px] text-primary truncate max-w-[100px]">
              {panels.find(p => p.id === contextMenu.panelId)?.name}
            </span>
          </div>

          <button
            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer"
            onClick={() => {
              const p = panels.find(item => item.id === contextMenu.panelId);
              if (p) handleOpenCommentModal(p);
              setContextMenu(null);
            }}
          >
            <MessageSquare className="size-3.5 text-primary" />
            <span>Add Comment / Task</span>
          </button>

          <button
            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer"
            onClick={() => {
              const p = panels.find(item => item.id === contextMenu.panelId);
              if (p) setEditingPanel(p);
              setContextMenu(null);
            }}
          >
            <Edit3 className="size-3.5 text-amber-500" />
            <span>Edit Panel Details</span>
          </button>

          <button
            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer"
            onClick={() => {
              handleDuplicatePanel(contextMenu.panelId);
              setContextMenu(null);
            }}
          >
            <Copy className="size-3.5 text-blue-500" />
            <span>Duplicate Panel</span>
          </button>

          <button
            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer"
            onClick={() => {
              handleToggleFlagPanel(contextMenu.panelId);
              setContextMenu(null);
            }}
          >
            <Flag className={`size-3.5 ${panels.find(p => p.id === contextMenu.panelId)?.flagged ? 'text-red-500 fill-red-500' : 'text-slate-400'}`} />
            <span>{panels.find(p => p.id === contextMenu.panelId)?.flagged ? 'Unflag Panel' : 'Flag Panel'}</span>
          </button>

          {panels.length > 1 && (
            <>
              <div className="h-px bg-border/50 my-1"></div>
              <button
                className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-500 flex items-center gap-2 transition-colors cursor-pointer"
                onClick={(e) => {
                  removePanel(contextMenu.panelId, e as any);
                  setContextMenu(null);
                }}
              >
                <Trash2 className="size-3.5" />
                <span>Delete Panel</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Edit Panel Modal */}
      {editingPanel && (
        <EditCapPanelModal
          isOpen={Boolean(editingPanel)}
          panel={editingPanel}
          onClose={() => setEditingPanel(null)}
          onSave={handleSaveModalPanel}
        />
      )}

      {/* Assign Comment Modal */}
      {commentModalOpen && commentTargetPanel && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentTargetPanel(null);
          }}
          targetId={commentTargetPanel.id}
          targetName={commentTargetPanel.name}
          targetType="Capacitor Bank Panel"
          calculatorTitle="Capacitor Bank Sizing"
          calculatorPath="/capacitor-bank-sizing"
          existingComments={commentTargetPanel.comments || []}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}

interface EditCapPanelModalProps {
  panel: CapPanel | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPanel: CapPanel) => void;
}

function EditCapPanelModal({ panel, isOpen, onClose, onSave }: EditCapPanelModalProps) {
  const [formData, setFormData] = useState<CapPanel | null>(panel);

  useEffect(() => {
    setFormData(panel);
  }, [panel]);

  if (!isOpen || !formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSave(formData);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-1">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <h3 className="font-bold text-base text-foreground">Edit Panel Details</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-muted-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Panel Name</label>
              <input 
                type="text" 
                className="h-9 px-3 bg-surface-2 border border-border rounded-xl text-xs outline-none focus:border-primary font-bold"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Panel Reference</label>
              <input 
                type="text" 
                className="h-9 px-3 bg-surface-2 border border-border rounded-xl text-xs outline-none focus:border-primary font-medium text-muted-foreground"
                value={formData.panelRef}
                onChange={e => setFormData({ ...formData, panelRef: e.target.value })}
              />
            </div>
          </div>

          <div className="h-px bg-border/50"></div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Total Connected Load (kW)</label>
              <input 
                type="number" 
                step="0.1"
                className="h-9 px-3 bg-surface-2 border border-border rounded-xl text-xs outline-none focus:border-primary font-mono"
                value={formData.totalLoadKw}
                onChange={e => setFormData({ ...formData, totalLoadKw: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Max Demand Load (kW)</label>
              <input 
                type="number" 
                step="0.1"
                className="h-9 px-3 bg-surface-2 border border-border rounded-xl text-xs outline-none focus:border-primary font-mono font-bold text-primary"
                value={formData.maxDemandLoadKw}
                onChange={e => setFormData({ ...formData, maxDemandLoadKw: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Assumed Existing P.F.</label>
              <input 
                type="number" 
                step="0.01"
                className="h-9 px-3 bg-surface-2 border border-border rounded-xl text-xs outline-none focus:border-primary font-mono"
                value={formData.initialPf}
                onChange={e => setFormData({ ...formData, initialPf: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Target P.F.</label>
              <input 
                type="number" 
                step="0.01"
                className="h-9 px-3 bg-surface-2 border border-border rounded-xl text-xs outline-none focus:border-primary font-mono"
                value={formData.targetPf}
                onChange={e => setFormData({ ...formData, targetPf: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold uppercase text-muted-foreground">Voltage (kV)</label>
              <input 
                type="number" 
                step="0.01"
                className="h-9 px-2 bg-surface-2 border border-border rounded-xl text-xs outline-none focus:border-primary font-mono"
                value={formData.voltageKv}
                onChange={e => setFormData({ ...formData, voltageKv: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold uppercase text-muted-foreground">Step Unit (kVAr)</label>
              <input 
                type="number" 
                step="5"
                className="h-9 px-2 bg-surface-2 border border-border rounded-xl text-xs outline-none focus:border-primary font-mono"
                value={formData.stepUnit}
                onChange={e => setFormData({ ...formData, stepUnit: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold uppercase text-muted-foreground">Safety Factor</label>
              <input 
                type="number" 
                step="0.05"
                className="h-9 px-2 bg-surface-2 border border-border rounded-xl text-xs outline-none focus:border-primary font-mono"
                value={formData.overcurrentFactor}
                onChange={e => setFormData({ ...formData, overcurrentFactor: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input 
              type="checkbox"
              id="flag-check"
              checked={Boolean(formData.flagged)}
              onChange={e => setFormData({ ...formData, flagged: e.target.checked })}
              className="size-4 rounded cursor-pointer"
            />
            <label htmlFor="flag-check" className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5">
              <Flag className={`size-3.5 ${formData.flagged ? 'text-red-500 fill-red-500' : 'text-slate-400'}`} />
              Flag panel for review
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-surface-1 hover:bg-surface-2 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-sm"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getDiagramBase64() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return "";
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 250;
  const ctx = canvas.getContext('2d');
  if (!ctx) return "";
  
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 400, 250);
  
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1.5;
  ctx.font = '13px Arial';
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const originX = 60;
  const originY = 200;
  const kwWidth = 200;
  const kvar1Height = 150; 
  const kvar2Height = 80;  
  
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(originX + kwWidth, originY);
  ctx.stroke();
  ctx.fillText("KW", originX + kwWidth/2, originY + 15);
  
  ctx.beginPath();
  ctx.moveTo(originX + kwWidth, originY);
  ctx.lineTo(originX + kwWidth, originY - kvar1Height);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(originX + kwWidth, originY - kvar1Height);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(originX + kwWidth, originY - kvar2Height);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.arc(originX, originY, 40, 0, -Math.atan2(kvar2Height, kwWidth), true);
  ctx.stroke();
  ctx.fillText("θ2", originX + 50, originY - 10);
  
  ctx.beginPath();
  ctx.arc(originX, originY, 70, 0, -Math.atan2(kvar1Height, kwWidth), true);
  ctx.stroke();
  ctx.fillText("θ1", originX + 80, originY - 25);
  
  ctx.fillText("θ", originX + 100, originY - 50);

  const dimX1 = originX + kwWidth + 20;
  ctx.beginPath();
  ctx.moveTo(originX + kwWidth + 5, originY);
  ctx.lineTo(dimX1 + 10, originY);
  ctx.moveTo(originX + kwWidth + 5, originY - kvar2Height);
  ctx.lineTo(dimX1 + 10, originY - kvar2Height);
  ctx.moveTo(dimX1, originY);
  ctx.lineTo(dimX1, originY - kvar2Height);
  ctx.stroke();
  
  ctx.save();
  ctx.translate(dimX1 - 8, originY - kvar2Height/2);
  ctx.rotate(-Math.PI/2);
  ctx.fillText("KVAR - II", 0, 0);
  ctx.restore();
  
  const dimX2 = originX + kwWidth + 50;
  ctx.beginPath();
  ctx.moveTo(dimX1 + 10, originY); 
  ctx.lineTo(dimX2 + 10, originY);
  ctx.moveTo(originX + kwWidth + 5, originY - kvar1Height);
  ctx.lineTo(dimX2 + 10, originY - kvar1Height);
  ctx.moveTo(dimX2, originY);
  ctx.lineTo(dimX2, originY - kvar1Height);
  ctx.stroke();
  
  ctx.save();
  ctx.translate(dimX2 - 8, originY - kvar1Height/2);
  ctx.rotate(-Math.PI/2);
  ctx.fillText("KVAR - I", 0, 0);
  ctx.restore();
  
  ctx.save();
  const angleKva = -Math.atan2(kvar1Height, kwWidth);
  ctx.translate(originX + kwWidth/2 - 15, originY - kvar1Height/2 - 15);
  ctx.rotate(angleKva);
  ctx.fillText("KVA", 0, 0);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.95);
}
