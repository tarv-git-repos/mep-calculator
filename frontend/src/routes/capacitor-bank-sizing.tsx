import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock, addPdfHeader } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { Download, Plus, X, ChevronDown, ChevronUp, Zap, Activity, FileText, MessageSquare, Copy, Trash2, Edit3, Sparkles, AlertCircle, CheckCircle2, ShieldCheck, Search, Filter, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-store";
import { api } from "@/services/api";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { UnitToggle } from "@/components/workspace/UnitToggle";
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
  overcurrentFactor: 1.35,
  voltageKv: 0.4
});

function generateCapBankSteps(proposedKvar: number, stepUnit: number) {
  const steps: string[] = [];
  const unit = Number(stepUnit) || 50;
  const halfUnit = unit / 2;
  
  const remainder = proposedKvar % unit;
  const numFullSteps = Math.floor(proposedKvar / unit);

  let stepIdx = 1;
  if (remainder > 0) {
    steps.push(`STEP-${stepIdx} = ${remainder}kVAr`);
    stepIdx++;
  }

  for (let i = 0; i < numFullSteps; i++) {
    steps.push(`STEP-${stepIdx} = ${unit}kVAr(${halfUnit === 25 ? "2x25kVAr" : `2x${halfUnit}kVAr`})`);
    stepIdx++;
  }

  return steps;
}

function drawPdfThetaText(doc: jsPDF, text: string, x: number, y: number, isBold: boolean = false) {
  const fontStyle = isBold ? "bold" : "normal";
  let currentX = x;

  const parts = text.split(/(θ1|θ2|θ|Cos⁻¹|Cos⁻1)/g);

  parts.forEach((part) => {
    if (!part) return;
    if (part === "θ1") {
      doc.setFont("symbol", "normal");
      doc.text("q", currentX, y);
      currentX += doc.getTextWidth("q");
      doc.setFont("helvetica", fontStyle);
      doc.text("1", currentX, y);
      currentX += doc.getTextWidth("1");
    } else if (part === "θ2") {
      doc.setFont("symbol", "normal");
      doc.text("q", currentX, y);
      currentX += doc.getTextWidth("q");
      doc.setFont("helvetica", fontStyle);
      doc.text("2", currentX, y);
      currentX += doc.getTextWidth("2");
    } else if (part === "θ") {
      doc.setFont("symbol", "normal");
      doc.text("q", currentX, y);
      currentX += doc.getTextWidth("q");
      doc.setFont("helvetica", fontStyle);
    } else if (part === "Cos⁻¹" || part === "Cos⁻1") {
      doc.setFont("helvetica", fontStyle);
      doc.text("Cos-1", currentX, y);
      currentX += doc.getTextWidth("Cos-1");
    } else {
      doc.setFont("helvetica", fontStyle);
      doc.text(part, currentX, y);
      currentX += doc.getTextWidth(part);
    }
  });
}

