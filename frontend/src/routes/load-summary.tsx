import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { useState, useMemo, useEffect } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { useConfirm } from "@/hooks/use-confirm";
import { DataGrid, Column } from "@/components/workspace/DataGrid";
import { Plus, Download, Trash, Copy, X, Database } from "lucide-react";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuContent } from "@/components/ui/context-menu";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;

export const Route = createFileRoute("/load-summary")({
  head: () => ({
    meta: [
      { title: "Load Summary — MEP Calc" },
      { name: "description", content: "Calculate electrical load summary" },
    ],
  }),
  component: LoadSummaryPage,
});

interface LoadRow {
  id: string;
  description: string;
  qty: number;
  area: number;
  lighting: number;
  power: number;
  hvac: number;
  other: number;
  totalLoad: number;
  remarks: string;
}

const computeRowOutputs = (row: LoadRow): LoadRow => {
  const qty = row.qty || 0;
  const lighting = row.lighting || 0;
  const power = row.power || 0;
  const hvac = row.hvac || 0;
  const other = row.other || 0;

  let totalLoad = 0;
  if (qty > 0) {
    totalLoad = qty * (lighting + power + hvac + other);
  } else {
    totalLoad = lighting + power + hvac + other;
  }

  return { ...row, totalLoad: Number(totalLoad.toFixed(2)) };
};

const pushToHistory = (
  currentRows: LoadRow[],
  history: LoadRow[][],
  setHistory: (h: LoadRow[][]) => void,
  setRedoStack?: (r: LoadRow[][]) => void
) => {
  setHistory([...history, [...currentRows]]);
  if (setRedoStack) setRedoStack([]);
};

