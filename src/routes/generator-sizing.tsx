import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { Download, FileSpreadsheet, Filter, HelpCircle, Plus, Printer, RefreshCw, Save, Settings, SlidersHorizontal, Trash2, FolderKanban, Search, ArrowRight, GripVertical, Upload, Copy, Info } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs: any = (saveAsPkg as any).saveAs || saveAsPkg;
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useEditableGrid, useGridNavigation } from "@/core/gridEngine";
import { toast } from "@/core/notifications";

export const Route = createFileRoute("/generator-sizing")({
  head: () => ({
    meta: [
      { title: "Generator Sizing — MEP Calc" },
      {
        name: "description",
        content: "Calculate DG set size based on connected and emergency loads.",
      },
    ],
  }),
  component: GeneratorSizingPage,
});

type StarterType = "DOL" | "SD" | "Soft Starter" | "VFD" | "None";

interface GenRow {
  id: string;
  desc: string;
  unit: number | string;
  kwPerUnit: number | string;
  starter: StarterType;
  multiplier: number | string;
  standby: number | string;
  emergency: number | string;
  powerFail: number | string;
  remark: string;
  excludeEmergency?: boolean;
}

const STARTER_MULTIPLIERS: Record<StarterType, number> = {
  DOL: 7,
  SD: 3,
  "Soft Starter": 2,
  VFD: 1,
  None: 0,
};

const STANDARD_SIZES = [
  125, 160, 200, 250, 320, 400, 500, 625, 750, 800, 1000, 1250, 1500, 1600, 2000, 2500,
];