function CapacitorBankSizingPage() {
  const { activeProjectId, project: projectObj } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/capacitor-bank-sizing", activeProjectId || projectObj?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/capacitor-bank-sizing", activeProjectId || projectObj?.id);
  const { userData, profile } = useAuth();
  const isApprovedLocked = useCalculationLock("/capacitor-bank-sizing", projectObj?.id);
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const [project, setProject] = useState("");
  const [sub, setSub] = useState("");
  
  const [panels, setPanels] = useState<CapPanel[]>([defaultPanel(1)]);
  const [activePanelId, setActivePanelId] = useState<string | null>("1");
  const [nextId, setNextId] = useState(2);
  const [showMathId, setShowMathId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "low_pf">("all");
  const [sortBy, setSortBy] = useState<"none" | "name" | "load">("none");

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; panelId: string } | null>(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetPanel, setCommentTargetPanel] = useState<CapPanel | null>(null);
  const [editingPanel, setEditingPanel] = useState<CapPanel | null>(null);
  const [intelOpen, setIntelOpen] = useState(false);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

  const panelInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const filteredPanels = useMemo(() => {
    let list = [...panels];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.panelRef.toLowerCase().includes(q));
    }
    if (filterStatus === "low_pf") {
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
        if (cbc.unitSystem === "si" || cbc.unitSystem === "ip") {
          setUnitSystem(cbc.unitSystem);
        }
        if (cbc.project !== undefined) setProject(cbc.project);
        if (cbc.sub !== undefined) setSub(cbc.sub);
      }
    }
  }, [projectObj?.id]);

  // Sync state changes to workspace_data
  const saveToWorkspace = (updatedPanels: CapPanel[], projName: string = project, subRef: string = sub, curUnit: "si" | "ip" = unitSystem) => {
    if (!projectObj?.id) return;
    try {
      let wdata = projectObj.workspace_data || {};
      if (typeof wdata === "string") {
        try { wdata = JSON.parse(wdata); } catch(e) {}
      }
      wdata.capacitor_bank_calc = {
        panels: updatedPanels,
        unitSystem: curUnit,
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

  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    if (targetUnit === unitSystem) return;

    if (shouldConvert) {
      const factor = targetUnit === "ip" ? (1 / 0.746) : 0.746;
      const updated = panels.map(p => ({
        ...p,
        totalLoadKw: p.totalLoadKw === "" ? "" : Number((Number(p.totalLoadKw) * factor).toFixed(1)),
        maxDemandLoadKw: p.maxDemandLoadKw === "" ? "" : Number((Number(p.maxDemandLoadKw) * factor).toFixed(1)),
      }));
      setPanels(updated);
      saveToWorkspace(updated, project, sub, targetUnit);
    } else {
      saveToWorkspace(panels, project, sub, targetUnit);
    }
    setUnitSystem(targetUnit);
    toast.success(`Switched unit system to ${targetUnit.toUpperCase()}`);
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
    const demandRaw = Number(p.maxDemandLoadKw) || 0;
    const demand = unitSystem === "ip" ? demandRaw * 0.746 : demandRaw;
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

      panels.forEach((p, index) => {
        if (index > 0) {
          doc.addPage();
        }

        let currentY = addPdfHeader(doc, "P.F. CORRECTION CAPACITOR CALCULATION", {
          projectName: projName,
          calcNo: `TRV-CAP-00${index + 1}`,
        });

        const c = calculatePanel(p);

        // Header Sub & Panel Ref section
        currentY += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);

        doc.text("SUB", 14, currentY);
        doc.text(":", 40, currentY);
        doc.text("P.F. CORRECTION CAPACITOR CALCULATION", 46, currentY);

        currentY += 5.5;
        doc.text("PANEL REF", 14, currentY);
        doc.text(":", 40, currentY);
        doc.text(`PFC ${c.proposedKvar}kVAr (${p.panelRef || p.name})`, 46, currentY);

        currentY += 10;

        const startY = currentY;
        let leftY = startY;

        // Left Column (Calculations)
        doc.setFontSize(8.5);

        // Total Connected Load
        doc.setFont("helvetica", "normal");
        doc.text("Total Connected Load", 14, leftY);
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        doc.text(`${Number(p.totalLoadKw || 0).toFixed(1)} ${unitSystem === "ip" ? "HP" : "kW"}`, 72, leftY);
        leftY += 3.8;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 100);
        doc.text("(Including all standby, duty power and spares)", 72, leftY);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8.5);
        leftY += 6;

        // Max Demand Load (IFC)
        doc.setFont("helvetica", "normal");
        doc.text("Max Demand Load (IFC)", 14, leftY);
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        doc.text(`${Number(p.maxDemandLoadKw || 0).toFixed(1)} ${unitSystem === "ip" ? "HP" : "kW"}`, 72, leftY);
        leftY += 7;

        // Assumed Existing P.F
        doc.setFont("helvetica", "normal");
        doc.text("Assumed Existing P.F", 14, leftY);
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        doc.setFont("helvetica", "normal");
        doc.text(`${p.initialPf}`, 72, leftY);
        leftY += 7;

        // Target P.F
        doc.setFont("helvetica", "normal");
        doc.text("Target P.F", 14, leftY);
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        doc.setFont("helvetica", "normal");
        doc.text(`${p.targetPf}`, 72, leftY);
        leftY += 9;

        // Initial Power Factor
        doc.setFont("helvetica", "normal");
        doc.text("Initial Power Factor", 14, leftY);
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        doc.setFont("helvetica", "normal");
        doc.text(`${p.initialPf}`, 72, leftY);
        leftY += 6;

        // ie Cos θ1
        drawPdfThetaText(doc, "ie     Cos θ1", 14, leftY);
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        doc.setFont("helvetica", "normal");
        doc.text(`${(Number(p.initialPf) || 0).toFixed(2)}`, 72, leftY);
        leftY += 6;

        // θ1
        drawPdfThetaText(doc, "        θ1", 14, leftY);
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        drawPdfThetaText(doc, `${p.initialPf} Cos-1`, 72, leftY);
        leftY += 5.5;
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        doc.text(`${c.theta1Deg.toFixed(2)}`, 72, leftY);
        leftY += 9;

        // Corrective Power Factor
        doc.setFont("helvetica", "normal");
        doc.text("Corrective Power Factor", 14, leftY);
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        doc.setFont("helvetica", "normal");
        doc.text(`${p.targetPf}`, 72, leftY);
        leftY += 6;

        // ie Cos θ2
        drawPdfThetaText(doc, "ie     Cos θ2", 14, leftY);
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        doc.setFont("helvetica", "normal");
        doc.text(`${(Number(p.targetPf) || 0).toFixed(2)}`, 72, leftY);
        leftY += 6;

        // θ2
        drawPdfThetaText(doc, "        θ2", 14, leftY);
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        drawPdfThetaText(doc, `${p.targetPf} Cos-1`, 72, leftY);
        leftY += 5.5;
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        doc.text(`${c.theta2Deg.toFixed(2)}`, 72, leftY);
        leftY += 9;

        // Tan θ
        drawPdfThetaText(doc, "Tan θ", 14, leftY);
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        drawPdfThetaText(doc, "Tan θ1 - Tan θ2", 72, leftY);
        leftY += 5.5;
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        doc.setFont("helvetica", "normal");
        doc.text(`${c.tanThetaDiff.toFixed(3)}`, 72, leftY);
        leftY += 5.5;
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        doc.setFont("helvetica", "italic");
        doc.text(unitSystem === "ip" ? "kVAr/HP" : "kVAr/kW", 72, leftY);
        leftY += 9;

        // Therefore kVAr
        doc.setFont("helvetica", "normal");
        doc.text("Therefore kVAr", 14, leftY);
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        drawPdfThetaText(doc, unitSystem === "ip" ? "(HP x 0.746) x Tan θ" : "kW x Tan θ", 72, leftY);
        leftY += 5.5;
        doc.setFont("helvetica", "bold");
        doc.text("=", 64, leftY);
        doc.text(`${c.requiredKvar.toFixed(2)} kVAr`, 72, leftY);
        leftY += 9;

        // Proposed Capacitor Bank
        doc.setFont("helvetica", "bold");
        doc.text("Proposed Capacitor Bank", 14, leftY);
        doc.text("=", 64, leftY);
        doc.text(`${c.proposedKvar} kVAr`, 72, leftY);
        leftY += 8;

        // Right Column: Phasor Diagram Image + Steps Box
        const rightX = 120;
        const rightWidth = 76;

        if (base64ImageURL) {
          doc.addImage(base64ImageURL, "PNG", rightX, startY + 24, rightWidth, 44);
        }

        // Steps Box
        const stepsList = generateCapBankSteps(c.proposedKvar, Number(p.stepUnit) || 50);
        const boxY = startY + 75;
        const lineSpacing = 5;
        const boxHeaderHeight = 9;
        const boxFooterHeight = 8;
        const boxHeight = boxHeaderHeight + (stepsList.length * lineSpacing) + boxFooterHeight + 4;

        // Box border
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.rect(rightX, boxY, rightWidth, boxHeight);

        // Header Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        const titleText = "STEPS OF CAPACITOR BANK";
        const titleWidth = doc.getTextWidth(titleText);
        const titleX = rightX + (rightWidth - titleWidth) / 2;
        doc.text(titleText, titleX, boxY + 6);
        doc.line(titleX, boxY + 6.8, titleX + titleWidth, boxY + 6.8);

        // Step lines
        let stepY = boxY + boxHeaderHeight + 2;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);

        stepsList.forEach((stepText) => {
          doc.text(stepText, rightX + 4, stepY);
          stepY += lineSpacing;
        });

        // Box Footer
        stepY += 1.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(`TOTAL = ${c.proposedKvar}kVAr CAPACITORS`, rightX + 4, stepY);

        // Sign off block at bottom
        const maxY = Math.max(leftY, boxY + boxHeight + 10);
        if (maxY + 40 > 270) {
          doc.addPage();
          addPdfSignatureBlock(doc, 20, currentUserName, projectObj?.id || "default", "/capacitor-bank-sizing");
        } else {
          addPdfSignatureBlock(doc, maxY + 5, currentUserName, projectObj?.id || "default", "/capacitor-bank-sizing");
        }
      });

      doc.save(`Capacitor_Bank_Calculation_${projName.replace(/\s+/g, "_")}.pdf`);
      toast.success("Exported Capacitor Bank Calculation PDF");
    } catch (err) {
      console.error("PDF Export error:", err);
      toast.error("Failed to generate PDF");
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
        <FileText className="size-3.5 text-blue-600" /> Export
      </button>
    </>
  );

  return (
    <AppShell title="Capacitor Bank Sizing" hideSubHeader={true}>
      <div className="flex flex-col h-full overflow-hidden pt-4 gap-4 bg-slate-50/30 dark:bg-slate-950/30 relative">
        
        {/* Breadcrumbs & Page Header */}
        <div className="flex justify-between items-center shrink-0 select-none no-print modal-blur-bg z-10 py-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-baseline gap-2">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">Capacitor Bank Sizing</h1>
              <span className="text-[15px] font-semibold text-muted-foreground">{panels.length} {panels.length === 1 ? "panel" : "panels"}</span>
            </div>
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
            <button
              onClick={() => setTableModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border border-emerald-600/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition-all cursor-pointer shadow-2xs"
            >
              <Activity className="size-3.5 text-emerald-600" />
              Multiplication Table
            </button>
            <CalculationReviewBar projectId={projectObj?.id} calculatorPath="/capacitor-bank-sizing" calculatorTitle="Capacitor Bank Sizing" />
          </div>

          {/* Unit System Toggle Pill */}
          <div className="flex items-center gap-2">
            <UnitToggle
              unitSystem={unitSystem}
              onChange={handleUnitSystemChange}
              disabled={isApprovedLocked}
              ipLabel="IP"
              siLabel="SI"
              ipDescription="Imperial (IP) [Load in HP]"
              siDescription="Metric (SI) [Load in kW]"
              inputDescriptions="Total Connected Load & Max Demand Load"
              conversionExample={
                unitSystem === "si"
                  ? "Convert 1000 kW → 1341.0 HP (1 HP = 0.746 kW)"
                  : "Convert 1341.0 HP → 1000 kW (1 kW = 1.341 HP)"
              }
            />
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden z-10 min-h-0 gap-4">
          <div className={`flex-1 overflow-y-auto rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"} min-h-0`}>
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
                    "Total Load (HP)": "totalLoadKw",
                    "Max Demand Load (kW)": "maxDemandLoadKw",
                    "Max Demand Load (HP)": "maxDemandLoadKw",
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
                  <FileText className="size-3.5 text-foreground" /> Export
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
              const commentCount = getMergedItemComments(p.id, p.name || p.tag, p.comments, "/capacitor-bank-sizing", project?.id).length;
              
              return (
                <div 
                  key={p.id} 
                  onContextMenu={(e) => handlePanelContextMenu(e, p.id)}
                  onDoubleClick={(e) => handlePanelDoubleClick(p, e)}
                  className={`flex flex-col bg-white/60 dark:bg-black/40 backdrop-blur-xl border rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all overflow-hidden cursor-pointer relative ${isActive ? 'border-white/80 dark:border-white/30 shadow-lg' : 'border-white/50 dark:border-white/10 hover:border-white/80 dark:hover:border-white/30'}`}
                  title="Double click to edit panel details"
                >
                  {commentCount > 0 && (
                    <RowCommentCornerBadge
                      count={commentCount}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCommentModal(p, e);
                      }}
                    />
                  )}
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
                    </div>

                    <div className="flex items-center gap-3 mt-1 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:block">Total Cap:</span>
                        <span className={`text-sm font-black font-mono ${isActive ? 'text-primary' : 'text-foreground'}`}>{calc.proposedKvar} <span className="text-[10px] font-bold text-muted-foreground">kVAr</span></span>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        

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
                                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Total Connected Load ({unitSystem === "ip" ? "HP" : "kW"})</label>
                                <input type="number" disabled={isApprovedLocked} className="h-7 px-2 bg-surface-1 border border-border rounded outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all font-mono text-[11px]" value={p.totalLoadKw} onChange={e => updatePanel(p.id, "totalLoadKw", e.target.value === "" ? "" : Number(e.target.value))} />
                              </div>
                              
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Max Demand Load ({unitSystem === "ip" ? "HP" : "kW"})</label>
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
                                  <span className="text-primary font-bold text-[9px] uppercase tracking-wider">{unitSystem === "ip" ? "kVAr = (HP × 0.746) × Tan θ" : "kVAr = kW × Tan θ"}</span>
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
                      Automatically optimize target power factor and capacitor step units.
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
            <span>Add Comment</span>
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
          unitSystem={unitSystem}
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
          existingComments={getMergedItemComments(commentTargetPanel.id, commentTargetPanel.name || commentTargetPanel.tag, commentTargetPanel.comments, "/capacitor-bank-sizing", project?.id)}
          onSave={handleSaveComment}
        />
      )}

      {/* Multiplication Factor Table Modal */}
      <MultiplicationFactorModal
        isOpen={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        currentInitialPf={Number((panels.find(p => p.id === activePanelId) || panels[0])?.initialPf) || 0.8}
        currentTargetPf={Number((panels.find(p => p.id === activePanelId) || panels[0])?.targetPf) || 0.9}
      />
    </AppShell>
  );
}