function LoadSummaryPage() {
  const { project } = useWorkspace();
  const confirm = useConfirm();

  const [rows, setRows] = useState<LoadRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeRowId, setActiveRowId] = useState<string>();
  
  const [history, setHistory] = useState<LoadRow[][]>([]);
  const [redoStack, setRedoStack] = useState<LoadRow[][]>([]);
  
  const [transformers, setTransformers] = useState("");

  const totalPower = rows.reduce((acc, row) => acc + row.totalLoad, 0);
  const totalPowerWithSafety = totalPower * 1.1;

  const updateRow = (id: string, updates: Partial<LoadRow>) => {
    pushToHistory(rows, history, setHistory, setRedoStack);
    
    if (selected.has(id) && selected.size > 1) {
      setRows(prev => prev.map(row => {
        if (selected.has(row.id)) {
          return computeRowOutputs({ ...row, ...updates });
        }
        return row;
      }));
    } else {
      setRows(prev => prev.map(row => 
        row.id === id ? computeRowOutputs({ ...row, ...updates }) : row
      ));
    }
  };

  const handleToggle = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isShift && activeRowId) {
        const currentIndex = rows.findIndex(r => r.id === id);
        const activeIndex = rows.findIndex(r => r.id === activeRowId);
        
        if (currentIndex !== -1 && activeIndex !== -1) {
          const start = Math.min(currentIndex, activeIndex);
          const end = Math.max(currentIndex, activeIndex);
          for (let i = start; i <= end; i++) {
            next.add(rows[i].id);
          }
          return next;
        }
      }
      
      if (next.has(id)) next.delete(id);
      else next.add(id);
      
      return next;
    });
    setActiveRowId(id);
  };

  const handleToggleAll = () => {
    if (selected.size === rows.length && rows.length > 0) {
       setSelected(new Set());
    } else {
       setSelected(new Set(rows.map(r => r.id)));
    }
  };

  const addRow = () => {
    const newId = `ls_${Math.random().toString(36).slice(2, 9)}`;
    const newRow: LoadRow = {
      id: newId,
      description: "",
      qty: 1,
      area: 0,
      lighting: 0,
      power: 0,
      hvac: 0,
      other: 0,
      totalLoad: 0,
      remarks: ""
    };
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => [...prev, computeRowOutputs(newRow)]);
    setSelected(new Set([newId]));
    setActiveRowId(newId);
  };

  const loadDummyData = () => {
    const dummy: LoadRow[] = [
      { id: `ls_${Math.random().toString(36).slice(2, 9)}`, description: "First Floor Office", qty: 1, area: 150, lighting: 1.5, power: 3.0, hvac: 15.0, other: 0, totalLoad: 0, remarks: "" },
      { id: `ls_${Math.random().toString(36).slice(2, 9)}`, description: "Second Floor Meeting Rooms", qty: 2, area: 40, lighting: 0.5, power: 1.0, hvac: 4.0, other: 0, totalLoad: 0, remarks: "Dimmable" },
      { id: `ls_${Math.random().toString(36).slice(2, 9)}`, description: "Server Room", qty: 1, area: 20, lighting: 0.2, power: 20.0, hvac: 25.0, other: 0, totalLoad: 0, remarks: "Critical load" },
      { id: `ls_${Math.random().toString(36).slice(2, 9)}`, description: "Pantry", qty: 1, area: 15, lighting: 0.15, power: 5.0, hvac: 1.5, other: 0, totalLoad: 0, remarks: "" }
    ];
    
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => [...prev, ...dummy.map(computeRowOutputs)]);
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (await confirm(`Are you sure you want to delete ${selected.size} selected row(s)?`)) {
      pushToHistory(rows, history, setHistory, setRedoStack);
      setRows(prev => prev.filter(r => !selected.has(r.id)));
      setSelected(new Set());
      setActiveRowId(undefined);
    }
  };

  const duplicateSelected = () => {
    if (selected.size === 0) return;
    pushToHistory(rows, history, setHistory, setRedoStack);
    
    const duplicated: LoadRow[] = [];
    rows.forEach(r => {
      if (selected.has(r.id)) {
        duplicated.push({
          ...r,
          id: `ls_dup_${Math.random().toString(36).slice(2, 9)}`,
          description: `${r.description} (Copy)`
        });
      }
    });
    setRows(prev => [...prev, ...duplicated]);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === "Enter" && activeEl.tagName === "INPUT") {
        activeEl.blur();
        return;
      }

      if (e.key === "Escape") {
        activeEl?.blur();
        if (selected.size > 0) {
          e.preventDefault();
          setSelected(new Set());
          setActiveRowId(undefined);
        }
        return;
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && activeEl.tagName === "INPUT") {
        const rowIdxStr = activeEl.getAttribute("data-row-idx");
        const colIdxStr = activeEl.getAttribute("data-col-idx");
        if (rowIdxStr !== null && colIdxStr !== null) {
          let rIdx = parseInt(rowIdxStr);
          let cIdx = parseInt(colIdxStr);
          
          if (e.key === "ArrowUp") rIdx--;
          else if (e.key === "ArrowDown") rIdx++;
          else if (e.key === "ArrowLeft") cIdx--;
          else if (e.key === "ArrowRight") cIdx++;

          const nextInput = document.querySelector(`input[data-row-idx="${rIdx}"][data-col-idx="${cIdx}"]`) as HTMLInputElement;
          if (nextInput) {
            e.preventDefault();
            nextInput.focus();
            setTimeout(() => nextInput.select(), 0);
          }
          return;
        }
      }

      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "SELECT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.isContentEditable
      );
      if (isInput) return;

      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(rows.map(r => r.id)));
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        e.preventDefault();
        deleteSelected();
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (history.length > 0) {
          const prev = history[history.length - 1];
          setRedoStack(rs => [[...rows], ...rs]);
          setHistory(h => h.slice(0, -1));
          setRows(prev);
          setSelected(new Set());
        }
      }

      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        if (redoStack.length > 0) {
          const next = redoStack[0];
          setHistory(h => [...h, [...rows]]);
          setRedoStack(rs => rs.slice(1));
          setRows(next);
          setSelected(new Set());
        }
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "c" && selected.size > 0) {
        e.preventDefault();
        const toCopy = rows.filter(r => selected.has(r.id));
        localStorage.setItem("mep_clipboard_load", JSON.stringify(toCopy));
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "x" && selected.size > 0) {
        e.preventDefault();
        const toCopy = rows.filter(r => selected.has(r.id));
        localStorage.setItem("mep_clipboard_load", JSON.stringify(toCopy));
        pushToHistory(rows, history, setHistory, setRedoStack);
        setRows(prev => prev.filter(r => !selected.has(r.id)));
        setSelected(new Set());
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        try {
          const clip = localStorage.getItem("mep_clipboard_load");
          if (clip) {
            const parsed = JSON.parse(clip) as LoadRow[];
            const pasted = parsed.map((item, i) => ({
              ...item,
              id: `ls_paste_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 9)}`,
              description: `${item.description} (Copy)`
            }));
            pushToHistory(rows, history, setHistory, setRedoStack);
            setRows(prev => [...prev, ...pasted]);
          }
        } catch (err) {}
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, selected, history, redoStack, confirm]);

  const handleImportExcelRows = (mappedRows: any[]) => {
    const newRows: LoadRow[] = mappedRows.map((mr, idx) => ({
      id: `ls_import_${Date.now()}_${idx}`,
      description: mr.description || `Imported Load ${idx + 1}`,
      qty: Number(mr.qty) || 1,
      phase: mr.phase || "3",
      loadW: Number(mr.loadW) || 0,
      powerFactor: Number(mr.powerFactor) || 0.8,
      efficiency: Number(mr.efficiency) || 0.85,
      diversityFactor: Number(mr.diversityFactor) || 1,
      remarks: mr.remarks || ""
    }));
    
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => [...prev, ...newRows]);
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Load Summary");

    worksheet.mergeCells("A1:G1");
    worksheet.mergeCells("H1:J1");
    worksheet.getCell("A1").value = "Calculation No: CEC-EED-PXXX-203   Rev. No.:";
    worksheet.getCell("H1").value = "Date :";

    worksheet.mergeCells("A2:G2");
    worksheet.mergeCells("H2:J2");
    worksheet.getCell("A2").value = `Project No : ${project.code}`;
    worksheet.getCell("H2").value = "Client :";

    worksheet.mergeCells("A3:G3");
    worksheet.mergeCells("H3:J3");
    worksheet.getCell("A3").value = `Project Name : ${project.name}`;
    worksheet.getCell("H3").value = "End User :";

    for (let r = 1; r <= 3; r++) {
      const row = worksheet.getRow(r);
      row.height = 22;
      for (let c = 1; c <= 10; c++) {
        const cell = worksheet.getCell(r, c);
        cell.font = { bold: true, name: "Arial", size: 10 };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } }
        };
      }
    }

    const headers = [
      "S.No", "Description", "Qty\nunit", "Area\nsq. m.", 
      "Lighting\nkW", "Power\nkW", "HVAC\nkW", 
      "Other Load\nkW", "Total Load\nkW", "Remarks"
    ];

    const headerRow = worksheet.getRow(4);
    headerRow.values = headers;
    headerRow.height = 35;
    
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" } 
      };
      cell.font = { bold: true, name: "Arial", size: 9 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } }
      };
    });

    rows.forEach((r, i) => {
      const row = worksheet.addRow([
        i + 1,
        r.description,
        r.qty,
        r.area,
        r.lighting,
        r.power,
        r.hvac,
        r.other,
        r.totalLoad,
        r.remarks
      ]);

      row.eachCell((cell) => {
        cell.font = { name: "Arial", size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } }
        };
      });
    });

    let currentRow = worksheet.rowCount + 2;

    worksheet.mergeCells(currentRow, 1, currentRow, 8);
    let cell = worksheet.getCell(currentRow, 1);
    cell.value = "  Total Electrical Power";
    cell.font = { name: "Arial", size: 10, bold: true };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    
    let cellValue = worksheet.getCell(currentRow, 9);
    cellValue.value = totalPower;
    cellValue.font = { name: "Arial", size: 10, bold: true };
    cellValue.alignment = { horizontal: "right", vertical: "middle" };

    for(let c=1; c<=10; c++) {
       worksheet.getCell(currentRow, c).border = {
         top: { style: "thin", color: { argb: "000000" } }, 
         bottom: { style: "thin", color: { argb: "000000" } },
         left: { style: "thin", color: { argb: "000000" } }, 
         right: { style: "thin", color: { argb: "000000" } }
       };
    }
    worksheet.getRow(currentRow).height = 20;

    currentRow++;

    worksheet.mergeCells(currentRow, 1, currentRow, 8);
    cell = worksheet.getCell(currentRow, 1);
    cell.value = "  Total Power Required Considering 10% safety (kW)";
    cell.font = { name: "Arial", size: 10, bold: true };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    
    cellValue = worksheet.getCell(currentRow, 9);
    cellValue.value = Number(totalPowerWithSafety.toFixed(2));
    cellValue.font = { name: "Arial", size: 10, bold: true };
    cellValue.alignment = { horizontal: "right", vertical: "middle" };

    for(let c=1; c<=10; c++) {
       worksheet.getCell(currentRow, c).border = {
         top: { style: "thin", color: { argb: "000000" } }, 
         bottom: { style: "thin", color: { argb: "000000" } },
         left: { style: "thin", color: { argb: "000000" } }, 
         right: { style: "thin", color: { argb: "000000" } }
       };
    }
    worksheet.getRow(currentRow).height = 20;

    currentRow += 2;

    worksheet.mergeCells(currentRow, 1, currentRow, 8);
    cell = worksheet.getCell(currentRow, 1);
    cell.value = "  Selected Number of Transformers";
    cell.font = { name: "Arial", size: 10, bold: true };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    
    cellValue = worksheet.getCell(currentRow, 9);
    cellValue.value = transformers;
    cellValue.font = { name: "Arial", size: 10, bold: true };
    cellValue.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.mergeCells(currentRow, 9, currentRow, 10);

    for(let c=1; c<=10; c++) {
       worksheet.getCell(currentRow, c).border = {
         top: { style: "thin", color: { argb: "000000" } }, 
         bottom: { style: "thin", color: { argb: "000000" } },
         left: { style: "thin", color: { argb: "000000" } }, 
         right: { style: "thin", color: { argb: "000000" } }
       };
    }
    worksheet.getRow(currentRow).height = 20;

    currentRow += 2;

    const refLines = [
       "  Reference: 1. Architectural Drawings",
       "                    2. DBR",
       "                    3. Summary of Cooling Load",
       "                    4. Selection from Manufacturer"
    ];
    for (let r = 0; r < refLines.length; r++) {
      const rIdx = currentRow + r;
      worksheet.getRow(rIdx).height = 20;
      for (let c = 1; c <= 10; c++) {
        worksheet.getCell(rIdx, c).border = {
          left: c === 1 ? { style: "thin", color: { argb: "000000" } } : undefined,
          right: c === 10 ? { style: "thin", color: { argb: "000000" } } : undefined,
          top: r === 0 ? { style: "thin", color: { argb: "000000" } } : undefined,
          bottom: r === refLines.length - 1 ? { style: "thin", color: { argb: "000000" } } : undefined
        };
      }
      worksheet.mergeCells(rIdx, 1, rIdx, 10);
      const cellRef = worksheet.getCell(rIdx, 1);
      cellRef.value = refLines[r];
      cellRef.font = { name: "Arial", size: 9, bold: true };
      cellRef.alignment = { horizontal: "left", vertical: "middle" };
    }

    currentRow += refLines.length;

    worksheet.getRow(currentRow).height = 25;
    const orangeFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFCD5B4" } 
    } as ExcelJS.Fill;

    for(let c = 1; c <= 10; c++) {
        const sigCell = worksheet.getCell(currentRow, c);
        sigCell.fill = orangeFill;
        sigCell.border = {
            top: { style: "thin", color: { argb: "000000" } }, 
            left: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } }, 
            right: { style: "thin", color: { argb: "000000" } }
        };
    }
    
    worksheet.mergeCells(currentRow, 1, currentRow, 3);
    worksheet.mergeCells(currentRow, 4, currentRow, 6);
    worksheet.mergeCells(currentRow, 7, currentRow, 10);

    worksheet.getCell(currentRow, 1).value = "Originated by";
    worksheet.getCell(currentRow, 4).value = "Reviewed by";
    worksheet.getCell(currentRow, 7).value = "Approved by";

    [1, 4, 7].forEach(c => {
      const cellSig = worksheet.getCell(currentRow, c);
      cellSig.font = { bold: true, name: "Arial", size: 10 };
      cellSig.alignment = { horizontal: "center", vertical: "middle" };
    });

    currentRow += 1;

    const labels = ["Name:", "Signature:", "Date:"];
    labels.forEach((label) => {
      worksheet.getRow(currentRow).height = 25;
      
      for(let c = 1; c <= 10; c++) {
          worksheet.getCell(currentRow, c).border = {
              top: { style: "thin", color: { argb: "000000" } }, 
              left: { style: "thin", color: { argb: "000000" } },
              bottom: { style: "thin", color: { argb: "000000" } }, 
              right: { style: "thin", color: { argb: "000000" } }
          };
      }

      worksheet.mergeCells(currentRow, 1, currentRow, 3);
      worksheet.mergeCells(currentRow, 4, currentRow, 6);
      worksheet.mergeCells(currentRow, 7, currentRow, 10);

      const cellA = worksheet.getCell(currentRow, 1);
      cellA.value = `  ${label}`;
      cellA.font = { name: "Arial", size: 10, bold: true };
      cellA.alignment = { horizontal: "left", vertical: "middle" };

      currentRow += 1;
    });

    worksheet.getColumn(1).width = 8;
    worksheet.getColumn(2).width = 30;
    worksheet.getColumn(3).width = 10;
    worksheet.getColumn(4).width = 12;
    worksheet.getColumn(5).width = 12;
    worksheet.getColumn(6).width = 12;
    worksheet.getColumn(7).width = 12;
    worksheet.getColumn(8).width = 12;
    worksheet.getColumn(9).width = 15;
    worksheet.getColumn(10).width = 25;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Load_Summary_${project.code}.xlsx`);
  };

  const columns: Column<LoadRow>[] = useMemo(() => [
    {
      key: "id",
      header: "S.No",
      width: 60,
      align: "center",
      render: (row) => {
        const index = rows.findIndex(r => r.id === row.id) + 1;
        return <span className="text-muted-foreground">{index}</span>;
      }
    },
    {
      key: "description",
      header: "Description",
      width: 250,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            value={row.description}
            onChange={(e) => updateRow(row.id, { description: e.target.value })}
            className="w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5"
            autoComplete="off"
            data-row-idx={rowIdx}
            data-col-idx={1}
          />
        );
      }
    },
    {
      key: "qty",
      header: "Qty",
      width: 80,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.qty === 0 ? "" : row.qty}
            onChange={(e) => updateRow(row.id, { qty: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={2}
          />
        );
      }
    },
    {
      key: "area",
      header: "Area (sq.m)",
      width: 100,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.area === 0 ? "" : row.area}
            onChange={(e) => updateRow(row.id, { area: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={3}
          />
        );
      }
    },
    {
      key: "lighting",
      header: "Lighting (kW)",
      width: 110,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            step="0.1"
            value={row.lighting === 0 ? "" : row.lighting}
            onChange={(e) => updateRow(row.id, { lighting: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={4}
          />
        );
      }
    },
    {
      key: "power",
      header: "Power (kW)",
      width: 100,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            step="0.1"
            value={row.power === 0 ? "" : row.power}
            onChange={(e) => updateRow(row.id, { power: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={5}
          />
        );
      }
    },
    {
      key: "hvac",
      header: "HVAC (kW)",
      width: 100,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            step="0.1"
            value={row.hvac === 0 ? "" : row.hvac}
            onChange={(e) => updateRow(row.id, { hvac: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={6}
          />
        );
      }
    },
    {
      key: "other",
      header: "Other (kW)",
      width: 110,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            step="0.1"
            value={row.other === 0 ? "" : row.other}
            onChange={(e) => updateRow(row.id, { other: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={7}
          />
        );
      }
    },
    {
      key: "totalLoad",
      header: "Total Load (kW)",
      width: 130,
      align: "right",
      render: (row) => (
        <div className="h-full w-full flex items-center justify-end px-3 bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold border-x border-blue-500/20">
          {row.totalLoad.toFixed(2)}
        </div>
      )
    },
    {
      key: "remarks",
      header: "Remarks",
      width: 200,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            value={row.remarks}
            onChange={(e) => updateRow(row.id, { remarks: e.target.value })}
            className="w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5"
            autoComplete="off"
            data-row-idx={rowIdx}
            data-col-idx={9}
          />
        );
      }
    }
  ], [rows]);

  return (
    <AppShell 
      title="Load Summary" 
      subtitle="Calculate electrical load summary and equipment totals"
      actions={
        <div className="flex gap-2">
          <ImportExcelBtn
            columnMapping={{
              "Description": "description",
              "Quantity": "qty",
              "Qty": "qty",
              "Phase": "phase",
              "Load (W)": "loadW",
              "Wattage": "loadW",
              "Power Factor": "powerFactor",
              "PF": "powerFactor",
              "Efficiency": "efficiency",
              "Eff": "efficiency",
              "Diversity Factor": "diversityFactor",
              "DF": "diversityFactor",
              "Remarks": "remarks"
            }}
            onImport={handleImportExcelRows}
            className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded px-3 py-1.5 text-[12.5px] font-medium transition-colors"
          />
        </div>
      }
    >
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30">
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
        
        <div className="relative z-10 flex flex-col h-full w-full">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-background/80 backdrop-blur-md shrink-0 select-none">
            <div className="flex items-center gap-2">
              <button 
                onClick={addRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-[12.5px] font-medium shadow-sm transition-all"
              >
                <Plus className="size-3.5" /> Add Row
              </button>
              
              <div className="w-px h-4 bg-border mx-1" />
              
              <button 
                disabled={selected.size === 0}
                onClick={deleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded text-[12.5px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <Trash className="size-3.5" /> Delete Selected
              </button>

              <div className="w-px h-4 bg-border mx-1" />
              
              <button 
                onClick={loadDummyData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded text-[12.5px] font-medium transition-colors"
              >
                <Database className="size-3.5" /> Load Sample Data
              </button>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col relative p-4">
             {/* Grid */}
             <div className="flex-1 flex flex-col bg-white/80 dark:bg-black/40 backdrop-blur-sm rounded-xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.04)] overflow-hidden">
                {rows.length > 0 ? (
                  <DataGrid
                    rows={rows}
                    columns={columns}
                    selected={selected}
                    onToggle={handleToggle}
                    onToggleAll={handleToggleAll}
                    renderContextMenu={(row) => (
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem onClick={() => {
                          const newRow = { ...row, id: `ls_${Math.random().toString(36).slice(2, 9)}` };
                          pushToHistory(rows, history, setHistory);
                          setRows(prev => {
                            const idx = prev.findIndex(r => r.id === row.id);
                            const next = [...prev];
                            next.splice(idx + 1, 0, newRow);
                            return next;
                          });
                        }}>
                          <Copy className="size-4 mr-2" /> Duplicate Row
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => {
                          pushToHistory(rows, history, setHistory);
                          setRows(prev => prev.filter(r => r.id !== row.id));
                          setSelected(prev => {
                            const next = new Set(prev);
                            next.delete(row.id);
                            return next;
                          });
                        }} className="text-red-600 dark:text-red-400 focus:text-red-600">
                          <Trash className="size-4 mr-2" /> Delete Row
                        </ContextMenuItem>
                      </ContextMenuContent>
                    )}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4 border border-border shadow-sm">
                      <Plus className="size-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">No load summary rows</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mb-4">
                      Add a row or load sample data to begin calculating your total electrical load.
                    </p>
                    <button 
                      onClick={addRow}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-[13px] font-medium shadow-sm transition-all"
                    >
                      <Plus className="size-4" /> Add First Row
                    </button>
                  </div>
                )}
             </div>

             {/* Footer Calculations */}
             {rows.length > 0 && (
               <div className="mt-4 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex gap-12 shrink-0">
                 <div className="flex-1 space-y-4">
                   <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-border pb-2">Load Totals</h3>
                   
                   <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg">
                     <span className="text-[13px] font-medium">Total Electrical Power:</span>
                     <span className="font-bold font-mono text-[15px]">{totalPower.toFixed(2)} kW</span>
                   </div>

                   <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3 rounded-lg border border-blue-200 dark:border-blue-800/50">
                     <span className="text-[13px] font-semibold">Total Power (10% Safety):</span>
                     <span className="font-bold font-mono text-[16px]">{totalPowerWithSafety.toFixed(2)} kW</span>
                   </div>
                 </div>
                 
                 <div className="flex-1 space-y-4">
                   <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-border pb-2">Transformer Selection</h3>
                   
                   <div className="space-y-1">
                     <label className="text-[12px] font-medium text-slate-500">Selected Number of Transformers</label>
                     <input
                       type="text"
                       value={transformers}
                       onChange={(e) => setTransformers(e.target.value)}
                       placeholder="e.g., 2 x 1500 kVA"
                       className="w-full bg-white dark:bg-slate-900 border border-border rounded p-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary"
                     />
                     <p className="text-[11px] text-muted-foreground mt-1">
                       This will be included at the bottom of your exported Excel sheet.
                     </p>
                   </div>
                 </div>
               </div>
             )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
