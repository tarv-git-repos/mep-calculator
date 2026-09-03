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
import { Download, Plus, X, ChevronDown, ChevronUp, Zap, Activity, FileText } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

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
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const [project, setProject] = useState("");
  const [sub, setSub] = useState("");
  
  const [panels, setPanels] = useState<CapPanel[]>([defaultPanel(1)]);
  const [activePanelId, setActivePanelId] = useState<string | null>("1");
  const [nextId, setNextId] = useState(2);
  const [showMathId, setShowMathId] = useState<string | null>(null);

  const updatePanel = (id: string, field: keyof CapPanel, value: any) => {
    setPanels(panels.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addPanel = () => {
    const newPanel = defaultPanel(nextId);
    setPanels([...panels, newPanel]);
    setActivePanelId(newPanel.id);
    setNextId(nextId + 1);
  };

  const removePanel = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (panels.length <= 1) return;
    const newPanels = panels.filter(p => p.id !== id);
    setPanels(newPanels);
    if (activePanelId === id) {
      setActivePanelId(null);
    }
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

    const numFullSteps = Math.floor(proposedKvar / p.stepUnit);
    const remainderStep = proposedKvar % p.stepUnit;

    const initialKva = demand / safePf1;
    const targetKva = demand / safePf2;
    const initialKvar = Math.sin(theta1Rad) * initialKva;
    const targetKvar = Math.sin(theta2Rad) * targetKva;

    const ampI = (p.overcurrentFactor * proposedKvar) / (1.732 * p.voltageKv);

    return {
      theta1Deg, theta2Deg, tanTheta1, tanTheta2, tanThetaDiff,
      requiredKvar, proposedKvar, numFullSteps, remainderStep,
      initialKva, targetKva, initialKvar, targetKvar, ampI
    };
  };

  const exportExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    // @ts-ignore
    const { saveAs } = await import('file-saver');

    const wb = new ExcelJS.Workbook();
    
    const base64ImageURL = getDiagramBase64();
    const base64Data = base64ImageURL.replace(/^data:image\/(png|jpg);base64,/, "");
    
    const imageId = wb.addImage({
      base64: base64Data,
      extension: 'png',
    });

    panels.forEach(p => {
      const c = calculatePanel(p);
      const ws = wb.addWorksheet(p.name);
      
      const rows = [
        ["PROJECT", ":", project],
        [],
        ["SUB", ":", sub],
        [],
        ["PANEL REF", ":", p.panelRef],
        [],
        ["Total Connected Load", "=", `${Number(p.totalLoadKw).toFixed(2)} kW`],
        ["", "", "(Including all standby, duty power and spares)"],
        [],
        ["Max Demand Load (IFC)", "=", `${Number(p.maxDemandLoadKw).toFixed(2)} kW`],
        [],
        ["Assumed Existing P.F", "=", p.initialPf],
        [],
        ["Target P.F", "=", p.targetPf],
        [],
        ["Initial Power Factor", "=", p.initialPf],
        ["ie     Cosθ1", "=", Number(p.initialPf).toFixed(2)],
        [],
        ["       θ1", "=", `${p.initialPf} Cos⁻¹`],
        ["", "=", c.theta1Deg.toFixed(2)],
        [],
        ["Corrective Power Factor", "=", p.targetPf],
        [],
        ["ie     Cosθ2", "=", Number(p.targetPf).toFixed(2)],
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
            // Check if it's the "(Including all standby...)" row which we might want left-aligned
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
      ws.addImage(imageId, {
        tl: { col: 4, row: 15 },
        ext: { width: 280, height: 180 }
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "Capacitor_Bank_Calculations.xlsx");
  };

  const exportPdf = async () => {
    try {
      const doc = new jsPDF();
      const base64ImageURL = getDiagramBase64();

      let currentY = addPdfHeader(doc, "P.F. CORRECTION CAPACITOR CALCULATION", {
        projectName: project || "PFC Project",
        calcNo: "TRV-CAP-001",
      });

      panels.forEach((p, index) => {
        if (index > 0) {
          doc.addPage();
          currentY = addPdfHeader(doc, "P.F. CORRECTION CAPACITOR CALCULATION", {
            projectName: project || "PFC Project",
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
      addPdfSignatureBlock(doc, currentY, currentUserName, project || "default", "capacitor-bank-sizing");

      const pdfBuffer = doc.output("arraybuffer");
      await downloadFile(new Uint8Array(pdfBuffer), "Capacitor_Bank_Calculations.pdf", "PDF Document", ["pdf"]);
      toast.success("PDF report generated successfully!");
    } catch (err: any) {
      console.error("Failed to export PDF:", err);
      toast.error(`PDF Export Error: ${err?.message || String(err)}`);
    }
  };

  const handleImportExcelRows = (mappedRows: any[]) => {
    const newPanels: CapPanel[] = mappedRows.map((mr, idx) => ({
      id: `cap_import_${Date.now()}_${idx}`,
      name: mr.name || `Imported Panel ${idx + 1}`,
      panelRef: mr.panelRef || "",
      totalLoadKw: Number(mr.totalLoadKw) || 0,
      maxDemandLoadKw: Number(mr.maxDemandLoadKw) || 0,
      existingPf: Number(mr.existingPf) || 0.8,
      targetPf: Number(mr.targetPf) || 0.95,
      capacitorStepSize: Number(mr.capacitorStepSize) || 50,
      voltageKv: Number(mr.voltageKv) || 0.4,
      overcurrentFactor: Number(mr.overcurrentFactor) || 1.43,
    }));
    setPanels(prev => [...prev, ...newPanels]);
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
        onClick={exportPdf}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full border border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
      >
        <FileText className="size-3.5" /> Export PDF
      </button>
    </>
  );

  return (
    <AppShell title="Capacitor Bank Sizing" hideSubHeader={true}>
      <div className="flex flex-col h-full overflow-hidden pt-4 gap-4 bg-slate-50/30 dark:bg-slate-950/30 relative">
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
        
        {/* Breadcrumbs & Page Header */}
        <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg px-4 z-10">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">ELECTRICAL &gt; CAPACITOR BANK SIZING</span>
            <div className="flex items-center gap-3 mt-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Capacitor Bank Sizing</h1>
              
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              P.F. Correction Capacitor Calculation
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {actions}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 z-10 min-h-0">
          {/* Top Bar for Project & Sub */}
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Report Project Name</label>
              <input 
                type="text" 
                value={project}
                onChange={e => setProject(e.target.value)}
                placeholder="e.g. Marina Bay Tower"
                className="h-9 px-3 bg-surface-2 border border-transparent focus:border-primary rounded-xl text-[13px] outline-none transition-colors w-full"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Report Sub/System Reference</label>
              <input 
                type="text" 
                value={sub}
                onChange={e => setSub(e.target.value)}
                placeholder="e.g. Substation-1 LV Board"
                className="h-9 px-3 bg-surface-2 border border-transparent focus:border-primary rounded-xl text-[13px] outline-none transition-colors w-full"
              />
            </div>
          </div>
          
          <div className="w-full flex flex-col gap-4">
          
          {panels.map((p) => {
            const isActive = activePanelId === p.id;
            const calc = calculatePanel(p);
            
            return (
              <div 
                key={p.id} 
                className={`flex flex-col bg-white/60 dark:bg-black/40 backdrop-blur-xl border rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all overflow-hidden ${isActive ? 'border-white/80 dark:border-white/30 shadow-lg' : 'border-white/50 dark:border-white/10 hover:border-white/80 dark:hover:border-white/30'}`}
              >
                {/* Accordion Header */}
                <div 
                  onClick={() => setActivePanelId(isActive ? null : p.id)}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between py-2 px-4 cursor-pointer transition-colors ${isActive ? 'bg-primary/5' : 'bg-white/40 dark:bg-white/5 hover:bg-white/50 dark:hover:bg-white/10'}`}
                >
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded ${isActive ? 'bg-primary text-primary-foreground' : 'bg-surface-3 text-muted-foreground'}`}>
                        <Zap className="size-3" />
                      </div>
                      <input 
                        type="text"
                        value={p.name}
                        onChange={e => updatePanel(p.id, "name", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={`bg-transparent outline-none font-bold text-sm w-28 focus:ring-1 focus:ring-primary/20 rounded px-1 transition-colors ${isActive ? 'text-primary' : 'text-foreground'}`}
                        placeholder="Panel Name"
                      />
                    </div>
                    <div className="h-4 w-px bg-border hidden sm:block"></div>
                    <input 
                      type="text"
                      value={p.panelRef}
                      onChange={e => updatePanel(p.id, "panelRef", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-transparent outline-none text-xs text-muted-foreground w-40 focus:ring-1 focus:ring-primary/20 rounded px-1 hidden sm:block"
                      placeholder="Panel Reference"
                    />
                  </div>

                  <div className="flex items-center gap-3 mt-1 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:block">Total Cap:</span>
                      <span className={`text-sm font-black font-mono ${isActive ? 'text-primary' : 'text-foreground'}`}>{calc.proposedKvar} <span className="text-[10px] font-bold text-muted-foreground">kVAr</span></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => removePanel(p.id, e)}
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
                              <input type="number" className="h-7 px-2 bg-surface-1 border border-border rounded outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all font-mono text-[11px]" value={p.totalLoadKw} onChange={e => updatePanel(p.id, "totalLoadKw", e.target.value === "" ? "" : Number(e.target.value))} />
                            </div>
                            
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Max Demand Load (IFC)</label>
                              <input type="number" className="h-7 px-2 bg-primary/5 border border-primary/20 rounded outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary transition-all font-mono text-[11px] text-primary font-bold" value={p.maxDemandLoadKw} onChange={e => updatePanel(p.id, "maxDemandLoadKw", e.target.value === "" ? "" : Number(e.target.value))} />
                            </div>

                            <div className="col-span-1 sm:col-span-2 h-px bg-border/50 my-0.5"></div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Assumed Existing P.F.</label>
                              <input type="number" step="0.01" className="h-7 px-2 bg-surface-1 border border-border rounded outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all font-mono text-[11px]" value={p.initialPf} onChange={e => updatePanel(p.id, "initialPf", e.target.value === "" ? "" : Number(e.target.value))} />
                            </div>
                            
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Target P.F.</label>
                              <input type="number" step="0.01" className="h-7 px-2 bg-surface-1 border border-border rounded outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all font-mono text-[11px]" value={p.targetPf} onChange={e => updatePanel(p.id, "targetPf", e.target.value === "" ? "" : Number(e.target.value))} />
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

                        {/* Math Breakdown Accordion - Moved to right side, more compact */}
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
                                <span className="text-muted-foreground">Initial P.F (Cos θ1) = {Number(p.initialPf).toFixed(2)}</span>
                                <span className="font-mono">θ1 = {calc.theta1Deg.toFixed(1)}°</span>
                              </div>
                              <div className="flex items-center justify-between pb-1.5 border-b border-border/50 text-[10px]">
                                <span className="text-muted-foreground">Corrective P.F (Cos θ2) = {Number(p.targetPf).toFixed(2)}</span>
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
            className="w-full flex items-center justify-center gap-1 py-3 border border-dashed border-primary/30 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary font-bold transition-all text-sm"
          >
            <Plus className="size-4" /> Add New Panel
          </button>

        </div>
        </div>
      </div>
    </AppShell>
  );
}



function getDiagramBase64() {
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