interface EditCapPanelModalProps {
  panel: CapPanel | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPanel: CapPanel) => void;
  unitSystem?: "si" | "ip";
}

function EditCapPanelModal({ panel, isOpen, onClose, onSave, unitSystem = "si" }: EditCapPanelModalProps) {
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
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Total Connected Load ({unitSystem === "ip" ? "HP" : "kW"})</label>
              <input 
                type="number" 
                step="0.1"
                className="h-9 px-3 bg-surface-2 border border-border rounded-xl text-xs outline-none focus:border-primary font-mono"
                value={formData.totalLoadKw}
                onChange={e => setFormData({ ...formData, totalLoadKw: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Max Demand Load ({unitSystem === "ip" ? "HP" : "kW"})</label>
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

const INITIAL_PF_ROWS = [
  0.40, 0.42, 0.44, 0.46, 0.48, 0.50, 0.52, 0.54, 0.56, 0.58,
  0.60, 0.62, 0.64, 0.66, 0.68, 0.70, 0.72, 0.74, 0.75, 0.76,
  0.78, 0.80, 0.82, 0.84, 0.85, 0.86, 0.87, 0.88, 0.89, 0.90,
  0.91, 0.92, 0.93, 0.94, 0.95
];

const TARGET_PF_COLS = [0.90, 0.91, 0.92, 0.93, 0.94, 0.95, 0.96, 0.97, 0.98, 0.99];

function getMultFactor(initialPf: number, targetPf: number): string {
  if (initialPf >= targetPf) return "-";
  const tan1 = Math.tan(Math.acos(initialPf));
  const tan2 = Math.tan(Math.acos(targetPf));
  const diff = tan1 - tan2;
  return diff > 0 ? diff.toFixed(3) : "-";
}

interface MultiplicationFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentInitialPf?: number;
  currentTargetPf?: number;
}

function MultiplicationFactorModal({ isOpen, onClose, currentInitialPf = 0.8, currentTargetPf = 0.9 }: MultiplicationFactorModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-emerald-700 text-white">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-emerald-200" />
            <div>
              <h3 className="font-bold text-sm tracking-tight">Calculation of Capacitor Ratings - kVAr</h3>
              <p className="text-[11px] text-emerald-100">Multiplication Factor Table (Industrial / Distribution Networks)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-emerald-800 text-emerald-100 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex flex-col gap-4 text-xs">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 flex flex-col sm:flex-row justify-between gap-3 text-foreground">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-emerald-800 dark:text-emerald-300">Methodology & Formula</span>
              <p className="text-muted-foreground text-[11px]">
                Operating Load kW = kVA demand × Average PF | Required kVAr = kW × Multiplying Factor (from Table)
              </p>
              <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                Multiplying Factor (Tan θ) = Tan(Cos⁻¹ PF₁) - Tan(Cos⁻¹ PF₂)
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-border shrink-0 font-mono text-[11px]">
              <span className="font-bold text-foreground">Example:</span><br/>
              Initial PF = 0.85, Target PF = 0.98<br/>
              kVAr = 800 kW × 0.417 = <span className="font-bold text-emerald-600">334 kVAr</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-emerald-600/30 rounded-xl shadow-xs">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-emerald-700 text-white font-bold">
                  <th className="p-2 border-r border-emerald-600 text-left bg-emerald-800">INITIAL PF</th>
                  <th colSpan={TARGET_PF_COLS.length} className="p-2 text-center border-b border-emerald-600 uppercase tracking-wider">
                    TARGET PF
                  </th>
                </tr>
                <tr className="bg-emerald-600 text-white font-bold text-center">
                  <th className="p-1.5 border-r border-emerald-500 bg-emerald-700"></th>
                  {TARGET_PF_COLS.map(tpf => (
                    <th 
                      key={tpf} 
                      className={`p-1.5 border-r border-emerald-500 min-w-[50px] ${
                        Math.abs(tpf - currentTargetPf) < 0.005 ? "bg-amber-400 text-slate-950 font-extrabold" : ""
                      }`}
                    >
                      {tpf.toFixed(2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INITIAL_PF_ROWS.map(ipf => {
                  const isCurrentRow = Math.abs(ipf - currentInitialPf) < 0.005;
                  return (
                    <tr key={ipf} className={`border-b border-border hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 ${isCurrentRow ? "bg-amber-100/70 dark:bg-amber-950/40" : ""}`}>
                      <td className={`p-1.5 font-bold border-r border-border text-center ${isCurrentRow ? "bg-amber-400 text-slate-950" : "bg-emerald-700 text-white"}`}>
                        {ipf.toFixed(2)}
                      </td>
                      {TARGET_PF_COLS.map(tpf => {
                        const isMatch = isCurrentRow && Math.abs(tpf - currentTargetPf) < 0.005;
                        const factor = getMultFactor(ipf, tpf);
                        return (
                          <td 
                            key={tpf} 
                            className={`p-1.5 text-center font-mono text-[11px] border-r border-border/40 ${
                              isMatch 
                                ? "bg-amber-400 text-slate-950 font-bold shadow-inner ring-2 ring-amber-500" 
                                : factor === "-" 
                                  ? "text-muted-foreground/30 bg-surface-2" 
                                  : "text-foreground"
                            }`}
                          >
                            {factor}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