function GeneratorSizingPage() {
  const confirm = useConfirm();

  const [projects, setProjects] = useState<Record<string, GenRow[]>>({ "Default Project": [] });
  const [currentProject, setCurrentProject] = useState<string>("Default Project");
  const [isLoaded, setIsLoaded] = useState(false);

  const {
    rows,
    selectedIds: selectedRows,
    toggleSelection,
    clearSelection,
    selectAll,
    updateRow: baseUpdateRow,
    addRow: baseAddRow,
    removeRow: baseRemoveRow,
    bulkDelete,
    bulkDuplicate,
    pushState,
    undo: handleUndo,
    redo: handleRedo,
    canUndo,
    canRedo,
  } = useEditableGrid<GenRow>({
    initialRows: projects[currentProject] || [],
    onStateChange: (newRows) => {
      setProjects((prev) => {
        if (prev[currentProject] === newRows) return prev;
        const newProjects = { ...prev, [currentProject]: newRows };
        window.localStorage.setItem("mep_gen_projects", JSON.stringify(newProjects));
        return newProjects;
      });
    },
    onNewRow: () => addRow(),
    onSave: () => saveProject(),
    onPrint: () => exportPdf(),
    onExportExcel: () => exportExcel(),
    onExportPdf: () => exportPdf(),
  });

  useGridNavigation({ gridId: "generator-grid" });

  const saveProject = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "mep_gen_projects.json");
    dlAnchorElem.click();
    toast.success("Project saved successfully");
  };

  const toggleRowSelect = (rowId: string, isShift: boolean, isCtrl: boolean) => {
    toggleSelection(rowId, isCtrl, isShift);
  };

  const [pf, setPf] = useState<number>(0.8);
  const [lf, setLf] = useState<number>(0.9);
  const [userSelectedSize, setUserSelectedSize] = useState<number | null>(null);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});

  const [activeTab, setActiveTab] = useState<"equipment" | "report">("equipment");
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("mep_gen_projects");
      if (saved) {
        const parsed = JSON.parse(saved);
        setProjects(parsed);
        if (parsed["Default Project"]) {
          pushState(parsed["Default Project"]);
        }
      }
    } catch {}
    setIsLoaded(true);
  }, []);

  const setOverride = (key: string, val: string) => {
    setManualOverrides((prev) => ({ ...prev, [key]: val }));
  };

  const clearOverrides = () => {
    setManualOverrides({});
  };

  const handleUnitToggle = (newSystem: "si" | "ip") => {
    if (newSystem === unitSystem) return;
    setUnitSystem(newSystem);
    clearOverrides();
    const newRows = rows.map((r) => {
      const kw = Number(r.kwPerUnit) || 0;
      const sb = Number(r.standby) || 0;
      const em = r.excludeEmergency ? 0 : Number(r.emergency) || 0;
      const pf = Number(r.powerFail) || 0;
      return {
        ...r,
        kwPerUnit:
          newSystem === "ip" ? Number((kw / 0.746).toFixed(2)) : Number((kw * 0.746).toFixed(2)),
        standby:
          newSystem === "ip" ? Number((sb / 0.746).toFixed(2)) : Number((sb * 0.746).toFixed(2)),
        emergency:
          newSystem === "ip" ? Number((em / 0.746).toFixed(2)) : Number((em * 0.746).toFixed(2)),
        powerFail:
          newSystem === "ip" ? Number((pf / 0.746).toFixed(2)) : Number((pf * 0.746).toFixed(2)),
      };
    });
    pushState(newRows);
  };

  const addRow = () => {
    const newRow: GenRow = {
      id: `gen_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      desc: "",
      unit: "",
      kwPerUnit: "",
      starter: "DOL",
      multiplier: STARTER_MULTIPLIERS["DOL"],
      standby: "",
      emergency: "",
      powerFail: "",
      remark: "",
    };
    baseAddRow(newRow);
  };

  const removeRow = async (id: string) => {
    baseRemoveRow(id);
  };

  const updateRow = (id: string, field: keyof GenRow, val: any) => {
    const targetIds = selectedRows.has(id) ? Array.from(selectedRows) : [id];

    const newRows = rows.map((row) => {
      if (!targetIds.includes(row.id)) return row;

      const newRow = { ...row, [field]: val };

      if (field === "starter") {
        newRow.multiplier = STARTER_MULTIPLIERS[val as StarterType] || 1;
      }

      if (field === "kwPerUnit" || field === "unit" || field === "standby") {
        const u = Number(newRow.unit) || 0;
        const kw = Number(newRow.kwPerUnit) || 0;
        const sb = Number(newRow.standby) || 0;
        const tc = u * kw;
        const ac = tc - sb;
        newRow.emergency = ac > 0 ? ac : "";
      }

      return newRow;
    });
    pushState(newRows);
  };

  const setPowerFailPercent = (id: string, percentStr: string) => {
    const percent = parseFloat(percentStr);
    if (!percent || isNaN(percent)) return;

    const newRows = rows.map((row) => {
      if (row.id !== id) return row;
      const u = Number(row.unit) || 0;
      const kw = Number(row.kwPerUnit) || 0;
      const sb = Number(row.standby) || 0;
      const actualKw = u * kw - sb;
      return { ...row, powerFail: parseFloat((actualKw * (percent / 100)).toFixed(2)) };
    });
    pushState(newRows);
  };

  const clearRows = async () => {
    if (rows.length === 0) return;
    if (await confirm("Are you sure you want to clear all loads?")) {
      pushState([]);
    }
  };

  const handleImportExcelRows = (mappedRows: any[]) => {
    const newGenRows: GenRow[] = mappedRows.map(mr => ({
      id: `gen_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      desc: mr.desc || "",
      unit: mr.unit || "",
      kwPerUnit: mr.kwPerUnit || "",
      starter: (mr.starter as StarterType) || "DOL",
      multiplier: mr.multiplier || "",
      standby: mr.standby || "",
      emergency: mr.emergency || "",
      powerFail: mr.powerFail || "",
      remark: mr.remark || "",
    }));
    pushState([...rows, ...newGenRows]);
  };

  const deleteSelectedRows = () => {
    bulkDelete();
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedRowIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.currentTarget.outerHTML);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedRowIndex === null || draggedRowIndex === index) return;

    const newRows = [...rows];
    const draggedRow = newRows[draggedRowIndex];
    newRows.splice(draggedRowIndex, 1);
    newRows.splice(index, 0, draggedRow);

    setDraggedRowIndex(index);
    pushState(newRows);
  };

  const handleDrop = () => setDraggedRowIndex(null);

  // Calculations
  const calc = useMemo(() => {
    let totalAcl = 0;
    let totalEmergency = 0;
    let maxStartCur = 0;
    let largestMotorKw = 0;
    let largestMotorStarter = "-";

    rows.forEach((r) => {
      const rKw = Number(r.kwPerUnit) || 0;
      const rSb = Number(r.standby) || 0;
      const rEm = r.excludeEmergency ? 0 : Number(r.emergency) || 0;
      const rUnit = Number(r.unit) || 0;
      const rMult = Number(r.multiplier) || 0;

      const kwPerUnit = unitSystem === "ip" ? rKw * 0.746 : rKw;
      const standby = unitSystem === "ip" ? rSb * 0.746 : rSb;
      const emergency = unitSystem === "ip" ? rEm * 0.746 : rEm;

      const totalKw = rUnit * kwPerUnit;
      const actualKw = totalKw - standby;
      totalAcl += actualKw;
      totalEmergency += emergency;

      const startCur = kwPerUnit * 1.739 * rMult;

      if (startCur > maxStartCur) {
        maxStartCur = startCur;
      }

      if (kwPerUnit > largestMotorKw) {
        largestMotorKw = kwPerUnit;
        largestMotorStarter = r.starter;
      }
    });

    const getEffective = (key: string, computed: number) => {
      if (manualOverrides[key] !== undefined && manualOverrides[key] !== "") {
        return parseFloat(manualOverrides[key]) || 0;
      }
      return computed;
    };

    const baseAcl = getEffective("acl", unitSystem === "ip" ? totalAcl / 0.746 : totalAcl);
    const baseEm = getEffective(
      "em",
      unitSystem === "ip" ? totalEmergency / 0.746 : totalEmergency,
    );

    const aclKw = unitSystem === "ip" ? baseAcl * 0.746 : baseAcl;
    const emKw = unitSystem === "ip" ? baseEm * 0.746 : baseEm;

    const demandLoadAcl = getEffective("demandAcl", aclKw / pf);
    const demandLoadEm = getEffective("demandEm", emKw / pf);

    const calcSizeAcl = getEffective("calcAcl", demandLoadAcl / lf);
    const calcSizeEm = getEffective("calcEm", demandLoadEm / lf);

    const effectiveMaxStart = getEffective("maxStart", maxStartCur);

    const maxCalcSize = Math.max(calcSizeAcl, calcSizeEm);
    let autoSize = STANDARD_SIZES.find((size) => size >= maxCalcSize);
    if (!autoSize) autoSize = STANDARD_SIZES[STANDARD_SIZES.length - 1];

    const selectedSize = userSelectedSize !== null ? userSelectedSize : autoSize;

    return {
      totalAcl: baseAcl,
      totalEmergency: baseEm,
      demandLoadAcl,
      demandLoadEm,
      calcSizeAcl,
      calcSizeEm,
      selectedSize,
      maxStartCur: effectiveMaxStart,
      largestMotorKw,
      largestMotorStarter,
    };
  }, [rows, pf, lf, unitSystem, userSelectedSize, manualOverrides]);

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Generator Sizing", {
      views: [{ showGridLines: false }],
    });

    // Styles
    const fontNormal = { name: "Cambria", size: 10, bold: false };
    const fontBold = { name: "Cambria", size: 10, bold: true };
    const fontTitle = { name: "Cambria", size: 11, bold: true };
    const alignCenter = { horizontal: "center", vertical: "middle", wrapText: true } as any;
    const alignLeft = { horizontal: "left", vertical: "middle", wrapText: true } as any;
    const alignRight = { horizontal: "right", vertical: "middle", wrapText: true } as any;

    const bgGray = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } } as any;
    const bgYellow = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } } as any;
    const bgGreen = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6E0B4" } } as any;

    const borderThin = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    } as any;

    // Define columns and widths
    worksheet.columns = [
      { width: 8 }, // A: S.NO
      { width: 40 }, // B: DESCRIPTION
      { width: 8 }, // C: QTY
      { width: 12 }, // D: kW / UNIT
      { width: 15 }, // E: STARTER TYPE
      { width: 15 }, // F: STARTING CURRENT
      { width: 12 }, // G: TOTAL
      { width: 12 }, // H: STANDBY
      { width: 15 }, // I: ACL
      { width: 15 }, // J: EMERGENCY
      { width: 15 }, // K: POWER FAIL
      { width: 30 }, // L: REMARKS
    ];

    const setBorder = (cell: any) => {
      cell.border = borderThin;
    };

    // --- Top Headers ---
    worksheet.mergeCells("A1:F1");
    const r1c1 = worksheet.getCell("A1");
    r1c1.value = "Calculation No:";
    r1c1.font = fontBold;
    r1c1.alignment = alignLeft;
    setBorder(r1c1);

    worksheet.mergeCells("G1:L1");
    const r1c2 = worksheet.getCell("G1");
    r1c2.value = "Date     :";
    r1c2.font = fontBold;
    r1c2.alignment = alignLeft;
    setBorder(r1c2);

    worksheet.mergeCells("A2:F2");
    const r2c1 = worksheet.getCell("A2");
    r2c1.value = "Project No   :";
    r2c1.font = fontBold;
    r2c1.alignment = alignLeft;
    setBorder(r2c1);

    worksheet.mergeCells("G2:L2");
    const r2c2 = worksheet.getCell("G2");
    r2c2.value = "Client   :";
    r2c2.font = fontBold;
    r2c2.alignment = alignLeft;
    setBorder(r2c2);

    worksheet.mergeCells("A3:F3");
    const r3c1 = worksheet.getCell("A3");
    r3c1.value = "Project Name :";
    r3c1.font = fontBold;
    r3c1.alignment = alignLeft;
    setBorder(r3c1);

    worksheet.mergeCells("G3:L3");
    const r3c2 = worksheet.getCell("G3");
    r3c2.value = "End User :";
    r3c2.font = fontBold;
    r3c2.alignment = alignLeft;
    setBorder(r3c2);

    // Apply borders to the merged cells properly
    for (let i = 1; i <= 3; i++) {
      for (let j = 1; j <= 12; j++) {
        setBorder(worksheet.getCell(i, j));
      }
    }

    // --- Table Headers ---
    const h1 = worksheet.addRow([
      "Sr. No.",
      "Description",
      "Unit",
      "kW / UNIT",
      "Starter Types",
      "Starting Current",
      "Total Connected Load",
      "Total Standby Load",
      "Actual Connected Load",
      "Emergency Load",
      "Power Failure Load",
      "Remarks",
    ]);
    const h2 = worksheet.addRow(["", "", "", "", "", "Amps", "kW", "kW", "kW", "kW", "kW", ""]);

    ["A", "B", "C", "D", "E", "L"].forEach((col) => {
      worksheet.mergeCells(`${col}4:${col}5`);
    });

    [h1, h2].forEach((r) => {
      r.eachCell((cell, colNumber) => {
        cell.font = fontBold;
        cell.alignment = alignCenter;
        setBorder(cell);
        if (colNumber === 10 || colNumber === 11) {
          cell.fill = bgYellow;
        } else {
          cell.fill = bgGray;
        }
      });
    });

    // Row 6: GENERATOR LOAD - CALCULATION
    worksheet.mergeCells("A6:L6");
    const titleRow = worksheet.getCell("A6");
    titleRow.value = "GENERATOR LOAD - CALCULATION";
    titleRow.font = fontTitle;
    titleRow.alignment = alignCenter;
    setBorder(titleRow);
    for (let j = 1; j <= 12; j++) setBorder(worksheet.getCell(6, j));

    let rowIndex = 7; // Data starts at row 7

    rows.forEach((r, idx) => {
      const rUnit = Number(r.unit) || 0;
      const rKw = Number(r.kwPerUnit) || 0;
      const rSb = Number(r.standby) || 0;
      const rMult = Number(r.multiplier) || 1;
      const startCur = rKw * 1.739 * rMult;
      const totalKw = rUnit * rKw;
      const actualKw = totalKw - rSb;
      const emergency = r.excludeEmergency ? 0 : Number(r.emergency) || 0;

      const row = worksheet.addRow([
        idx + 1, // A: Sr. No.
        r.desc, // B: Description
        rUnit, // C: Unit
        rKw, // D: kW / UNIT
        r.starter, // E: Starter Types
        { formula: `D${rowIndex}*1.739*${rMult}`, result: startCur }, // F: Starting Current
        { formula: `C${rowIndex}*D${rowIndex}`, result: totalKw }, // G: Total Connected Load
        rSb, // H: Total Standby Load
        { formula: `G${rowIndex}-H${rowIndex}`, result: actualKw }, // I: Actual Connected Load
        emergency, // J: Emergency Load
        Number(r.powerFail) || 0, // K: Power Failure Load
        r.remark || "", // L: Remarks
      ]);

      row.eachCell((cell, colNumber) => {
        cell.font = fontNormal;
        setBorder(cell);
        cell.alignment = colNumber === 2 ? alignLeft : alignCenter;
        if (colNumber === 10 || colNumber === 11) {
          cell.fill = bgYellow;
        }
      });
      rowIndex++;
    });

    // --- Footer Summary ---
    // Add a blank row space between data and footer
    rowIndex++;

    const addFooterRow = (
      title: string,
      aclVal: any,
      emVal: any,
      extra1: string = "",
      extra2: string = "",
    ) => {
      worksheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
      const titleCell = worksheet.getCell(`A${rowIndex}`);
      titleCell.value = title;
      titleCell.alignment = alignRight;
      titleCell.font = fontNormal;
      for (let col = 1; col <= 8; col++) setBorder(worksheet.getCell(rowIndex, col));

      const aclCell = worksheet.getCell(`I${rowIndex}`);
      aclCell.value = aclVal !== null ? aclVal : "";
      aclCell.alignment = alignCenter;
      aclCell.font = fontNormal;
      setBorder(aclCell);
      if (aclVal !== null) aclCell.fill = bgYellow;

      const emCell = worksheet.getCell(`J${rowIndex}`);
      emCell.value = emVal !== null ? emVal : "";
      emCell.alignment = alignCenter;
      emCell.font = fontNormal;
      setBorder(emCell);
      if (emVal !== null) emCell.fill = bgYellow;

      const x1Cell = worksheet.getCell(`K${rowIndex}`);
      x1Cell.value = extra1;
      x1Cell.font = fontBold;
      setBorder(x1Cell);

      const x2Cell = worksheet.getCell(`L${rowIndex}`);
      x2Cell.value = extra2;
      x2Cell.font = fontNormal;
      setBorder(x2Cell);

      rowIndex++;
    };

    addFooterRow(
      "Total Actual Connected Load in kW (ACL)",
      Number(calc.totalAcl.toFixed(2)),
      Number(calc.totalEmergency.toFixed(2)),
      "Type of Starter",
      "Starting current",
    );
    worksheet.getCell(`L${rowIndex - 1}`).font = fontBold; // Bold "Starting current"

    addFooterRow(
      "Consider power factor (PF Lagging)",
      pf,
      pf,
      "Direct On Line (DOL)",
      "Full load current x 7",
    );
    addFooterRow(
      "Demand load in KVA ( DL = ACL / PF ) kVA",
      Number(calc.demandLoadAcl.toFixed(2)),
      Number(calc.demandLoadEm.toFixed(2)),
      "Star Delta Starter (SD)",
      "Full load current x 3",
    );
    addFooterRow(
      "Consider 90% loading for standby OR 80% loading for Prime Generators (If Standby DG )",
      lf,
      lf,
      "Variable Frequency Drive (VFD)",
      "Full load current",
    );
    addFooterRow(
      "Calculated size for DG set ( DL / LF ) kVA",
      Number(calc.calcSizeAcl.toFixed(2)),
      Number(calc.calcSizeEm.toFixed(2)),
    );
    addFooterRow(
      "Maximum Starting Current for Motor (Amp)",
      Number(calc.maxStartCur.toFixed(2)),
      "",
    );
    worksheet.getCell(`J${rowIndex - 1}`).fill = bgYellow; // Make empty emergency cell yellow
    addFooterRow(
      "Calculated DG Set Size in kVA",
      Math.max(calc.calcSizeAcl, calc.calcSizeEm).toFixed(2),
      "",
    );
    worksheet.getCell(`J${rowIndex - 1}`).fill = bgYellow; // Make empty emergency cell yellow

    // Selected size row
    worksheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
    const selTitle = worksheet.getCell(`A${rowIndex}`);
    selTitle.value = "Selected size of DG Set Size in kVA";
    selTitle.font = fontBold;
    selTitle.alignment = alignRight;
    for (let col = 1; col <= 8; col++) {
      const c = worksheet.getCell(rowIndex, col);
      setBorder(c);
      c.fill = bgGray;
    }

    worksheet.mergeCells(`I${rowIndex}:J${rowIndex}`);
    const selVal = worksheet.getCell(`I${rowIndex}`);
    selVal.value = calc.selectedSize;
    selVal.font = fontBold;
    selVal.alignment = alignCenter;
    setBorder(worksheet.getCell(`I${rowIndex}`));
    setBorder(worksheet.getCell(`J${rowIndex}`));
    selVal.fill = bgYellow;
    worksheet.getCell(`J${rowIndex}`).fill = bgYellow;

    worksheet.mergeCells(`K${rowIndex}:L${rowIndex}`);
    for (let col = 11; col <= 12; col++) {
      const c = worksheet.getCell(rowIndex, col);
      setBorder(c);
      c.fill = bgGray;
    }
    rowIndex++;

    // Signatures Header
    worksheet.getCell(`A${rowIndex}`).value = "";
    setBorder(worksheet.getCell(`A${rowIndex}`));

    worksheet.mergeCells(`B${rowIndex}:E${rowIndex}`);
    const origTitle = worksheet.getCell(`B${rowIndex}`);
    origTitle.value = "Originated By";
    origTitle.font = fontBold;
    origTitle.alignment = alignCenter;
    origTitle.fill = bgGreen;
    for (let c = 2; c <= 5; c++) setBorder(worksheet.getCell(rowIndex, c));

    worksheet.mergeCells(`F${rowIndex}:I${rowIndex}`);
    const revTitle = worksheet.getCell(`F${rowIndex}`);
    revTitle.value = "Reviewed By";
    revTitle.font = fontBold;
    revTitle.alignment = alignCenter;
    revTitle.fill = bgGreen;
    for (let c = 6; c <= 9; c++) setBorder(worksheet.getCell(rowIndex, c));

    worksheet.mergeCells(`J${rowIndex}:L${rowIndex}`);
    const appTitle = worksheet.getCell(`J${rowIndex}`);
    appTitle.value = "Approved By";
    appTitle.font = fontBold;
    appTitle.alignment = alignCenter;
    appTitle.fill = bgGreen;
    for (let c = 10; c <= 12; c++) setBorder(worksheet.getCell(rowIndex, c));
    rowIndex++;

    // Signatures Name
    worksheet.getCell(`A${rowIndex}`).value = "Name";
    worksheet.getCell(`A${rowIndex}`).font = fontBold;
    setBorder(worksheet.getCell(`A${rowIndex}`));

    worksheet.mergeCells(`B${rowIndex}:E${rowIndex}`);
    worksheet.getCell(`B${rowIndex}`).value = "";
    worksheet.getCell(`B${rowIndex}`).alignment = alignCenter;
    for (let c = 2; c <= 5; c++) setBorder(worksheet.getCell(rowIndex, c));

    worksheet.mergeCells(`F${rowIndex}:I${rowIndex}`);
    worksheet.getCell(`F${rowIndex}`).value = "";
    worksheet.getCell(`F${rowIndex}`).alignment = alignCenter;
    for (let c = 6; c <= 9; c++) setBorder(worksheet.getCell(rowIndex, c));

    worksheet.mergeCells(`J${rowIndex}:L${rowIndex}`);
    worksheet.getCell(`J${rowIndex}`).value = "";
    worksheet.getCell(`J${rowIndex}`).alignment = alignCenter;
    for (let c = 10; c <= 12; c++) setBorder(worksheet.getCell(rowIndex, c));
    rowIndex++;

    // Signature Space
    worksheet.getCell(`A${rowIndex}`).value = "Signature";
    worksheet.getCell(`A${rowIndex}`).font = fontBold;
    setBorder(worksheet.getCell(`A${rowIndex}`));

    worksheet.mergeCells(`B${rowIndex}:E${rowIndex}`);
    for (let c = 2; c <= 5; c++) setBorder(worksheet.getCell(rowIndex, c));

    worksheet.mergeCells(`F${rowIndex}:I${rowIndex}`);
    for (let c = 6; c <= 9; c++) setBorder(worksheet.getCell(rowIndex, c));

    worksheet.mergeCells(`J${rowIndex}:L${rowIndex}`);
    for (let c = 10; c <= 12; c++) setBorder(worksheet.getCell(rowIndex, c));
    worksheet.getRow(rowIndex).height = 40;
    rowIndex++;

    // Date Space
    worksheet.getCell(`A${rowIndex}`).value = "Date";
    worksheet.getCell(`A${rowIndex}`).font = fontBold;
    setBorder(worksheet.getCell(`A${rowIndex}`));

    const today = "";

    worksheet.mergeCells(`B${rowIndex}:E${rowIndex}`);
    worksheet.getCell(`B${rowIndex}`).value = today;
    worksheet.getCell(`B${rowIndex}`).alignment = alignCenter;
    for (let c = 2; c <= 5; c++) setBorder(worksheet.getCell(rowIndex, c));

    worksheet.mergeCells(`F${rowIndex}:I${rowIndex}`);
    worksheet.getCell(`F${rowIndex}`).value = today;
    worksheet.getCell(`F${rowIndex}`).alignment = alignCenter;
    for (let c = 6; c <= 9; c++) setBorder(worksheet.getCell(rowIndex, c));

    worksheet.mergeCells(`J${rowIndex}:L${rowIndex}`);
    worksheet.getCell(`J${rowIndex}`).value = today;
    worksheet.getCell(`J${rowIndex}`).alignment = alignCenter;
    for (let c = 10; c <= 12; c++) setBorder(worksheet.getCell(rowIndex, c));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, "Generator_Sizing_Calculation.xlsx");
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.text("Generator Sizing Calculation", 14, 15);
    const tableData = rows.map((r) => {
      const rKw = Number(r.kwPerUnit) || 0;
      const rUnit = Number(r.unit) || 0;
      const rSb = Number(r.standby) || 0;
      const rEm = r.excludeEmergency ? 0 : Number(r.emergency) || 0;
      const rMult = Number(r.multiplier) || 0;
      return [
        r.desc,
        rUnit.toString(),
        rKw.toString(),
        r.starter,
        rMult.toString(),
        (rUnit * rKw - rSb).toFixed(2),
        rEm.toString(),
      ];
    });
    const sizeHeader = unitSystem === "ip" ? "HP/Unit" : "kW/Unit";
    const aclHeader = unitSystem === "ip" ? "ACL (HP)" : "ACL (kW)";
    const emHeader = unitSystem === "ip" ? "Emerg (HP)" : "Emerg (kW)";
    autoTable(doc, {
      head: [["Description", "Unit", sizeHeader, "Starter", "Multiplier", aclHeader, emHeader]],
      body: tableData,
      startY: 20,
    });
    doc.save("generator_sizing.pdf");
  };

  const duplicateRow = (id: string) => {
    const rowToDup = rows.find((r) => r.id === id);
    if (!rowToDup) return;
    const newRow = { ...rowToDup, id: `gen_${Date.now()}_${Math.floor(Math.random() * 1000)}` };
    const rowIndex = rows.findIndex((r) => r.id === id);
    const newRows = [...rows];
    newRows.splice(rowIndex + 1, 0, newRow);
    pushState(newRows);
  };

  const createNewProject = () => {
    const name = prompt("Enter new project name:");
    if (name && !projects[name]) {
      setProjects((p) => ({ ...p, [name]: [] }));
      setCurrentProject(name);
      pushState([]);
    }
  };

  return (
    <AppShell
      title="Generator Sizing"
      subtitle="Calculate DG set size based on connected and emergency loads"
    >
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30">
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
        <div className="relative z-10 flex flex-col h-full w-full">
          {/* Sections Navigation (Tabs) */}
          <div className="flex px-4 border-b border-border gap-6 bg-surface-1 pt-1 shrink-0 select-none">
            <button
              onClick={() => setActiveTab("equipment")}
              className={`py-2 text-[13px] font-semibold tracking-wide border-b-2 transition-colors ${activeTab === "equipment" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}
            >
              Generator
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={`py-2 text-[13px] font-semibold tracking-wide border-b-2 transition-colors ${activeTab === "report" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}
            >
              Report
            </button>
          </div>

          {activeTab === "report" && (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-3xl mx-auto bg-surface-1 border border-border rounded-lg p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Calculator Reports</h2>
                <p className="text-[13.5px] text-muted-foreground mb-6">
                  Export your finalized generator sizing calculations. Make sure you have completed
                  all manual overrides and configuration before exporting.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-border rounded-lg p-4 bg-background flex flex-col items-start gap-3">
                    <div className="size-10 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center">
                      <Download className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[14px]">Excel Spreadsheet</h3>
                      <p className="text-[12.5px] text-muted-foreground mt-1">
                        Export raw calculation rows to an XLSX file.
                      </p>
                    </div>
                    <TBtn primary onClick={exportExcel} className="mt-2 w-full justify-center">
                      Export Excel
                    </TBtn>
                  </div>

                  <div className="border border-border rounded-lg p-4 bg-background flex flex-col items-start gap-3">
                    <div className="size-10 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center">
                      <Download className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[14px]">PDF Document</h3>
                      <p className="text-[12.5px] text-muted-foreground mt-1">
                        Generate a formatted PDF calculation report.
                      </p>
                    </div>
                    <TBtn primary onClick={exportPdf} className="mt-2 w-full justify-center">
                      Export PDF
                    </TBtn>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "equipment" && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Filter & Action Toolbar */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-4 py-2 min-h-[48px] h-auto border-b border-border bg-background shrink-0 select-none gap-y-3 overflow-x-auto">
                <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      placeholder="Search..."
                      className="h-7 w-56 pl-8 pr-2 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded text-[12.5px] outline-none transition-colors"
                    />
                  </div>
                  <TBtn>
                    <Filter className="size-3.5" /> Filters
                  </TBtn>
                  <TBtn>
                    <SlidersHorizontal className="size-3.5" /> View
                  </TBtn>
                  <div className="w-px h-4 bg-border mx-1" />
                  <div className="flex rounded border border-border p-0.5 bg-surface-2 shrink-0">
                    <button
                      onClick={() => handleUnitToggle("si")}
                      className={`px-3 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                        unitSystem === "si"
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      SI
                    </button>
                    <button
                      onClick={() => handleUnitToggle("ip")}
                      className={`px-3 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                        unitSystem === "ip"
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      IP
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
                  <ImportExcelBtn
                    columnMapping={{
                      "Description": "desc",
                      "Unit": "unit",
                      "kW / UNIT": "kwPerUnit",
                      "Starter Types": "starter",
                      "Standby (A)": "standby",
                      "Emergency Load": "emergency",
                      "Power Failure Load": "powerFail",
                      "Remarks": "remark"
                    }}
                    onImport={handleImportExcelRows}
                  />

                  <div className="w-px h-4 bg-border mx-1" />

                  <select
                    className="h-8 text-[12.5px] font-medium bg-surface-2 hover:bg-surface-3 border border-transparent hover:border-border rounded px-2 outline-none cursor-pointer transition-colors"
                    value={currentProject}
                    onChange={(e) => {
                      if (e.target.value !== "NEW_PROJECT") {
                        setCurrentProject(e.target.value);
                        pushState(projects[e.target.value] || []);
                      }
                    }}
                  >
                    {Object.keys(projects).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  <TBtn onClick={createNewProject}>
                    <FolderKanban className="size-3.5" /> New Project
                  </TBtn>
                  <TBtn primary onClick={addRow}>
                    <Plus className="size-3.5" /> New Row
                  </TBtn>
                </div>
              </div>

              <div className="flex flex-col xl:flex-row flex-1 min-h-0 overflow-y-auto xl:overflow-hidden">
                {/* Left Side: Table */}
                <div className="flex flex-col flex-1 min-w-0 min-h-0 border-b xl:border-b-0 xl:border-r border-white/40 dark:border-white/10 overflow-y-auto bg-transparent">
                  <div className="p-4 flex-1 overflow-x-auto w-full">
                    <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl overflow-x-auto shadow-[0_20px_50px_rgba(0,0,0,0.1)] min-w-[1000px]">
                      <table id="generator-grid" className="w-full text-[12.5px] border-collapse">
                        <thead className="bg-white/40 dark:bg-white/5 sticky top-0 border-b border-white/40 dark:border-white/10 z-10 font-semibold text-muted-foreground">
                          <tr className="text-left font-semibold">
                            <th className="px-2 py-2 border-r border-border w-14 text-center">
                              <input
                                type="checkbox"
                                className="cursor-pointer"
                                checked={rows.length > 0 && selectedRows.size === rows.length}
                                onChange={(e) => {
                                  if (e.target.checked) selectAll();
                                  else clearSelection();
                                }}
                              />
                            </th>
                            <th className="px-3 py-2 border-r border-border">Description</th>
                            <th className="px-3 py-2 border-r border-border w-16 text-center">
                              Unit
                            </th>
                            <th className="px-3 py-2 border-r border-border w-20 text-center">
                              {unitSystem === "ip" ? "HP / UNIT" : "kW / UNIT"}
                            </th>
                            <th className="px-3 py-2 border-r border-border w-32 text-center">
                              Starter Type
                            </th>
                            <th className="px-3 py-2 border-r border-border w-16 text-center">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="Multiplication factor for starting current. Typically 7 for DOL, 3.5 for Star Delta/Soft Starter, 1 for VFD."
                              >
                                Mult. <Info className="size-3" />
                              </span>
                            </th>
                            <th className="px-3 py-2 border-r border-border w-24 text-center">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="kW * 1.739 * Multiplier"
                              >
                                Start Cur. <Info className="size-3" />
                              </span>
                            </th>
                            <th className="px-3 py-2 border-r border-border w-20 text-center">
                              {unitSystem === "ip" ? "Total (HP)" : "Total (kW)"}
                            </th>
                            <th className="px-3 py-2 border-r border-border w-20 text-center">
                              {unitSystem === "ip" ? "Standby (HP)" : "Standby (kW)"}
                            </th>
                            <th className="px-3 py-2 border-r border-border w-20 text-center">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="Actual Connected Load (Total kW - Standby)"
                              >
                                ACL <Info className="size-3" />
                              </span>
                            </th>
                            <th className="px-3 py-2 border-r border-border w-24 text-center">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="Defaults to ACL. Used to calculate emergency DG size."
                              >
                                Emergency <Info className="size-3" />
                              </span>
                            </th>
                            <th className="px-3 py-2 border-r border-border w-32 text-center">
                              {unitSystem === "ip" ? "Power Fail (HP)" : "Power Fail (kW)"}
                            </th>
                            <th className="px-3 py-2 border-r border-border w-48 text-center">
                              Remark
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={12}
                                className="text-center py-10 text-muted-foreground italic"
                              >
                                No loads added. Click "+ Add Load" to begin.
                              </td>
                            </tr>
                          ) : (
                            rows.map((r, rowIndex) => {
                              const rKw = Number(r.kwPerUnit) || 0;
                              const rSb = Number(r.standby) || 0;
                              const rUnit = Number(r.unit) || 0;
                              const rMult = Number(r.multiplier) || 0;

                              const startCur = rKw * 1.739 * rMult;
                              const totalKw = rUnit * rKw;
                              const actualKw = totalKw - rSb;

                              return (
                                <tr
                                  key={r.id}
                                  className={`hover:bg-surface-2 transition-colors cursor-pointer ${selectedRows.has(r.id) ? "bg-primary/5" : ""} ${draggedRowIndex === rowIndex ? "opacity-50" : ""}`}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, rowIndex)}
                                  onDragOver={(e) => handleDragOver(e, rowIndex)}
                                  onDrop={handleDrop}
                                  onDragEnd={handleDrop}
                                  onClick={(e) => {
                                    const tagName = (e.target as HTMLElement).tagName;
                                    if (tagName === "TD") {
                                      toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                    }
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    // Fallback to simple alert or custom right-click if Radix fails
                                    alert("Context Menu: \n- Edit Row\n- Duplicate\n- Delete");
                                  }}
                                >
                                  <td className="p-0 border-r border-border">
                                    <div className="flex items-center justify-center gap-1.5 h-9 px-1">
                                      <GripVertical className="size-3.5 text-muted-foreground/50 cursor-grab active:cursor-grabbing hover:text-foreground" />
                                      <input
                                        type="checkbox"
                                        className="cursor-pointer"
                                        checked={selectedRows.has(r.id)}
                                        onChange={() => {}}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                        }}
                                      />
                                    </div>
                                  </td>
                                  <td className="p-0 border-r border-border">
                                    <input
                                      data-row={rowIndex}
                                      data-col={0}
                                      type="text"
                                      className="w-full h-9 px-3 bg-transparent outline-none focus:bg-white"
                                      value={r.desc}
                                      onChange={(e) => updateRow(r.id, "desc", e.target.value)}
                                      placeholder="Description"
                                    />
                                  </td>
                                  <td className="p-0 border-r border-border">
                                    <input
                                      data-row={rowIndex}
                                      data-col={1}
                                      type="number"
                                      className="w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      value={r.unit}
                                      onChange={(e) => updateRow(r.id, "unit", e.target.value)}
                                    />
                                  </td>
                                  <td className="p-0 border-r border-border">
                                    <input
                                      data-row={rowIndex}
                                      data-col={2}
                                      type="number"
                                      className="w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      value={r.kwPerUnit}
                                      onChange={(e) => updateRow(r.id, "kwPerUnit", e.target.value)}
                                    />
                                  </td>
                                  <td className="p-0 border-r border-border">
                                    <select
                                      data-row={rowIndex}
                                      data-col={3}
                                      className="w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white cursor-pointer"
                                      value={r.starter}
                                      onChange={(e) => updateRow(r.id, "starter", e.target.value)}
                                    >
                                      <option value="DOL">DOL</option>
                                      <option value="SD">Star Delta</option>
                                      <option value="Soft Starter">Soft Starter</option>
                                      <option value="VFD">VFD</option>
                                      <option value="None">None</option>
                                    </select>
                                  </td>
                                  <td className="p-0 border-r border-border bg-primary/10">
                                    <input
                                      data-row={rowIndex}
                                      data-col={4}
                                      type="number"
                                      className="w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      value={r.multiplier}
                                      onChange={(e) =>
                                        updateRow(r.id, "multiplier", e.target.value)
                                      }
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-center font-semibold text-foreground border-r border-border">
                                    {startCur.toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 text-center text-muted-foreground border-r border-border">
                                    {totalKw.toFixed(2)}
                                  </td>
                                  <td className="p-0 border-r border-border">
                                    <input
                                      data-row={rowIndex}
                                      data-col={5}
                                      type="number"
                                      className="w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      value={r.standby}
                                      onChange={(e) => updateRow(r.id, "standby", e.target.value)}
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-center font-semibold text-primary border-r border-border">
                                    {actualKw.toFixed(2)}
                                  </td>
                                  <td className="p-0 border-r border-border relative group/em">
                                    <div className="flex items-center w-full h-full">
                                      <input
                                        data-row={rowIndex}
                                        data-col={6}
                                        type="number"
                                        className={`w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${r.excludeEmergency ? "opacity-30 line-through" : ""}`}
                                        value={r.emergency}
                                        onChange={(e) =>
                                          updateRow(r.id, "emergency", e.target.value)
                                        }
                                        disabled={r.excludeEmergency}
                                      />
                                      <button
                                        onClick={() =>
                                          updateRow(r.id, "excludeEmergency", !r.excludeEmergency)
                                        }
                                        className="absolute right-1 opacity-0 group-hover/em:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-opacity bg-white shadow-sm rounded border border-border"
                                        title={
                                          r.excludeEmergency
                                            ? "Include Emergency Load"
                                            : "Exclude Emergency Load"
                                        }
                                      >
                                        {r.excludeEmergency ? (
                                          <Plus className="size-3" />
                                        ) : (
                                          <Trash2 className="size-3" />
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                  <td className="p-0 flex items-center border-r border-border">
                                    <input
                                      data-row={rowIndex}
                                      data-col={7}
                                      type="number"
                                      className="w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none flex-1"
                                      value={r.powerFail}
                                      onChange={(e) => updateRow(r.id, "powerFail", e.target.value)}
                                    />
                                    <select
                                      className="h-9 w-12 px-1 bg-primary/10 text-primary outline-none cursor-pointer border-l border-border/50 text-[11px] font-medium"
                                      defaultValue=""
                                      onChange={(e) => {
                                        setPowerFailPercent(r.id, e.target.value);
                                        e.target.value = "";
                                      }}
                                    >
                                      <option value="" disabled>
                                        %
                                      </option>
                                      <option value="10">10%</option>
                                      <option value="20">20%</option>
                                      <option value="30">30%</option>
                                      <option value="40">40%</option>
                                      <option value="50">50%</option>
                                      <option value="60">60%</option>
                                      <option value="70">70%</option>
                                      <option value="80">80%</option>
                                      <option value="90">90%</option>
                                      <option value="100">100%</option>
                                    </select>
                                  </td>
                                  <td className="p-0 border-r border-border">
                                    <input
                                      data-row={rowIndex}
                                      data-col={8}
                                      type="text"
                                      className="w-full h-9 px-2 text-center bg-transparent outline-none focus:bg-white"
                                      value={r.remark || ""}
                                      onChange={(e) => updateRow(r.id, "remark", e.target.value)}
                                    />
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right Side: Results & Config */}
                <div className="flex flex-col w-full xl:w-[320px] shrink-0 border-t xl:border-t-0 xl:border-l border-white/40 dark:border-white/10 bg-transparent overflow-y-auto p-4 gap-4">
                  <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-4 shrink-0">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 border-b border-white/40 dark:border-white/10 pb-2">
                      Sizing Parameters
                    </h4>
                    <div className="space-y-3 text-[13px]">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Power Factor (Lag)</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-20 px-2 py-1 border border-border rounded outline-none text-right [appearance:textfield]"
                          value={pf}
                          onChange={(e) => setPf(parseFloat(e.target.value) || 0.8)}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Loading Factor</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-20 px-2 py-1 border border-border rounded outline-none text-right [appearance:textfield]"
                          value={lf}
                          onChange={(e) => setLf(parseFloat(e.target.value) || 0.9)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col justify-between overflow-hidden shrink-0">
                    <div className="px-4 py-3 border-b border-white/40 dark:border-white/10 flex items-center gap-2 bg-primary/10">
                      <div className="w-1 h-4 bg-primary rounded-full" />
                      <h4 className="font-bold text-[12px] text-primary uppercase tracking-wide">
                        Generator Result
                      </h4>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Header Row */}
                      <div className="grid grid-cols-[1fr_80px_80px] gap-4 pb-2 border-b border-surface-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Parameter
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                          ACL Base
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                          Emerg. Base
                        </span>
                      </div>

                      <div className="grid grid-cols-[1fr_80px_80px] gap-4 items-center pb-2 border-b border-surface-2">
                        <span className="text-[12.5px] font-medium text-muted-foreground">
                          Total Actual Connected Load in {unitSystem === "ip" ? "HP" : "kW"} (ACL)
                        </span>
                        <div className="text-right">
                          <input
                            type="number"
                            className="w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                            value={
                              manualOverrides["acl"] !== undefined
                                ? manualOverrides["acl"]
                                : calc.totalAcl.toFixed(2)
                            }
                            onChange={(e) => setOverride("acl", e.target.value)}
                          />
                        </div>
                        <div className="text-right">
                          <input
                            type="number"
                            className="w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                            value={
                              manualOverrides["em"] !== undefined
                                ? manualOverrides["em"]
                                : calc.totalEmergency.toFixed(2)
                            }
                            onChange={(e) => setOverride("em", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_80px_80px] gap-4 items-center pb-2 border-b border-surface-2">
                        <span className="text-[12.5px] font-medium text-muted-foreground">
                          Demand load in kVA (DL = ACL / PF)
                        </span>
                        <div className="text-right">
                          <input
                            type="number"
                            className="w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                            value={
                              manualOverrides["demandAcl"] !== undefined
                                ? manualOverrides["demandAcl"]
                                : calc.demandLoadAcl.toFixed(2)
                            }
                            onChange={(e) => setOverride("demandAcl", e.target.value)}
                          />
                        </div>
                        <div className="text-right">
                          <input
                            type="number"
                            className="w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                            value={
                              manualOverrides["demandEm"] !== undefined
                                ? manualOverrides["demandEm"]
                                : calc.demandLoadEm.toFixed(2)
                            }
                            onChange={(e) => setOverride("demandEm", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_80px_80px] gap-4 items-center pb-2 border-b border-surface-2">
                        <span className="text-[12.5px] font-medium text-muted-foreground">
                          Calculated size for DG set (DL / LF) kVA
                        </span>
                        <div className="text-right">
                          <input
                            type="number"
                            className="w-full text-right text-[13px] font-bold text-primary bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                            value={
                              manualOverrides["calcAcl"] !== undefined
                                ? manualOverrides["calcAcl"]
                                : calc.calcSizeAcl.toFixed(2)
                            }
                            onChange={(e) => setOverride("calcAcl", e.target.value)}
                          />
                        </div>
                        <div className="text-right">
                          <input
                            type="number"
                            className="w-full text-right text-[13px] font-bold text-primary bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                            value={
                              manualOverrides["calcEm"] !== undefined
                                ? manualOverrides["calcEm"]
                                : calc.calcSizeEm.toFixed(2)
                            }
                            onChange={(e) => setOverride("calcEm", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex justify-between items-end">
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                            Selected DG Set Size
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <select
                              className="text-[28px] font-bold tracking-tight text-primary bg-transparent outline-none border border-border rounded px-2 py-1 cursor-pointer hover:bg-surface-2 transition-colors focus:ring-2 focus:ring-primary/20"
                              value={calc.selectedSize}
                              onChange={(e) => setUserSelectedSize(Number(e.target.value))}
                            >
                              {STANDARD_SIZES.map((size) => (
                                <option key={size} value={size}>
                                  {size} kVA
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="text-right pb-1">
                          <span className="text-[13px] font-medium text-muted-foreground">
                            Max Start:{" "}
                          </span>
                          <div className="inline-block w-16 ml-1">
                            <input
                              type="number"
                              className="w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                              value={
                                manualOverrides["maxStart"] !== undefined
                                  ? manualOverrides["maxStart"]
                                  : calc.maxStartCur.toFixed(2)
                              }
                              onChange={(e) => setOverride("maxStart", e.target.value)}
                            />
                          </div>
                          <span className="text-[13px] font-bold text-foreground ml-1">A</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-4 text-[12.5px] shrink-0">
                    <h4 className="font-semibold text-muted-foreground mb-3 pb-2 border-b border-white/40 dark:border-white/10">
                      Motor Analysis
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max Starting Current</span>
                        <span className="font-medium font-mono">
                          {calc.maxStartCur.toFixed(2)} A
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Largest Motor Size</span>
                        <span className="font-medium font-mono">
                          {calc.largestMotorKw > 0
                            ? unitSystem === "ip"
                              ? (calc.largestMotorKw / 0.746).toFixed(2) + " HP"
                              : calc.largestMotorKw.toFixed(2) + " kW"
                            : "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Largest Motor Starter</span>
                        <span className="font-medium">
                          {calc.largestMotorKw > 0 ? calc.largestMotorStarter : "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
