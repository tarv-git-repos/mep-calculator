import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfHeader, addPdfSignatureBlock, resolveLatestReviewState } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { Trash2, Plus, Download, Save, Info, Droplet, Building2, Layers, Globe, Sparkles, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";

export const Route = createFileRoute("/plumbing-water-demand")({
  head: () => ({
    meta: [
      { title: "Water Demand & Tank Sizing Calculator — MEP Calc" },
      { name: "description", content: "Comprehensive water demand sizing tool for domestic, irrigation, swimming pool, fire fighting, and storage tank capacities." },
    ],
  }),
  component: WaterDemandPage,
});

interface WDRow {
  id: number;
  name: string;
  ppl: number;
  cat: string;
  lpd: number;
}

interface IrrRow {
  id: number;
  area: number;
  vegType: string;
  lpd: number;
}

const WD_TYPE_MAP: Record<string, number> = {
  // Residential
  "Residential buildings (flat)": 300,
  "Villas": 350,
  "Mixed used residential": 350,
  "Labour accommodation": 150,
  // Office & Commercial
  "Offices": 60,
  "Headquarters": 80,
  "Commercial buildings": 100,
  "Mixed used commercial": 80,
  "Logistic, academic & business center": 75,
  // Retail & Leisure
  "Local plaza / retail / town center": 82,
  "Shops": 60,
  "Club house / recreation": 100,
  "Entertainment & leisure / theater": 60,
  "Theatre": 50,
  "Events": 50,
  // Hospitality
  "Hotels (per guest)": 300,
  "Hotels (per employee)": 80,
  "Restaurant (per meal)": 15,
  "Visitors": 40,
  // Education
  "Schools / university": 60,
  "Nursery / child care centre": 70,
  // Medical & Healthcare
  "Medical (per bed)": 450,
  "Day clinic (per medical practitioner) incl. visitors": 450,
  "Laboratory": 80,
  // Industrial
  "Manufacturing / mineral": 80,
  "Industrial (workshops / machinery / warehouse)": 80,
  "Guardhouse": 75,
  // Public & Assembly
  "Mosques": 60,
  "Public amenities": 50,
};

const IRR_TYPE_MAP: Record<string, number> = {
  "Palm Trees": 150,
  "Small Palm Tree": 75,
  "Ornamental trees": 80,
  "Shrubs & hedges": 15,
  "Ground cover and succulents": 12,
  "Seasonal flowers and creepers": 12,
  "Lawn with pop-up sprays": 10,
};

const PRESET_STANDARDS = {
  dewa: {
    name: "DEWA / Dubai Municipality Guidelines",
    desc: "Standard Middle East domestic consumption rates (Flat: 300 LPD, Villa: 350 LPD, Office: 60 LPD).",
    multiplier: 1.0,
  },
  addc: {
    name: "ADDC / Abu Dhabi RSB Guidelines",
    desc: "Abu Dhabi Distribution Co. consumption standards (Flat: 270 LPD, Villa: 320 LPD, Office: 55 LPD).",
    multiplier: 0.9,
  },
  ipc: {
    name: "ASHRAE / IPC (International Plumbing Code)",
    desc: "US/International standard occupancy demand rates.",
    multiplier: 0.85,
  },
  cibse: {
    name: "BS 8558 / CIBSE Guide G Guidelines",
    desc: "UK & European CIBSE water supply & storage standards.",
    multiplier: 0.8,
  },
};

function WaterDemandPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const { project, forceSaveToCloud } = useWorkspace();

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [presetStandard, setPresetStandard] = useState<string>("dewa");

  // Storage Tank & Transfer Pump Settings
  const [storageDays, setStorageDays] = useState<number>(1);
  const [tankSplit, setTankSplit] = useState<"60-40" | "100-0" | "80-20" | "50-50">("60-40");
  const [peakFactor, setPeakFactor] = useState<number>(2.5);
  const [fillWindowHours, setFillWindowHours] = useState<number>(2);

  // Domestic state
  const [wdRows, setWdRows] = useState<WDRow[]>([]);
  const [newWdName, setNewWdName] = useState("");
  const [newWdPeople, setNewWdPeople] = useState<number | "">("");
  const [newWdCat, setNewWdCat] = useState("");

  // Irrigation state
  const [irrRows, setIrrRows] = useState<IrrRow[]>([]);
  const [newIrrArea, setNewIrrArea] = useState<number | "">("");
  const [newIrrVegType, setNewIrrVegType] = useState("");

  // Pool state
  const [poolArea, setPoolArea] = useState<number | "">("");
  const [poolDepth, setPoolDepth] = useState<number | "">("");
  const [poolEvap, setPoolEvap] = useState<number>(10);

  // Fire state
  const [fireFlow, setFireFlow] = useState<number | "">("");

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load state from localStorage on project change
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_water_demand_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.presetStandard) setPresetStandard(data.presetStandard);
        if (data.storageDays !== undefined) setStorageDays(data.storageDays);
        if (data.tankSplit !== undefined) setTankSplit(data.tankSplit);
        if (data.peakFactor !== undefined) setPeakFactor(data.peakFactor);
        if (data.fillWindowHours !== undefined) setFillWindowHours(data.fillWindowHours);
        if (data.wdRows) setWdRows(data.wdRows);
        if (data.irrRows) setIrrRows(data.irrRows);
        if (data.poolArea !== undefined) setPoolArea(data.poolArea);
        if (data.poolDepth !== undefined) setPoolDepth(data.poolDepth);
        if (data.poolEvap !== undefined) setPoolEvap(data.poolEvap);
        if (data.fireFlow !== undefined) setFireFlow(data.fireFlow);
      } else {
        // Reset to defaults
        setUnitSystem("si");
        setPresetStandard("dewa");
        setStorageDays(1);
        setTankSplit("60-40");
        setPeakFactor(2.5);
        setFillWindowHours(2);
        setWdRows([
          { id: 1, name: "Apartment Block A", ppl: 150, cat: "Residential buildings (flat)", lpd: 300 },
          { id: 2, name: "Ground Floor Offices", ppl: 45, cat: "Offices", lpd: 60 },
        ]);
        setIrrRows([
          { id: 1, area: 120, vegType: "Lawn with pop-up sprays", lpd: 10 },
          { id: 2, area: 15, vegType: "Palm Trees", lpd: 150 },
        ]);
        setPoolArea("");
        setPoolDepth("");
        setPoolEvap(10);
        setFireFlow("");
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load water demand calculation", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        unitSystem,
        presetStandard,
        storageDays,
        tankSplit,
        peakFactor,
        fillWindowHours,
        wdRows,
        newWdName,
        newWdPeople,
        newWdCat,
        irrRows,
        newIrrArea,
        newIrrVegType,
        poolArea,
        poolDepth,
        poolEvap,
        fireFlow,
      };
      localStorage.setItem(`mep_water_demand_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [
    project?.id,
    loadedProjectId,
    unitSystem,
    presetStandard,
    storageDays,
    tankSplit,
    peakFactor,
    fillWindowHours,
    wdRows,
    newWdName,
    newWdPeople,
    newWdCat,
    irrRows,
    newIrrArea,
    newIrrVegType,
    poolArea,
    poolDepth,
    poolEvap,
    fireFlow,
  ]);

  const handleSaveCurrent = () => {
    try {
      const dataToSave = {
        unitSystem,
        presetStandard,
        storageDays,
        tankSplit,
        peakFactor,
        fillWindowHours,
        wdRows,
        irrRows,
        poolArea,
        poolDepth,
        poolEvap,
        fireFlow,
      };
      localStorage.setItem(`mep_water_demand_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(false);
      if (forceSaveToCloud) forceSaveToCloud();
      toast.success("Water Demand Calculation saved to project successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  const ip = unitSystem === "ip";

  // Core Calculations
  const calculations = useMemo(() => {
    // Domestic Total
    let totalPeople = 0;
    let totalWaterL = 0;
    wdRows.forEach((r) => {
      totalPeople += r.ppl;
      totalWaterL += r.ppl * r.lpd;
    });

    // Irrigation Total
    let totalIrrL = 0;
    irrRows.forEach((r) => {
      totalIrrL += r.area * r.lpd;
    });

    // Pool Total
    const pAreaVal = Number(poolArea) || 0;
    const pDepthVal = Number(poolDepth) || 0;
    const poolVolL = pAreaVal * pDepthVal * 1000;
    const poolDemandL = poolVolL * (poolEvap / 100);

    // Fire Total
    const fFlowGPM = Number(fireFlow) || 0;
    const fireLPM = fFlowGPM * 3.78541;
    const fireCapL = fireLPM * 60; // 60 mins reserve

    // Grand Total Daily Demand (Domestic + Irrigation + Pool Makeup)
    const grandTotalL = totalWaterL + totalIrrL + poolDemandL;

    // Storage Tank Calculations
    const reqStorageL = grandTotalL * (storageDays || 1);
    const reqStorageM3 = reqStorageL / 1000;
    const reqStorageGal = reqStorageL / 3.78541;

    let groundRatio = 0.6;
    let roofRatio = 0.4;
    if (tankSplit === "100-0") {
      groundRatio = 1.0;
      roofRatio = 0.0;
    } else if (tankSplit === "80-20") {
      groundRatio = 0.8;
      roofRatio = 0.2;
    } else if (tankSplit === "50-50") {
      groundRatio = 0.5;
      roofRatio = 0.5;
    }

    const groundTankL = reqStorageL * groundRatio;
    const roofTankL = reqStorageL * roofRatio;

    // Dimensions helper (assuming rectangular cube with H ~ 2m for ground, H ~ 1.5m for roof)
    const estimateDimensions = (volM3: number, hDefault: number) => {
      if (volM3 <= 0) return { l: 0, w: 0, h: 0 };
      const h = hDefault;
      const baseArea = volM3 / h;
      const w = Math.sqrt(baseArea / 1.5);
      const l = w * 1.5;
      return {
        l: Math.round(l * 100) / 100,
        w: Math.round(w * 100) / 100,
        h: Math.round(h * 100) / 100,
      };
    };

    const groundDim = estimateDimensions(groundTankL / 1000, 2.2);
    const roofDim = estimateDimensions(roofTankL / 1000, 1.5);

    // Peak Demand & Transfer Pump Flow
    const peakFactorVal = peakFactor || 2.5;
    const peakHourlyFlowL = (totalWaterL * peakFactorVal) / 10; // Peak 10-hr operating window
    const peakLPS = peakHourlyFlowL / 3600;
    const peakGPM = (peakHourlyFlowL / 3.78541) / 60;

    const fillHrs = fillWindowHours || 2;
    const transferPumpFlowLPH = roofTankL > 0 ? roofTankL / fillHrs : totalWaterL / fillHrs;
    const transferPumpLPS = transferPumpFlowLPH / 3600;
    const transferPumpGPM = (transferPumpFlowLPH / 3.78541) / 60;

    // Unit Formatter
    const formatVol = (liters: number) => {
      if (ip) {
        return `${Math.round(liters / 3.78541).toLocaleString()} gal`;
      }
      return `${Math.round(liters).toLocaleString()} L`;
    };

    const formatRate = (litersPerDay: number) => {
      if (ip) {
        return `${Math.round(litersPerDay / 3.78541).toLocaleString()} gal/day`;
      }
      return `${Math.round(litersPerDay).toLocaleString()} L/day`;
    };

    return {
      totalPeople,
      totalWaterL,
      totalIrrL,
      poolVolL,
      poolDemandL,
      fireLPM,
      fireCapL,
      grandTotalL,
      reqStorageL,
      reqStorageM3,
      reqStorageGal,
      groundTankL,
      roofTankL,
      groundDim,
      roofDim,
      peakHourlyFlowL,
      peakLPS,
      peakGPM,
      transferPumpFlowLPH,
      transferPumpLPS,
      transferPumpGPM,
      displayDomestic: formatRate(totalWaterL),
      displayDomesticPeak: ip
        ? `${Math.round(peakGPM).toLocaleString()} GPM`
        : `${peakLPS.toFixed(2)} L/s`,
      displayIrrigation: formatRate(totalIrrL),
      displayPoolVol: formatVol(poolVolL),
      displayPoolDemand: formatRate(poolDemandL),
      displayFireLPM: `${fireLPM.toFixed(1)} L/min (${fFlowGPM} GPM)`,
      displayFireCap: formatVol(fireCapL),
      displayGrandTotal: formatRate(grandTotalL),
      displayTotalStorage: ip
        ? `${Math.round(reqStorageGal).toLocaleString()} gal (${(reqStorageM3 * 35.3147).toFixed(1)} ft³)`
        : `${Math.round(reqStorageL).toLocaleString()} L (${reqStorageM3.toFixed(2)} m³)`,
      displayGroundTank: formatVol(groundTankL),
      displayRoofTank: formatVol(roofTankL),
      displayTransferPump: ip
        ? `${transferPumpGPM.toFixed(1)} GPM`
        : `${transferPumpLPS.toFixed(2)} L/s (${Math.round(transferPumpFlowLPH)} L/hr)`,
    };
  }, [
    wdRows,
    irrRows,
    poolArea,
    poolDepth,
    poolEvap,
    fireFlow,
    storageDays,
    tankSplit,
    peakFactor,
    fillWindowHours,
    ip,
  ]);

  // Domestic Handlers
  const handleAddWd = () => {
    if (!newWdName.trim() || !newWdPeople || !newWdCat) return;
    const baseLpd = WD_TYPE_MAP[newWdCat] || 0;
    const mult = PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.multiplier || 1.0;
    const lpd = Math.round(baseLpd * mult);

    setWdRows([
      ...wdRows,
      {
        id: Date.now(),
        name: newWdName.trim(),
        ppl: Number(newWdPeople),
        cat: newWdCat,
        lpd,
      },
    ]);
    setNewWdName("");
    setNewWdPeople("");
    setNewWdCat("");
  };

  const handleWdRowChange = (id: number, field: "name" | "ppl" | "cat", val: any) => {
    setWdRows(
      wdRows.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: val };
        if (field === "cat") {
          const baseLpd = WD_TYPE_MAP[val] || 0;
          const mult = PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.multiplier || 1.0;
          updated.lpd = Math.round(baseLpd * mult);
        }
        return updated;
      })
    );
  };

  // Irrigation Handlers
  const handleAddIrr = () => {
    if (!newIrrArea || !newIrrVegType) return;
    const lpd = IRR_TYPE_MAP[newIrrVegType] || 0;
    setIrrRows([
      ...irrRows,
      {
        id: Date.now(),
        area: Number(newIrrArea),
        vegType: newIrrVegType,
        lpd,
      },
    ]);
    setNewIrrArea("");
    setNewIrrVegType("");
  };

  const handleIrrRowChange = (id: number, field: "area" | "vegType", val: any) => {
    setIrrRows(
      irrRows.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: val };
        if (field === "vegType") {
          updated.lpd = IRR_TYPE_MAP[val] || 0;
        }
        return updated;
      })
    );
  };

  // PDF Exporter
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("p", "pt", "a4");
      const projId = project?.id || "default";

      let currentY = addPdfHeader(
        doc,
        "WATER DEMAND & TANK SIZING REPORT",
        `Project: ${project?.name || "MEP Calculator Project"} | Units: ${unitSystem.toUpperCase()}`
      );

      // Section 1: Executive Summary Card Table
      autoTable(doc, {
        startY: currentY + 10,
        head: [["Calculated Parameter", "Value", "Unit / Metric", "Engineering Standard"]],
        body: [
          ["Domestic Daily Water Demand", calculations.displayDomestic, ip ? "gal/day" : "L/day", "Occupancy LPD Table"],
          ["Domestic Peak Flow Rate", calculations.displayDomesticPeak, ip ? "GPM" : "L/s", `Peak Factor = ${peakFactor}`],
          ["Irrigation Daily Water Load", calculations.displayIrrigation, ip ? "gal/day" : "L/day", "Plant Area Demand"],
          ["Pool Daily Makeup Water", calculations.displayPoolDemand, ip ? "gal/day" : "L/day", `Evaporation = ${poolEvap}%`],
          ["GRAND TOTAL DAILY DEMAND", calculations.displayGrandTotal, ip ? "gal/day" : "L/day", "Total Daily Service Load"],
          ["Required Storage Tank Volume", calculations.displayTotalStorage, ip ? "gal" : "m³", `${storageDays} Day(s) Retention`],
          ["Ground Water Tank (Break Tank)", calculations.displayGroundTank, ip ? "gal" : "L", `Split: ${tankSplit.split("-")[0]}%`],
          ["Overhead Roof Tank", calculations.displayRoofTank, ip ? "gal" : "L", `Split: ${tankSplit.split("-")[1]}%`],
          ["Transfer Pump Flow Rate", calculations.displayTransferPump, ip ? "GPM" : "L/s", `${fillWindowHours}-Hr Roof Tank Fill`],
        ],
        theme: "grid",
        headStyles: { fillColor: [10, 123, 199], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8.5 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 160 }, 1: { fontStyle: "bold", textColor: [10, 123, 199] } },
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Section 2: Domestic Schedule
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Domestic Water Demand Breakdown", 40, currentY);

      autoTable(doc, {
        startY: currentY + 5,
        head: [["S.No", "Description", "People", "Category", ip ? "Rate (gpd)" : "Rate (LPD)", ip ? "Total (gal)" : "Total (L)"]],
        body: [
          ...wdRows.map((r, idx) => [
            idx + 1,
            r.name,
            r.ppl,
            r.cat,
            ip ? Math.round(r.lpd / 3.78541) : r.lpd,
            ip ? Math.round((r.ppl * r.lpd) / 3.78541).toLocaleString() : (r.ppl * r.lpd).toLocaleString(),
          ]),
          ["", "TOTAL DOMESTIC LOAD", calculations.totalPeople, "", "", calculations.displayDomestic],
        ],
        theme: "striped",
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Section 3: Irrigation & Storage Dimensions
      doc.text("Irrigation & Storage Tank Sizing", 40, currentY);

      autoTable(doc, {
        startY: currentY + 5,
        head: [["Category", "Vegetation / Tank", "Area / Volume", "Rate / Ratio", "Total Output"]],
        body: [
          ...irrRows.map((r) => [
            "Irrigation",
            r.vegType,
            `${r.area} ${ip ? "ft²" : "m²"}`,
            ip ? `${(r.lpd / 40.7458).toFixed(2)} gal/ft²` : `${r.lpd} L/m²`,
            ip ? `${Math.round((r.area * r.lpd) / 3.78541).toLocaleString()} gal` : `${(r.area * r.lpd).toLocaleString()} L`,
          ]),
          ["Ground Tank", "Reinforced Concrete / GRP", `${(calculations.groundTankL / 1000).toFixed(2)} m³`, `${tankSplit.split("-")[0]}% Share`, `${calculations.groundDim.l}m L × ${calculations.groundDim.w}m W × ${calculations.groundDim.h}m H`],
          ["Roof Tank", "Modular Sectional Tank", `${(calculations.roofTankL / 1000).toFixed(2)} m³`, `${tankSplit.split("-")[1]}% Share`, `${calculations.roofDim.l}m L × ${calculations.roofDim.w}m W × ${calculations.roofDim.h}m H`],
        ],
        theme: "grid",
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 20;

      // Add signature block
      const reviewDetails = resolveLatestReviewState(projId, "/plumbing-water-demand");
      addPdfSignatureBlock(
        doc,
        currentY,
        reviewDetails || currentUserName,
        projId,
        "/plumbing-water-demand"
      );

      doc.save(`Water_Demand_Report_${Date.now()}.pdf`);
      toast.success("PDF calculation report generated successfully!");
    } catch (e) {
      console.error("PDF Export error:", e);
      toast.error("Failed to generate PDF report.");
    }
  };

  // Excel Exporter using ExcelJS
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Water Demand & Tank Sizing");

      // Title Banner
      sheet.mergeCells("A1:G1");
      const titleCell = sheet.getCell("A1");
      titleCell.value = "WATER DEMAND & STORAGE TANK SIZING REPORT";
      titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A7BC7" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(1).height = 30;

      sheet.addRow([]);

      // Section 1: Executive Summary
      sheet.addRow(["EXECUTIVE SIZING SUMMARY"]);
      sheet.getRow(3).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0A7BC7" } };

      const summaryHeaders = ["Parameter", "Calculated Value", "Unit System", "Design Standard / Code"];
      const sRow = sheet.addRow(summaryHeaders);
      sRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      sRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
      });

      const summaryData = [
        ["Domestic Daily Demand", calculations.displayDomestic, ip ? "gal/day" : "L/day", PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name || "DEWA"],
        ["Domestic Peak Flow Rate", calculations.displayDomesticPeak, ip ? "GPM" : "L/s", `Peak Diversity Factor = ${peakFactor}`],
        ["Irrigation Daily Load", calculations.displayIrrigation, ip ? "gal/day" : "L/day", "Landscaping Area Schedule"],
        ["Pool Makeup Water", calculations.displayPoolDemand, ip ? "gal/day" : "L/day", `Evaporation Rate = ${poolEvap}%`],
        ["GRAND TOTAL DAILY DEMAND", calculations.displayGrandTotal, ip ? "gal/day" : "L/day", "Combined Site Consumption"],
        ["Total Storage Requirement", calculations.displayTotalStorage, ip ? "gal" : "m³", `${storageDays} Day(s) Retention`],
        ["Ground Break Tank Capacity", calculations.displayGroundTank, ip ? "gal" : "L", `Split Allocation: ${tankSplit.split("-")[0]}%`],
        ["Overhead Roof Tank Capacity", calculations.displayRoofTank, ip ? "gal" : "L", `Split Allocation: ${tankSplit.split("-")[1]}%`],
        ["Transfer Pump Duty Flow", calculations.displayTransferPump, ip ? "GPM" : "L/s", `${fillWindowHours}-Hour Roof Tank Filling Window`],
      ];

      summaryData.forEach((r) => sheet.addRow(r));
      sheet.addRow([]);

      // Section 2: Domestic Schedule Table
      sheet.addRow(["DOMESTIC WATER DEMAND SCHEDULE"]);
      const dTitleRow = sheet.getRow(sheet.rowCount);
      dTitleRow.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0A7BC7" } };

      const domHeaders = ["S.No", "Description", "No. of People", "Category", ip ? "Rate (gpd)" : "Rate (LPD)", ip ? "Total (gal/day)" : "Total (L/day)"];
      const dHeaderRow = sheet.addRow(domHeaders);
      dHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      dHeaderRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF06456F" } };
      });

      wdRows.forEach((r, idx) => {
        sheet.addRow([
          idx + 1,
          r.name,
          r.ppl,
          r.cat,
          ip ? Math.round(r.lpd / 3.78541) : r.lpd,
          ip ? Math.round((r.ppl * r.lpd) / 3.78541) : r.ppl * r.lpd,
        ]);
      });

      sheet.addRow(["TOTAL", "DOMESTIC TOTAL", calculations.totalPeople, "", "", ip ? Math.round(calculations.totalWaterL / 3.78541) : calculations.totalWaterL]);
      sheet.getRow(sheet.rowCount).font = { name: "Arial", size: 10, bold: true };
      sheet.addRow([]);

      // Section 3: Irrigation Schedule
      sheet.addRow(["IRRIGATION SCHEDULE"]);
      sheet.getRow(sheet.rowCount).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0A7BC7" } };

      const irrHeaders = ["S.No", "Vegetation Type", ip ? "Area (ft²)" : "Area (m²)", ip ? "Rate (gal/ft²)" : "Rate (L/m²)", ip ? "Total Load (gal)" : "Total Load (L)"];
      const iHeaderRow = sheet.addRow(irrHeaders);
      iHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      iHeaderRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF06456F" } };
      });

      irrRows.forEach((r, idx) => {
        sheet.addRow([
          idx + 1,
          r.vegType,
          r.area,
          ip ? Number((r.lpd / 40.7458).toFixed(2)) : r.lpd,
          ip ? Math.round((r.area * r.lpd) / 3.78541) : r.area * r.lpd,
        ]);
      });

      sheet.addRow(["TOTAL", "IRRIGATION TOTAL", "", "", ip ? Math.round(calculations.totalIrrL / 3.78541) : calculations.totalIrrL]);
      sheet.getRow(sheet.rowCount).font = { name: "Arial", size: 10, bold: true };
      sheet.addRow([]);

      // Auto width
      sheet.columns.forEach((col) => {
        col.width = 25;
      });

      // Signature block
      const sigRow = sheet.rowCount + 2;
      addExcelSignatureBlock(
        sheet,
        sigRow,
        currentUserName,
        project?.id || "default",
        "/plumbing-water-demand",
        7
      );

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Water_Demand_Report_${Date.now()}.xlsx`);
      toast.success("Excel report generated successfully!");
    } catch (e) {
      console.error("Excel Export error:", e);
      toast.error("Failed to export Excel report.");
    }
  };

  return (
    <AppShell title="Water Demand & Tank Sizer" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6">
          {/* Header Bar */}
          <div className="flex justify-between items-start select-none flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                PLUMBING &gt; WATER DEMAND &amp; STORAGE TANK
              </span>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[26px] font-extrabold tracking-tight text-foreground mt-0.5">
                  Water Demand &amp; Tank Sizer
                </h1>
                <CalculationReviewBar calculatorPath="/plumbing-water-demand" calculatorTitle="Water Demand Calculator" />
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Calculate daily domestic water load, peak flow rate, irrigation demand, pool makeup, storage tank volumes, and transfer pump capacities.
              </p>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Unit System Toggle */}
              <div className="bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-border">
                <button
                  onClick={() => setUnitSystem("si")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    unitSystem === "si"
                      ? "bg-[#0A7BC7] text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  SI Metric (L, m³)
                </button>
                <button
                  onClick={() => setUnitSystem("ip")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    unitSystem === "ip"
                      ? "bg-[#0A7BC7] text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  IP Imperial (gal, ft³)
                </button>
              </div>

              <button
                onClick={handleSaveCurrent}
                className="flex items-center gap-1.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-xl px-3.5 py-2 text-xs font-bold transition-all border-0 cursor-pointer shadow-xs"
              >
                <Save className="size-4" /> Save
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl px-3.5 py-2 text-xs font-bold transition-all border-0 cursor-pointer shadow-xs"
              >
                <Download className="size-4 text-sky-400" /> Export PDF
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-3.5 py-2 text-xs font-bold transition-all border-0 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="size-4" /> Export Excel
              </button>
            </div>
          </div>

          {/* Preset Standard Selector Banner */}
          <div className="bg-gradient-to-r from-blue-900/10 via-slate-900/5 to-sky-900/10 border border-blue-200/40 dark:border-blue-900/40 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#0A7BC7]/15 rounded-xl text-[#0A7BC7]">
                <Globe className="size-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  Design Standard &amp; Regional Preset Guidelines
                </h4>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.desc}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="text-xs font-semibold text-foreground whitespace-nowrap">Preset Standard:</label>
              <select
                value={presetStandard}
                onChange={(e) => setPresetStandard(e.target.value)}
                className="bg-white dark:bg-slate-950 border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground outline-none focus:border-[#0A7BC7] shadow-xs cursor-pointer"
              >
                {Object.keys(PRESET_STANDARDS).map((key) => (
                  <option key={key} value={key}>
                    {PRESET_STANDARDS[key as keyof typeof PRESET_STANDARDS].name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* 1. Domestic Water Demand Schedule */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                    🏠 1. Domestic Water Demand Schedule
                  </h3>
                </div>

                {/* Form to add row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-slate-50/50 dark:bg-slate-900/30 p-3.5 border border-border rounded-xl text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Office Block A"
                      value={newWdName}
                      onChange={(e) => setNewWdName(e.target.value)}
                      className="bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">No. of People / Units</label>
                    <input
                      type="number"
                      placeholder="e.g. 150"
                      value={newWdPeople}
                      onChange={(e) => setNewWdPeople(e.target.value !== "" ? Number(e.target.value) : "")}
                      className="bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Occupancy Category</label>
                    <select
                      value={newWdCat}
                      onChange={(e) => setNewWdCat(e.target.value)}
                      className="bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]"
                    >
                      <option value="">— Select Category —</option>
                      <optgroup label="Residential">
                        <option value="Residential buildings (flat)">Residential buildings (flat) — 300 LPD</option>
                        <option value="Villas">Villas — 350 LPD</option>
                        <option value="Mixed used residential">Mixed used residential — 350 LPD</option>
                        <option value="Labour accommodation">Labour accommodation — 150 LPD</option>
                      </optgroup>
                      <optgroup label="Office &amp; Commercial">
                        <option value="Offices">Offices — 60 LPD</option>
                        <option value="Headquarters">Headquarters — 80 LPD</option>
                        <option value="Commercial buildings">Commercial buildings — 100 LPD</option>
                        <option value="Mixed used commercial">Mixed used commercial — 80 LPD</option>
                        <option value="Logistic, academic &amp; business center">Logistic &amp; business center — 75 LPD</option>
                      </optgroup>
                      <optgroup label="Retail &amp; Leisure">
                        <option value="Local plaza / retail / town center">Local plaza / retail — 82 LPD</option>
                        <option value="Shops">Shops — 60 LPD</option>
                        <option value="Club house / recreation">Club house / recreation — 100 LPD</option>
                        <option value="Entertainment &amp; leisure / theater">Leisure / theater — 60 LPD</option>
                        <option value="Theatre">Theatre — 50 LPD</option>
                        <option value="Events">Events — 50 LPD</option>
                      </optgroup>
                      <optgroup label="Hospitality">
                        <option value="Hotels (per guest)">Hotels (per guest) — 300 LPD</option>
                        <option value="Hotels (per employee)">Hotels (per employee) — 80 LPD</option>
                        <option value="Restaurant (per meal)">Restaurant (per meal) — 15 LPD</option>
                        <option value="Visitors">Visitors — 40 LPD</option>
                      </optgroup>
                      <optgroup label="Education">
                        <option value="Schools / university">Schools / university — 60 LPD</option>
                        <option value="Nursery / child care centre">Nursery / child care — 70 LPD</option>
                      </optgroup>
                      <optgroup label="Medical &amp; Healthcare">
                        <option value="Medical (per bed)">Medical (per bed) — 450 LPD</option>
                        <option value="Day clinic (per medical practitioner) incl. visitors">Day clinic — 450 LPD</option>
                        <option value="Laboratory">Laboratory — 80 LPD</option>
                      </optgroup>
                      <optgroup label="Industrial">
                        <option value="Manufacturing / mineral">Manufacturing / mineral — 80 LPD</option>
                        <option value="Industrial (workshops / machinery / warehouse)">Industrial — 80 LPD</option>
                        <option value="Guardhouse">Guardhouse — 75 LPD</option>
                      </optgroup>
                      <optgroup label="Public &amp; Assembly">
                        <option value="Mosques">Mosques — 60 LPD</option>
                        <option value="Public amenities">Public amenities — 50 LPD</option>
                      </optgroup>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddWd}
                    className="h-8.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="size-4" /> Add Entry
                  </button>
                </div>

                {/* Domestic Table */}
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full border-collapse text-[12.5px] font-sans">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-border text-foreground font-semibold">
                        <th className="p-2.5 text-center w-12">S.No</th>
                        <th className="p-2.5 text-left">Description</th>
                        <th className="p-2.5 text-center w-24">People</th>
                        <th className="p-2.5 text-left w-48">Category</th>
                        <th className="p-2.5 text-right w-28">Per Capita Rate</th>
                        <th className="p-2.5 text-right w-32">Daily Load</th>
                        <th className="p-2.5 text-center w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wdRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground italic">
                            No domestic entries added. Fill in the form above to populate.
                          </td>
                        </tr>
                      ) : (
                        wdRows.map((r, idx) => (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                            <td className="p-2 text-center text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={r.name}
                                onChange={(e) => handleWdRowChange(r.id, "name", e.target.value)}
                                className="w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-medium"
                              />
                            </td>
                            <td className="p-2 text-center font-bold">
                              <input
                                type="number"
                                value={r.ppl}
                                onChange={(e) => handleWdRowChange(r.id, "ppl", Number(e.target.value))}
                                className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={r.cat}
                                onChange={(e) => handleWdRowChange(r.id, "cat", e.target.value)}
                                className="w-full bg-transparent border-0 outline-none cursor-pointer focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded text-xs"
                              >
                                {Object.keys(WD_TYPE_MAP).map((k) => (
                                  <option key={k} value={k}>
                                    {k}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2 text-right font-mono font-medium text-muted-foreground">
                              {(ip ? Math.round(r.lpd / 3.78541) : r.lpd).toLocaleString()} {ip ? "gpd" : "LPD"}
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-[#0A7BC7]">
                              {(ip ? Math.round((r.ppl * r.lpd) / 3.78541) : r.ppl * r.lpd).toLocaleString()} {ip ? "gal" : "L"}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => setWdRows(wdRows.filter((x) => x.id !== r.id))}
                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer transition-colors"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Domestic Water Storage Tank Sizing Card */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1.5">
                    <Building2 className="size-4 text-[#0A7BC7]" /> 2. Storage Tank Capacity &amp; Split Sizing
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Storage Retention Days</label>
                    <select
                      value={storageDays}
                      onChange={(e) => setStorageDays(Number(e.target.value))}
                      className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                    >
                      <option value={1}>1 Day Storage (24 Hours — Standard)</option>
                      <option value={2}>2 Days Storage (48 Hours — DEWA/ADDC Reserve)</option>
                      <option value={3}>3 Days Storage (72 Hours — Emergency Reserve)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Ground vs Overhead Tank Split</label>
                    <select
                      value={tankSplit}
                      onChange={(e) => setTankSplit(e.target.value as any)}
                      className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                    >
                      <option value="60-40">60% Ground Tank / 40% Roof Tank (DEWA Standard)</option>
                      <option value="80-20">80% Ground Tank / 20% Roof Tank</option>
                      <option value="100-0">100% Ground Tank (Direct Booster Sizing)</option>
                      <option value="50-50">50% Ground Tank / 50% Roof Tank</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Target Storage Volume</label>
                    <div className="bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-[#0A7BC7] flex items-center justify-between">
                      <span>{calculations.displayTotalStorage}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Ground Water Break Tank ({tankSplit.split("-")[0]}%)</span>
                      <span className="text-xs font-mono font-extrabold text-[#0A7BC7]">{calculations.displayGroundTank}</span>
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      Suggested Dimensions: <strong className="text-foreground font-mono">{calculations.groundDim.l}m L × {calculations.groundDim.w}m W × {calculations.groundDim.h}m H</strong> (+ 0.3m freeboard)
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Overhead Roof Tank ({tankSplit.split("-")[1]}%)</span>
                      <span className="text-xs font-mono font-extrabold text-[#0A7BC7]">{calculations.displayRoofTank}</span>
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      Suggested Dimensions: <strong className="text-foreground font-mono">{calculations.roofDim.l}m L × {calculations.roofDim.w}m W × {calculations.roofDim.h}m H</strong> (+ 0.3m freeboard)
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Domestic Peak Flow & Transfer Pump Capacity Card */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1.5">
                    <Sparkles className="size-4 text-[#0A7BC7]" /> 3. Domestic Peak Flow &amp; Transfer Pump Sizing
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-sans">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Diversity / Peak Multiplier (K)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={peakFactor}
                      onChange={(e) => setPeakFactor(Number(e.target.value))}
                      className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Transfer Filling Duration</label>
                    <select
                      value={fillWindowHours}
                      onChange={(e) => setFillWindowHours(Number(e.target.value))}
                      className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                    >
                      <option value={1}>1 Hour Filling Window</option>
                      <option value={2}>2 Hours Filling Window (Standard)</option>
                      <option value={3}>3 Hours Filling Window</option>
                      <option value={4}>4 Hours Filling Window</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Calculated Peak Flow</label>
                    <div className="bg-slate-100 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-foreground">
                      {calculations.displayDomesticPeak}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-foreground">Required Transfer Pump Flow</label>
                    <div className="bg-[#0A7BC7] text-white border border-[#06456F] rounded-lg px-3 py-2 text-xs font-mono font-extrabold">
                      {calculations.displayTransferPump}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Irrigation Water Demand */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                    🌿 4. Irrigation Water Demand
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-slate-50/50 dark:bg-slate-900/30 p-3.5 border border-border rounded-xl text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Area ({ip ? "ft²" : "m²"})</label>
                    <input
                      type="number"
                      placeholder="e.g. 100"
                      value={newIrrArea}
                      onChange={(e) => setNewIrrArea(e.target.value !== "" ? Number(e.target.value) : "")}
                      className="bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">Vegetation Type</label>
                    <select
                      value={newIrrVegType}
                      onChange={(e) => setNewIrrVegType(e.target.value)}
                      className="bg-white dark:bg-slate-950 border border-border rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-[#0A7BC7]"
                    >
                      <option value="">— Select Plant Type —</option>
                      {Object.keys(IRR_TYPE_MAP).map((k) => (
                        <option key={k} value={k}>
                          {k} — {IRR_TYPE_MAP[k]} L/m²
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddIrr}
                    className="h-8.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="size-4" /> Add Plant Area
                  </button>
                </div>

                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full border-collapse text-[12.5px] font-sans">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-border text-foreground font-semibold">
                        <th className="p-2.5 text-center w-12">S.No</th>
                        <th className="p-2.5 text-left">Vegetation Type</th>
                        <th className="p-2.5 text-center w-32">Area</th>
                        <th className="p-2.5 text-right w-36">Rate</th>
                        <th className="p-2.5 text-right w-36">Total Load</th>
                        <th className="p-2.5 text-center w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {irrRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                            No irrigation entries.
                          </td>
                        </tr>
                      ) : (
                        irrRows.map((r, idx) => (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                            <td className="p-2 text-center text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="p-2">
                              <select
                                value={r.vegType}
                                onChange={(e) => handleIrrRowChange(r.id, "vegType", e.target.value)}
                                className="w-full bg-transparent border-0 outline-none cursor-pointer focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded text-xs"
                              >
                                {Object.keys(IRR_TYPE_MAP).map((k) => (
                                  <option key={k} value={k}>
                                    {k}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2 text-center font-bold font-mono">
                              <input
                                type="number"
                                value={r.area}
                                onChange={(e) => handleIrrRowChange(r.id, "area", Number(e.target.value))}
                                className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded"
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-medium text-muted-foreground">
                              {(ip ? Math.round((r.lpd / 40.7458) * 100) / 100 : r.lpd).toFixed(ip ? 3 : 1)} {ip ? "gal/ft²" : "L/m²"}
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-[#0A7BC7]">
                              {(ip ? Math.round((r.area * r.lpd) / 3.78541) : r.area * r.lpd).toLocaleString()} {ip ? "gal" : "L"}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => setIrrRows(irrRows.filter((x) => x.id !== r.id))}
                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer transition-colors"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 5. Swimming Pool & Fire Fighting Demand */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pool Card */}
                <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                      🏊 Swimming Pool Makeup
                    </h3>
                  </div>
                  <div className="flex flex-col gap-3 text-xs font-sans">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-foreground">Pool Surface Area ({ip ? "ft²" : "m²"})</label>
                      <input
                        type="number"
                        placeholder="e.g. 80"
                        value={poolArea}
                        onChange={(e) => setPoolArea(e.target.value !== "" ? Number(e.target.value) : "")}
                        className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-foreground">Average Depth ({ip ? "ft" : "m"})</label>
                      <input
                        type="number"
                        placeholder="e.g. 1.5"
                        value={poolDepth}
                        onChange={(e) => setPoolDepth(e.target.value !== "" ? Number(e.target.value) : "")}
                        className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-foreground">Evaporation Rate (%/day)</label>
                      <input
                        type="number"
                        value={poolEvap}
                        onChange={(e) => setPoolEvap(Number(e.target.value))}
                        className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                      />
                    </div>

                    {poolArea && poolDepth && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl mt-1 flex justify-between items-center">
                        <span className="text-xs font-bold text-blue-800 dark:text-blue-300">Daily Pool Makeup:</span>
                        <strong className="text-sm font-extrabold font-mono text-[#0A7BC7]">{calculations.displayPoolDemand}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fire Card */}
                <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                    <div className="w-1 h-3.5 bg-red-600 rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                      🔥 Fire Fighting Reserve Sizing
                    </h3>
                  </div>
                  <div className="flex flex-col gap-3 text-xs font-sans">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-foreground">Fire Pump Flow Rate (USGPM)</label>
                      <input
                        type="number"
                        placeholder="e.g. 500"
                        value={fireFlow}
                        onChange={(e) => setFireFlow(e.target.value !== "" ? Number(e.target.value) : "")}
                        className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-foreground">Standard Fire Reserve Duration</label>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 text-muted-foreground border border-border rounded-lg px-3 py-2 font-bold select-none cursor-not-allowed">
                        60 Minutes (Standard fixed NFPA duration)
                      </div>
                    </div>

                    {fireFlow && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl mt-1 flex justify-between items-center">
                        <span className="text-xs font-bold text-red-800 dark:text-red-300">Reserve Fire Tank:</span>
                        <strong className="text-sm font-extrabold font-mono text-red-600 dark:text-red-400">{calculations.displayFireCap}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Summary Panel */}
            <div className="lg:col-span-4 flex flex-col gap-5 sticky top-4">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                    📊 Site Sizing Summary
                  </h3>
                </div>

                <div className="flex flex-col gap-3 font-sans text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Domestic Daily Demand</span>
                    <strong className="font-bold text-foreground font-mono">{calculations.displayDomestic}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Domestic Peak Flow Rate</span>
                    <strong className="font-bold text-foreground font-mono">{calculations.displayDomesticPeak}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Irrigation Daily Demand</span>
                    <strong className="font-bold text-foreground font-mono">{calculations.displayIrrigation}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Pool Makeup Demand</span>
                    <strong className="font-bold text-foreground font-mono">{calculations.displayPoolDemand}</strong>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/60 bg-blue-50/50 dark:bg-blue-950/20 px-2 rounded-lg">
                    <span className="font-extrabold text-[#0A7BC7] uppercase text-[11px]">GRAND TOTAL DAILY DEMAND</span>
                    <strong className="font-black text-[#0A7BC7] text-[15px] font-mono">{calculations.displayGrandTotal}</strong>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                      <span className="font-semibold text-muted-foreground">Required Tank Capacity ({storageDays} Day)</span>
                      <strong className="font-bold text-foreground font-mono">{calculations.displayTotalStorage}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                      <span className="font-semibold text-muted-foreground">Ground Break Tank ({tankSplit.split("-")[0]}%)</span>
                      <strong className="font-bold text-foreground font-mono">{calculations.displayGroundTank}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                      <span className="font-semibold text-muted-foreground">Roof Overhead Tank ({tankSplit.split("-")[1]}%)</span>
                      <strong className="font-bold text-foreground font-mono">{calculations.displayRoofTank}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="font-semibold text-muted-foreground">Transfer Pump Flow ({fillWindowHours}h Fill)</span>
                      <strong className="font-bold text-[#0A7BC7] font-mono">{calculations.displayTransferPump}</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 rounded-xl p-3.5 flex gap-2.5 text-[11px]">
                  <Info className="size-4 shrink-0 mt-0.5 text-blue-600" />
                  <span>
                    Calculation complies with ASHRAE standards, local municipality consumption regulations, DEWA/ADDC guidelines, and standard diversity assumptions.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
